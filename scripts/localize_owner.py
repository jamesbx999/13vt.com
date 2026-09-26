from pathlib import Path

p = Path('/home/ubuntu/onchain-queue-dashboard/client/src/pages/OwnerDashboard.tsx')
s = p.read_text()
replacements = {
    '>Owner control plane<': '>{t("ownerControlPlane")}<',
    '>Referral Code Registry<': '>{t("referralRegistry")}<',
    '>จัดการ mapping และตรวจสอบผลบน BNB Smart Chain<': '>{t("manageMapping")}<',
    '>กลับ Dashboard<': '>{t("backDashboard")}<',
    '>Connect Owner<': '>{t("connectOwner")}<',
    '>Owner-only controls<': '>{t("ownerOnly")}<',
    '>Configured Owner<': '>{t("configuredOwner")}<',
    '>ตรวจสอบก่อนส่ง<': '>{t("reviewBeforeSend")}<',
    '>เพิ่ม Referral Code<': '>{t("addReferral")}<',
    '>Code จะถูก normalized เป็นตัวพิมพ์ใหญ่ และเก็บ hash bytes32 คู่กับ address<': '>{t("codeNormalized")}<',
    '>ตั้งค่า<': '>{t("set")}<',
    '>Referral Code mappings<': '>{t("mappings")}<',
    '>รีเฟรช<': '>{t("refreshData")}<',
    'placeholder="ค้นหา code, wallet, status หรือ transaction hash"': 'placeholder={t("searchPlaceholder")}',
    '>ล้างตัวกรอง<': '>{t("clearFilter")}<',
    '>Code</th>': '>{t("code")}</th>',
    '>Referrer</th>': '>{t("referrer")}</th>',
    '>สถานะ</th>': '>{t("status")}</th>',
    '>On-chain check</th>': '>{t("onchainCheck")}</th>',
    '>Transaction</th>': '>{t("transaction")}</th>',
    '>จัดการ</th>': '>{t("manage")}</th>',
    '>ไม่พบ Referral Code ตามตัวกรอง<': '>{t("noMappings")}<',
    '>ตรวจบนเชน</': '>{t("verifyOnchain")}</',
    '>Disable on-chain</': '>{t("disableOnchain")}</',
    '>ก่อนหน้า</': '>{t("previous")}</',
    '>ถัดไป<': '>{t("next")}<',
    '>กรองสถานะ On-chain<': '>{t("filterStatus")}<',
    '>ทุกสถานะ</option>': '>{t("allStatuses")}</option>',
    '>Active / ตรงกับเชน</option>': '>{t("activeMatch")}</option>',
    '>Disabled / Zero address</option>': '>{t("disabledZero")}</option>',
    '>ยังไม่ตรวจสอบ</option>': '>{t("unknown")}</option>',
    '>ReferralCodeConfigured Event Log<': '>{t("eventLog")}<',
    '>Block</th>': '>{t("block")}</th>',
    '>Action</th>': '>{t("action")}</th>',
    '>Enabled</span>': '>{t("enabled")}</span>',
    '>Disabled</span>': '>{t("disabled")}</span>',
    '>ยังไม่มี Event Log<': '>{t("noEvents")}<',
}
for old, new in replacements.items():
    s = s.replace(old, new)
p.write_text(s)
