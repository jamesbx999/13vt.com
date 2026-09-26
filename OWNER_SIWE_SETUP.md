# Owner SIWE และ Referral Code Registry

ฟีเจอร์นี้เพิ่มการยืนยันตัวตนด้วยลายเซ็น Wallet แบบ SIWE-style โดยใช้ **nonce แบบใช้ครั้งเดียวจากฐานข้อมูล** และ session แบบ HttpOnly cookie ฝั่ง server หลังตรวจสอบลายเซ็นสำเร็จเท่านั้น

## Owner policy

Owner wallet เริ่มต้นคือ `0x11B948575B648be50Eef781251ebdc876907E618` และสามารถเปลี่ยนได้ด้วย environment variable `ONCHAIN_OWNER_WALLET` การเข้าถึง tRPC procedures ใต้ `referralCodes` ต้องผ่าน SIWE session ของ Owner wallet หรือ Manus user ที่มี role `admin`

## Flow

1. หน้า Dashboard เรียก `siwe.requestNonce` พร้อม address, domain, URI และ Chain ID 56
2. Backend สร้าง nonce อายุ 30 นาทีและเก็บ nonce ที่ยังไม่ถูกใช้ใน `siwe_nonces`
3. Wallet เซ็นข้อความที่มี domain, URI, Chain ID, nonce และ expiration time
4. หน้าเว็บเรียก `siwe.verify`; Backend ตรวจรูปแบบข้อความ, domain, chain ID, เวลา, recover address และ consume nonce แบบครั้งเดียว
5. Backend ออก `onchain_siwe_session` แบบ HttpOnly cookie อายุ 30 นาที
6. หน้า `/owner` ใช้ session นี้อ่านและจัดการรายการ Referral Code ใน `referral_code_mappings`
7. การเพิ่ม mapping จะบันทึกสถานะ `pending` ก่อน แล้วส่ง `setReferralCode(bytes32,address,true)` ผ่าน MetaMask เมื่อ receipt สำเร็จจึงเปลี่ยนเป็น `active` พร้อม transaction hash

## ตรวจสอบบนเชน

หน้า `/owner` มีช่อง Contract Address และปุ่มตรวจ mapping รายแถวผ่าน `referrerForCode(bytes32)` โดยถือว่า Contract เป็น source of truth ส่วนฐานข้อมูลเป็น audit index สำหรับการค้นหาและสถานะการทำงาน

การกด “ปิดใน Backend” จะปิดเฉพาะ audit record ยังไม่เปลี่ยน mapping บนเชน ผู้ดูแลต้องเรียก `setReferralCode(code, referrer, false)` บน Contract แยกต่างหากหากต้องการปิดใช้งานจริง

## คำสั่งตรวจสอบ

```bash
pnpm check
pnpm build
pnpm test
```

ผลทดสอบปัจจุบันครอบคลุมการล้าง session cookie และ SIWE message parsing/signature recovery
