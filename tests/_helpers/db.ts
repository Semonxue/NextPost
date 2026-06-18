/**
 * 测试 DB helper
 *
 * 关键原则：测试用真实 SQLite (libsql) + 真实 Drizzle schema，**不 mock 业务逻辑**。
 * 业务代码（auth.ts / tools.ts）100% 真实运行，DB 100% 真实 SQLite。
 *
 * 实现：
 * - 用 libsql `:memory:` 内存 SQLite
 * - 跑真实 schema DDL 建表
 * - 通过 `globalThis.__testDbOverride` 让 `src/lib/db/index.ts` 的 `getDb()` 直接返回测试 db
 * - 无需 vi.mock，真实 production 代码路径完全不变
 *
 * 用法：
 *   import '../_setup-mock-db'
 *   import { setupTestDb, closeTestDb, truncateAllTables, getTestDb } from './_helpers/db'
 *
 *   beforeAll(setupTestDb)
 *   afterAll(closeTestDb)
 *   beforeEach(truncateAllTables)
 */

import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/lib/db/schema";

let _setupPromise: Promise<void> | null = null;

function buildCreateTableSql(): string[] {
  // 与 src/lib/db/schema.ts 完全同步的真实 DDL
  return [
    `CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "username" TEXT NOT NULL UNIQUE,
      "password" TEXT NOT NULL,
      "email" TEXT,
      "aiProvider" TEXT NOT NULL DEFAULT 'openai',
      "aiApiKey" TEXT,
      "aiModel" TEXT NOT NULL DEFAULT 'gpt-4',
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS "Platform" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "name" TEXT NOT NULL UNIQUE,
      "icon" TEXT,
      "createdAt" TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS "PlatformConfig" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "platformId" TEXT NOT NULL UNIQUE,
      "maxContentLength" INTEGER NOT NULL DEFAULT 280,
      "maxImages" INTEGER NOT NULL DEFAULT 4,
      "maxVideos" INTEGER NOT NULL DEFAULT 1,
      "allowMixedMedia" INTEGER NOT NULL DEFAULT 1,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS "Account" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "userId" TEXT NOT NULL,
      "platformId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "handle" TEXT NOT NULL,
      "description" TEXT,
      "deletedAt" TEXT,
      "deletedBy" TEXT,
      "deleteNote" TEXT,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS "Account_deletedAt_idx" ON "Account" ("deletedAt")`,
    `CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON "Account" ("userId")`,
    `CREATE TABLE IF NOT EXISTS "Post" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "userId" TEXT NOT NULL,
      "accountId" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "title" TEXT,
      "mediaUrls" TEXT NOT NULL DEFAULT '[]',
      "mediaThumbnails" TEXT NOT NULL DEFAULT '[]',
      "scheduledTime" TEXT,
      "timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
      "status" TEXT NOT NULL DEFAULT 'draft',
      "publishToken" TEXT,
      "publishTokenExp" TEXT,
      "publishedAt" TEXT,
      "externalPostId" TEXT,
      "externalPostUrl" TEXT,
      "publishError" TEXT,
      "publishAttempts" INTEGER NOT NULL DEFAULT 0,
      "deletedAt" TEXT,
      "deletedBy" TEXT,
      "deleteNote" TEXT,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS "Post_status_idx" ON "Post" ("status")`,
    `CREATE INDEX IF NOT EXISTS "Post_scheduledTime_idx" ON "Post" ("scheduledTime")`,
    `CREATE INDEX IF NOT EXISTS "Post_deletedAt_idx" ON "Post" ("deletedAt")`,
    `CREATE INDEX IF NOT EXISTS "Post_userId_idx" ON "Post" ("userId")`,
    `CREATE TABLE IF NOT EXISTS "Media" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "userId" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "url" TEXT NOT NULL,
      "thumbnailUrl" TEXT,
      "filename" TEXT NOT NULL,
      "size" INTEGER NOT NULL,
      "mimeType" TEXT NOT NULL,
      "uploadedAt" TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS "Conversation" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "userId" TEXT NOT NULL,
      "title" TEXT NOT NULL DEFAULT '新对话',
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS "Message" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "conversationId" TEXT NOT NULL,
      "role" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "toolCalls" TEXT NOT NULL DEFAULT '[]',
      "toolResults" TEXT NOT NULL DEFAULT '[]',
      "model" TEXT,
      "createdAt" TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS "ExternalApiKey" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "userId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "key" TEXT NOT NULL UNIQUE,
      "permissions" TEXT NOT NULL DEFAULT 'read_report',
      "lastUsedAt" TEXT,
      "expiresAt" TEXT,
      "createdAt" TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS "ExternalApiKey_userId_idx" ON "ExternalApiKey" ("userId")`,
    `CREATE INDEX IF NOT EXISTS "ExternalApiKey_key_idx" ON "ExternalApiKey" ("key")`,
    `CREATE TABLE IF NOT EXISTS "AiOperationLog" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "userId" TEXT NOT NULL,
      "operation" TEXT NOT NULL,
      "toolName" TEXT NOT NULL,
      "details" TEXT,
      "result" TEXT,
      "createdAt" TEXT NOT NULL
    )`,
  ];
}

/**
 * 初始化测试 DB：建内存 SQLite + 跑 schema + 注入 globalThis.__testDbOverride
 *
 * 必须在 `beforeAll` 中调用。
 */
export async function setupTestDb(): Promise<void> {
  if (_setupPromise) return _setupPromise;
  _setupPromise = (async () => {
    const client = createClient({ url: ":memory:" });
    const statements = buildCreateTableSql().map((sql) => ({
      sql,
      args: [] as unknown[],
    }));
    await client.batch(statements, "write");

    const db = drizzle(client, { schema });

    // 注入到 production 代码的 getDb() 里
    // src/lib/db/index.ts 会优先检查这个 override
    (globalThis as Record<string, unknown>).__testDbOverride = db;
    (globalThis as Record<string, unknown>).__testClient = client;
  })();
  return _setupPromise;
}

/**
 * 获取测试 db 实例
 */
export function getTestDb() {
  const db = (globalThis as Record<string, unknown>).__testDbOverride;
  if (!db) throw new Error("setupTestDb() not called or failed");
  return db as ReturnType<typeof drizzle<typeof schema>>;
}

/**
 * 清空所有表（保留 schema）
 */
export async function truncateAllTables(): Promise<void> {
  const client = (globalThis as Record<string, unknown>).__testClient as Client | undefined;
  if (!client) return;
  await client.batch(
    [
      { sql: 'DELETE FROM "AiOperationLog"', args: [] },
      { sql: 'DELETE FROM "ExternalApiKey"', args: [] },
      { sql: 'DELETE FROM "Message"', args: [] },
      { sql: 'DELETE FROM "Conversation"', args: [] },
      { sql: 'DELETE FROM "Media"', args: [] },
      { sql: 'DELETE FROM "Post"', args: [] },
      { sql: 'DELETE FROM "Account"', args: [] },
      { sql: 'DELETE FROM "PlatformConfig"', args: [] },
      { sql: 'DELETE FROM "Platform"', args: [] },
      { sql: 'DELETE FROM "User"', args: [] },
    ],
    "write",
  );
}

/**
 * 关闭测试 DB
 */
export function closeTestDb(): void {
  const client = (globalThis as Record<string, unknown>).__testClient as Client | undefined;
  if (client) {
    client.close();
  }
  delete (globalThis as Record<string, unknown>).__testDbOverride;
  delete (globalThis as Record<string, unknown>).__testClient;
  _setupPromise = null;
}