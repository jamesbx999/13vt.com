export type JournalStatus =
  | "awaiting_wallet"
  | "pending"
  | "confirmed"
  | "reverted"
  | "rejected"
  | "failed"
  | "unknown";

export type JournalEntry = {
  id: string;
  label: string;
  status: JournalStatus;
  hash: string;
  createdAt: number;
  detail: string;
};

export const JOURNAL_STORAGE_KEY = "13vt-transaction-journal-v1";
export const isTransactionHash = (hash: unknown): hash is string =>
  typeof hash === "string" && /^0x[a-fA-F0-9]{64}$/.test(hash);

export const isBscMainnet = (chainId: unknown): boolean =>
  typeof chainId === "string" &&
  /^0x[0-9a-fA-F]+$/.test(chainId) &&
  BigInt(chainId) === BigInt(56);

/** A receipt (not merely a tx hash or backend response) is proof of mining. */
export function receiptOutcome(
  receipt: unknown
): "confirmed" | "reverted" | null {
  if (!receipt || typeof receipt !== "object" || !("status" in receipt))
    return null;
  const status = (receipt as { status: unknown }).status;
  if (status === true) return "confirmed";
  if (status === false) return "reverted";
  if (typeof status === "number" || typeof status === "bigint") {
    return status === 1 || status === BigInt(1)
      ? "confirmed"
      : status === 0 || status === BigInt(0)
        ? "reverted"
        : null;
  }
  if (typeof status === "string" && /^(0x[0-9a-f]+|[01])$/i.test(status)) {
    const value = BigInt(status);
    return value === BigInt(1)
      ? "confirmed"
      : value === BigInt(0)
        ? "reverted"
        : null;
  }
  return null;
}

export function isWalletRejection(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    code?: unknown;
    cause?: { code?: unknown };
    message?: unknown;
  };
  return (
    candidate.code === 4001 ||
    candidate.code === "ACTION_REJECTED" ||
    candidate.cause?.code === 4001 ||
    (typeof candidate.message === "string" &&
      /user rejected|user denied|user cancelled/i.test(candidate.message))
  );
}

/** Never infer a revert solely from an RPC error after a hash was issued. */
export function errorOutcome(hasHash: boolean, error: unknown): JournalStatus {
  if (hasHash) return "unknown";
  return isWalletRejection(error) ? "rejected" : "failed";
}
