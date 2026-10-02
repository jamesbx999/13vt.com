# UUPS Proxy Testnet Handoff

## Current status

- Proxy deployment: **PENDING — no MetaMask transaction was sent from this Sandbox**
- Network: BNB Smart Chain Testnet, chain ID `97`
- Initial owner: `0x11B948575B648be50Eef781251ebdc876907E618`
- Asset: use the verified BSC Testnet BEP-20 token selected for this project; do not substitute a Mainnet address
- Fee wallet: use the approved fee wallet and verify it character-by-character

## Deploy sequence in Remix

1. Import `Transparent13VTQueueUpgradeable.sol` and compile with Solidity `0.8.24`, optimizer `200`, OpenZeppelin `5.4.0`.
2. Select **Injected Provider - MetaMask**, switch MetaMask to BNB Smart Chain Testnet (`97`).
3. Deploy `Transparent13VTQueueUpgradeable` implementation. Do not call `initialize` on the implementation address.
4. ABI-encode `initialize(asset_, feeWallet_, 0x11B948575B648be50Eef781251ebdc876907E618)`.
5. Deploy OpenZeppelin `ERC1967Proxy(implementationAddress, initializerCalldata)`.
6. Interact with the **Proxy address** using the `Transparent13VTQueueUpgradeable` ABI.
7. Read and record `owner()`, `asset()`, `assetDecimals()`, `depositAmount()`, `serviceFeeWei()`, `maxFundTickets()`, and `feeWallet()`.
8. Read EIP-1967 implementation slot `0x360894A13BA1A3210667C828492DB98DCA3E2076CC3735A920A3CA505D382BBC` and confirm it matches the implementation address.
9. Verify both addresses on `https://testnet.bscscan.com`.
10. Set `VITE_TESTNET_UPGRADEABLE_PROXY_ADDRESS` to the Proxy address only after receipt status is successful and bytecode is visible.

## Evidence to record

| Field | Value |
|---|---|
| Implementation address | `PENDING` |
| Implementation deploy tx | `PENDING` |
| Proxy address | `PENDING` |
| Proxy deploy tx | `PENDING` |
| Proxy receipt status | `PENDING` |
| Initializer calldata | `PENDING` |
| Owner readback | `PENDING` |
| Implementation slot readback | `PENDING` |
| BscScan verification URLs | `PENDING` |

Do not label the UI as connected to a deployed Proxy until these values are filled from receipts and read-only RPC checks.
