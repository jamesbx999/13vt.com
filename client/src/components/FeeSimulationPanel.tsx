import { FormEvent, useMemo, useState } from "react";
import Web3 from "web3";
import { AlertTriangle, CheckCircle2, Code2, Loader2, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const SERVICE_FEE_WEI = "1300000000000000";
const TOKEN_AMOUNT = "13";
const REGISTER_ABI = [{ type: "function", name: "registerPosition", stateMutability: "payable", inputs: [{ name: "recipient", type: "address" }], outputs: [{ name: "ticketId", type: "uint256" }] }] as const;

type Copy = { title: string; subtitle: string; dryRun: string; contract: string; recipient: string; token: string; fee: string; simulate: string; connect: string; noWallet: string; invalid: string; ready: string; chain: string; noContract: string; gas: string; calldata: string; warning: string; noBroadcast: string; approve: string };
const copy: Record<string, Copy> = {
  en: { title: "Fee & deposit dry-run", subtitle: "Simulate the future registerPosition call without sending BNB or tokens.", dryRun: "DRY-RUN ONLY", contract: "Queue contract address", recipient: "Recipient wallet", token: "Token deposit", fee: "Service fee", simulate: "Simulate call", connect: "Use connected wallet", noWallet: "No wallet account is available. Connect a wallet first, then retry.", invalid: "Enter valid contract and recipient addresses.", ready: "Simulation request is valid and was not broadcast.", chain: "Connected chain", noContract: "Enter a deployed testnet queue contract address to run eth_call/estimateGas. The calldata is still generated locally.", gas: "Estimated gas", calldata: "registerPosition calldata", warning: "This panel does not call approve, transferFrom, or sendTransaction. A real contract must be independently reviewed before any Testnet use.", noBroadcast: "No transaction was sent", approve: "A real flow needs a separate token approve before registerPosition." },
  de: { title: "Gebühren- und Einzahlungs-Test", subtitle: "Simuliert registerPosition ohne BNB- oder Token-Übertragung.", dryRun: "NUR TEST", contract: "Adresse des Queue-Contracts", recipient: "Empfänger-Wallet", token: "Token-Einzahlung", fee: "Servicegebühr", simulate: "Aufruf simulieren", connect: "Verbundene Wallet nutzen", noWallet: "Keine Wallet verfügbar.", invalid: "Gültige Contract- und Empfängeradressen eingeben.", ready: "Simulation gültig; nichts gesendet.", chain: "Verbundene Chain", noContract: "Testnet-Contract-Adresse eingeben; Calldata wird lokal erzeugt.", gas: "Geschätztes Gas", calldata: "registerPosition-Calldata", warning: "Dieses Panel ruft approve, transferFrom oder sendTransaction nicht auf.", noBroadcast: "Keine Transaktion gesendet", approve: "Ein echter Ablauf benötigt zuerst token approve." },
  zh: { title: "费用与存款模拟", subtitle: "模拟 registerPosition，不发送 BNB 或代币。", dryRun: "仅模拟", contract: "队列合约地址", recipient: "收款钱包", token: "代币存款", fee: "服务费", simulate: "模拟调用", connect: "使用已连接钱包", noWallet: "没有可用钱包账户。", invalid: "请输入有效的合约和收款地址。", ready: "模拟请求有效，未广播。", chain: "连接网络", noContract: "输入测试网合约地址后可运行 eth_call/estimateGas；calldata 已在本地生成。", gas: "预估 Gas", calldata: "registerPosition calldata", warning: "此面板不会调用 approve、transferFrom 或 sendTransaction。", noBroadcast: "未发送交易", approve: "真实流程需要先单独 approve 代币。" },
  lo: { title: "ຈຳລອງຄ່າທຳນຽມ/ຝາກ", subtitle: "ຈຳລອງ registerPosition ໂດຍບໍ່ສົ່ງ BNB ຫຼື token.", dryRun: "ຈຳລອງເທົ່ານັ້ນ", contract: "ທີ່ຢູ່ Queue contract", recipient: "Wallet ຜູ້ຮັບ", token: "ຝາກ Token", fee: "ຄ່າບໍລິການ", simulate: "ຈຳລອງ", connect: "ໃຊ້ Wallet ທີ່ເຊື່ອມ", noWallet: "ບໍ່ພົບ Wallet.", invalid: "ໃສ່ທີ່ຢູ່ໃຫ້ຖືກຕ້ອງ.", ready: "ການຈຳລອງຖືກຕ້ອງ; ບໍ່ໄດ້ສົ່ງ.", chain: "Chain ທີ່ເຊື່ອມ", noContract: "ໃສ່ທີ່ຢູ່ contract Testnet; calldata ຖືກສ້າງໃນເຄື່ອງ.", gas: "Gas ຄາດຄະເນ", calldata: "registerPosition calldata", warning: "ໜ້ານີ້ບໍ່ເອີ້ນ approve, transferFrom ຫຼື sendTransaction.", noBroadcast: "ບໍ່ໄດ້ສົ່ງທຸລະກຳ", approve: "ການໃຊ້ງານຈິງຕ້ອງ approve token ແຍກກ່ອນ." },
  th: { title: "จำลองค่าธรรมเนียมและเงินฝาก", subtitle: "จำลอง registerPosition โดยไม่ส่ง BNB หรือโทเคนจริง", dryRun: "จำลองเท่านั้น", contract: "ที่อยู่ Queue Contract", recipient: "Wallet ผู้รับ", token: "เงินฝาก Token", fee: "ค่าบริการ", simulate: "จำลองการเรียก", connect: "ใช้ Wallet ที่เชื่อมต่อ", noWallet: "ไม่พบบัญชี Wallet", invalid: "กรุณาใส่ที่อยู่ Contract และผู้รับให้ถูกต้อง", ready: "ข้อมูลจำลองถูกต้องและยังไม่ได้ส่งธุรกรรม", chain: "เครือข่ายที่เชื่อมต่อ", noContract: "ใส่ที่อยู่ Queue Contract บน Testnet เพื่อรัน eth_call/estimateGas; calldata ถูกสร้างไว้แล้ว", gas: "Gas โดยประมาณ", calldata: "ข้อมูลเรียก registerPosition", warning: "หน้านี้ไม่เรียก approve, transferFrom หรือ sendTransaction และยังไม่จ่ายเงินจริง", noBroadcast: "ไม่มีธุรกรรมถูกส่ง", approve: "การใช้งานจริงต้อง approve Token แยกก่อนเรียก registerPosition" },
};

export function FeeSimulationPanel() {
  const { language } = useLanguage();
  const text = copy[language] || copy.en;
  const [contract, setContract] = useState("");
  const [recipient, setRecipient] = useState("");
  const [status, setStatus] = useState("");
  const [gas, setGas] = useState("");
  const [chain, setChain] = useState("");
  const [busy, setBusy] = useState(false);
  const web3 = useMemo(() => new Web3(), []);
  const valid = web3.utils.isAddress(contract.trim()) && web3.utils.isAddress(recipient.trim());
  const calldata = valid ? web3.eth.abi.encodeFunctionCall(REGISTER_ABI as any, [recipient.trim()]) : "";

  async function useWallet() {
    const accounts = await window.ethereum?.request?.({ method: "eth_accounts" });
    if (accounts?.[0]) setRecipient(accounts[0]);
    else setStatus(text.noWallet);
  }

  async function simulate(event: FormEvent) {
    event.preventDefault();
    setStatus(""); setGas(""); setChain("");
    if (!valid) { setStatus(text.invalid); return; }
    setBusy(true);
    try {
      const provider = window.ethereum;
      if (!provider?.request) { setStatus(text.noWallet); return; }
      const chainId = await provider.request({ method: "eth_chainId" });
      setChain(`${chainId} (${parseInt(chainId, 16)})`);
      if (contract.trim() && (await provider.request({ method: "eth_getCode", params: [contract.trim(), "latest"] })) === "0x") {
        setStatus(text.noContract);
        return;
      }
      const estimated = await provider.request({ method: "eth_estimateGas", params: [{ from: recipient.trim(), to: contract.trim(), value: `0x${BigInt(SERVICE_FEE_WEI).toString(16)}`, data: calldata }] });
      setGas(BigInt(estimated).toString(10));
      setStatus(text.ready);
    } catch (error) {
      setStatus(error instanceof Error ? `${text.noBroadcast}: ${error.message}` : text.noBroadcast);
    } finally { setBusy(false); }
  }

  return <section aria-label={text.title} className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-lg font-bold text-slate-900">{text.title}</h2><p className="mt-1 text-xs leading-5 text-slate-600">{text.subtitle}</p></div>
      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">{text.dryRun}</span>
    </div>
    <form onSubmit={simulate} className="mt-4 space-y-3">
      <input aria-label={text.contract} value={contract} onChange={e => setContract(e.target.value)} placeholder={text.contract} className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100" />
      <div className="flex gap-2"><input aria-label={text.recipient} value={recipient} onChange={e => setRecipient(e.target.value)} placeholder={text.recipient} className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100" /><button type="button" onClick={useWallet} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold">{text.connect}</button></div>
      <div className="grid gap-2 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] text-slate-500">{text.token}</p><p className="mt-1 font-semibold text-slate-900">{TOKEN_AMOUNT} token units</p></div><div className="rounded-xl bg-amber-50 p-3"><p className="text-[11px] text-amber-700">{text.fee}</p><p className="mt-1 font-mono text-xs font-semibold text-amber-950">0.0013 BNB</p><p className="font-mono text-[10px] text-amber-800">{SERVICE_FEE_WEI} wei</p></div><button type="submit" disabled={!valid || busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? <Loader2 size={15} className="animate-spin motion-reduce:animate-none" /> : <ShieldCheck size={15} />} {text.simulate}</button></div>
    </form>
    {status && <div role="status" aria-live="polite" className={`mt-4 rounded-xl border p-3 text-xs ${status === text.ready ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-950"}`}><p className="flex items-center gap-2 font-semibold">{status === text.ready ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />} {status}</p>{chain && <p className="mt-1">{text.chain}: {chain}</p>}{gas && <p className="mt-1">{text.gas}: {gas}</p>}</div>}
    {calldata && <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3"><summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold"><Code2 size={14} /> {text.calldata}</summary><code className="mt-2 block break-all text-[10px] leading-4 text-slate-600">{calldata}</code></details>}
    <div className="mt-4 space-y-1 rounded-xl bg-slate-950 p-3 text-xs leading-5 text-slate-300"><p className="font-semibold text-amber-300">{text.noBroadcast}</p><p>{text.warning}</p><p>{text.approve}</p></div>
  </section>;
}
