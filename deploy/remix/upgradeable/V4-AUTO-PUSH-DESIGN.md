# V4 Auto Push Payment Design

## ขอบเขต

ไฟล์นี้เป็น **Offline/Testnet draft เท่านั้น** ยังไม่ใช่คำสั่ง Upgrade Mainnet และยังไม่มีธุรกรรมถูกส่งบน BSC

## กฎใหม่

`fundNext(amount, recipientCount)` จะทำงานเป็นธุรกรรมเดียว:

1. รับ Asset จาก Funder ผ่าน `safeTransferFrom`
2. ตรวจจำนวน Ticket แบบ FIFO และแบ่ง `amountPerTicket`
3. เติมจำนวนเงินให้ Ticket ในช่วงที่กำหนด
4. เลื่อน `nextUnfundedTicketId`
5. Mark Ticket ทุกใบเป็น `claimed`
6. โอน Asset ให้ Recipient แต่ละรายทันที
7. เพิ่ม `totalClaimed`
8. Emit `RevenueScheduled`, `Claimed` และ `AutoPaid`

ตัวอย่าง:

```text
Ticket #1 ยังรอเงิน
fundNext(13 USDT, 1)
→ Ticket #1 ได้ 13 USDT
→ โอน 13 USDT ให้ Recipient ในธุรกรรมเดียวกัน
→ Ticket #1 claimed = true
→ nextUnfundedTicketId = 2
```

## Atomicity

การโอนให้ Recipient อยู่ในธุรกรรมเดียวกับการเติมเงิน ถ้า Token transfer ใดล้มเหลว ธุรกรรมทั้งหมด Revert และไม่ควรมี Ticket ใดถูก Mark เป็น Claimed สำเร็จ

## Claim เดิม

`claim(ticketId)` ยังคงอยู่เพื่อรองรับ Ticket ที่ถูกจัดสรรและยังค้างอยู่ก่อน Upgrade V4 แต่ Ticket ที่ถูกเติมผ่าน `fundNext` ของ V4 จะถูกจ่ายไปแล้วและ Claim ซ้ำจะ Revert

## ความเสี่ยงที่ต้องทดสอบ

- Gas เพิ่มตาม `recipientCount`; ยังจำกัดด้วย `maxFundTickets`
- Token ที่มีพฤติกรรมผิดปกติหรือ Fee-on-transfer ต้องผ่าน `TransferAmountMismatch`
- การจ่ายแบบ Push ทำให้ Funder เป็นผู้เรียกธุรกรรมและเป็นผู้จ่าย Gas แทน Recipient
- หาก Recipient เป็น Contract ที่ไม่มีความสามารถรับ Token การโอนอาจ Revert
- Ticket เก่าที่มี `amount > 0` ก่อน Upgrade ต้องตรวจและจัดการตามนโยบายก่อนเปิด V4
- ต้องตรวจ Storage Layout ของ V1/V2/V3/V4 และ Proxy Upgrade Authorization ก่อนใช้งานจริง

## หลักฐานจาก Local Test

Local Hardhat test ผ่านด้วย Chain ID 31337:

- Registered Ticket #1
- fundNext 13 mUSDT
- AutoPaid Ticket #1 ใน Transaction Hash เดียวกับ fundNext
- `nextUnfundedTicketId == 2`
- Claim ซ้ำ Revert
- Surplus ก่อนถอน 13 mUSDT
- ถอน Surplus แล้วเหลือ 0

## ข้อจำกัด

การมี AutoPaid Event พิสูจน์ได้ว่ามี Token transfer ตามสัญญาในธุรกรรมนั้น ไม่ได้พิสูจน์ว่าเงินเป็นรายได้จากธุรกิจภายนอกหรือรับประกันผลตอบแทน
