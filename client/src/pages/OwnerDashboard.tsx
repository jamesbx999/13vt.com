import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { readReferralCodeHistory, readReferralCodeMapping, submitSetReferralCode, shortAddress, type ReferralCodeEvent } from "@/lib/queue";
import { LanguageSwitcher, useLanguage } from "@/contexts/LanguageContext";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppToast, useSettings, SettingsPanel } from "@/contexts/SettingsContext";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Download, ExternalLink, Loader2, RefreshCw, Search, ShieldCheck, Wallet, XCircle } from "lucide-react";
import { Link } from "wouter";
import { BranchReferralStats, ReferralTree, type ReferralTreeNode } from "@/components/ReferralTree";

const OWNER_ADDRESS = "0x11B948575B648be50Eef781251ebdc876907E618";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const PAGE_SIZE = 8;

type MappingRow = {
  id: number;
  code: string;
  codeHash: string;
  referrerAddress: string;
  status: string;
  txHash: string | null;
  updatedAt?: Date | string | null;
};

function statusStyle(status: string) {
  if (status === "active") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "failed") return "bg-rose-50 text-rose-700 ring-rose-200";
  if (status === "disabled") return "bg-slate-100 text-slate-600 ring-slate-200";
  return "bg-amber-50 text-amber-700 ring-amber-200";
}

function onChainStatus(row: MappingRow, actual?: string) {
  if (!actual) return "unknown";
  if (actual.toLowerCase() === ZERO_ADDRESS) return "disabled";
  if (actual.toLowerCase() === row.referrerAddress.toLowerCase()) return "active";
  return "mismatch";
}

function ReferralEventPanel({ events, loading, error }: { events: ReferralCodeEvent[]; loading: boolean; error: string }) {
  const { t } = useLanguage();
  return <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.04)]"><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="text-lg font-bold">{t("eventLog")}</h2><p className="mt-1 text-xs text-slate-400">{t("eventDescription")} · {t("updatedCount", { count: events.length })}</p></div>{loading && <Loader2 className="animate-spin text-teal-600" size={18} />}</div>{error ? <div className="m-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</div> : loading && !events.length ? <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-400"><Loader2 className="animate-spin" size={18} />{t("loadingEventsShort")}</div> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50/80 text-xs font-semibold text-slate-500"><tr><th className="px-5 py-3">{t("block")}</th><th className="px-5 py-3">{t("code")}</th><th className="px-5 py-3">{t("referrer")}</th><th className="px-5 py-3">{t("action")}</th><th className="px-5 py-3">{t("transaction")}</th></tr></thead><tbody className="divide-y divide-slate-100">{events.length ? events.map(event => <tr key={`${event.hash}-${event.blockNumber}`}><td className="px-5 py-3 font-mono text-xs text-slate-500">{event.blockNumber.toLocaleString()}</td><td className="px-5 py-3"><code className="font-mono font-semibold">{event.code}</code></td><td className="px-5 py-3 font-mono text-xs text-slate-600">{shortAddress(event.referrer)}</td><td className="px-5 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${event.enabled ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-600 ring-slate-200"}`}>{event.enabled ? t("enabled") : t("disabled")}</span></td><td className="px-5 py-3">{event.hash ? <a href={`https://bscscan.com/tx/${event.hash}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline">{shortAddress(event.hash)} <ExternalLink size={12} /></a> : "—"}</td></tr>) : <tr><td colSpan={5} className="p-10 text-center text-sm text-slate-400">{t("noEvents")}</td></tr>}</tbody></table></div>}</section>;
}

export default function OwnerDashboard() {
  const { t } = useLanguage();
  const toast = useAppToast();
  const { refreshInterval, isPageVisible, autoRefreshPaused } = useSettings();
  const [account, setAccount] = useState("");
  const [contractAddress, setContractAddress] = useState("");
  const [code, setCode] = useState("");
  const [referrerAddress, setReferrerAddress] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [verifyingCode, setVerifyingCode] = useState<string | null>(null);
  const [onChainResults, setOnChainResults] = useState<Record<string, string>>({});
  const [onChainSyncing, setOnChainSyncing] = useState(false);
  const [highlightedCodes, setHighlightedCodes] = useState<string[]>([]);
  const [eventHistory, setEventHistory] = useState<ReferralCodeEvent[]>([]);
  const [eventLoading, setEventLoading] = useState(false);
  const [eventError, setEventError] = useState("");
  const [onChainFilter, setOnChainFilter] = useState<"all" | "active" | "disabled" | "mismatch" | "unknown">("all");
  const [nextRefreshAt, setNextRefreshAt] = useState<number | null>(null);
  const [secondsToRefresh, setSecondsToRefresh] = useState<number>(refreshInterval);
  const previousOnChainRef = useRef<Record<string, string>>({});
  const utils = trpc.useUtils();
  const mappingsQuery = trpc.referralCodes.list.useQuery(undefined, { retry: false });
  const createMapping = trpc.referralCodes.create.useMutation();
  const markResult = trpc.referralCodes.markResult.useMutation();

  const rows = mappingsQuery.data || [];
  useEffect(() => {
    if (!contractAddress.trim() || !rows.length || !window.ethereum || !isPageVisible || autoRefreshPaused) return;
    let cancelled = false;
    const sync = async (notify: boolean) => {
      setOnChainSyncing(true);
      if (notify) toast.info(t("onchainUpdated"), { description: `ตรวจสอบ ${rows.length} รายการ` });
      try {
        const results = await Promise.all(rows.map(async row => [row.code, await readReferralCodeMapping(window.ethereum, contractAddress.trim(), row.code)] as const));
        if (!cancelled) {
          const nextMap = Object.fromEntries(results);
          const previous = previousOnChainRef.current;
          const changedCodes = results.filter(([key, value]) => previous[key] !== undefined && previous[key].toLowerCase() !== value.toLowerCase()).map(([key]) => key);
          previousOnChainRef.current = nextMap;
          setOnChainResults(nextMap);
          if (changedCodes.length) {
            setHighlightedCodes(changedCodes);
            window.setTimeout(() => setHighlightedCodes(current => current.filter(code => !changedCodes.includes(code))), 2200);
          }
          if (notify) toast.success(t("onchainUpdated"), { description: `ตรวจสอบ ${results.length} รายการ` });
          else if (changedCodes.length) toast.info(t("onchainChanged"), { description: `${changedCodes.length} referral mapping ${changedCodes.length === 1 ? "was" : "were"} updated on-chain` });
        }
      } catch (error: any) { if (!cancelled && notify) toast.error(t("onchainReadError"), { description: error?.message || t("checkContractAndAbi") }); }
      finally { if (!cancelled) setOnChainSyncing(false); }
    };
    void sync(true);
    const scheduleNext = () => setNextRefreshAt(Date.now() + refreshInterval * 1000);
    scheduleNext();
    const timer = window.setInterval(() => { void sync(false); scheduleNext(); }, refreshInterval * 1000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [autoRefreshPaused, contractAddress, rows, refreshInterval, isPageVisible, t]);

  useEffect(() => {
    if (!contractAddress.trim() || !window.ethereum || !isPageVisible || autoRefreshPaused) return;
    let cancelled = false;
    const load = async () => {
      setEventLoading(true); setEventError("");
      try { const events = await readReferralCodeHistory(window.ethereum, contractAddress.trim()); if (!cancelled) setEventHistory(events); }
      catch (error: any) { if (!cancelled) setEventError(error?.message || "อ่าน Event Log ไม่สำเร็จ"); }
      finally { if (!cancelled) setEventLoading(false); }
    };
    void load();
    const timer = window.setInterval(() => { void load(); }, refreshInterval * 1000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [autoRefreshPaused, contractAddress, refreshInterval, isPageVisible]);

  useEffect(() => {
    if (!nextRefreshAt || !isPageVisible) return;
    const update = () => setSecondsToRefresh(Math.max(0, Math.ceil((nextRefreshAt - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [isPageVisible, nextRefreshAt]);

  const refreshProgress = nextRefreshAt ? Math.max(0, Math.min(100, (secondsToRefresh / refreshInterval) * 100)) : 0;

  async function connectOwnerWallet() {
    try {
      if (!window.ethereum) throw new Error("ไม่พบ MetaMask หรือ EIP-1193 Wallet");
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const next = accounts?.[0] || "";
      if (next.toLowerCase() !== OWNER_ADDRESS.toLowerCase()) throw new Error(`ต้องใช้ Owner wallet ${shortAddress(OWNER_ADDRESS)}`);
      setAccount(next);
      toast.success(t("ownerWalletReady"), { description: t("reviewBeforeSend") });
    } catch (error: any) {
      toast.error(t("ownerConnectFailed"), { description: error?.message || t("transactionRejected") });
    }
  }

  async function addMapping(event: React.FormEvent) {
    event.preventDefault();
    if (!account) return toast.error(t("ownerConnectFailed"));
    if (!contractAddress) return toast.error(t("checkContractAndAbi"));
    setBusyId(-1);
    let createdRowId: number | undefined;
    try {
      const row = await createMapping.mutateAsync({ code, referrerAddress });
      if (!row?.id) throw new Error("Backend ไม่ส่ง mapping id กลับมา");
      createdRowId = row.id;
      toast.info(t("registrationPreparing"), { description: t("reviewBeforeSend") });
      const tx: any = submitSetReferralCode(window.ethereum, contractAddress, account, code, referrerAddress, true);
      let txHash = "";
      tx.on("transactionHash", (hash: string) => { txHash = hash; });
      const receipt = await tx;
      const failed = receipt?.status === false || receipt?.status === 0 || receipt?.status === "0x0" || String(receipt?.status) === "0";
      if (failed) throw new Error("Contract revert หรือ receipt ไม่สำเร็จ");
      await markResult.mutateAsync({ id: row.id, status: "active", txHash });
      await utils.referralCodes.list.invalidate();
      setCode("");
      setReferrerAddress("");
      setPage(1);
      toast.success(t("registrationConfirmed"), { description: txHash ? `Tx ${shortAddress(txHash)}` : t("auditSource") });
    } catch (error: any) {
      if (createdRowId) await markResult.mutateAsync({ id: createdRowId, status: "failed" }).catch(() => undefined);
      toast.error(t("registrationFailed"), { description: error?.message || t("checkContractAndAbi") });
      await utils.referralCodes.list.invalidate();
    } finally {
      setBusyId(null);
    }
  }

  async function verifyOnChain(row: MappingRow) {
    if (!contractAddress) return toast.error(t("checkContractAndAbi"));
    setVerifyingCode(row.code);
    try {
      const actual = await readReferralCodeMapping(window.ethereum, contractAddress, row.code);
      setOnChainResults(previous => ({ ...previous, [row.code]: actual }));
      const matches = actual.toLowerCase() === row.referrerAddress.toLowerCase();
      toast[matches ? "success" : "error"](matches ? "Mapping ตรงกับเชน" : "Mapping ไม่ตรงกับเชน", { description: actual === ZERO_ADDRESS ? t("notAvailable") : `On-chain referrer: ${actual}` });
    } catch (error: any) {
      toast.error(t("verifyFailed"), { description: error?.message || t("checkContractAndAbi") });
    } finally {
      setVerifyingCode(null);
    }
  }

  async function disableMapping(row: MappingRow) {
    if (!account) return toast.error(t("ownerConnectFailed"));
    if (!contractAddress) return toast.error(t("checkContractAndAbi"));
    if (!window.confirm(`ยืนยันปิด Referral Code ${row.code} บนเชน? ผู้ใช้ใหม่จะไม่สามารถใช้ code นี้ได้`)) return;
    setBusyId(row.id);
    let txHash = "";
    try {
      toast.info(t("disablePreparing"), { description: t("reviewBeforeSend") });
      const tx: any = submitSetReferralCode(window.ethereum, contractAddress, account, row.code, row.referrerAddress, false);
      tx.on("transactionHash", (hash: string) => { txHash = hash; });
      const receipt = await tx;
      const failed = receipt?.status === false || receipt?.status === 0 || receipt?.status === "0x0" || String(receipt?.status) === "0";
      if (failed) throw new Error("Contract revert หรือ receipt ไม่สำเร็จ");
      await markResult.mutateAsync({ id: row.id, status: "disabled", txHash });
      setOnChainResults(previous => ({ ...previous, [row.code]: ZERO_ADDRESS }));
      await utils.referralCodes.list.invalidate();
      toast.success(t("disableConfirmed"), { description: txHash ? `Tx ${shortAddress(txHash)}` : t("auditSource") });
    } catch (error: any) {
      toast.error(t("disableFailed"), { description: error?.message || t("transactionRejected") });
    } finally {
      setBusyId(null);
    }
  }

  const queryError = mappingsQuery.error?.message || "";
  const invalidDateRange = Boolean(dateFrom && dateTo && dateFrom > dateTo);
  const filteredRows = useMemo(() => {
    if (invalidDateRange) return [];
    const needle = search.trim().toLowerCase();
    const fromTime = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toTime = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;
    return rows.filter(row => {
      const chainStatus = onChainStatus(row, onChainResults[row.code]);
      const matchesFilter = onChainFilter === "all" || chainStatus === onChainFilter;
      const matchesSearch = !needle || [row.code, row.referrerAddress, row.status, row.txHash || "", chainStatus].some(value => value.toLowerCase().includes(needle));
      const updatedTime = row.updatedAt ? new Date(String(row.updatedAt)).getTime() : null;
      const matchesFrom = fromTime === null || (updatedTime !== null && updatedTime >= fromTime);
      const matchesTo = toTime === null || (updatedTime !== null && updatedTime <= toTime);
      return matchesFilter && matchesSearch && matchesFrom && matchesTo;
    });
  }, [rows, search, dateFrom, dateTo, invalidDateRange, onChainFilter, onChainResults]);
  const sortedRows = useMemo(() => [...filteredRows].sort((a, b) => new Date(String(b.updatedAt || 0)).getTime() - new Date(String(a.updatedAt || 0)).getTime()), [filteredRows]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = sortedRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const adminTreeNodes = useMemo<ReferralTreeNode[]>(() => {
    const groups = new Map<string, MappingRow[]>();
    rows.forEach(row => groups.set(row.referrerAddress.toLowerCase(), [...(groups.get(row.referrerAddress.toLowerCase()) || []), row]));
    return Array.from(groups.entries()).map(([address, entries], index) => ({ id: `branch-${address}`, label: `${t("branch")} B${index + 1}`, detail: address, tone: "branch", children: entries.map((row, childIndex) => ({ id: `${row.code}-${row.id}`, label: `${t("userBranch")} ${childIndex + 1} · ${row.code}`, detail: row.referrerAddress, tone: "user" })) }));
  }, [rows, t]);
  const branchStats = useMemo(() => {
    const groups = new Map<string, number>();
    rows.forEach(row => groups.set(row.referrerAddress.toLowerCase(), (groups.get(row.referrerAddress.toLowerCase()) || 0) + 1));
    return Array.from(groups.entries()).map(([address, count], index) => ({ label: `B${index + 1} · ${shortAddress(address)}`, count }));
  }, [rows]);

  function exportCsv() {
    if (!filteredRows.length) return toast.info(t("noDataToExport"));
    const headers = ["Referral Code", "Code Hash", "Referrer Wallet", "Backend Status", "On-chain Status", "On-chain Referrer", "Transaction Hash", "Last Updated"];
    const csvRows = [...filteredRows].sort((a, b) => new Date(String(b.updatedAt || 0)).getTime() - new Date(String(a.updatedAt || 0)).getTime()).map(row => [row.code, row.codeHash, row.referrerAddress, row.status, onChainStatus(row, onChainResults[row.code]), onChainResults[row.code] || "", row.txHash || "", row.updatedAt ? new Date(String(row.updatedAt)).toISOString() : ""]);
    const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const blob = new Blob([[headers, ...csvRows].map(row => row.map(escape).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `referral-codes-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(t("exportSuccess"), { description: t("exportedCount", { count: filteredRows.length }) });
  }

  return <div className="min-h-screen bg-[#f6f9fb] text-slate-900">
    <header className="border-b border-slate-200/70 bg-white/90 px-4 py-4 backdrop-blur-xl sm:px-8"><div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">{t("ownerControlPlane")}</p><h1 className="mt-1 text-2xl font-bold tracking-tight">{t("referralRegistry")}</h1><p className="mt-1 text-sm text-slate-500">{t("manageMapping")}</p></div><div className="flex items-center gap-2"><LanguageSwitcher /><SettingsPanel /><span className="hidden min-w-[118px] rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-500 lg:inline-flex lg:flex-col lg:gap-1" title={autoRefreshPaused || !isPageVisible ? t("refreshPaused") : t("nextRefresh", { seconds: secondsToRefresh })}><span className="flex items-center gap-1">{autoRefreshPaused || !isPageVisible ? t("refreshPaused") : t("nextRefresh", { seconds: secondsToRefresh })}</span><span className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><span className={`block h-full rounded-full bg-teal-500 transition-[width] duration-1000 ${autoRefreshPaused || !isPageVisible ? "w-0" : ""}`} style={{ width: autoRefreshPaused || !isPageVisible ? "0%" : `${refreshProgress}%` }} /></span></span><Link href="/" className="hidden rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 sm:inline-flex">{t("backDashboard")}</Link><Button onClick={connectOwnerWallet} className="gap-2 rounded-xl bg-slate-950 text-white hover:bg-slate-800"><Wallet size={16} />{account ? shortAddress(account) : "Connect Owner"}</Button></div></div></header>
    <main className="mx-auto max-w-[1280px] space-y-6 px-4 py-6 sm:px-8 lg:py-8">
      <section className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]"><div className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl shadow-slate-950/10"><div className="flex items-start gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-300/15 text-teal-200"><ShieldCheck size={22} /></span><div><h2 className="text-xl font-bold">{t("ownerOnly")}</h2><p className="mt-2 text-sm leading-6 text-slate-300">{t("backendAccessNotice")}</p></div></div><div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs"><p className="text-slate-400">{t("configuredOwner")}</p><code className="mt-1 block break-all text-teal-200">{OWNER_ADDRESS}</code></div></div><div className="rounded-3xl border border-amber-200 bg-amber-50 p-6"><div className="flex gap-3"><AlertTriangle className="mt-0.5 shrink-0 text-amber-700" size={20} /><div><h2 className="font-bold text-amber-950">{t("reviewBeforeSend")}</h2><p className="mt-2 text-sm leading-6 text-amber-900">{t("disableNotice")}</p></div></div></div></section>
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.04)]"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-bold">{t("addReferral")}</h2><p className="mt-1 text-xs text-slate-400">{t("codeNormalized")}</p></div></div><form onSubmit={addMapping} className="grid gap-3 md:grid-cols-[.7fr_1fr_1.3fr_auto]"><input value={code} onChange={event => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 32))} placeholder={t("addCodePlaceholder")} className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-sm tracking-wider outline-none focus:border-teal-400 focus:bg-white" /><input value={referrerAddress} onChange={event => setReferrerAddress(event.target.value.trim())} placeholder={t("referrerPlaceholder")} className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-xs outline-none focus:border-teal-400 focus:bg-white" /><input value={contractAddress} onChange={event => setContractAddress(event.target.value.trim())} placeholder={t("contractPlaceholder")} className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-xs outline-none focus:border-teal-400 focus:bg-white" /><Button disabled={busyId === -1 || !code || !referrerAddress || !contractAddress} className="h-11 gap-2 rounded-xl bg-teal-600 text-white hover:bg-teal-700">{busyId === -1 ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />} {t("setMapping")}</Button></form></section>
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.04)]"><div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-bold">{t("mappings")}</h2><p className="mt-1 text-xs text-slate-400">{filteredRows.length} จาก {rows.length} รายการ · Backend เป็น audit index และ Contract เป็น source of truth</p></div><Button variant="outline" onClick={() => mappingsQuery.refetch()} disabled={mappingsQuery.isFetching} className="gap-2 rounded-xl">{mappingsQuery.isFetching ? <Loader2 className="animate-spin" size={15} /> : <RefreshCw size={15} />} {t("refresh")}</Button><Button variant="outline" onClick={exportCsv} disabled={!filteredRows.length || invalidDateRange} className="gap-2 rounded-xl"><Download size={15} />{t("exportCsv")}</Button></div><div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/50 p-4 sm:flex-row sm:items-center"><div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder={t("searchPlaceholder")} className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-teal-400" /></div>{search && <Button variant="outline" onClick={() => { setSearch(""); setPage(1); }} className="h-10 rounded-xl">{t("clearFilter")}</Button>}</div>{queryError && <div className="m-5 flex gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800"><XCircle size={17} />{queryError.includes("FORBIDDEN") || queryError.includes("permission") ? t("ownerSessionRequired") : queryError}</div>}{mappingsQuery.isLoading ? <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-400"><Loader2 className="animate-spin" size={18} />{t("loadingMappings")}</div> : <><div className="overflow-x-auto"><table title={t("sortNewest")} className="w-full min-w-[1040px] text-left text-sm"><thead className="bg-slate-50/80 text-xs font-semibold text-slate-500"><tr><th className="px-5 py-3">{t("code")}</th><th className="px-5 py-3">{t("referrer")}</th><th className="px-5 py-3">{t("status")}</th><th className="px-5 py-3">{t("onchainCheck")}</th><th className="px-5 py-3">{t("transaction")}</th><th className="px-5 py-3">{t("lastUpdated")}</th><th className="px-5 py-3 text-right">{t("manage")}</th></tr></thead><tbody className="divide-y divide-slate-100">{pagedRows.length === 0 ? <tr><td colSpan={7} className="p-12 text-center text-sm text-slate-400">{t("noMappings")}</td></tr> : pagedRows.map(row => <tr key={row.id} className={`transition hover:bg-teal-50/20 ${highlightedCodes.includes(row.code) ? "animate-pulse bg-amber-50 ring-1 ring-inset ring-amber-200" : ""}`} ><td className="px-5 py-4"><code className="rounded-lg bg-slate-100 px-2.5 py-1.5 font-mono text-sm font-bold text-slate-800">{row.code}</code><p className="mt-2 font-mono text-[10px] text-slate-400">{row.codeHash}</p></td><td className="px-5 py-4 font-mono text-xs text-slate-600">{shortAddress(row.referrerAddress)}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${statusStyle(row.status)}`}>{row.status}</span></td><td className="px-5 py-4">{onChainResults[row.code] ? <div className="flex items-center gap-2 text-xs"><CheckCircle2 size={15} className={onChainResults[row.code].toLowerCase() === row.referrerAddress.toLowerCase() ? "text-emerald-600" : "text-rose-600"} /><code>{shortAddress(onChainResults[row.code])}</code></div> : <Button variant="outline" onClick={() => verifyOnChain(row)} disabled={verifyingCode === row.code} className="h-8 gap-1.5 rounded-lg px-2.5 text-xs">{verifyingCode === row.code ? <Loader2 className="animate-spin" size={13} /> : <RefreshCw size={13} />} {t("verifyOnchain")}</Button>}</td><td className="px-5 py-4">{row.txHash ? <a href={`https://bscscan.com/tx/${row.txHash}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline">{shortAddress(row.txHash)} <ExternalLink size={12} /></a> : <span className="text-xs text-slate-400">{t("noTx")}</span>}</td><td className="px-5 py-4 whitespace-nowrap text-xs text-slate-500">{row.updatedAt ? new Date(String(row.updatedAt)).toLocaleString() : "—"}</td><td className="px-5 py-4 text-right">{row.status === "active" && <Button variant="outline" onClick={() => disableMapping(row)} disabled={busyId === row.id} className="h-8 rounded-lg border-rose-200 px-2.5 text-xs text-rose-700 hover:bg-rose-50">{busyId === row.id ? <Loader2 className="animate-spin" size={13} /> : t("disableOnchain")}</Button>}</td></tr>)}</tbody></table></div><div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-slate-500">หน้า {safePage} / {totalPages} · แสดง {pagedRows.length} รายการ</p><div className="flex items-center gap-2"><Button variant="outline" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={safePage <= 1} className="h-9 gap-1 rounded-lg"><ChevronLeft size={15} />{t("previous")}</Button><Button variant="outline" onClick={() => setPage(current => Math.min(totalPages, current + 1))} disabled={safePage >= totalPages} className="h-9 gap-1 rounded-lg">{t("next")}<ChevronRight size={15} /></Button></div></div></>}</section>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4"><span className="text-sm font-semibold text-slate-700">{t("filterStatus")}</span><select value={onChainFilter} onChange={event => { setOnChainFilter(event.target.value as typeof onChainFilter); setPage(1); }} className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-teal-400"><option value="all">{t("allStatuses")}</option><option value="active">{t("activeMatch")}</option><option value="disabled">{t("disabledZero")}</option><option value="mismatch">{t("mismatch")}</option><option value="unknown">{t("unknown")}</option></select><span className="text-sm font-semibold text-slate-700">{t("dateRange")}</span><label className="flex items-center gap-2 text-xs text-slate-500">{t("dateFrom")}<input type="date" value={dateFrom} onChange={event => { setDateFrom(event.target.value); setPage(1); }} className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700" /></label><label className="flex items-center gap-2 text-xs text-slate-500">{t("dateTo")}<input type="date" value={dateTo} onChange={event => { setDateTo(event.target.value); setPage(1); }} className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700" /></label>{(dateFrom || dateTo) && <Button variant="outline" onClick={() => { setDateFrom(""); setDateTo(""); setPage(1); }} className="h-10 rounded-xl">{t("clearDateRange")}</Button>}{invalidDateRange && <span className="text-xs font-semibold text-rose-700">{t("invalidDateRange")}</span>}{onChainSyncing && <span className="inline-flex items-center gap-1 text-xs text-teal-700"><Loader2 className="animate-spin" size={14} /> {t("autoRefreshRunningLabel")}</span>}</div>
      <BranchReferralStats branches={branchStats} />
      <ReferralTree nodes={adminTreeNodes} mode="admin" note={t("treeDataNotice")} />
      <ReferralEventPanel events={eventHistory} loading={eventLoading} error={eventError} />
    </main>
  </div>;
}
