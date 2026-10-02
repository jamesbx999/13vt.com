// Read-only integration target: independently deployed test token, NOT canonical USDT.
// Verified by eth_getCode/name/symbol/decimals on BSC Testnet (chain ID 97) on 2026-10-02.
export const TESTNET_TOKEN = {
  chainId: 97,
  rpcUrl: "https://bsc-testnet-dataseed.bnbchain.org",
  explorer: "https://testnet.bscscan.com",
  address: "0x337610d27c682e347c9cd60bd4b3b107c9d34ddd",
  name: "USDT Token",
  symbol: "USDT",
  decimals: 18,
  canonical: false,
} as const;
