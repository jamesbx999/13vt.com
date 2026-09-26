import { z } from "zod";
import Web3 from "web3";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { ownerWalletProcedure, publicProcedure, router } from "./_core/trpc";
import { createReferralCodeMapping, createSiweNonce, consumeSiweNonce, listReferralCodeMappings, updateReferralCodeMapping } from "./db";
import { buildSiweMessage, clearSiweSession, issueSiweSession, makeNonce, normalizeWalletAddress, parseSiweMessage, SIWE_CHAIN_ID, SIWE_TTL_MS } from "./siwe";

const walletSchema = z.string().refine(value => Web3.utils.isAddress(value), "Invalid wallet address");
const codeSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,32}$/, "Referral code must be A-Z/0-9 and 1-32 characters");

function codeToBytes32(code: string) {
  return Web3.utils.asciiToHex(code).padEnd(66, "0");
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      clearSiweSession(ctx.res);
      return { success: true } as const;
    }),
  }),

  siwe: router({
    session: publicProcedure.query(({ ctx }) => ({ address: ctx.walletAddress })),
    requestNonce: publicProcedure.input(z.object({
      address: walletSchema,
      domain: z.string().trim().min(1).max(255),
      uri: z.string().url().startsWith("https://"),
      chainId: z.number().int().refine(value => value === SIWE_CHAIN_ID, "Only BNB Smart Chain is supported"),
    })).mutation(async ({ ctx, input }) => {
      const requestDomain = String(ctx.req.get("host") || input.domain);
      if (requestDomain !== input.domain) throw new Error("SIWE domain does not match this host");
      const issuedAt = new Date();
      const expiresAt = new Date(issuedAt.getTime() + SIWE_TTL_MS);
      const nonce = makeNonce();
      const address = normalizeWalletAddress(input.address);
      await createSiweNonce({ nonce, walletAddress: address, domain: input.domain, uri: input.uri, chainId: input.chainId, issuedAt, expiresAt });
      return { nonce, address, message: buildSiweMessage({ domain: input.domain, address: input.address, uri: input.uri, nonce, issuedAt, expiresAt }), expiresAt: expiresAt.toISOString() };
    }),
    verify: publicProcedure.input(z.object({ address: walletSchema, message: z.string().min(80).max(2000), signature: z.string().min(10).max(2000) })).mutation(async ({ ctx, input }) => {
      const parsed = parseSiweMessage(input.message);
      const expectedAddress = normalizeWalletAddress(input.address);
      if (parsed.address !== expectedAddress) throw new Error("Wallet address does not match SIWE message");
      if (parsed.chainId !== SIWE_CHAIN_ID) throw new Error("Unsupported chain ID");
      if (parsed.expirationTime.getTime() <= Date.now() || parsed.issuedAt.getTime() > Date.now() + 60_000) throw new Error("SIWE message is expired or issued in the future");
      if (parsed.domain !== String(ctx.req.get("host") || parsed.domain)) throw new Error("SIWE domain does not match this host");
      const recovered = normalizeWalletAddress(new Web3().eth.accounts.recover(input.message, input.signature));
      if (recovered !== expectedAddress) throw new Error("Signature verification failed");
      const nonce = await consumeSiweNonce(parsed.nonce, expectedAddress);
      if (!nonce) throw new Error("Nonce is invalid, expired, or already used");
      await issueSiweSession(ctx.res, expectedAddress);
      return { success: true, address: expectedAddress, expiresAt: nonce.expiresAt.toISOString() } as const;
    }),
  }),

  referralCodes: router({
    list: ownerWalletProcedure.query(async () => listReferralCodeMappings()),
    create: ownerWalletProcedure.input(z.object({ code: codeSchema, referrerAddress: walletSchema })).mutation(async ({ ctx, input }) => {
      const code = input.code.toUpperCase();
      const configuredBy = ctx.walletAddress || "";
      return createReferralCodeMapping({ code, codeHash: codeToBytes32(code), referrerAddress: normalizeWalletAddress(input.referrerAddress), status: "pending", configuredBy });
    }),
    markResult: ownerWalletProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["active", "disabled", "failed"]), txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional() })).mutation(async ({ input }) => updateReferralCodeMapping(input.id, { status: input.status, txHash: input.txHash ?? null })),
  }),
});

export type AppRouter = typeof appRouter;
