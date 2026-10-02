import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Search,
  XCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { TESTNET_TOKEN } from "../../../shared/testnetToken";
import { useLanguage } from "@/contexts/LanguageContext";

type LocalizedCopy = {
  title: string;
  subtitle: string;
  token: string;
  input: string;
  inspect: string;
  waiting: string;
  notFound: string;
  reverted: string;
  noTransfer: string;
  transfer: string;
  pending: string;
  noPayout: string;
  verifyError: string;
  receipt: string;
  clear: string;
};
const content: Record<string, LocalizedCopy> = {
  en: {
    title: "Testnet payment evidence",
    subtitle:
      "Read-only check on BSC Testnet (97). The queue above remains on BSC Mainnet (56).",
    token: "USDT-named test token · unofficial, no real value",
    input: "BSC Testnet transaction hash (0x…)",
    inspect: "Inspect receipt",
    waiting: "Checking Testnet receipt…",
    notFound: "Transaction not found on BSC Testnet",
    reverted: "Transaction reverted — no transfer was completed",
    noTransfer: "Confirmed transaction, but no Transfer from this test token",
    transfer: "Verified test-token Transfer event",
    pending: "Broadcast but not mined",
    noPayout:
      "A token transfer alone does NOT prove a 13VT referral payout or funding for U2. The amount, recipient and source must match the eventual verified contract ledger.",
    verifyError:
      "RPC unavailable or receipt unverifiable — no payout is inferred",
    receipt: "View receipt",
    clear: "Clear",
  },
  de: {
    title: "Testnet-Zahlungsnachweis",
    subtitle:
      "Schreibgeschützte Prüfung auf BSC Testnet (97). Die Warteschlange oben bleibt im Mainnet (56).",
    token: "USDT-benannter Testtoken · inoffiziell, ohne realen Wert",
    input: "BSC-Testnet-Transaktions-Hash (0x…)",
    inspect: "Beleg prüfen",
    waiting: "Prüfe Testnet-Beleg…",
    notFound: "Transaktion im Testnet nicht gefunden",
    reverted: "Transaktion rückgängig — kein Transfer",
    noTransfer: "Bestätigt, aber kein Transfer dieses Testtokens",
    transfer: "Verifiziertes Testtoken-Transferereignis",
    pending: "Gesendet, noch nicht bestätigt",
    noPayout:
      "Ein Token-Transfer beweist KEINE 13VT-Empfehlungszahlung oder U2-Deckung. Empfänger, Betrag und Quelle müssen zur später verifizierten Vertragsbuchung passen.",
    verifyError: "RPC oder Beleg nicht prüfbar — keine Auszahlung angenommen",
    receipt: "Beleg ansehen",
    clear: "Löschen",
  },
  zh: {
    title: "测试网支付凭证",
    subtitle: "BSC 测试网 (97) 只读核查；上方队列仍在主网 (56)。",
    token: "名为 USDT 的测试代币·非官方，无真实价值",
    input: "BSC 测试网交易哈希 (0x…)",
    inspect: "检查收据",
    waiting: "正在查询测试网收据…",
    notFound: "测试网未找到交易",
    reverted: "交易已回滚——未完成转账",
    noTransfer: "交易确认，但未发现该测试代币转账",
    transfer: "已核实测试代币 Transfer 事件",
    pending: "已广播，尚未上链",
    noPayout:
      "代币转账不能单独证明 13VT 推荐支付或 U2 已获资金。金额、收款人和来源须与今后核实的合约账本一致。",
    verifyError: "RPC 或收据不可验证——不能推断已支付",
    receipt: "查看收据",
    clear: "清除",
  },
  lo: {
    title: "ຫຼັກຖານການຈ່າຍ Testnet",
    subtitle:
      "ກວດແບບອ່ານຢ່າງດຽວໃນ BSC Testnet (97); ຄິວດ້ານເທິງຍັງໃຊ້ Mainnet (56)",
    token: "ໂທເຄນທົດສອບຊື່ USDT · ບໍ່ແມ່ນທາງການ",
    input: "Hash ທຸລະກຳ Testnet (0x…)",
    inspect: "ກວດ receipt",
    waiting: "ກຳລັງກວດ receipt…",
    notFound: "ບໍ່ພົບທຸລະກຳ",
    reverted: "ທຸລະກຳ Revert — ບໍ່ມີການໂອນ",
    noTransfer: "ຢືນຢັນແລ້ວ ແຕ່ບໍ່ມີ Transfer ຂອງໂທເຄນນີ້",
    transfer: "ກວດພົບເຫດການ Transfer ຂອງໂທເຄນທົດສອບ",
    pending: "ສົ່ງແລ້ວ ລໍຖ້າຢືນຢັນ",
    noPayout:
      "ການໂອນໂທເຄນຢ່າງດຽວບໍ່ພິສູດວ່າ U2 ໄດ້ຮັບເງິນ; ຕ້ອງກວດຈຳນວນ, ຜູ້ຮັບ ແລະແຫຼ່ງທຶນ",
    verifyError: "ກວດ RPC ຫຼື receipt ບໍ່ໄດ້ — ບໍ່ສະຫຼຸບວ່າຈ່າຍແລ້ວ",
    receipt: "ເບິ່ງ receipt",
    clear: "ລ້າງ",
  },
  th: {
    title: "หลักฐานการจ่ายบน Testnet",
    subtitle:
      "ตรวจแบบอ่านอย่างเดียวบน BSC Testnet (97) · คิวด้านบนยังอยู่ Mainnet (56)",
    token: "โทเคนทดสอบชื่อ USDT · ไม่ใช่ USDT ทางการและไม่มีมูลค่าจริง",
    input: "Hash ธุรกรรมบน BSC Testnet (0x…)",
    inspect: "ตรวจ receipt",
    waiting: "กำลังตรวจ receipt บน Testnet…",
    notFound: "ไม่พบธุรกรรมบน BSC Testnet",
    reverted: "ธุรกรรม Revert · ไม่มีการโอนสำเร็จ",
    noTransfer: "ธุรกรรมสำเร็จ แต่ไม่พบ Transfer ของโทเคนทดสอบนี้",
    transfer: "ยืนยัน Transfer ของโทเคนทดสอบจาก Event บนเชน",
    pending: "ส่งแล้ว · รอขุดบล็อก",
    noPayout:
      "Transfer โทเคนอย่างเดียวไม่ใช่หลักฐานว่า U2 ได้รับเงินจากกฎ 13VT ต้องตรวจจำนวน ผู้รับ และ depositId ในสัญญา 13VT ที่ยืนยันแล้วด้วย",
    verifyError: "RPC หรือ receipt ตรวจไม่ได้ · ห้ามสรุปว่าจ่ายสำเร็จ",
    receipt: "ดู receipt",
    clear: "ล้าง",
  },
};

export function TestnetTransferPanel() {
  const { language } = useLanguage();
  const text = content[language] || content.en;
  const [draft, setDraft] = useState("");
  const [hash, setHash] = useState("");
  const valid = /^0x[a-fA-F0-9]{64}$/.test(draft.trim());
  const token = trpc.testnet.tokenInfo.useQuery(undefined, {
    staleTime: 60_000,
    retry: 1,
  });
  const receipt = trpc.testnet.inspectTransfer.useQuery(
    { hash },
    {
      enabled: Boolean(hash),
      retry: 1,
      refetchInterval: query =>
        query.state.data?.status === "pending" ? 12000 : false,
    }
  );
  const info = receipt.data;
  const statusText = info
    ? {
        not_found: text.notFound,
        pending: text.pending,
        reverted: text.reverted,
        confirmed_no_transfer: text.noTransfer,
        confirmed_transfer: text.transfer,
      }[info.status]
    : "";
  return (
    <section
      aria-label={text.title}
      className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{text.title}</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600">
            {text.subtitle}
          </p>
        </div>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
          {text.token}
        </span>
      </div>
      <p className="mt-3 break-all font-mono text-xs text-indigo-800">
        {TESTNET_TOKEN.address} · 18 decimals · Chain ID 97
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {token.isLoading
          ? text.waiting
          : token.isError
            ? text.verifyError
            : `${token.data?.name} (${token.data?.symbol}) · bytecode ✓`}
      </p>
      <form
        className="mt-4 flex flex-wrap gap-2"
        onSubmit={event => {
          event.preventDefault();
          if (valid) setHash(draft.trim());
        }}
      >
        <input
          aria-label={text.input}
          value={draft}
          onChange={event => setDraft(event.target.value)}
          placeholder={text.input}
          className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
        <button
          type="submit"
          disabled={!valid || receipt.isFetching}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-700 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Search size={14} /> {text.inspect}
        </button>
        {hash && (
          <button
            type="button"
            onClick={() => {
              setHash("");
              setDraft("");
            }}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
          >
            {text.clear}
          </button>
        )}
      </form>
      {hash && (
        <div
          role="status"
          aria-live="polite"
          className={`mt-4 rounded-xl border p-4 text-sm ${info?.status === "confirmed_transfer" ? "border-emerald-200 bg-emerald-50" : info?.status === "reverted" ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50"}`}
        >
          <p className="flex items-center gap-2 font-semibold">
            {receipt.isFetching ? (
              <Loader2
                size={16}
                className="animate-spin motion-reduce:animate-none"
              />
            ) : info?.status === "confirmed_transfer" ? (
              <CheckCircle2 size={16} />
            ) : info?.status === "reverted" ? (
              <XCircle size={16} />
            ) : (
              <AlertTriangle size={16} />
            )}
            {receipt.isFetching
              ? text.waiting
              : receipt.isError
                ? text.verifyError
                : statusText}
          </p>
          {info && (
            <p className="mt-2 text-xs text-slate-600">
              Block {info.blockNumber ?? "—"} · {info.transfers.length} Transfer
              event(s)
            </p>
          )}
          {info?.transfers.map((transfer, i) => (
            <p
              key={`${transfer.logIndex}-${i}`}
              className="mt-2 break-all rounded-lg bg-white/70 p-2 font-mono text-xs"
            >
              {transfer.amount} {TESTNET_TOKEN.symbol} · {transfer.from} →{" "}
              {transfer.to}
            </p>
          ))}
          <a
            href={`${TESTNET_TOKEN.explorer}/tx/${hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 underline"
          >
            {text.receipt} <ExternalLink size={13} />
          </a>
        </div>
      )}
      <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-700">
        {text.noPayout}
      </p>
    </section>
  );
}
