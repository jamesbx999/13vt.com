import { ShieldCheck } from "lucide-react";
import type { ReferralStatus } from "@/lib/queue";
import { shortAddress } from "@/lib/queue";

type Props = {
  status: ReferralStatus | null;
  ownerAddress: string;
  error?: string;
};

export function ContractStatusCard({ status, ownerAddress, error }: Props) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
      <div className="mb-4 flex items-center gap-2">
        <ShieldCheck className="text-teal-600" size={18} />
        <h2 className="font-bold tracking-tight">สิทธิ์และ Status Contract</h2>
      </div>
      <div className="space-y-3 text-xs">
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-500">Owner</span>
          <code className="font-mono text-slate-700">
            {shortAddress(status?.owner || ownerAddress)}
          </code>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-500">Wallet ปัจจุบันเป็น Admin</span>
          <span className="font-bold text-slate-800">
            {status ? (status.walletAdmin ? "ใช่" : "ไม่ใช่") : "กำลังอ่าน…"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-500">Contract writes</span>
          <span
            className={`font-bold ${status?.paused ? "text-amber-700" : "text-emerald-700"}`}
          >
            {status ? (status.paused ? "หยุดชั่วคราว" : "เปิดใช้งาน") : "กำลังอ่าน…"}
          </span>
        </div>
      </div>
      {error && <p className="mt-3 text-[11px] leading-4 text-rose-700">{error}</p>}
      <p className="mt-4 text-[10px] leading-4 text-slate-400">
        Admin Controls จะแสดงเมื่อเชื่อมต่อ Owner/Admin และทุกคำสั่งต้องยืนยันผ่าน MetaMask
      </p>
    </section>
  );
}
