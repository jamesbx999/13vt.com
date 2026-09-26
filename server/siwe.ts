import { randomUUID } from "node:crypto";
import { parse as parseCookie } from "cookie";
import { SignJWT, jwtVerify } from "jose";
import Web3 from "web3";
import { ENV } from "./_core/env";

export const SIWE_COOKIE_NAME = "onchain_siwe_session";
export const SIWE_CHAIN_ID = 56;
export const SIWE_TTL_MS = 30 * 60 * 1000;

function secretKey() {
  if (!ENV.cookieSecret) throw new Error("JWT_SECRET is required for SIWE sessions");
  return new TextEncoder().encode(ENV.cookieSecret);
}

export function normalizeWalletAddress(address: string) {
  if (!Web3.utils.isAddress(address)) throw new Error("Invalid wallet address");
  return address.toLowerCase();
}

export function buildSiweMessage(input: { domain: string; address: string; uri: string; nonce: string; issuedAt: Date; expiresAt: Date }) {
  return `${input.domain} wants you to sign in with your Ethereum account:\n${input.address}\n\nSign in to Onchain Queue Dashboard.\n\nURI: ${input.uri}\nVersion: 1\nChain ID: ${SIWE_CHAIN_ID}\nNonce: ${input.nonce}\nIssued At: ${input.issuedAt.toISOString()}\nExpiration Time: ${input.expiresAt.toISOString()}`;
}

export function parseSiweMessage(message: string) {
  const lines = message.split("\n");
  const address = lines[1]?.trim();
  const domain = lines[0]?.replace(/ wants you to sign in with your Ethereum account:$/, "");
  const uri = lines.find(line => line.startsWith("URI: "))?.slice(5).trim();
  const chainId = Number(lines.find(line => line.startsWith("Chain ID: "))?.slice(10).trim());
  const nonce = lines.find(line => line.startsWith("Nonce: "))?.slice(7).trim();
  const issuedAt = lines.find(line => line.startsWith("Issued At: "))?.slice(11).trim();
  const expirationTime = lines.find(line => line.startsWith("Expiration Time: "))?.slice(17).trim();
  if (!domain || !address || !uri || !Number.isInteger(chainId) || !nonce || !issuedAt || !expirationTime) throw new Error("Malformed SIWE message");
  return { domain, address: normalizeWalletAddress(address), uri, chainId, nonce, issuedAt: new Date(issuedAt), expirationTime: new Date(expirationTime) };
}

export async function issueSiweSession(res: any, walletAddress: string) {
  const token = await new SignJWT({ walletAddress: normalizeWalletAddress(walletAddress), scope: "siwe" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30m")
    .sign(secretKey());
  res.cookie(SIWE_COOKIE_NAME, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: SIWE_TTL_MS / 1000 });
}

export async function readSiweSession(req: any) {
  try {
    const token = parseCookie(req.headers.cookie || "")[SIWE_COOKIE_NAME];
    if (!token) return null;
    const result = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    const walletAddress = String(result.payload.walletAddress || "");
    return walletAddress && Web3.utils.isAddress(walletAddress) ? walletAddress.toLowerCase() : null;
  } catch {
    return null;
  }
}

export function clearSiweSession(res: any) {
  res.clearCookie(SIWE_COOKIE_NAME, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
}

export function makeNonce() {
  return randomUUID().replace(/-/g, "");
}
