import { useState } from "react";
import { CheckCircle2, ExternalLink, KeyRound, Loader2, ShieldCheck, UploadCloud } from "lucide-react";
import { trpc } from "@/lib/trpc";

const PROXY = import.meta.env.VITE_ONCHAIN_PROXY_ADDRESS || import.meta.env.VITE_MAINNET_UPGRADEABLE_PROXY_ADDRESS || "0x56ed01a6b08ac9ba88f9c88ee5c1455410b2cc06";
const IMPLEMENTATION = import.meta.env.VITE_ONCHAIN_IMPLEMENTATION_ADDRESS || "0x3A5aBCb54BB8f42Ab0fe4dA1D81DD63B2B02d9b9";
const EXPLORER = "https://bscscan.com";

declare global { interface Window { ethereum?: any } }

function Field({ label, value, onChange, placeholder, mono = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; mono?: boolean }) {
  return <label className="block text-xs font-semibold text-slate-700"><span className="mb-1 block">{label}</span><input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={`w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs outline-none ring-violet-200 focus:ring-4 ${mono ? "font-mono" : ""}`} /></label>;
}

export function BscScanVerificationPanel() {
  const [sourceCode, setSourceCode] = useState("");
  const [contractName, setContractName] = useState("Transparent13VTQueueUpgradeable");
  const [compilerVersion, setCompilerVersion] = useState("v0.8.24+commit.e11b9ed9");
  const [optimizationUsed, setOptimizationUsed] = useState("1" as "0" | "1");
  const [runs, setRuns] = useState("200");
  const [constructorArguments, setConstructorArguments] = useState("");
  const [evmVersion, setEvmVersion] = useState("");
  const [licenseType, setLicenseType] = useState("3");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [proxyResult, setProxyResult] = useState<{ result?: string; message?: string } | null>(null);
  const [implementationResult, setImplementationResult] = useState<{ result?: string; message?: string } | null>(null);
  const nonce = trpc.siwe.requestNonce.useMutation();
  const siweVerify = trpc.siwe.verify.useMutation();
  const verifyImplementation = trpc.bscscan.verifyImplementation.useMutation();
  const verifyProxy = trpc.bscscan.verifyProxy.useMutation();

  async function ensureServerOwnerSession() {
    if (!window.ethereum) throw new Error("ไม่พบ Wallet provider");
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    const address = accounts?.[0];
    if (!address) throw new Error("ไม่พบ Wallet address");
    const chainId = Number.parseInt(await window.ethereum.request({ method: "eth_chainId" }), 16);
    if (chainId !== 56) throw new Error("กรุณาเปลี่ยน Wallet เป็น BSC Mainnet (Chain ID 56)");
    const response = await nonce.mutateAsync({ address, domain: window.location.host, uri: window.location.origin, chainId });
    const signature = await window.ethereum.request({ method: "personal_sign", params: [response.message, address] });
    await siweVerify.mutateAsync({ address, message: response.message, signature });
  }

  async function submitImplementation(event: React.FormEvent) {
    event.preventDefault(); setStatus(""); setError(""); setImplementationResult(null);
    try {
      if (sourceCode.trim().length < 100) throw new Error("กรุณาวาง flattened Solidity source code อย่างน้อย 100 ตัวอักษร");
      setStatus("กำลังยืนยัน Owner session และส่ง source code ไป BscScan…");
      await ensureServerOwnerSession();
      const result = await verifyImplementation.mutateAsync({ contractAddress: IMPLEMENTATION, sourceCode, contractName, compilerVersion, optimizationUsed, runs: Number(runs), constructorArguments, evmVersion, licenseType });
      setImplementationResult(result); setStatus("ส่งคำขอ Verify Implementation แล้ว");
    } catch (e) { setError(e instanceof Error ? e.message : "Verify Implementation ไม่สำเร็จ"); setStatus(""); }
  }

  async function submitProxy() {
    setStatus(""); setError(""); setProxyResult(null);
    try { setStatus("กำลังยืนยัน Owner session และส่งคำขอ Verify Proxy ไป BscScan…"); await ensureServerOwnerSession(); const result = await verifyProxy.mutateAsync({ proxyAddress: PROXY }); setProxyResult(result); setStatus("ส่งคำขอ Verify Proxy แล้ว"); }
    catch (e) { setError(e instanceof Error ? e.message : "Verify Proxy ไม่สำเร็จ"); setStatus(""); }
  }

  return <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-label="BscScan verification">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-violet-700"><ShieldCheck size={15} /> Explorer verification</div><h2 className="mt-2 text-xl font-bold text-slate-950">Verify on BscScan via API</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">การเรียก API ทำจาก server เท่านั้น API key ไม่ถูกส่งไป browser; ทุกคำขอต้องผ่าน SIWE session ของ Owner บน BSC Mainnet</p></div><span className="inline-flex h-fit items-center gap-1 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800"><KeyRound size={13} /> API key server-side</span></div>
    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      <form onSubmit={submitImplementation} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-bold text-slate-900">Implementation source</h3><a href={`${EXPLORER}/address/${IMPLEMENTATION}`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-violet-700">{IMPLEMENTATION.slice(0, 8)}… <ExternalLink className="inline" size={12} /></a></div><p className="mt-1 text-xs leading-5 text-slate-500">วาง flattened source ที่ตรงกับ bytecode และ compiler settings ของ Implementation</p><textarea value={sourceCode} onChange={e => setSourceCode(e.target.value)} placeholder="// SPDX-License-Identifier: MIT\npragma solidity ^0.8.24;\n…" className="mt-3 h-36 w-full rounded-xl border border-slate-200 bg-white p-3 font-mono text-[11px] outline-none focus:ring-4 focus:ring-violet-200" />
        <div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Contract name" value={contractName} onChange={setContractName} /><Field label="Compiler version" value={compilerVersion} onChange={setCompilerVersion} mono /><Field label="Optimization runs" value={runs} onChange={setRuns} /><label className="block text-xs font-semibold text-slate-700"><span className="mb-1 block">Optimization</span><select value={optimizationUsed} onChange={e => setOptimizationUsed(e.target.value as "0" | "1")} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs"><option value="1">Enabled</option><option value="0">Disabled</option></select></label><Field label="EVM version (optional)" value={evmVersion} onChange={setEvmVersion} placeholder="default" /><Field label="License type" value={licenseType} onChange={setLicenseType} /></div>
        <Field label="Constructor arguments (hex, no 0x)" value={constructorArguments} onChange={setConstructorArguments} mono placeholder="leave empty for implementation" /><button type="submit" disabled={verifyImplementation.isPending || nonce.isPending || siweVerify.isPending} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 py-3 text-xs font-bold text-white hover:bg-violet-800 disabled:opacity-50"><UploadCloud size={15} />{verifyImplementation.isPending ? "กำลังส่ง…" : "Verify Implementation"}</button></form>
      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-bold text-slate-900">UUPS Proxy</h3><a href={`${EXPLORER}/address/${PROXY}`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-violet-700">{PROXY.slice(0, 8)}… <ExternalLink className="inline" size={12} /></a></div><p className="mt-1 text-xs leading-5 text-slate-500">ส่งคำขอ verify proxy โดยใช้ Proxy address ที่ deploy แล้ว จากนั้นตรวจ implementation slot และ link บน BscScan</p><div className="mt-4 rounded-xl bg-white p-4 text-xs text-slate-600"><p className="font-semibold text-slate-900">Proxy address</p><p className="mt-1 break-all font-mono">{PROXY}</p><p className="mt-4 font-semibold text-slate-900">Implementation address</p><p className="mt-1 break-all font-mono">{IMPLEMENTATION}</p></div><button type="button" onClick={() => void submitProxy()} disabled={verifyProxy.isPending || nonce.isPending || siweVerify.isPending} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"><ShieldCheck size={15} />{verifyProxy.isPending ? "กำลังส่ง…" : "Verify Proxy"}</button>{proxyResult && <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900"><CheckCircle2 className="mr-1 inline" size={14} />{proxyResult.result} {proxyResult.message && `· ${proxyResult.message}`}</div>}</div>
    </div>
    {(status || error || implementationResult) && <div className={`mt-4 rounded-xl p-3 text-xs ${error ? "border border-rose-200 bg-rose-50 text-rose-800" : "border border-slate-200 bg-slate-50 text-slate-700"}`}>{status && <p>{status}</p>}{error && <p>{error}</p>}{implementationResult && <p className="mt-1 break-all"><CheckCircle2 className="mr-1 inline text-emerald-600" size={14} />BscScan response: {implementationResult.result} {implementationResult.message && `· ${implementationResult.message}`}</p>}</div>}
    <p className="mt-4 text-[11px] leading-5 text-slate-500">BscScan อาจใช้เวลาประมวลผลหลังได้รับ GUID; ใช้ GUID/ข้อความตอบกลับเพื่อตรวจสถานะใน Explorer ต่อไป และห้ามใส่ API key, private key หรือ seed phrase ในช่อง source/config</p>
  </section>;
}
