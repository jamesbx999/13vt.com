import { useCallback, useEffect, useState } from "react";
import Web3 from "web3";
import { AlertTriangle, CheckCircle2, Clock3, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const TESTNET_RPC = "https://bsc-testnet-dataseed.bnbchain.org";
const MAX_ROWS = 50;
const MAX_EVENTS = 60;
const ABI = [
  { type: "function", name: "queueState", stateMutability: "view", inputs: [], outputs: [{ name: "registered", type: "uint256" }, { name: "waiting", type: "uint256" }, { name: "scheduled", type: "uint256" }, { name: "claimed", type: "uint256" }, { name: "balance", type: "uint256" }] },
  { type: "function", name: "tickets", stateMutability: "view", inputs: [{ name: "id", type: "uint256" }], outputs: [{ name: "recipient", type: "address" }, { name: "amount", type: "uint256" }, { name: "claimed", type: "bool" }] },
  { type: "event", name: "Registered", anonymous: false, inputs: [{ indexed: true, name: "ticketId", type: "uint256" }, { indexed: true, name: "payer", type: "address" }, { indexed: true, name: "recipient", type: "address" }, { indexed: false, name: "tokenAmount", type: "uint256" }, { indexed: false, name: "serviceFeeWei", type: "uint256" }] },
  { type: "event", name: "RevenueScheduled", anonymous: false, inputs: [{ indexed: true, name: "firstTicketId", type: "uint256" }, { indexed: true, name: "lastTicketId", type: "uint256" }, { indexed: false, name: "amount", type: "uint256" }, { indexed: false, name: "amountPerTicket", type: "uint256" }, { indexed: true, name: "funder", type: "address" }] },
  { type: "event", name: "Claimed", anonymous: false, inputs: [{ indexed: true, name: "ticketId", type: "uint256" }, { indexed: true, name: "recipient", type: "address" }, { indexed: false, name: "amount", type: "uint256" }] },
  // Optional evidence event: the current transparent contract does not emit it.
  { type: "event", name: "Reborn", anonymous: false, inputs: [{ indexed: true, name: "parentId", type: "uint256" }, { indexed: true, name: "successorId", type: "uint256" }] },
] as const;

type Position = { id: number; recipient: string; amount: string; claimed: boolean };
type QueueEvent = { kind: string; block: number; tx: string; detail: string; amount?: string };
type Copy = { title: string; subtitle: string; address: string; load: string; loading: string; readOnly: string; registered: string; waiting: string; scheduled: string; claimed: string; balance: string; positions: string; unfunded: string; recipient: string; amount: string; empty: string; invalid: string; error: string; cap: string; noBroadcast: string; history: string; noEvents: string; payment: string; reborn: string; registeredEvent: string; funding: string; live: string; lastBlock: string; evidence: string };
const copy: Record<string, Copy> = {
  en: { title: "FIFO queue dashboard", subtitle: "Read-only view of Transparent13VTQueue on BSC Testnet (97).", address: "Deployed queue contract address", load: "Read queue", loading: "Reading queue…", readOnly: "READ-ONLY", registered: "Registered", waiting: "Waiting allocation", scheduled: "Scheduled", claimed: "Claimed", balance: "Contract balance", positions: "Positions awaiting funding", unfunded: "UNFUNDED", recipient: "Recipient", amount: "Allocated", empty: "No positions returned", invalid: "Enter a valid contract address.", error: "Could not read this contract. Check address, network and ABI.", cap: "Showing the first 50 tickets and 60 recent events to keep RPC reads bounded.", noBroadcast: "No transaction is sent.", history: "Live event history", noEvents: "No matching events in the recent range", payment: "13-token payment", reborn: "Reborn evidence", registeredEvent: "Position registered", funding: "FIFO funding scheduled", live: "Auto-refresh every 15 seconds", lastBlock: "Block", evidence: "Only emitted events are evidence; no Reborn event is inferred." },
  de: { title: "FIFO-Warteschlange", subtitle: "Nur-Lese-Ansicht von Transparent13VTQueue im BSC Testnet (97).", address: "Adresse des deployten Queue-Contracts", load: "Queue lesen", loading: "Queue wird gelesen…", readOnly: "NUR LESEN", registered: "Registriert", waiting: "Warten auf Zuteilung", scheduled: "Zugewiesen", claimed: "Eingelöst", balance: "Contract-Guthaben", positions: "Positionen ohne Finanzierung", unfunded: "UNFUNDED", recipient: "Empfänger", amount: "Zuteilung", empty: "Keine Positionen", invalid: "Gültige Contract-Adresse eingeben.", error: "Contract konnte nicht gelesen werden.", cap: "50 Tickets und 60 Events werden angezeigt.", noBroadcast: "Keine Transaktion gesendet.", history: "Live-Eventverlauf", noEvents: "Keine passenden Events", payment: "13-Token-Zahlung", reborn: "Reborn-Nachweis", registeredEvent: "Position registriert", funding: "FIFO-Finanzierung", live: "Automatische Aktualisierung alle 15 Sekunden", lastBlock: "Block", evidence: "Nur emittierte Events gelten als Nachweis." },
  zh: { title: "FIFO 队列面板", subtitle: "BSC 测试网 (97) Transparent13VTQueue 只读状态。", address: "已部署队列合约地址", load: "读取队列", loading: "正在读取队列…", readOnly: "只读", registered: "已注册", waiting: "等待分配", scheduled: "已安排", claimed: "已领取", balance: "合约余额", positions: "等待资金的 Position", unfunded: "UNFUNDED", recipient: "收款人", amount: "分配", empty: "没有 Position", invalid: "请输入有效合约地址。", error: "无法读取合约，请检查地址、网络和 ABI。", cap: "显示前 50 个 ticket 和 60 个事件。", noBroadcast: "未发送交易。", history: "实时事件历史", noEvents: "近期没有匹配事件", payment: "13 代币支付", reborn: "Reborn 证据", registeredEvent: "Position 已注册", funding: "FIFO 资金分配", live: "每 15 秒自动刷新", lastBlock: "区块", evidence: "只显示合约实际发出的事件，不推断 Reborn。" },
  lo: { title: "Dashboard ຄິວ FIFO", subtitle: "ອ່ານຢ່າງດຽວ Transparent13VTQueue ໃນ BSC Testnet (97).", address: "ທີ່ຢູ່ Queue contract", load: "ອ່ານຄິວ", loading: "ກຳລັງອ່ານຄິວ…", readOnly: "ອ່ານຢ່າງດຽວ", registered: "ລົງທະບຽນ", waiting: "ລໍຖ້າຈັດສັນ", scheduled: "ຈັດສັນແລ້ວ", claimed: "ຮັບແລ້ວ", balance: "ຍອດໃນ Contract", positions: "Position ທີ່ຍັງບໍ່ມີທຶນ", unfunded: "UNFUNDED", recipient: "ຜູ້ຮັບ", amount: "ຈັດສັນ", empty: "ບໍ່ມີ Position", invalid: "ໃສ່ທີ່ຢູ່ contract ໃຫ້ຖືກຕ້ອງ", error: "ອ່ານ contract ບໍ່ໄດ້", cap: "ສະແດງ 50 ticket ແລະ 60 events", noBroadcast: "ບໍ່ໄດ້ສົ່ງທຸລະກຳ", history: "ປະຫວັດ Event ແບບສົດ", noEvents: "ບໍ່ພົບ Event", payment: "ການຈ່າຍ 13 token", reborn: "ຫຼັກຖານ Reborn", registeredEvent: "ສ້າງ Position", funding: "ຈັດສັນທຶນ FIFO", live: "ອັບເດດທຸກ 15 ວິນາທີ", lastBlock: "Block", evidence: "ສະແດງສະເພາະ Event ທີ່ contract ປ່ອຍອອກ; ບໍ່ຄາດເດົາ Reborn." },
  th: { title: "แดชบอร์ดคิว FIFO", subtitle: "อ่านสถานะ Transparent13VTQueue บน BSC Testnet (97) แบบ Read-only", address: "ที่อยู่ Queue Contract ที่ Deploy แล้ว", load: "อ่านคิว", loading: "กำลังอ่านคิว…", readOnly: "อ่านอย่างเดียว", registered: "ลงทะเบียน", waiting: "รอการจัดสรร", scheduled: "จัดสรรแล้ว", claimed: "Claim แล้ว", balance: "ยอดใน Contract", positions: "Position ที่ยังไม่ได้รับทุน", unfunded: "UNFUNDED", recipient: "ผู้รับ", amount: "ยอดจัดสรร", empty: "ไม่พบ Position", invalid: "กรุณาใส่ที่อยู่ Contract ให้ถูกต้อง", error: "อ่าน Contract ไม่ได้ กรุณาตรวจ address, network และ ABI", cap: "แสดงไม่เกิน 50 ticket และ 60 event ล่าสุด", noBroadcast: "ไม่มีการส่งธุรกรรม", history: "ประวัติ Event แบบเรียลไทม์", noEvents: "ไม่พบ Event ที่ตรงกันในช่วงล่าสุด", payment: "การจ่าย 13 Token", reborn: "หลักฐาน Reborn", registeredEvent: "สร้าง Position", funding: "จัดสรรทุนตาม FIFO", live: "รีเฟรชอัตโนมัติทุก 15 วินาที", lastBlock: "Block", evidence: "แสดงเฉพาะ Event ที่ Contract emit จริง ไม่อนุมานว่าเกิด Reborn" },
};

export function FifoQueueDashboard() {
  const { language } = useLanguage();
  const text = copy[language] || copy.en;
  const [address, setAddress] = useState("");
  const [loadedAddress, setLoadedAddress] = useState("");
  const [state, setState] = useState<number[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [events, setEvents] = useState<QueueEvent[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const loadQueue = useCallback(async (target = address) => {
    if (!Web3.utils.isAddress(target.trim())) { setStatus(text.invalid); return; }
    setBusy(true); setStatus("");
    try {
      const web3 = new Web3(TESTNET_RPC);
      const contract = new web3.eth.Contract(ABI as any, target.trim());
      const queue = await contract.methods.queueState().call() as any;
      const values = [queue.registered ?? queue[0], queue.waiting ?? queue[1], queue.scheduled ?? queue[2], queue.claimed ?? queue[3], queue.balance ?? queue[4]].map(Number);
      setState(values);
      const count = Math.min(values[0], MAX_ROWS);
      const rows = await Promise.all(Array.from({ length: count }, async (_, index) => {
        const id = index + 1;
        const row = await contract.methods.tickets(id).call() as any;
        return { id, recipient: row.recipient ?? row[0], amount: Web3.utils.fromWei(String(row.amount ?? row[1]), "ether"), claimed: Boolean(row.claimed ?? row[2]) };
      }));
      setPositions(rows.filter(row => !row.claimed && Number(row.amount) === 0));
      const latest = Number(await web3.eth.getBlockNumber());
      const fromBlock = latest > 50_000 ? latest - 50_000 : 0;
      const rawEvents = await contract.getPastEvents("allEvents", { fromBlock, toBlock: latest });
      const history = rawEvents.slice(-MAX_EVENTS).reverse().map((event: any): QueueEvent => {
        const values = event.returnValues || {};
        const name = event.event || "Event";
        const amount = values.amount ?? values.tokenAmount ?? values.amountPerTicket;
        const kind = name === "Claimed" ? text.payment : name === "Reborn" ? text.reborn : name === "Registered" ? text.registeredEvent : name === "RevenueScheduled" ? text.funding : name;
        const detail = name === "Claimed" ? `#${values.ticketId ?? "?"} · ${amount ? Web3.utils.fromWei(String(amount), "ether") : "13"} token` : name === "Reborn" ? `#${values.parentId ?? "?"} → #${values.successorId ?? "?"}` : name === "RevenueScheduled" ? `#${values.firstTicketId ?? "?"}–#${values.lastTicketId ?? "?"}` : `#${values.ticketId ?? "?"}`;
        return { kind, block: Number(event.blockNumber), tx: event.transactionHash, detail, amount: amount ? Web3.utils.fromWei(String(amount), "ether") : undefined };
      });
      setEvents(history);
      setLoadedAddress(target.trim());
    } catch { setState([]); setPositions([]); setEvents([]); setStatus(text.error); }
    finally { setBusy(false); }
  }, [address, text]);

  useEffect(() => {
    if (!loadedAddress) return;
    const timer = window.setInterval(() => { void loadQueue(loadedAddress); }, 15_000);
    return () => window.clearInterval(timer);
  }, [loadedAddress, loadQueue]);

  const metrics = [text.registered, text.waiting, text.scheduled, text.claimed, text.balance];
  return <section aria-label={text.title} className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">{text.title}</h2><p className="mt-1 text-xs leading-5 text-slate-600">{text.subtitle}</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800"><ShieldCheck size={13} className="mr-1 inline" />{text.readOnly}</span></div>
    <div className="mt-4 flex flex-wrap gap-2"><input aria-label={text.address} value={address} onChange={e => setAddress(e.target.value)} placeholder={text.address} className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" /><button type="button" onClick={() => void loadQueue()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin motion-reduce:animate-none" /> : <RefreshCw size={14} />} {busy ? text.loading : text.load}</button></div>
    {status && <p role="status" className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900"><AlertTriangle size={14} className="mr-1 inline" />{status}</p>}
    {state.length === 5 && <div className="mt-4 grid gap-2 sm:grid-cols-5">{metrics.map((label, index) => <div key={label} className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] text-slate-500">{label}</p><p className="mt-1 font-semibold text-slate-900">{index === 4 ? `${(state[index] / 1e18).toLocaleString()} token` : state[index].toLocaleString()}</p></div>)}</div>}
    <div className="mt-5 flex items-center justify-between gap-3"><h3 className="text-sm font-bold text-slate-900">{text.positions}</h3><span className="text-xs text-slate-500">{positions.length}</span></div>
    {positions.length === 0 && state.length === 5 && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">{text.empty}</p>}
    {positions.length > 0 && <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100"><table className="w-full min-w-[36rem] text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-3 py-2">ID</th><th className="px-3 py-2">{text.recipient}</th><th className="px-3 py-2">{text.amount}</th><th className="px-3 py-2">Status</th></tr></thead><tbody>{positions.map(row => <tr key={row.id} className="border-t border-slate-100"><td className="px-3 py-2 font-mono">#{row.id}</td><td className="px-3 py-2 font-mono">{row.recipient}</td><td className="px-3 py-2">{row.amount}</td><td className="px-3 py-2"><span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 font-semibold text-amber-800"><CheckCircle2 size={12} /> {text.unfunded}</span></td></tr>)}</tbody></table></div>}
    <div className="mt-6 flex items-center justify-between gap-3"><h3 className="text-sm font-bold text-slate-900"><Clock3 size={15} className="mr-1 inline" />{text.history}</h3><span className="text-[11px] text-emerald-700">{loadedAddress ? text.live : ""}</span></div>
    {events.length === 0 && state.length === 5 && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">{text.noEvents}</p>}
    {events.length > 0 && <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">{events.map((event, index) => <div key={`${event.tx}-${event.kind}-${index}`} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-slate-900">{event.kind}</span><span className="font-mono text-slate-500">{text.lastBlock} {event.block}</span></div><p className="mt-1 text-slate-700">{event.detail}</p><a className="mt-1 block break-all font-mono text-[10px] text-blue-700 underline" href={`https://testnet.bscscan.com/tx/${event.tx}`} target="_blank" rel="noreferrer">{event.tx}</a></div>)}</div>}
    <p className="mt-4 text-xs text-slate-500">{text.cap} {text.noBroadcast} {text.evidence}</p>
  </section>;
}
