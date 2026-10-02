import Web3 from "web3";
import { TESTNET_TOKEN } from "../shared/testnetToken";

export type TransferEvidence = {
  from: string;
  to: string;
  rawAmount: string;
  amount: string;
  logIndex: number;
};

export type TestnetTransferInspection = {
  status:
    | "not_found"
    | "pending"
    | "reverted"
    | "confirmed_no_transfer"
    | "confirmed_transfer";
  hash: string;
  blockNumber: number | null;
  transfers: TransferEvidence[];
};

const TRANSFER_TOPIC = Web3.utils
  .keccak256("Transfer(address,address,uint256)")
  .toLowerCase();
const HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const response = await fetch(TESTNET_TOKEN.rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Testnet RPC HTTP ${response.status}`);
  const payload = (await response.json()) as {
    result?: T;
    error?: { message?: string };
  };
  if (payload.error || payload.result === undefined)
    throw new Error(
      payload.error?.message || "Testnet RPC response missing result"
    );
  return payload.result;
}

async function requireCorrectChain() {
  const chainId = await rpc<string>("eth_chainId", []);
  if (chainId !== "0x61")
    throw new Error("RPC does not belong to BSC Testnet (97)");
}

/** Decode *only* actual Transfer logs emitted by the fixed, checked test token. */
export function parseTestnetTransfers(logs: unknown): TransferEvidence[] {
  if (!Array.isArray(logs)) return [];
  return logs.flatMap((value: unknown, index): TransferEvidence[] => {
    if (!value || typeof value !== "object") return [];
    const log = value as {
      address?: unknown;
      topics?: unknown;
      data?: unknown;
      logIndex?: unknown;
    };
    if (
      typeof log.address !== "string" ||
      log.address.toLowerCase() !== TESTNET_TOKEN.address.toLowerCase()
    )
      return [];
    if (
      !Array.isArray(log.topics) ||
      log.topics.length !== 3 ||
      typeof log.topics[0] !== "string" ||
      log.topics[0].toLowerCase() !== TRANSFER_TOPIC ||
      !log.topics
        .slice(1)
        .every(
          (topic: unknown) =>
            typeof topic === "string" && /^0x[0-9a-fA-F]{64}$/.test(topic)
        )
    )
      return [];
    if (typeof log.data !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(log.data))
      return [];
    const rawAmount = BigInt(log.data).toString();
    const amount = Web3.utils.fromWei(rawAmount, "ether"); // Checked test token uses 18 decimals.
    const from = `0x${log.topics[1].slice(-40)}`;
    const to = `0x${log.topics[2].slice(-40)}`;
    return [
      {
        from,
        to,
        rawAmount,
        amount,
        logIndex:
          typeof log.logIndex === "string"
            ? Number.parseInt(log.logIndex, 16)
            : index,
      },
    ];
  });
}

export async function getTestnetTokenInfo() {
  await requireCorrectChain();
  const [code, symbolData, decimalsData] = await Promise.all([
    rpc<string>("eth_getCode", [TESTNET_TOKEN.address, "latest"]),
    rpc<string>("eth_call", [
      { to: TESTNET_TOKEN.address, data: "0x95d89b41" },
      "latest",
    ]),
    rpc<string>("eth_call", [
      { to: TESTNET_TOKEN.address, data: "0x313ce567" },
      "latest",
    ]),
  ]);
  if (code === "0x" || !code.startsWith("0x"))
    throw new Error("Token contract has no code on BSC Testnet");
  const symbol = new Web3().eth.abi.decodeParameter(
    "string",
    symbolData
  ) as string;
  const decimals = Number(BigInt(decimalsData));
  if (symbol !== TESTNET_TOKEN.symbol || decimals !== TESTNET_TOKEN.decimals)
    throw new Error(
      "Testnet token metadata changed; transfer simulation disabled"
    );
  return {
    ...TESTNET_TOKEN,
    hasCode: true,
    verifiedAt: new Date().toISOString(),
  };
}

export async function inspectTestnetTransfer(
  hash: string
): Promise<TestnetTransferInspection> {
  if (!HASH_PATTERN.test(hash)) throw new Error("Invalid transaction hash");
  await requireCorrectChain();
  const receipt = await rpc<null | {
    status: unknown;
    blockNumber: unknown;
    transactionHash: unknown;
    logs: unknown;
  }>("eth_getTransactionReceipt", [hash]);
  if (!receipt) {
    const transaction = await rpc<null | object>("eth_getTransactionByHash", [
      hash,
    ]);
    return {
      status: transaction ? "pending" : "not_found",
      hash,
      blockNumber: null,
      transfers: [],
    };
  }
  if (
    typeof receipt.transactionHash !== "string" ||
    receipt.transactionHash.toLowerCase() !== hash.toLowerCase()
  )
    throw new Error("RPC receipt hash mismatch");
  const blockNumber =
    typeof receipt.blockNumber === "string"
      ? Number.parseInt(receipt.blockNumber, 16)
      : null;
  if (!Number.isSafeInteger(blockNumber))
    throw new Error("Invalid receipt block number");
  if (receipt.status === "0x0")
    return { status: "reverted", hash, blockNumber, transfers: [] };
  if (receipt.status !== "0x1")
    throw new Error("Receipt has no verifiable status");
  const transfers = parseTestnetTransfers(receipt.logs);
  return {
    status: transfers.length ? "confirmed_transfer" : "confirmed_no_transfer",
    hash,
    blockNumber,
    transfers,
  };
}
