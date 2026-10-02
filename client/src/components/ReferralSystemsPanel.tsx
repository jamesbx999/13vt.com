import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ExternalLink, Filter, GitBranch, Loader2, RefreshCw, Search, ShieldCheck, Users, X } from "lucide-react";
import { RebornEvent, ReferralPathEvent, readRebornEvents, readReferralPathEvents, shortAddress } from "@/lib/queue";

type Props = { provider?: any; contractAddress: string; account: string; refreshInterval?: number };
const EXPLORER = "https://bscscan.com";
type CommissionFilter = "all" | "unverified" | "confirmed";

declare global { interface Window { ethereum?: any; } }

function TreeBox({ title, subtitle, tone, children }: { title: string; subtitle: string; tone: "a" | "b"; children: React.ReactNode }) {
  return <section className={`overflow-hidden rounded-2xl border bg-white shadow-[0_12px_40px_rgba(15,23,42,0.04)] ${tone === "a" ? "border-teal-200" : "border-violet-200"}`}>
    <div className={`flex items-start gap-3 border-b p-5 ${tone === "a" ? "border-teal-100 bg-teal-50/60" : "border-violet-100 bg-violet-50/60"}`}>
      <div className={`mt-0.5 grid h-9 w-9 place-items-center rounded-xl ${tone === "a" ? "bg-teal-600 text-white" : "bg-violet-600 text-white"}`}>{tone === "a" ? <Users size={17} /> : <GitBranch size={17} />}</div>
      <div><h2 className="text-lg font-bold tracking-tight">{title}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p></div>
    </div>{children}
  </section>;
}

function TreeNode({ label, value, tone, meta }: { label: string; value: string; tone: "a" | "b"; meta?: string }) {
  return <div className={`relative min-w-[180px] rounded-2xl border bg-white p-3 shadow-sm ${tone === "a" ? "border-teal-200" : "border-violet-200"}`}>
    <div className={`mb-2 h-1.5 w-10 rounded-full ${tone === "a" ? "bg-teal-500" : "bg-violet-500"}`} />
    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
    <p className="mt-1 font-mono text-xs font-semibold text-slate-800">{value}</p>
    {meta && <p className="mt-1 text-[10px] text-slate-500">{meta}</p>}
  </div>;
}

function TreeGraphic({ account, referrals, reborns, tone }: { account: string; referrals: ReferralPathEvent[]; reborns: RebornEvent[]; tone: "a" | "b" }) {
  const isA = tone === "a";
  const items = isA ? referrals : reborns;
  if (!items.length) return <div className="p-8 text-center text-sm text-slate-400">ยังไม่มีข้อมูล Event ที่ยืนยันบนเชน</div>;
  return <div className="overflow-x-auto px-5 pb-6 pt-5">
    <div className="flex min-w-max flex-col items-center">
      <TreeNode tone={tone} label={isA ? "A · Root wallet" : "B · Reborn root"} value={shortAddress(account)} meta={isA ? "ผู้แนะนำในผัง A" : "เจ้าของ Position ผัง B"} />
      <div className={`h-6 w-px ${isA ? "bg-teal-300" : "bg-violet-300"}`} />
      <div className={`relative flex gap-5 border-t pt-5 ${isA ? "border-teal-300" : "border-violet-300"}`}>
        {items.map((item: any) => <div key={`${item.hash}-${isA ? item.ticketId : item.successorId}`} className="relative flex flex-col items-center gap-3 before:absolute before:-top-5 before:h-5 before:w-px before:bg-slate-200">
          <TreeNode tone={tone} label={isA ? `A · Ticket #${item.ticketId}` : `B · Successor #${item.successorId}`} value={shortAddress(isA ? item.recipient : item.recipient)} meta={isA ? "สมัครผ่าน Referral Link" : `ต่อจาก Parent #${item.parentId} · UNFUNDED`} />
        </div>)}
      </div>
    </div>
  </div>;
}

export function ReferralSystemsPanel({ provider, contractAddress, account, refreshInterval = 15 }: Props) {
  const [referrals, setReferrals] = useState<ReferralPathEvent[]>([]);
  const [reborns, setReborns] = useState<RebornEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rebornTx, setRebornTx] = useState("");
  const [search, setSearch] = useState("");
  const [commissionFilter, setCommissionFilter] = useState<CommissionFilter>("all");
  const [confirmParent, setConfirmParent] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!provider || !account) return;
    setLoading(true); setError("");
    try {
      const [a, b] = await Promise.all([readReferralPathEvents(provider, contractAddress, account), readRebornEvents(provider, contractAddress, account)]);
      setReferrals(a); setReborns(b);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "อ่าน Event ผัง A/B ไม่สำเร็จ"); }
    finally { setLoading(false); }
  }, [provider, contractAddress, account]);

  useEffect(() => { void load(); if (!provider || !account || refreshInterval <= 0) return; const timer = window.setInterval(() => void load(), refreshInterval * 1000); return () => window.clearInterval(timer); }, [load, provider, account, refreshInterval]);

  const filteredReferrals = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return referrals.filter(item => {
      const matchesSearch = !needle || [item.recipient, item.registeredBy, item.ticketId, item.hash].some(value => String(value).toLowerCase().includes(needle));
      const matchesStatus = commissionFilter !== "confirmed" && (commissionFilter === "all" || commissionFilter === "unverified");
      return matchesSearch && matchesStatus;
    });
  }, [referrals, search, commissionFilter]);

  const createReborn = async (parentId: string) => {
    if (!provider || !account) return;
    setConfirmParent(null); setRebornTx("pending"); setError("");
    try {
      const web3 = new (await import("web3")).default(provider);
      const contract: any = new web3.eth.Contract([{ inputs: [{ name: "parentId", type: "uint256" }], name: "createRebornPosition", outputs: [{ name: "successorId", type: "uint256" }], stateMutability: "nonpayable", type: "function" }] as any, contractAddress);
      const tx: any = contract.methods.createRebornPosition(parentId).send({ from: account });
      tx.on("transactionHash", (hash: string) => setRebornTx(hash));
      await tx; await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "สร้าง Reborn ไม่สำเร็จ"); setRebornTx(""); }
  };

  return <section className="mt-6 space-y-6">
    <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">On-chain referral systems</p><p className="mt-1 text-xs text-slate-500">แยกผัง A และผัง B จาก Event ของ Contract โดยตรง ไม่สร้างข้อมูลจากการคาดเดา</p></div><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /> รีเฟรช</button></div>
    {error && <p className="rounded-xl bg-rose-50 p-3 text-xs leading-5 text-rose-800">{error}</p>}

    <TreeBox tone="a" title="My referral tree · ผัง A" subtitle="กราฟิกแสดง Root Wallet และสมาชิกที่สมัครผ่าน ReferralRegistered">
      <TreeGraphic account={account} referrals={filteredReferrals} reborns={reborns} tone="a" />
      <div className="border-t border-teal-100 bg-teal-50/30 p-4"><div className="grid gap-3 md:grid-cols-[1fr_auto_auto]"><label className="relative block"><Search size={15} className="absolute left-3 top-3 text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="ค้นหา Wallet, Ticket หรือ Tx Hash" className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none focus:border-teal-400" /></label><label className="relative block"><Filter size={15} className="absolute left-3 top-3 text-slate-400" /><select value={commissionFilter} onChange={event => setCommissionFilter(event.target.value as CommissionFilter)} className="h-10 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none"><option value="all">ทุกสถานะ commission</option><option value="unverified">ยังไม่มีหลักฐาน commission</option><option value="confirmed">มีหลักฐาน commission</option></select></label><span className="self-center text-xs font-semibold text-slate-500">พบ {filteredReferrals.length} รายการ</span></div>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-xs font-semibold text-slate-500"><tr><th className="px-3 py-2">สมาชิก</th><th className="px-3 py-2">Ticket</th><th className="px-3 py-2">ผู้แนะนำ</th><th className="px-3 py-2">สถานะ commission</th><th className="px-3 py-2 text-right">หลักฐาน</th></tr></thead><tbody className="divide-y divide-teal-100">{filteredReferrals.map(item => <tr key={`${item.hash}-${item.ticketId}`}><td className="px-3 py-3 font-mono text-xs">{shortAddress(item.recipient)}</td><td className="px-3 py-3 font-bold">#{item.ticketId}</td><td className="px-3 py-3 font-mono text-xs">{shortAddress(item.registeredBy)}</td><td className="px-3 py-3"><span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600"><AlertCircle size={12} /> ไม่มี commission event</span></td><td className="px-3 py-3 text-right"><a href={`${EXPLORER}/tx/${item.hash}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 underline">ดู Tx <ExternalLink size={12} /></a></td></tr>)}</tbody></table>{!filteredReferrals.length && <p className="p-5 text-center text-xs text-slate-400">ไม่พบรายการตามคำค้นหาหรือตัวกรอง</p>}</div></div>
    </TreeBox>

    <TreeBox tone="b" title="My Reborn tree · ผัง B" subtitle="กราฟิกแสดง Root และ Successor จาก Reborn(parentId → successorId) โดยตรง">
      {loading && <div className="flex items-center gap-2 border-b border-violet-100 bg-violet-50/40 px-5 py-3 text-xs font-semibold text-violet-700"><Loader2 size={14} className="animate-spin" />กำลังอ่าน Event ผัง B…</div>}
      <TreeGraphic account={account} referrals={referrals} reborns={reborns} tone="b" />
      <div className="border-t border-violet-100 bg-violet-50/40 p-4 text-xs leading-5 text-violet-900"><p className="font-semibold">การทำรายการ Reborn</p><p className="mt-1">ต้องเป็น Position ที่ Parent `Claimed` แล้วเท่านั้น และ Successor จะเริ่มเป็น UNFUNDED ตามสถานะจริงของ Contract</p><div className="mt-3 flex flex-wrap gap-2">{Array.from(new Set(referrals.map(item => item.ticketId))).map(id => <button key={id} type="button" onClick={() => setConfirmParent(id)} disabled={rebornTx === "pending"} className="inline-flex items-center gap-1 rounded-lg bg-violet-700 px-3 py-2 text-[11px] font-bold text-white hover:bg-violet-800 disabled:opacity-50"><GitBranch size={13} />สร้าง Reborn จาก #{id}</button>)}</div>{rebornTx === "pending" && <p className="mt-3 inline-flex items-center gap-2 font-semibold text-violet-700"><Loader2 size={14} className="animate-spin" />กำลังรอ MetaMask และ Receipt…</p>}{rebornTx && rebornTx !== "pending" && <a className="mt-2 block font-mono text-[10px] underline" href={`${EXPLORER}/tx/${rebornTx}`} target="_blank" rel="noreferrer">Reborn Tx: {shortAddress(rebornTx)}</a>}</div>
    </TreeBox>

    {confirmParent && <div className="fixed inset-0 z-[110] grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm" role="presentation"><section role="dialog" aria-modal="true" className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-violet-100 bg-violet-50 p-5"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-600">Confirm on-chain action</p><h3 className="mt-1 text-lg font-bold text-slate-900">สร้าง Reborn จาก Position #{confirmParent}?</h3></div><button type="button" onClick={() => setConfirmParent(null)} className="rounded-lg p-2 text-slate-500 hover:bg-white" aria-label="ปิด"><X size={18} /></button></div><div className="space-y-3 p-5 text-sm text-slate-600"><p>ระบบจะเรียก `createRebornPosition(#{confirmParent})` บน BSC Mainnet และเปิด MetaMask ให้คุณตรวจ Gas ก่อนยืนยัน</p><div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><p className="font-semibold">ตรวจสอบก่อนกดยืนยัน</p><p>Parent ต้องอยู่สถานะ Claimed แล้ว · Successor จะเป็น UNFUNDED · การสร้างรายการนี้ไม่ใช่หลักฐานว่ามี commission หรือการจ่ายเงิน</p></div><div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setConfirmParent(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600">ยกเลิก</button><button type="button" onClick={() => void createReborn(confirmParent)} className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2 text-xs font-bold text-white hover:bg-violet-800"><CheckCircle2 size={14} />ยืนยันและเปิด MetaMask</button></div></div></section></div>}
    <p className="text-[11px] leading-5 text-slate-400">หมายเหตุ: commission จะแสดงเป็นหลักฐานยืนยันได้ต่อเมื่อมี Event หรือ Token Transfer ที่ตรงกันบนเชนเท่านั้น</p>
  </section>;
}
