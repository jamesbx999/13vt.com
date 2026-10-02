import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { BrowserProvider, Contract, JsonRpcProvider } from "ethers";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { UpgradeableOwnerPanel } from "@/components/UpgradeableOwnerPanel";
import { BscScanVerificationPanel } from "@/components/BscScanVerificationPanel";
import { AdminOperationsPanel } from "@/components/AdminOperationsPanel";
import { ContractStatusCard } from "@/components/ContractStatusCard";
import { readReferralStatus, type ReferralStatus } from "@/lib/queue";

const PROXY =
  import.meta.env.VITE_ONCHAIN_PROXY_ADDRESS ||
  import.meta.env.VITE_MAINNET_UPGRADEABLE_PROXY_ADDRESS ||
  "0x56ed01a6b08ac9ba88f9c88ee5c1455410b2cc06";
const EXPLORER = "https://bscscan.com";
const RPC_URL = "https://bsc-rpc.publicnode.com";
const OWNER_ABI = ["function owner() view returns (address)"];

declare global {
  interface Window {
    ethereum?: any;
  }
}

export default function AdminPage() {
  const [account, setAccount] = useState("");
  const [owner, setOwner] = useState("");
  const [state, setState] = useState<
    "idle" | "checking" | "granted" | "denied" | "error"
  >("idle");
  const [message, setMessage] = useState(
    "เชื่อมต่อ Wallet Owner เพื่อยืนยันสิทธิ์"
  );
  const [contractStatus, setContractStatus] = useState<ReferralStatus | null>(null);
  const [contractStatusError, setContractStatusError] = useState("");
  const readProvider = new JsonRpcProvider(RPC_URL, 56);

  async function verifyOwner() {
    try {
      if (!window.ethereum)
        throw new Error("ไม่พบ MetaMask หรือ Wallet provider");
      setState("checking");
      const provider = new BrowserProvider(window.ethereum);
      if ((await provider.getNetwork()).chainId !== BigInt(56)) {
        throw new Error(
          "กรุณาเปลี่ยน Wallet เป็น BNB Smart Chain Mainnet (Chain ID 56)"
        );
      }
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const contractOwner = await new Contract(
        PROXY,
        OWNER_ABI,
        readProvider
      ).owner();
      setAccount(address);
      setOwner(contractOwner);
      if (address.toLowerCase() !== contractOwner.toLowerCase()) {
        setState("denied");
        setMessage("Wallet นี้ไม่ใช่ Owner — หน้าจัดการถูกล็อกไว้");
        return;
      }
      setState("granted");
      setMessage("ยืนยันสิทธิ์ Owner สำเร็จ");
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error ? error.message : "ตรวจสอบสิทธิ์ไม่สำเร็จ"
      );
    }
  }

  useEffect(() => {
    const onAccountsChanged = () => {
      setState("idle");
      setAccount("");
      setMessage("Wallet เปลี่ยนแล้ว กรุณายืนยันสิทธิ์อีกครั้ง");
    };
    window.ethereum?.on?.("accountsChanged", onAccountsChanged);
    return () =>
      window.ethereum?.removeListener?.("accountsChanged", onAccountsChanged);
  }, []);

  useEffect(() => {
    if (state !== "granted" || !window.ethereum || !account) return;
    let cancelled = false;
    setContractStatusError("");
    void readReferralStatus(window.ethereum, PROXY, account, owner || account)
      .then(status => {
        if (!cancelled) setContractStatus(status);
      })
      .catch(error => {
        if (!cancelled) {
          setContractStatus(null);
          setContractStatusError(
            error instanceof Error ? error.message : "อ่านสถานะ Contract ไม่สำเร็จ"
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [account, owner, state]);

  if (state !== "granted") {
    const denied = state === "denied";
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8">
        <section
          className="w-full max-w-lg rounded-3xl border border-white/10 bg-white p-7 shadow-2xl sm:p-9"
          aria-live="polite"
        >
          <div
            className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${denied ? "bg-rose-100 text-rose-700" : "bg-violet-100 text-violet-700"}`}
          >
            {state === "checking" ? (
              <Loader2 className="animate-spin" />
            ) : denied ? (
              <LockKeyhole />
            ) : (
              <ShieldCheck />
            )}
          </div>
          <h1 className="mt-5 text-center text-2xl font-bold tracking-tight">
            Owner verification required
          </h1>
          <p className="mt-2 text-center text-sm leading-6 text-slate-500">
            {message}
          </p>
          {(account || owner) && (
            <div className="mt-5 space-y-2 rounded-2xl bg-slate-50 p-4 font-mono text-xs text-slate-600">
              <p>Connected: {account || "—"}</p>
              <p>Contract owner: {owner || "—"}</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => void verifyOwner()}
            disabled={state === "checking"}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-800 disabled:opacity-50"
          >
            <Wallet size={17} />{" "}
            {state === "checking"
              ? "กำลังตรวจสอบ…"
              : "Connect & verify Owner wallet"}
          </button>
          <a
            href="/"
            className="mt-4 block text-center text-xs font-semibold text-slate-500 hover:text-violet-700"
          >
            กลับหน้า User dashboard
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-4 py-6 text-slate-900 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
          <div className="relative p-6 sm:p-8 lg:p-10">
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">
                  <LockKeyhole size={15} /> Private owner area · Mainnet
                </div>
                <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">
                  Protocol administration
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                  ตรวจสอบ Proxy, Implementation, Owner และค่าพารามิเตอร์ของสัญญา
                  ก่อนส่งคำสั่งเปลี่ยนแปลงใด ๆ บน BNB Smart Chain Mainnet
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
                BNB Smart Chain · Chain ID 56
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
          <ContractStatusCard
            status={contractStatus}
            ownerAddress={owner || PROXY}
            error={contractStatusError}
          />
        </div>

        <div className="mt-6">
          <UpgradeableOwnerPanel verifiedAccount={account} />
        </div>

        <BscScanVerificationPanel />

        <AdminOperationsPanel proxy={PROXY} />

        <p className="mt-5 text-center text-xs leading-5 text-slate-500">
          หน้านี้แสดงข้อมูลอ่านจากเชนโดยตรง ปุ่ม setter จะเปิดใช้งานเฉพาะเมื่อ
          Wallet ที่เชื่อมต่อเป็น Owner และต้องยืนยันธุรกรรมใน MetaMask ทุกครั้ง
        </p>
      </div>
    </main>
  );
}
