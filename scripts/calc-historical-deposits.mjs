#!/usr/bin/env node
import { Contract, JsonRpcProvider, getAddress, isAddress, formatUnits } from "ethers";

const DEFAULT_PROXY = "0x56ed01a6b08ac9ba88f9c88ee5c1455410b2cc06";
const DEFAULT_RPC = "https://bsc-dataseed.binance.org";
const DEFAULT_FROM_BLOCK = 125264357;

const ABI = [
  "event InitializedConfig(address indexed asset, uint8 assetDecimals, uint256 depositAmount, uint256 serviceFeeWei, uint256 maxFundTickets, address indexed feeWallet, address indexed owner)",
  "event DepositAmountUpdated(uint256 oldValue, uint256 newValue)",
  "event Registered(uint256 indexed ticketId, address indexed payer, address indexed recipient, uint256 tokenAmount, uint256 serviceFeeWei)",
];

function arg(name, fallback = undefined) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function numberArg(name, fallback) {
  const value = arg(name);
  if (value === undefined) return fallback;
  if (value === "latest") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${name} ต้องเป็นจำนวนเต็มไม่ติดลบ`);
  return parsed;
}

function help() {
  console.log(`คำนวณ historicalUserDeposits จาก Event Registered แบบ Read-only

การใช้งาน:
  node scripts/calc-historical-deposits.mjs --from-block <block> [ตัวเลือก]

ตัวเลือก:
  --proxy <address>       Mainnet/Testnet Proxy
  --rpc <url>             RPC หรือ BSC_RPC_URL
  --from-block <number>   บล็อกเริ่มค้นหา
  --to-block <number>     บล็อกสิ้นสุด; ค่าเริ่มต้น latest
  --chunk <number>        ขนาดช่วงบล็อก; ค่าเริ่มต้น 500
  --json <path>           บันทึกผลเป็น JSON เพิ่มเติม
  --help                  แสดงคำสั่งนี้

ตัวอย่าง:
  node scripts/calc-historical-deposits.mjs --from-block 125264357
  node scripts/calc-historical-deposits.mjs --from-block 125264357 --to-block 125500000 --json accounting.json
`);
}

function normalizeAddress(value) {
  if (!isAddress(value)) throw new Error(`Proxy address ไม่ถูกต้อง: ${value}`);
  return getAddress(value);
}

async function queryWithRetry(contract, filter, fromBlock, toBlock) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await contract.queryFilter(filter, fromBlock, toBlock);
    } catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, attempt * 750));
    }
  }
  throw new Error(`RPC อ่านบล็อก ${fromBlock}-${toBlock} ไม่สำเร็จหลัง retry 3 ครั้ง: ${lastError?.shortMessage || lastError?.message}`);
}

async function main() {
  if (process.argv.includes("--help")) return help();
  const proxy = normalizeAddress(arg("--proxy", process.env.VITE_MAINNET_UPGRADEABLE_PROXY_ADDRESS || DEFAULT_PROXY));
  const rpc = arg("--rpc", process.env.BSC_RPC_URL || DEFAULT_RPC);
  const fromBlock = numberArg("--from-block", DEFAULT_FROM_BLOCK);
  const toBlock = numberArg("--to-block", await new JsonRpcProvider(rpc).getBlockNumber());
  const chunk = numberArg("--chunk", 500);
  if (chunk < 1 || chunk > 2_000) throw new Error("--chunk ต้องอยู่ระหว่าง 1 ถึง 2000");
  if (toBlock < fromBlock) throw new Error("to-block ต้องไม่น้อยกว่า from-block");

  const provider = new JsonRpcProvider(rpc);
  const network = await provider.getNetwork();
  const contract = new Contract(proxy, ABI, provider);
  const events = [];
  let initialized = null;
  let currentDepositAmount = null;
  let periods = [];

  for (let start = fromBlock; start <= toBlock; start += chunk) {
    const end = Math.min(toBlock, start + chunk - 1);
    const [configs, updates, registrations] = await Promise.all([
      queryWithRetry(contract, contract.filters.InitializedConfig(), start, end),
      queryWithRetry(contract, contract.filters.DepositAmountUpdated(), start, end),
      queryWithRetry(contract, contract.filters.Registered(), start, end),
    ]);
    for (const log of configs) events.push({ kind: "initialized", log });
    for (const log of updates) events.push({ kind: "updated", log });
    for (const log of registrations) events.push({ kind: "registered", log });
  }

  events.sort((a, b) => a.log.blockNumber - b.log.blockNumber || a.log.index - b.log.index);
  let totalUserDeposits = 0n;
  let registrationCount = 0;
  const mismatches = [];

  for (const event of events) {
    const args = event.log.args;
    if (event.kind === "initialized") {
      currentDepositAmount = BigInt(args.depositAmount);
      initialized = {
        blockNumber: event.log.blockNumber,
        txHash: event.log.transactionHash,
        depositAmount: currentDepositAmount.toString(),
      };
      continue;
    }
    if (event.kind === "updated") {
      const oldValue = BigInt(args.oldValue);
      const newValue = BigInt(args.newValue);
      periods.push({
        depositAmount: currentDepositAmount?.toString() ?? null,
        startBlock: periods.at(-1)?.startBlock ?? initialized?.blockNumber ?? null,
        endBlock: event.log.blockNumber - 1,
        registrations: 0,
        totalTokenAmount: "0",
      });
      currentDepositAmount = newValue;
      periods.push({
        depositAmount: currentDepositAmount.toString(),
        startBlock: event.log.blockNumber,
        endBlock: null,
        registrations: 0,
        totalTokenAmount: "0",
        changedFrom: oldValue.toString(),
        changeTxHash: event.log.transactionHash,
      });
      continue;
    }

    const tokenAmount = BigInt(args.tokenAmount);
    totalUserDeposits += tokenAmount;
    registrationCount += 1;
    if (currentDepositAmount !== null && tokenAmount !== currentDepositAmount) {
      mismatches.push({
        ticketId: args.ticketId.toString(),
        blockNumber: event.log.blockNumber,
        tokenAmount: tokenAmount.toString(),
        activeDepositAmount: currentDepositAmount.toString(),
        txHash: event.log.transactionHash,
      });
    }
    let period = periods.at(-1);
    if (!period || period.endBlock !== null) {
      period = {
        depositAmount: currentDepositAmount?.toString() ?? null,
        startBlock: event.log.blockNumber,
        endBlock: null,
        registrations: 0,
        totalTokenAmount: "0",
      };
      periods.push(period);
    }
    period.registrations += 1;
    period.totalTokenAmount = (BigInt(period.totalTokenAmount) + tokenAmount).toString();
  }

  const decimals = initialized ? 18 : 18;
  const result = {
    mode: "read-only-event-accounting",
    proxy,
    chainId: network.chainId.toString(),
    fromBlock,
    toBlock,
    initialized,
    registrationCount,
    historicalUserDeposits: totalUserDeposits.toString(),
    historicalUserDepositsFormatted: formatUnits(totalUserDeposits, decimals),
    decimals,
    periods,
    mismatches,
    bootstrapPayload: {
      function: "initializeAccounting(uint256)",
      argument: totalUserDeposits.toString(),
      humanAmount: `${formatUnits(totalUserDeposits, decimals)} token units`,
      warning: "ตรวจ Event range, depositAmount changes, totalClaimed และยอด asset บน Proxy ก่อนส่งธุรกรรม Owner",
    },
  };
  console.log(JSON.stringify(result, null, 2));
  const output = arg("--json");
  if (output) {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
    console.error(`บันทึกผลแล้ว: ${output}`);
  }
}

main().catch(error => {
  console.error(`คำนวณไม่สำเร็จ: ${error.shortMessage || error.message}`);
  process.exitCode = 1;
});
