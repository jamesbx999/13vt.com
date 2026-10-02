import { useCallback, useEffect, useRef, useState } from "react";
import Web3 from "web3";
import { AlertTriangle, Bell, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Loader2, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const TESTNET_RPC = "https://bsc-testnet-dataseed.bnbchain.org";
const DEFAULT_TESTNET_QUEUE_ADDRESS = import.meta.env.VITE_TESTNET_QUEUE_ADDRESS || "";
const MAX_ROWS = 50;
const MAX_EVENTS = 300;
const EVENTS_PER_PAGE = 10;
const ABI = [
  { type: "function", name: "queueState", stateMutability: "view", inputs: [], outputs: [{ name: "registered", type: "uint256" }, { name: "waiting", type: "uint256" }, { name: "scheduled", type: "uint256" }, { name: "claimed", type: "uint256" }, { name: "balance", type: "uint256" }] },
  { type: "function", name: "tickets", stateMutability: "view", inputs: [{ name: "id", type: "uint256" }], outputs: [{ name: "recipient", type: "address" }, { name: "amount", type: "uint256" }, { name: "claimed", type: "bool" }] },
  { type: "function", name: "totalReborn", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "event", name: "Registered", anonymous: false, inputs: [{ indexed: true, name: "ticketId", type: "uint256" }, { indexed: true, name: "payer", type: "address" }, { indexed: true, name: "recipient", type: "address" }, { indexed: false, name: "tokenAmount", type: "uint256" }, { indexed: false, name: "serviceFeeWei", type: "uint256" }] },
  { type: "event", name: "RevenueScheduled", anonymous: false, inputs: [{ indexed: true, name: "firstTicketId", type: "uint256" }, { indexed: true, name: "lastTicketId", type: "uint256" }, { indexed: false, name: "amount", type: "uint256" }, { indexed: false, name: "amountPerTicket", type: "uint256" }, { indexed: true, name: "funder", type: "address" }] },
  { type: "event", name: "Claimed", anonymous: false, inputs: [{ indexed: true, name: "ticketId", type: "uint256" }, { indexed: true, name: "recipient", type: "address" }, { indexed: false, name: "amount", type: "uint256" }] },
  { type: "event", name: "Reborn", anonymous: false, inputs: [{ indexed: true, name: "parentId", type: "uint256" }, { indexed: true, name: "successorId", type: "uint256" }, { indexed: true, name: "recipient", type: "address" }] },
] as const;

type Position = { id: number; recipient: string; amount: string; claimed: boolean };
type QueueEvent = { key: string; name: string; kind: string; block: number; tx: string; detail: string; wallets: string[]; timestamp: number; amount: number };
type Copy = Record<string, string>;
const en: Copy = { title: "FIFO queue dashboard", subtitle: "Read-only view of Transparent13VTQueue on BSC Testnet (97).", address: "Deployed queue contract address", load: "Read queue", loading: "Reading queue…", readOnly: "READ-ONLY", registered: "Registered", waiting: "Waiting allocation", scheduled: "Scheduled", claimed: "Claimed", balance: "Contract balance", totalPaid: "Total paid token", totalReborn: "Total Reborn", positions: "Positions awaiting funding", unfunded: "UNFUNDED", rebornStatus: "REBORN", recipient: "Recipient", amount: "Allocated", empty: "No positions returned", invalid: "Enter a valid contract address.", error: "Could not read this contract. Check address, network and ABI.", cap: "Showing the first 50 tickets and up to 300 events to keep RPC reads bounded.", noBroadcast: "No transaction is sent.", history: "Live event history", noEvents: "No matching events in the recent range", payment: "13-token payment", reborn: "Reborn", registeredEvent: "Position registered", funding: "FIFO funding scheduled", live: "Auto-refresh every 15 seconds", lastBlock: "Block", evidence: "Only emitted events are evidence; no Reborn state is inferred.", newPayment: "A Position received a successful payment.", previous: "Previous", next: "Next", page: "Page", of: "of", refreshing: "Refreshing on-chain data…", filterType: "Event type", filterWallet: "Wallet address", allEvents: "All events", clearFilters: "Clear filters", matched: "matching events", dateFrom: "From date", dateTo: "To date", walletStats: "Wallet statistics", payments: "Paid token", reborns: "Reborn count", noWalletStats: "No wallet statistics for this filter", loadedWindow: "Statistics use the loaded event window." };
const th: Partial<Copy> = { title: "แดชบอร์ดคิว FIFO", subtitle: "อ่านสถานะ Transparent13VTQueue บน BSC Testnet (97) แบบ Read-only", address: "ที่อยู่ Queue Contract ที่ Deploy แล้ว", load: "อ่านคิว", loading: "กำลังอ่านคิว…", readOnly: "อ่านอย่างเดียว", registered: "ลงทะเบียน", waiting: "รอการจัดสรร", scheduled: "จัดสรรแล้ว", claimed: "Claim แล้ว", balance: "ยอดใน Contract", totalPaid: "ยอดจ่ายรวม Token", totalReborn: "จำนวน Reborn ทั้งหมด", positions: "Position ที่ยังไม่ได้รับทุน", unfunded: "UNFUNDED", rebornStatus: "REBORN", recipient: "ผู้รับ", amount: "ยอดจัดสรร", empty: "ไม่พบ Position", invalid: "กรุณาใส่ที่อยู่ Contract ให้ถูกต้อง", error: "อ่าน Contract ไม่ได้ กรุณาตรวจ address, network และ ABI", noBroadcast: "ไม่มีการส่งธุรกรรม", history: "ประวัติ Event แบบเรียลไทม์", noEvents: "ไม่พบ Event ที่ตรงกัน", payment: "การจ่าย 13 Token", reborn: "Reborn", registeredEvent: "สร้าง Position", funding: "จัดสรรทุนตาม FIFO", live: "รีเฟรชอัตโนมัติทุก 15 วินาที", lastBlock: "Block", newPayment: "มี Position ได้รับเงินสำเร็จ", previous: "ก่อนหน้า", next: "ถัดไป", page: "หน้า", of: "จาก", refreshing: "กำลังรีเฟรชข้อมูลบนเชน…", filterType: "ประเภท Event", filterWallet: "Wallet Address", allEvents: "ทุก Event", clearFilters: "ล้างตัวกรอง", matched: "รายการที่ตรงกัน", dateFrom: "วันที่เริ่มต้น", dateTo: "วันที่สิ้นสุด", walletStats: "สถิติราย Wallet", payments: "ยอดจ่าย Token", reborns: "จำนวน Reborn", noWalletStats: "ไม่พบสถิติจากตัวกรองนี้", loadedWindow: "สถิติใช้เฉพาะช่วง Event ที่โหลดมา" };
const copy: Record<string, Partial<Copy>> = { th, de: { title: "FIFO-Warteschlange", history: "Live-Eventverlauf", rebornStatus: "REBORN", previous: "Zurück", next: "Weiter", page: "Seite", of: "von" }, zh: { title: "FIFO 队列面板", history: "实时事件历史", rebornStatus: "REBORN", previous: "上一页", next: "下一页", page: "第", of: "页" }, lo: { title: "Dashboard ຄິວ FIFO", history: "ປະຫວັດ Event ແບບສົດ", rebornStatus: "REBORN", previous: "ກ່ອນ", next: "ຕໍ່ໄປ", page: "ໜ້າ", of: "ຈາກ" } };

export function FifoQueueDashboard() {
  const { language } = useLanguage();
  const text = { ...en, ...(copy[language] || {}) } as Copy;
  const [address, setAddress] = useState(DEFAULT_TESTNET_QUEUE_ADDRESS);
  const [loadedAddress, setLoadedAddress] = useState("");
  const [state, setState] = useState<number[]>([]);
  const [summary, setSummary] = useState({ totalPaid: 0, totalReborn: 0 });
  const [positions, setPositions] = useState<Position[]>([]);
  const [events, setEvents] = useState<QueueEvent[]>([]);
  const [rebornIds, setRebornIds] = useState<number[]>([]);
  const [eventPage, setEventPage] = useState(1);
  const [eventType, setEventType] = useState("all");
  const [walletFilter, setWalletFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [status, setStatus] = useState("");
  const [notification, setNotification] = useState("");
  const [busy, setBusy] = useState(false);
  const previousEventKeys = useRef<Set<string> | null>(null);

  const loadQueue = useCallback(async (target = address) => {
    if (!Web3.utils.isAddress(target.trim())) { setStatus(text.invalid); return; }
    setBusy(true); setStatus("");
    try {
      const web3 = new Web3(TESTNET_RPC);
      const contract = new web3.eth.Contract(ABI as any, target.trim());
      const queue = await contract.methods.queueState().call() as any;
      const values = [queue.registered ?? queue[0], queue.waiting ?? queue[1], queue.scheduled ?? queue[2], queue.claimed ?? queue[3], queue.balance ?? queue[4]].map(Number);
      setState(values);
      const rebornTotal = Number(await contract.methods.totalReborn().call());
      setSummary({ totalPaid: values[3], totalReborn: rebornTotal });
      const rows = await Promise.all(Array.from({ length: Math.min(values[0], MAX_ROWS) }, async (_, index) => {
        const id = index + 1; const row = await contract.methods.tickets(id).call() as any;
        return { id, recipient: row.recipient ?? row[0], amount: Web3.utils.fromWei(String(row.amount ?? row[1]), "ether"), claimed: Boolean(row.claimed ?? row[2]) };
      }));
      setPositions(rows.filter(row => !row.claimed && Number(row.amount) === 0));
      const latest = Number(await web3.eth.getBlockNumber());
      const fromBlock = latest > 50_000 ? latest - 50_000 : 0;
      const rawEvents = await contract.getPastEvents("allEvents", { fromBlock, toBlock: latest });
      const blockNumbers = Array.from(new Set(rawEvents.map((event: any) => Number(event.blockNumber))));
      const blocks = await Promise.all(blockNumbers.map(block => web3.eth.getBlock(block)));
      const timestamps = new Map(blockNumbers.map((block, index) => [block, Number(blocks[index]?.timestamp ?? 0) * 1000]));
      const history = rawEvents.slice(-MAX_EVENTS).reverse().map((event: any): QueueEvent => {
        const values = event.returnValues || {}; const name = event.event || "Event";
        const key = `${event.transactionHash}-${event.logIndex ?? "0"}`;
        const amount = values.amount ?? values.tokenAmount ?? values.amountPerTicket;
        const kind = name === "Claimed" ? text.payment : name === "Reborn" ? text.reborn : name === "Registered" ? text.registeredEvent : name === "RevenueScheduled" ? text.funding : name;
        const detail = name === "Claimed" ? `#${values.ticketId ?? "?"} · ${amount ? Web3.utils.fromWei(String(amount), "ether") : "13"} token` : name === "Reborn" ? `#${values.parentId ?? "?"} → #${values.successorId ?? "?"}` : name === "RevenueScheduled" ? `#${values.firstTicketId ?? "?"}–#${values.lastTicketId ?? "?"}` : `#${values.ticketId ?? "?"}`;
        const wallets = [values.payer, values.recipient, values.funder].filter((wallet): wallet is string => typeof wallet === "string" && Web3.utils.isAddress(wallet));
        return { key, name, kind, block: Number(event.blockNumber), tx: event.transactionHash, detail, wallets, timestamp: timestamps.get(Number(event.blockNumber)) ?? 0, amount: amount ? Number(Web3.utils.fromWei(String(amount), "ether")) : 0 };
      });
      const oldKeys = previousEventKeys.current;
      if (oldKeys && history.some(event => event.name === "Claimed" && !oldKeys.has(event.key))) setNotification(text.newPayment);
      previousEventKeys.current = new Set(history.map(event => event.key));
      setEvents(history);
      setRebornIds(history.filter(event => event.name === "Reborn").map(event => Number(event.detail.split("→ #")[1])).filter(Number.isFinite));
      setEventPage(page => Math.min(page, Math.max(1, Math.ceil(history.length / EVENTS_PER_PAGE))));
      setLoadedAddress(target.trim());
    } catch { setState([]); setSummary({ totalPaid: 0, totalReborn: 0 }); setPositions([]); setEvents([]); setStatus(text.error); }
    finally { setBusy(false); }
  }, [address, text]);

  useEffect(() => { if (!loadedAddress) return; const timer = window.setInterval(() => void loadQueue(loadedAddress), 15_000); return () => window.clearInterval(timer); }, [loadedAddress, loadQueue]);
  useEffect(() => { if (!notification) return; const timer = window.setTimeout(() => setNotification(""), 8_000); return () => window.clearTimeout(timer); }, [notification]);

  const metrics = [text.registered, text.waiting, text.scheduled, text.claimed, text.balance];
  const fromTime = dateFrom ? new Date(`${dateFrom}T00:00:00Z`).getTime() : 0;
  const toTime = dateTo ? new Date(`${dateTo}T23:59:59.999Z`).getTime() : Number.POSITIVE_INFINITY;
  const filteredEvents = events.filter(event => (eventType === "all" || event.name === eventType) && (!walletFilter.trim() || event.wallets.some(wallet => wallet.toLowerCase() === walletFilter.trim().toLowerCase())) && event.timestamp >= fromTime && event.timestamp <= toTime);
  const walletStatMap = new Map<string, { paid: number; reborn: number }>();
  filteredEvents.forEach(event => {
    const wallet = event.wallets[0];
    if (!wallet) return;
    const current = walletStatMap.get(wallet.toLowerCase()) ?? { paid: 0, reborn: 0 };
    if (event.name === "Claimed") current.paid += event.amount;
    if (event.name === "Reborn") current.reborn += 1;
    walletStatMap.set(wallet.toLowerCase(), current);
  });
  const walletStats = Array.from(walletStatMap.entries()).filter(([, stats]) => stats.paid > 0 || stats.reborn > 0).sort((a, b) => b[1].paid - a[1].paid || b[1].reborn - a[1].reborn);
  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / EVENTS_PER_PAGE));
  const safePage = Math.min(eventPage, totalPages);
  const pageEvents = filteredEvents.slice((safePage - 1) * EVENTS_PER_PAGE, safePage * EVENTS_PER_PAGE);
  return <section aria-label={text.title} aria-busy={busy} className="relative rounded-2xl border border-blue-200 bg-white p-5 shadow-sm sm:p-6">
    {busy && <div className="absolute inset-x-0 top-0 h-1 overflow-hidden rounded-t-2xl bg-blue-100"><div className="h-full w-1/3 animate-[loading_1.2s_ease-in-out_infinite] rounded-full bg-blue-600 motion-reduce:animate-none" /></div>}
    {notification && <div role="alert" className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-900"><Bell size={16} className="animate-pulse motion-reduce:animate-none" />{notification}</div>}
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">{text.title}</h2><p className="mt-1 text-xs leading-5 text-slate-600">{text.subtitle}</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800"><ShieldCheck size={13} className="mr-1 inline" />{text.readOnly}</span></div>
    <div className="mt-4 flex flex-wrap gap-2"><input aria-label={text.address} value={address} onChange={e => setAddress(e.target.value)} placeholder={text.address} className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" /><button type="button" onClick={() => void loadQueue()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin motion-reduce:animate-none" /> : <RefreshCw size={14} />} {busy ? text.loading : text.load}</button></div>
    {busy && <p className="mt-2 text-xs text-blue-700"><Loader2 size={13} className="mr-1 inline animate-spin motion-reduce:animate-none" />{text.refreshing}</p>}
    {status && <p role="status" className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900"><AlertTriangle size={14} className="mr-1 inline" />{status}</p>}
    {state.length === 5 && <div className="mt-4 grid gap-2 sm:grid-cols-5">{metrics.map((label, index) => <div key={label} className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] text-slate-500">{label}</p><p className="mt-1 font-semibold text-slate-900">{index === 4 ? `${(state[index] / 1e18).toLocaleString()} token` : state[index].toLocaleString()}</p></div>)}</div>}
    {state.length === 5 && <div className="mt-3 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-semibold text-emerald-800">{text.totalPaid}</p><p className="mt-1 text-2xl font-bold text-emerald-950">{(summary.totalPaid / 1e18).toLocaleString()} token</p><p className="mt-1 text-[11px] text-emerald-700">From on-chain totalClaimed</p></div><div className="rounded-2xl border border-violet-200 bg-violet-50 p-4"><p className="text-xs font-semibold text-violet-800">{text.totalReborn}</p><p className="mt-1 text-2xl font-bold text-violet-950">{summary.totalReborn.toLocaleString()}</p><p className="mt-1 text-[11px] text-violet-700">From on-chain totalReborn</p></div></div>}
    <div className="mt-5 flex items-center justify-between gap-3"><h3 className="text-sm font-bold text-slate-900">{text.positions}</h3><span className="text-xs text-slate-500">{positions.length}</span></div>
    {positions.length === 0 && state.length === 5 && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">{text.empty}</p>}
    {positions.length > 0 && <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100"><table className="w-full min-w-[36rem] text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-3 py-2">ID</th><th className="px-3 py-2">{text.recipient}</th><th className="px-3 py-2">{text.amount}</th><th className="px-3 py-2">Status</th></tr></thead><tbody>{positions.map(row => <tr key={row.id} className="border-t border-slate-100"><td className="px-3 py-2 font-mono">#{row.id}</td><td className="px-3 py-2 font-mono">{row.recipient}</td><td className="px-3 py-2">{row.amount}</td><td className="px-3 py-2"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold ${rebornIds.includes(row.id) ? "bg-violet-50 text-violet-800" : "bg-amber-50 text-amber-800"}`}>{rebornIds.includes(row.id) ? <Sparkles size={12} /> : <CheckCircle2 size={12} />} {rebornIds.includes(row.id) ? text.rebornStatus : text.unfunded}</span></td></tr>)}</tbody></table></div>}
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-bold text-slate-900"><Clock3 size={15} className="mr-1 inline" />{text.history}</h3><span className="text-[11px] text-emerald-700">{loadedAddress ? text.live : ""}</span></div>
    <div className="mt-3 grid gap-2 sm:grid-cols-[12rem_1fr_auto]">
      <select aria-label={text.filterType} value={eventType} onChange={event => { setEventType(event.target.value); setEventPage(1); }} className="rounded-xl border border-slate-200 px-3 py-2 text-xs">
        <option value="all">{text.allEvents}</option><option value="Registered">Registered</option><option value="RevenueScheduled">RevenueScheduled</option><option value="Claimed">Claimed</option><option value="Reborn">Reborn</option>
      </select>
      <input aria-label={text.filterWallet} value={walletFilter} onChange={event => { setWalletFilter(event.target.value); setEventPage(1); }} placeholder={text.filterWallet} className="rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs" />
      <div className="flex gap-2"><input type="date" aria-label={text.dateFrom} value={dateFrom} onChange={event => { setDateFrom(event.target.value); setEventPage(1); }} className="min-w-0 rounded-xl border border-slate-200 px-2 py-2 text-xs" /><input type="date" aria-label={text.dateTo} value={dateTo} onChange={event => { setDateTo(event.target.value); setEventPage(1); }} className="min-w-0 rounded-xl border border-slate-200 px-2 py-2 text-xs" /></div>
      <button type="button" onClick={() => { setEventType("all"); setWalletFilter(""); setDateFrom(""); setDateTo(""); setEventPage(1); }} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold">{text.clearFilters}</button>
    </div>
    <p className="mt-2 text-[11px] text-slate-500">{filteredEvents.length} {text.matched}</p>
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-bold text-slate-800">{text.walletStats}</p>{walletStats.length === 0 ? <p className="mt-2 text-xs text-slate-500">{text.noWalletStats}</p> : <div className="mt-2 grid gap-2 sm:grid-cols-2">{walletStats.map(([wallet, stats]) => <div key={wallet} className="rounded-lg bg-white p-2 text-xs"><p className="break-all font-mono text-slate-700">{wallet}</p><p className="mt-1 text-emerald-700">{text.payments}: {stats.paid.toLocaleString()} token</p><p className="text-violet-700">{text.reborns}: {stats.reborn}</p></div>)}</div>}<p className="mt-2 text-[10px] text-slate-500">{text.loadedWindow}</p></div>
    {pageEvents.length === 0 && state.length === 5 && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">{text.noEvents}</p>}
    {pageEvents.length > 0 && <div className="mt-3 space-y-2">{pageEvents.map(event => <div key={event.key} className={`rounded-xl border p-3 text-xs ${event.name === "Reborn" ? "border-violet-200 bg-violet-50" : event.name === "Claimed" ? "border-emerald-200 bg-emerald-50" : "border-slate-100 bg-slate-50"}`}><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-slate-900">{event.name === "Reborn" && <Sparkles size={13} className="mr-1 inline text-violet-700" />}{event.kind}</span><span className="font-mono text-slate-500">{text.lastBlock} {event.block}</span></div><p className="mt-1 text-slate-700">{event.detail}</p><a className="mt-1 block break-all font-mono text-[10px] text-blue-700 underline" href={`https://testnet.bscscan.com/tx/${event.tx}`} target="_blank" rel="noreferrer">{event.tx}</a></div>)}</div>}
    {filteredEvents.length > EVENTS_PER_PAGE && <div className="mt-4 flex items-center justify-center gap-3"><button type="button" disabled={safePage <= 1} onClick={() => setEventPage(page => page - 1)} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40" aria-label={text.previous}><ChevronLeft size={15} /></button><span className="text-xs text-slate-600">{text.page} {safePage} {text.of} {totalPages}</span><button type="button" disabled={safePage >= totalPages} onClick={() => setEventPage(page => page + 1)} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40" aria-label={text.next}><ChevronRight size={15} /></button></div>}
    <p className="mt-4 text-xs text-slate-500">{text.cap} {text.noBroadcast} {text.evidence}</p>
  </section>;
}
