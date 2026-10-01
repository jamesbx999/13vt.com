# 13VT deployment preparation

**No website or Smart Contract has been deployed by these files.** The two paths below are intentionally separate:

| Package | Purpose | First read |
|---|---|---|
| `vps/` | Prepare the current dashboard/backend for a Docker VPS, MySQL and HTTPS | [VPS guide](vps/README.md) and [configuration](vps/CONFIGURATION.md) |
| `remix/` | Compile and simulate the existing FIFO/UNFUNDED **status-only** contract | [Remix VM guide](remix/README.md) and [compiler manifest](remix/compiler-manifest.json) |

The Remix contract is **not** the site's queue contract, accepts no deposits, pays no USDT, verifies no qualified referrals, and cannot be used for a live financial deployment. The website's Manus OAuth and storage dependencies require separate integration decisions before a full independent production migration. No blockchain transaction, wallet connection, VPS login, DNS change or database migration was performed in preparing this package.
