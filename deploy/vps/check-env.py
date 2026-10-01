#!/usr/bin/env python3
"""Validate the locally created VPS Compose .env without printing secrets."""
import os
import re
import sys
from pathlib import Path

path = Path(sys.argv[1]) if len(sys.argv) == 2 else Path(__file__).with_name('.env')
if not path.is_file():
    raise SystemExit(f'Missing {path}. Create it on the VPS; see CONFIGURATION.md.')
if os.stat(path).st_mode & 0o077:
    raise SystemExit('Environment file is readable by another user/group. Run chmod 600 deploy/vps/.env')
values = {}
for raw in path.read_text(encoding='utf-8').splitlines():
    line = raw.strip()
    if not line or line.startswith('#'):
        continue
    if '=' not in line:
        raise SystemExit('Invalid environment-file line; expected KEY=VALUE')
    key, value = line.split('=', 1)
    values[key.strip()] = value.strip()

required = ['SITE_DOMAIN', 'DB_PASSWORD', 'MYSQL_ROOT_PASSWORD', 'JWT_SECRET', 'ONCHAIN_OWNER_WALLET']
missing = [key for key in required if not values.get(key)]
if missing:
    raise SystemExit('Missing: ' + ', '.join(missing))
if not re.fullmatch(r'[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?', values['SITE_DOMAIN'], re.I) or '.' not in values['SITE_DOMAIN'] or values['SITE_DOMAIN'].lower().endswith(('.example', '.local')) or values['SITE_DOMAIN'].lower() == 'example.com':
    raise SystemExit('SITE_DOMAIN must be a real DNS name you control (no http:// or placeholder)')
if not all(re.fullmatch(r'[0-9a-fA-F]{48,}', values[key]) for key in ('DB_PASSWORD', 'MYSQL_ROOT_PASSWORD')):
    raise SystemExit('Database passwords must each be random hex strings of at least 48 characters')
if values['DB_PASSWORD'] == values['MYSQL_ROOT_PASSWORD']:
    raise SystemExit('Database user and root passwords must be different')
if not re.fullmatch(r'[0-9a-fA-F]{64,}', values['JWT_SECRET']):
    raise SystemExit('JWT_SECRET must be a random hex string of at least 64 characters')
if not re.fullmatch(r'0x[0-9a-fA-F]{40}', values['ONCHAIN_OWNER_WALLET']) or int(values['ONCHAIN_OWNER_WALLET'], 16) == 0:
    raise SystemExit('ONCHAIN_OWNER_WALLET must be a verified, non-zero 20-byte EVM address')
print('VPS configuration format passed (this does not verify domain ownership, database migration, or auth).')
