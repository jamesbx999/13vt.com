# 13VT — Fee Policy: 0.0013 BNB

สถานะเอกสารนี้: **ข้อกำหนดสำหรับ contract จริงในอนาคต** ไม่ใช่การอนุญาตให้รับ BNB หรือ deploy contract ปัจจุบัน

## ค่าธรรมเนียมที่แน่นอน

- จำนวน: `0.0013 BNB`
- หน่วย on-chain: `1,300,000,000,000,000 wei` (`1.3e15`)
- การตรวจ: ต้องใช้ `msg.value == SERVICE_FEE_WEI` แบบ exact เท่านั้น
- ถ้าต่ำกว่าหรือเกิน: revert ทั้งธุรกรรม และห้ามสร้าง Position, reserve, queue entry หรือ payout ใด ๆ
- Gas ของธุรกรรมเป็นค่าใช้จ่ายแยกต่างหาก ผู้ใช้ต้องมี BNB พอสำหรับ `msg.value + gas`
- Fee wallet ต้องเป็น immutable หรือเปลี่ยนได้ผ่าน timelock/multisig ที่ประกาศชัดเจน; ห้ามใช้ address ที่ผู้เรียกส่งมาเอง

## ฟังก์ชันที่เรียกเก็บ

เรียกเก็บ **ครั้งเดียว** ในฟังก์ชันที่ผู้ใช้เริ่มเพื่อสมัคร/ฝากเข้า **ผัง A และสร้าง Position A ใหม่** เช่น:

```solidity
function registerA(address referrer, bytes32 referralCode)
    external
    payable
    returns (uint256 positionId);
```

ลำดับที่ต้องทำในฟังก์ชันจริง:

1. ตรวจ `msg.value == SERVICE_FEE_WEI` ก่อนแก้ state
2. ตรวจ token amount, allowance/`transferFrom`, referrer และกฎ Direct ID ให้ผ่าน
3. ส่ง `msg.value` ไป `FEE_WALLET` ด้วย `Address.sendValue` หรือ low-level call ที่ตรวจ `success`
4. บันทึก `ServiceFeePaid(positionId, payer, FEE_WALLET, SERVICE_FEE_WEI)`
5. บันทึก deposit/Position/สิทธิ์ A ใน transaction เดียวกัน
6. ถ้า token transfer หรือการส่ง fee ล้มเหลว ให้ revert ทั้งหมด

> ห้ามนับ fee เป็นเงินทุน 13 USDT, reserve, central even-fund หรือ B payout

## ฟังก์ชันที่ไม่เรียกเก็บ

| ฟังก์ชัน/เหตุการณ์ | `msg.value` | เหตุผล |
|---|---:|---|
| `read` / view / event query | ไม่ใช้ | ไม่มี state change |
| `placeInB` | `0` | เป็นการจัดคิวจาก Position ที่มีอยู่ ไม่ใช่การสมัครใหม่ |
| Reborn อัตโนมัติหลัง U1 ครบเงื่อนไข | `0` | เป็น state transition ที่เกิดจาก Position เดิม |
| `fundCentralEvenDeposit` | `0` เพิ่มเติม | เงิน 13 USDT คู่ #4/#6 เป็น token deposit; หากเรียกผ่าน registerA ให้รวม fee ใน register เดียว ไม่คิดซ้ำ |
| `payLeftParent` / internal FIFO allocation | `0` | จ่ายจาก token reserve ที่มีอยู่ ไม่ใช่การเก็บ fee |
| `claim`, ถ้ามีในรุ่นที่อนุญาต | `0` | ไม่ควรมี fee แอบแฝงใน payout |
| `pause`, admin rotation, rescue ที่อนุญาต | `0` | เป็น administrative action และต้องมี access control |

## ข้อกำหนดการป้องกันการเก็บซ้ำ

- ใช้ `positionId`/registration event เป็น idempotency boundary; การ retry ของ transaction ที่ revert ไม่ควรสร้าง fee สำเร็จ
- ห้ามเรียกเก็บ fee จากทั้ง `registerA` และ internal `_createReborn` ใน call เดียวกัน
- Reborn ใหม่ใช้สถานะและเงินกองทุนตาม ledger เดิม ไม่ใช่การบังคับให้ Wallet เดิมส่ง `0.0013 BNB` เพิ่ม
- อย่ารับ `msg.value` ในฟังก์ชันที่ประกาศว่าไม่เก็บ fee; ให้ `require(msg.value == 0)` เพื่อกันการส่ง BNB ผิดทาง หรือคืนเงินด้วยกติกาที่ชัดเจน
- Event ต้องระบุ payer, positionId, feeWei และ feeWallet; backend ห้ามถือ event เป็นหลักฐานแทน receipt ที่สำเร็จ

## ขอบเขตของ mock

`UnfundedFifoModel.sol` มีเพียง `SERVICE_FEE_WEI` และ `serviceFeeIsExact(uint256)` เป็น helper สำหรับทดสอบ policy และ **ไม่มี `payable`, ไม่รับ BNB, ไม่ส่ง BNB, ไม่สร้าง fee event**. ห้ามใช้ mock นี้เป็น contract เก็บค่าธรรมเนียมจริง
