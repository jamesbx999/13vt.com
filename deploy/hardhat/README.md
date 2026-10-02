# 13VT Hardhat Deployment

ชุดนี้ใช้ compile และ deploy/upgrade แทน Remix โดยค่าเริ่มต้นเป็น **dry-run** และจะไม่ส่งธุรกรรมจนกว่าจะตั้ง execute flag เป็น `YES` อย่างชัดเจน

## 1. ทำไม Remix จึงไม่สร้าง main artifact

จากการตรวจ flattened source:

- ไฟล์มีการประกาศ `contract Transparent13VTQueueUpgradeable` จริงที่บรรทัดประมาณ 1598
- flattened file ไม่มี import ของ OpenZeppelin ที่ต้อง fetch; dependencies ถูกฝังไว้แล้ว
- แต่ Remix workspace ยังมี source แบบ non-flattened ที่ import จาก `@openzeppelin/...` และ raw GitHub ซึ่งขึ้น `Failed to fetch`
- Remix จึงแสดง artifact ของ library เช่น `Address`, `ContextUpgradeable`, `ERC1967Utils` แต่ไม่แสดง main contract
- ก่อนหน้านี้ selector ถูกเลือกเป็น `Address` ทำให้เกิดการ deploy library ไม่ใช่ Implementation

## 2. วิธีแก้ใน Remix

1. เปิดเฉพาะ `Transparent13VTQueueUpgradeable.flattened.sol` รุ่นเดียวกันจาก repository ล่าสุด หรืออัปโหลดไฟล์ local โดยตรง
2. อย่า compile `Transparent13VTQueueUpgradeable.sol` แบบ import-based หาก Remix fetch dependencies ไม่สำเร็จ
3. ตั้ง compiler เป็น `0.8.24`, optimizer enabled, runs `200`
4. กด Compile ที่ไฟล์ flattened แล้วรอให้เสร็จ
5. ใน Contract selector ต้องเห็นชื่อ `Transparent13VTQueueUpgradeable` และเลือกชื่อนี้เท่านั้น — ห้ามเลือก `Address`, `ERC1967Utils` หรือ library ใด ๆ
6. หากเห็นเฉพาะ library ให้ล้างไฟล์ import ที่ error, import flattened ใหม่ใน workspace ใหม่ และ compile อีกครั้ง
7. ก่อน Upgrade ให้ตรวจว่า bytecode ไม่เป็น `0x` และ ABI มี `upgradeToAndCall`, `owner`, `asset`, `nextTicketId`
8. ตรวจ Proxy address เดิมและ owner บน BSC Testnet แบบ read-only ก่อนยืนยันธุรกรรม

แม้แก้ Import ได้ Remix ยังไม่เปรียบเทียบ storage layout ของ implementation เดิมให้ครบ จึงควรใช้ Hardhat/local compiler เป็นหลัก

## 3. ติดตั้งและ compile

```bash
cd deploy/hardhat
npm install
cp env.template .env
# ใส่ private key testnet ใน .env เฉพาะเครื่องที่ปลอดภัย
npm run compile
```

ไม่ต้องตั้ง `DEPLOYER_PRIVATE_KEY` หากต้องการ compile อย่างเดียว

## 4. Preview deployment โดยไม่ส่งธุรกรรม

```bash
set -a; . ./.env; set +a
EXECUTE_DEPLOY=NO npm run deploy:testnet
```

สคริปต์จะตรวจ chain ID และพิมพ์ configuration เท่านั้น

## 5. Deploy implementation + ERC1967Proxy

ต้องมี testnet tBNB และ Testnet token allowance/balance ตามขั้นตอนของ contract หลัง deploy proxy แล้ว การตั้ง `EXECUTE_DEPLOY=YES` จะส่งธุรกรรมจริง 2 ขั้นตอน:

```bash
EXECUTE_DEPLOY=YES npm run deploy:testnet
```

ให้บันทึก `implementation`, `proxy`, transaction receipts และตรวจ EIP-1967 implementation slot ก่อนผูก Frontend

## 6. Preview และ Upgrade Proxy เดิม

```bash
PROXY_ADDRESS=0x0425713b812d99b8a377b760424ba80156a6fbd1 \
  EXECUTE_UPGRADE=NO npm run upgrade:testnet
```

สคริปต์ตรวจว่า signer เป็น owner ที่กำหนดไว้และพิมพ์ implementation เดิมจาก EIP-1967 slot โดยไม่ deploy หรือ upgrade

หลังตรวจ source, bytecode, storage layout และ payload แล้วเท่านั้น:

```bash
PROXY_ADDRESS=0x0425713b812d99b8a377b760424ba80156a6fbd1 \
  EXECUTE_UPGRADE=YES npm run upgrade:testnet
```

คำสั่งนี้จะ deploy Implementation ใหม่ แล้วเรียก `upgradeToAndCall(newImplementation, "0x")` ผ่าน Proxy จาก owner signer จากนั้นตรวจ slot ซ้ำ

## ข้อจำกัดสำคัญ

- สคริปต์นี้ยังไม่ส่งธุรกรรมในค่าเริ่มต้น
- ใช้ private key testnet แยกจาก mainnet และไม่ commit ลง Git
- ห้ามใช้ `EXECUTE_* = YES` กับ Mainnet จนผ่าน external audit และการยืนยัน payload รอบสุดท้าย
- Contract เป็น candidate สำหรับการทดสอบ ไม่ใช่การรับรองความปลอดภัยหรือผลตอบแทน
