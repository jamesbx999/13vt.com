# Testnet Accounting Harness

**ขอบเขต:** Local Hardhat/Testnet draft เท่านั้น ไม่ใช้ Mainnet และไม่ใช้เงินจริง

## Local flow test

```bash
cd deploy/hardhat
npm install
pnpm exec hardhat compile
pnpm exec hardhat run scripts/testnet-flow.cjs
```

สคริปต์จะจำลอง:

```text
MockUSDT mint
→ approve + registerPosition (Registered)
→ approve + fundNext (RevenueScheduled)
→ initializeAccounting(13 USDT)
→ claim(ticketId) (Claimed)
→ withdrawSurplus(13 USDT)
```

Owner Mainnet ที่กำหนดไว้จะถูก Impersonate เฉพาะ Local Hardhat เพื่อทดสอบ `onlyOwner`; ไม่มีการส่งธุรกรรมไป BSC

## BSC Testnet จริง: Deploy + ทดสอบด้วย Wallet

สคริปต์นี้ใช้ `DEPLOYER_PRIVATE_KEY`, `OWNER_PRIVATE_KEY`, `RECIPIENT_PRIVATE_KEY` และ `FUNDER_PRIVATE_KEY` จากไฟล์ `.env` ของผู้ดูแลเท่านั้น ห้าม Commit ไฟล์ `.env` และห้ามส่ง Private Key ผ่านแชต

ตั้งค่าใน `deploy/hardhat/.env`:

```dotenv
BSC_TESTNET_RPC_URL=https://bsc-testnet-dataseed.bnbchain.org
DEPLOYER_PRIVATE_KEY=...
OWNER_PRIVATE_KEY=...
RECIPIENT_PRIVATE_KEY=...
FUNDER_PRIVATE_KEY=...
TESTNET_TREASURY=0x...
```

ตรวจ Payload โดยไม่ส่งธุรกรรม:

```bash
npx hardhat run scripts/deploy-and-test-v3-testnet.cjs --network bscTestnet
```

สคริปต์จะปฏิเสธทุกเครือข่ายที่ไม่ใช่ Chain ID 97 และค่าเริ่มต้นคือ Dry-run:

```bash
EXECUTE_DEPLOY=YES npx hardhat run scripts/deploy-and-test-v3-testnet.cjs --network bscTestnet
```

เมื่อเปิด `EXECUTE_DEPLOY=YES` สคริปต์จะส่งธุรกรรมจริงบน BSC Testnet เพื่อทดสอบ:

```text
Deploy MockUSDT
→ Deploy V3 Implementation + ERC1967Proxy
→ Mint 13 mUSDT
→ registerPosition
→ fundNext
→ initializeAccounting(13 mUSDT)
→ claim(1)
→ withdrawSurplus
```

`MockUSDT` เป็น Token สำหรับ Testnet เท่านั้น ไม่ใช่ BSC Mainnet USDT และการเชื่อมต่อ Wallet ใน Dashboard Mainnet จะไม่เปลี่ยนไปใช้ Token นี้โดยอัตโนมัติ

## V4 Auto Push Payment: Local Test

V4 เป็น Draft ที่เปลี่ยน `fundNext` ให้จัดสรรและ Push Payment ให้ Recipient ในธุรกรรมเดียว โดยยังคง `claim()` ไว้เป็น fallback สำหรับ Ticket เก่าที่อาจค้างก่อน Upgrade

```bash
npx hardhat compile
npx hardhat run scripts/testnet-auto-push-flow.cjs
```

ผลที่ต้องผ่าน:

```text
AutoPaid Ticket #1 ใน Transaction เดียวกับ fundNext
nextUnfundedTicketId = 2
claim(1) ซ้ำต้อง Revert
Surplus ก่อนถอน = 13 mUSDT
Surplus หลังถอน = 0
```

Source และ Design Note:

- `deploy/hardhat/contracts/Transparent13VTQueueUpgradeableReferralV4AutoPush.sol`
- `deploy/hardhat/scripts/testnet-auto-push-flow.cjs`
- `deploy/remix/upgradeable/V4-AUTO-PUSH-DESIGN.md`
