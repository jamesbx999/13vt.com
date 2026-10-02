# Transparent13VTQueueUpgradeable — UUPS deployment guide

## Critical architecture note

The already deployed non-proxy `Transparent13VTQueue` cannot be upgraded. This package creates a **new UUPS implementation + ERC1967Proxy**. Users interact with the proxy address, not the implementation address.

Initial owner is hard-coded and checked during initialization:

`0x11B948575B648be50Eef781251ebdc876907E618`

The owner can call `upgradeToAndCall` through the proxy after a new implementation passes review. The owner can also update fee, deposit amount, fee wallet, and max batch through explicit functions that emit events.

## Deployment sequence

1. Compile `Transparent13VTQueueUpgradeable.sol` with Solidity `0.8.24`, optimizer enabled, 200 runs, and OpenZeppelin `5.4.0`.
2. Deploy the implementation contract. Its constructor disables initialization; do not call `initialize` on the implementation address.
3. Encode initializer calldata on the implementation ABI:
   `initialize(asset_, feeWallet_, 0x11B948575B648be50Eef781251ebdc876907E618)`.
4. Deploy OpenZeppelin `ERC1967Proxy` with constructor arguments `(implementationAddress, initializerCalldata)`.
5. Use the **proxy address** with the `Transparent13VTQueueUpgradeable` ABI.
6. Read `owner()`, `asset()`, `assetDecimals()`, `depositAmount()`, `serviceFeeWei()`, `maxFundTickets()` and `queueState()` from the proxy.
7. Verify the implementation and proxy addresses on BscScan. Record implementation address, proxy address, initializer calldata, deploy receipts and owner address.

## Owner controls

- `setServiceFeeWei(newValue)`: max `0.01 BNB`; affects future registrations only.
- `setDepositAmount(newValue)`: affects future registrations only; existing tickets are unchanged.
- `setMaxFundTickets(newValue)`: range `1..200`; limits future `fundNext` calls.
- `setFeeWallet(newWallet)`: affects future service-fee routing.
- `upgradeToAndCall(newImplementation, data)`: changes implementation logic; use multisig/timelock before Mainnet.
- `transferOwnership(newOwner)`: changes the privileged owner; use only after an explicit governance decision.

## Mainnet preflight

- Network must be BNB Smart Chain Mainnet, chain ID 56.
- Re-verify the intended asset address and decimals immediately before initialization.
- Do not initialize with the implementation address; initialize only through the proxy.
- Do not claim this contract implements the earlier A/B referral or guaranteed-return rules. It remains an externally funded FIFO candidate with pull claims.
- A single EOA owner can change payout-related parameters and upgrade logic. For Mainnet, use a multisig/timelock or do not deploy this design.
