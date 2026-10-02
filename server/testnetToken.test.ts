import { describe, expect, it } from "vitest";
import Web3 from "web3";
import { parseTestnetTransfers } from "./testnetToken";
import { TESTNET_TOKEN } from "../shared/testnetToken";

const topic = Web3.utils.keccak256("Transfer(address,address,uint256)");
const padded = (address: string) => `0x${address.slice(2).padStart(64, "0")}`;
const from = "0x1111111111111111111111111111111111111111";
const to = "0x2222222222222222222222222222222222222222";
const event = (address = TESTNET_TOKEN.address) => ({
  address,
  topics: [topic, padded(from), padded(to)],
  data: `0x${(13n * 10n ** 18n).toString(16).padStart(64, "0")}`,
  logIndex: "0x0",
});

describe("BSC Testnet transfer evidence", () => {
  it("reads amount, recipient and source only from the fixed test token's Transfer log", () => {
    expect(parseTestnetTransfers([event()])).toEqual([
      {
        from,
        to,
        rawAmount: (13n * 10n ** 18n).toString(),
        amount: "13",
        logIndex: 0,
      },
    ]);
  });
  it("ignores logs from other tokens or with malformed topics and never infers a referral payout", () => {
    expect(
      parseTestnetTransfers([
        event("0x3333333333333333333333333333333333333333"),
      ])
    ).toEqual([]);
    expect(
      parseTestnetTransfers([{ ...event(), topics: [topic, padded(from)] }])
    ).toEqual([]);
    expect(parseTestnetTransfers([{ ...event(), data: "0x01" }])).toEqual([]);
    expect(parseTestnetTransfers(null)).toEqual([]);
  });
});
