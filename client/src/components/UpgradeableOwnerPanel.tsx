import { useEffect, useMemo, useState } from "react";
import {
  BrowserProvider,
  Contract,
  JsonRpcProvider,
  formatEther,
  formatUnits,
  parseEther,
  parseUnits,
} from "ethers";
import {
  Coins,
  Database,
  ExternalLink,
  Gauge,
  KeyRound,
  Loader2,
  ShieldCheck,
  Wallet,
} from "lucide-react";

const TESTNET_CHAIN_ID = BigInt(97);
const RPC_URL = "https://bsc-testnet-rpc.publicnode.com";
const EXPLORER = "https://testnet.bscscan.com";
const IMPLEMENTATION_SLOT =
  "0x360894A13BA1A3210667C828492DB98DCA3E2076CC3735A920A3CA505D382BBC";
const DEFAULT_PROXY =
  import.meta.env.VITE_TESTNET_UPGRADEABLE_PROXY_ADDRESS ||
  "0x3a358d2151b0aD8adB9f8C218bD2B268d53654eE";
const ABI = [
  "function owner() view returns (address)",
  "function asset() view returns (address)",
  "function assetDecimals() view returns (uint8)",
  "function depositAmount() view returns (uint256)",
  "function serviceFeeWei() view returns (uint256)",
  "function maxFundTickets() view returns (uint256)",
  "function feeWallet() view returns (address)",
  "function setServiceFeeWei(uint256 newValue)",
  "function setDepositAmount(uint256 newValue)",
  "function setMaxFundTickets(uint256 newValue)",
  "function setFeeWallet(address payable newWallet)",
  "event ServiceFeeUpdated(uint256 oldValue, uint256 newValue)",
  "event DepositAmountUpdated(uint256 oldValue, uint256 newValue)",
  "event MaxFundTicketsUpdated(uint256 oldValue, uint256 newValue)",
  "event FeeWalletUpdated(address indexed oldWallet, address indexed newWallet)",
];

declare global {
  interface Window {
    ethereum?: any;
  }
}
function short(value: string) {
  return value ? `${value.slice(0, 8)}…${value.slice(-6)}` : "—";
}
function validAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

type Config = {
  owner: string;
  asset: string;
  decimals: number;
  deposit: string;
  fee: string;
  maxBatch: string;
  feeWallet: string;
  implementation: string;
};

type AuditEntry = {
  type: "Service fee" | "Deposit amount" | "Max fund tickets" | "Fee wallet";
  oldValue: string;
  newValue: string;
  txHash: string;
  blockNumber: number;
};

export function UpgradeableOwnerPanel({
  verifiedAccount = "",
}: {
  verifiedAccount?: string;
}) {
  const [proxy, setProxy] = useState(DEFAULT_PROXY);
  const [account, setAccount] = useState(verifiedAccount);
  const [config, setConfig] = useState<Config | null>(null);
  const [serviceFee, setServiceFee] = useState("0.0013");
  const [deposit, setDeposit] = useState("13");
  const [maxBatch, setMaxBatch] = useState("50");
  const [feeWallet, setFeeWallet] = useState("");
  const [status, setStatus] = useState("ยังไม่ได้อ่าน Proxy");
  const [busy, setBusy] = useState(false);
  const [auditBusy, setAuditBusy] = useState(false);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [auditError, setAuditError] = useState("");
  const readProvider = useMemo(() => new JsonRpcProvider(RPC_URL, 97), []);

  function assertProxy() {
    if (!validAddress(proxy))
      throw new Error("กรุณาใส่ UUPS Proxy address ที่ถูกต้อง");
  }
  async function wallet() {
    if (!window.ethereum) throw new Error("ไม่พบ Wallet provider");
    const provider = new BrowserProvider(window.ethereum);
    if ((await provider.getNetwork()).chainId !== TESTNET_CHAIN_ID)
      throw new Error("กรุณาเปลี่ยนเป็น BSC Testnet (Chain ID 97)");
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    setAccount(address);
    return signer;
  }
  async function readConfig() {
    try {
      assertProxy();
      setBusy(true);
      setStatus("กำลังอ่าน Proxy, Implementation และ Owner…");
      const c = new Contract(proxy, ABI, readProvider);
      const [
        owner,
        asset,
        decimalsRaw,
        depositRaw,
        feeRaw,
        maxRaw,
        feeRecipient,
        implementationRaw,
      ] = await Promise.all([
        c.owner(),
        c.asset(),
        c.assetDecimals(),
        c.depositAmount(),
        c.serviceFeeWei(),
        c.maxFundTickets(),
        c.feeWallet(),
        readProvider.getStorage(proxy, IMPLEMENTATION_SLOT),
      ]);
      const decimals = Number(decimalsRaw);
      const implementation = `0x${implementationRaw.slice(-40)}`;
      const next = {
        owner,
        asset,
        decimals,
        deposit: formatUnits(depositRaw, decimals),
        fee: formatEther(feeRaw),
        maxBatch: String(maxRaw),
        feeWallet: feeRecipient,
        implementation,
      };
      setConfig(next);
      setServiceFee(next.fee);
      setDeposit(next.deposit);
      setMaxBatch(next.maxBatch);
      setFeeWallet(next.feeWallet);
      setStatus("อ่านข้อมูล Proxy สำเร็จ — read-only");
      void readAudit();
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "อ่าน Proxy ไม่สำเร็จ"
      );
    } finally {
      setBusy(false);
    }
  }
  async function readAudit() {
    try {
      setAuditBusy(true);
      setAuditError("");
      const latest = await readProvider.getBlockNumber();
      // Public BSC RPCs rate-limit wide eth_getLogs queries; keep this bounded.
      const fromBlock = Math.max(0, latest - 1_000);
      const c = new Contract(proxy, ABI, readProvider) as any;
      const feeEvents = await c.queryFilter(
        c.filters.ServiceFeeUpdated(),
        fromBlock,
        latest
      );
      const depositEvents = await c.queryFilter(
        c.filters.DepositAmountUpdated(),
        fromBlock,
        latest
      );
      const maxEvents = await c.queryFilter(
        c.filters.MaxFundTicketsUpdated(),
        fromBlock,
        latest
      );
      const walletEvents = await c.queryFilter(
        c.filters.FeeWalletUpdated(),
        fromBlock,
        latest
      );
      const decimals = config?.decimals ?? 18;
      const rows: AuditEntry[] = [
        ...feeEvents.map((event: any) => ({
          type: "Service fee" as const,
          oldValue: `${formatEther(event.args[0])} BNB`,
          newValue: `${formatEther(event.args[1])} BNB`,
          txHash: event.transactionHash,
          blockNumber: Number(event.blockNumber),
        })),
        ...depositEvents.map((event: any) => ({
          type: "Deposit amount" as const,
          oldValue: `${formatUnits(event.args[0], decimals)} USDT`,
          newValue: `${formatUnits(event.args[1], decimals)} USDT`,
          txHash: event.transactionHash,
          blockNumber: Number(event.blockNumber),
        })),
        ...maxEvents.map((event: any) => ({
          type: "Max fund tickets" as const,
          oldValue: String(event.args[0]),
          newValue: String(event.args[1]),
          txHash: event.transactionHash,
          blockNumber: Number(event.blockNumber),
        })),
        ...walletEvents.map((event: any) => ({
          type: "Fee wallet" as const,
          oldValue: short(event.args[0]),
          newValue: short(event.args[1]),
          txHash: event.transactionHash,
          blockNumber: Number(event.blockNumber),
        })),
      ].sort((a, b) => b.blockNumber - a.blockNumber);
      setAudit(rows.slice(0, 50));
    } catch (error) {
      setAudit([]);
      setAuditError(
        error instanceof Error ? error.message : "อ่าน event history ไม่สำเร็จ"
      );
    } finally {
      setAuditBusy(false);
    }
  }
  async function send(label: string, call: (c: Contract) => Promise<any>) {
    try {
      assertProxy();
      setBusy(true);
      const signer = await wallet();
      const c = new Contract(proxy, ABI, signer);
      setStatus(`${label}: กรุณาตรวจสอบและยืนยันใน Wallet…`);
      const tx = await call(c);
      setStatus(`${label}: รอ receipt…`);
      await tx.wait();
      setStatus(`${label}: สำเร็จ`);
      await readConfig();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `${label} ไม่สำเร็จ`);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    setAccount(verifiedAccount);
  }, [verifiedAccount]);
  useEffect(() => {
    void readConfig();
  }, []);
  const isOwner = Boolean(
    config && account && config.owner.toLowerCase() === account.toLowerCase()
  );
  return (
    <section
      className="rounded-2xl border border-violet-200 bg-violet-50/40 p-5 shadow-sm sm:p-6"
      aria-label="Upgradeable proxy transparency and owner controls"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Upgradeable Proxy · Transparency & Owner controls
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            ตรวจสอบ Proxy, Implementation และ Owner บน BSC Testnet ก่อนเรียกใช้
            setter
          </p>
        </div>
        <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-900">
          <ShieldCheck size={13} className="mr-1 inline" />
          UUPS TESTNET
        </span>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto_auto]">
        <input
          value={proxy}
          onChange={e => setProxy(e.target.value)}
          placeholder="UUPS Proxy address"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs"
        />
        <button
          type="button"
          onClick={() => void readConfig()}
          disabled={busy}
          className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white"
        >
          {busy ? (
            <Loader2 size={14} className="mr-1 inline animate-spin" />
          ) : null}
          Read proxy
        </button>
        <button
          type="button"
          onClick={() => void wallet()}
          disabled={busy}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold"
        >
          <Wallet size={14} className="mr-1 inline" />
          {account ? short(account) : "Connect wallet"}
        </button>
      </div>
      {config && (
        <div className="mt-5 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4">
              <div className="flex items-center justify-between text-teal-700">
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Current service fee
                </span>
                <Coins size={17} />
              </div>
              <p className="mt-2 text-2xl font-black tracking-tight text-teal-950">
                {config.fee} <span className="text-sm font-bold">BNB</span>
              </p>
              <p className="mt-1 text-[11px] text-teal-800/70">
                เรียกเก็บตามค่าที่อ่านจาก Proxy
              </p>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center justify-between text-blue-700">
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Deposit amount
                </span>
                <Database size={17} />
              </div>
              <p className="mt-2 text-2xl font-black tracking-tight text-blue-950">
                {config.deposit} <span className="text-sm font-bold">USDT</span>
              </p>
              <p className="mt-1 text-[11px] text-blue-800/70">
                Asset decimals: {config.decimals}
              </p>
            </div>
            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
              <div className="flex items-center justify-between text-violet-700">
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Max fund tickets
                </span>
                <Gauge size={17} />
              </div>
              <p className="mt-2 text-2xl font-black tracking-tight text-violet-950">
                {config.maxBatch}
              </p>
              <p className="mt-1 text-[11px] text-violet-800/70">
                สูงสุดต่อการ fund แบบ batch
              </p>
            </div>
            <div
              className={`rounded-2xl border p-4 ${isOwner ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}
            >
              <div
                className={`flex items-center justify-between ${isOwner ? "text-emerald-700" : "text-slate-600"}`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Wallet role
                </span>
                <KeyRound size={17} />
              </div>
              <p
                className={`mt-2 text-lg font-black tracking-tight ${isOwner ? "text-emerald-950" : "text-slate-900"}`}
              >
                {isOwner ? "OWNER VERIFIED" : "READ-ONLY"}
              </p>
              <p className="mt-1 truncate font-mono text-[11px] text-slate-600">
                {short(config.owner)}
              </p>
            </div>
          </div>
          <div className="grid gap-2 text-xs sm:grid-cols-2">
            <div className="rounded-xl border border-violet-200 bg-white p-3 font-mono">
              <span className="mr-2 font-sans font-bold text-slate-500">
                Proxy
              </span>
              {proxy}{" "}
              <a
                href={`${EXPLORER}/address/${proxy}`}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={12} className="inline text-blue-700" />
              </a>
            </div>
            <div className="rounded-xl border border-violet-200 bg-white p-3 font-mono">
              <span className="mr-2 font-sans font-bold text-slate-500">
                Implementation
              </span>
              {config.implementation}{" "}
              <a
                href={`${EXPLORER}/address/${config.implementation}`}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={12} className="inline text-blue-700" />
              </a>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 font-mono">
              <span className="mr-2 font-sans font-bold text-slate-500">
                Owner
              </span>
              {config.owner}
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 font-mono">
              <span className="mr-2 font-sans font-bold text-slate-500">
                Fee wallet
              </span>
              {config.feeWallet}
            </div>
          </div>
        </div>
      )}
      <section
        className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white"
        aria-label="Fee change audit history"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Parameter change history
            </h3>
            <p className="mt-1 text-[11px] text-slate-500">
              อ่านจาก events บน Proxy · แสดงสูงสุด 50 รายการล่าสุดใน 1,000
              blocks
            </p>
          </div>
          <button
            type="button"
            onClick={() => void readAudit()}
            disabled={auditBusy}
            className="rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-700 hover:border-violet-300 hover:text-violet-700 disabled:opacity-50"
          >
            {auditBusy ? (
              <Loader2 size={13} className="mr-1 inline animate-spin" />
            ) : null}{" "}
            Refresh history
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Parameter</th>
                <th className="px-4 py-3">Previous</th>
                <th className="px-4 py-3">New</th>
                <th className="px-4 py-3">Block</th>
                <th className="px-4 py-3">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {audit.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-slate-400"
                  >
                    {auditBusy
                      ? "กำลังอ่าน event history…"
                      : auditError ||
                        "ยังไม่พบการเปลี่ยนค่าในช่วง 1,000 blocks ล่าสุด"}
                  </td>
                </tr>
              ) : (
                audit.map(row => (
                  <tr key={`${row.txHash}-${row.type}`}>
                    <td className="px-4 py-3 font-semibold text-slate-700">
                      {row.type}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500">
                      {row.oldValue}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-slate-800">
                      {row.newValue}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500">
                      {row.blockNumber}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`${EXPLORER}/tx/${row.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline"
                      >
                        View receipt <ExternalLink size={12} />
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      <div className="mt-4 rounded-xl border border-violet-200 bg-white p-4">
        <p className="text-xs font-semibold text-violet-900">
          Owner parameter controls
        </p>
        <p className="mt-1 text-[11px] text-slate-500">
          ปุ่มด้านล่างส่งธุรกรรมจริงบน Testnet เฉพาะเมื่อ Wallet ปัจจุบันเป็น
          Owner และผู้ใช้กดยืนยันเอง
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <label className="text-xs text-slate-600">
            Service fee (BNB)
            <input
              value={serviceFee}
              onChange={e => setServiceFee(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-xs"
            />
          </label>
          <label className="text-xs text-slate-600">
            Deposit amount
            <input
              value={deposit}
              onChange={e => setDeposit(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-xs"
            />
          </label>
          <label className="text-xs text-slate-600">
            Max fund tickets
            <input
              value={maxBatch}
              onChange={e => setMaxBatch(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-xs"
            />
          </label>
          <label className="text-xs text-slate-600 md:col-span-2">
            Fee wallet
            <input
              value={feeWallet}
              onChange={e => setFeeWallet(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-xs"
            />
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <button
              type="button"
              onClick={() =>
                void send("Update service fee", c =>
                  c.setServiceFeeWei(parseEther(serviceFee))
                )
              }
              disabled={busy || !isOwner}
              className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
            >
              Set fee
            </button>
            <button
              type="button"
              onClick={() =>
                void send("Update deposit amount", c =>
                  c.setDepositAmount(
                    parseUnits(deposit, config?.decimals ?? 18)
                  )
                )
              }
              disabled={busy || !isOwner}
              className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
            >
              Set deposit
            </button>
            <button
              type="button"
              onClick={() =>
                void send("Update max batch", c =>
                  c.setMaxFundTickets(BigInt(maxBatch))
                )
              }
              disabled={busy || !isOwner}
              className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
            >
              Set max
            </button>
            <button
              type="button"
              onClick={() =>
                void send("Update fee wallet", c => c.setFeeWallet(feeWallet))
              }
              disabled={busy || !isOwner || !validAddress(feeWallet)}
              className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
            >
              Set wallet
            </button>
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-600" aria-live="polite">
        สถานะ: {status}
      </p>
    </section>
  );
}
