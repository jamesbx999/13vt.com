# Mainnet Referral Upgrade Payload (Prepared, Not Broadcast)

## Existing Proxy

- Network: BNB Smart Chain Mainnet, chain ID `56`
- Proxy: `0x56ed01a6b08ac9ba88f9c88ee5c1455410b2cc06`
- Current owner: `0x11B948575B648be50Eef781251ebdc876907E618`
- Current implementation: `0x3A5aBCb54BB8f42Ab0fe4dA1D81DD63B2B02d9b9`
- Asset: `0x55d398326f99059fF775485246999027B3197955`
- Deposit: `13 USDT`
- Service fee: `0.0013 BNB`

## Candidate implementation

- Source: `deploy/remix/upgradeable/Transparent13VTQueueUpgradeableReferral.sol`
- Contract name: `Transparent13VTQueueUpgradeableReferral`
- Compiler: Solidity `0.8.24`
- Optimizer: enabled, runs `200`
- New storage: two mappings appended after all V1 state; reserved gap reduced from 40 to 38.

## New referral functions

- `setReferralCode(bytes32 code, address referrer, bool enabled)` — owner only
- `referrerForCode(bytes32 code)` — view
- `referrerOf(address user)` — view
- `registerWithReferralCode(bytes32 code)` — pays the existing 13 USDT plus 0.0013 BNB service fee and records metadata; it pays no referral commission
- `registerWithReferral(address referrer)` — same registration path with a direct referrer address

## First code after upgrade

Code: `OWNER13`

Bytes32 encoding:
`0x4f574e455231330000000000000000000000000000000000000000000000000000`

Owner configuration call:
`setReferralCode(0x4f574e455231330000000000000000000000000000000000000000000000000000, 0x11B948575B648be50Eef781251ebdc876907E618, true)`

Shareable link after the upgrade and code-configuration receipts are verified:
`https://13vt.com/?ref=OWNER13`

## Required sequence

1. Compile and verify candidate implementation source on BscScan.
2. Read owner and EIP-1967 implementation slot from the Proxy.
3. Deploy candidate implementation.
4. Owner calls `upgradeToAndCall(newImplementation, 0x)` on the Proxy.
5. Read and verify the new EIP-1967 implementation slot.
6. Owner calls `setReferralCode(...)` on the Proxy.
7. Read `referrerForCode(bytes32(OWNER13))` and verify it equals the owner wallet.
8. Test registration on BSC Testnet before advertising Mainnet registration.

No Mainnet upgrade or configuration transaction is authorized by this file alone.
