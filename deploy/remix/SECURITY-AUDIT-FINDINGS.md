# Transparent13VTQueue — Security Review (Testnet Candidate)

สถานะ: **manual review ไม่ใช่ independent audit**

Scope: `deploy/remix/Transparent13VTQueue.sol`, deployed Testnet address `0x6575a3319271d1a2fc269b161ab57ed465103838`.

## สรุป

- `SafeERC20` และ `ReentrancyGuard` ใช้กับ external token/BNB calls ในทิศทางที่เหมาะสม
- `claim()` commit state ก่อนโอน token และป้องกัน double claim
- ไม่มี owner sweep, mint, hidden payout routing หรือ automatic Reborn
- **ห้ามใช้ Mainnet/เงินจริง** ก่อนแก้/ยืนยัน findings ด้านล่างและทำ independent review

## Findings

### F-01 — High: Batch loop ใน `fundNext` เสี่ยง gas exhaustion / queue liveness

`fundNext(amount, recipientCount)` loop ตั้งแต่ `firstTicketId` ถึง `lastTicketId` ใน transaction เดียว หาก `recipientCount` สูงเกิน block gas limit ธุรกรรมจะ revert ทั้งหมด ทำให้ส่วนท้ายของ queue ไม่สามารถถูกจัดสรรผ่าน batch นั้นได้ และผู้เรียกสามารถส่งค่า count ที่ทำให้ gas สูงมากได้

**Remediation:** จำกัด `recipientCount` ด้วยค่าคงที่ที่ทดสอบแล้ว เช่น `MAX_FUND_TICKETS`; หรือเปลี่ยนเป็น cursor-based funding หลาย transaction และบันทึก reservation/amount ต่อ batch อย่างชัดเจน. เพิ่ม gas-bound tests.

### F-02 — High: `DEPOSIT_AMOUNT = 13 ether` ผูกกับ decimals 18 แบบ hard-code

ถ้า `asset_` มี decimals ไม่ใช่ 18 จำนวนที่รับจริงจะไม่ใช่ 13 token units ตามคำอธิบาย และอาจเกิดการฝาก/การจัดสรรผิดหน่วย

**Remediation:** ตรวจ `decimals()` ใน constructor แล้วกำหนด `DEPOSIT_AMOUNT = 13 * 10**decimals` โดยมี upper bound หรือรับ `depositAmount` ที่ตรวจสอบและประกาศใน constructor; ห้ามใช้ token ที่มี fee-on-transfer/rebase. ควร emit asset decimals/config ใน deployment evidence.

### F-03 — Medium: Constructor ไม่ตรวจว่า `asset_` เป็น contract และไม่มี decimals/config validation

Address ที่ไม่ใช่ zero แต่เป็น EOA ผ่าน constructor ได้ แล้วธุรกรรมหลักจะ revert ภายหลังหรือทำงานไม่ตรง invariant.

**Remediation:** ตรวจ `asset_.code.length > 0`; ตรวจ decimals และ behavior ด้วย deployment script/off-chain preflight; ใช้ immutable configuration ที่แสดงได้.

### F-04 — Medium: Fee wallet liveness ทำให้ `registerPosition` ล้มเหลวได้

`feeWallet.sendValue(msg.value)` ทำให้ wallet/contract ปลายทางที่ revert หรือไม่มี receive/fallback ที่รับ BNB ทำให้ registration ทั้งหมด revert แม้ token allowance พร้อมแล้ว

**Remediation:** ให้ fee เป็น pullable ledger หรือใช้ fee escrow/withdraw function ที่มี timelock; ถ้าต้องโอนทันที ให้มี configurable recovery process ที่โปร่งใสและทดสอบ fee-wallet failure.

### F-05 — Medium: Contract semantics ไม่ใช่ A/B/U1/U2 rules ที่ระบุไว้ก่อนหน้า

`registerPosition` เป็น ticket แบบ FIFO, `fundNext` ใช้ external funder, `claim` เป็น pull payment และ `createRebornPosition` เป็น explicit successor หลัง claim. ไม่มี direct-child qualification, central even-fund matching, automatic left placement หรือ U2 funding rule.

**Impact:** UI/ธุรกิจห้ามเรียก contract นี้ว่า implement ระบบ A/B หรือรับประกัน payout; event `Reborn` เป็นเพียง successor position ที่เริ่ม `UNFUNDED`.

**Remediation:** ล็อก specification ใหม่และเขียน state machine/invariant tests ก่อนแก้ contract. ห้ามเพิ่ม referral/automatic payout เพียงเพื่อให้ตรงข้อความ UI โดยไม่ audit เศรษฐศาสตร์และกฎหมาย.

### F-06 — Low: `totalScheduled` ไม่ลดเมื่อ claim และไม่ได้ตรวจยอดสำรองแบบ cumulative

ชื่อ `totalScheduled` เป็นยอดที่เคยจัดสรรสะสม ไม่ใช่ยอดคงค้าง. Dashboard ต้องไม่ตีความว่าเป็น reserve ปัจจุบัน.

**Remediation:** เพิ่ม getter/ตัวแปร `outstandingScheduled` หากต้องการยอดคงค้าง และเพิ่ม invariant `contract token balance >= sum of unclaimed ticket amounts`.

### F-07 — Low: Unused errors/semantics เพิ่มความเสี่ยงในการดูแล

`AlreadyRegistered`, `FeeTransferFailed` และบางชื่อ error ไม่ได้ถูกใช้หรือไม่สอดคล้องกับ flow ปัจจุบัน ทำให้ reviewer เข้าใจ capability สูงกว่าที่มีจริง.

**Remediation:** ลบ dead code หรือเพิ่ม tests/docs ให้ตรงกับ implementation.

## สิ่งที่ตรวจผ่านจาก source

- Checks-effects-interactions ใน `claim`: ทำเครื่องหมาย claimed และเคลียร์ amount ก่อน `safeTransfer`
- `nonReentrant` บน `registerPosition`, `fundNext`, `claim`, `createRebornPosition`
- SafeERC20 ใช้กับ `transferFrom` และ `transfer`
- ตรวจ balance delta เพื่อปฏิเสธ token transfer ที่ยอดเข้าไม่ตรง
- ป้องกัน claim โดยผู้ไม่ใช่ recipient และป้องกัน claim ซ้ำ
- ป้องกัน Reborn ซ้ำต่อ parent เดิม

## Test plan ก่อน Mainnet

1. Fuzz `recipientCount`, overflow boundary และ block-gas limit
2. Mock token: standard, false-return, revert, fee-on-transfer, rebase, 6 decimals, 18 decimals
3. Reentrant token/fee wallet mock
4. Duplicate claim, wrong recipient, zero/partial funding, queue boundary
5. `fundNext` หลาย batchและการค้างของ ticket กลางคิว
6. Verify all events/receipt กับ accounting invariant
7. Independent Solidity audit และ legal/economic review

ผลสรุป: Contract เหมาะสำหรับ **isolated Testnet candidate** หลัง preflight แต่ยังไม่ควรใช้รับเงินจริงหรืออ้างว่าเป็น A/B referral contract.
