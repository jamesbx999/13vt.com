import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, RefreshCw, ShieldCheck, UploadCloud } from "lucide-react";
import { AdminTransaction, readAdminHistory, shortAddress, submitUpgradeToAndCall } from "@/lib/queue";
import { TestnetTransferPanel } from "@/components/TestnetTransferPanel";
import { FeeSimulationPanel } from "@/components/FeeSimulationPanel";
import { EthersFifoTestnetPanel } from "@/components/EthersFifoTestnetPanel";

const EXPLORER = "https://bscscan.com";

declare global { interface Window { ethereum?: any; } }

export function AdminOperationsPanel({ proxy }: { proxy: string }) {
  const [events, setEvents] = useState<AdminTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"All" | AdminTransaction["action"]>("All");
  const [implementation, setImplementation] = useState("");
  const [upgradeState, setUpgradeState] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [upgradeTx, setUpgradeTx] = useState("");
  const [upgradeError, setUpgradeError] = useState("");

  const load = useCallback(async () => {
    if (!window.ethereum) { setError("ไม่พบ Wallet provider สำหรับอ่าน Event Logs"); return; }
    setLoading(true); setError("");
    try { setEvents(await readAdminHistory(window.ethereum, proxy)); }
    catch (cause) { setEvents([]); setError(cause instanceof Error ? cause.message : "อ่าน Admin Event Logs ไม่สำเร็จ"); }
    finally { setLoading(false); }
  }, [proxy]);
  useEffect(() => { void load(); }, [load]);
  const filtered = useMemo(() => filter === "All" ? events : events.filter(event => event.action === filter), [events, filter]);

  const upgrade = async () => {
    if (!window.ethereum || !implementation.trim()) return;
    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    const account = accounts?.[0];
    if (!account) { setUpgradeError("ไม่พบ Owner wallet ที่เชื่อมต่อ"); return; }
    if (!window.confirm(`ยืนยัน UUPS Upgrade?\nProxy: ${proxy}\nImplementation ใหม่: ${implementation.trim()}\nCalldata: 0x`)) return;
    setUpgradeState("pending"); setUpgradeError(""); setUpgradeTx("");
    try {
      const tx: any = submitUpgradeToAndCall(window.ethereum, proxy, account, implementation.trim());
      tx.on("transactionHash", (hash: string) => setUpgradeTx(hash));
      await tx; setUpgradeState("success"); await load();
    } catch (cause) { setUpgradeState("error"); setUpgradeError(cause instanceof Error ? cause.message : "Upgrade ไม่สำเร็จ"); }
  };

  return (
    <section className="mt-6 space-y-6">
      <section className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
        <div className="border-b border-amber-100 bg-amber-50/70 p-5">
          <div className="flex items-center gap-2"><UploadCloud size={18} className="text-amber-700" /><h2 className="text-lg font-bold">UUPS Upgrade · Owner only</h2></div>
          <p className="mt-1 text-xs leading-5 text-amber-900/80">เรียก `upgradeToAndCall(newImplementation, 0x)` ผ่าน Proxy โดยตรง ต้องตรวจ Source, Storage Layout และการทดสอบก่อนยืนยันทุกครั้ง</p>
        </div>
        <div className="space-y-3 p-5">
          <label className="block text-xs font-semibold text-slate-600">Implementation ใหม่</label>
          <input value={implementation} onChange={event => setImplementation(event.target.value)} placeholder="0x..." className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-xs outline-none focus:border-amber-400 focus:bg-white" />
          <button type="button" onClick={() => void upgrade()} disabled={upgradeState === "pending" || !implementation.trim()} className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"><UploadCloud size={15} />{upgradeState === "pending" ? "กำลังส่ง Upgrade…" : "Upgrade Proxy"}</button>
          {upgradeError && <p className="rounded-lg bg-rose-50 p-2 text-xs text-rose-700">{upgradeError}</p>}
          {upgradeState === "success" && <p className="rounded-lg bg-emerald-50 p-2 text-xs font-semibold text-emerald-700">Upgrade สำเร็จบนเชน</p>}
          {upgradeTx && <a href={`${EXPLORER}/tx/${upgradeTx}`} target="_blank" rel="noreferrer" className="block font-mono text-[10px] text-amber-700 underline">Receipt: {upgradeTx}</a>}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><div className="flex items-center gap-2"><h2 className="text-lg font-bold tracking-tight">ประวัติธุรกรรม Admin</h2><span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700"><ShieldCheck size={12} /> Event Logs</span></div><p className="mt-1 text-xs text-slate-500">อ่านจาก Registered, PausedBy และ UnpausedBy บน Proxy โดยตรง · Mainnet Chain ID 56</p></div>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 self-start rounded-lg px-3 py-2 text-xs font-semibold text-violet-700 transition hover:bg-violet-50 disabled:opacity-50"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /> รีเฟรชประวัติ</button>
        </div>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center"><select value={filter} onChange={event => setFilter(event.target.value as typeof filter)} className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm" aria-label="กรอง Admin Event"><option value="All">ทุก Action</option><option value="Registered">Registered</option><option value="Paused">Paused</option><option value="Unpaused">Unpaused</option></select><span className="text-xs font-semibold text-slate-500">แสดง {filtered.length} จาก {events.length} รายการ</span></div>
        {error && <p className="m-5 rounded-xl bg-rose-50 p-3 text-xs text-rose-800">{error}</p>}
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold text-slate-500"><tr><th className="px-5 py-3">Action</th><th className="px-5 py-3">ผู้ดำเนินการ</th><th className="px-5 py-3">Recipient/รายละเอียด</th><th className="px-5 py-3">Ticket</th><th className="px-5 py-3">Block</th><th className="px-5 py-3 text-right">Receipt</th></tr></thead><tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-400"><Loader2 className="mr-2 inline animate-spin" size={16} />กำลังอ่าน Event Logs…</td></tr> : filtered.length === 0 ? <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-400">ยังไม่พบ Admin events ในช่วงที่อ่าน</td></tr> : filtered.map(item => <tr key={`${item.hash}-${item.action}-${item.blockNumber}`} className="hover:bg-violet-50/30"><td className="px-5 py-4 font-semibold text-slate-700">{item.action}</td><td className="px-5 py-4 font-mono text-xs text-slate-500">{shortAddress(item.actor)}</td><td className="px-5 py-4 font-mono text-xs text-slate-500">{shortAddress(item.subject)}</td><td className="px-5 py-4 font-bold">{item.ticketId === "—" ? "—" : `#${item.ticketId}`}</td><td className="px-5 py-4 text-xs text-slate-400">{item.blockNumber.toLocaleString()}</td><td className="px-5 py-4 text-right"><a className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 underline" href={`${EXPLORER}/tx/${item.hash}`} target="_blank" rel="noreferrer">ดู Tx <ExternalLink size={12} /></a></td></tr>)}</tbody></table></div>
        <p className="border-t border-slate-100 px-5 py-4 text-xs text-slate-400">แสดงสูงสุด 50 รายการจาก Event Logs ที่อ่านจาก Proxy address</p>
      </section>
      <TestnetTransferPanel /><FeeSimulationPanel /><EthersFifoTestnetPanel />
    </section>
  );
}
