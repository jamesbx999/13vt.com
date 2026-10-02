# คู่มือตั้งโดเมนและ `.env` เพื่อทดสอบเว็บ 13VT บน VPS

> คู่มือนี้เตรียม **เว็บ + ฐานข้อมูล MySQL ใหม่** เท่านั้น ไม่ Deploy Smart Contract ไม่ย้ายข้อมูลจาก Manus และไม่ใช่ขั้นตอนรับเงินจริง เริ่มจาก **subdomain สำหรับทดสอบ** เช่น `staging.example.com` ที่คุณเป็นเจ้าของ อย่าเปลี่ยน DNS ของเว็บที่ใช้งานอยู่โดยไม่ตรวจผลกระทบก่อน

## 0. สิ่งที่ต้องมีและตรวจความพร้อม

- สิทธิ์จัดการ DNS ของโดเมน, สิทธิ์ SSH ใน Ubuntu VPS และ IP สาธารณะจริงของ VPS ที่ตรวจจากแผง Hostinger อีกครั้ง (อย่ายึด IP ในภาพหน้าจอเก่า)
- Git และ Docker Engine + Compose plugin: บน VPS ตรวจ `git --version`, `docker --version`, `docker compose version` ก่อน; ถ้ายังไม่มี ให้ใช้ [วิธีติดตั้ง Docker Engine บน Ubuntu](https://docs.docker.com/engine/install/ubuntu/) และ [Compose plugin](https://docs.docker.com/compose/install/linux/) จากผู้ผลิต แทนการรันสคริปต์ติดตั้งที่ไม่ตรวจสอบ
- สำรอง/จดบริการที่ใช้พอร์ต `80`, `443` และ `3306` อยู่ก่อน: `sudo ss -lntp | grep -E ':(80|443|3306)\b'` ถ้า 80/443 ถูกเว็บเดิมใช้ **อย่าสั่ง Compose นี้ทันที** ต้องออกแบบการ route ผ่าน proxy ตัวเดิม; Compose นี้ไม่เปิด 3306 หรือ 3000 สู่ภายนอก
- แผงไฟร์วอลล์ของ VPS: เปิด TCP 80, 443 สำหรับเว็บ; รักษาช่อง SSH ปัจจุบันให้เข้าถึงได้ก่อนแก้ไฟร์วอลล์ ห้ามเปิด 3306 สู่สาธารณะ ระวังพอร์ตที่ Docker publish อาจข้าม UFW บางกฎตาม [คำเตือนทางการ](https://docs.docker.com/engine/install/ubuntu/#firewall-limitations)

## 1. ตั้ง DNS เฉพาะชื่อที่จะทดสอบ

1. ตรวจว่า nameserver ของโดเมนใช้งานที่ใด: `dig NS example.com +short` แล้วไปแก้ **DNS zone ที่ nameserver นั้นควบคุม** (อาจเป็น Hostinger, Cloudflare หรือผู้ให้บริการรายอื่น) ไม่ใช่แก้สองแห่งพร้อมกัน
2. สร้าง/แก้ `A` record ของชื่อที่เลือก เช่น `staging` → **IPv4 ของ VPS ที่ตรวจใหม่**; TTL เริ่มต้นของผู้ให้บริการได้ ถ้าใช้ชื่อรากโดเมนให้ใช้ `@` แทน ห้ามลบ MX/TXT/email records ของโดเมน
3. หากชื่อนั้นมี `AAAA` ให้ชี้ไป IPv6 ของ VPS ที่ **เข้าถึงได้จริง** พร้อมเปิด 80/443 ทั้ง IPv4/IPv6; มิฉะนั้นลบเฉพาะ AAAA **ที่ผิด** ของชื่อทดสอบ ไม่ใช่ลบของบริการอื่น. อย่าสร้าง CNAME และ A ที่ชื่อเดียวกันพร้อมกัน
4. ตรวจภายนอก: `dig +short A staging.example.com`, `dig +short AAAA staging.example.com` และ `getent ahostsv4 staging.example.com`; เทียบกับ VPS. DNS อาจใช้เวลาถึง 24 ชม. ตาม [คู่มือ Hostinger](https://www.hostinger.com/support/1583227-how-to-point-a-domain-to-your-vps-at-hostinger/) หากใช้ Cloudflare proxy ให้ทดสอบ DNS-only ก่อนเพื่อแยกปัญหา TLS/proxy
5. Caddy ออกใบรับรองอัตโนมัติเมื่อ A/AAAA ชี้เครื่องจริง พอร์ต 80/443 เข้าถึงได้และไม่มี proxy อื่นยึดพอร์ต; ดู [เงื่อนไข Caddy](https://caddyserver.com/docs/automatic-https). **อย่าใช้โดเมน GitHub repository เป็นหลักฐานว่าเป็นเจ้าของ DNS ของโดเมนนั้น**

## 2. รับซอร์สและสร้างค่าใหม่บน VPS

```bash
git clone https://github.com/jamesbx999/13vt.com.git
cd 13vt.com/deploy/vps
# ไฟล์ตัวอย่างไม่ได้อยู่ใน GitHub: สร้างไฟล์ส่วนตัวบน VPS เอง
install -m 600 /dev/null .env
# เปิดด้วย editor ที่คุณควบคุม เช่น nano .env; อย่าส่งไฟล์ให้ผู้อื่น
# สร้างค่า 3 ค่าแยกกันบน VPS เท่านั้น; อย่าโพสต์ผลลัพธ์
openssl rand -hex 24   # DB_PASSWORD
openssl rand -hex 24   # MYSQL_ROOT_PASSWORD
openssl rand -hex 32   # JWT_SECRET
```

ใช้ editor บน VPS แก้ `deploy/vps/.env` เฉพาะชื่อด้านล่าง (ตัวอย่าง **ไม่ใช่ความลับจริง**):

```dotenv
SITE_DOMAIN=staging.example.com
DB_PASSWORD=<hex-48-characters-generated-locally>
MYSQL_ROOT_PASSWORD=<a-different-hex-48-characters>
JWT_SECRET=<hex-64-characters-generated-locally>
ONCHAIN_OWNER_WALLET=0x<40-hex-character-address-you-control>
BSCSCAN_API_KEY=<server-only-Etherscan-API-v2-key>
MAINNET_UPGRADEABLE_PROXY_ADDRESS=0x56ed01a6b08ac9ba88f9c88ee5c1455410b2cc06
MAINNET_IMPLEMENTATION_ADDRESS=0x12c7726db573416ecb36c42462955ff39786958b
TESTNET_UPGRADEABLE_PROXY_ADDRESS=0x3a358d2151b0aD8adB9f8C218bD2B268d53654eE
```

- `SITE_DOMAIN` เป็น hostname อย่างเดียว ไม่มี `https://` หรือ `/` และ DNS ต้องชี้มายัง VPS; ไม่ต้องมี `www` หากไม่ได้ตั้ง DNS/เพิ่ม Caddy site สำหรับมัน
- `DB_PASSWORD` และ `MYSQL_ROOT_PASSWORD` **คนละค่า**; ระบบใช้ user `queue`, DB `onchain_queue` และ URL `mysql://queue:<DB_PASSWORD>@db:3306/onchain_queue` **ภายใน Docker** เท่านั้น. ใช้ hex เพื่อไม่ต้อง URL-encode `$`, `@`, `#`, `:`; ห้ามนำค่า `DATABASE_URL`/`JWT_SECRET` ของโปรเจ็กต์ Manus มาใช้ซ้ำ
- `JWT_SECRET` เซ็น session; เปลี่ยนค่าแล้ว session เดิมใช้ไม่ได้. `ONCHAIN_OWNER_WALLET` คือกระเป๋าที่ควบคุมจริงและจะใช้ลงลายเซ็น SIWE (ไม่ใช่คีย์ส่วนตัว). ค่านี้เป็น **address สาธารณะ** ที่ส่งเป็น `VITE_ONCHAIN_OWNER_WALLET` ระหว่าง build เว็บ และเป็นค่า backend runtime; เปลี่ยน address แล้วต้อง `docker compose build app && docker compose up -d app` เพื่อให้หน้าเว็บตรงกับ backend
- `BSCSCAN_API_KEY` เป็น secret ฝั่ง server สำหรับ Etherscan API V2; ห้ามส่งเข้า Vite/build args หรือใส่ใน source code. Endpoint Verify ใน `/admin` จะเรียกได้หลัง Owner ผ่าน SIWE session แล้วเท่านั้น
- `MAINNET_UPGRADEABLE_PROXY_ADDRESS` เป็น Proxy ที่ใช้จริงบน BSC Mainnet (Chain ID 56) สำหรับ Dashboard และ `/admin`; ค่า deploy ปัจจุบันคือ `0x56ed01a6b08ac9ba88f9c88ee5c1455410b2cc06` และ Compose จะส่งค่าเป็น `VITE_ONCHAIN_PROXY_ADDRESS`, `VITE_ONCHAIN_QUEUE_ADDRESS` และ `VITE_MAINNET_UPGRADEABLE_PROXY_ADDRESS`
- `MAINNET_IMPLEMENTATION_ADDRESS` เป็น Implementation ที่ Proxy ใช้งานอยู่ปัจจุบันและ Verify แบบ Exact Match แล้ว: `0x12c7726db573416ecb36c42462955ff39786958b`; Compose จะส่งค่าเป็น `VITE_ONCHAIN_IMPLEMENTATION_ADDRESS` สำหรับหน้า Verify ของ Admin
- `TESTNET_UPGRADEABLE_PROXY_ADDRESS` เป็น address สาธารณะของ UUPS Proxy บน BSC Testnet; Compose จะส่งค่าเดียวกันเป็น `VITE_TESTNET_UPGRADEABLE_PROXY_ADDRESS` และ `VITE_TESTNET_QUEUE_ADDRESS` ระหว่าง build. ค่าอ้างอิงที่ตรวจแล้วปัจจุบันคือ `0x3a358d2151b0aD8adB9f8C218bD2B268d53654eE`; ห้ามใส่ private key หรือ address ของ Implementation แทน Proxy
- ห้ามเก็บ seed phrase, private key, token API หรือ `.env` ใน GitHub/แชต; ให้เก็บ backup ความลับภายนอกรีโปโดยสิทธิ์จำกัด. `.env` ไม่ถูก track โดย `.gitignore` และถูกตัดออกจาก Docker build context
- ตรวจค่าโดยไม่แสดงความลับ: `python3 check-env.py .env`; หาก parser แจ้งข้อผิดพลาด ให้แก้ก่อน. `docker compose config --quiet` ตรวจไวยากรณ์โดยไม่พิมพ์ค่าที่ interpolate; **อย่าใช้ `docker compose config` โดยไม่ใส่ `--quiet` แล้วแชร์ผล**

## 3. เริ่ม DB และรัน migration หนึ่งครั้ง

```bash
# อยู่ใน 13vt.com/deploy/vps และ .env ถูกสร้างไว้แล้ว
docker compose up -d db
docker compose ps db   # รอให้ HEALTHY
# ถ้าเป็น DB ที่มีข้อมูลอยู่แล้ว ต้องทำ backup + ทบทวน SQL ก่อน migrate
docker compose build app
docker compose run --rm app pnpm exec drizzle-kit migrate
# ตรวจว่ามีตารางโดยไม่แสดงรหัสผ่าน
docker compose exec db sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql -u"$MYSQL_USER" "$MYSQL_DATABASE" -e "SHOW TABLES"'
```

Compose `db_data` เป็น volume ถาวร; เปลี่ยน `MYSQL_*` ใน `.env` **หลัง DB initialize แล้วไม่ได้รีเซ็ตรหัสผ่านเดิม** ตามพฤติกรรม MySQL image. อย่าใช้ `docker compose down -v` (ลบ volume ข้อมูล). การ migrate ในคู่มือนี้เป็น schema เปล่าของโปรเจ็กต์สำเนา ไม่ใช่การนำข้อมูลของเว็บเดิมมา

## 4. เริ่มเว็บและเช็ก TLS / API / DB

```bash
docker compose up -d app proxy
docker compose ps
# จากเครื่องที่เข้าถึงโดเมน (ไม่ใช้ -k เพื่อกลบ TLS error):
curl -I https://staging.example.com/
curl -I https://staging.example.com/manus-storage/13vt-logo_da29a501.jpg
# API health ไม่ใช่การยืนยันว่า DB หรือ wallet ใช้งานได้
curl -fsS 'https://staging.example.com/api/trpc/system.health?input=%7B%22json%22%3A%7B%22timestamp%22%3A0%7D%7D'
docker compose logs --tail=80 app proxy db
```

จากนั้นทดสอบ **DB จริง** ด้วย query แบบอ่านอย่างเดียวใน app container (ไม่พิมพ์ URL):

```bash
docker compose exec app node -e 'const db=require("mysql2/promise"); db.createConnection(process.env.DATABASE_URL).then(async c=>{ const [r]=await c.query("SHOW TABLES"); console.log("tables:",r.length); await c.end() }).catch(e=>{ console.error("DB test failed:",e.code||e.name); process.exitCode=1 })'
```

`system.health` บอกเพียง API ตอบ; `SHOW TABLES` ใน container ตรวจ credential/network/schema เท่านั้น **ไม่ใช่** การรับรอง SIWE หรือการอ่านสัญญา. บนเว็บทดสอบกับ Wallet ที่ควบคุมบน HTTPS: ต่อกระเป๋า, ล็อกอิน SIWE, ลอง query ที่ต้องมีสิทธิ์ตาม role แล้วดูว่ารายการจาก DB ว่างตาม schema ใหม่เป็นผลที่คาดได้. ใช้ contract address ที่ ABI เข้ากับเว็บเท่านั้น—`deploy/remix/UnfundedFifoModel.sol` เป็น mock สถานะ ไม่รับ USDT และ ABI **ไม่ตรง** กับหน้าเว็บ. หลีกเลี่ยงการส่งธุรกรรมจริงเพื่อทดสอบระบบ DB

## 5. สาเหตุยอดฮิตเมื่อไม่ผ่าน

| อาการ | ตรวจ | แนวทาง |
|---|---|---|
| DNS ไม่ตรง | `dig A/AAAA`, `dig NS`, แผง VPS | แก้ zone ที่ authoritative; รอ propagation; ตรวจ AAAA ไม่ชี้ผิด |
| TLS ไม่ออก | `docker compose logs proxy`, พอร์ต 80/443, DNS | ปลด proxy อื่นที่ชนพอร์ตหรือ route ผ่าน proxy เดิม; อย่าใช้ `curl -k` เพื่อมองข้ามปัญหา |
| DB `Access denied` | `.env`, `docker compose ps db`, volume เดิม | ห้ามลบ volume เพื่อแก้ทันที; ค่า MYSQL_* มีผลครั้งแรกเท่านั้น ตรวจ user/password และ backup ก่อนเปลี่ยน |
| API ผ่าน แต่ Owner ใช้งานไม่ได้ | SIWE session/owner address, HTTPS origin, cookie | Manus OAuth เดิมใช้บน VPS ไม่ได้โดยอัตโนมัติ; ห้ามอ้างว่า production auth พร้อม; ทดสอบสิทธิ์จริง |
| หน้าข้อมูลเชนว่าง | wallet chain ID, contract address, ABI | DB ไม่ได้สร้าง contract address; mock Remix ห้ามนำมาใช้แทน Queue ABI |

ก่อนเปิดจริงต้องมีแผน backup DB/rollback, ทดสอบสิทธิ์ auth และตรวจสัญญา/กฎการจัดสรรบน testnet แยกจากเว็บไซต์นี้ เอกสารนี้ไม่ได้เข้าถึงหรือแก้ VPS ให้คุณ
