# UUPS Proxy Testnet Handoff

## Current status

- Implementation deployment: **SUCCESS — receipt verified on BSC Testnet**
- Proxy deployment: **SUCCESS — receipt and read-only getters verified on BSC Testnet**
- Network: BNB Smart Chain Testnet, chain ID `97`
- Initial owner: `0x11B948575B648be50Eef781251ebdc876907E618`
- Asset: `0x337610d27c682e347c9cd60bd4b3b107c9d34ddd` (`USDT`, 18 decimals)
- Fee wallet: `0xE465e694E9194b848D597b21ce4104f9C36Fc6d2`

## Latest verified deployment

- Implementation: `0x56ed01a6b08ac9ba88f9c88ee5c1455410b2cc06`
- Implementation deploy tx: `0x1244e413d6716403a9eb7bd068da6b09fc6021774371ac5ba9c1bdace4a63ecf`
- Proxy: `0x3a358d2151b0aD8adB9f8C218bD2B268d53654eE`
- Proxy deploy tx: `0x416c6411a4d45ebff2700727562915fedec05aba6de23ff1803610ef1bcead52`
- Proxy explorer: https://testnet.bscscan.com/address/0x3a358d2151b0aD8adB9f8C218bD2B268d53654eE
- Proxy deployment tx: https://testnet.bscscan.com/tx/0x416c6411a4d45ebff2700727562915fedec05aba6de23ff1803610ef1bcead52

## Read-only configuration verification

| Getter | Verified value |
|---|---|
| `owner()` | `0x11B948575B648be50Eef781251ebdc876907E618` |
| `DESIGNATED_INITIAL_OWNER()` | `0x11B948575B648be50Eef781251ebdc876907E618` |
| `asset()` | `0x337610d27c682e347c9cd60bd4b3b107c9d34ddd` |
| Token metadata | `USDT`, 18 decimals |
| `feeWallet()` | `0xE465e694E9194b848D597b21ce4104f9C36Fc6d2` |
| `depositAmount()` | `13e18` = 13 USDT units |
| `serviceFeeWei()` | `1300000000000000 wei` = 0.0013 BNB |
| `maxFundTickets()` | `50` (contract hard cap `MAX_ALLOWED_FUND_TICKETS()` = `200`) |
| `nextTicketId()` | `1` |
| `nextUnfundedTicketId()` | `1` |
| `totalClaimed()` / `totalScheduled()` / `totalReborn()` | `0` / `0` / `0` |
| `queueState()` | registered `0`, waiting `0`, scheduled `0`, claimed `0`, balance `0` |
| Proxy token balance | `0 USDT` at time of read |
| EIP-1967 implementation slot | `0x56ed01a6b08ac9ba88f9c88ee5c1455410b2cc06` |

## Frontend environment

Set these public values in the VPS `.env` before building the app:

```dotenv
ONCHAIN_OWNER_WALLET=0x11B948575B648be50Eef781251ebdc876907E618
TESTNET_UPGRADEABLE_PROXY_ADDRESS=0x3a358d2151b0aD8adB9f8C218bD2B268d53654eE
```

The VPS Compose file maps the Proxy value to both `VITE_TESTNET_UPGRADEABLE_PROXY_ADDRESS` and `VITE_TESTNET_QUEUE_ADDRESS`. The Implementation address must not be used as the application contract address.

## Security boundaries

- This is a **BSC Testnet** deployment, not a Mainnet production contract.
- Read-only verification does not prove the economic rules are audited or that the contract is funded.
- The Proxy currently holds `0 USDT`; do not claim that payouts are available.
- Owner setters and UUPS upgrade remain privileged operations. Review the exact payload and receipt before each change.
- The legacy Mainnet referral screen in `Home.tsx` uses a separate ABI and must not be pointed at this UUPS Proxy; the 13 USDT/0.0013 BNB configuration above belongs to the UUPS Testnet panel.
