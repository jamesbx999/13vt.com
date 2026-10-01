import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  ExternalLink,
  Loader2,
  Wallet,
  XCircle,
} from "lucide-react";
import { useLanguage, type LanguageCode } from "./LanguageContext";
import {
  errorOutcome,
  isBscMainnet,
  isTransactionHash,
  JOURNAL_STORAGE_KEY,
  receiptOutcome,
  type JournalEntry,
  type JournalStatus,
} from "@/lib/transactionJournal";

type JournalApi = {
  start: (label: string) => string;
  sent: (id: string, hash: string) => void;
  receipt: (id: string, value: unknown) => void;
  error: (id: string, value: unknown) => void;
};
const JournalContext = createContext<JournalApi | null>(null);

function restoreJournal(): JournalEntry[] {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(JOURNAL_STORAGE_KEY) || "[]"
    );
    if (!Array.isArray(value)) return [];
    const allowed: JournalStatus[] = [
      "awaiting_wallet",
      "pending",
      "confirmed",
      "reverted",
      "rejected",
      "failed",
      "unknown",
    ];
    return value
      .filter((item: unknown): item is JournalEntry => {
        if (!item || typeof item !== "object") return false;
        const row = item as JournalEntry;
        return (
          typeof row.id === "string" &&
          typeof row.label === "string" &&
          row.label.length < 120 &&
          allowed.includes(row.status) &&
          (row.hash === "" || isTransactionHash(row.hash)) &&
          typeof row.createdAt === "number" &&
          typeof row.detail === "string"
        );
      })
      .slice(0, 10)
      .map(row =>
        row.status === "awaiting_wallet"
          ? {
              ...row,
              status: "unknown",
              detail:
                "Wallet prompt ended when this tab was closed; check your wallet before retrying.",
            }
          : row
      );
  } catch {
    return [];
  }
}

const copy: Record<LanguageCode, Record<string, string>> = {
  en: {
    title: "Transactions",
    wallet: "Confirm in wallet",
    pending: "Waiting for on-chain receipt",
    confirmed: "Confirmed on-chain",
    reverted: "Reverted on-chain",
    rejected: "Rejected in wallet",
    failed: "Could not submit",
    unknown: "Outcome unverified — check Explorer before retrying",
    history: "Recent activity",
    empty: "No transaction yet",
    clear: "Clear completed",
    explorer: "View on BscScan",
    note: "A hash alone does not prove a successful transaction.",
  },
  de: {
    title: "Transaktionen",
    wallet: "In Wallet bestätigen",
    pending: "Warte auf On-Chain-Beleg",
    confirmed: "On-Chain bestätigt",
    reverted: "On-Chain zurückgesetzt",
    rejected: "In Wallet abgelehnt",
    failed: "Senden fehlgeschlagen",
    unknown: "Ergebnis ungeklärt — Explorer vor erneutem Versuch prüfen",
    history: "Letzte Aktivitäten",
    empty: "Noch keine Transaktion",
    clear: "Abgeschlossene löschen",
    explorer: "Auf BscScan ansehen",
    note: "Ein Hash allein bestätigt keinen Transaktionserfolg.",
  },
  zh: {
    title: "交易",
    wallet: "在钱包中确认",
    pending: "等待链上收据",
    confirmed: "链上已确认",
    reverted: "链上已回滚",
    rejected: "钱包已拒绝",
    failed: "发送失败",
    unknown: "结果未验证——重试前请查询浏览器",
    history: "最近活动",
    empty: "暂无交易",
    clear: "清除已完成记录",
    explorer: "在 BscScan 查看",
    note: "仅有交易哈希不代表交易成功。",
  },
  lo: {
    title: "ທຸລະກຳ",
    wallet: "ຢືນຢັນໃນ Wallet",
    pending: "ລໍຖ້າໃບຮັບ On-chain",
    confirmed: "ຢືນຢັນໃນເຊນແລ້ວ",
    reverted: "ທຸລະກຳ Revert ແລ້ວ",
    rejected: "Wallet ປະຕິເສດ",
    failed: "ສົ່ງບໍ່ສຳເລັດ",
    unknown: "ຜົນຍັງບໍ່ຢືນຢັນ — ກວດ Explorer ກ່ອນລອງໃໝ່",
    history: "ລາຍການຫຼ້າສຸດ",
    empty: "ຍັງບໍ່ມີທຸລະກຳ",
    clear: "ລ້າງລາຍການທີ່ສຳເລັດ",
    explorer: "ເບິ່ງໃນ BscScan",
    note: "Hash ຢ່າງດຽວບໍ່ແມ່ນຫຼັກຖານວ່າສຳເລັດ.",
  },
  th: {
    title: "สถานะธุรกรรม",
    wallet: "รอยืนยันในกระเป๋า",
    pending: "ส่งแล้ว · รอ receipt บนเชน",
    confirmed: "ยืนยันบนเชนแล้ว",
    reverted: "ธุรกรรมถูก Revert บนเชน",
    rejected: "ปฏิเสธในกระเป๋า",
    failed: "ส่งธุรกรรมไม่สำเร็จ",
    unknown: "ยังไม่ทราบผล · ตรวจ Explorer ก่อนลองใหม่",
    history: "รายการล่าสุด",
    empty: "ยังไม่มีธุรกรรม",
    clear: "ล้างรายการที่จบแล้ว",
    explorer: "ดูบน BscScan",
    note: "มี Hash อย่างเดียวยังไม่ใช่หลักฐานว่าธุรกรรมสำเร็จ",
  },
};
const statusLabel: Record<JournalStatus, string> = {
  awaiting_wallet: "wallet",
  pending: "pending",
  confirmed: "confirmed",
  reverted: "reverted",
  rejected: "rejected",
  failed: "failed",
  unknown: "unknown",
};

export function TransactionJournalProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [entries, setEntries] = useState<JournalEntry[]>(restoreJournal);
  const [open, setOpen] = useState(false);
  const { language } = useLanguage();
  const text = copy[language];

  useEffect(() => {
    try {
      localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(entries));
    } catch {
      /* storage may be disabled */
    }
  }, [entries]);
  const update = useCallback((id: string, patch: Partial<JournalEntry>) => {
    setEntries(current =>
      current.map(row =>
        row.id === id && row.status !== "confirmed" && row.status !== "reverted"
          ? { ...row, ...patch }
          : row
      )
    );
  }, []);
  const start = useCallback((label: string) => {
    const id = crypto.randomUUID();
    const entry: JournalEntry = {
      id,
      label,
      status: "awaiting_wallet",
      hash: "",
      detail: "",
      createdAt: Date.now(),
    };
    setEntries(current => [entry, ...current].slice(0, 10));
    setOpen(true);
    return id;
  }, []);
  const sent = useCallback(
    (id: string, hash: string) => {
      if (isTransactionHash(hash))
        update(id, { status: "pending", hash, detail: "" });
    },
    [update]
  );
  const receipt = useCallback(
    (id: string, value: unknown) => {
      const outcome = receiptOutcome(value);
      if (outcome) update(id, { status: outcome, detail: "" });
      else
        update(id, {
          status: "unknown",
          detail: "No verifiable receipt status; check Explorer.",
        });
    },
    [update]
  );
  const error = useCallback((id: string, value: unknown) => {
    setEntries(current =>
      current.map(row => {
        if (
          row.id !== id ||
          row.status === "confirmed" ||
          row.status === "reverted"
        )
          return row;
        const status = errorOutcome(Boolean(row.hash), value);
        // Never display an RPC error after a hash as an on-chain revert.
        return {
          ...row,
          status,
          detail:
            status === "unknown"
              ? "Provider error after submission; check the transaction hash on Explorer before retrying."
              : status === "rejected"
                ? "Wallet did not submit this transaction."
                : "Submission failed; no transaction hash was received.",
        };
      })
    );
  }, []);

  const checkReceipts = useCallback(async () => {
    const provider = window.ethereum;
    if (!provider?.request) return;
    try {
      const chainId = await provider.request({ method: "eth_chainId" });
      if (!isBscMainnet(chainId)) return; // Never check a BSC Mainnet tx against another chain.
      const current = entries.filter(
        row =>
          (row.status === "pending" || row.status === "unknown") &&
          isTransactionHash(row.hash)
      );
      for (const row of current) {
        try {
          const result = await provider.request({
            method: "eth_getTransactionReceipt",
            params: [row.hash],
          });
          const outcome = receiptOutcome(result);
          if (outcome) update(row.id, { status: outcome, detail: "" });
        } catch {
          /* RPC unavailable: status remains pending/unknown, never falsely confirmed */
        }
      }
    } catch {
      /* wrong/disconnected provider: keep previous state */
    }
  }, [entries, update]);
  useEffect(() => {
    if (
      !entries.some(
        row =>
          (row.status === "pending" || row.status === "unknown") && row.hash
      )
    )
      return;
    void checkReceipts();
    const timer = window.setInterval(() => {
      if (!document.hidden) void checkReceipts();
    }, 12000);
    return () => window.clearInterval(timer);
  }, [checkReceipts, entries]);

  const api = useMemo(
    () => ({ start, sent, receipt, error }),
    [start, sent, receipt, error]
  );
  const active = entries.filter(row =>
    ["awaiting_wallet", "pending", "unknown"].includes(row.status)
  ).length;
  return (
    <JournalContext.Provider value={api}>
      {children}
      {entries.length > 0 && (
        <aside
          className="fixed bottom-24 right-3 z-50 w-[min(23rem,calc(100vw-1.5rem))] sm:bottom-5 sm:right-5"
          aria-label={text.title}
        >
          <button
            type="button"
            onClick={() => setOpen(value => !value)}
            aria-expanded={open}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 text-left text-sm font-semibold text-white shadow-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400"
          >
            <span className="inline-flex items-center gap-2">
              <Clock3 size={16} />
              {text.title}
              {active > 0 && (
                <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs text-slate-950">
                  {active}
                </span>
              )}
            </span>
            {open ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
          </button>
          {open && (
            <div
              role="status"
              aria-live="polite"
              className="mt-2 max-h-[min(60vh,27rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 text-slate-800 shadow-2xl"
            >
              <div className="flex items-center justify-between gap-2 px-1 pb-2 text-xs font-semibold">
                <span>{text.history}</span>
                <button
                  type="button"
                  onClick={() =>
                    setEntries(rows =>
                      rows.filter(row =>
                        ["awaiting_wallet", "pending", "unknown"].includes(
                          row.status
                        )
                      )
                    )
                  }
                  className="text-teal-700 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500"
                >
                  {text.clear}
                </button>
              </div>
              <ul className="space-y-2">
                {entries.map(row => {
                  const positive = row.status === "confirmed";
                  const negative = ["reverted", "rejected", "failed"].includes(
                    row.status
                  );
                  const Icon = positive
                    ? CheckCircle2
                    : negative
                      ? XCircle
                      : row.status === "awaiting_wallet"
                        ? Wallet
                        : row.status === "pending"
                          ? Loader2
                          : AlertCircle;
                  return (
                    <li
                      key={row.id}
                      className={`rounded-xl border p-3 text-xs ${positive ? "border-emerald-200 bg-emerald-50" : negative ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50"}`}
                    >
                      <div className="flex items-start gap-2">
                        <Icon
                          size={16}
                          className={`mt-0.5 shrink-0 ${row.status === "pending" ? "animate-spin motion-reduce:animate-none" : ""}`}
                        />
                        <div className="min-w-0">
                          <p className="font-semibold">{row.label}</p>
                          <p className="mt-1">
                            {text[statusLabel[row.status]]}
                          </p>
                          {row.detail && (
                            <p className="mt-1 break-words text-slate-600">
                              {row.detail}
                            </p>
                          )}
                          {row.hash && (
                            <a
                              href={`https://bscscan.com/tx/${row.hash}`}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 inline-flex items-center gap-1 break-all font-mono text-[11px] text-teal-800 underline"
                              aria-label={text.explorer}
                            >
                              {row.hash.slice(0, 10)}…{row.hash.slice(-8)}{" "}
                              <ExternalLink size={12} />
                            </a>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="px-1 pt-3 text-[11px] text-slate-500">
                {text.note}
              </p>
            </div>
          )}
        </aside>
      )}
    </JournalContext.Provider>
  );
}

export function useTransactionJournal() {
  const value = useContext(JournalContext);
  if (!value) throw new Error("TransactionJournalProvider is missing");
  return value;
}
