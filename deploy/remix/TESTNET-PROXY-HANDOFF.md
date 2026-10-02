# UUPS Proxy Testnet Handoff

## Current status

- Implementation deployment: **SUCCESS — receipt verified on BSC Testnet**
- Proxy deployment: **PENDING — ERC1967Proxy source is ready for Remix**
- Network: BNB Smart Chain Testnet, chain ID `97`
- Initial owner: `0x11B948575B648be50Eef781251ebdc876907E618`
- Asset: `0x337610d27c682e347c9cd60bd4b3b107c9d34ddd` (verified BSC Testnet token; decimals must be read by initializer)
- Fee wallet: `0xE465e694E9194b848D597b21ce4104f9C36Fc6d2`

## Deploy sequence in Remix

1. Import `Transparent13VTQueueUpgradeable.sol` and `ERC1967Proxy.flattened.sol`; compile with Solidity `0.8.24`, optimizer `200`.
2. Select **Injected Provider - MetaMask**, switch MetaMask to BNB Smart Chain Testnet (`97`).
3. Implementation is already deployed at `0xf9871427ebf78597f4e1844f8bb7ac8e6496bdc0`; do not call `initialize` on the implementation address.
   - Tx: `0x4096f7401cca444b1a553a5eff55ed6120198bba1153d7727d2e2dc897bd5ff4`
   - Receipt: status `1`, block `134374203`, bytecode `14,353` bytes.
4. ABI-encode `initialize(asset_, feeWallet_, 0x11B948575B648be50Eef781251ebdc876907E618)` using:
   `0xc0c53b8b000000000000000000000000337610d27c682e347c9cd60bd4b3b107c9d34ddd000000000000000000000000e465e694e9194b848d597b21ce4104f9c36fc6d200000000000000000000000011b948575b648be50eef781251ebdc876907e618`
5. Deploy OpenZeppelin `ERC1967Proxy(implementationAddress, initializerCalldata)`.
6. Interact with the **Proxy address** using the `Transparent13VTQueueUpgradeable` ABI.
7. Read and record `owner()`, `asset()`, `assetDecimals()`, `depositAmount()`, `serviceFeeWei()`, `maxFundTickets()`, and `feeWallet()`.
8. Read EIP-1967 implementation slot `0x360894A13BA1A3210667C828492DB98DCA3E2076CC3735A920A3CA505D382BBC` and confirm it matches the implementation address.
9. Verify both addresses on `https://testnet.bscscan.com`.
10. Set `VITE_TESTNET_UPGRADEABLE_PROXY_ADDRESS` to the Proxy address only after receipt status is successful and bytecode is visible.

## Evidence to record

| Field | Value |
|---|---|
| Implementation address | `0xf9871427ebf78597f4e1844f8bb7ac8e6496bdc0` |
| Implementation deploy tx | `0x4096f7401cca444b1a553a5eff55ed6120198bba1153d7727d2e2dc897bd5ff4` |
| Proxy address | `PENDING` |
| Proxy deploy tx | `PENDING` |
| Proxy receipt status | `PENDING` |
| Initializer calldata | `0xc0c53b8b000000000000000000000000337610d27c682e347c9cd60bd4b3b107c9d34ddd000000000000000000000000e465e694e9194b848d597b21ce4104f9c36fc6d200000000000000000000000011b948575b648be50eef781251ebdc876907e618` |
| Owner readback | `PENDING` |
| Implementation slot readback | `PENDING` |
| BscScan verification URLs | `PENDING` |

Do not label the UI as connected to a deployed Proxy until these values are filled from receipts and read-only RPC checks.
