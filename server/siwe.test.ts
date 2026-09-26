import { describe, expect, it } from "vitest";
import Web3 from "web3";
import { buildSiweMessage, parseSiweMessage, SIWE_CHAIN_ID } from "./siwe";

describe("SIWE message validation primitives", () => {
  it("round-trips the domain, wallet, chain, nonce and expiry fields", () => {
    const account = new Web3().eth.accounts.create();
    const issuedAt = new Date("2026-09-23T10:00:00.000Z");
    const expiresAt = new Date("2026-09-23T10:30:00.000Z");
    const message = buildSiweMessage({ domain: "example.test", address: account.address, uri: "https://example.test/", nonce: "one-time-123", issuedAt, expiresAt });
    const parsed = parseSiweMessage(message);
    expect(parsed.address).toBe(account.address.toLowerCase());
    expect(parsed.chainId).toBe(SIWE_CHAIN_ID);
    expect(parsed.nonce).toBe("one-time-123");
    expect(parsed.expirationTime.toISOString()).toBe(expiresAt.toISOString());
  });

  it("recovers the signing wallet from the exact SIWE message", () => {
    const account = new Web3().eth.accounts.create();
    const issuedAt = new Date("2026-09-23T10:00:00.000Z");
    const expiresAt = new Date("2026-09-23T10:30:00.000Z");
    const message = buildSiweMessage({ domain: "example.test", address: account.address, uri: "https://example.test/", nonce: "one-time-456", issuedAt, expiresAt });
    const signed = account.sign(message);
    expect(new Web3().eth.accounts.recover(message, signed.signature).toLowerCase()).toBe(account.address.toLowerCase());
  });
});
