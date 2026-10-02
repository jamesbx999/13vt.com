import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Blocks,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clipboard,
  QrCode,
  Code2,
  Database,
  ExternalLink,
  FileCheck2,
  Gauge,
  GitBranch,
  LayoutDashboard,
  Loader2,
  Menu,
  RefreshCw,
  Search,
  ShieldCheck,
  Clock3,
  XCircle,
  Ticket,
  Wallet,
  X,
} from "lucide-react";
import Web3 from "web3";
import { QRCodeSVG } from "qrcode.react";
import {
  BSC_CHAIN_ID,
  AdminTransaction,
  AdminGasEstimate,
  ClaimTransaction,
  DEFAULT_CONTRACT_ADDRESS,
  formatToken,
  ClaimGasEstimate,
  QueueSnapshot,
  ReferralStatus,
  ReferralPathEvent,
  estimateAdminGas,
  estimateClaimGas,
  readClaimHistory,
  readAdminHistory,
  readReferralStatus,
  readReferralPathEvents,
  readDirectReferralCount,
  readQueueSnapshot,
  shortAddress,
  buildSignInMessage,
  verifyWalletSignature,
  submitReferralRegistration,
  submitAdminAction,
  submitReferralStake,
  submitClaim,
} from "@/lib/queue";
import { LanguageSwitcher, useLanguage } from "@/contexts/LanguageContext";
import { useTransactionJournal } from "@/contexts/TransactionJournalContext";
import { TestnetTransferPanel } from "@/components/TestnetTransferPanel";
import { FeeSimulationPanel } from "@/components/FeeSimulationPanel";
import { FifoQueueDashboard } from "@/components/FifoQueueDashboard";
import { EthersFifoTestnetPanel } from "@/components/EthersFifoTestnetPanel";
import {
  errorOutcome,
  isBscMainnet,
  receiptOutcome,
  type JournalStatus,
} from "@/lib/transactionJournal";
import {
  SettingsPanel,
  useAppToast,
  useSettings,
} from "@/contexts/SettingsContext";
import {
  ReferralPathPanel,
  ReferralTree,
  type ReferralTreeNode,
} from "@/components/ReferralTree";
import { ReferralSystemsPanel } from "@/components/ReferralSystemsPanel";

declare global {
  interface Window {
    ethereum?: any;
  }
}

const EXPLORER = "https://bscscan.com";
const OWNER_ADDRESS =
  import.meta.env.VITE_ONCHAIN_OWNER_WALLET ||
  "0x11B948575B648be50Eef781251ebdc876907E618";
const FEE_RECIPIENT = "0xE465e694E9194b848D597b21ce4104f9C36Fc6d2";
const SUGGESTED_REFERRER = OWNER_ADDRESS;
const SESSION_KEY = "onchain-queue-session";
const SESSION_TTL_MS = 30 * 60 * 1000;

function referralCodeFromUrl() {
  const code =
    new URLSearchParams(window.location.search).get("ref")?.trim() || "";
  if (Web3.utils.isAddress(code)) return code;
  return /^[A-Za-z0-9]{1,32}$/.test(code) ? code.toUpperCase() : "";
}
async function assertBscWriteNetwork(provider: any) {
  if (!provider?.request)
    throw new Error("ไม่พบ Wallet provider สำหรับส่งธุรกรรม");
  const chain = await provider.request({ method: "eth_chainId" });
  if (!isBscMainnet(chain))
    throw new Error(
      "โปรดเปลี่ยนกระเป๋าเป็น BNB Smart Chain (Chain ID 56) ก่อนส่งธุรกรรม"
    );
}
type TxStatus = "idle" | JournalStatus;
type AdminAction = "pause" | "unpause" | "registerFor";
const DEMO_ROWS: Array<{
  id: number;
  recipient: string;
  amount: string;
  status: string;
  block: string;
}> = [];

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = "teal",
}: {
  icon: any;
  label: string;
  value: string;
  detail?: string;
  tone?: "teal" | "amber" | "blue";
}) {
  const colors = {
    teal: "bg-teal-50 text-teal-700 ring-teal-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
  };
  return (
    <section className="metric-card group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-3 text-[clamp(1.35rem,2.4vw,2rem)] font-semibold tracking-tight text-slate-900">
            {value}
          </p>
          {detail && <p className="mt-1 text-xs text-slate-400">{detail}</p>}
        </div>
        <span
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ring-8 ${colors[tone]}`}
        >
          <Icon size={21} strokeWidth={2.1} />
        </span>
      </div>
    </section>
  );
}

function BlockchainMetricSkeleton() {
  return (
    <section
      className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)]"
      aria-hidden="true"
    >
      <div className="flex animate-pulse items-start justify-between gap-4 motion-reduce:animate-none">
        <div className="min-w-0 flex-1">
          <div className="h-3 w-24 rounded bg-slate-200" />
          <div className="mt-4 h-8 w-32 rounded bg-slate-200" />
          <div className="mt-2 h-2.5 w-20 rounded bg-slate-100" />
        </div>
        <div className="h-11 w-11 shrink-0 rounded-2xl bg-slate-100 ring-8 ring-slate-50" />
      </div>
    </section>
  );
}

function BlockchainLoadingBrand() {
  return (
    <div className="col-span-full flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm text-slate-600">
      <img
        src="/manus-storage/13vt-logo_da29a501.jpg"
        alt="13vt.com"
        className="h-9 w-9 rounded-xl object-cover shadow-sm"
      />
      <div>
        <p className="font-semibold text-slate-800">13vt.com</p>
        <p className="text-xs text-slate-500">
          Reading live data from BNB Smart Chain…
        </p>
      </div>
    </div>
  );
}

function BlockchainQueueRowSkeleton() {
  return (
    <tr className="animate-pulse motion-reduce:animate-none" aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => (
        <td key={index} className="px-5 py-4">
          <span
            className={`block h-3 rounded bg-slate-200 ${index === 5 ? "ml-auto w-20" : index === 1 ? "w-28" : "w-16"}`}
          />
        </td>
      ))}
    </tr>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { className: string; icon: any }> = {
    Claimed: {
      className: "bg-emerald-50 text-emerald-700 ring-emerald-100",
      icon: CheckCircle2,
    },
    Allocated: {
      className: "bg-blue-50 text-blue-700 ring-blue-100",
      icon: CircleDollarSign,
    },
    Waiting: {
      className: "bg-amber-50 text-amber-700 ring-amber-100",
      icon: Activity,
    },
  };
  const item = config[status] ?? config.Waiting;
  const Icon = item.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${item.className}`}
    >
      <Icon size={13} />
      {status}
    </span>
  );
}

function TransactionStatus({
  status,
  txHash,
  error,
}: {
  status: TxStatus;
  txHash: string;
  error: string;
}) {
  if (status === "idle") return null;
  const steps = [
    {
      key: "pending",
      label: "Pending",
      detail: "รอธุรกรรมได้รับการยืนยัน",
      icon: Clock3,
    },
    {
      key: "confirmed",
      label: "Confirmed",
      detail: "The transaction was recorded on-chain",
      icon: CheckCircle2,
    },
  ];
  const failed =
    status === "reverted" || status === "rejected" || status === "failed";
  const label =
    status === "awaiting_wallet"
      ? "รอยืนยันใน Wallet"
      : status === "pending"
        ? "รอ Receipt บนเชน"
        : status === "confirmed"
          ? "ยืนยันบนเชนแล้ว"
          : status === "reverted"
            ? "ธุรกรรม Reverted"
            : status === "rejected"
              ? "Wallet ปฏิเสธ"
              : status === "unknown"
                ? "ยังไม่ทราบผลบนเชน"
                : "ส่งไม่สำเร็จ";
  return (
    <div
      className={`rounded-2xl border p-4 ${failed ? "border-rose-200 bg-rose-50" : status === "confirmed" ? "border-emerald-200 bg-emerald-50" : "border-blue-200 bg-blue-50"}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${failed ? "bg-rose-100 text-rose-700" : status === "confirmed" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}
        >
          {failed ? (
            <XCircle size={18} />
          ) : status === "confirmed" ? (
            <CheckCircle2 size={18} />
          ) : status === "unknown" ? (
            <AlertTriangle size={18} />
          ) : (
            <Loader2 className="animate-spin" size={18} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p
              className={`text-sm font-bold ${failed ? "text-rose-900" : status === "confirmed" ? "text-emerald-900" : "text-blue-900"}`}
            >
              {label}
            </p>
            {txHash && (
              <a
                className="inline-flex items-center gap-1 text-xs font-semibold underline"
                href={`${EXPLORER}/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
              >
                View on Explorer <ExternalLink size={12} />
              </a>
            )}
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            {error ||
              (status === "unknown"
                ? "ตรวจ Hash บน Explorer ก่อนลองส่งซ้ำ"
                : status === "confirmed"
                  ? "อ่านยอดและสถานะจาก Smart Contract อีกครั้ง"
                  : status === "awaiting_wallet"
                    ? "ตรวจรายละเอียดใน Wallet ก่อนยืนยัน"
                    : status === "pending"
                      ? "Hash ไม่ใช่หลักฐานว่าสำเร็จ รอ Receipt ก่อน"
                      : "ตรวจสถานะบนเชนก่อนดำเนินการต่อ")}
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-[11px] font-semibold">
        {steps.map((step, index) => {
          const StepIcon = step.icon;
          const active =
            status === "pending"
              ? index === 0
              : status === "confirmed" && index <= 1;
          return (
            <div key={step.key} className="flex flex-1 items-center gap-2">
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${active ? (status === "confirmed" ? "bg-emerald-600 text-white" : "bg-blue-600 text-white") : "bg-white text-slate-400 ring-1 ring-slate-200"}`}
              >
                {active ? (
                  <StepIcon
                    size={13}
                    className={
                      status === "pending" && index === 0 ? "animate-pulse" : ""
                    }
                  />
                ) : (
                  <span>{index + 1}</span>
                )}
              </span>
              <span className={active ? "text-slate-700" : "text-slate-400"}>
                {step.label}
              </span>
              {index === 0 && (
                <span
                  className={`mx-1 h-px flex-1 ${status === "confirmed" ? "bg-emerald-300" : "bg-slate-200"}`}
                />
              )}
            </div>
          );
        })}
        {status === "reverted" && (
          <span className="ml-auto inline-flex items-center gap-1 text-rose-700">
            <XCircle size={13} /> Contract reverted
          </span>
        )}
      </div>
    </div>
  );
}

function Sidebar({
  active,
  onChange,
}: {
  active: string;
  onChange: (value: string) => void;
}) {
  const { t } = useLanguage();
  const items = [
    ["overview", t("dashboard"), LayoutDashboard],
    ["mine", "My queue", Ticket],
    ["revenue", "Allocated revenue", CircleDollarSign],
    ["transactions", "Transactions", Activity],
    ["contract", "Contract / ABI", Code2],
  ] as const;
  return (
    <aside className="hidden w-[238px] shrink-0 border-r border-slate-200/70 bg-white/70 px-3 py-7 lg:block">
      <div className="mb-10 flex items-center gap-3 px-3">
        <img
          src="/manus-storage/13vt-logo_da29a501.jpg"
          alt="13vt.com logo"
          className="brand-logo-image"
        />
        <div>
          <p className="text-sm font-bold tracking-tight text-slate-900">
            13vt.com
          </p>
          <p className="text-xs text-slate-400">Onchain protocol</p>
        </div>
      </div>
      <nav className="space-y-1.5" aria-label="เมนูหลัก">
        {items.map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`nav-item flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition ${active === key ? "bg-teal-50 text-teal-800 shadow-sm ring-1 ring-teal-100" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}
          >
            <Icon size={18} />
            {label}
            {active === key && <ChevronRight className="ml-auto" size={15} />}
          </button>
        ))}
      </nav>
      <div className="mt-10 rounded-2xl bg-slate-950 p-4 text-white shadow-xl shadow-slate-950/10">
        <div className="mb-3 flex items-center gap-2 text-teal-300">
          <Blocks size={16} />
          <span className="text-xs font-semibold">Read-only by default</span>
        </div>
        <p className="text-xs leading-5 text-slate-300">
          Reading is read-only. The separate Stake action requests token
          approval in your wallet; review the amount and contract first.
        </p>
      </div>
    </aside>
  );
}

export default function Home() {
  const { t } = useLanguage();
  const toast = useAppToast();
  const journal = useTransactionJournal();
  const { refreshInterval, isPageVisible, autoRefreshPaused } = useSettings();
  const [active, setActive] = useState("overview");
  const [contractAddress, setContractAddress] = useState(
    () =>
      new URLSearchParams(window.location.search).get("contract") ||
      DEFAULT_CONTRACT_ADDRESS
  );
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState<number | null>(null);
  const [snapshot, setSnapshot] = useState<QueueSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [readSuccessPulse, setReadSuccessPulse] = useState(false);
  const [error, setError] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [claimTicket, setClaimTicket] = useState<{
    id: number;
    amount: string;
    symbol: string;
    recipient: string;
  } | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimTxHash, setClaimTxHash] = useState("");
  const [claimStatus, setClaimStatus] = useState<TxStatus>("idle");

  const copyConnectedWallet = useCallback(async () => {
    if (!account) return;
    try {
      await navigator.clipboard.writeText(account);
      toast.success(t("walletAddressCopied"));
    } catch {
      toast.error(t("walletAddressCopyFailed"));
    }
  }, [account, t, toast]);
  const personalReferralLink = account
    ? `${window.location.origin}/?ref=${account}`
    : "";
  const copyPersonalReferralLink = useCallback(async () => {
    if (!personalReferralLink) return;
    try {
      await navigator.clipboard.writeText(personalReferralLink);
      toast.success("คัดลอกลิงก์ Referral แล้ว");
    } catch {
      toast.error("คัดลอกลิงก์ Referral ไม่สำเร็จ");
    }
  }, [personalReferralLink, toast]);
  const [claimError, setClaimError] = useState("");
  const [gasEstimate, setGasEstimate] = useState<ClaimGasEstimate | null>(null);
  const [gasEstimateStatus, setGasEstimateStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [gasEstimateError, setGasEstimateError] = useState("");
  const [history, setHistory] = useState<ClaimTransaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyFilter, setHistoryFilter] = useState("");
  const [referralStatus, setReferralStatus] = useState<ReferralStatus | null>(
    null
  );
  const [referralPathEvents, setReferralPathEvents] = useState<
    ReferralPathEvent[]
  >([]);
  const [referralPathLoading, setReferralPathLoading] = useState(false);
  const [referralPathError, setReferralPathError] = useState("");
  const [directReferralCount, setDirectReferralCount] = useState(0);
  const [directReferralError, setDirectReferralError] = useState("");
  const [referralStatusError, setReferralStatusError] = useState("");
  const [stakeOpen, setStakeOpen] = useState(false);
  const [staking, setStaking] = useState(false);
  const [stakeError, setStakeError] = useState("");
  const [stakeUnknown, setStakeUnknown] = useState(false);
  const [adminAction, setAdminAction] = useState<AdminAction | null>(null);
  const [adminUserAddress, setAdminUserAddress] = useState("");
  const [adminTxStatus, setAdminTxStatus] = useState<TxStatus>("idle");
  const [adminTxHash, setAdminTxHash] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminGasEstimate, setAdminGasEstimate] =
    useState<AdminGasEstimate | null>(null);
  const [adminGasStatus, setAdminGasStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [adminGasError, setAdminGasError] = useState("");
  const [adminHistory, setAdminHistory] = useState<AdminTransaction[]>([]);
  const [adminHistoryLoading, setAdminHistoryLoading] = useState(false);
  const [adminHistoryError, setAdminHistoryError] = useState("");
  const [adminActionFilter, setAdminActionFilter] = useState<
    "All" | AdminTransaction["action"]
  >("All");
  const [adminWalletFilter, setAdminWalletFilter] = useState("");
  const [signInOpen, setSignInOpen] = useState(false);
  const [signInStatus, setSignInStatus] = useState<
    "idle" | "signing" | "signed" | "error"
  >("idle");
  const [signInError, setSignInError] = useState("");
  const [referralCode, setReferralCode] = useState(referralCodeFromUrl);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const [registrationStatus, setRegistrationStatus] = useState<
    "idle" | "pending" | "confirmed" | "error"
  >("idle");
  const [registrationHash, setRegistrationHash] = useState("");
  const [registrationError, setRegistrationError] = useState("");
  const [nextRefreshAt, setNextRefreshAt] = useState<number | null>(null);
  const [secondsToRefresh, setSecondsToRefresh] =
    useState<number>(refreshInterval);
  const [highlightedTicketIds, setHighlightedTicketIds] = useState<number[]>(
    []
  );
  const previousTicketsRef = useRef<Record<string, string>>({});

  const provider = window.ethereum;
  const siweSession = trpc.siwe.session.useQuery();
  const siweNonce = trpc.siwe.requestNonce.useMutation();
  const siweVerify = trpc.siwe.verify.useMutation();
  const canAdmin = Boolean(
    referralStatus &&
      account &&
      (referralStatus.walletAdmin ||
        referralStatus.owner.toLowerCase() === account.toLowerCase())
  );
  const userTreeNodes = useMemo<ReferralTreeNode[]>(() => {
    if (!account) return [];
    const children: ReferralTreeNode[] = referralPathEvents.length
      ? referralPathEvents.map((event, index) => ({
          id: `${event.hash}-${index}`,
          label: `${t("registeredBy")} · ${shortAddress(event.registeredBy)}`,
          detail: `${t("ticket")} #${event.ticketId} · Block ${event.blockNumber} · ${shortAddress(event.hash)}`,
          tone: "branch",
        }))
      : referralStatus?.linkedReferrer &&
          referralStatus.linkedReferrer.toLowerCase() !==
            "0x0000000000000000000000000000000000000000"
        ? [
            {
              id: "registered-referrer",
              label: t("referrer"),
              detail: referralStatus.linkedReferrer,
              tone: "branch",
            },
          ]
        : [];
    return [
      {
        id: "current-user",
        label: t("userBranch"),
        detail: account,
        tone: "root",
        children,
      },
    ];
  }, [account, referralStatus, referralPathEvents, t]);

  useEffect(() => {
    if (
      !account ||
      !contractAddress ||
      !provider ||
      !isPageVisible ||
      autoRefreshPaused
    )
      return;
    let cancelled = false;
    const loadPath = async () => {
      setReferralPathLoading(true);
      setReferralPathError("");
      try {
        const [events, count] = await Promise.all([
          readReferralPathEvents(provider, contractAddress, account),
          readDirectReferralCount(provider, contractAddress, account),
        ]);
        if (!cancelled) {
          setReferralPathEvents(events);
          setDirectReferralCount(count);
          setDirectReferralError("");
        }
      } catch (error: any) {
        if (!cancelled) {
          setReferralPathError(error?.message || t("onchainReadError"));
          setDirectReferralError(error?.message || t("onchainReadError"));
        }
      } finally {
        if (!cancelled) setReferralPathLoading(false);
      }
    };
    void loadPath();
    const timer = window.setInterval(() => {
      void loadPath();
    }, refreshInterval * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    account,
    contractAddress,
    provider,
    isPageVisible,
    autoRefreshPaused,
    refreshInterval,
    t,
  ]);

  function clearSession(showToast = true) {
    setAccount("");
    setChainId(null);
    setSessionExpiresAt(null);
    setSignInStatus("idle");
    setReferralCode("");
    setRegistrationStatus("idle");
    localStorage.removeItem(SESSION_KEY);
    if (showToast)
      toast.success("Disconnected", { description: t("savedOnDevice") });
  }

  useEffect(() => {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw);
      if (
        !saved.expiresAt ||
        saved.expiresAt <= Date.now() ||
        !saved.address ||
        !verifyWalletSignature(
          saved.message || "",
          saved.signature || "",
          saved.address
        )
      ) {
        localStorage.removeItem(SESSION_KEY);
        return;
      }
      setSessionExpiresAt(saved.expiresAt);
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
  }, []);

  useEffect(() => {
    if (siweSession.isLoading) return;
    const raw = localStorage.getItem(SESSION_KEY);
    if (!siweSession.data?.address || !raw) {
      if (!siweSession.data?.address) {
        localStorage.removeItem(SESSION_KEY);
        setAccount("");
        setSignInStatus("idle");
      }
      return;
    }
    try {
      const saved = JSON.parse(raw);
      if (
        saved.address?.toLowerCase() !== siweSession.data.address.toLowerCase()
      )
        throw new Error("Wallet session mismatch");
      setAccount(siweSession.data.address);
      setChainId(saved.chainId || null);
      setSessionExpiresAt(saved.expiresAt || null);
      setSignInStatus("signed");
    } catch {
      clearSession(false);
    }
  }, [siweSession.isLoading, siweSession.data?.address]);

  useEffect(() => {
    if (!provider?.on) return;
    const onAccountsChanged = (accounts: string[]) => {
      if (!accounts?.[0] || accounts[0].toLowerCase() !== account.toLowerCase())
        clearSession(false);
    };
    const onChainChanged = (hexChainId: string) =>
      setChainId(Number.parseInt(hexChainId, 16));
    provider.on("accountsChanged", onAccountsChanged);
    provider.on("chainChanged", onChainChanged);
    return () => {
      provider.removeListener?.("accountsChanged", onAccountsChanged);
      provider.removeListener?.("chainChanged", onChainChanged);
    };
  }, [provider, account]);

  useEffect(() => {
    if (!sessionExpiresAt) return;
    const remaining = sessionExpiresAt - Date.now();
    if (remaining <= 0) {
      clearSession(false);
      toast.info("Session expired", { description: t("signInFailed") });
      return;
    }
    const timer = window.setTimeout(() => {
      clearSession(false);
      toast.info("Session expired", { description: t("signInFailed") });
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [sessionExpiresAt]);

  const connectWallet = useCallback(async () => {
    if (!provider) {
      toast.error(t("walletNotFound"), {
        description: "ติดตั้ง MetaMask หรือเปิดเว็บในกระเป๋าที่รองรับ EIP-1193",
      });
      return;
    }
    try {
      const accounts = await provider.request({
        method: "eth_requestAccounts",
      });
      const currentChain = Number.parseInt(
        await provider.request({ method: "eth_chainId" }),
        16
      );
      setAccount(accounts?.[0] || "");
      setChainId(currentChain);
      toast.success(t("walletConnected"), {
        description:
          currentChain === BSC_CHAIN_ID
            ? t("onchainUpdated")
            : t("checkContractAndAbi"),
      });
    } catch (walletError: any) {
      toast.error(t("walletConnectFailed"), {
        description:
          walletError?.message || "ผู้ใช้ยกเลิกหรือกระเป๋าไม่ตอบสนอง",
      });
    }
  }, [provider]);

  async function signInWithWallet() {
    if (!provider) {
      setSignInStatus("error");
      setSignInError("ไม่พบกระเป๋าที่รองรับการเชื่อมต่อ");
      return;
    }
    setSignInStatus("signing");
    setSignInError("");
    toast.info(t("signingIn"), { description: t("readOnlyDashboard") });
    try {
      const accounts = await provider.request({
        method: "eth_requestAccounts",
      });
      const wallet = accounts?.[0] || "";
      if (!wallet) throw new Error("ไม่พบ Wallet Address");
      const currentChain = Number.parseInt(
        await provider.request({ method: "eth_chainId" }),
        16
      );
      const currentOrigin = window.location.origin;
      const nonceResponse = await siweNonce.mutateAsync({
        address: wallet,
        domain: window.location.host,
        uri: currentOrigin,
        chainId: currentChain,
      });
      const message = nonceResponse.message;
      const signature = await provider.request({
        method: "personal_sign",
        params: [message, wallet],
      });
      if (!verifyWalletSignature(message, signature, wallet))
        throw new Error("ตรวจสอบลายเซ็นไม่ผ่าน");
      const verified = await siweVerify.mutateAsync({
        address: wallet,
        message,
        signature,
      });
      setAccount(wallet);
      setChainId(currentChain);
      setSessionExpiresAt(Date.parse(verified.expiresAt));
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          address: wallet,
          chainId: currentChain,
          message,
          signature,
          expiresAt: Date.parse(verified.expiresAt),
        })
      );
      setSignInStatus("signed");
      toast.success(t("signInSuccess"), {
        description:
          currentChain === BSC_CHAIN_ID
            ? "ยืนยันตัวตนแล้วบน BNB Smart Chain"
            : "ยืนยันตัวตนแล้ว — โปรดเปลี่ยนเป็น BNB Smart Chain ก่อนทำธุรกรรม",
      });
    } catch (walletError: any) {
      setSignInStatus("error");
      setSignInError(
        walletError?.message || "ผู้ใช้ยกเลิกการเชื่อมต่อหรือเซ็นข้อความ"
      );
      toast.error(t("signInFailed"), {
        description: walletError?.message || t("walletConnectFailed"),
      });
    }
  }

  async function registerReferralOnchain() {
    const normalizedContractAddress = contractAddress.trim();
    let wallet = account;
    if (!wallet && provider) {
      const accounts = await provider.request({ method: "eth_accounts" });
      wallet = accounts?.[0] || "";
      if (wallet) setAccount(wallet);
    }
    if (!wallet || !Web3.utils.isAddress(normalizedContractAddress)) {
      setRegistrationStatus("error");
      setRegistrationError(
        "ต้องเชื่อมต่อ Wallet และกรอก Contract Address ที่ถูกต้องก่อน"
      );
      return;
    }
    const trackingId = journal.start(t("registrationPreparing"));
    let broadcastHash = "";
    let minedOutcome: ReturnType<typeof receiptOutcome> = null;
    setRegistrationHash("");
    setRegistrationStatus("pending");
    setRegistrationError("");
    toast.info(t("registrationPreparing"), {
      description: t("reviewBeforeSend"),
    });
    try {
      await assertBscWriteNetwork(provider);
      const receipt = await submitReferralRegistration(
        provider,
        normalizedContractAddress,
        wallet,
        SUGGESTED_REFERRER,
        referralCode,
        (step, stage, value) => {
          if (stage === "hash" && typeof value === "string") {
            broadcastHash = value;
            setRegistrationHash(value);
            journal.sent(trackingId, value);
            toast.info(
              step === "approval"
                ? "Approve USDT สำเร็จ กำลังเตรียม Register"
                : "Register อยู่ระหว่างยืนยันบน BSC Mainnet",
              { description: shortAddress(value) }
            );
          }
        }
      );
      minedOutcome = receiptOutcome(receipt);
      journal.receipt(trackingId, receipt);
      if (minedOutcome !== "confirmed")
        throw new Error("Contract ไม่ยืนยันการลงทะเบียน");
      setRegistrationStatus("confirmed");
      toast.success(t("registrationConfirmed"), {
        description: t("registrationConfirmed"),
      });
      await loadOnchain();
    } catch (registrationWriteError: any) {
      journal.error(trackingId, registrationWriteError);
      setRegistrationStatus("error");
      setRegistrationError(
        minedOutcome === "reverted"
          ? "Contract Revert: ลงทะเบียนไม่สำเร็จ"
          : broadcastHash
            ? "ผลหลังส่งยังไม่ชัดเจน: ตรวจ Hash บน Explorer ก่อนส่งซ้ำ"
            : registrationWriteError?.message ||
              "ไม่สามารถลงทะเบียน Referral ได้"
      );
      toast.error(t("registrationFailed"), {
        description:
          registrationWriteError?.message || t("checkContractAndAbi"),
      });
    }
  }

  const loadOnchain = useCallback(
    async (notify = true) => {
      if (!provider) {
        setError(t("walletNotFound"));
        return;
      }
      if (!Web3.utils.isAddress(contractAddress)) {
        setError(t("checkContractAndAbi"));
        return;
      }
      setLoading(true);
      setError("");
      try {
        const currentChain = Number.parseInt(
          await provider.request({ method: "eth_chainId" }),
          16
        );
        setChainId(currentChain);
        if (currentChain !== BSC_CHAIN_ID)
          throw new Error(t("checkContractAndAbi"));
        const next = await readQueueSnapshot(provider, contractAddress);
        const nextTickets = Object.fromEntries(
          next.tickets.map(ticket => [
            String(ticket.id),
            `${ticket.recipient}:${ticket.amount}:${ticket.claimed}`,
          ])
        );
        const previousTickets = previousTicketsRef.current;
        const changedTickets = Object.keys(nextTickets)
          .filter(
            id =>
              previousTickets[id] !== undefined &&
              previousTickets[id] !== nextTickets[id]
          )
          .map(Number);
        previousTicketsRef.current = nextTickets;
        if (changedTickets.length) {
          setHighlightedTicketIds(changedTickets);
          window.setTimeout(
            () =>
              setHighlightedTicketIds(current =>
                current.filter(id => !changedTickets.includes(id))
              ),
            2200
          );
        }
        setSnapshot(next);
        setReadSuccessPulse(true);
        window.setTimeout(() => setReadSuccessPulse(false), 1400);
        setHistoryLoading(true);
        setHistoryError("");
        try {
          setHistory(await readClaimHistory(provider, contractAddress));
        } catch (historyReadError: any) {
          setHistory([]);
          setHistoryError(historyReadError?.message || t("onchainReadError"));
        } finally {
          setHistoryLoading(false);
        }
        setAdminHistoryLoading(true);
        setAdminHistoryError("");
        try {
          setAdminHistory(await readAdminHistory(provider, contractAddress));
        } catch (adminHistoryReadError: any) {
          setAdminHistory([]);
          setAdminHistoryError(
            adminHistoryReadError?.message || t("onchainReadError")
          );
        } finally {
          setAdminHistoryLoading(false);
        }
        try {
          setReferralStatusError("");
          setReferralStatus(
            await readReferralStatus(
              provider,
              contractAddress,
              account,
              SUGGESTED_REFERRER
            )
          );
        } catch (referralReadError: any) {
          setReferralStatus(null);
          setReferralStatusError(
            referralReadError?.message || t("onchainReadError")
          );
        }
        if (notify)
          toast.success(t("onchainUpdated"), {
            description: t("blockUpdated", {
              block: next.blockNumber.toLocaleString(),
            }),
          });
      } catch (readError: any) {
        setSnapshot(null);
        setReadSuccessPulse(false);
        setError(readError?.message || "อ่านข้อมูลจาก Contract ไม่สำเร็จ");
        if (notify)
          toast.error(t("onchainReadError"), {
            description: readError?.message || t("checkContractAndAbi"),
          });
      } finally {
        setLoading(false);
      }
    },
    [account, contractAddress, provider, t, toast]
  );

  useEffect(() => {
    if (!provider || !isPageVisible || autoRefreshPaused) {
      setNextRefreshAt(null);
      return;
    }
    const scheduleNext = () =>
      setNextRefreshAt(Date.now() + refreshInterval * 1000);
    scheduleNext();
    const timer = window.setInterval(() => {
      void loadOnchain(false);
      scheduleNext();
    }, refreshInterval * 1000);
    return () => window.clearInterval(timer);
  }, [
    autoRefreshPaused,
    isPageVisible,
    loadOnchain,
    provider,
    refreshInterval,
  ]);

  useEffect(() => {
    if (!nextRefreshAt || !isPageVisible) return;
    const update = () =>
      setSecondsToRefresh(
        Math.max(0, Math.ceil((nextRefreshAt - Date.now()) / 1000))
      );
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [isPageVisible, nextRefreshAt]);

  const refreshProgress = nextRefreshAt
    ? Math.max(0, Math.min(100, (secondsToRefresh / refreshInterval) * 100))
    : 0;

  useEffect(() => {
    if (!provider) return;
    const onAccounts = (accounts: string[]) => setAccount(accounts?.[0] || "");
    const onChain = (hex: string) => setChainId(Number.parseInt(hex, 16));
    provider.on?.("accountsChanged", onAccounts);
    provider.on?.("chainChanged", onChain);
    provider
      .request({ method: "eth_accounts" })
      .then((accounts: string[]) => setAccount(accounts?.[0] || ""))
      .catch(() => undefined);
    provider
      .request({ method: "eth_chainId" })
      .then((hex: string) => setChainId(Number.parseInt(hex, 16)))
      .catch(() => undefined);
    return () => {
      provider.removeListener?.("accountsChanged", onAccounts);
      provider.removeListener?.("chainChanged", onChain);
    };
  }, [provider]);

  useEffect(() => {
    if (!claimTicket || !provider || !account) return;
    let cancelled = false;
    setGasEstimate(null);
    setGasEstimateStatus("loading");
    setGasEstimateError("");
    estimateClaimGas(provider, contractAddress, claimTicket.id, account)
      .then(estimate => {
        if (cancelled) return;
        setGasEstimate(estimate);
        setGasEstimateStatus("ready");
      })
      .catch((estimateError: any) => {
        if (cancelled) return;
        setGasEstimateStatus("error");
        setGasEstimateError(
          estimateError?.message || "ไม่สามารถคำนวณค่า Gas ได้"
        );
      });
    return () => {
      cancelled = true;
    };
  }, [account, claimTicket, contractAddress, provider]);

  useEffect(() => {
    if (!adminAction || !provider || !account || !canAdmin) return;
    let cancelled = false;
    setAdminGasEstimate(null);
    setAdminGasStatus("loading");
    setAdminGasError("");
    estimateAdminGas(
      provider,
      contractAddress,
      account,
      adminAction,
      adminUserAddress
    )
      .then(estimate => {
        if (cancelled) return;
        setAdminGasEstimate(estimate);
        setAdminGasStatus("ready");
      })
      .catch((estimateError: any) => {
        if (cancelled) return;
        setAdminGasStatus("error");
        setAdminGasError(
          estimateError?.message || "ไม่สามารถคำนวณค่า Gas ของ Admin action ได้"
        );
      });
    return () => {
      cancelled = true;
    };
  }, [
    account,
    adminAction,
    adminUserAddress,
    canAdmin,
    contractAddress,
    provider,
  ]);

  const rows = useMemo(() => {
    if (!snapshot) return DEMO_ROWS;
    return snapshot.tickets.map(ticket => ({
      id: ticket.id,
      recipient: shortAddress(ticket.recipient),
      amount:
        ticket.amount === "0"
          ? "—"
          : formatToken(ticket.amount, snapshot.decimals),
      status: ticket.claimed
        ? "Claimed"
        : ticket.amount === "0"
          ? "Waiting"
          : "Allocated",
      block: `อ่านจาก ${snapshot.blockNumber.toLocaleString()}`,
      address: ticket.recipient,
      isOwner: Boolean(
        account && ticket.recipient.toLowerCase() === account.toLowerCase()
      ),
    }));
  }, [account, snapshot]);

  const symbol = snapshot?.symbol || "BSC-USD";
  const filteredHistory = useMemo(() => {
    const query = historyFilter.trim().toLowerCase().replace(/^#/, "");
    if (!query) return history;
    return history.filter(
      item =>
        item.ticketId.toLowerCase() === query ||
        item.ticketId.toLowerCase().includes(query) ||
        item.recipient.toLowerCase().includes(query)
    );
  }, [history, historyFilter]);
  const filteredAdminHistory = useMemo(() => {
    const walletQuery = adminWalletFilter.trim().toLowerCase();
    return adminHistory.filter(item => {
      const matchesAction =
        adminActionFilter === "All" || item.action === adminActionFilter;
      const matchesWallet =
        !walletQuery ||
        item.actor.toLowerCase().includes(walletQuery) ||
        item.subject.toLowerCase().includes(walletQuery);
      return matchesAction && matchesWallet;
    });
  }, [adminActionFilter, adminHistory, adminWalletFilter]);
  const metrics = snapshot
    ? {
        tickets: snapshot.registered.toLocaleString(),
        waiting: snapshot.waiting.toLocaleString(),
        balance: `${formatToken(snapshot.balance, snapshot.decimals)} ${symbol}`,
        claimed: `${formatToken(snapshot.claimed, snapshot.decimals)} ${symbol}`,
      }
    : {
        tickets: "0",
        waiting: "0",
        balance: "0 BSC-USD",
        claimed: "0 BSC-USD",
      };

  function explorerAddress(address: string) {
    if (!Web3.utils.isAddress(address)) return;
    window.open(
      `${EXPLORER}/address/${address}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function openClaim(ticket: {
    id: number;
    amount: string;
    recipient?: string;
    isOwner?: boolean;
  }) {
    if (!snapshot || !account) {
      toast.info("เชื่อมต่อกระเป๋าก่อน Claim", {
        description:
          "การอ่านข้อมูลทำได้แบบ read-only แต่การ Claim ต้องใช้บัญชีRecipient",
      });
      return;
    }
    if (referralStatus?.paused) {
      toast.error("Contract ถูก Pause", {
        description: "Owner ต้องเรียก Unpause ก่อนจึงจะ Claim ได้",
      });
      return;
    }
    if (!ticket.isOwner || !ticket.recipient) {
      toast.error("กระเป๋านี้ไม่ใช่เจ้าของ Ticket", {
        description: "Claim ได้เฉพาะ address Recipientที่บันทึกไว้ใน Contract",
      });
      return;
    }
    setClaimTxHash("");
    setClaimStatus("idle");
    setClaimError("");
    setGasEstimate(null);
    setGasEstimateStatus("loading");
    setGasEstimateError("");
    setClaimTicket({
      id: ticket.id,
      amount: formatToken(ticket.amount, snapshot.decimals),
      symbol: snapshot.symbol,
      recipient: ticket.recipient,
    });
  }

  async function confirmClaim() {
    if (!claimTicket || !account) return;
    if (gasEstimateStatus !== "ready") {
      toast.error("ยังคำนวณค่า Gas ไม่เสร็จ", {
        description: "กรุณารอการประเมินค่า Gas หรือกดลองใหม่ก่อนยืนยัน",
      });
      return;
    }
    setClaiming(true);
    setClaimStatus("awaiting_wallet");
    setClaimError("");
    const trackingId = journal.start(`Claim ticket #${claimTicket.id}`);
    let sentHash = "";
    let receiptSeen = false;
    try {
      await assertBscWriteNetwork(provider);
      const transaction: any = submitClaim(
        provider,
        contractAddress,
        claimTicket.id,
        account
      );
      transaction.on("transactionHash", (hash: string) => {
        sentHash = hash;
        journal.sent(trackingId, hash);
        setClaimTxHash(hash);
        setClaimStatus("pending");
        toast.info("ธุรกรรมอยู่ระหว่าง Pending", {
          description: `รอการยืนยัน: ${shortAddress(hash)}`,
        });
      });
      transaction.on("receipt", async (receipt: any) => {
        receiptSeen = true;
        journal.receipt(trackingId, receipt);
        const outcome = receiptOutcome(receipt);
        if (outcome === "reverted") {
          setClaimStatus("reverted");
          setClaimError(
            "Contract คืนค่าไม่สำเร็จ ธุรกรรมไม่ได้เปลี่ยนStatus Ticket"
          );
          toast.error("ธุรกรรม Reverted");
        } else if (outcome === "confirmed") {
          setClaimStatus("confirmed");
          setClaiming(false);
          toast.success("ธุรกรรม Confirmed", {
            description: "Claim ถูกบันทึกบน BNB Smart Chain แล้ว",
          });
          await loadOnchain();
        } else {
          setClaimStatus("unknown");
          setClaimError("Receipt ไม่มีสถานะที่ตรวจสอบได้ กรุณาตรวจบน Explorer");
        }
        setClaiming(false);
      });
      transaction.on("error", (transactionError: any) => {
        if (receiptSeen) return;
        journal.error(trackingId, transactionError);
        const message =
          transactionError?.message ||
          "ผู้ใช้ยกเลิกหรือ Contract revert ธุรกรรม";
        setClaimStatus(errorOutcome(Boolean(sentHash), transactionError));
        setClaimError(message);
        setClaiming(false);
        toast.error(sentHash ? "ยังตรวจผลบนเชนไม่ได้" : "ส่งธุรกรรมไม่สำเร็จ", {
          description: message,
        });
      });
    } catch (claimError: any) {
      const message = claimError?.message || "ไม่สามารถเริ่มธุรกรรมได้";
      journal.error(trackingId, claimError);
      setClaimStatus(errorOutcome(Boolean(sentHash), claimError));
      setClaimError(message);
      setClaiming(false);
      toast.error("เริ่มธุรกรรมไม่สำเร็จ", { description: message });
    }
  }

  function retryGasEstimate() {
    if (claimTicket) setClaimTicket({ ...claimTicket });
  }

  async function confirmReferralStake() {
    if (stakeUnknown) return;
    if (
      !provider ||
      !snapshot ||
      !referralStatus ||
      !account ||
      referralStatus.paused
    )
      return;
    setStaking(true);
    setStakeError("");
    let approvalId = "";
    let stakeId = "";
    let lastStep: "approval" | "stake" = "approval";
    let uncertainHash = "";
    try {
      await assertBscWriteNetwork(provider);
      const totalDue = (
        BigInt(referralStatus.requiredStake) + BigInt(referralStatus.feeAmount)
      ).toString();
      await submitReferralStake(
        provider,
        snapshot.asset,
        contractAddress,
        account,
        totalDue,
        (step, stage, value) => {
          lastStep = step;
          if (stage === "wallet") {
            uncertainHash = "";
            if (step === "approval")
              approvalId = journal.start("Token approval");
            else stakeId = journal.start("Stake Referral");
          }
          const id = step === "approval" ? approvalId : stakeId;
          if (id && stage === "hash" && typeof value === "string") {
            uncertainHash = value;
            journal.sent(id, value);
          }
          if (id && stage === "receipt") {
            journal.receipt(id, value);
            uncertainHash = "";
          }
        }
      );
      setStakeOpen(false);
      toast.success("Stake Referral สำเร็จ", {
        description: "ระบบจะอ่านStatus Referral ใหม่จาก Smart Contract",
      });
      await loadOnchain();
    } catch (stakeWriteError: any) {
      const id = lastStep === "approval" ? approvalId : stakeId;
      if (id) journal.error(id, stakeWriteError);
      if (uncertainHash) setStakeUnknown(true);
      setStakeError(
        uncertainHash
          ? "ยังไม่ทราบผลหลังส่ง: ตรวจ Hash ในหน้าสถานะธุรกรรมหรือ Explorer ก่อนทำซ้ำ"
          : stakeWriteError?.message ||
              "Stake ไม่สำเร็จหรือผู้ใช้ยกเลิกใน MetaMask"
      );
    } finally {
      setStaking(false);
    }
  }

  function openAdminAction(action: AdminAction) {
    if (!canAdmin) {
      toast.error("ไม่มีสิทธิ์ Admin", {
        description: "เชื่อมต่อ Owner หรือกระเป๋าที่ถูกกำหนดเป็น Admin ก่อน",
      });
      return;
    }
    setAdminAction(action);
    setAdminTxStatus("idle");
    setAdminTxHash("");
    setAdminError("");
    setAdminGasEstimate(null);
    setAdminGasStatus("loading");
    setAdminGasError("");
  }

  async function confirmAdminAction() {
    if (!adminAction || !account || !canAdmin) return;
    if (adminTxStatus === "unknown" && adminTxHash) return;
    if (
      adminAction === "registerFor" &&
      !Web3.utils.isAddress(adminUserAddress)
    ) {
      setAdminError("กรอก Wallet ผู้ใช้เป็น Address ที่ถูกต้องก่อนส่งธุรกรรม");
      return;
    }
    if (adminGasStatus !== "ready" || !adminGasEstimate) {
      setAdminError("กรุณารอการคำนวณ Gas ให้เสร็จก่อนยืนยันธุรกรรม");
      return;
    }
    setAdminTxStatus("awaiting_wallet");
    setAdminTxHash("");
    setAdminError("");
    const trackingId = journal.start(`Admin: ${adminAction}`);
    let sentHash = "";
    let receiptSeen = false;
    try {
      await assertBscWriteNetwork(provider);
      const transaction: any = submitAdminAction(
        provider,
        contractAddress,
        account,
        adminAction,
        adminUserAddress,
        adminGasEstimate.bufferedGasUnits
      );
      transaction.on("transactionHash", (hash: string) => {
        sentHash = hash;
        journal.sent(trackingId, hash);
        setAdminTxHash(hash);
        setAdminTxStatus("pending");
        toast.info("Admin transaction อยู่ระหว่าง Pending", {
          description: shortAddress(hash),
        });
      });
      transaction.on("receipt", async (receipt: any) => {
        receiptSeen = true;
        journal.receipt(trackingId, receipt);
        const outcome = receiptOutcome(receipt);
        if (outcome === "reverted") {
          setAdminTxStatus("reverted");
          setAdminError(
            "Contract คืนค่าไม่สำเร็จ ธุรกรรม Admin ไม่ได้เปลี่ยนStatus"
          );
          toast.error("Admin transaction Reverted");
        } else if (outcome === "confirmed") {
          setAdminTxStatus("confirmed");
          toast.success("Admin transaction Confirmed", {
            description: "Status Contract จะถูกอ่านใหม่จากเชน",
          });
          await loadOnchain();
        } else {
          setAdminTxStatus("unknown");
          setAdminError("Receipt ไม่มีสถานะที่ตรวจสอบได้ กรุณาตรวจบน Explorer");
        }
      });
      transaction.on("error", (transactionError: any) => {
        if (receiptSeen) return;
        journal.error(trackingId, transactionError);
        setAdminTxStatus(errorOutcome(Boolean(sentHash), transactionError));
        setAdminError(
          sentHash
            ? "ยังไม่ทราบผล: ตรวจ Hash บน Explorer ก่อนส่งซ้ำ"
            : transactionError?.message || "ผู้ใช้ยกเลิกธุรกรรม"
        );
      });
    } catch (adminWriteError: any) {
      journal.error(trackingId, adminWriteError);
      setAdminTxStatus(errorOutcome(Boolean(sentHash), adminWriteError));
      setAdminError(
        sentHash
          ? "ยังไม่ทราบผล: ตรวจ Hash บน Explorer ก่อนส่งซ้ำ"
          : adminWriteError?.message || "ไม่สามารถเริ่มธุรกรรม Admin ได้"
      );
    }
  }

  function retryAdminGas() {
    if (!adminAction) return;
    setAdminGasStatus("loading");
    setAdminGasEstimate(null);
    setAdminGasError("");
    setAdminAction(null);
    window.setTimeout(() => setAdminAction(adminAction), 0);
  }

  return (
    <div className="min-h-screen bg-[#f6f9fb] text-slate-900">
      <div className="flex min-h-screen">
        <Sidebar active={active} onChange={setActive} />
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-slate-950/30 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
        {mobileOpen && (
          <div className="fixed inset-y-0 left-0 z-50 w-[260px] bg-white p-4 shadow-2xl lg:hidden">
            <button
              className="mb-6 ml-auto grid h-10 w-10 place-items-center rounded-xl hover:bg-slate-100"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X size={19} />
            </button>
            <Sidebar
              active={active}
              onChange={next => {
                setActive(next);
                setMobileOpen(false);
              }}
            />
          </div>
        )}

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-[#f6f9fb]/90 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-10">
            <div className="mx-auto flex max-w-[1440px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="flex items-center gap-3">
                <button
                  className="grid h-10 w-10 place-items-center rounded-xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 lg:hidden"
                  onClick={() => setMobileOpen(true)}
                  aria-label="เClose menu"
                >
                  <Menu size={19} />
                </button>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
                    Transparency layer
                  </p>
                  <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
                    Onchain Queue Dashboard
                  </h1>
                </div>
              </div>
              <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-2 sm:w-auto sm:gap-3">
                <LanguageSwitcher />
                <SettingsPanel />
                <span
                  className="hidden min-w-[118px] rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-500 lg:inline-flex lg:flex-col lg:gap-1"
                  title={
                    autoRefreshPaused || !isPageVisible
                      ? t("refreshPaused")
                      : t("nextRefresh", { seconds: secondsToRefresh })
                  }
                >
                  <span className="flex items-center gap-1">
                    {autoRefreshPaused || !isPageVisible
                      ? t("refreshPaused")
                      : t("nextRefresh", { seconds: secondsToRefresh })}
                  </span>
                  <span className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <span
                      className={`block h-full rounded-full bg-teal-500 transition-[width] duration-1000 ${autoRefreshPaused || !isPageVisible ? "w-0" : ""}`}
                      style={{
                        width:
                          autoRefreshPaused || !isPageVisible
                            ? "0%"
                            : `${refreshProgress}%`,
                      }}
                    />
                  </span>
                </span>
                <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 sm:flex">
                  <span className="h-2 w-2 rounded-full bg-amber-400" /> BNB
                  Smart Chain <span className="text-slate-300">•</span> Chain ID
                  56
                </div>
                <div
                  className={`hidden items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-semibold sm:flex ${chainId === BSC_CHAIN_ID ? "border-emerald-200 text-emerald-700" : "border-slate-200 text-slate-500"}`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${chainId === BSC_CHAIN_ID ? "bg-emerald-500" : "bg-slate-300"}`}
                  />{" "}
                  {chainId === BSC_CHAIN_ID
                    ? "Correct network"
                    : "Read from Smart Contract"}
                </div>
                {account.toLowerCase() === OWNER_ADDRESS.toLowerCase() && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      window.location.href = "/owner";
                    }}
                    className="hidden gap-2 rounded-xl border-teal-200 text-teal-700 sm:inline-flex"
                  >
                    <ShieldCheck size={15} /> Owner
                  </Button>
                )}
                <div
                  className={`action-tooltip wallet-button-shell ml-auto sm:ml-0 ${signInStatus === "signing" ? "is-connecting" : account ? "is-connected" : signInStatus === "error" ? "is-error" : ""}`}
                  data-tooltip={
                    signInStatus === "signing"
                      ? "กำลังเชื่อมต่อและรอการยืนยันจาก Wallet"
                      : account
                        ? "เชื่อมต่อ Wallet แล้ว"
                        : signInStatus === "error"
                          ? "การเชื่อมต่อไม่สำเร็จ — คลิกเพื่อเชื่อมต่อใหม่"
                          : "ยังไม่ได้เชื่อมต่อ Wallet — คลิกเพื่อเริ่มต้น"
                  }
                  tabIndex={0}
                  data-connection-state={
                    signInStatus === "signing"
                      ? "connecting"
                      : account
                        ? "connected"
                        : signInStatus === "error"
                          ? "error"
                          : "idle"
                  }
                >
                  <span className="light" aria-hidden="true" />
                  {[25, 15.9, 26.4, 17.8, 19.2, 29.2, 20.2].map(
                    (duration, index) => (
                      <span
                        key={`wallet-gradient-${index}`}
                        className="gradient-layer"
                        style={{
                          animationDelay: `${[0, 0.15, 0.53, 0.45, 1.6, 1.6, 1.6][index]}s`,
                          animationDuration: `${duration}s`,
                        }}
                        aria-hidden="true"
                      />
                    )
                  )}
                  <Button
                    onClick={() =>
                      account
                        ? (() => {
                            setSignInOpen(true);
                            setSignInError("");
                          })()
                        : (() => {
                            setSignInOpen(true);
                            setSignInStatus("idle");
                            setSignInError("");
                          })()
                    }
                    className="wallet-gradient-button gap-2 px-4 text-white hover:bg-slate-800"
                    title={
                      account
                        ? `เปิดหน้าสมัครสำหรับ ${account}`
                        : "Connect wallet"
                    }
                    aria-label={
                      account
                        ? `Connected wallet ${shortAddress(account)}`
                        : "Connect wallet"
                    }
                  >
                    <Wallet size={16} />
                    {signInStatus === "signing"
                      ? "Connecting…"
                      : account
                        ? shortAddress(account)
                        : signInStatus === "error"
                          ? "Retry connection"
                          : "Connect wallet"}
                  </Button>
                </div>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-[1440px] space-y-6 px-4 pb-24 pt-6 sm:px-6 lg:px-10 lg:py-8">
            <section className="hero-panel relative overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-2xl shadow-slate-950/10 sm:p-8">
              <div className="hero-glow absolute -right-24 -top-28 h-72 w-72 rounded-full bg-teal-400/20 blur-3xl" />
              <div className="relative max-w-3xl">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <Badge className="border border-teal-300/20 bg-teal-300/10 text-teal-200 hover:bg-teal-300/10">
                    Read from Smart Contract โดยตรง
                  </Badge>
                  <Badge className="border border-white/10 bg-white/5 text-slate-300 hover:bg-white/5">
                    Read-only dashboard
                  </Badge>
                </div>
                <h2 className="max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">
                  Verify the queue and allocated revenue from on-chain data
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                  Connect MetaMask to read the selected Contract without token
                  approval. The separate Stake action asks for approval in your
                  wallet. No returns are guaranteed.
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                    <Code2 size={17} className="shrink-0 text-teal-300" />
                    <input
                      value={contractAddress}
                      onChange={event =>
                        setContractAddress(event.target.value.trim())
                      }
                      placeholder="Enter a verified Contract Address"
                      className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                      aria-label="Contract Address"
                    />
                  </div>
                  <div
                    className={`action-tooltip gradient-action-shell wallet-button-shell ${loading ? "is-reading" : error ? "is-error" : readSuccessPulse ? "is-success" : ""}`}
                    data-tooltip={
                      loading
                        ? "กำลังอ่านข้อมูลจาก BNB Smart Chain"
                        : error
                          ? "อ่านข้อมูลไม่สำเร็จ — คลิก Retry เพื่ออ่านใหม่"
                          : readSuccessPulse
                            ? "อ่านข้อมูลจาก Blockchain สำเร็จ"
                            : "คลิกเพื่ออ่านข้อมูลล่าสุดจาก Smart Contract"
                    }
                    tabIndex={0}
                    data-read-state={
                      loading ? "reading" : error ? "error" : "ready"
                    }
                  >
                    <span className="light" aria-hidden="true" />
                    {[25, 15.9, 26.4, 17.8, 19.2, 29.2, 20.2].map(
                      (duration, index) => (
                        <span
                          key={`read-gradient-${index}`}
                          className="gradient-layer"
                          style={{
                            animationDelay: `${[0, 0.15, 0.53, 0.45, 1.6, 1.6, 1.6][index]}s`,
                            animationDuration: `${duration}s`,
                          }}
                          aria-hidden="true"
                        />
                      )
                    )}
                    <Button
                      onClick={() => void loadOnchain()}
                      disabled={loading}
                      className="wallet-gradient-button gap-2 px-5 font-bold text-white hover:bg-slate-800"
                    >
                      {loading ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        <RefreshCw size={16} />
                      )}{" "}
                      {loading
                        ? "Reading data"
                        : error
                          ? "Retry on-chain read"
                          : "Read on-chain data"}
                    </Button>
                  </div>
                </div>
                {error && (
                  <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-300/20 bg-rose-400/10 p-3 text-sm text-rose-100">
                    <AlertTriangle className="mt-0.5 shrink-0" size={16} />
                    <div className="min-w-0 flex-1">
                      <p>{error}</p>
                      <Button
                        type="button"
                        onClick={() => void loadOnchain()}
                        disabled={loading}
                        variant="outline"
                        className="mt-3 h-9 gap-2 rounded-lg border-rose-200/40 bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/20"
                      >
                        <RefreshCw size={13} /> {t("retry")}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {claimStatus !== "idle" && (
              <section className="animate-in fade-in slide-in-from-top-2 duration-200">
                <TransactionStatus
                  status={claimStatus}
                  txHash={claimTxHash}
                  error={claimError}
                />
              </section>
            )}

            <section
              className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
              aria-busy={loading && !snapshot}
            >
              {loading && !snapshot ? (
                <>
                  <BlockchainLoadingBrand />
                  {Array.from({ length: 4 }, (_, index) => (
                    <BlockchainMetricSkeleton
                      key={`metric-skeleton-${index}`}
                    />
                  ))}
                </>
              ) : (
                <>
                  <MetricCard
                    icon={Ticket}
                    label={t("ticketTotal")}
                    value={metrics.tickets}
                    detail={
                      snapshot
                        ? `Block ${snapshot.blockNumber.toLocaleString()}`
                        : "Preview"
                    }
                  />
                  <MetricCard
                    icon={Gauge}
                    label={t("waitingAllocation")}
                    value={metrics.waiting}
                    detail="Ticket ID order"
                    tone="amber"
                  />
                  <MetricCard
                    icon={Database}
                    label={t("contractBalance")}
                    value={metrics.balance}
                    detail="Read from token state"
                    tone="blue"
                  />
                  <MetricCard
                    icon={CheckCircle2}
                    label={t("claimedTotal")}
                    value={metrics.claimed}
                    detail="Read from on-chain state"
                  />
                </>
              )}
            </section>
            {loading && !snapshot && (
              <p
                className="-mt-3 flex items-center gap-2 px-1 text-xs font-semibold text-teal-700"
                role="status"
                aria-live="polite"
              >
                <span className="h-2 w-2 animate-pulse rounded-full bg-teal-500 motion-reduce:animate-none" />
                กำลังอ่านข้อมูลจาก BNB Smart Chain…
              </p>
            )}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
              <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
                <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold tracking-tight">
                        Latest on-chain queue
                      </h2>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500">
                        5 items
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {snapshot
                        ? "Data from the Contract ticket getter"
                        : "Preview — enter a Contract Address to read live data"}
                    </p>
                  </div>
                  <button
                    onClick={() => void loadOnchain()}
                    className="inline-flex items-center gap-2 self-start rounded-lg px-3 py-2 text-xs font-semibold text-teal-700 transition hover:bg-teal-50"
                  >
                    <RefreshCw size={14} /> Refresh data
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-slate-50/80 text-xs font-semibold text-slate-500">
                      <tr>
                        <th className="px-5 py-3">Ticket</th>
                        <th className="px-5 py-3">Recipient</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3">Allocated</th>
                        <th className="px-5 py-3">Block</th>
                        <th className="px-5 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody
                      className="divide-y divide-slate-100"
                      aria-busy={loading && !snapshot}
                    >
                      {loading && !snapshot
                        ? Array.from(
                            { length: Math.max(5, Math.min(12, rows.length)) },
                            (_, index) => (
                              <BlockchainQueueRowSkeleton
                                key={`queue-skeleton-${index}`}
                              />
                            )
                          )
                        : rows.map(row => (
                            <tr
                              key={row.id}
                              className={`group transition hover:bg-teal-50/30 ${highlightedTicketIds.includes(row.id) ? "animate-pulse bg-amber-50 ring-1 ring-inset ring-amber-200" : ""}`}
                            >
                              <td className="px-5 py-4 font-bold text-slate-900">
                                #{row.id}
                              </td>
                              <td className="px-5 py-4 font-mono text-xs text-slate-500">
                                {row.recipient}
                              </td>
                              <td className="px-5 py-4">
                                <StatusBadge status={row.status} />
                              </td>
                              <td className="px-5 py-4 font-semibold text-slate-700">
                                {row.amount}
                                {snapshot && row.amount !== "—"
                                  ? ` ${snapshot.symbol}`
                                  : ""}
                              </td>
                              <td className="px-5 py-4 text-xs text-slate-400">
                                {row.block}
                              </td>
                              <td className="px-5 py-4 text-right">
                                {row.status === "Claimed" ? (
                                  <button
                                    onClick={() => {
                                      if (
                                        "address" in row &&
                                        Web3.utils.isAddress(
                                          (row as any).address
                                        )
                                      )
                                        explorerAddress((row as any).address);
                                      else
                                        toast.info("ตัวอย่างหน้าจอ", {
                                          description:
                                            "กรอก Contract Address เพื่อเปิดข้อมูลจริงบน Explorer",
                                        });
                                    }}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-teal-300 hover:text-teal-700"
                                  >
                                    View on Explorer <ExternalLink size={13} />
                                  </button>
                                ) : (
                                  <button
                                    disabled={
                                      !snapshot ||
                                      row.status !== "Allocated" ||
                                      referralStatus?.paused
                                    }
                                    onClick={() => openClaim(row as any)}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 px-3 py-2 text-xs font-semibold text-teal-700 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    Claim <ArrowUpRight size={13} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-col gap-2 border-t border-slate-100 px-5 py-4 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                  <span className="inline-flex items-center gap-2">
                    <RefreshCw size={13} />{" "}
                    {snapshot
                      ? `อัปเดตล่าสุด: Block ${snapshot.blockNumber.toLocaleString()}`
                      : "Preview data is not real funds"}
                  </span>
                  <span className="font-semibold text-slate-500">
                    All data can be rechecked on the Explorer
                  </span>
                </div>
              </section>

              <aside className="space-y-6">
                <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <h2 className="font-bold tracking-tight">
                        Contract State
                      </h2>
                      <p className="mt-1 text-xs text-slate-400">
                        Statusที่อ่านด้วย `view`
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(contractAddress);
                        toast.success("Contract Address copied");
                      }}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      aria-label="คัดลอก Contract Address"
                    >
                      <Clipboard size={16} />
                    </button>
                  </div>
                  <div className="space-y-3 text-sm">
                    {[
                      [
                        "asset",
                        snapshot?.asset
                          ? shortAddress(snapshot.asset)
                          : "ยังไม่มีข้อมูล",
                      ],
                      [
                        "nextTicketId",
                        snapshot ? snapshot.registered + 1 : "0",
                      ],
                      [
                        "nextUnfundedTicketId",
                        snapshot ? snapshot.waiting : "0",
                      ],
                      [
                        "totalScheduled",
                        snapshot
                          ? formatToken(snapshot.scheduled, snapshot.decimals)
                          : "0",
                      ],
                      [
                        "totalClaimed",
                        snapshot
                          ? `${formatToken(snapshot.claimed, snapshot.decimals)} ${snapshot.symbol}`
                          : "0 BSC-USD",
                      ],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0"
                      >
                        <code className="text-xs text-slate-500">{label}</code>
                        <span className="truncate text-right text-xs font-semibold text-slate-800">
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
                  <div className="mb-4 flex items-center gap-2">
                    <FileCheck2 className="text-teal-600" size={18} />
                    <h2 className="font-bold tracking-tight">
                      Data sources and verification
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700">
                      <Check size={13} /> Verified Contract
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1.5 text-[11px] font-semibold text-blue-700">
                      <Database size={13} /> Read-only RPC
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1.5 text-[11px] font-semibold text-violet-700">
                      <Activity size={13} /> Events
                    </span>
                  </div>
                  <div className="mt-4 flex gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                    <AlertTriangle className="mt-0.5 shrink-0" size={15} />
                    Check the Contract Address and ABI before every token
                    transfer
                  </div>
                </section>
                <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="font-bold tracking-tight">
                        Fee & Referral
                      </h2>
                      <p className="mt-1 text-xs text-slate-400">
                        Read from Smart Contract โดยตรง
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-bold ${referralStatus?.walletEligible ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                    >
                      {referralStatus?.walletEligible
                        ? "Eligible"
                        : "ตรวจสอบแล้ว"}
                    </span>
                  </div>
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <span className="text-slate-500">Owner</span>
                      <code className="font-mono text-slate-700">
                        {shortAddress(referralStatus?.owner || OWNER_ADDRESS)}
                      </code>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <span className="text-slate-500">Fee</span>
                      <span className="font-bold text-slate-800">
                        {referralStatus
                          ? `${(Number(referralStatus.feeBps) / 100).toFixed(2)}% (${referralStatus.feeBps} bps)`
                          : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <span className="text-slate-500">Fee Wallet</span>
                      <code className="font-mono text-slate-700">
                        {shortAddress(
                          referralStatus?.feeRecipient || FEE_RECIPIENT
                        )}
                      </code>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <span className="text-slate-500">Deposit Required</span>
                      <span className="font-bold text-slate-800">13 USDT</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">Service Fee</span>
                      <span className="font-bold text-teal-700">
                        0.0013 BNB
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 rounded-xl bg-slate-50 p-3 text-[11px] leading-5 text-slate-600">
                    <p className="font-semibold text-slate-800">
                      Suggested Referral
                    </p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <code className="font-mono">
                        {shortAddress(SUGGESTED_REFERRER)}
                      </code>
                      <span
                        className={
                          referralStatus?.suggestedEligible
                            ? "font-semibold text-emerald-700"
                            : "text-amber-700"
                        }
                      >
                        {referralStatus
                          ? referralStatus.suggestedEligible
                            ? "Stake ครบแล้ว"
                            : "ยังไม่ Stake ครบ"
                          : "รออ่านStatus"}
                      </span>
                    </div>
                  </div>
                  {personalReferralLink && (
                    <div className="mt-4 rounded-xl border border-teal-100 bg-teal-50/70 p-3">
                      <p className="text-[11px] font-bold text-teal-900">
                        ลิงก์ Referral ของ Wallet นี้
                      </p>
                      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="w-fit rounded-xl bg-white p-2 shadow-sm">
                          <QRCodeSVG
                            value={personalReferralLink}
                            size={112}
                            level="M"
                            includeMargin
                            aria-label="QR Code ลิงก์ Referral ของ Wallet นี้"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <code className="block truncate rounded-lg bg-white px-2.5 py-2 font-mono text-[10px] text-teal-800">
                            {personalReferralLink}
                          </code>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void copyPersonalReferralLink()}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-2 text-[11px] font-bold text-white transition hover:bg-teal-800"
                              aria-label="คัดลอกลิงก์ Referral ของ Wallet นี้"
                            >
                              <Clipboard size={13} /> คัดลอก
                            </button>
                            <a
                              href={`https://line.me/R/msg/text/?${encodeURIComponent(`สมัครผ่านลิงก์ Referral ของฉัน: ${personalReferralLink}`)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center rounded-lg bg-[#06c755] px-3 py-2 text-[11px] font-bold text-white transition hover:brightness-95"
                            >
                              แชร์ LINE
                            </a>
                            <a
                              href={`https://t.me/share/url?url=${encodeURIComponent(personalReferralLink)}&text=${encodeURIComponent("สมัครผ่านลิงก์ Referral ของฉัน")}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center rounded-lg bg-[#229ed9] px-3 py-2 text-[11px] font-bold text-white transition hover:brightness-95"
                            >
                              แชร์ Telegram
                            </a>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-teal-900">
                        <QrCode size={14} />
                        สมัครผ่านลิงก์นี้แล้ว: {directReferralCount} คน
                      </div>
                      {directReferralError && (
                        <p className="mt-1 text-[10px] text-amber-700">
                          ยังอ่านจำนวน Referral จาก Event ไม่สำเร็จ: {directReferralError}
                        </p>
                      )}
                      <p className="mt-2 text-[10px] leading-4 text-teal-800">
                        แชร์ลิงก์นี้ให้สมาชิกใหม่ ระบบจะผูกผู้แนะนำเป็น Wallet นี้โดยตรง
                      </p>
                    </div>
                  )}
                  {referralStatusError && (
                    <p className="mt-3 text-[11px] leading-4 text-rose-700">
                      {referralStatusError}
                    </p>
                  )}
                  <p className="mt-3 text-[10px] leading-4 text-slate-400">
                    กฎปัจจุบัน: สมาชิกฝาก 13 USDT และส่งค่าบริการ 0.0013 BNB ให้
                    Contract ตรวจสอบตามเครือข่ายที่เลือก; ค่า Referral/Stake
                    รุ่นเก่าไม่ใช่กฎของ 13VT
                  </p>
                </section>
                <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
                  <div className="mb-4 flex items-center gap-2">
                    <ShieldCheck className="text-teal-600" size={18} />
                    <h2 className="font-bold tracking-tight">
                      สิทธิ์และStatus Contract
                    </h2>
                  </div>
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">Owner</span>
                      <code className="font-mono text-slate-700">
                        {shortAddress(referralStatus?.owner || OWNER_ADDRESS)}
                      </code>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">
                        Wallet ปัจจุบันเป็น Admin
                      </span>
                      <span className="font-bold text-slate-800">
                        {referralStatus?.walletAdmin ? "ใช่" : "ไม่ใช่"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">Contract writes</span>
                      <span
                        className={`font-bold ${referralStatus?.paused ? "text-amber-700" : "text-emerald-700"}`}
                      >
                        {referralStatus?.paused ? "หยุดชั่วคราว" : "เปิดใช้งาน"}
                      </span>
                    </div>
                  </div>
                  <p className="mt-4 text-[10px] leading-4 text-slate-400">
                    Admin Controls จะแสดงเมื่อเชื่อมต่อ Owner/Admin
                    และทุกคำสั่งต้องยืนยันผ่าน MetaMask
                  </p>
                </section>
              </aside>
            </div>

            <FifoQueueDashboard />

            <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
              <div className="flex flex-col gap-4 border-b border-slate-100 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold tracking-tight">
                        ประวัติการ Claim
                      </h2>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
                        <Activity size={12} /> Event Logs
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      ดึงจาก `Claimed` events ของ Smart Contract โดยตรง
                      ไม่ใช้ฐานข้อมูล Backend
                    </p>
                  </div>
                  <button
                    onClick={() => void loadOnchain()}
                    className="inline-flex items-center gap-2 self-start rounded-lg px-3 py-2 text-xs font-semibold text-teal-700 transition hover:bg-teal-50"
                  >
                    <RefreshCw size={14} /> รีเฟรชประวัติ
                  </button>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <label className="relative flex min-w-0 flex-1 items-center">
                    <Search
                      className="pointer-events-none absolute left-3 text-slate-400"
                      size={16}
                    />
                    <input
                      value={historyFilter}
                      onChange={event => setHistoryFilter(event.target.value)}
                      placeholder="ค้นหาด้วยกระเป๋าRecipient หรือ Ticket ID เช่น 124"
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-10 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:bg-white focus:ring-4 focus:ring-teal-100/70"
                      aria-label="ค้นหาประวัติด้วยกระเป๋าRecipientหรือ Ticket ID"
                    />
                    {historyFilter && (
                      <button
                        onClick={() => setHistoryFilter("")}
                        className="absolute right-2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                        aria-label="ล้างตัวกรอง"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </label>
                  <span className="shrink-0 text-xs font-semibold text-slate-500">
                    แสดง {filteredHistory.length} จาก {history.length} รายการ
                  </span>
                </div>
              </div>
              {historyError && (
                <div className="mx-5 mt-4 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-800">
                  <AlertTriangle size={15} />
                  {historyError}
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-slate-50/80 text-xs font-semibold text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Tx Hash</th>
                      <th className="px-5 py-3">Ticket</th>
                      <th className="px-5 py-3">Recipient</th>
                      <th className="px-5 py-3">จำนวน</th>
                      <th className="px-5 py-3">Block</th>
                      <th className="px-5 py-3 text-right">Explorer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {historyLoading ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-5 py-10 text-center text-sm text-slate-400"
                        >
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="animate-spin" size={16} />
                            กำลังอ่าน Event Logs จากเชน…
                          </span>
                        </td>
                      </tr>
                    ) : history.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-5 py-10 text-center text-sm text-slate-400"
                        >
                          {snapshot
                            ? "ยังไม่พบ Claimed events ใน Contract นี้"
                            : "กรอก Contract Address และกดอ่านข้อมูลเพื่อดูประวัติจริง"}
                        </td>
                      </tr>
                    ) : filteredHistory.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-5 py-10 text-center text-sm text-slate-400"
                        >
                          ไม่พบรายการที่ตรงกับ “{historyFilter}”{" "}
                          <button
                            onClick={() => setHistoryFilter("")}
                            className="ml-1 font-semibold text-teal-700 underline"
                          >
                            ล้างตัวกรอง
                          </button>
                        </td>
                      </tr>
                    ) : (
                      filteredHistory.map(item => (
                        <tr
                          key={`${item.hash}-${item.ticketId}`}
                          className="transition hover:bg-teal-50/30"
                        >
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                              <CheckCircle2 size={13} />
                              Confirmed
                            </span>
                          </td>
                          <td className="px-5 py-4 font-mono text-xs text-slate-500">
                            {shortAddress(item.hash)}
                          </td>
                          <td className="px-5 py-4 font-bold text-slate-900">
                            #{item.ticketId}
                          </td>
                          <td className="px-5 py-4 font-mono text-xs text-slate-500">
                            {shortAddress(item.recipient)}
                          </td>
                          <td className="px-5 py-4 font-semibold text-slate-700">
                            {snapshot
                              ? `${formatToken(item.amount, snapshot.decimals)} ${snapshot.symbol}`
                              : "—"}
                          </td>
                          <td className="px-5 py-4 text-xs text-slate-400">
                            {item.blockNumber.toLocaleString()}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              onClick={() =>
                                window.open(
                                  `${EXPLORER}/tx/${item.hash}`,
                                  "_blank",
                                  "noopener,noreferrer"
                                )
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-teal-300 hover:text-teal-700"
                            >
                              ดู Tx <ExternalLink size={13} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-slate-100 px-5 py-4 text-xs text-slate-400">
                แสดงล่าสุดสูงสุด 50 รายการจาก Event Logs • รองรับค้นหาด้วย
                Ticket ID, ที่อยู่Recipientแบบเต็ม หรือบางส่วน • Status
                Confirmed หมายถึงมี receipt สำเร็จบนเชน
              </div>
            </section>
          </div>
          <ReferralPathPanel
            events={referralPathEvents}
            loading={referralPathLoading}
            error={referralPathError}
            referrerOf={referralStatus?.linkedReferrer}
          />
          <ReferralTree
            nodes={userTreeNodes}
            mode="user"
            note={
              referralPathError ||
              (referralPathLoading
                ? t("eventPathLoading")
                : t("treeDataNotice"))
            }
          />
          <ReferralSystemsPanel
            provider={provider}
            contractAddress={contractAddress}
            account={account}
            refreshInterval={refreshInterval}
          />
        </main>
      </div>
      {signInOpen && (
        <div
          className="fixed inset-0 z-[95] grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={event => {
            if (
              event.target === event.currentTarget &&
              signInStatus !== "signing"
            )
              setSignInOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="signin-title"
            className="w-full max-w-md overflow-hidden rounded-3xl border border-white/60 bg-white shadow-2xl"
          >
            <div className="bg-slate-950 p-6 text-white">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src="/manus-storage/13vt-logo_da29a501.jpg"
                    alt="13vt.com"
                    className="h-12 w-12 rounded-2xl object-cover shadow-lg"
                  />
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-teal-300/15 text-teal-200">
                    <Wallet size={23} />
                  </div>
                </div>
                <button
                  disabled={signInStatus === "signing"}
                  onClick={() => setSignInOpen(false)}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
                  aria-label="Close sign in dialog"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">
                Wallet identity
              </p>
              <h2
                id="signin-title"
                className="mt-2 text-2xl font-bold tracking-tight"
              >
                Sign in with your wallet
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                no password, no gas
              </p>
            </div>
            <div className="space-y-5 p-6">
              <div>
                <label
                  htmlFor="referral-code"
                  className="text-sm font-semibold text-slate-800"
                >
                  Referral code{" "}
                  <span className="font-normal text-slate-400">
                    (if you have one)
                  </span>
                </label>
                <input
                  id="referral-code"
                  value={referralCode}
                  onChange={event =>
                    setReferralCode(
                      event.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, "")
                        .slice(0, 12)
                    )
                  }
                  disabled={
                    signInStatus === "signed" || signInStatus === "signing"
                  }
                  placeholder="e.g. A7K2QP9X"
                  className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 font-mono text-sm tracking-[0.16em] text-slate-800 outline-none transition placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-400 focus:border-teal-400 focus:bg-white focus:ring-4 focus:ring-teal-100/70 disabled:cursor-not-allowed disabled:opacity-60"
                />
                <p className="mt-2 text-xs text-slate-400">
                  Can only be entered when you first register
                </p>
              </div>
              <div className="flex gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <ShieldCheck
                  className="mt-0.5 shrink-0 text-emerald-600"
                  size={19}
                />
                <p className="text-xs leading-5 text-emerald-900">
                  Connecting your wallet only signs a message to prove it is
                  yours. No charge is made and your coins are never accessed.
                </p>
              </div>
              {signInStatus === "signed" && (
                <div className="space-y-3 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">
                  <p>
                    Wallet verified
                    {referralCode ? ` with referral code ${referralCode}` : ""}.
                    Referral code will apply only at first registration.
                  </p>
                  <p className="text-amber-800">
                    On-chain code registration requires a Contract with
                    `registerWithReferralCode(bytes32)` and an Owner-configured
                    code mapping.
                  </p>
                  <p className="text-emerald-700">
                    Session expires in{" "}
                    {sessionExpiresAt
                      ? new Date(sessionExpiresAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                    . Signature verification is currently performed in this
                    browser; production sessions should be verified by a
                    Backend.
                  </p>
                  {referralCode && registrationStatus === "idle" && (
                    <Button
                      onClick={registerReferralOnchain}
                      className="w-full rounded-xl bg-emerald-700 text-white hover:bg-emerald-800"
                    >
                      Approve 13 USDT + Register · Fee 0.0013 BNB
                    </Button>
                  )}
                  {registrationStatus === "pending" && (
                    <p className="font-semibold">
                      กำลังส่ง Registration transaction ผ่าน MetaMask…
                    </p>
                  )}
                  {registrationStatus === "confirmed" && (
                    <p className="font-semibold">
                      Registration confirmed on-chain
                      {registrationHash
                        ? ` · ${shortAddress(registrationHash)}`
                        : ""}
                    </p>
                  )}
                  {registrationStatus === "error" && (
                    <p className="text-rose-700">{registrationError}</p>
                  )}
                </div>
              )}
              {signInError && (
                <div className="rounded-xl bg-rose-50 p-3 text-xs leading-5 text-rose-800">
                  <p>{signInError}</p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={signInWithWallet}
                    disabled={signInStatus === "signing"}
                    className="mt-3 h-8 gap-2 rounded-lg border-rose-200 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                  >
                    <Wallet size={13} /> {t("retry")}
                  </Button>
                </div>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  disabled={signInStatus === "signing"}
                  onClick={() => setSignInOpen(false)}
                  className="rounded-xl"
                >
                  {signInStatus === "signed" ? "Close" : "Cancel"}
                </Button>
                {signInStatus === "signed" && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      clearSession();
                      setSignInOpen(false);
                    }}
                    className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50"
                  >
                    Disconnect
                  </Button>
                )}
                {signInStatus !== "signed" && (
                  <Button
                    disabled={signInStatus === "signing"}
                    onClick={signInWithWallet}
                    className="gap-2 rounded-xl bg-teal-600 text-white hover:bg-teal-700"
                  >
                    {signInStatus === "signing" ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <Wallet size={16} />
                    )}
                    {signInStatus === "signing"
                      ? "Signing…"
                      : signInStatus === "error"
                        ? t("retry")
                        : "Connect wallet"}
                  </Button>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
      {adminAction && (
        <div
          className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={event => {
            if (
              event.target === event.currentTarget &&
              adminTxStatus !== "pending"
            )
              setAdminAction(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-title"
            className="w-full max-w-md overflow-hidden rounded-3xl border border-white/60 bg-white shadow-2xl"
          >
            <div className="bg-slate-950 p-6 text-white">
              <div className="mb-4 flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-300/15 text-teal-200">
                  <ShieldCheck size={22} />
                </span>
                <button
                  disabled={adminTxStatus === "pending"}
                  onClick={() => setAdminAction(null)}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
                  aria-label="ปิดหน้าต่าง"
                >
                  <X size={18} />
                </button>
              </div>
              <h2 id="admin-title" className="text-xl font-bold">
                ยืนยัน Admin Action
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                ตรวจสอบคำสั่งก่อนส่งธุรกรรมผ่านกระเป๋า Owner/Admin
              </p>
            </div>
            <div className="space-y-4 p-6">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">คำสั่ง</span>
                  <span className="font-bold text-slate-900">
                    {adminAction === "pause"
                      ? "Pause Contract"
                      : adminAction === "unpause"
                        ? "Unpause Contract"
                        : "Register for user"}
                  </span>
                </div>
                {adminAction === "registerFor" && (
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-slate-500">Recipient Ticket</span>
                    <code className="text-xs text-slate-700">
                      {shortAddress(adminUserAddress)}
                    </code>
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-slate-500">Contract</span>
                  <code className="text-xs text-slate-700">
                    {shortAddress(contractAddress)}
                  </code>
                </div>
              </div>
              <div
                className={`rounded-2xl border p-4 ${adminGasStatus === "ready" ? "border-blue-200 bg-blue-50" : adminGasStatus === "error" ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-slate-50"}`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gauge
                      size={17}
                      className={
                        adminGasStatus === "ready"
                          ? "text-blue-700"
                          : "text-slate-500"
                      }
                    />
                    <span className="text-sm font-bold text-slate-800">
                      Gas ที่คาดการณ์
                    </span>
                  </div>
                  {adminGasStatus === "loading" && (
                    <Loader2 className="animate-spin text-blue-600" size={16} />
                  )}
                  {adminGasStatus === "ready" && (
                    <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-bold text-blue-700">
                      พร้อมยืนยัน
                    </span>
                  )}
                </div>
                {adminGasStatus === "ready" && adminGasEstimate ? (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-white/70 p-2">
                      <p className="text-[10px] text-slate-500">
                        Gas base / +10%
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-900">
                        {Number(adminGasEstimate.gasUnits).toLocaleString()} /{" "}
                        {Number(
                          adminGasEstimate.bufferedGasUnits
                        ).toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/70 p-2">
                      <p className="text-[10px] text-slate-500">Gas price</p>
                      <p className="mt-1 text-xs font-bold text-slate-900">
                        {Number(adminGasEstimate.gasPriceGwei).toFixed(2)} Gwei
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/70 p-2">
                      <p className="text-[10px] text-slate-500">
                        ประมาณการ +10%
                      </p>
                      <p className="mt-1 text-xs font-bold text-blue-700">
                        {Number(adminGasEstimate.bufferedCostBnb).toFixed(6)}{" "}
                        BNB
                      </p>
                    </div>
                  </div>
                ) : adminGasStatus === "error" ? (
                  <div className="flex items-center justify-between gap-3 text-xs text-rose-800">
                    <span>{adminGasError}</span>
                    <button
                      onClick={retryAdminGas}
                      className="shrink-0 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 font-semibold hover:bg-rose-100"
                    >
                      ลองใหม่
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    กำลังจำลองธุรกรรมและอ่าน Gas price จากเครือข่าย…
                  </p>
                )}
                <p className="mt-3 text-[10px] leading-4 text-slate-500">
                  ใช้ Gas limit ที่เพิ่ม buffer อัตโนมัติ 10% แล้ว
                  ค่าใช้จริงอาจเปลี่ยนก่อนธุรกรรมได้รับการยืนยัน
                </p>
              </div>
              <div className="flex gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                <AlertTriangle className="mt-0.5 shrink-0" size={15} />
                ธุรกรรมนี้เปลี่ยนStatusหรือข้อมูลคิวบนเชน ตรวจสอบรายละเอียดใน
                MetaMask ก่อนยืนยัน
              </div>
              {adminTxStatus !== "idle" && (
                <TransactionStatus
                  status={adminTxStatus}
                  txHash={adminTxHash}
                  error={adminError}
                />
              )}
              {adminError && adminTxStatus === "idle" && (
                <p className="rounded-xl bg-rose-50 p-3 text-xs leading-5 text-rose-800">
                  {adminError}
                </p>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  disabled={adminTxStatus === "pending"}
                  onClick={() => setAdminAction(null)}
                  className="rounded-xl"
                >
                  {adminTxStatus === "confirmed" ? "ปิด" : "ยกเลิก"}
                </Button>
                {adminTxStatus !== "confirmed" &&
                  !(adminTxStatus === "unknown" && adminTxHash) && (
                    <Button
                      disabled={adminTxStatus === "pending"}
                      onClick={confirmAdminAction}
                      className="gap-2 rounded-xl bg-teal-600 text-white hover:bg-teal-700"
                    >
                      {adminTxStatus === "pending" ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        <ShieldCheck size={16} />
                      )}
                      {adminTxStatus === "pending"
                        ? "กำลังรอ MetaMask"
                        : "ยืนยันและส่ง"}
                    </Button>
                  )}
              </div>
            </div>
          </section>
        </div>
      )}
      {stakeOpen && referralStatus && snapshot && (
        <div
          className="fixed inset-0 z-[85] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget && !staking)
              setStakeOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="stake-title"
            className="w-full max-w-md overflow-hidden rounded-3xl border border-white/60 bg-white shadow-2xl"
          >
            <div className="bg-slate-950 p-6 text-white">
              <div className="mb-4 flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-300/15 text-teal-200">
                  <ShieldCheck size={22} />
                </span>
                <button
                  disabled={staking}
                  onClick={() => setStakeOpen(false)}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
                  aria-label="ปิดหน้าต่าง"
                >
                  <X size={18} />
                </button>
              </div>
              <h2 id="stake-title" className="text-xl font-bold">
                ยืนยัน Referral Stake
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                ต้องอนุมัติโทเคนและส่ง Stake ผ่าน MetaMask สองขั้นตอน
              </p>
            </div>
            <div className="space-y-4 p-6">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Stake จริง</span>
                  <span className="font-bold text-slate-900">
                    {formatToken(
                      referralStatus.requiredStake,
                      snapshot.decimals
                    )}{" "}
                    {snapshot.symbol}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-slate-500">
                    Fee ({referralStatus.feeBps} bps)
                  </span>
                  <span className="font-bold text-teal-700">
                    {formatToken(referralStatus.feeAmount, snapshot.decimals)}{" "}
                    {snapshot.symbol}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-slate-500">Fee Wallet</span>
                  <code className="text-xs text-slate-700">
                    {shortAddress(referralStatus.feeRecipient)}
                  </code>
                </div>
              </div>
              <div className="flex gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                <AlertTriangle className="mt-0.5 shrink-0" size={15} />
                ยอดรวมที่ต้องอนุมัติคือ Stake + Fee ตรวจสอบจำนวนและ Contract
                Address ใน MetaMask ก่อนยืนยัน
              </div>
              {stakeError && (
                <p className="rounded-xl bg-rose-50 p-3 text-xs leading-5 text-rose-800">
                  {stakeError}
                </p>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  disabled={staking}
                  onClick={() => setStakeOpen(false)}
                  className="rounded-xl"
                >
                  ยกเลิก
                </Button>
                <Button
                  disabled={staking || stakeUnknown}
                  onClick={confirmReferralStake}
                  className="gap-2 rounded-xl bg-teal-600 text-white hover:bg-teal-700"
                >
                  {staking ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <ShieldCheck size={16} />
                  )}
                  {stakeUnknown
                    ? "ตรวจ Hash ก่อนลองใหม่"
                    : staking
                      ? "กำลังรอ MetaMask"
                      : "อนุมัติและ Stake"}
                </Button>
              </div>
            </div>
          </section>
        </div>
      )}
      {claimTicket && (
        <div
          className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget && !claiming)
              setClaimTicket(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="claim-title"
            className="w-full max-w-md overflow-hidden rounded-3xl border border-white/60 bg-white shadow-2xl"
          >
            <div className="bg-slate-950 p-6 text-white">
              <div className="mb-4 flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-300/15 text-teal-200">
                  <ShieldCheck size={22} />
                </span>
                <button
                  disabled={claiming}
                  onClick={() => setClaimTicket(null)}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
                  aria-label="ปิดหน้าต่าง"
                >
                  <X size={18} />
                </button>
              </div>
              <h2 id="claim-title" className="text-xl font-bold">
                ยืนยันการ Claim
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Review the details before sending the transaction to MetaMask
              </p>
            </div>
            <div className="space-y-4 p-6">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Ticket</span>
                  <span className="font-bold text-slate-900">
                    #{claimTicket.id}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm text-slate-500">Allocated</span>
                  <span className="font-bold text-teal-700">
                    {claimTicket.amount} {claimTicket.symbol}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-4">
                  <span className="text-sm text-slate-500">Recipient</span>
                  <code className="text-xs text-slate-700">
                    {shortAddress(claimTicket.recipient)}
                  </code>
                </div>
              </div>
              <div
                className={`rounded-2xl border p-4 ${gasEstimateStatus === "ready" ? "border-blue-200 bg-blue-50" : gasEstimateStatus === "error" ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-slate-50"}`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gauge
                      size={17}
                      className={
                        gasEstimateStatus === "ready"
                          ? "text-blue-700"
                          : "text-slate-500"
                      }
                    />
                    <span className="text-sm font-bold text-slate-800">
                      Gas ที่คาดการณ์
                    </span>
                  </div>
                  {gasEstimateStatus === "loading" && (
                    <Loader2 className="animate-spin text-blue-600" size={16} />
                  )}
                  {gasEstimateStatus === "ready" && (
                    <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-bold text-blue-700">
                      พร้อมยืนยัน
                    </span>
                  )}
                </div>
                {gasEstimateStatus === "ready" && gasEstimate ? (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-white/70 p-2">
                      <p className="text-[10px] text-slate-500">Gas limit</p>
                      <p className="mt-1 text-xs font-bold text-slate-900">
                        {Number(gasEstimate.gasUnits).toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/70 p-2">
                      <p className="text-[10px] text-slate-500">Gas price</p>
                      <p className="mt-1 text-xs font-bold text-slate-900">
                        {Number(gasEstimate.gasPriceGwei).toFixed(2)} Gwei
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/70 p-2">
                      <p className="text-[10px] text-slate-500">ประมาณการ</p>
                      <p className="mt-1 text-xs font-bold text-blue-700">
                        {Number(gasEstimate.estimatedCostBnb).toFixed(6)} BNB
                      </p>
                    </div>
                  </div>
                ) : gasEstimateStatus === "error" ? (
                  <div className="flex items-center justify-between gap-3 text-xs text-rose-800">
                    <span>{gasEstimateError}</span>
                    <button
                      onClick={retryGasEstimate}
                      className="shrink-0 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 font-semibold hover:bg-rose-100"
                    >
                      ลองใหม่
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    กำลังอ่าน Gas price และจำลองการเรียก Contract…
                  </p>
                )}
                <p className="mt-3 text-[10px] leading-4 text-slate-500">
                  เป็นค่าประมาณจากเครือข่าย ณ เวลานี้
                  ค่าใช้จริงอาจเปลี่ยนก่อนธุรกรรมถูกยืนยัน
                </p>
              </div>
              <div className="flex gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                <AlertTriangle className="mt-0.5 shrink-0" size={15} />
                การกดยืนยันจะเปิด MetaMask และอาจมีค่า Gas บน BNB Smart Chain
                ตรวจสอบ Contract Address และข้อมูลธุรกรรมใน MetaMask อีกครั้ง
              </div>
              {claimStatus !== "idle" && (
                <TransactionStatus
                  status={claimStatus}
                  txHash={claimTxHash}
                  error={claimError}
                />
              )}{" "}
              {claimTxHash && (
                <div
                  className={`rounded-xl p-3 text-xs ${claimStatus === "confirmed" ? "bg-emerald-50 text-emerald-800" : claimStatus === "reverted" ? "bg-rose-50 text-rose-800" : "bg-amber-50 text-amber-900"}`}
                >
                  {claimStatus === "confirmed"
                    ? "ยืนยันบนเชนแล้ว:"
                    : claimStatus === "reverted"
                      ? "ถูก Revert:"
                      : "ส่งขึ้นเชนแล้ว · ยังไม่ยืนยันผล:"}{" "}
                  <a
                    className="font-semibold underline"
                    href={`${EXPLORER}/tx/${claimTxHash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    ดูธุรกรรมบน Explorer
                  </a>
                </div>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  disabled={claiming}
                  onClick={() => setClaimTicket(null)}
                  className="rounded-xl"
                >
                  {claimTxHash ? "ปิด" : "ยกเลิก"}
                </Button>
                {!claimTxHash && (
                  <Button
                    disabled={
                      claiming ||
                      claimStatus === "confirmed" ||
                      gasEstimateStatus !== "ready"
                    }
                    onClick={confirmClaim}
                    className="gap-2 rounded-xl bg-teal-600 text-white hover:bg-teal-700"
                  >
                    {claiming ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <ShieldCheck size={16} />
                    )}
                    {claiming
                      ? "กำลังรอ MetaMask"
                      : gasEstimateStatus === "loading"
                        ? "กำลังคำนวณ Gas"
                        : "ยืนยันและส่งธุรกรรม"}
                  </Button>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
      <nav
        className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-4 rounded-2xl border border-slate-200/80 bg-white/95 p-1.5 shadow-2xl shadow-slate-950/15 backdrop-blur lg:hidden"
        aria-label="Mobile navigation"
      >
        {[
          ["overview", LayoutDashboard, t("dashboard")],
          ["mine", Ticket, "My queue"],
          ["transactions", Activity, "Transactions"],
          ["contract", Code2, "Contract"],
        ].map(([key, Icon, label]) => (
          <button
            key={key as string}
            onClick={() => setActive(key as string)}
            className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[10px] font-semibold transition ${active === key ? "bg-teal-50 text-teal-700" : "text-slate-500 hover:bg-slate-50"}`}
            aria-current={active === key ? "page" : undefined}
          >
            <Icon size={17} />
            <span className="max-w-full truncate">{label as string}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
