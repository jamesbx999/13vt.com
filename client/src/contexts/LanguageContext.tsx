import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export const LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
  { code: "lo", label: "ລາວ", flag: "🇱🇦" },
  { code: "th", label: "ไทย", flag: "🇹🇭" },
] as const;
export type LanguageCode = (typeof LANGUAGES)[number]["code"];

const common = {
  dashboard: "Onchain Queue Dashboard",
  ownerControl: "Owner",
  connectWallet: "Connect wallet",
  readOnlyDashboard: "Read-only dashboard",
  readOnchain: "Read on-chain data",
  refreshData: "Refresh data",
  queueLatest: "Latest on-chain queue",
  ticketTotal: "Total tickets",
  waitingAllocation: "Waiting allocation",
  contractBalance: "Contract balance",
  claimedTotal: "Total claimed",
  onchainUpdated: "On-chain data updated",
  onchainChanged: "On-chain status changed",
  onchainSyncFailed: "On-chain refresh failed",
  autoRefreshRunning: "Auto-refresh is running",
  language: "Language",
  settings: "Settings",
  dashboardSettings: "Dashboard settings",
  toastNotifications: "Toast notifications",
  buttonAnimations: "Button animations",
  buttonAnimationsDescription:
    "Show animated gradients on primary action buttons.",
  autoRefreshInterval: "Auto-refresh interval",
  savedOnDevice: "Changes are saved on this device.",
  seconds: "seconds",
  ownerControlPlane: "Owner control plane",
  referralRegistry: "Referral Code Registry",
  manageMapping: "Manage mappings and verify results on BNB Smart Chain",
  backDashboard: "Back to Dashboard",
  connectOwner: "Connect Owner",
  ownerOnly: "Owner-only controls",
  ownerDescription:
    "Backend access is limited to the Owner SIWE session or Manus admin. Every real transaction must be confirmed in the wallet.",
  configuredOwner: "Configured Owner",
  reviewBeforeSend: "Review before sending",
  disableDescription:
    "Disable calls setReferralCode(bytes32,address,false) directly on the Contract and clears the mapping for new users. The backend audit is updated only after confirmation.",
  addReferral: "Add Referral Code",
  codeNormalized:
    "Code is normalized to uppercase and stored as a bytes32 hash with the address.",
  set: "Set mapping",
  mappings: "Referral Code mappings",
  auditSource:
    "Backend is an audit index; the Contract is the source of truth.",
  clearFilter: "Clear filters",
  searchPlaceholder: "Search code, wallet, status, or transaction hash",
  onchainCheck: "On-chain check",
  action: "Action",
  status: "Status",
  manage: "Manage",
  verifyOnchain: "Verify on-chain",
  disableOnchain: "Disable on-chain",
  noMappings: "No Referral Code matches the current filters",
  previous: "Previous",
  next: "Next",
  page: "Page",
  showing: "Showing",
  filterStatus: "Filter On-chain status",
  allStatuses: "All statuses",
  activeMatch: "Active / matches chain",
  disabledZero: "Disabled / zero address",
  mismatch: "Mismatch",
  unknown: "Not checked yet",
  eventLog: "ReferralCodeConfigured Event Log",
  eventDescription: "Open/close mapping history read directly from the chain",
  enabled: "Enabled",
  disabled: "Disabled",
  noEvents: "No Event Logs yet",
  loadingEvents: "Reading Event Logs…",
  block: "Block",
  code: "Code",
  referrer: "Referrer",
  transaction: "Transaction",
  pendingOnchain: "Auto-refresh is running",
  ownerWalletReady: "Owner wallet ready",
  loadingMappings: "Reading mappings from Backend…",
  addCodePlaceholder: "e.g. A7K2QP9X",
  referrerPlaceholder: "Referrer wallet address",
  contractPlaceholder: "Contract Address",
  notAvailable: "Not available",
  txNone: "No transaction yet",
  updatedCount: "Checked {count} items",
  changedCount: "{count} referral mapping(s) changed on-chain",
  resetSettings: "Reset to defaults",
  nextRefresh: "Next refresh in {seconds}s",
  refreshPaused: "Auto-refresh paused while this tab is inactive",
  blockUpdated: "Block {block}",
  onchainReadError: "Could not read on-chain data",
  checkContractAndAbi: "Check the Contract address, ABI, and network.",
  walletNotFound: "No compatible wallet found",
  walletConnected: "Wallet connected",
  walletAddressCopied: "Wallet address copied",
  walletAddressCopyFailed: "Could not copy wallet address",
  walletConnectFailed: "Wallet connection failed",
  signingIn: "Creating nonce and waiting for signature",
  signInSuccess: "Wallet sign-in confirmed",
  signInFailed: "Wallet sign-in failed",
  registrationPreparing: "Preparing referral registration",
  registrationConfirmed: "Referral registration confirmed",
  registrationFailed: "Referral registration failed",
  ownerConnectFailed: "Could not connect Owner wallet",
  mappingVerified: "Mapping matches the chain",
  mappingMismatch: "Mapping does not match the chain",
  verifyFailed: "On-chain verification failed",
  disablePreparing: "Preparing on-chain disable",
  disableConfirmed: "Referral Code disabled on-chain",
  disableFailed: "Could not disable Referral Code",
  transactionRejected: "Transaction was rejected or reverted",
  tabInactive: "Tab inactive",
  pauseAutoRefresh: "Pause auto-refresh",
  resumeAutoRefresh: "Resume auto-refresh",
  updatedNow: "Updated just now",
  exportCsv: "Export CSV",
  noDataToExport: "No Referral Code data to export",
  exportSuccess: "CSV exported",
  exportedCount: "Exported {count} rows",
  lastUpdated: "Last Updated",
  sortNewest: "Newest updates first",
  transparencyLayer: "Transparency layer",
  queueProtocol: "Queue protocol",
  readOnlyByDefault: "Read-only by default",
  contractDataDirect:
    "Data comes directly from the Smart Contract; no token transfer permission is requested.",
  heroTitle: "Verify the queue and allocated revenue from on-chain data",
  heroDescription:
    "Connect MetaMask to read the queue state from the selected Contract. This website never requests token transfer permission and does not guarantee returns.",
  contractAddressPlaceholder: "Enter a verified Contract Address",
  loadingData: "Reading data",
  queueDescription: "Data from the Contract ticket getter",
  previewDescription: "Preview — enter a Contract Address to read live data",
  recipient: "Recipient",
  viewExplorer: "View on Explorer",
  latestUpdate: "Latest update: Block {block}",
  sampleNotReal: "Preview data is not real funds",
  explorerCheck: "All data can be rechecked on the Explorer",
  contractState: "Contract State",
  viewStatus: "State read with `view`",
  copyContract: "Copy Contract Address",
  sourcesVerification: "Data sources and verification",
  verifiedContract: "Verified Contract",
  readonlyRpc: "Read-only RPC",
  statusClaimed: "Claimed",
  statusAllocated: "Allocated",
  statusWaiting: "Waiting",
  pending: "Pending",
  confirmed: "Confirmed",
  reverted: "Reverted",
  gasEstimate: "Estimated gas",
  estimated: "Estimated",
  retry: "Retry",
  cancel: "Cancel",
  confirmSend: "Confirm and send transaction",
  close: "Close",
  ownerSessionRequired: "Sign in with the Owner wallet to view these records",
  loadingEventsShort: "Reading Event Log…",
  autoRefreshRunningLabel: "Auto-refresh is running",
  noTx: "No transaction yet",
  backendAccessNotice:
    "Backend access is limited to the Owner SIWE session or Manus admin. Every real transaction must be confirmed in the wallet.",
  disableNotice:
    "Disable calls setReferralCode(bytes32,address,false) directly on the Contract and clears the mapping for new users. The audit status is saved after confirmation.",
  setMapping: "Set mapping",
  networkCorrect: "Correct network",
  contractRead: "Read from Smart Contract",
  preview: "Preview",
  ticketOrder: "Ticket ID order",
  tokenState: "Read from token state",
  onchainState: "Read from on-chain state",
  myQueue: "My queue",
  allocatedRevenue: "Allocated revenue",
  transactions: "Transactions",
  contractAbi: "Contract / ABI",
  mainMenu: "Main menu",
  transactionPendingDetail:
    "Do not close MetaMask or change networks while waiting.",
  transactionConfirmedDetail:
    "Ticket amount and status will refresh from the Smart Contract.",
  transactionRevertedDetail:
    "The transaction was rejected or reverted by the Contract.",
  refresh: "Refresh",
  branchStatistics: "Branch statistics",
  branchStatisticsDescription: "Recorded referral-code mappings per branch",
  referrals: "referrals",
  blockFrom: "Block from",
  blockTo: "Block to",
  eventRecords: "event records",
  registeredEvent: "Registered event",
  consistencyCheck: "Consistency",
  consistencyMatch: "Registered event actor matches referrerOf",
  consistencyMismatch: "Registered event actor does not match referrerOf",
  referrerOfLabel: "referrerOf",
  referralPath: "On-chain referral path",
  referralPathDescription: "Registered events associated with this wallet",
  eventEvidence: "Event evidence",
  noPathEvents: "No Registered events for this wallet",
  eventPathLoading: "Reading Registered events…",
  exportTree: "Export tree",
  registeredBy: "Registered by",
  ticket: "Ticket",
  dateRange: "Date range",
  dateFrom: "From date",
  dateTo: "To date",
  clearDateRange: "Clear date range",
  dateRangeApplied: "Date range filter applied",
  invalidDateRange: "The start date must be before the end date",
  adminReferralTree: "Admin referral tree",
  userReferralTree: "My referral tree",
  adminTreeDescription:
    "Admin view of referral-code branches and their on-chain mappings",
  userTreeDescription:
    "Read-only view of your referral position; no admin actions are available here",
  adminView: "Admin view",
  userView: "User view",
  noReferralTreeData: "No referral tree data is available",
  treeDataNotice:
    "Tree placement is derived only from recorded mappings and on-chain reads; the dashboard does not invent missing users or guarantee rewards.",
  branch: "Branch",
  directReferrals: "Direct referrals",
  userBranch: "User branch",
  timezone: "Timezone",
  localTimezone: "Local timezone",
  timezoneDescription:
    "Choose the timezone used for registered-event timestamps.",
};

type Translation = Record<TranslationKey, string>;
const translations: Record<LanguageCode, Translation> = {
  en: common,
  de: {
    ...common,
    dashboard: "Onchain-Warteschlangen-Dashboard",
    ownerControl: "Eigentümer",
    connectWallet: "Wallet verbinden",
    readOnlyDashboard: "Nur-Lese-Dashboard",
    readOnchain: "On-Chain-Daten lesen",
    refreshData: "Daten aktualisieren",
    settings: "Einstellungen",
    dashboardSettings: "Dashboard-Einstellungen",
    toastNotifications: "Toast-Benachrichtigungen",
    autoRefreshInterval: "Aktualisierungsintervall",
    seconds: "Sekunden",
    resetSettings: "Auf Standard zurücksetzen",
    nextRefresh: "Nächste Aktualisierung in {seconds}s",
    refreshPaused:
      "Automatische Aktualisierung pausiert, weil dieser Tab inaktiv ist",
    onchainUpdated: "On-Chain-Daten aktualisiert",
    onchainChanged: "On-Chain-Status geändert",
    onchainReadError: "On-Chain-Daten konnten nicht gelesen werden",
    checkContractAndAbi: "Contract-Adresse, ABI und Netzwerk prüfen.",
    walletNotFound: "Keine kompatible Wallet gefunden",
    walletConnected: "Wallet verbunden",
    walletConnectFailed: "Wallet-Verbindung fehlgeschlagen",
    signingIn: "Nonce wird erstellt, Signatur wird erwartet",
    signInSuccess: "Wallet-Anmeldung bestätigt",
    signInFailed: "Wallet-Anmeldung fehlgeschlagen",
    registrationPreparing: "Referral-Registrierung wird vorbereitet",
    registrationConfirmed: "Referral-Registrierung bestätigt",
    registrationFailed: "Referral-Registrierung fehlgeschlagen",
    ownerWalletReady: "Eigentümer-Wallet bereit",
    ownerConnectFailed: "Eigentümer-Wallet konnte nicht verbunden werden",
    mappingVerified: "Mapping stimmt mit der Chain überein",
    mappingMismatch: "Mapping stimmt nicht mit der Chain überein",
    verifyFailed: "On-Chain-Prüfung fehlgeschlagen",
    disablePreparing: "On-Chain-Deaktivierung wird vorbereitet",
    disableConfirmed: "Referral-Code auf der Chain deaktiviert",
    disableFailed: "Referral-Code konnte nicht deaktiviert werden",
    transactionRejected: "Transaktion abgelehnt oder zurückgesetzt",
    tabInactive: "Tab inaktiv",
    pauseAutoRefresh: "Automatische Aktualisierung pausieren",
    resumeAutoRefresh: "Automatische Aktualisierung fortsetzen",
    updatedNow: "Gerade aktualisiert",
    exportCsv: "CSV exportieren",
    noDataToExport: "Keine Referral-Code-Daten zum Exportieren",
    exportSuccess: "CSV exportiert",
    exportedCount: "{count} Zeilen exportiert",
    lastUpdated: "Zuletzt aktualisiert",
    sortNewest: "Neueste Aktualisierungen zuerst",
    timezone: "Zeitzone",
    localTimezone: "Lokale Zeitzone",
    timezoneDescription:
      "Wählen Sie die Zeitzone für Zeitstempel registrierter Ereignisse.",
    showing: "Anzeige",
    page: "Seite",
  },
  zh: {
    ...common,
    dashboard: "链上队列仪表盘",
    ownerControl: "所有者",
    connectWallet: "连接钱包",
    readOnlyDashboard: "只读仪表盘",
    readOnchain: "读取链上数据",
    settings: "设置",
    dashboardSettings: "仪表盘设置",
    toastNotifications: "Toast 通知",
    autoRefreshInterval: "自动刷新间隔",
    seconds: "秒",
    resetSettings: "恢复默认设置",
    nextRefresh: "下次刷新将在 {seconds} 秒后进行",
    refreshPaused: "标签页未激活，自动刷新已暂停",
    onchainUpdated: "链上数据已更新",
    onchainChanged: "链上状态已变化",
    onchainReadError: "无法读取链上数据",
    checkContractAndAbi: "请检查合约地址、ABI 和网络。",
    walletNotFound: "未找到兼容的钱包",
    walletConnected: "钱包已连接",
    walletConnectFailed: "钱包连接失败",
    signingIn: "正在创建 nonce 并等待签名",
    signInSuccess: "钱包登录已确认",
    signInFailed: "钱包登录失败",
    registrationPreparing: "正在准备推荐注册",
    registrationConfirmed: "推荐注册已确认",
    registrationFailed: "推荐注册失败",
    ownerWalletReady: "所有者钱包已准备好",
    ownerConnectFailed: "无法连接所有者钱包",
    mappingVerified: "映射与链上数据一致",
    mappingMismatch: "映射与链上数据不一致",
    verifyFailed: "链上验证失败",
    disablePreparing: "正在准备链上禁用",
    disableConfirmed: "推荐码已在链上禁用",
    disableFailed: "无法禁用推荐码",
    transactionRejected: "交易被拒绝或回滚",
    tabInactive: "标签页未激活",
    pauseAutoRefresh: "暂停自动刷新",
    resumeAutoRefresh: "继续自动刷新",
    updatedNow: "刚刚更新",
    exportCsv: "导出 CSV",
    noDataToExport: "没有可导出的推荐码数据",
    exportSuccess: "CSV 已导出",
    exportedCount: "已导出 {count} 行",
    lastUpdated: "最后更新",
    sortNewest: "最新更新优先",
    timezone: "时区",
    localTimezone: "本地时区",
    timezoneDescription: "选择注册事件时间戳使用的时区。",
    showing: "显示",
    page: "页",
  },
  lo: {
    ...common,
    dashboard: "ແຜງຄວບຄຸມຄິວ Onchain",
    ownerControl: "ເຈົ້າຂອງ",
    connectWallet: "ເຊື່ອມຕໍ່ Wallet",
    readOnlyDashboard: "ແຜງອ່ານຢ່າງດຽວ",
    readOnchain: "ອ່ານຂໍ້ມູນ On-chain",
    settings: "ການຕັ້ງຄ່າ",
    dashboardSettings: "ການຕັ້ງຄ່າ Dashboard",
    toastNotifications: "ການແຈ້ງເຕືອນ Toast",
    autoRefreshInterval: "ຄວາມຖີ່ Auto-refresh",
    seconds: "ວິນາທີ",
    resetSettings: "ຄືນຄ່າເລີ່ມຕົ້ນ",
    nextRefresh: "ຣີເຟຣຊຄັ້ງຕໍ່ໄປໃນ {seconds} ວິນາທີ",
    refreshPaused: "ຢຸດ Auto-refresh ເພາະ Tab ບໍ່ໄດ້ໃຊ້ງານ",
    onchainUpdated: "ອັບເດດຂໍ້ມູນ On-chain ແລ້ວ",
    onchainChanged: "ສະຖານະ On-chain ປ່ຽນແປງ",
    onchainReadError: "ອ່ານຂໍ້ມູນ On-chain ບໍ່ສຳເລັດ",
    checkContractAndAbi: "ກວດ Contract address, ABI ແລະ network.",
    walletNotFound: "ບໍ່ພົບ Wallet ທີ່ຮອງຮັບ",
    walletConnected: "ເຊື່ອມຕໍ່ Wallet ແລ້ວ",
    walletConnectFailed: "ເຊື່ອມຕໍ່ Wallet ບໍ່ສຳເລັດ",
    signingIn: "ກຳລັງສ້າງ nonce ແລະລໍຖ້າການເຊັນ",
    signInSuccess: "ຢືນຢັນການເຂົ້າໃຊ້ Wallet ແລ້ວ",
    signInFailed: "ເຂົ້າໃຊ້ Wallet ບໍ່ສຳເລັດ",
    registrationPreparing: "ກຳລັງກຽມລົງທະບຽນ Referral",
    registrationConfirmed: "ຢືນຢັນການລົງທະບຽນ Referral ແລ້ວ",
    registrationFailed: "ລົງທະບຽນ Referral ບໍ່ສຳເລັດ",
    ownerWalletReady: "Owner Wallet ພ້ອມໃຊ້ງານ",
    ownerConnectFailed: "ເຊື່ອມຕໍ່ Owner Wallet ບໍ່ສຳເລັດ",
    mappingVerified: "Mapping ກົງກັບ On-chain",
    mappingMismatch: "Mapping ບໍ່ກົງກັບ On-chain",
    verifyFailed: "ກວດສອບ On-chain ບໍ່ສຳເລັດ",
    disablePreparing: "ກຳລັງກຽມປິດໃຊ້ On-chain",
    disableConfirmed: "ປິດ Referral Code ໃນ On-chain ແລ້ວ",
    disableFailed: "ປິດ Referral Code ບໍ່ສຳເລັດ",
    transactionRejected: "Transaction ຖືກປະຕິເສດ ຫຼື revert",
    tabInactive: "Tab ບໍ່ໄດ້ໃຊ້ງານ",
    pauseAutoRefresh: "ຢຸດ Auto-refresh",
    resumeAutoRefresh: "ຫຼິ້ນ Auto-refresh ຕໍ່",
    updatedNow: "ອັບເດດຫາກໍ່ເກີດ",
    exportCsv: "ສົ່ງອອກ CSV",
    noDataToExport: "ບໍ່ມີຂໍ້ມູນ Referral Code ໃຫ້ສົ່ງອອກ",
    exportSuccess: "ສົ່ງອອກ CSV ແລ້ວ",
    exportedCount: "ສົ່ງອອກ {count} ແຖວ",
    lastUpdated: "ອັບເດດຫຼ້າສຸດ",
    sortNewest: "ການອັບເດດໃໝ່ສຸດກ່ອນ",
    timezone: "ເຂດເວລາ",
    localTimezone: "ເຂດເວລາທ້ອງຖິ່ນ",
    timezoneDescription: "ເລືອກເຂດເວລາສຳລັບເວລາ Event ທີ່ລົງທະບຽນ.",
    showing: "ສະແດງ",
    page: "ໜ້າ",
  },
  th: {
    ...common,
    dashboard: "แดชบอร์ดคิว Onchain",
    ownerControl: "Owner",
    connectWallet: "เชื่อมต่อกระเป๋า",
    readOnlyDashboard: "แดชบอร์ดแบบอ่านอย่างเดียว",
    readOnchain: "อ่านข้อมูล On-chain",
    settings: "ตั้งค่า",
    dashboardSettings: "การตั้งค่า Dashboard",
    toastNotifications: "การแจ้งเตือน Toast",
    autoRefreshInterval: "ความถี่ Auto-refresh",
    seconds: "วินาที",
    resetSettings: "รีเซ็ตเป็นค่าเริ่มต้น",
    nextRefresh: "จะรีเฟรชอีกครั้งใน {seconds} วินาที",
    refreshPaused: "หยุด Auto-refresh ชั่วคราวเพราะแท็บไม่ active",
    onchainUpdated: "อัปเดตข้อมูล On-chain แล้ว",
    onchainChanged: "สถานะ On-chain เปลี่ยนแปลง",
    onchainReadError: "อ่านข้อมูล On-chain ไม่สำเร็จ",
    checkContractAndAbi: "ตรวจสอบ Contract Address, ABI และเครือข่าย",
    walletNotFound: "ไม่พบกระเป๋าที่รองรับ",
    walletConnected: "เชื่อมต่อกระเป๋าแล้ว",
    walletConnectFailed: "เชื่อมต่อกระเป๋าไม่สำเร็จ",
    signingIn: "กำลังสร้าง nonce และรอการเซ็นข้อความ",
    signInSuccess: "ยืนยันการเข้าสู่ระบบด้วย Wallet แล้ว",
    signInFailed: "เข้าสู่ระบบด้วย Wallet ไม่สำเร็จ",
    registrationPreparing: "กำลังเตรียมลงทะเบียน Referral",
    registrationConfirmed: "ยืนยันการลงทะเบียน Referral แล้ว",
    registrationFailed: "ลงทะเบียน Referral ไม่สำเร็จ",
    ownerWalletReady: "Owner Wallet พร้อมใช้งาน",
    ownerConnectFailed: "เชื่อมต่อ Owner Wallet ไม่สำเร็จ",
    mappingVerified: "Mapping ตรงกับเชน",
    mappingMismatch: "Mapping ไม่ตรงกับเชน",
    verifyFailed: "ตรวจสอบ On-chain ไม่สำเร็จ",
    disablePreparing: "กำลังเตรียมปิด Referral Code บนเชน",
    disableConfirmed: "ปิด Referral Code บนเชนแล้ว",
    disableFailed: "ปิด Referral Code ไม่สำเร็จ",
    transactionRejected: "ธุรกรรมถูกยกเลิกหรือ Contract ปฏิเสธ",
    tabInactive: "แท็บไม่ active",
    pauseAutoRefresh: "หยุด Auto-refresh",
    resumeAutoRefresh: "เล่น Auto-refresh ต่อ",
    updatedNow: "อัปเดตเมื่อสักครู่นี้",
    exportCsv: "ส่งออก CSV",
    noDataToExport: "ไม่มีข้อมูล Referral Code ให้ส่งออก",
    exportSuccess: "ส่งออก CSV แล้ว",
    exportedCount: "ส่งออกแล้ว {count} รายการ",
    lastUpdated: "อัปเดตล่าสุด",
    sortNewest: "รายการที่อัปเดตล่าสุดอยู่ด้านบน",
    timezone: "เขตเวลา",
    localTimezone: "เขตเวลาท้องถิ่น",
    timezoneDescription: "เลือกเขตเวลาที่ใช้แสดงเวลาของ Registered event",
    showing: "แสดง",
    page: "หน้า",
  },
};

export type TranslationKey = keyof typeof common;
const STORAGE_KEY = "onchain-queue-language";
const browserLanguage = (): LanguageCode => {
  if (typeof navigator === "undefined") return "en";
  const candidates = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
  const found =
    candidates.find(item =>
      LANGUAGES.some(lang => item.toLowerCase().startsWith(lang.code))
    ) || "en";
  const code = found.toLowerCase().split("-")[0] as LanguageCode;
  return LANGUAGES.some(item => item.code === code) ? code : "en";
};
const LanguageContext = createContext<{
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}>({
  language: "en",
  setLanguage: () => undefined,
  t: key => translations.en[key],
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as LanguageCode | null;
      return saved && LANGUAGES.some(item => item.code === saved)
        ? saved
        : browserLanguage();
    } catch {
      return browserLanguage();
    }
  });
  const setLanguage = (next: LanguageCode) => setLanguageState(next);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);
  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: (key: TranslationKey, vars?: Record<string, string | number>) =>
        Object.entries(vars || {}).reduce(
          (text, [name, replacement]) =>
            text.replace(`{${name}}`, String(replacement)),
          translations[language][key] || translations.en[key]
        ),
    }),
    [language]
  );
  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
export function useLanguage() {
  return useContext(LanguageContext);
}
export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();
  const current =
    LANGUAGES.find(item => item.code === language) || LANGUAGES[0];
  return (
    <label
      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-600 shadow-sm"
      aria-label={t("language")}
    >
      <span aria-hidden="true">{current.flag}</span>
      <span className="sr-only">{t("language")}</span>
      <select
        value={language}
        onChange={event => setLanguage(event.target.value as LanguageCode)}
        className="cursor-pointer bg-transparent outline-none"
        aria-label={t("language")}
      >
        {LANGUAGES.map(item => (
          <option key={item.code} value={item.code}>
            {item.flag} {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}
