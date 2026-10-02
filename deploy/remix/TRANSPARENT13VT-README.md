# Transparent13VTQueue — Testnet Contract Candidate

`Transparent13VTQueue.sol` เป็น contract candidate สำหรับทดสอบการฝาก token แบบโปร่งใสและจัดสรร FIFO โดยใช้ OpenZeppelin `SafeERC20`, `Address.sendValue` และ `ReentrancyGuard`.

## สิ่งที่มี

- `registerPosition(recipient)` รับ token deposit คงที่ 13 token units และเก็บ fee exact `0.0013 BNB` ในธุรกรรมเดียว
- `fundNext(amount, recipientCount)` รับเงินทุนภายนอกและจัดสรรให้ ticket ที่รออยู่ตาม `ticketId` FIFO
- `claim(ticketId)` ให้ผู้รับดึงยอดของตนเอง โดย state ถูก commit ก่อน token transfer
- ตรวจยอด token ที่เข้า contract ด้วย balance delta เพื่อปฏิเสธ fee-on-transfer/rebase behavior ที่ยอดไม่ตรง
- ใช้ `nonReentrant` กับฟังก์ชันที่ทำ external token/BNB call
- ไม่มี owner sweep, referral tree, automatic Reborn, mint, guaranteed return หรือ hidden routing

## สิ่งที่ไม่มีโดยตั้งใจ

สัญญานี้ **ไม่ใช่ implementation ของ A/B referral หรือ U1/U2 Reborn rules**. กฎดังกล่าวต้องผ่านการตัดสินใจด้านเศรษฐศาสตร์/กฎหมายและ independent audit แยกต่างหาก; ห้ามตีความ FIFO ticket เป็นผลตอบแทนหรือการรับประกันรายได้

## Compile

- Solidity: `0.8.24`
- OpenZeppelin Contracts: `5.4.0`
- Optimizer: enabled, runs 200
- Candidate compile result: bytecode 4,018 bytes, ABI 35 entries

## ลำดับทดสอบ Testnet ที่ปลอดภัย

1. Deploy ด้วย token contract ที่ตรวจ `chainId`, bytecode, symbol และ decimals แล้วเท่านั้น
2. ตั้ง `feeWallet` เป็น address ที่ประกาศและตรวจซ้ำ; ห้ามใช้ owner wallet เป็น token address
3. เรียก token `approve(queue, 13 * 10**decimals)` แยกธุรกรรม และตรวจ receipt สำเร็จ
4. เรียก `registerPosition(recipient)` พร้อม `msg.value = 0.0013 BNB`; ตรวจ receipt และ `Registered` event
5. เรียก `fundNext(13 * 10**decimals, 1)` จาก funder ที่ได้รับอนุญาตตามกระบวนการทดสอบ; ตรวจ `RevenueScheduled`
6. ให้ recipient เรียก `claim(ticketId)` และตรวจ `Claimed`; การจ่ายเป็น pull-claim ไม่ใช่การโอนอัตโนมัติ

หน้าเว็บใน dashboard มีเฉพาะ **dry-run**: สร้าง calldata และเรียก `eth_getCode`/`eth_estimateGas` ได้ แต่ไม่เรียก `approve`, `transferFrom` หรือ `sendTransaction`. ต้องป้อน contract address ที่ deploy แล้วเอง

> Compile ผ่านไม่ใช่ security audit และการทดสอบ Testnet ไม่ใช่หลักฐานว่าระบบเหมาะสมกับ Mainnet
