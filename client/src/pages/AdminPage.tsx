import {
  ArrowLeft,
  ExternalLink,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { Link } from "wouter";
import { UpgradeableOwnerPanel } from "@/components/UpgradeableOwnerPanel";

const PROXY =
  import.meta.env.VITE_TESTNET_UPGRADEABLE_PROXY_ADDRESS ||
  "0x3a358d2151b0aD8adB9f8C218bD2B268d53654eE";
const EXPLORER = "https://testnet.bscscan.com";

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-[#f5f7fb] px-4 py-6 text-slate-900 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
          <div className="relative p-6 sm:p-8 lg:p-10">
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">
                  <LockKeyhole size={15} /> Private owner area · Testnet
                </div>
                <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">
                  Protocol administration
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                  ตรวจสอบ Proxy, Implementation, Owner และค่าพารามิเตอร์ของสัญญา
                  ก่อนส่งคำสั่งเปลี่ยนแปลงใด ๆ บน BNB Smart Chain Testnet
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 font-semibold text-white transition hover:bg-white/15"
                >
                  <ArrowLeft size={15} /> User dashboard
                </Link>
                <a
                  href={`${EXPLORER}/address/${PROXY}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-400 px-4 py-2.5 font-bold text-slate-950 transition hover:bg-violet-300"
                >
                  <ExternalLink size={15} /> View Proxy
                </a>
              </div>
            </div>
          </div>
          <div className="grid border-t border-white/10 sm:grid-cols-3">
            <div className="flex items-center gap-3 p-4 sm:p-5">
              <ShieldCheck className="text-emerald-300" size={19} />
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400">
                  Access
                </p>
                <p className="text-sm font-bold">Owner controls</p>
              </div>
            </div>
            <div className="border-t border-white/10 p-4 sm:border-l sm:border-t-0 sm:p-5">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">
                Network
              </p>
              <p className="mt-1 text-sm font-bold">
                BNB Smart Chain · Chain ID 97
              </p>
            </div>
            <div className="border-t border-white/10 p-4 sm:border-l sm:border-t-0 sm:p-5">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">
                Proxy
              </p>
              <p className="mt-1 truncate font-mono text-xs text-violet-200">
                {PROXY}
              </p>
            </div>
          </div>
        </header>

        <div className="mt-6">
          <UpgradeableOwnerPanel />
        </div>

        <p className="mt-5 text-center text-xs leading-5 text-slate-500">
          หน้านี้แสดงข้อมูลอ่านจากเชนโดยตรง ปุ่ม setter จะเปิดใช้งานเฉพาะเมื่อ
          Wallet ที่เชื่อมต่อเป็น Owner และต้องยืนยันธุรกรรมใน MetaMask ทุกครั้ง
        </p>
      </div>
    </main>
  );
}
