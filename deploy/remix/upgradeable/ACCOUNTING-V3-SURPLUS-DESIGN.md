# V3 Accounting: Foreign Token Rescue และ USDT Surplus

เอกสารนี้เป็น **draft สำหรับ Offline/Testnet เท่านั้น** ยังไม่ใช่คำสั่ง Upgrade Mainnet

## วัตถุประสงค์

1. กู้คืน Token ที่โอนเข้าผิดชนิดได้ โดยห้ามแตะ USDT หลักของระบบ
2. ถอน USDT ได้เฉพาะส่วนที่เกินกว่าหนี้สินที่ตรวจสอบได้บนเชน
3. ป้องกันการคำนวณ Surplus ผิดเมื่อ Upgrade จาก V2 ที่มีประวัติเดิม

## ฟังก์ชันใหม่

### `rescueForeignToken(IERC20 token, address to, uint256 amount)`

- เรียกได้เฉพาะ Owner
- ใช้ `SafeERC20`
- ปฏิเสธ `token == asset` เพื่อไม่ให้ใช้ช่องทางนี้ถอน USDT หลัก
- ปฏิเสธ Zero Address และจำนวนศูนย์
- Emit `ForeignTokenRescued`

### `initializeAccounting(uint256 historicalUserDeposits)`

ใช้ครั้งเดียวหลัง Upgrade V2 → V3 เท่านั้น

`historicalUserDeposits` ต้องคำนวณจาก Event `Registered` ทั้งหมดของ Proxy เดิม:

```text
historicalUserDeposits = Σ Registered.tokenAmount
```

ต้องตรวจเทียบกับ:

- จำนวน Ticket ที่ Registered
- `depositAmount` ในแต่ละช่วงเวลา หาก Owner เคยเปลี่ยนค่า
- `totalClaimed`
- Token decimals และยอดจริงบน Proxy

ก่อน Bootstrap ฟังก์ชัน `surplus()` จะคืนค่า `0` โดยตั้งใจ เพื่อป้องกันการถอนเกินสิทธิ์ในช่วงที่บัญชียังไม่พร้อม

## สมการบัญชี

```text
totalUserDeposits       = ผลรวม tokenAmount จากการสมัครทั้งหมด
pendingClaims           = totalScheduled - totalClaimed
remainingUserDeposits   = max(totalUserDeposits - totalClaimed, 0)
totalReserved           = max(remainingUserDeposits, pendingClaims)
contractBalance         = asset.balanceOf(address(this))
surplus                 = max(contractBalance - totalReserved, 0)
```

แนวคิด `max` เป็นการกันเงินแบบอนุรักษ์นิยม: ไม่กันซ้ำสองครั้ง แต่เลือกยอดหนี้ที่สูงกว่า ระหว่างเงินสมัครที่ยังไม่ผ่าน Claim และยอดที่ถูกจัดสรรไว้รอ Claim

## กฎถอน USDT

```solidity
withdrawSurplus(to, amount)
```

สำเร็จเมื่อ:

```text
accountingInitialized == true
amount > 0
amount <= surplus()
to != address(0)
```

หากไม่ผ่าน ให้ Revert และไม่เปลี่ยนยอด Ticket

## Storage Upgrade Safety

V3 เพิ่ม:

- `uint256 totalUserDeposits`
- `bool accountingInitialized`

จึงลด `__gap` จาก 38 เหลือ 36 ช่อง และต้องตรวจ Storage Layout กับ V2 ก่อน Upgrade จริง ห้าม Deploy/Upgrade Mainnet จาก draft นี้โดยตรง

## ข้อจำกัด

ยอด USDT ที่ถูกส่งเข้า Contract แบบไม่มี Event ที่สัญญารู้จัก จะไม่ถูกถือเป็น “รายได้” โดยอัตโนมัติ ระบบนี้พิสูจน์ได้เฉพาะยอดคงเหลือ การจัดสรร และสิทธิ์ Claim ตาม Storage/Event ของ Contract เท่านั้น
