from pathlib import Path

p=Path('/home/ubuntu/onchain-queue-dashboard/client/src/pages/OwnerDashboard.tsx')
s=p.read_text()
repl={
'"ตรวจสอบ Contract Address และเครือข่าย"':'t("checkContractAndAbi")',
'"ตรวจสอบ Contract และรายละเอียดก่อนส่ง transaction ทุกครั้ง"':'t("reviewBeforeSend")',
'"กรุณาลองใหม่"':'t("transactionRejected")',
'"ยังไม่ได้เชื่อมต่อ Owner wallet"':'t("ownerConnectFailed")',
'"กรอก Contract Address ก่อน"':'t("checkContractAndAbi")',
'"กรุณาตรวจสอบ MetaMask ก่อนยืนยัน setReferralCode"':'t("reviewBeforeSend")',
'"Backend และ Contract ตรงกัน"':'t("auditSource")',
'"ตรวจสอบ Wallet, Contract และ Gas แล้วลองใหม่"':'t("checkContractAndAbi")',
'"กรอก Contract Address ก่อนตรวจบนเชน"':'t("checkContractAndAbi")',
'"Contract ยังไม่มี code นี้"':'t("notAvailable")',
'"ตรวจสอบ Contract ABI และเครือข่าย"':'t("checkContractAndAbi")',
'"กรอก Contract Address ก่อนปิดใช้งานบนเชน"':'t("checkContractAndAbi")',
'"กรุณาตรวจสอบ MetaMask: setReferralCode(..., false)"':'t("reviewBeforeSend")',
'"On-chain และ Backend ตรงกัน"':'t("auditSource")',
'"ธุรกรรมถูกยกเลิกหรือ Contract ปฏิเสธ"':'t("transactionRejected")',
}
for a,b in repl.items(): s=s.replace(a,b)
p.write_text(s)

p=Path('/home/ubuntu/onchain-queue-dashboard/client/src/pages/Home.tsx')
s=p.read_text()
repl={
'"ล้าง session ของ Wallet นี้แล้ว"':'t("savedOnDevice")',
'"กรุณา Sign in ด้วย Wallet อีกครั้ง"':'t("signInFailed")',
'"อยู่บน BNB Smart Chain"':'t("onchainUpdated")',
'"โปรดเปลี่ยนเครือข่ายเป็น BNB Smart Chain"':'t("checkContractAndAbi")',
'"ไม่มีธุรกรรมและไม่มีค่า Gas ในขั้นตอนนี้"':'t("readOnlyDashboard")',
'"ตรวจสอบ Wallet และลองใหม่"':'t("walletConnectFailed")',
'"กรุณาตรวจสอบ Contract และยืนยัน transaction ใน MetaMask"':'t("reviewBeforeSend")',
'"บันทึกการแนะนำใน Smart Contract แล้ว"':'t("registrationConfirmed")',
'"ตรวจสอบ Contract, Wallet และ Gas แล้วลองใหม่"':'t("checkContractAndAbi")',
'"ต้องมี MetaMask หรือ EIP-1193 provider เพื่ออ่านข้อมูลจาก Contract"':'t("walletNotFound")',
'"กรอก Contract Address ที่ตรวจสอบแล้วก่อนอ่านข้อมูล"':'t("checkContractAndAbi")',
'"เครือข่ายปัจจุบันไม่ใช่ BNB Smart Chain (Chain ID 56)"':'t("checkContractAndAbi")',
'"อ่านประวัติ Event Logs ไม่สำเร็จ"':'t("onchainReadError")',
'"อ่านประวัติ Admin Event Logs ไม่สำเร็จ"':'t("onchainReadError")',
'"อ่านสถานะ Referral ไม่สำเร็จ"':'t("onchainReadError")',
}
for a,b in repl.items(): s=s.replace(a,b)
p.write_text(s)
