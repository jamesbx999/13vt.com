import { and, desc, eq, isNull, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, referralCodeMappings, siweNonces, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createSiweNonce(input: typeof siweNonces.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(siweNonces).where(lt(siweNonces.expiresAt, new Date()));
  await db.insert(siweNonces).values(input);
  const rows = await db.select().from(siweNonces).where(eq(siweNonces.nonce, input.nonce)).limit(1);
  return rows[0];
}

export async function consumeSiweNonce(nonce: string, walletAddress: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const rows = await db.select().from(siweNonces).where(and(eq(siweNonces.nonce, nonce), eq(siweNonces.walletAddress, walletAddress), isNull(siweNonces.consumedAt))).limit(1);
  const row = rows[0];
  if (!row || row.expiresAt.getTime() <= Date.now()) return null;
  await db.update(siweNonces).set({ consumedAt: new Date() }).where(and(eq(siweNonces.id, row.id), isNull(siweNonces.consumedAt)));
  return row;
}

export async function listReferralCodeMappings() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(referralCodeMappings).orderBy(desc(referralCodeMappings.updatedAt));
}

export async function createReferralCodeMapping(input: typeof referralCodeMappings.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(referralCodeMappings).values(input);
  const rows = await db.select().from(referralCodeMappings).where(eq(referralCodeMappings.code, input.code)).limit(1);
  return rows[0];
}

export async function updateReferralCodeMapping(id: number, input: Partial<typeof referralCodeMappings.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(referralCodeMappings).set(input).where(eq(referralCodeMappings.id, id));
  const rows = await db.select().from(referralCodeMappings).where(eq(referralCodeMappings.id, id)).limit(1);
  return rows[0];
}

// TODO: add feature queries here as your schema grows.
