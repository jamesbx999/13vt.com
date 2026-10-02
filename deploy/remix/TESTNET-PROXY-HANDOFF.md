# UUPS Proxy Testnet Handoff

## Current status

- Implementation deployment: **SUCCESS — receipt verified on BSC Testnet**
- Proxy deployment: **SUCCESS — receipt and read-only getters verified on BSC Testnet**
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

## Verified deployment evidence

- Proxy: `0x0425713b812d99b8a377b760424ba80156a6fbd1`
- Deploy tx: `0x7d9dc9637e8d8526a0cc2de323625378b74c78c74136dc9c60a574d247d90725`
- Receipt: status `1`, block `134379820`, contract bytecode present (`163` bytes)
- Explorer: https://testnet.bscscan.com/tx/0x7d9dc9637e8d8526a0cc2de323625378b74c78c74136dc9c60a574d247d90725
- EIP-1967 implementation slot matches `0xf9871427ebf78597f4e1844f8bb7ac8e6496bdc0`
- Read-only getter checks: owner, asset, fee wallet, decimals, deposit amount, fee, max tickets and total reborn all succeeded.

## Evidence to record

| Field | Value |
|---|---|
| Implementation address | `0xf9871427ebf78597f4e1844f8bb7ac8e6496bdc0` |
| Implementation deploy tx | `0x4096f7401cca444b1a553a5eff55ed6120198bba1153d7727d2e2dc897bd5ff4` |
| Proxy address | `0x0425713b812d99b8a377b760424ba80156a6fbd1` |
| Proxy deploy tx | `0x7d9dc9637e8d8526a0cc2de323625378b74c78c74136dc9c60a574d247d90725` |
| Proxy receipt status | `1` (block `134379820`) |
| Initializer calldata | `0xc0c53b8b000000000000000000000000337610d27c682e347c9cd60bd4b3b107c9d34ddd000000000000000000000000e465e694e9194b848d597b21ce4104f9c36fc6d200000000000000000000000011b948575b648be50eef781251ebdc876907e618` |
| Owner readback | `0x11B948575B648be50Eef781251ebdc876907E618` |
| Asset readback | `0x337610d27c682e347c9cd60bd4b3b107c9d34ddd`, decimals `18` |
| Fee wallet readback | `0xE465e694E9194b848D597b21ce4104f9C36Fc6d2` |
| Config readback | deposit `13e18`, service fee `1300000000000000 wei`, max tickets `50`, total reborn `0` |
| Implementation slot readback | `0xf9871427ebf78597f4e1844f8bb7ac8e6496bdc0` |
| BscScan verification URLs | [Proxy tx](https://testnet.bscscan.com/tx/0x7d9dc9637e8d8526a0cc2de323625378b74c78c74136dc9c60a574d247d90725), [Proxy address](https://testnet.bscscan.com/address/0x0425713b812d99b8a377b760424ba80156a6fbd1) |

The UI may label the Testnet Proxy as deployed because the receipt, bytecode, EIP-1967 slot and read-only getters are now verified. This remains a Testnet deployment; do not use it as a Mainnet production contract.
