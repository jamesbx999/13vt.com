# 13VT — ไฟล์สำหรับ Remix VM (แบบจำลอง ไม่ใช่ Contract รับเงินจริง)

`UnfundedFifoModel.sol` คือสำเนาเดียวกันกับ `examples/unfunded-fifo/contracts/UnfundedFifoModel.sol` ซึ่งผ่านการคอมไพล์และทดสอบใน local EVM. ไฟล์นี้ **ไม่รับ/ถือครอง USDT, ไม่โอน USDT/BNB, ไม่ตรวจการแนะนำครบ 2 ID จากผัง A, ไม่ตรวจเงินสำรอง และไม่ยืนยันว่าเกิดการจ่ายจริง**. `operator` สามารถระบุ mock funding / mock payout ref ได้เอง. **ห้ามนำไปใช้แทนสัญญาการเงินบน BNB Mainnet หรือเสนอว่า deploy แล้วระบบรับจ่ายอัตโนมัติ**

## เปิดใน Remix และทดสอบแบบไม่ใช้เงินจริง

1. เปิด [Remix IDE](https://app.remix.live/) → File Explorer → Create file `UnfundedFifoModel.sol` แล้ววางเนื้อหาไฟล์จากโฟลเดอร์นี้ หรืออัปโหลดไฟล์; อย่าป้อน private key หรือ seed phrase
2. ใน Solidity Compiler เลือก **0.8.30** (สอดคล้องกับ `solc` ในชุดทดสอบ), **Enable optimization**, runs **200**; EVM version ใช้ `compiler default` ตามชุดทดสอบ. **0.6.12 ในภาพหน้าจอคอมไพล์ `pragma ^0.8.24` ไม่ได้**. ตรวจ `Contract` ที่เลือกเป็น `UnfundedFifoModel`
3. ไป Deploy & Run Transactions → Environment = **Remix VM** (ไม่ใช่ Injected Provider/MetaMask, ไม่ใช่ BSC mainnet) → Deploy. ไม่มี constructor arguments; ผู้ deploy เป็น `operator`
4. ทดสอบชุดลำดับ (address ตัวอย่างใน Remix VM ใช้จากรายการ Accounts):
   - `seedRoot(owner, fundingRef)` → จำลอง U1 มี reference สงวน (ค่า bytes32 เช่น `0x` ตามด้วย `11` 32 คู่)
   - `enqueueQualifiedFromA(owner, fundingRef)` สองครั้ง → สร้าง A1 และ D ใน mock. ให้ D ใช้ `fundingRef=0x000…000` (bytes32 ศูนย์) เพราะกฎล่าสุด **ไม่กัน D #2 ให้ D**; ค่า marker ไม่ใช่หลักฐานการฝาก. ดู id จาก event `Enqueued`
   - `recordMockCentralEvenFunding(centralRef)` → จำลอง Direct #4/#6 เป็นต้นไปเข้า **กองทุนกลาง**; marker ต้องไม่ซ้ำและไม่ใช่หลักฐาน token จริง
   - `place(A1 id)` → A1 อยู่ซ้าย U1 และถ้ามี central marker จะ mark U1 เป็น `Paid` ทันที; `place(D id)` → D อยู่ขวา U1. เมื่อครบสองฝั่งจึงสร้าง U2 ในคิว
   - หากไม่เติม central marker, `place(A1 id)` ยังวางได้แต่ U1 คง `Unfunded`; การวางขวาไม่ trigger payout. `recordMockPayout` เป็นเส้นทาง reserve แบบจำลองเดิม ไม่ใช่การโอนโทเคน
   - `paymentState(U2 id)` ต้องเป็น **0 = Unfunded**; `nextOpenParent()` แสดง FIFO head. Position ลูกใหม่อาจถูกวางใต้ parent ที่ยัง unfunded แต่จะไม่มีการบันทึก payout หากกองทุนกลางไม่มี marker
5. อ่าน [README ของแบบจำลอง](../../examples/unfunded-fifo/README.md) และรัน `cd examples/unfunded-fifo && npm install --no-audit --no-fund && npm test` ในเครื่องก่อนเปลี่ยนโค้ด (ชุด lockfile นี้ให้ `npm ci` ติด dependency ของ macOS บน Linux)

## ก่อนจะมี Smart Contract ใช้จริง

อ่าน [รายการกฎที่ยืนยันแล้วและข้อกำหนดแหล่งเงิน](REAL-USDT-DECISIONS.md) ก่อน: Direct คู่ #4/#6 เป็นต้นไปเข้ากองทุนกลาง FIFO; การวางลูกซ้ายใช้ depositId ที่เก่าสุดจ่าย Parent หากมีเงิน, ไม่ใช้ reserve ของลูก A ซ้ำ; หากกองทุนกลางว่างให้คง `UNFUNDED/Pending`. ห้ามเปลี่ยน mock นี้เป็น contract โอนเงินจริง

ต้องมีสเปก on-chain ที่ตรวจสอบได้สำหรับแหล่งฝากที่ไม่ซ้ำ, บัญชี reserve ต่อ Position, เงื่อนไขวาง FIFO, สถานะ `UNFUNDED`, วิธีจัดการ parent unfunded และข้อจำกัดด้านเศรษฐศาสตร์/กฎหมาย; แล้วพัฒนาสัญญาแยกใหม่พร้อมการทดสอบ token transfer, double-spend, reentrancy, failure paths, audit และ testnet. **ไม่มีสคริปต์ broadcast ธุรกรรมหรือ automatic mainnet deploy ในชุดนี้**. เว็บปัจจุบันยังไม่มี Contract Address ค่าเริ่มต้นและ ABI ของตัวอย่างนี้ไม่ตรงกับคิวเว็บ

อ้างอิง: [คู่มือ Remix Solidity Compiler](https://remix-ide.readthedocs.io/en/latest/compile.html), [Deploy & Run](https://remix-ide.readthedocs.io/en/latest/run.html)
