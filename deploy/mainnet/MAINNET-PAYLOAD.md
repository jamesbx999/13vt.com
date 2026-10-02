# 13VT Mainnet Deployment Payload

สถานะ: **Deploy สำเร็จบน BSC Mainnet และตรวจ preflight แบบ read-only แล้ว**

## 1. เครือข่าย

- Network: BNB Smart Chain Mainnet
- Chain ID: `56`
- RPC: `https://bsc-dataseed.binance.org`
- Explorer: `https://bscscan.com`

## 2. Source ที่จะใช้

- Contract: `Transparent13VTQueueUpgradeable`
- Source: `deploy/remix/upgradeable/Transparent13VTQueueUpgradeable.sol`
- Proxy: OpenZeppelin `ERC1967Proxy`
- Solidity: `0.8.24`
- Optimizer: enabled, `200` runs
- OpenZeppelin: `5.4.0`

## 3. Payload ที่เตรียมไว้

| รายการ | ค่า |
|---|---|
| Asset / BSC USDT | `0x55d398326f99059fF775485246999027B3197955` |
| Fee Wallet | `0xE465e694E9194b848D597b21ce4104f9C36Fc6d2` |
| Initial Owner | `0x11B948575B648be50Eef781251ebdc876907E618` |
| Deposit Amount หลัง initialize | `13 USDT` = `13000000000000000000` |
| Service Fee หลัง initialize | `0.0013 BNB` = `1300000000000000 wei` |
| Max Fund Tickets หลัง initialize | `50` |

Canonical USDT address และ `decimals() = 18` ถูกตรวจแบบ read-only จาก BSC Mainnet RPC แล้ว แต่ควรตรวจซ้ำทันทีใน Remix/MetaMask ก่อนส่งธุรกรรม

## 4. Implementation deployment

เลือก `Transparent13VTQueueUpgradeable` แล้ว Deploy โดยไม่มี constructor arguments

- Value: `0 BNB`
- หลัง receipt ให้บันทึก:
  - Implementation address
  - Deployment transaction hash
  - Receipt status
  - Block number

## 5. Proxy deployment

เลือก `ERC1967Proxy` แล้วกรอก:

- `_logic`: **Implementation address จากข้อ 4 เท่านั้น**
- `_data`:

```text
0xc0c53b8b00000000000000000000000055d398326f99059ff775485246999027b3197955000000000000000000000000e465e694e9194b848d597b21ce4104f9c36fc6d200000000000000000000000011b948575b648be50eef781251ebdc876907e618
```

- Value: `0 BNB`

Receipt ที่ตรวจสอบแล้ว:

- Implementation: `0x3A5aBCb54BB8f42Ab0fe4dA1D81DD63B2B02d9b9`
- Implementation tx: `0xc1c8331a617e86665aebf780d7b6fdd541f5d9bcfd9d77d4da78d71533e5ea8e`
- Proxy: `0x56ed01a6b08ac9ba88f9c88ee5c1455410b2cc06`
- Proxy tx: `0xb72ea53f732ba802dfb1e3024b3acb3a2164a5780c6b109cc2a18a3336acebfa`
- Proxy receipt status: `1`, block `125264357`

ห้ามเรียก `initialize()` ซ้ำผ่าน Proxy หลัง Deploy เพราะ constructor ของ Proxy จะ delegatecall `_data` ให้ initialize ครั้งเดียวแล้ว

## 6. Preflight หลัง Deploy

อ่านจาก Proxy address แบบ read-only และต้องได้ค่าตรงกัน:

- `owner()` = `0x11B948575B648be50Eef781251ebdc876907E618`
- `asset()` = `0x55d398326f99059fF775485246999027B3197955`
- `assetDecimals()` = `18`
- `depositAmount()` = `13000000000000000000`
- `serviceFeeWei()` = `1300000000000000`
- `maxFundTickets()` = `50`
- EIP-1967 implementation slot = Implementation addressจากข้อ 4

ยังไม่ควร `approve`, `registerPosition` หรือ `fundNext` ด้วยสินทรัพย์ Mainnet จนกว่าจะตรวจ source, Proxy, Owner, Asset และ threat model ครบ

## 7. Verify Source บน BscScan

### Implementation

ใช้ source และ compiler settings เดียวกับการ Deploy:

- Compiler: Solidity `0.8.24`
- Optimization: `Yes`
- Runs: `200`
- Constructor arguments: ไม่มี

### Proxy

Verify `ERC1967Proxy` ด้วย source flattened รุ่นที่ตรงกับ OpenZeppelin `5.4.0`:

- File: `deploy/remix/ERC1967Proxy.flattened.sol`
- Compiler: `0.8.24`
- Optimization: `Yes`, `200`
- Constructor arguments ABI-encoded: encode `(implementationAddress, initializeCalldata)` หลังทราบ Implementation address จริง
- กด `Is this a proxy?` / `Read as Proxy` บน BscScan และตรวจว่า implementation ตรงกับข้อ 4

## 8. ขอบเขตสำคัญ

Contract รุ่นนี้เป็น **externally funded FIFO queue with pull claims** ใช้ `SafeERC20`, `ReentrancyGuard` และ UUPS authorization ตาม source ปัจจุบัน ไม่ใช่ implementation ของกฎ A/B referral, automatic U2 หรือ guaranteed return ที่อธิบายไว้ในเอกสารรุ่นก่อน หากต้องการใช้กฎ A/B จริง ต้องหยุด payload นี้และทำ specification, audit และ test ใหม่ก่อน Mainnet
