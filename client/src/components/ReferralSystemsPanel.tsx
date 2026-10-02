import { useCallback, useEffect, useState } from "react";
import { ExternalLink, GitBranch, Loader2, RefreshCw, ShieldCheck, Users } from "lucide-react";
import {
  RebornEvent,
  ReferralPathEvent,
  readRebornEvents,
  readReferralPathEvents,
  shortAddress,
} from "@/lib/queue";

type Props = { provider?: any; contractAddress: string; account: string; refreshInterval?: number };
const EXPLORER = "https://bscscan.com";

function TreeBox({ title, subtitle, tone, children }: { title: string; subtitle: string; tone: "a" | "b"; children: React.ReactNode }) {
  return (
    <section className={`overflow-hidden rounded-2xl border bg-white shadow-[0_12px_40px_rgba(15,23,42,0.04)] ${tone === "a" ? "border-teal-200" : "border-violet-200"}`}>
      <div className={`flex items-start gap-3 border-b p-5 ${tone === "a" ? "border-teal-100 bg-teal-50/60" : "border-violet-100 bg-violet-50/60"}`}>
        <div className={`mt-0.5 grid h-9 w-9 place-items-center rounded-xl ${tone === "a" ? "bg-teal-600 text-white" : "bg-violet-600 text-white"}`}>
          {tone === "a" ? <Users size={17} /> : <GitBranch size={17} />}
        </div>
        <div>
          <h2 className="text-lg font-bold tracking-tight">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export function ReferralSystemsPanel({ provider, contractAddress, account, refreshInterval = 15 }: Props) {
  const [referrals, setReferrals] = useState<ReferralPathEvent[]>([]);
  const [reborns, setReborns] = useState<RebornEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rebornTx, setRebornTx] = useState("");

  const load = useCallback(async () => {
    if (!provider || !account) return;
    setLoading(true);
    setError("");
    try {
      const [a, b] = await Promise.all([
        readReferralPathEvents(provider, contractAddress, account),
        readRebornEvents(provider, contractAddress, account),
      ]);
      setReferrals(a);
      setReborns(b);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "อ่าน Event ผัง A/B ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [provider, contractAddress, account]);

  useEffect(() => {
    void load();
    if (!provider || !account || refreshInterval <= 0) return;
    const timer = window.setInterval(() => void load(), refreshInterval * 1000);
    return () => window.clearInterval(timer);
  }, [load, provider, account, refreshInterval]);

  const createReborn = async (parentId: string) => {
    if (!provider || !account || !window.confirm(`สร้าง Reborn จาก Position #${parentId} บน BSC Mainnet? ต้องเป็น Position ที่ Claimed แล้ว`)) return;
    setRebornTx("pending");
    try {
      const web3 = new (await import("web3")).default(provider);
      const contract: any = new web3.eth.Contract([
        { inputs: [{ name: "parentId", type: "uint256" }], name: "createRebornPosition", outputs: [{ name: "successorId", type: "uint256" }], stateMutability: "nonpayable", type: "function" },
      ] as any, contractAddress);
      const tx: any = contract.methods.createRebornPosition(parentId).send({ from: account });
      tx.on("transactionHash", (hash: string) => setRebornTx(hash));
      await tx;
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "สร้าง Reborn ไม่สำเร็จ");
      setRebornTx("");
    }
  };

  return (
    <section className="mt-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">On-chain referral systems</p>
          <p className="mt-1 text-xs text-slate-500">แยกผัง A และผัง B จาก Event ของ Contract โดยตรง ไม่สร้างข้อมูลจากการคาดเดา</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> รีเฟรช
        </button>
      </div>
      {error && <p className="rounded-xl bg-rose-50 p-3 text-xs leading-5 text-rose-800">{error}</p>}

      <TreeBox tone="a" title="My referral tree · ผัง A" subtitle="สมาชิกที่สมัครผ่านลิงก์ของ Wallet นี้ อ้างอิงจาก ReferralRegistered เท่านั้น">
        {loading && !referrals.length ? <div className="p-8 text-center text-sm text-slate-400"><Loader2 className="mr-2 inline animate-spin" size={16} />กำลังอ่าน Event ผัง A…</div> : referrals.length === 0 ? <div className="p-8 text-center text-sm text-slate-400">ยังไม่มีสมาชิกที่สมัครผ่านลิงก์นี้</div> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold text-slate-500"><tr><th className="px-5 py-3">สมาชิก</th><th className="px-5 py-3">Ticket</th><th className="px-5 py-3">ผู้แนะนำ</th><th className="px-5 py-3">สถานะค่าคอมมิชชัน</th><th className="px-5 py-3">หลักฐาน</th></tr></thead><tbody className="divide-y divide-slate-100">{referrals.map(item => <tr key={`${item.hash}-${item.ticketId}`}><td className="px-5 py-4 font-mono text-xs">{shortAddress(item.recipient)}</td><td className="px-5 py-4 font-bold">#{item.ticketId}</td><td className="px-5 py-4 font-mono text-xs">{shortAddress(item.registeredBy)}</td><td className="px-5 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">ไม่มี commission event ใน Contract รุ่นนี้</span></td><td className="px-5 py-4 text-right"><a href={`${EXPLORER}/tx/${item.hash}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 underline">ดู Tx <ExternalLink size={12} /></a></td></tr>)}</tbody></table></div>}
      </TreeBox>

      <TreeBox tone="b" title="My Reborn tree · ผัง B" subtitle="Position ต่อจาก Reborn ของ Wallet นี้ อ้างอิงจาก Reborn(parentId → successorId) โดยตรง">
        {loading && !reborns.length ? <div className="p-8 text-center text-sm text-slate-400"><Loader2 className="mr-2 inline animate-spin" size={16} />กำลังอ่าน Event ผัง B…</div> : reborns.length === 0 ? <div className="p-8 text-center text-sm text-slate-400">ยังไม่มี Reborn Position ที่ยืนยันบนเชน</div> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-violet-50/60 text-xs font-semibold text-violet-700"><tr><th className="px-5 py-3">Parent · ผัง A</th><th className="px-5 py-3">Successor · ผัง B</th><th className="px-5 py-3">ผู้ถือ Position</th><th className="px-5 py-3">สถานะ</th><th className="px-5 py-3">หลักฐาน</th></tr></thead><tbody className="divide-y divide-slate-100">{reborns.map(item => <tr key={`${item.hash}-${item.successorId}`}><td className="px-5 py-4 font-bold">#{item.parentId}</td><td className="px-5 py-4 font-bold text-violet-700">#{item.successorId}</td><td className="px-5 py-4 font-mono text-xs">{shortAddress(item.recipient)}</td><td className="px-5 py-4"><span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700"><ShieldCheck size={12} /> UNFUNDED · รอการจัดสรร</span></td><td className="px-5 py-4 text-right"><a href={`${EXPLORER}/tx/${item.hash}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 underline">ดู Tx <ExternalLink size={12} /></a></td></tr>)}</tbody></table></div>}
        <div className="border-t border-violet-100 bg-violet-50/40 p-4 text-xs leading-5 text-violet-900">
          <p className="font-semibold">ปุ่ม Reborn</p>
          <p className="mt-1">ฟังก์ชันจริงต้องเรียกหลัง Parent `Claimed` แล้วเท่านั้น และ Contract รุ่นนี้สร้าง Successor แบบ UNFUNDED; ไม่มีการโอน commission อัตโนมัติในคำสั่งนี้</p>
          <div className="mt-3 flex flex-wrap gap-2">{Array.from(new Set(referrals.map(item => item.ticketId))).map(id => <button key={id} type="button" onClick={() => void createReborn(id)} disabled={rebornTx === "pending"} className="rounded-lg bg-violet-700 px-3 py-2 text-[11px] font-bold text-white hover:bg-violet-800 disabled:opacity-50">สร้าง Reborn จาก #{id}</button>)}</div>
          {rebornTx && rebornTx !== "pending" && <a className="mt-2 block font-mono text-[10px] underline" href={`${EXPLORER}/tx/${rebornTx}`} target="_blank" rel="noreferrer">Reborn Tx: {shortAddress(rebornTx)}</a>}
        </div>
      </TreeBox>
      <p className="text-[11px] leading-5 text-slate-400">หมายเหตุ: UI นี้แยกผัง A/B เพื่อความชัดเจน แต่ไม่เปลี่ยนกฎ Smart Contract และไม่แสดง commission ที่ไม่มี Event/ยอดโอนยืนยันบนเชน</p>
    </section>
  );
}
