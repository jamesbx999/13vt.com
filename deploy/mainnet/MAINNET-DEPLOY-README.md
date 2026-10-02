# Transparent13VTQueue — Mainnet deployment package

## Important

This package is **prepared for deployment only**. It has not been deployed to BNB Smart Chain Mainnet by the agent. Deployment is a consequential on-chain action and must be reviewed and confirmed by the wallet owner in Remix/MetaMask.

## Contract changes in this version

- `MAX_FUND_TICKETS = 50` bounds the `fundNext` loop to avoid unbounded gas usage.
- `assetDecimals` is read from the ERC-20 metadata contract in the constructor.
- `depositAmount = 13 * 10**assetDecimals`; decimals above 18 are rejected.
- The constructor rejects zero/EOA asset addresses.
- Frontend reads `assetDecimals`, `depositAmount`, and `MAX_FUND_TICKETS` from the deployed contract.

## Mainnet network

- Network: BNB Smart Chain Mainnet
- Chain ID: `56`
- RPC: `https://bsc-dataseed.bnbchain.org`
- Explorer: `https://bscscan.com`

## Constructor arguments

1. `asset_`: use the token address that was independently verified for the intended deployment. Do not paste a Testnet token address.
2. `feeWallet_`: the exact fee recipient address approved by the owner. Check it character-by-character before deployment.

Read-only preflight on 2026-10-02 confirmed the commonly used BSC USDT address `0x55d398326f99059fF775485246999027B3197955` on chain 56 has bytecode, `symbol() = USDT`, and `decimals() = 18`. Re-check it immediately before deployment; the contract does not prove that a token is canonical USDT. Do not use the BSC Testnet token address.

## Remix steps

1. Open Remix and import `Transparent13VTQueue.sol`.
2. Install/resolve the pinned OpenZeppelin `5.4.0` imports. Confirm the compiler uses Solidity `0.8.24`.
3. Enable optimizer with `200` runs.
4. Compile `Transparent13VTQueue` and compare the ABI with `Transparent13VTQueue.artifact.json`.
5. Select **Injected Provider - MetaMask** and verify MetaMask shows BNB Smart Chain Mainnet, Chain ID 56.
6. In the constructor fields, paste the independently verified `asset_` and approved `feeWallet_`.
7. Before clicking Deploy, verify the exact constructor payload and gas in MetaMask.
8. After confirmation, save deployment transaction hash, receipt status, block number, contract address, and constructor arguments.
9. Verify source code on BscScan using the same compiler version, optimizer runs, and constructor arguments.
10. Read `asset()`, `assetDecimals()`, `depositAmount()`, `feeWallet()`, `MAX_FUND_TICKETS()` and `queueState()` from the deployed address before any token approval.

## Operational warnings

- This contract is a transparent external-funding FIFO candidate; it does **not** implement the earlier A/B referral, automatic U2, or guaranteed-return rules.
- `registerPosition` collects exactly `0.0013 BNB` and pulls `13` token units scaled by `assetDecimals`.
- `fundNext` is externally funded and limited to at most 50 tickets per transaction.
- `claim` is a pull payment. A `Reborn` event creates an unfunded successor only after a successful claim.
- Do not approve or transfer Mainnet assets until the verified source, constructor values, and threat-model findings are independently reviewed.
