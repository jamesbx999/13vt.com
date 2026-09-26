from pathlib import Path

owner = Path('/home/ubuntu/onchain-queue-dashboard/client/src/pages/OwnerDashboard.tsx')
s = owner.read_text()
repl = {
    'toast.info("กำลังอ่านสถานะ Referral Code จาก BSC"': 'toast.info(t("onchainUpdated"',
    'toast.error("อ่านสถานะ On-chain ไม่สำเร็จ"': 'toast.error(t("onchainReadError"',
    'toast.error("เชื่อมต่อ Owner wallet ไม่สำเร็จ"': 'toast.error(t("ownerConnectFailed"',
    'toast.success("Owner wallet พร้อมใช้งาน"': 'toast.success(t("ownerWalletReady"',
    'toast.info("เตรียมส่ง transaction"': 'toast.info(t("registrationPreparing"',
    'toast.success("บันทึก Referral Code แล้ว"': 'toast.success(t("registrationConfirmed"',
    'toast.error("ลงทะเบียน Referral Code ไม่สำเร็จ"': 'toast.error(t("registrationFailed"',
    'toast.error("ตรวจสอบบนเชนไม่สำเร็จ"': 'toast.error(t("verifyFailed"',
    'toast.success(matches ? "Mapping ตรงกับเชน" : "Mapping ไม่ตรงกับเชน"': 'toast[matches ? "success" : "error"]((matches ? t("mappingVerified") : t("mappingMismatch"))',
    'toast.info("เตรียมปิด Referral Code บนเชน"': 'toast.info(t("disablePreparing"',
    'toast.success("ปิด Referral Code บนเชนแล้ว"': 'toast.success(t("disableConfirmed"',
    'toast.error("ปิด Referral Code บนเชนไม่สำเร็จ"': 'toast.error(t("disableFailed"',
}
for old, new in repl.items(): s = s.replace(old, new)
# Restore the ternary call shape after replacing toast method expression.
s = s.replace('toast[matches ? "success" : "error"]((matches ? t("mappingVerified") : t("mappingMismatch")), {', 'toast[matches ? "success" : "error"](matches ? t("mappingVerified") : t("mappingMismatch"), {')
owner.write_text(s)

home = Path('/home/ubuntu/onchain-queue-dashboard/client/src/pages/Home.tsx')
s = home.read_text()
repl = {
    'toast.info("กำลังสร้าง nonce และรอการเซ็นข้อความ"': 'toast.info(t("signingIn"',
    'toast.success("Signed in with your wallet"': 'toast.success(t("signInSuccess"',
    'toast.error("SIWE sign-in ไม่สำเร็จ"': 'toast.error(t("signInFailed"',
    'toast.info("กำลังเตรียม Referral registration"': 'toast.info(t("registrationPreparing"',
    'toast.success("Referral registration confirmed"': 'toast.success(t("registrationConfirmed"',
    'toast.error("Referral registration ไม่สำเร็จ"': 'toast.error(t("registrationFailed"',
    'toast.error("ไม่พบ MetaMask"': 'toast.error(t("walletNotFound"',
    'toast.success("เชื่อมต่อกระเป๋าแล้ว"': 'toast.success(t("walletConnected"',
    'toast.error("เชื่อมต่อไม่สำเร็จ"': 'toast.error(t("walletConnectFailed"',
}
for old, new in repl.items(): s = s.replace(old, new)
home.write_text(s)
