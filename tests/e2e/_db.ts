/**
 * E2E 测试用的 Drizzle test helpers
 *
 * v0.6.2 起：Prisma → Drizzle ORM，e2e 测试直接用 Drizzle API。
 * 提供带 SQLITE_BUSY 重试的便捷 helper，集中处理：
 * - UUID / createdAt / updatedAt 自动注入
 * - SQLite 并发锁重试
 * - Prisma → Drizzle 语义差异兼容（.returning().get() → 单行）
 *
 * 使用方式（对比）：
 *   // 旧 Prisma 写法
 *   const user = await prisma.user.create({ data: { username: 'x', password: 'y' } });
 *   const post = await prisma.post.findUnique({ where: { id } });
 *   await prisma.post.update({ where: { id }, data: { status: 'published' } });
 *
 *   // 新 Drizzle 写法（导入相同，API 更原生）
 *   const user = await db.createUser({ username: 'x', password: 'y' });
 *   const post = await db.findPost({ id });
 *   await db.updatePost({ id }, { status: 'published' });
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq, and, inArray, type SQL } from "drizzle-orm";
import * as schema from "@/lib/db/schema";

const client = createClient({
  url: (process.env.DATABASE_URL ?? "file:./data/nextpost.db").startsWith("file:")
    ? (process.env.DATABASE_URL ?? "file:./data/nextpost.db")
    : `file:${process.env.DATABASE_URL ?? "./data/nextpost.db"}`,
});

export const db = drizzle(client, { schema });

/* ------------------------------------------------------------------ */
/*  Internal utilities (exported for reuse)                           */
/* ------------------------------------------------------------------ */

/** 带指数退避的 SQLite 执行（处理 SQLITE_BUSY 锁竞争） */
export async function withRetry<T>(fn: () => Promise<T>, retries = 5): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      const e = err as { code?: string; rawCode?: number };
      if ((e.code === "SQLITE_BUSY" || e.rawCode === 5) && i < retries - 1) {
        await new Promise((r) => setTimeout(r, 100 * Math.pow(2, i)));
        continue;
      }
      throw err;
    }
  }
  throw new Error("unreachable");
}

/** 将 Prisma 风格的 { col: { in: [...] } } 转为 Drizzle inArray */
export function buildInClause<T>(table: any, col: keyof T, val: unknown[]): SQL {
  return inArray(table[col] as any, val);
}

/** 将 Prisma 风格的 { col: val } 转为 Drizzle eq */
export function buildEq<T>(table: any, where: Record<string, unknown>): SQL | undefined {
  const conds = Object.entries(where).map(([col, val]) => eq((table as any)[col], val));
  return conds.length > 0 ? and(...conds) : undefined;
}

/* ------------------------------------------------------------------ */
/*  Table-level helpers                                               */
/* ------------------------------------------------------------------ */

/* ---- User ---- */
export async function createUser(data: {
  username: string;
  password: string;
  email?: string;
  id?: string;
}): Promise<typeof schema.user.$inferSelect> {
  const id = data.id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  await withRetry(() =>
    db.insert(schema.user).values({ id, ...data, createdAt: now, updatedAt: now }).execute()
  );
  return { id, username: data.username, password: data.password, email: data.email ?? null,
    aiProvider: "openai", aiApiKey: null, aiModel: "gpt-4",
    createdAt: now, updatedAt: now } as any;
}

export async function findUser(where: { id?: string; username?: string }):
  Promise<typeof schema.user.$inferSelect | null> {
  const w: SQL[] = [];
  if (where.id) w.push(eq(schema.user.id, where.id));
  if (where.username) w.push(eq(schema.user.username, where.username));
  return withRetry(() => db.select().from(schema.user).where(and(...w)).get()) ?? null;
}

export async function deleteUser(where: { id: string }): Promise<void> {
  await withRetry(() => db.delete(schema.user).where(eq(schema.user.id, where.id)).run());
}

/* ---- Platform ---- */
export async function upsertPlatform(data: {
  name: string;
  icon?: string;
}): Promise<typeof schema.platform.$inferSelect> {
  const existing = await withRetry(() =>
    db.select().from(schema.platform).where(eq(schema.platform.name, data.name)).get()
  );
  if (existing) return existing;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await withRetry(() =>
    db.insert(schema.platform).values({ id, name: data.name, icon: data.icon ?? null, createdAt: now }).execute()
  );
  return { id, name: data.name, icon: data.icon ?? null, createdAt: now } as any;
}

/* ---- Account ---- */
export async function createAccount(data: {
  userId: string;
  platformId: string;
  name: string;
  handle: string;
  description?: string;
}): Promise<typeof schema.account.$inferSelect> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await withRetry(() =>
    db.insert(schema.account).values({ id, ...data, description: data.description ?? null,
      deletedAt: null, deletedBy: null, deleteNote: null, createdAt: now, updatedAt: now }).execute()
  );
  return { id, userId: data.userId, platformId: data.platformId, name: data.name,
    handle: data.handle, description: data.description ?? null,
    deletedAt: null, deletedBy: null, deleteNote: null, createdAt: now, updatedAt: now } as any;
}

export async function deleteAccount(where: { id: string }): Promise<void> {
  await withRetry(() => db.delete(schema.account).where(eq(schema.account.id, where.id)).run());
}

export async function deleteAccounts(where: { userId: string }): Promise<number> {
  const result = await withRetry(() =>
    db.delete(schema.account).where(eq(schema.account.userId, where.userId)).run()
  );
  return (result as any).changes ?? 0;
}

/* ---- Post ---- */
export async function createPost(data: {
  userId: string;
  accountId: string;
  content: string;
  title?: string;
  mediaUrls?: string;
  mediaThumbnails?: string;
  scheduledTime?: Date | string;
  timezone?: string;
  status?: string;
  publishToken?: string;
  publishTokenExp?: string;
  id?: string;
}): Promise<typeof schema.post.$inferSelect> {
  const id = data.id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  const scheduled = data.scheduledTime
    ? (data.scheduledTime instanceof Date ? data.scheduledTime.toISOString() : data.scheduledTime)
    : null;
  await withRetry(() =>
    db.insert(schema.post).values({
      id, userId: data.userId, accountId: data.accountId, content: data.content,
      title: data.title ?? null, mediaUrls: data.mediaUrls ?? "[]",
      mediaThumbnails: data.mediaThumbnails ?? "[]",
      scheduledTime: scheduled, timezone: data.timezone ?? "Asia/Shanghai",
      status: data.status ?? "draft",
      publishToken: data.publishToken ?? null, publishTokenExp: data.publishTokenExp ?? null,
      publishedAt: null, externalPostId: null, externalPostUrl: null,
      publishError: null, publishAttempts: 0,
      deletedAt: null, deletedBy: null, deleteNote: null,
      createdAt: now, updatedAt: now,
    }).execute()
  );
  return { id, userId: data.userId, accountId: data.accountId, content: data.content,
    title: data.title ?? null, mediaUrls: data.mediaUrls ?? "[]", mediaThumbnails: data.mediaThumbnails ?? "[]",
    scheduledTime: scheduled, timezone: data.timezone ?? "Asia/Shanghai", status: data.status ?? "draft",
    publishToken: data.publishToken ?? null, publishTokenExp: data.publishTokenExp ?? null,
    publishedAt: null, externalPostId: null, externalPostUrl: null, publishError: null, publishAttempts: 0,
    deletedAt: null, deletedBy: null, deleteNote: null, createdAt: now, updatedAt: now } as any;
}

export async function findPost(where: { id: string }):
  Promise<typeof schema.post.$inferSelect | null> {
  return withRetry(() =>
    db.select().from(schema.post).where(eq(schema.post.id, where.id)).get()
  ) ?? null;
}

export async function findPosts(where: { userId: string }):
  Promise<typeof schema.post.$inferSelect[]> {
  return withRetry(() =>
    db.select().from(schema.post).where(eq(schema.post.userId, where.userId)).all()
  );
}

export async function updatePost(
  where: { id: string },
  data: Partial<typeof schema.post.$inferInsert>
): Promise<typeof schema.post.$inferSelect> {
  const setData: Record<string, unknown> = { ...data };
  if ("scheduledTime" in setData && setData.scheduledTime instanceof Date) {
    setData.scheduledTime = setData.scheduledTime.toISOString();
  }
  if (!("updatedAt" in setData)) setData.updatedAt = new Date().toISOString();
  await withRetry(() =>
    db.update(schema.post).set(setData as any).where(eq(schema.post.id, where.id)).execute()
  );
  return (await withRetry(() =>
    db.select().from(schema.post).where(eq(schema.post.id, where.id)).get())
  ) as any;
}

export async function deletePost(where: { id: string }): Promise<void> {
  await withRetry(() => db.delete(schema.post).where(eq(schema.post.id, where.id)).run());
}

export async function deletePosts(where: { userId?: string; id?: { in: string[] } }): Promise<number> {
  const conditions: SQL[] = [];
  if (where.userId) conditions.push(eq(schema.post.userId, where.userId));
  if (where.id) conditions.push(buildInClause(schema.post, "id", where.id.in));
  const result = await withRetry(() =>
    db.delete(schema.post).where(and(...conditions)).run()
  );
  return (result as any).changes ?? 0;
}

/* ---- ExternalApiKey ---- */
export async function createExternalApiKey(data: {
  userId: string;
  name: string;
  key: string;
  permissions: string;
}): Promise<typeof schema.externalApiKey.$inferSelect> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await withRetry(() =>
    db.insert(schema.externalApiKey).values({
      id, userId: data.userId, name: data.name, key: data.key,
      permissions: data.permissions, lastUsedAt: null, expiresAt: null, createdAt: now,
    }).execute()
  );
  return { id, userId: data.userId, name: data.name, key: data.key,
    permissions: data.permissions, lastUsedAt: null, expiresAt: null, createdAt: now } as any;
}

export async function createManyExternalApiKeys(data: Array<{
  userId: string;
  name: string;
  key: string;
  permissions: string;
}>): Promise<number> {
  const now = new Date().toISOString();
  for (const item of data) {
    const id = crypto.randomUUID();
    await withRetry(() =>
      db.insert(schema.externalApiKey).values({
        id, userId: item.userId, name: item.name, key: item.key,
        permissions: item.permissions, lastUsedAt: null, expiresAt: null, createdAt: now,
      }).execute()
    );
  }
  return data.length;
}

export async function findFirstExternalApiKey(where: {
  userId?: string;
  name?: string;
  key?: string;
}): Promise<typeof schema.externalApiKey.$inferSelect | null> {
  const conditions: SQL[] = [];
  if (where.userId) conditions.push(eq(schema.externalApiKey.userId, where.userId));
  if (where.name) conditions.push(eq(schema.externalApiKey.name, where.name));
  if (where.key) conditions.push(eq(schema.externalApiKey.key, where.key));
  return withRetry(() =>
    db.select().from(schema.externalApiKey).where(and(...conditions)).get()
  ) ?? null;
}

export async function findExternalApiKeys(where: { userId: string }):
  Promise<typeof schema.externalApiKey.$inferSelect[]> {
  return withRetry(() =>
    db.select().from(schema.externalApiKey)
      .where(eq(schema.externalApiKey.userId, where.userId)).all()
  );
}

export async function deleteExternalApiKey(where: { id: string }): Promise<void> {
  await withRetry(() =>
    db.delete(schema.externalApiKey).where(eq(schema.externalApiKey.id, where.id)).run()
  );
}

export async function deleteExternalApiKeys(where: { userId: string }): Promise<number> {
  const result = await withRetry(() =>
    db.delete(schema.externalApiKey).where(eq(schema.externalApiKey.userId, where.userId)).run()
  );
  return (result as any).changes ?? 0;
}

/* ---- Platform ---- */
export async function deletePlatform(where: { id: string }): Promise<void> {
  await withRetry(() =>
    db.delete(schema.platform).where(eq(schema.platform.id, where.id)).run()
  );
}

export async function deletePlatforms(where: { id: string }): Promise<number> {
  const result = await withRetry(() =>
    db.delete(schema.platform).where(eq(schema.platform.id, where.id)).run()
  );
  return (result as any).changes ?? 0;
}
