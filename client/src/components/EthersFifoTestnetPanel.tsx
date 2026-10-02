import { useMemo, useState } from "react";
import { BrowserProvider, Contract, JsonRpcProvider, formatUnits, parseEther, parseUnits } from "ethers";
import { CheckCircle2, ExternalLink, Loader2, ShieldCheck, Wallet } from "lucide-react";

const CHAIN_ID = BigInt(97);
const RPC_URL = "https://bsc-testnet-dataseed.bnbchain.org";
const EXPLORER = "https://testnet.bscscan.com";
const DEFAULT_QUEUE = "0x6575a3319271d1a2fc269b161ab57ed465103838";
const TOKEN_DECIMALS = 18;

declare global { interface Window { ethereum?: any } }

const QUEUE_ABI = [
  "function asset() view returns (address)",
  "function feeWallet() view returns (address)",
  "function totalClaimed() view returns (uint256)",
  "function totalReborn() view returns (uint256)",
  "function nextTicketId() view returns (uint256)",
  "function queueState() view returns (uint256 registered, uint256 waiting, uint256 scheduled, uint256 claimed, uint256 balance)",
  "function registerPosition(address recipient) payable returns (uint256)",
  "function fundNext(uint256 amount, uint256 recipientCount) returns (uint256 firstTicketId, uint256 lastTicketId, uint256 amountPerTicket)",
  "function claim(uint256 ticketId)",
  "function createRebornPosition(uint256 parentId)",
  "event Registered(uint256 indexed ticketId, address indexed payer, address indexed recipient, uint256 tokenAmount, uint256 serviceFeeWei)",
  "event RevenueScheduled(uint256 indexed firstTicketId, uint256 indexed lastTicketId, uint256 amount, uint256 amountPerTicket, address indexed funder)",
  "event Claimed(uint256 indexed ticketId, address indexed recipient, uint256 amount)",
  "event Reborn(uint256 indexed parentId, uint256 indexed successorId, address indexed recipient)",
];
const ERC20_ABI = ["function approve(address spender, uint256 amount) returns (bool)", "function allowance(address owner, address spender) view returns (uint256)", "function decimals() view returns (uint8)", "function symbol() view returns (string)"];

type ReadState = { asset: string; feeWallet: string; totalClaimed: string; totalReborn: string; nextTicketId: string; registered: string; waiting: string; scheduled: string; balance: string };

function short(value: string) { return value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "—"; }
function isAddress(value: string) { return /^0x[a-fA-F0-9]{40}$/.test(value); }

export function EthersFifoTestnetPanel() {
  const [queueAddress, setQueueAddress] = useState(DEFAULT_QUEUE);
  const [account, setAccount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("13");
  const [recipientCount, setRecipientCount] = useState("1");
  const [ticketId, setTicketId] = useState("1");
  const [parentId, setParentId] = useState("1");
  const [state, setState] = useState<ReadState | null>(null);
  const [status, setStatus] = useState("ยังไม่มีการส่งธุรกรรม");
  const [txHash, setTxHash] = useState("");
  const [busy, setBusy] = useState(false);
  const readProvider = useMemo(() => new JsonRpcProvider(RPC_URL, Number(CHAIN_ID)), []);

  function assertQueue() { if (!isAddress(queueAddress)) throw new Error("กรุณาใส่ Queue Contract address ที่ถูกต้อง"); }
  async function getWallet() {
    if (!window.ethereum) throw new Error("ไม่พบ MetaMask หรือ EIP-1193 wallet");
    const provider = new BrowserProvider(window.ethereum);
    const network = await provider.getNetwork();
    if (network.chainId !== CHAIN_ID) throw new Error("กรุณาเปลี่ยน Wallet เป็น BSC Testnet (Chain ID 97)");
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    setAccount(address); if (!recipient) setRecipient(address);
    return { provider, signer, address };
  }
  async function connect() { try { await getWallet(); setStatus("เชื่อมต่อ Wallet บน BSC Testnet แล้ว (ยังไม่มีธุรกรรมถูกส่ง)"); } catch (error) { setStatus(error instanceof Error ? error.message : "เชื่อมต่อ Wallet ไม่สำเร็จ"); } }
  async function readChain() {
    try {
      assertQueue(); setBusy(true); setStatus("กำลังอ่านข้อมูลจาก BSC Testnet…");
      const queue = new Contract(queueAddress, QUEUE_ABI, readProvider);
      const [asset, feeWallet, totalClaimed, totalReborn, nextTicketId, snapshot] = await Promise.all([queue.asset(), queue.feeWallet(), queue.totalClaimed(), queue.totalReborn(), queue.nextTicketId(), queue.queueState()]);
      setState({ asset, feeWallet, totalClaimed: formatUnits(totalClaimed, TOKEN_DECIMALS), totalReborn: String(totalReborn), nextTicketId: String(nextTicketId), registered: String(snapshot.registered), waiting: String(snapshot.waiting), scheduled: formatUnits(snapshot.scheduled, TOKEN_DECIMALS), balance: formatUnits(snapshot.balance, TOKEN_DECIMALS) });
      setStatus("อ่านข้อมูลสำเร็จ — read-only");
    } catch (error) { setStatus(error instanceof Error ? error.message : "อ่านข้อมูลไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  async function send(label: string, action: (signer: any) => Promise<any>) {
    try { assertQueue(); setBusy(true); setTxHash(""); const { signer } = await getWallet(); setStatus(`${label}: กรุณาตรวจสอบและยืนยันใน Wallet…`); const tx = await action(signer); setTxHash(tx.hash); setStatus(`${label}: broadcast แล้ว กำลังรอ receipt…`); const receipt = await tx.wait(); if (receipt?.status !== 1) throw new Error("ธุรกรรมถูก revert"); setStatus(`${label}: สำเร็จที่ block ${receipt.blockNumber}`); await readChain(); }
    catch (error) { setStatus(error instanceof Error ? error.message : `${label}: ไม่สำเร็จ`); }
    finally { setBusy(false); }
  }
  const approve = () => send("Approve token", async (signer) => { const token = new Contract(state?.asset || "0x0000000000000000000000000000000000000000", ERC20_ABI, signer); return token.approve(queueAddress, parseUnits(amount, TOKEN_DECIMALS)); });
  const register = () => send("Register position", async (signer) => new Contract(queueAddress, QUEUE_ABI, signer).registerPosition(recipient || account, { value: parseEther("0.0013") }));
  const fund = () => send("Fund FIFO", async (signer) => new Contract(queueAddress, QUEUE_ABI, signer).fundNext(parseUnits(amount, TOKEN_DECIMALS), BigInt(recipientCount)));
  const claim = () => send("Claim ticket", async (signer) => new Contract(queueAddress, QUEUE_ABI, signer).claim(BigInt(ticketId)));
  const reborn = () => send("Create Reborn position", async (signer) => new Contract(queueAddress, QUEUE_ABI, signer).createRebornPosition(BigInt(parentId)));

  return <section className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 shadow-sm sm:p-6" aria-label="Ethers.js FIFO Testnet panel">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">FIFO Contract · Ethers.js Testnet</h2><p className="mt-1 text-xs leading-5 text-slate-600">เชื่อมต่อ Contract บน BSC Testnet (97) พร้อมแยก read-only และธุรกรรมที่ต้องยืนยันใน Wallet</p></div><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900"><ShieldCheck size={13} className="mr-1 inline" />TESTNET ONLY</span></div>
    <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto_auto]"><input value={queueAddress} onChange={e => setQueueAddress(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs" aria-label="Queue Contract address" /><button type="button" onClick={() => void readChain()} disabled={busy} className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{busy ? <Loader2 size={14} className="mr-1 inline animate-spin" /> : null}Read state</button><button type="button" onClick={() => void connect()} disabled={busy} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold"><Wallet size={14} className="mr-1 inline" />{account ? short(account) : "Connect wallet"}</button></div>
    {state && <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-lg bg-white p-3">Registered: <b>{state.registered}</b></div><div className="rounded-lg bg-white p-3">Waiting: <b>{state.waiting}</b></div><div className="rounded-lg bg-white p-3">Claimed: <b>{state.totalClaimed}</b></div><div className="rounded-lg bg-white p-3">Reborn: <b>{state.totalReborn}</b></div><div className="rounded-lg bg-white p-3 font-mono">Asset: {short(state.asset)}</div><div className="rounded-lg bg-white p-3 font-mono">Fee wallet: {short(state.feeWallet)}</div></div>}
    <div className="mt-4 rounded-xl border border-amber-200 bg-white p-4"><p className="text-xs font-semibold text-amber-900">ธุรกรรมจริงบน Testnet</p><p className="mt-1 text-[11px] text-slate-500">แต่ละปุ่มจะเปิด Wallet ให้ตรวจ payload และ Gas ก่อนยืนยัน ไม่มีการส่งธุรกรรมอัตโนมัติ</p><div className="mt-3 grid gap-2 md:grid-cols-2"><input value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="Recipient address" className="rounded-lg border px-3 py-2 font-mono text-xs" /><input value={amount} onChange={e => setAmount(e.target.value)} placeholder="Token amount" inputMode="decimal" className="rounded-lg border px-3 py-2 text-xs" /><input value={recipientCount} onChange={e => setRecipientCount(e.target.value)} placeholder="Recipient count" inputMode="numeric" className="rounded-lg border px-3 py-2 text-xs" /><div className="flex flex-wrap gap-2"><button type="button" onClick={approve} disabled={busy || !state} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white">Approve token</button><button type="button" onClick={register} disabled={busy || !isAddress(recipient || account)} className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-bold text-white">Register + 0.0013 BNB</button><button type="button" onClick={fund} disabled={busy || !state} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white">Fund FIFO</button></div><input value={ticketId} onChange={e => setTicketId(e.target.value)} placeholder="Ticket ID to claim" inputMode="numeric" className="rounded-lg border px-3 py-2 text-xs" /><input value={parentId} onChange={e => setParentId(e.target.value)} placeholder="Parent ID for Reborn" inputMode="numeric" className="rounded-lg border px-3 py-2 text-xs" /><div className="flex flex-wrap gap-2"><button type="button" onClick={claim} disabled={busy || !state} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">Claim ticket</button><button type="button" onClick={reborn} disabled={busy || !state} className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-bold text-white">Create Reborn</button></div></div></div>
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600"><CheckCircle2 size={14} className="text-emerald-600" />{status}{txHash && <a href={`${EXPLORER}/tx/${txHash}`} target="_blank" rel="noreferrer" className="font-mono text-blue-700 underline">View receipt <ExternalLink size={12} className="inline" /></a>}</div>
  </section>;
}
