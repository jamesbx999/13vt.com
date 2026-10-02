# Plan A: แยกเงินสมัครออกจากงบ Commission

## วัตถุประสงค์

ต้นแบบนี้แยกเงินออกเป็นคนละสัญญาอย่างชัดเจน:

- `PlanAReferralRegistry`: บันทึกผู้สมัครและ Referrer
- `registrationVault`: รับเงินสมัคร 13 USDT เท่านั้น
- `PlanACommissionVault`: รับงบ Commission ที่เติมล่วงหน้าเท่านั้น

ไม่มี Reborn, matrix, automatic child creation หรือการรับประกันรายได้ในต้นแบบนี้

## เส้นทางเงิน

```text
ผู้สมัคร --13 USDT--> PlanAReferralRegistry --forward--> registrationVault

Treasury/Marketing Wallet --fundBudget()--> PlanACommissionVault

เมื่อสมัครสำเร็จ:
PlanAReferralRegistry --payCommission()--> PlanACommissionVault --13 USDT--> Referrer
```

เงิน 13 USDT จากการสมัครจะไม่ถูกโอนเข้า Commission Vault และไม่ถูกใช้เป็น Commission

## กติกาที่ตรวจสอบได้

1. ผู้ใช้สมัครได้ครั้งเดียว
2. ต้อง Approve เงินสมัครให้ Registry
3. Registry โอนเงินสมัครไป `registrationVault` โดยตรง
4. Commission Vault ต้องถูกเติมเงินล่วงหน้า
5. Registry เรียกจ่ายได้เฉพาะจำนวน `commissionPerReferral`
6. จ่ายได้ไม่เกิน `maxCommissionsPerReferrer` ต่อ Referrer
7. ถ้างบ Commission ไม่พอ รายการสมัครทั้งรายการ revert เพื่อไม่ให้เกิดการสมัครที่ไม่มี Commission ตามเงื่อนไข
8. ทุกการจ่ายมี `CommissionPaid` ใน Commission Vault และ `CommissionTriggered` ใน Registry
9. ไม่มีการสร้าง Ticket Reborn หรือสิทธิ์ใหม่จากการแนะนำ

## จุดสำคัญด้านบัญชี

แม้ Token จะเป็นชนิดเดียวกัน แต่ยอดอยู่คนละ Contract Address จึงแยกเส้นทางได้ด้วย `balanceOf()` และ Events:

- `registrationVault` = เงินสมัคร/เงินต้นตามนโยบายของระบบ
- `commissionVault` = งบ Commission ที่เติมจากแหล่งเงินที่ระบุได้

ห้ามใช้ Owner sweep ของ `registrationVault` หากยังไม่มีนโยบายคุ้มครองเงินและสิทธิ์ของผู้ใช้ที่ผ่านการตรวจสอบ

## ค่าตัวอย่างสำหรับ Testnet เท่านั้น

- `registrationAmount = 13 USDT`
- `commissionPerReferral = 13 USDT` หรือค่าที่กฎหมาย/นโยบายอนุมัติ
- `maxCommissionsPerReferrer = 3` หรือค่าที่กำหนดเป็นแคมเปญ
- Commission budget ที่ต้องเติมล่วงหน้าอย่างน้อย `commissionPerReferral × จำนวนสิทธิ์ที่เปิด`

ตัวเลขเหล่านี้ไม่ใช่การรับรองความถูกต้องตามกฎหมาย และไม่ควรนำไปใช้ Mainnet ก่อน legal review และ audit

## Deployment order

1. Deploy `PlanACommissionVault`
2. Deploy/เตรียม `registrationVault` ที่ไม่มีสิทธิ์ถอนโดยพลการ
3. Deploy `PlanAReferralRegistry`
4. ตั้ง `authorizedRegistry` ใน Commission Vault เป็น Registry เท่านั้น
5. เติม Commission budget ผ่าน `fundBudget()` และตรวจ `budgetRemaining()`
6. ทดสอบ Register, CommissionPaid, budget exhaustion, duplicate registration และ limits บน Testnet
7. ตรวจ invariant ว่า `registrationVault` ไม่ได้รับการโอนจาก Commission Vault และ Commission Vault ไม่ได้รับเงินสมัคร
8. ตรวจสอบ source code, multisig/role ownership, incident pause policy และ legal/compliance review ก่อนพิจารณา Mainnet

## ข้อจำกัด

เอกสารและโค้ดนี้เป็นต้นแบบเชิงเทคนิค ไม่ใช่คำรับรองว่ารูปแบบ Commission ถูกต้องตามกฎหมายในประเทศไทยหรือเขตอำนาจศาลใด ๆ การจ่ายให้ Referrer ยังอาจถูกกำกับ แม้ใช้เงินจากงบการตลาดภายนอกและมีเพดานก็ตาม
