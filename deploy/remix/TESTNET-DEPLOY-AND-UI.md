# BSC Testnet Deployment และการเชื่อม UI

## สถานะ

- `Transparent13VTQueue.sol` compile candidate ผ่านด้วย Solidity `0.8.24` และ OpenZeppelin `5.4.0`
- ยัง **ไม่ได้ deploy** และยังไม่มี contract address จริงใน UI
- การ deploy เป็นธุรกรรม on-chain ต้องใช้ wallet ของผู้ใช้เองและต้องตรวจ payload ใน Remix ก่อนยืนยัน

## Deploy ด้วย Remix แบบปลอดภัย

1. เปิด Remix และสร้าง `Transparent13VTQueue.sol` จากไฟล์นี้
2. เพิ่ม OpenZeppelin imports ให้ Remix resolve เป็น version `5.4.0` และ compile ด้วย Solidity `0.8.24`, optimizer runs 200
3. เลือก Environment เป็น Injected Provider แล้วตรวจ wallet อยู่ BSC Testnet (`chainId 97`)
4. เตรียม constructor arguments:
   - `asset_`: address ของ BEP-20 test token ที่ตรวจ bytecode, symbol และ decimals แล้ว
   - `feeWallet_`: fee wallet ที่ตั้งใจใช้และตรวจ address ซ้ำ
5. ตรวจ gas และ constructor arguments จาก Remix; ยืนยัน deploy จาก wallet ของคุณเอง
6. รอ receipt สำเร็จ แล้วบันทึก contract address และ transaction hash
7. ตรวจ address บน `testnet.bscscan.com` และตรวจ bytecode/ABI ให้ตรงกับ source
8. ตั้งค่า `VITE_TESTNET_QUEUE_ADDRESS=<address ที่มี receipt แล้ว>` ใน environment ของ frontend แล้ว rebuild; หากไม่ตั้งค่า ผู้ใช้ยังป้อน address ใน Dashboard ได้เอง

ห้ามใช้ owner wallet เป็น token address และห้ามใช้ BSC Mainnet ในขั้นตอนนี้

## ใช้ Dashboard

1. เปิดหน้า **FIFO queue dashboard**
2. วาง contract address ที่ deploy แล้ว
3. กด **Read queue**
4. UI จะอ่านจาก public BSC Testnet RPC:
   - `queueState()` สำหรับ registered/waiting/scheduled/claimed/balance
   - `tickets(id)` สำหรับ Position สูงสุด 50 รายการแรก
5. รายการที่ `amount == 0` และยังไม่ claim จะแสดงเป็น `UNFUNDED`
6. Dashboard ไม่เรียก `approve`, `registerPosition`, `fundNext`, `claim` หรือ `sendTransaction`

ตัวกรอง Event รองรับ `Registered`, `RevenueScheduled`, `Claimed`, `Reborn` และ Wallet Address ที่อยู่ใน indexed event fields; การกรองเป็น read-only และไม่เปลี่ยนข้อมูลบนเชน

## ก่อนใช้งานเงินจริง

- ทดสอบ `approve → registerPosition → fundNext → claim` ด้วย test token จำนวนเล็กน้อยบน Testnet
- ตรวจทุก receipt และ event (`Registered`, `RevenueScheduled`, `Claimed`)
- ทดสอบ token transfer failure, fee wallet revert, reentrancy mock, duplicate claim และ FIFO boundary
- ทำ independent security review; compile/deploy สำเร็จไม่ใช่ security audit
