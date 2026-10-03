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
