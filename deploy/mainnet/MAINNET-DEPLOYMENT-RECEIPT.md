# 13VT BSC Mainnet Deployment Evidence

ตรวจสอบเมื่อ 2026-10-02 ด้วย BSC Mainnet JSON-RPC แบบ read-only หลังการ deploy ผ่าน Remix/MetaMask

## Network

- Chain ID: `56`
- Explorer: https://bscscan.com
- RPC used for verification: `https://bsc-dataseed.binance.org`
- Deployer / Owner: `0x11B948575B648be50Eef781251ebdc876907E618`

## Implementation

- Address: [`0x3A5aBCb54BB8f42Ab0fe4dA1D81DD63B2B02d9b9`](https://bscscan.com/address/0x3A5aBCb54BB8f42Ab0fe4dA1D81DD63B2B02d9b9)
- Deployment transaction: [`0xc1c8331a617e86665aebf780d7b6fdd541f5d9bcfd9d77d4da78d71533e5ea8e`](https://bscscan.com/tx/0xc1c8331a617e86665aebf780d7b6fdd541f5d9bcfd9d77d4da78d71533e5ea8e)
- Receipt status: `1`
- Block: `125261399`

## UUPS Proxy

- Address: [`0x56ed01a6b08ac9ba88f9c88ee5c1455410b2cc06`](https://bscscan.com/address/0x56ed01a6b08ac9ba88f9c88ee5c1455410b2cc06)
- Deployment transaction: [`0xb72ea53f732ba802dfb1e3024b3acb3a2164a5780c6b109cc2a18a3336acebfa`](https://bscscan.com/tx/0xb72ea53f732ba802dfb1e3024b3acb3a2164a5780c6b109cc2a18a3336acebfa)
- Receipt status: `1`
- Block: `125264357`
- Constructor value: `0 BNB`
- Constructor `_logic`: `0x3A5aBCb54BB8f42Ab0fe4dA1D81DD63B2B02d9b9`
- Constructor `_data`: `initialize(asset, feeWallet, initialOwner)` calldata from `MAINNET-PAYLOAD.md`

## Read-only preflight result

| Getter / slot | Result |
|---|---|
| `owner()` | `0x11B948575B648be50Eef781251ebdc876907E618` |
| `asset()` | `0x55d398326f99059fF775485246999027B3197955` |
| `assetDecimals()` | `18` |
| `depositAmount()` | `13000000000000000000` (`13` token units) |
| `serviceFeeWei()` | `1300000000000000` (`0.0013 BNB`) |
| `maxFundTickets()` | `50` |
| `feeWallet()` | `0xE465e694E9194b848D597b21ce4104f9C36Fc6d2` |
| `totalClaimed()` | `0` |
| `totalReborn()` | `0` |
| EIP-1967 implementation slot | `0x3a5abcb54bb8f42ab0fe4da1d81dd63b2b02d9b9` |
| Proxy bytecode | present (`212` bytes) |

## Scope reminder

This deployed contract is the externally funded FIFO queue implementation documented in the repository. It is **not** an implementation of the earlier referral/A-B/automatic-U2/guaranteed-return rules. Do not approve Mainnet USDT or call state-changing queue functions until source verification, operational review, and applicable legal/compliance review are complete.
