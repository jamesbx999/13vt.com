import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const siweNonces = mysqlTable("siwe_nonces", {
  id: int("id").autoincrement().primaryKey(),
  nonce: varchar("nonce", { length: 128 }).notNull().unique(),
  walletAddress: varchar("walletAddress", { length: 42 }).notNull(),
  domain: varchar("domain", { length: 255 }).notNull(),
  uri: varchar("uri", { length: 512 }).notNull(),
  chainId: int("chainId").notNull(),
  issuedAt: timestamp("issuedAt").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  consumedAt: timestamp("consumedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const referralCodeMappings = mysqlTable("referral_code_mappings", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  codeHash: varchar("codeHash", { length: 66 }).notNull(),
  referrerAddress: varchar("referrerAddress", { length: 42 }).notNull(),
  status: mysqlEnum("status", ["pending", "active", "disabled", "failed"]).default("pending").notNull(),
  txHash: varchar("txHash", { length: 66 }),
  configuredBy: varchar("configuredBy", { length: 42 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type SiweNonce = typeof siweNonces.$inferSelect;
export type ReferralCodeMapping = typeof referralCodeMappings.$inferSelect;

// TODO: Add your tables here
