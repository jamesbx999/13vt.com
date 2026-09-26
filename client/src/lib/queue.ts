import Web3 from "web3";

export const BSC_CHAIN_ID = 56;
export const DEFAULT_CONTRACT_ADDRESS = "";

export const QUEUE_ABI = [
  { inputs: [], name: "owner", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "paused", outputs: [{ type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "account", type: "address" }], name: "admins", outputs: [{ type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "asset", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "nextTicketId", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "nextUnfundedTicketId", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "totalScheduled", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "totalClaimed", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "queueState", outputs: [
    { name: "registeredTickets", type: "uint256" },
    { name: "waitingForFunding", type: "uint256" },
    { name: "scheduledAmount", type: "uint256" },
    { name: "claimedAmount", type: "uint256" },
    { name: "contractBalance", type: "uint256" },
  ], stateMutability: "view", type: "function" },
  { inputs: [{ name: "", type: "uint256" }], name: "tickets", outputs: [
    { name: "recipient", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "claimed", type: "bool" },
  ], stateMutability: "view", type: "function" },
  { inputs: [{ name: "ticketId", type: "uint256" }], name: "claim", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [], name: "feeBps", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "feeForStake", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "feeRecipient", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "referralStakeAmount", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "account", type: "address" }], name: "referralStake", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "account", type: "address" }], name: "isReferralEligible", outputs: [{ type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "account", type: "address" }], name: "referrerOf", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "stakeReferral", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "referrer", type: "address" }], name: "registerWithReferral", outputs: [{ name: "ticketId", type: "uint256" }], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "code", type: "bytes32" }], name: "registerWithReferralCode", outputs: [{ name: "ticketId", type: "uint256" }], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "code", type: "bytes32" }], name: "referrerForCode", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "code", type: "bytes32" }, { name: "referrer", type: "address" }, { name: "enabled", type: "bool" }], name: "setReferralCode", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [], name: "pause", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [], name: "unpause", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "user", type: "address" }], name: "registerFor", outputs: [{ name: "ticketId", type: "uint256" }], stateMutability: "nonpayable", type: "function" },
  { anonymous: false, inputs: [
    { indexed: true, name: "ticketId", type: "uint256" },
    { indexed: true, name: "recipient", type: "address" },
    { indexed: false, name: "amount", type: "uint256" },
  ], name: "Claimed", type: "event" },
  { anonymous: false, inputs: [
    { indexed: true, name: "ticketId", type: "uint256" },
    { indexed: true, name: "recipient", type: "address" },
    { indexed: true, name: "registeredBy", type: "address" },
  ], name: "Registered", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, name: "account", type: "address" }], name: "PausedBy", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, name: "account", type: "address" }], name: "UnpausedBy", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, name: "code", type: "bytes32" }, { indexed: true, name: "referrer", type: "address" }, { indexed: false, name: "enabled", type: "bool" }], name: "ReferralCodeConfigured", type: "event" },
] as const;

export const ERC20_ABI = [
  { inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], name: "approve", outputs: [{ type: "bool" }], stateMutability: "nonpayable", type: "function" },
  { inputs: [], name: "decimals", outputs: [{ type: "uint8" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "symbol", outputs: [{ type: "string" }], stateMutability: "view", type: "function" },
] as const;

export type QueueTicket = {
  id: number;
  recipient: string;
  amount: string;
  claimed: boolean;
};

export type QueueSnapshot = {
  registered: number;
  waiting: number;
  scheduled: string;
  claimed: string;
  balance: string;
  asset: string;
  symbol: string;
  decimals: number;
  blockNumber: number;
  tickets: QueueTicket[];
};

export type ClaimTransaction = {
  hash: string;
  blockNumber: number;
  ticketId: string;
  recipient: string;
  amount: string;
};

export type ReferralStatus = {
  owner: string;
  paused: boolean;
  walletAdmin: boolean;
  feeBps: string;
  feeAmount: string;
  feeRecipient: string;
  requiredStake: string;
  walletStake: string;
  walletEligible: boolean;
  linkedReferrer: string;
  suggestedReferrer: string;
  suggestedStake: string;
  suggestedEligible: boolean;
};

export type AdminTransaction = {
  hash: string;
  blockNumber: number;
  action: "Registered" | "Paused" | "Unpaused";
  actor: string;
  subject: string;
  ticketId: string;
};

export type ReferralCodeEvent = {
  hash: string;
  blockNumber: number;
  code: string;
  referrer: string;
  enabled: boolean;
};

export type ReferralPathEvent = {
  hash: string;
  blockNumber: number;
  timestamp: number | null;
  ticketId: string;
  recipient: string;
  registeredBy: string;
};

function tupleValue(value: any, name: string, index: number) {
  return value?.[name] ?? value?.[index] ?? 0;
}

function isAddress(value: string) {
  return Web3.utils.isAddress(value);
}

export function shortAddress(address: string) {
  if (!address || address.length < 12) return address || "—";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function formatToken(value: string, decimals = 18, maxFractionDigits = 2) {
  try {
    const raw = String(value || "0").replace(/^0+(?=\d)/, "").padStart(decimals + 1, "0");
    const integerPart = raw.slice(0, -decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const fractionText = raw.slice(-decimals).slice(0, maxFractionDigits).replace(/0+$/, "");
    return fractionText ? `${integerPart}.${fractionText}` : integerPart;
  } catch {
    return "0";
  }
}

export async function readQueueSnapshot(provider: any, contractAddress: string): Promise<QueueSnapshot> {
  if (!provider) throw new Error("ไม่พบ MetaMask หรือ EIP-1193 provider");
  if (!isAddress(contractAddress)) throw new Error("Contract Address ไม่ถูกต้อง");

  const web3 = new Web3(provider);
  const contract = new web3.eth.Contract(QUEUE_ABI as any, contractAddress);
  const state: any = await contract.methods.queueState().call();
  const asset = String(await contract.methods.asset().call());
  const assetContract = new web3.eth.Contract(ERC20_ABI as any, asset);
  const [decimalsRaw, symbolRaw, blockNumber] = await Promise.all([
    assetContract.methods.decimals().call().catch(() => "18"),
    assetContract.methods.symbol().call().catch(() => "TOKEN"),
    web3.eth.getBlockNumber(),
  ]);

  const decimals = Number(decimalsRaw || 18);
  const registered = Number(tupleValue(state, "registeredTickets", 0));
  const first = Math.max(1, registered - 4);
  const ids = registered >= 1 ? Array.from({ length: registered - first + 1 }, (_, index) => first + index) : [];
  const tickets = await Promise.all(ids.map(async (id) => {
    const item: any = await contract.methods.tickets(id).call();
    return {
      id,
      recipient: String(tupleValue(item, "recipient", 0)),
      amount: String(tupleValue(item, "amount", 1)),
      claimed: Boolean(tupleValue(item, "claimed", 2)),
    };
  }));

  return {
    registered,
    waiting: Number(tupleValue(state, "waitingForFunding", 1)),
    scheduled: String(tupleValue(state, "scheduledAmount", 2)),
    claimed: String(tupleValue(state, "claimedAmount", 3)),
    balance: String(tupleValue(state, "contractBalance", 4)),
    asset,
    symbol: String(symbolRaw || "TOKEN"),
    decimals,
    blockNumber: Number(blockNumber),
    tickets,
  };
}

export async function readClaimHistory(provider: any, contractAddress: string): Promise<ClaimTransaction[]> {
  if (!provider) throw new Error("ไม่พบ MetaMask หรือ EIP-1193 provider");
  if (!isAddress(contractAddress)) throw new Error("Contract Address ไม่ถูกต้อง");

  const web3 = new Web3(provider);
  const contract: any = new web3.eth.Contract(QUEUE_ABI as any, contractAddress);
  const events: any[] = await contract.getPastEvents("Claimed", { fromBlock: 0, toBlock: "latest" });
  return events.slice(-50).reverse().map((event) => ({
    hash: String(event.transactionHash || ""),
    blockNumber: Number(event.blockNumber || 0),
    ticketId: String(tupleValue(event.returnValues, "ticketId", 0)),
    recipient: String(tupleValue(event.returnValues, "recipient", 1)),
    amount: String(tupleValue(event.returnValues, "amount", 2)),
  }));
}

export async function readAdminHistory(provider: any, contractAddress: string): Promise<AdminTransaction[]> {
  if (!provider) throw new Error("ไม่พบ MetaMask หรือ EIP-1193 provider");
  if (!isAddress(contractAddress)) throw new Error("Contract Address ไม่ถูกต้อง");
  const web3 = new Web3(provider);
  const contract: any = new web3.eth.Contract(QUEUE_ABI as any, contractAddress);
  const [registered, paused, unpaused] = await Promise.all([
    contract.getPastEvents("Registered", { fromBlock: 0, toBlock: "latest" }),
    contract.getPastEvents("PausedBy", { fromBlock: 0, toBlock: "latest" }),
    contract.getPastEvents("UnpausedBy", { fromBlock: 0, toBlock: "latest" }),
  ]);
  const adminRegistrations = registered.filter((event: any) => {
    const actor = String(tupleValue(event.returnValues, "registeredBy", 2));
    const recipient = String(tupleValue(event.returnValues, "recipient", 1));
    return actor.toLowerCase() !== recipient.toLowerCase();
  });
  const entries: AdminTransaction[] = [
    ...adminRegistrations.map((event: any) => ({ hash: String(event.transactionHash || ""), blockNumber: Number(event.blockNumber || 0), action: "Registered" as const, actor: String(tupleValue(event.returnValues, "registeredBy", 2)), subject: String(tupleValue(event.returnValues, "recipient", 1)), ticketId: String(tupleValue(event.returnValues, "ticketId", 0)) })),
    ...paused.map((event: any) => ({ hash: String(event.transactionHash || ""), blockNumber: Number(event.blockNumber || 0), action: "Paused" as const, actor: String(tupleValue(event.returnValues, "account", 0)), subject: "—", ticketId: "—" })),
    ...unpaused.map((event: any) => ({ hash: String(event.transactionHash || ""), blockNumber: Number(event.blockNumber || 0), action: "Unpaused" as const, actor: String(tupleValue(event.returnValues, "account", 0)), subject: "—", ticketId: "—" })),
  ];
  return entries.sort((a, b) => b.blockNumber - a.blockNumber).slice(0, 50);
}

export async function readReferralCodeHistory(provider: any, contractAddress: string): Promise<ReferralCodeEvent[]> {
  if (!provider) throw new Error("ไม่พบ MetaMask หรือ EIP-1193 provider");
  if (!isAddress(contractAddress)) throw new Error("Contract Address ไม่ถูกต้อง");
  const web3 = new Web3(provider);
  const contract: any = new web3.eth.Contract(QUEUE_ABI as any, contractAddress);
  const events: any[] = await contract.getPastEvents("ReferralCodeConfigured", { fromBlock: 0, toBlock: "latest" });
  return events.slice(-100).reverse().map(event => {
    const rawCode = String(tupleValue(event.returnValues, "code", 0));
    let decodedCode = rawCode;
    try { decodedCode = Web3.utils.hexToAscii(rawCode).replace(/\u0000/g, ""); } catch { /* keep raw bytes32 */ }
    return {
      hash: String(event.transactionHash || ""),
      blockNumber: Number(event.blockNumber || 0),
      code: decodedCode,
      referrer: String(tupleValue(event.returnValues, "referrer", 1)),
      enabled: Boolean(tupleValue(event.returnValues, "enabled", 2)),
    };
  });
}

export async function readReferralPathEvents(provider: any, contractAddress: string, wallet: string): Promise<ReferralPathEvent[]> {
  if (!provider) throw new Error("ไม่พบ MetaMask หรือ EIP-1193 provider");
  if (!isAddress(contractAddress) || !isAddress(wallet)) throw new Error("Contract หรือ wallet ไม่ถูกต้อง");
  const web3 = new Web3(provider);
  const contract: any = new web3.eth.Contract(QUEUE_ABI as any, contractAddress);
  const events: any[] = await contract.getPastEvents("Registered", { filter: { recipient: wallet }, fromBlock: 0, toBlock: "latest" });
  const selected = events.sort((a, b) => Number(a.blockNumber || 0) - Number(b.blockNumber || 0)).slice(-50);
  return Promise.all(selected.map(async event => {
    const block = await web3.eth.getBlock(Number(event.blockNumber || 0)).catch(() => null);
    return {
      hash: String(event.transactionHash || ""),
      blockNumber: Number(event.blockNumber || 0),
      timestamp: block?.timestamp ? Number(block.timestamp) * 1000 : null,
      ticketId: String(tupleValue(event.returnValues, "ticketId", 0)),
      recipient: String(tupleValue(event.returnValues, "recipient", 1)),
      registeredBy: String(tupleValue(event.returnValues, "registeredBy", 2)),
    };
  }));
}

export async function readReferralStatus(provider: any, contractAddress: string, account: string, suggestedReferrer: string): Promise<ReferralStatus> {
  if (!provider) throw new Error("ไม่พบ MetaMask หรือ EIP-1193 provider");
  if (!isAddress(contractAddress)) throw new Error("Contract Address ไม่ถูกต้อง");
  if (!isAddress(suggestedReferrer)) throw new Error("Suggested referral address ไม่ถูกต้อง");
  const web3 = new Web3(provider);
  const contract: any = new web3.eth.Contract(QUEUE_ABI as any, contractAddress);
  const wallet = isAddress(account) ? account : "0x0000000000000000000000000000000000000000";
  const [owner, paused, walletAdmin, feeBps, feeAmount, feeRecipient, requiredStake, walletStake, walletEligible, linkedReferrer, suggestedStake, suggestedEligible] = await Promise.all([
    contract.methods.owner().call(),
    contract.methods.paused().call(),
    contract.methods.admins(wallet).call(),
    contract.methods.feeBps().call(),
    contract.methods.feeForStake().call(),
    contract.methods.feeRecipient().call(),
    contract.methods.referralStakeAmount().call(),
    contract.methods.referralStake(wallet).call(),
    contract.methods.isReferralEligible(wallet).call(),
    contract.methods.referrerOf(wallet).call(),
    contract.methods.referralStake(suggestedReferrer).call(),
    contract.methods.isReferralEligible(suggestedReferrer).call(),
  ]);
  return {
    owner: String(owner),
    paused: Boolean(paused),
    walletAdmin: Boolean(walletAdmin),
    feeBps: String(feeBps),
    feeAmount: String(feeAmount),
    feeRecipient: String(feeRecipient),
    requiredStake: String(requiredStake),
    walletStake: String(walletStake),
    walletEligible: Boolean(walletEligible),
    linkedReferrer: String(linkedReferrer),
    suggestedReferrer,
    suggestedStake: String(suggestedStake),
    suggestedEligible: Boolean(suggestedEligible),
  };
}

export function submitReferralStake(provider: any, assetAddress: string, contractAddress: string, account: string, totalDue: string) {
  if (!provider) throw new Error("ไม่พบ MetaMask หรือ EIP-1193 provider");
  if (!isAddress(assetAddress) || !isAddress(contractAddress) || !isAddress(account)) throw new Error("ข้อมูล Address สำหรับ Stake ไม่ถูกต้อง");
  const web3 = new Web3(provider);
  const token: any = new web3.eth.Contract(ERC20_ABI as any, assetAddress);
  const contract: any = new web3.eth.Contract(QUEUE_ABI as any, contractAddress);
  return token.methods.approve(contractAddress, totalDue).send({ from: account }).then(() => contract.methods.stakeReferral().send({ from: account }));
}

export function buildSignInMessage(domain: string, address: string, nonce: string, issuedAt: string, expirationTime: string) {
  return `${domain} wants you to sign in with your Ethereum account:\n${address}\n\nSign in to Onchain Queue Dashboard.\n\nURI: https://${domain}/\nVersion: 1\nChain ID: 56\nNonce: ${nonce}\nIssued At: ${issuedAt}\nExpiration Time: ${expirationTime}`;
}

export function verifyWalletSignature(message: string, signature: string, expectedAddress: string) {
  if (!isAddress(expectedAddress) || !signature) return false;
  const recovered = new Web3().eth.accounts.recover(message, signature);
  return recovered.toLowerCase() === expectedAddress.toLowerCase();
}

export function referralCodeToBytes32(code: string) {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{1,32}$/.test(normalized)) throw new Error("Referral code ต้องเป็น A-Z หรือ 0-9 ความยาวไม่เกิน 32 ตัว");
  return Web3.utils.asciiToHex(normalized).padEnd(66, "0");
}

export function submitReferralRegistration(provider: any, contractAddress: string, account: string, referrer: string, code = "") {
  if (!provider) throw new Error("ไม่พบ MetaMask หรือ EIP-1193 provider");
  if (!isAddress(contractAddress) || !isAddress(account)) throw new Error("ข้อมูล Address สำหรับ Referral registration ไม่ถูกต้อง");
  const web3 = new Web3(provider);
  const contract: any = new web3.eth.Contract(QUEUE_ABI as any, contractAddress);
  if (code) return contract.methods.registerWithReferralCode(referralCodeToBytes32(code)).send({ from: account });
  if (!isAddress(referrer)) throw new Error("Referrer Address ไม่ถูกต้อง");
  return contract.methods.registerWithReferral(referrer).send({ from: account });
}

export function submitSetReferralCode(provider: any, contractAddress: string, account: string, code: string, referrerAddress: string, enabled = true) {
  if (!provider || !isAddress(contractAddress) || !isAddress(account) || !isAddress(referrerAddress)) throw new Error("ข้อมูล Referral Code หรือ Wallet ไม่ถูกต้อง");
  const web3 = new Web3(provider);
  const contract: any = new web3.eth.Contract(QUEUE_ABI as any, contractAddress);
  return contract.methods.setReferralCode(referralCodeToBytes32(code), referrerAddress, enabled).send({ from: account });
}

export async function readReferralCodeMapping(provider: any, contractAddress: string, code: string) {
  if (!provider || !isAddress(contractAddress)) throw new Error("Contract Address ไม่ถูกต้อง");
  const web3 = new Web3(provider);
  const contract: any = new web3.eth.Contract(QUEUE_ABI as any, contractAddress);
  return String(await contract.methods.referrerForCode(referralCodeToBytes32(code)).call());
}

export function submitAdminAction(provider: any, contractAddress: string, account: string, action: "pause" | "unpause" | "registerFor", user = "", gasLimit = "") {
  if (!provider) throw new Error("ไม่พบ MetaMask หรือ EIP-1193 provider");
  if (!isAddress(contractAddress) || !isAddress(account)) throw new Error("ข้อมูล Address สำหรับ Admin ไม่ถูกต้อง");
  if (action === "registerFor" && !isAddress(user)) throw new Error("Wallet ผู้ใช้สำหรับลงทะเบียนไม่ถูกต้อง");
  const web3 = new Web3(provider);
  const contract: any = new web3.eth.Contract(QUEUE_ABI as any, contractAddress);
  const sendOptions: any = { from: account };
  if (gasLimit) sendOptions.gas = gasLimit;
  if (action === "pause") return contract.methods.pause().send(sendOptions);
  if (action === "unpause") return contract.methods.unpause().send(sendOptions);
  return contract.methods.registerFor(user).send(sendOptions);
}

export type AdminGasEstimate = ClaimGasEstimate & { bufferedGasUnits: string; bufferedCostBnb: string; bufferPercent: number };

export async function estimateAdminGas(provider: any, contractAddress: string, account: string, action: "pause" | "unpause" | "registerFor", user = ""): Promise<AdminGasEstimate> {
  if (!provider) throw new Error("ไม่พบ MetaMask หรือ EIP-1193 provider");
  if (!isAddress(contractAddress) || !isAddress(account)) throw new Error("ข้อมูล Address สำหรับ Admin ไม่ถูกต้อง");
  if (action === "registerFor" && !isAddress(user)) throw new Error("Wallet ผู้ใช้สำหรับลงทะเบียนไม่ถูกต้อง");
  const web3 = new Web3(provider);
  const contract: any = new web3.eth.Contract(QUEUE_ABI as any, contractAddress);
  const method = action === "pause" ? contract.methods.pause() : action === "unpause" ? contract.methods.unpause() : contract.methods.registerFor(user);
  const [gas, gasPrice] = await Promise.all([
    method.estimateGas({ from: account }),
    web3.eth.getGasPrice(),
  ]);
  const gasUnits = String(gas);
  const gasPriceWei = String(gasPrice);
  const bufferedGasUnits = ((BigInt(gasUnits) * BigInt("110")) + BigInt("99")) / BigInt("100");
  const estimatedCostWei = (bufferedGasUnits * BigInt(gasPriceWei)).toString();
  return {
    gasUnits,
    gasPriceWei,
    gasPriceGwei: Web3.utils.fromWei(gasPriceWei, "gwei"),
    estimatedCostWei,
    estimatedCostBnb: Web3.utils.fromWei(estimatedCostWei, "ether"),
    bufferedGasUnits: bufferedGasUnits.toString(),
    bufferedCostBnb: Web3.utils.fromWei(estimatedCostWei, "ether"),
    bufferPercent: 10,
  };
}

export function submitClaim(provider: any, contractAddress: string, ticketId: number, account: string) {
  if (!provider) throw new Error("ไม่พบ MetaMask หรือ EIP-1193 provider");
  if (!Web3.utils.isAddress(contractAddress)) throw new Error("Contract Address ไม่ถูกต้อง");
  if (!Web3.utils.isAddress(account)) throw new Error("ไม่พบกระเป๋าผู้รับ");

  const web3 = new Web3(provider);
  const contract = new web3.eth.Contract(QUEUE_ABI as any, contractAddress);
  return contract.methods.claim(ticketId).send({ from: account });
}

export type ClaimGasEstimate = {
  gasUnits: string;
  gasPriceWei: string;
  gasPriceGwei: string;
  estimatedCostWei: string;
  estimatedCostBnb: string;
};

export async function estimateClaimGas(provider: any, contractAddress: string, ticketId: number, account: string): Promise<ClaimGasEstimate> {
  if (!provider) throw new Error("ไม่พบ MetaMask หรือ EIP-1193 provider");
  if (!Web3.utils.isAddress(contractAddress)) throw new Error("Contract Address ไม่ถูกต้อง");
  if (!Web3.utils.isAddress(account)) throw new Error("ไม่พบกระเป๋าผู้รับ");

  const web3 = new Web3(provider);
  const contract = new web3.eth.Contract(QUEUE_ABI as any, contractAddress);
  const [gas, gasPrice] = await Promise.all([
    contract.methods.claim(ticketId).estimateGas({ from: account }),
    web3.eth.getGasPrice(),
  ]);
  const gasUnits = String(gas);
  const gasPriceWei = String(gasPrice);
  const estimatedCostWei = (BigInt(gasUnits) * BigInt(gasPriceWei)).toString();
  return {
    gasUnits,
    gasPriceWei,
    gasPriceGwei: Web3.utils.fromWei(gasPriceWei, "gwei"),
    estimatedCostWei,
    estimatedCostBnb: Web3.utils.fromWei(estimatedCostWei, "ether"),
  };
}
