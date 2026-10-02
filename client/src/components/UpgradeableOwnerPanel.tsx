import { useMemo, useState } from "react";
import {
  BrowserProvider,
  Contract,
  JsonRpcProvider,
  formatEther,
  formatUnits,
  parseEther,
  parseUnits,
} from "ethers";
import { ExternalLink, Loader2, ShieldCheck, Wallet } from "lucide-react";

const TESTNET_CHAIN_ID = BigInt(97);
const RPC_URL = "https://bsc-testnet-dataseed.bnbchain.org";
const EXPLORER = "https://testnet.bscscan.com";
const IMPLEMENTATION_SLOT =
  "0x360894A13BA1A3210667C828492DB98DCA3E2076CC3735A920A3CA505D382BBC";
const DEFAULT_PROXY =
  import.meta.env.VITE_TESTNET_UPGRADEABLE_PROXY_ADDRESS || "";
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

export function UpgradeableOwnerPanel() {
  const [proxy, setProxy] = useState(DEFAULT_PROXY);
  const [account, setAccount] = useState("");
  const [config, setConfig] = useState<Config | null>(null);
  const [serviceFee, setServiceFee] = useState("0.0013");
  const [deposit, setDeposit] = useState("13");
  const [maxBatch, setMaxBatch] = useState("50");
  const [feeWallet, setFeeWallet] = useState("");
  const [status, setStatus] = useState("ยังไม่ได้อ่าน Proxy");
  const [busy, setBusy] = useState(false);
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
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "อ่าน Proxy ไม่สำเร็จ"
      );
    } finally {
      setBusy(false);
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
        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
          <div className="rounded-lg bg-white p-3 font-mono">
            Proxy: {short(proxy)}{" "}
            <a
              href={`${EXPLORER}/address/${proxy}`}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={12} className="inline text-blue-700" />
            </a>
          </div>
          <div className="rounded-lg bg-white p-3 font-mono">
            Implementation: {short(config.implementation)}{" "}
            <a
              href={`${EXPLORER}/address/${config.implementation}`}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={12} className="inline text-blue-700" />
            </a>
          </div>
          <div className="rounded-lg bg-white p-3 font-mono">
            Owner: {short(config.owner)}
          </div>
          <div
            className={`rounded-lg p-3 font-semibold ${isOwner ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}
          >
            {isOwner
              ? "Connected wallet is Owner"
              : "Connected wallet is read-only"}
          </div>
          <div className="rounded-lg bg-white p-3">
            Asset: <span className="font-mono">{short(config.asset)}</span> ·
            Decimals: <b>{config.decimals}</b>
          </div>
          <div className="rounded-lg bg-white p-3">
            Current fee: <b>{config.fee} BNB</b> · Deposit:{" "}
            <b>{config.deposit}</b> · Max batch: <b>{config.maxBatch}</b>
          </div>
        </div>
      )}
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
      <p className="mt-3 text-xs text-slate-600">สถานะ: {status}</p>
    </section>
  );
}
