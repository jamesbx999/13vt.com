#!/usr/bin/env node
import { Contract, JsonRpcProvider, getAddress, isAddress, formatUnits } from "ethers";

const DEFAULT_PROXY = "0x56ed01a6b08ac9ba88f9c88ee5c1455410b2cc06";
const DEFAULT_FROM_BLOCK = 125264357;
const DEFAULT_RPC = "https://bsc-dataseed.binance.org";
const EXPLORER = "https://bscscan.com";
const TARGET_TICKET_ID = 1n;

const ABI = [
  "event Claimed(uint256 indexed ticketId, address indexed recipient, uint256 amount)",
  "function asset() view returns (address)",
  "function tickets(uint256) view returns (address recipient, uint256 amount, bool claimed)",
];
const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

function arg(name, fallback = undefined) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function numberArg(name, fallback) {
  const value = arg(name);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${name} ต้องเป็นเลขจำนวนเต็มที่ไม่ติดลบ`);
  }
  return parsed;
}

function printUsage() {
  console.log(`ตรวจ Event Claimed ของ Ticket #1 แบบ Read-only

การใช้งาน:
  node scripts/check-claim-event.mjs [ตัวเลือก]

ตัวเลือก:
  --proxy <address>       Proxy address (ค่าเริ่มต้นคือ Mainnet Proxy 13VT)
  --rpc <url>             BSC RPC หรือกำหนด BSC_RPC_URL
  --from-block <number>   บล็อกเริ่มค้นหา (ค่าเริ่มต้น ${DEFAULT_FROM_BLOCK})
  --to-block <number>     บล็อกสิ้นสุด (ค่าเริ่มต้น latest)
  --tx <hash>             ตรวจเฉพาะ Transaction Hash เดียว
  --watch                 ติดตาม Event ใหม่ต่อเนื่อง
  --interval <seconds>    ระยะ polling ในโหมด --watch (ค่าเริ่มต้น 15)
  --help                  แสดงคำสั่งนี้

ตัวอย่าง:
  node scripts/check-claim-event.mjs --from-block 125264357
  node scripts/check-claim-event.mjs --tx 0x...
  node scripts/check-claim-event.mjs --watch --interval 15
`);
}

function normalizeProxy(value) {
  if (!isAddress(value)) throw new Error(`Proxy address ไม่ถูกต้อง: ${value}`);
  return getAddress(value);
}

function printTicket(ticket, symbol, decimals) {
  console.log("สถานะ Ticket #1 ปัจจุบัน:");
  console.log(`  recipient: ${ticket.recipient}`);
  console.log(`  amount:    ${formatUnits(ticket.amount, decimals)} ${symbol}`);
  console.log(`  claimed:   ${ticket.claimed}`);
}

function printClaim(log, symbol, decimals) {
  const ticketId = log.args.ticketId;
  const recipient = log.args.recipient;
  const amount = log.args.amount;
  console.log("\nพบ Event Claimed ของ Ticket #1:");
  console.log(`  tx:        ${EXPLORER}/tx/${log.transactionHash}`);
  console.log(`  block:     ${log.blockNumber}`);
  console.log(`  ticketId:  ${ticketId}`);
  console.log(`  recipient: ${recipient}`);
  console.log(`  amount:    ${formatUnits(amount, decimals)} ${symbol}`);
}

async function loadTokenMeta(proxyContract, provider) {
  const assetAddress = getAddress(await proxyContract.asset());
  const token = new Contract(assetAddress, ERC20_ABI, provider);
  const [symbol, decimals] = await Promise.all([token.symbol(), token.decimals()]);
  return { assetAddress, symbol, decimals: Number(decimals) };
}

async function findClaimEvents(contract, fromBlock, toBlock) {
  const events = [];
  const chunkSize = 500;
  for (let start = fromBlock; start <= toBlock; start += chunkSize) {
    const end = Math.min(toBlock, start + chunkSize - 1);
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const logs = await contract.queryFilter(
          contract.filters.Claimed(TARGET_TICKET_ID),
          start,
          end,
        );
        events.push(...logs);
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
        await new Promise(resolve => setTimeout(resolve, attempt * 750));
      }
    }
    if (lastError) {
      throw new Error(`RPC อ่านบล็อก ${start}-${end} ไม่สำเร็จหลัง retry 3 ครั้ง: ${lastError.shortMessage || lastError.message}`);
    }
  }
  return events;
}

async function inspectTransaction(contract, provider, txHash, symbol, decimals) {
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) {
    console.log("ยังไม่พบ Receipt ของธุรกรรมนี้ หรือธุรกรรมยัง Pending");
    return 2;
  }
  const matching = receipt.logs
    .filter(log => log.address.toLowerCase() === contract.target.toLowerCase())
    .map(log => {
      try {
        return contract.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .filter(parsed => parsed?.name === "Claimed" && parsed.args.ticketId === TARGET_TICKET_ID);

  console.log(`Receipt status: ${receipt.status === 1 ? "SUCCESS" : "REVERTED"}`);
  console.log(`Block: ${receipt.blockNumber}`);
  console.log(`Gas used: ${receipt.gasUsed}`);
  if (!matching.length) {
    console.log("ไม่พบ Event Claimed(Ticket #1) ใน Receipt นี้");
    return receipt.status === 1 ? 1 : 2;
  }
  for (const parsed of matching) {
    printClaim({ args: parsed.args, transactionHash: txHash, blockNumber: receipt.blockNumber }, symbol, decimals);
  }
  return receipt.status === 1 ? 0 : 2;
}

async function main() {
  if (hasFlag("--help")) {
    printUsage();
    return;
  }

  const proxyAddress = normalizeProxy(arg("--proxy", process.env.VITE_MAINNET_UPGRADEABLE_PROXY_ADDRESS || DEFAULT_PROXY));
  const rpcUrl = arg("--rpc", process.env.BSC_RPC_URL || DEFAULT_RPC);
  const provider = new JsonRpcProvider(rpcUrl);
  const contract = new Contract(proxyAddress, ABI, provider);
  const { assetAddress, symbol, decimals } = await loadTokenMeta(contract, provider);
  const network = await provider.getNetwork();
  if (network.chainId !== 56n) throw new Error(`RPC ไม่ใช่ BSC Mainnet: chainId=${network.chainId}`);

  console.log(`Proxy: ${proxyAddress}`);
  console.log(`Asset: ${assetAddress} (${symbol}, ${decimals} decimals)`);
  console.log(`Chain ID: ${network.chainId}`);

  const ticket = await contract.tickets(TARGET_TICKET_ID);
  printTicket(ticket, symbol, decimals);

  const txHash = arg("--tx");
  if (txHash) {
    process.exitCode = await inspectTransaction(contract, provider, txHash, symbol, decimals);
    return;
  }

  let fromBlock = numberArg("--from-block", DEFAULT_FROM_BLOCK);
  const explicitToBlock = arg("--to-block") !== undefined;
  let toBlock = numberArg("--to-block", await provider.getBlockNumber());
  if (toBlock < fromBlock) throw new Error("to-block ต้องไม่น้อยกว่า from-block");

  const scan = async (start, end) => {
    const events = await findClaimEvents(contract, start, end);
    if (!events.length) {
      console.log(`\nไม่พบ Claimed(Ticket #1) ในบล็อก ${start} ถึง ${end}`);
    } else {
      for (const event of events) printClaim(event, symbol, decimals);
    }
    return events;
  };

  await scan(fromBlock, toBlock);
  if (!hasFlag("--watch")) return;

  const intervalSeconds = numberArg("--interval", 15);
  if (intervalSeconds < 3) throw new Error("--interval ต้องไม่น้อยกว่า 3 วินาที");
  fromBlock = toBlock + 1;
  console.log(`\nกำลังติดตาม Event ใหม่ทุก ${intervalSeconds} วินาที (Ctrl+C เพื่อหยุด)`);
  while (true) {
    await new Promise(resolve => setTimeout(resolve, intervalSeconds * 1_000));
    const latest = await provider.getBlockNumber();
    if (latest < fromBlock) continue;
    await scan(fromBlock, latest);
    fromBlock = latest + 1;
  }
}

main().catch(error => {
  console.error(`ตรวจสอบไม่สำเร็จ: ${error.shortMessage || error.message}`);
  process.exitCode = 1;
});
