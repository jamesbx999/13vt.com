import { AlertTriangle, Database, RefreshCw, ShieldCheck } from "lucide-react";
import { Contract, JsonRpcProvider, formatUnits } from "ethers";
import { useCallback, useEffect, useState } from "react";

const RPC_URL = "https://bsc-rpc.publicnode.com";
const ACCOUNTING_ABI = [
  "function asset() view returns (address)",
  "function assetDecimals() view returns (uint8)",
  "function totalUserDeposits() view returns (uint256)",
  "function totalFundedUnclaimed() view returns (uint256)",
  "function totalClaimable() view returns (uint256)",
  "function totalReserved() view returns (uint256)",
  "function surplus() view returns (uint256)",
  "function accountingInitialized() view returns (bool)",
  "function totalScheduled() view returns (uint256)",
  "function totalClaimed() view returns (uint256)",
];
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function symbol() view returns (string)",
];

type Props = { proxy: string; verifiedAccount: string };
type Snapshot = {
  asset: string;
  symbol: string;
  decimals: number;
  balance: bigint;
  historicalDeposits: bigint;
  fundedUnclaimed: bigint;
  claimable: bigint;
  reserved: bigint;
  surplus: bigint;
  scheduled: bigint;
  claimed: bigint;
  initialized: boolean;
};

function shortAddress(value: string) {
  return value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "—";
}

function amount(value: bigint, decimals: number) {
  try {
    return Number(formatUnits(value, decimals)).toLocaleString("en-US", {
      maximumFractionDigits: 4,
    });
  } catch {
    return "0";
  }
}

export function V3AccountingPanel({ proxy, verifiedAccount }: Props) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const provider = new JsonRpcProvider(RPC_URL, 56);
      const queue = new Contract(proxy, ACCOUNTING_ABI, provider);
      const [asset, decimalsRaw, historicalDeposits, fundedUnclaimed, claimable, reserved, surplus, initialized, scheduled, claimed] = await Promise.all([
        queue.asset(),
        queue.assetDecimals(),
        queue.totalUserDeposits(),
        queue.totalFundedUnclaimed(),
        queue.totalClaimable(),
        queue.totalReserved(),
        queue.surplus(),
        queue.accountingInitialized(),
        queue.totalScheduled(),
        queue.totalClaimed(),
      ]);
      const token = new Contract(asset, ERC20_ABI, provider);
      const [symbol, balance] = await Promise.all([token.symbol().catch(() => "TOKEN"), token.balanceOf(proxy)]);
      setSnapshot({
        asset,
        symbol,
        decimals: Number(decimalsRaw),
        balance,
        historicalDeposits,
        fundedUnclaimed,
        claimable,
        reserved,
        surplus,
        scheduled,
        claimed,
        initialized,
      });
    } catch (cause) {
      setSnapshot(null);
      setError(cause instanceof Error ? cause.message : "ไม่พบ V3 Accounting functions บน Implementation ปัจจุบัน");
    } finally {
      setLoading(false);
    }
  }, [proxy]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" aria-live="polite">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-violet-700">
            <Database size={15} /> V3 Accounting · Read-only
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Historical Deposits & Surplus</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            อ่านยอดจาก Smart Contract โดยตรง ยอด Surplus จะเป็นศูนย์จนกว่า Owner จะเรียก initializeAccounting สำเร็จ
          </p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <div className="mt-5 rounded-2xl bg-slate-950 p-4 text-xs text-slate-300">
        <p>Connected Owner: <span className="font-mono text-violet-200">{shortAddress(verifiedAccount)}</span></p>
        <p className="mt-1">Proxy: <span className="font-mono text-violet-200">{shortAddress(proxy)}</span></p>
      </div>

      {error ? (
        <div className="mt-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 shrink-0" size={18} />
          <div><p className="font-bold">ยังอ่าน V3 Accounting ไม่ได้</p><p className="mt-1 leading-6">{error}. Proxy Mainnet อาจยังชี้ไป Implementation รุ่นก่อน V3; ไม่มีการตีความยอดเป็น Surplus จากข้อมูลไม่ครบ</p></div>
        </div>
      ) : snapshot ? (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Historical deposits", snapshot.historicalDeposits],
              ["Contract balance", snapshot.balance],
              ["Reserved", snapshot.reserved],
              ["Surplus", snapshot.surplus],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-500">{label}</p>
                <p className="mt-2 text-xl font-bold text-slate-950">{amount(value as bigint, snapshot.decimals)} {snapshot.symbol}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-emerald-50 p-4"><p className="text-xs text-emerald-700">Accounting status</p><p className="mt-1 flex items-center gap-2 font-bold text-emerald-950"><ShieldCheck size={16} />{snapshot.initialized ? "Initialized" : "Not initialized"}</p></div>
            <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Funded unclaimed</p><p className="mt-1 font-bold text-slate-950">{amount(snapshot.fundedUnclaimed, snapshot.decimals)} {snapshot.symbol}</p></div>
            <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Scheduled / claimed</p><p className="mt-1 font-bold text-slate-950">{amount(snapshot.scheduled, snapshot.decimals)} / {amount(snapshot.claimed, snapshot.decimals)} {snapshot.symbol}</p></div>
          </div>
        </>
      ) : loading ? <p className="mt-6 text-sm text-slate-500">กำลังอ่านข้อมูล V3 Accounting…</p> : null}
    </section>
  );
}
