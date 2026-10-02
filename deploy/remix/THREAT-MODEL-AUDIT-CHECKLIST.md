# 13VT — Threat Model และ Audit Checklist

สถานะ: **เตรียมตรวจสอบ contract จริง**; ไม่ใช่ security audit และไม่รับรองความปลอดภัย

## 1. ขอบเขตและทรัพย์สินที่ต้องปกป้อง

### ทรัพย์สิน

- Token ที่ฝากเข้า contract และยอดคงเหลือจริงของ contract
- Central pool deposit ledger จาก Direct คู่ #4/#6 เป็นต้นไป
- Reserve ต่อ Position และสถานะ `UNFUNDED/Pending/Paid`
- FIFO head, parent/slot ซ้าย-ขวา และ `positionId`
- Fee 0.0013 BNB และ fee wallet
- สิทธิ์ admin, pause, token/fee-wallet configuration และ event evidence

### ผู้โจมตี/ความผิดพลาด

- ผู้เรียกที่พยายามใช้ Position หรือ deposit ของผู้อื่น
- Token contract ที่มี callback/พฤติกรรมผิดปกติหรือ transfer ไม่ได้ยอดเต็ม
- Fee wallet หรือ token ที่เป็น contract ซึ่ง reenter ระหว่าง external call
- Operator/admin ที่มีสิทธิ์กว้างเกินไปหรือถูก key compromise
- RPC/backend ที่ล่าช้า, index ผิด, หรือแสดงยอดที่ยังไม่มี receipt
- การแข่งขันของธุรกรรมหลายรายการใน block เดียวและการ retry hash เดิม

## 2. Threats, controls และหลักฐานที่ต้องตรวจ

| ID | ภัยคุกคาม | ผลกระทบ | Controls ที่ต้องมี | Test/evidence |
|---|---|---|---|---|
| T1 | Reentrancy ระหว่าง `transferFrom`, token payout หรือ fee-wallet call | จ่ายซ้ำ, เปลี่ยน head/slot ระหว่าง state transition | `nonReentrant`; checks-effects-interactions; อัปเดต ledger/consume deposit ก่อน external call; ใช้ `SafeERC20`; fee call ตรวจ success | malicious ERC20/fee wallet เรียกกลับทุก entry point; invariant payout ครั้งเดียว |
| T2 | ใช้ central depositId ซ้ำ | ยอดจ่ายเกินยอดฝาก | `depositId` unique, `consumedAt`/status, consume atomically, ห้าม fallback ไปใช้ reserve อื่นเงียบ ๆ | duplicate consume, same-block race, revert แล้ว retry |
| T3 | จ่าย Parent ผิดจาก FIFO | ผู้รับผิดคน/ลำดับไม่โปร่งใส | global sequence, `head`, left-before-right, ไม่ข้าม open parent, deterministic tie-breaker เป็น block/order ที่บันทึกใน contract | random queue, many wallets, same-block insertion |
| T4 | วางขวาก่อนซ้ายหรือเติม slot ซ้ำ | โครงสร้าง B เสีย, payout trigger ผิด | `right != 0` ได้ต่อเมื่อ `left != 0`; slot assignment atomic; child มี parent เดียว | repeated placement, wrong-side calls, duplicate child |
| T5 | Parent `UNFUNDED` ถูกข้าม หรือได้รับเครดิตไร้เงิน | หนี้ลอยและลำดับเปลี่ยน | วางได้ตาม policy แต่ payout ต้องมี unconsumed central deposit; ไม่มี balance = `UNFUNDED/Pending`; ห้ามสร้างยอด claimable | empty pool, refill later, head remains deterministic |
| T6 | จ่ายเมื่อวางซ้ายมากกว่าหนึ่งครั้ง | double payout | `payoutPaid`/payoutId one-time; mark before token call; left event cannot retrigger | same parent second left attempt, reentrancy |
| T7 | Reborn สร้างซ้ำ | Position inflation, queue corruption | `successorEnqueued` one-time; require paid + left + right; successor has new ID and no copied funding | repeated completion, failed payout then retry |
| T8 | ใช้ A reserve ของลูกไปจ่าย B Parent ซ้ำ | conservation failure | source-to-use ledger `{depositId, reserveOwner, payoutId}`; each deposit has one owner/use path | cross-position references, reserve reuse invariant |
| T9 | fee จ่ายไม่ exact, เก็บซ้ำ หรือเข้ากระเป๋าผิด | สูญเสีย BNB/สร้าง Position โดยไม่จ่าย fee | `msg.value == 1.3e15`; fee check before state; immutable/timelocked fee wallet; one fee per registerA; event | 0, under, exact, over; fee-wallet revert; reborn no fee |
| T10 | fee wallet reenters or rejects payment | partial state/DoS | state update and accounting before call; `nonReentrant`; decide whether fee transfer failure reverts whole registration; no arbitrary receiver | reverting/callback fee wallet |
| T11 | Token fee-on-transfer/rebase/non-standard return | ledger says 13 but contract receives less | measure balance delta; exact amount received; reject unsupported token; `SafeERC20`; fixed token/decimals | false return, no return, taxed transfer, rebase |
| T12 | Admin changes token, fee wallet, fee or queue rules | hidden custody/routing change | immutable values or multisig + timelock + events + pause scope; no owner sweep of reserves | unauthorized admin, timelock delay, event audit |
| T13 | Claim/receipt replay or backend mismatch | UI says paid without chain proof | payout event + receipt status + unique payoutId; backend status separate from chain status | null receipt, reverted receipt, DB failure after chain success |
| T14 | Unbounded queue loops / gas griefing | placement or payout becomes unusable | O(1) head/slot operations; no loop over all positions; bounded maintenance | large queue, 10k positions, gas snapshots |
| T15 | Signature/authorization replay | unauthorized registration or admin action | nonce, domain, chainId, expiry, EIP-712/SIWE validation where used | replay across chain/contract, expired signature |

## 3. Invariants ก่อนอนุญาต payout จริง

1. **Conservation per deposit:** `amount = paid + reserve + unallocated`; every term references a unique `depositId`.
2. **No overpayment:** `sum(payouts from central pool) <= sum(unconsumed central deposits)`.
3. **One payout per Parent:** `payoutPaid[parentId]` changes false → true once only.
4. **FIFO:** only `head` can receive the next placement; left slot precedes right slot.
5. **No orphan child:** each child has at most one parent and appears once in the global queue.
6. **Reborn gate:** no successor unless original Position is paid and both slots are filled; successor starts without copied reserve.
7. **Exact fee:** only approved registration entry points accept exactly `1,300,000,000,000,000 wei`; all read/placement/internal calls accept zero.
8. **External-call safety:** no token/BNB call occurs before all corresponding state is committed and guarded.
9. **Events match state:** deposit, enqueue, placement, funding, payout and fee events contain IDs and amounts that match storage.

## 4. Audit execution checklist

### Specification

- [ ] Freeze token address, chain ID, decimals, fee wallet and `SERVICE_FEE_WEI`.
- [ ] Freeze definition of Direct #4/#6 and how the contract derives the number.
- [ ] Freeze global FIFO tie-breaker for transactions in the same block.
- [ ] Freeze behavior when pool is empty: place-and-hold `UNFUNDED/Pending`.
- [ ] Freeze whether failed fee-wallet transfer reverts registration.

### Code review

- [ ] Compile with pinned Solidity compiler and pinned OpenZeppelin dependencies.
- [ ] Review every `external`/`public` function for payable status and access control.
- [ ] Confirm `nonReentrant` coverage and checks-effects-interactions on every external call.
- [ ] Confirm all arithmetic uses checked Solidity 0.8 behavior or justified SafeCast.
- [ ] Confirm no unbounded loops in registration, placement, payout or view paths.
- [ ] Confirm no owner/admin path can withdraw user reserves or silently change recipients.

### Tests

- [ ] Exact fee: zero, under, exact and over; fee wallet success and revert.
- [ ] Registration: token failure, insufficient allowance, wrong decimals, duplicate referral/Position.
- [ ] FIFO: mixed A-born/B-born, multiple wallets, left-before-right, same-block ordering, full parent.
- [ ] Central pool: deposits enter in order, one deposit consumed once, empty pool leaves `UNFUNDED`, later refill does not reorder existing queue.
- [ ] Reentrancy: malicious token and fee wallet callback on register, placement, payout and rescue paths.
- [ ] Duplicate/replay: same child, same depositId, same payoutId, same signature, repeated Reborn.
- [ ] Failure atomicity: every failed external call leaves Position, head, slot and ledger unchanged.
- [ ] Fuzz/property tests for conservation, FIFO and one-time payout across random operations.
- [ ] Gas tests at realistic queue sizes; verify no DoS from queue growth.

### Deployment and operations

- [ ] Test only on local EVM, then BSC Testnet with a separately verified token.
- [ ] Verify source, compiler, constructor args and immutable addresses on explorer.
- [ ] Start with pause capability controlled by multisig; document who can pause and why.
- [ ] Monitor events and compare them to independent receipt/indexer data.
- [ ] Keep private keys, DB secrets and RPC credentials out of frontend/Vite and git.
- [ ] Obtain independent Solidity/security review and legal/compliance review before mainnet.

## 5. Current repository status

The current `UnfundedFifoModel.sol` remains status-only. It has no token custody, no BNB custody, no `transferFrom`, no payout transfer and no reentrancy surface. Its fee helper only verifies the exact policy value for offline tests; it is not an implementation of the fee collection rule.
