# VPS configuration (create locally; do not commit)

Create `deploy/vps/.env` **on your VPS only**. Docker Compose reads that file for interpolation. The Manus-managed project secrets and its database are different from any new VPS deployment; never copy a displayed password from this repository or paste real credentials into issues/chat.

Generate independent values in your own terminal:

```bash
openssl rand -hex 24  # DB_PASSWORD: 48 hex chars
openssl rand -hex 24  # MYSQL_ROOT_PASSWORD: a DIFFERENT 48 hex chars
openssl rand -hex 32  # JWT_SECRET: 64 hex chars
```

Then populate the following names in `deploy/vps/.env` with the generated values. This block contains **placeholders only**, not functioning secrets:

```dotenv
SITE_DOMAIN=YOUR_DOMAIN_WITH_DNS_POINTED_TO_VPS
DB_PASSWORD=REPLACE_WITH_RANDOM_HEX_48
MYSQL_ROOT_PASSWORD=REPLACE_WITH_ANOTHER_RANDOM_HEX_48
JWT_SECRET=REPLACE_WITH_RANDOM_HEX_64
ONCHAIN_OWNER_WALLET=0xYOUR_VERIFIED_BSC_WALLET_ADDRESS
BSCSCAN_API_KEY=REPLACE_WITH_BSCSCAN_ETHERSCAN_API_V2_KEY
MAINNET_UPGRADEABLE_PROXY_ADDRESS=0x56ed01a6b08ac9ba88f9c88ee5c1455410b2cc06
TESTNET_UPGRADEABLE_PROXY_ADDRESS=0x3a358d2151b0aD8adB9f8C218bD2B268d53654eE
```

- `SITE_DOMAIN`: DNS name owned by you (not an IP, no protocol prefix). Do not change live DNS solely to run a test.
- `DB_PASSWORD`: hex-only because Compose interpolates it into a MySQL URL. Keep `$`, `#`, `@`, `/` and `:` out unless URL-encoded correctly.
- `ONCHAIN_OWNER_WALLET`: an address you have verified and control. It controls protected referral-code administration after SIWE signing; do not assume the hardcoded example owner address is yours.
- `BSCSCAN_API_KEY`: server-only Etherscan API V2 key used by the Owner-only source/proxy verification endpoint. Never expose it in Vite variables, browser code, Git, or chat.
- `MAINNET_UPGRADEABLE_PROXY_ADDRESS`: the verified BSC Mainnet UUPS Proxy used by the public dashboard and `/admin`. The current deployed value is `0x56ed01a6b08ac9ba88f9c88ee5c1455410b2cc06`; use the Proxy, not the Implementation address.
- `TESTNET_UPGRADEABLE_PROXY_ADDRESS`: public BSC Testnet UUPS Proxy address. Compose passes it to both `VITE_TESTNET_UPGRADEABLE_PROXY_ADDRESS` and `VITE_TESTNET_QUEUE_ADDRESS`; use the Proxy, not the Implementation address.
- `JWT_SECRET`: signs SIWE session cookies. Rotation invalidates sessions.

Keep `.env` mode `600` and out of Git. The Compose file does not enable Manus OAuth or the Manus Forge API. See [VPS README](README.md) for migration blockers and start/rollback steps.
