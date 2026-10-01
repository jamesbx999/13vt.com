import { describe, expect, it } from "vitest";
import {
  errorOutcome,
  isBscMainnet,
  isTransactionHash,
  isWalletRejection,
  receiptOutcome,
} from "../client/src/lib/transactionJournal";

describe("transaction journal classification", () => {
  it("requires an actual receipt status for confirmation", () => {
    expect(receiptOutcome(null)).toBeNull();
    expect(
      receiptOutcome({ transactionHash: `0x${"1".repeat(64)}` })
    ).toBeNull();
    expect(receiptOutcome({ status: true })).toBe("confirmed");
    expect(receiptOutcome({ status: "0x01" })).toBe("confirmed");
    expect(receiptOutcome({ status: false })).toBe("reverted");
    expect(receiptOutcome({ status: "0x0" })).toBe("reverted");
    expect(receiptOutcome({ status: "unknown" })).toBeNull();
  });
  it("does not infer a revert or safe retry from a provider error after broadcast", () => {
    expect(errorOutcome(true, { code: 4001 })).toBe("unknown");
    expect(errorOutcome(true, new Error("RPC timeout"))).toBe("unknown");
    expect(errorOutcome(false, { code: 4001 })).toBe("rejected");
    expect(errorOutcome(false, new Error("RPC unavailable"))).toBe("failed");
  });
  it("accepts only valid hashes and recognized wallet rejection codes", () => {
    expect(isTransactionHash(`0x${"a".repeat(64)}`)).toBe(true);
    expect(isTransactionHash("0x1234")).toBe(false);
    expect(isWalletRejection({ code: "ACTION_REJECTED" })).toBe(true);
    expect(isWalletRejection({ code: -32000 })).toBe(false);
  });
  it("accepts only BSC Mainnet hex chain ID before wallet writes and receipt polling", () => {
    expect(isBscMainnet("0x38")).toBe(true);
    expect(isBscMainnet("0X38")).toBe(false);
    expect(isBscMainnet("0x61")).toBe(false);
    expect(isBscMainnet("56")).toBe(false);
    expect(isBscMainnet("0x38abc")).toBe(false);
  });
});
