# 13VT — ไฟล์เตรียมติดตั้งเว็บบน VPS (ยังไม่ได้ Deploy)

แพ็กเกจนี้จัดให้รัน **React/Vite + Express/tRPC + MySQL** จากซอร์สรีโปบน Ubuntu VPS ด้วย Docker Compose และ Caddy HTTPS โดย **ยังไม่เชื่อมต่อหรือ Deploy Smart Contract ใด ๆ** ภาพใน Remix ไม่ใช่หลักฐานว่า Contract พร้อมใช้เงินจริง

## สิ่งที่อยู่ในชุดนี้

- `Dockerfile` — สร้าง frontend/backend จากซอร์ส แล้วรัน `dist/index.js` ด้วย Node 22; รวม Drizzle migrations ไว้ในอิมเมจ
- `compose.yaml` — MySQL ภายในเครือข่าย Docker, app ภายใน, Caddy เป็นพอร์ตสาธารณะ 80/443
- `Caddyfile` — TLS โดย Caddy, ส่ง `/api/*` และหน้าเว็บไป Node, ให้บริการรูปโลโก้ที่ให้มาเฉพาะ path ของโลโก้
- `assets/13vt-logo_da29a501.jpg` — โลโก้ที่เจ้าของโปรเจ็กต์ให้ไว้; Caddy ให้บริการแทน `/manus-storage/13vt-logo_da29a501.jpg`
- `CONFIGURATION.md` และ `check-env.py` — รายการค่าที่ต้องเตรียมบนเครื่องเจ้าของและตัวตรวจแบบไม่แสดง secrets

**คู่มือแบบละเอียด:** [ตั้ง DNS, สร้าง `.env` บน VPS, ตรวจ migration และทดสอบเว็บกับ DB](DOMAIN-AND-ENV-TEST.md) ใช้ประกอบขั้นตอนสรุปด้านล่าง โดยเริ่มจาก subdomain ทดสอบก่อน

## ข้อจำกัดก่อนเปิดใช้งานจริง

1. **Manus OAuth ใช้นอกโดเมน WebDev เดิมไม่ได้**: การล็อกอินด้วย Manus ที่ `/api/oauth/callback` ไม่สามารถย้าย redirect URI ไป VPS โดยตรง ต้องออกแบบผู้ให้บริการล็อกอินใหม่และทดสอบใหม่ก่อนเปิดฟีเจอร์ที่ต้องใช้บัญชี Manus. ส่วน public tRPC และ **SIWE สำหรับเจ้าของ Wallet** เป็นคนละเส้นทาง แต่ต้องทดสอบ end-to-end บน HTTPS + DB จริง; อย่าถือว่า auth พร้อมผลิตภัณฑ์เพียงเพราะหน้าเว็บโหลด
2. **ข้อมูลฐานข้อมูลเดิมไม่ได้ติดมาด้วย**: Compose สร้าง MySQL ว่าง; รัน migration หนึ่งครั้งและเก็บสำรองก่อนอัปเกรด. ถ้าจะย้ายข้อมูลจริง ต้องออกแบบและยืนยันกระบวนการ export/import แยกต่างหาก
3. **Manus Forge/Storage ไม่ได้ย้ายอัตโนมัติ**: Caddy ให้บริการได้เฉพาะโลโก้สาธารณะไฟล์นี้; path `/manus-storage/*` อื่นและคุณสมบัติที่ต้องใช้ Forge ต้องต่อ storage/provider ใหม่ หรือกำหนด credential ที่ได้รับอนุญาตอย่างเหมาะสม. อย่าใส่กุญแจระบบเดิมลง Git
4. **ไม่มี Contract Address ค่าเริ่มต้น**: `client/src/lib/queue.ts` ตั้ง `DEFAULT_CONTRACT_ADDRESS = ""`. ผู้ใช้ต้องระบุสัญญาคิวจริงที่ตรวจสอบแล้วผ่านช่องในเว็บหรือ `?contract=0x...`. **ห้ามใช้ address ของแบบจำลอง `UnfundedFifoModel`** เป็นสัญญาคิวรับเงิน; ABI ไม่ตรงและไม่มีการรับ/จ่ายโทเคน
5. **สัญญาที่อยู่ใน `deploy/remix/` เป็นแบบจำลองสถานะเท่านั้น**: ไม่มี real deposit, payout, A qualification หรือหลักประกันเงินสำรอง; ไม่เหมาะกับ mainnet/เงินจริง. ให้ทดสอบเฉพาะ Remix VM ตามคู่มือ

## ขั้นตอนบน VPS ของคุณ (เมื่อพร้อมและควบคุมโดเมนแล้ว)

ไม่ต้องส่งรหัสผ่าน, private key, seed phrase หรือ `.env` ให้ใคร; **ไฟล์นี้ไม่ได้สั่งรันบน VPS ให้คุณ**. ก่อนเริ่มให้ติดตั้ง Docker Engine พร้อม Docker Compose plugin และ Git ด้วยแนวทางอย่างเป็นทางการของผู้ให้บริการ; ตรวจว่า `docker compose version` ทำงาน. ชี้ A/AAAA ของโดเมนที่เป็นเจ้าของไปที่ VPS และอนุญาต TCP 80/443 เท่านั้นสำหรับเว็บ (MySQL และ port 3000 ไม่เผยสู่ภายนอก). ตรวจว่าพอร์ตเหล่านั้นไม่ชนเว็บที่มีอยู่แล้ว

```bash
git clone https://github.com/jamesbx999/13vt.com.git
cd 13vt.com/deploy/vps
# สร้าง .env บน VPS เองตาม CONFIGURATION.md (ห้าม commit)
chmod 600 .env
python3 check-env.py .env
# ระวัง: คำสั่ง config จะแสดง secrets ที่ interpolate แล้ว; อย่าแชร์ output
# docker compose config --quiet

docker compose up -d db
# รอ db healthy; ทำ backup ถ้าเป็น DB เดิม ก่อนรัน migration
# docker compose ps db
docker compose build app
docker compose run --rm app pnpm exec drizzle-kit migrate
# ตรวจ migration สำเร็จก่อนสตาร์ทเว็บ
docker compose up -d app proxy
```

ทดสอบจากเครื่องเจ้าของหลังเปิด HTTPS: `curl -I https://YOUR_DOMAIN/`, ตรวจ `/manus-storage/13vt-logo_da29a501.jpg`, ตรวจ tRPC `/api/trpc/system.health?input=%7B%22json%22%3A%7B%22timestamp%22%3A0%7D%7D`, ทดลอง SIWE บนโดเมนจริงด้วย Wallet ที่มีสิทธิ์ แล้วตรวจการอ่าน DB และสิทธิ์ Admin. ตรวจ proxy log ด้วย `docker compose logs --tail=100 app proxy` และ **อย่าเผยแพร่ log ที่มีข้อมูลส่วนตัว**. ก่อนใช้จริงต้องตรวจ accessibility, chain ID = 56, Contract Address/ABI, และ testnet/การ audit สัญญาแยกต่างหาก

### อัปเดต/ย้อนกลับ

- เก็บ backup DB ก่อนเปลี่ยน schema; `docker compose down` **ไม่ลบ volume** แต่ `docker compose down -v` จะลบข้อมูล — อย่าใช้โดยไม่ตั้งใจ
- ก่อนอัปเดตให้บันทึก commit SHA ที่ใช้อยู่. อัปเดต source แล้ว `docker compose build app` และ `docker compose up -d app`; migration ให้ทำเฉพาะเมื่ออ่านและตรวจ SQL เปลี่ยนแปลงแล้ว
- หาก rollout มีปัญหา ให้ revert ไป commit ก่อนหน้า แล้ว rebuild/restart image; **การย้อน schema DB ต้องมี backup และแผนแยกต่างหาก**

อ้างอิง: [Docker Compose variables](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/) และ [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https). การ push GitHub ไม่ใช่การย้าย OAuth/DB/Storage ของ WebDev อัตโนมัติ
