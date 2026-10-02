# 13VT — แบบจำลอง FIFO/UNFUNDED (ทดสอบออฟไลน์เท่านั้น)

> `UnfundedFifoModel.sol` **ไม่รับ ไม่ถือ และไม่โอน USDT/BNB**; operator จำลองสถานะ. ห้ามใช้เป็นสัญญารับสมาชิก/จ่ายรายได้ หรือ deploy ไปอ้างว่าจ่ายเงินจริง. ผู้ใช้ระบุให้ **คงแบบจำลองไม่โอนเงินจริงและไม่ Deploy** ระหว่างการทดสอบนี้

## กฎที่ต้องแยกจากความสามารถของ mock

- **ยืนยันจากผู้ใช้:** B เป็น FIFO รวมทุก Wallet/Position จาก A และ B Reborn เลือก Parent เก่าสุดที่มีช่องว่าง เติมซ้ายก่อนขวา. U1 ได้รับสำเร็จหนึ่งครั้งและมีลูกสองฝั่งแล้วเกิด U2 ใน Wallet เดิม เข้าคิว B ทันทีแบบ `UNFUNDED` หากยังไม่มีเงินฝากที่ผูก U2
- **กฎล่าสุดที่จำลอง:** Direct เลขคู่หลัง #2 (`#4/#6/...`) ของทุก Position เข้า **กองทุนกลาง** ไม่ผูกกับ Wallet ต้นทาง. กองทุนกลางจ่าย B Parent ที่อยู่หัวคิว FIFO ก่อนสุด และเติมซ้ายก่อนขวา. เมื่อวางลูกซ้ายสำเร็จ ให้ใช้ marker กองทุนกลางจ่ายเจ้าของ Parent ทันที; ถ้ากองทุนกลางว่าง Parent ยังคง `UNFUNDED`. การวางลูกขวาอย่างเดียวไม่ trigger payout.
- **พฤติกรรมใน mock เท่านั้น:** `place(childId)` วางลูกแม้ Parent `UNFUNDED` ตาม FIFO และจะเรียกใช้ `recordMockCentralEvenFunding` marker ที่เก่าสุดเมื่อเป็นการวางซ้าย. Marker ไม่พิสูจน์ว่าเงินฝากจริงหรือมี transfer สำเร็จ. `recordMockPayout` ยังเป็นเส้นทาง operator สำหรับจำลอง reserve ของ Position เดิมเท่านั้น ไม่ใช่กฎจ่ายเงินจริง

## ผัง FIFO ตัวอย่าง

[Mermaid](./fifo-unfunded.mmd) · [PNG](./fifo-unfunded.png)

```mermaid
flowchart LR
  U1[U1 รับสำเร็จและมีซ้าย+ขวา] --> U2[U2 เข้าคิว B ทันที UNFUNDED]
  U2 --> Q[FIFO รวม A-born และ B-born]
  Q --> L[ถึงคิว Parent: วางลูกซ้าย]
  L --> P{กองทุนกลางมี marker?}
  P -->|มี| PAID[จ่าย Parent และใช้ marker เก่าสุด]
  P -->|ไม่มี| HOLD[คง UNFUNDED]
  PAID --> R[วางขวาตาม FIFO]
```

**เดินสถานะจำลอง:** A1 และ D ที่ผ่าน A อาจมาจาก Wallet ใดก็ได้; ในตัวอย่าง mock ให้ A1 ซ้าย D ขวา U1, หลัง U1 ถูก mark mock payout จึงมี U2. เงิน D #2 ไม่กัน D ในกฎล่าสุด: ทดสอบ D โดยส่ง funding marker เป็น zero. เมื่อ U2 เป็นหัวคิวและ E/F มาต่อซ้าย/ขวา, state ยังเป็น `UNFUNDED` จนกว่า operator จะระบุ source ใหม่; ไม่อ้างว่ามีเงินใน Contract

## ฟังก์ชันของสัญญาตัวอย่าง

- `seedRoot`, `enqueueQualifiedFromA`: operator ป้อนข้อมูลจำลอง A; **ไม่ได้ตรวจ Direct ครบ 2 จากธุรกรรมจริง**
- `place`: FIFO ซ้ายก่อนขวา ไม่โอนโทเคน ไม่สั่ง Claim ไม่ข้าม Parent ที่ `UNFUNDED`
- `recordMockFunding`: marker `bytes32` เดียวใช้ได้ครั้งเดียวในแบบจำลอง; จะ reject ref ซ้ำ. **ไม่ตรวจ token balance, depositId หรือ transferFrom**
- `recordMockCentralEvenFunding`: เพิ่ม marker จำลองจาก Direct คู่หลัง #2 ลงกองทุนกลางตามลำดับที่บันทึก; ไม่รับหรือโอน token
- `place`: เมื่อลูกซ้ายถูกวาง จะใช้ marker กองทุนกลางเก่าสุดจ่าย Parent แบบจำลอง; หากไม่มี marker จะคง `UNFUNDED`. เมื่อครบซ้าย+ขวาและ Parent ถูก mark paid จึงสร้าง successor
- `recordMockPayout`: operator ต้องใช้ funding ref **เดียวกับของ Position นั้น** และ mark ครั้งเดียวเมื่อมีลูกซ้าย; เป็น reserve mock แบบเดิม ไม่ใช่เส้นทางกองทุนกลาง. **ไม่มีฟังก์ชันใดโอนเงินหรือพิสูจน์ payout จริง**
- `paymentState`: `Unfunded`, `FundedPending`, `Paid` เป็น **สถานะ mock** ไม่ใช่ยอดการเงินที่เรียกเก็บได้

## ทดสอบ

```bash
cd examples/unfunded-fifo
npm install --no-audit --no-fund
npm test
```

ชุดทดสอบ local EVM (`ganache` ในหน่วยความจำ) ตรวจซ้าย→ขวา, กองทุนกลาง FIFO, จ่ายเมื่อวางซ้าย, U2 เข้าคิว, Parent ไร้ทุนไม่ถูกข้าม, ไม่เกิด U3 เมื่อไม่มี funding marker และการปฏิเสธ marker ซ้ำ/ผิด Position. **ไม่ส่งธุรกรรมไป BSC Testnet/Mainnet**. ใน Remix ให้เลือก compiler 0.8.30 optimizer runs 200 และ **Remix VM** เท่านั้น; ดู [คู่มือ Remix](../../deploy/remix/README.md)

อ่าน [บัญชีแหล่งเงินที่ยังไม่ตัดสิน](../../deploy/remix/REAL-USDT-DECISIONS.md) ก่อนพัฒนาสัญญาจริง. อย่าใช้ Owner wallet `0x11B948575B648be50Eef781251ebdc876907E618` เป็น token address; บน BSC Testnet ไม่มี bytecode ณ เวลาที่ตรวจ
