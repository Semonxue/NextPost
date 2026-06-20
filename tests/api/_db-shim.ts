/**
 * DB shim for API tests.
 *
 * Provides in-memory SQLite mock for @/lib/db.
 * Schema is defined here (not imported from @/lib/db/schema) to avoid alias resolution issues.
 *
 * Usage in test files:
 *   import { mockDb, setupTestDb, truncateAllTables, closeTestDb } from './_db-shim'
 *   vi.mock('@/lib/db', () => mockDb)
 *   beforeAll(setupTestDb)
 *   beforeEach(truncateAllTables)
 *   afterAll(closeTestDb)
 */
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

// ===== Schema definitions (duplicated from src/lib/db/schema.ts to avoid import issues) =====

const user = sqliteTable("User", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email"),
  aiProvider: text("aiProvider").notNull().default("openai"),
  aiApiKey: text("aiApiKey"),
  aiModel: text("aiModel").notNull().default("gpt-4"),
  createdAt: text("createdAt").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updatedAt").notNull().$defaultFn(() => new Date().toISOString()),
});

const platform = sqliteTable("Platform", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().unique(),
  icon: text("icon"),
  createdAt: text("createdAt").notNull().$defaultFn(() => new Date().toISOString()),
});

const account = sqliteTable(
  "Account",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("userId").notNull(),
    platformId: text("platformId").notNull(),
    name: text("name").notNull(),
    handle: text("handle").notNull(),
    description: text("description"),
    deletedAt: text("deletedAt"),
    deletedBy: text("deletedBy"),
    deleteNote: text("deleteNote"),
    createdAt: text("createdAt").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updatedAt").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    index("Account_deletedAt_idx").on(t.deletedAt),
    index("Account_userId_idx").on(t.userId),
  ]
);

const post = sqliteTable(
  "Post",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("userId").notNull(),
    accountId: text("accountId").notNull(),
    content: text("content").notNull(),
    title: text("title"),
    mediaUrls: text("mediaUrls").notNull().default("[]"),
    mediaThumbnails: text("mediaThumbnails").notNull().default("[]"),
    scheduledTime: text("scheduledTime"),
    timezone: text("timezone").notNull().default("Asia/Shanghai"),
    status: text("status").notNull().default("draft"),
    publishToken: text("publishToken"),
    publishTokenExp: text("publishTokenExp"),
    publishedAt: text("publishedAt"),
    externalPostId: text("externalPostId"),
    externalPostUrl: text("externalPostUrl"),
    publishError: text("publishError"),
    publishAttempts: integer("publishAttempts").notNull().default(0),
    deletedAt: text("deletedAt"),
    deletedBy: text("deletedBy"),
    deleteNote: text("deleteNote"),
    createdAt: text("createdAt").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updatedAt").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    index("Post_status_idx").on(t.status),
    index("Post_scheduledTime_idx").on(t.scheduledTime),
    index("Post_deletedAt_idx").on(t.deletedAt),
    index("Post_userId_idx").on(t.userId),
  ]
);

const media = sqliteTable("Media", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("userId").notNull(),
  type: text("type").notNull(),
  url: text("url").notNull(),
  thumbnailUrl: text("thumbnailUrl"),
  filename: text("filename").notNull(),
  size: integer("size").notNull(),
  mimeType: text("mimeType").notNull(),
  uploadedAt: text("uploadedAt").notNull().$defaultFn(() => new Date().toISOString()),
});

const externalApiKey = sqliteTable(
  "ExternalApiKey",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("userId").notNull(),
    name: text("name").notNull(),
    key: text("key").notNull().unique(),
    permissions: text("permissions").notNull().default("read_report"),
    lastUsedAt: text("lastUsedAt"),
    expiresAt: text("expiresAt"),
    createdAt: text("createdAt").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    index("ExternalApiKey_userId_idx").on(t.userId),
    index("ExternalApiKey_key_idx").on(t.key),
  ]
);

// ===== In-memory DB setup =====

let _client: Client | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

const schema = { user, platform, account, post, media, externalApiKey };

async function _setupTestDb(): Promise<void> {
  if (_db) return;
  _client = createClient({ url: ":memory:" });
  await _client.batch(
    [
      `CREATE TABLE IF NOT EXISTS "User" ("id" TEXT PRIMARY KEY NOT NULL,"username" TEXT NOT NULL UNIQUE,"password" TEXT NOT NULL,"email" TEXT,"aiProvider" TEXT NOT NULL DEFAULT 'openai',"aiApiKey" TEXT,"aiModel" TEXT NOT NULL DEFAULT 'gpt-4',"createdAt" TEXT NOT NULL,"updatedAt" TEXT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS "Platform" ("id" TEXT PRIMARY KEY NOT NULL,"name" TEXT NOT NULL UNIQUE,"icon" TEXT,"createdAt" TEXT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS "Account" ("id" TEXT PRIMARY KEY NOT NULL,"userId" TEXT NOT NULL,"platformId" TEXT NOT NULL,"name" TEXT NOT NULL,"handle" TEXT NOT NULL,"description" TEXT,"deletedAt" TEXT,"deletedBy" TEXT,"deleteNote" TEXT,"createdAt" TEXT NOT NULL,"updatedAt" TEXT NOT NULL)`,
      `CREATE INDEX IF NOT EXISTS "Account_deletedAt_idx" ON "Account" ("deletedAt")`,
      `CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON "Account" ("userId")`,
      `CREATE TABLE IF NOT EXISTS "Post" ("id" TEXT PRIMARY KEY NOT NULL,"userId" TEXT NOT NULL,"accountId" TEXT NOT NULL,"content" TEXT NOT NULL,"title" TEXT,"mediaUrls" TEXT NOT NULL DEFAULT '[]',"mediaThumbnails" TEXT NOT NULL DEFAULT '[]',"scheduledTime" TEXT,"timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',"status" TEXT NOT NULL DEFAULT 'draft',"publishToken" TEXT,"publishTokenExp" TEXT,"publishedAt" TEXT,"externalPostId" TEXT,"externalPostUrl" TEXT,"publishError" TEXT,"publishAttempts" INTEGER NOT NULL DEFAULT 0,"deletedAt" TEXT,"deletedBy" TEXT,"deleteNote" TEXT,"createdAt" TEXT NOT NULL,"updatedAt" TEXT NOT NULL)`,
      `CREATE INDEX IF NOT EXISTS "Post_status_idx" ON "Post" ("status")`,
      `CREATE INDEX IF NOT EXISTS "Post_scheduledTime_idx" ON "Post" ("scheduledTime")`,
      `CREATE INDEX IF NOT EXISTS "Post_deletedAt_idx" ON "Post" ("deletedAt")`,
      `CREATE INDEX IF NOT EXISTS "Post_userId_idx" ON "Post" ("userId")`,
      `CREATE TABLE IF NOT EXISTS "Media" ("id" TEXT PRIMARY KEY NOT NULL,"userId" TEXT NOT NULL,"type" TEXT NOT NULL,"url" TEXT NOT NULL,"thumbnailUrl" TEXT,"filename" TEXT NOT NULL,"size" INTEGER NOT NULL,"mimeType" TEXT NOT NULL,"uploadedAt" TEXT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS "ExternalApiKey" ("id" TEXT PRIMARY KEY NOT NULL,"userId" TEXT NOT NULL,"name" TEXT NOT NULL,"key" TEXT NOT NULL UNIQUE,"permissions" TEXT NOT NULL DEFAULT 'read_report',"lastUsedAt" TEXT,"expiresAt" TEXT,"createdAt" TEXT NOT NULL)`,
      `CREATE INDEX IF NOT EXISTS "ExternalApiKey_userId_idx" ON "ExternalApiKey" ("userId")`,
      `CREATE INDEX IF NOT EXISTS "ExternalApiKey_key_idx" ON "ExternalApiKey" ("key")`,
    ].map((sql) => ({ sql, args: [] as unknown[] })),
    "write"
  );
  _db = drizzle(_client, { schema });
  (globalThis as Record<string, unknown>).__testDbOverride = _db;
}

export function getTestDb() {
  if (!_db) throw new Error("setupTestDb() not called");
  return _db;
}

export async function truncateAllTables(): Promise<void> {
  if (!_client) return;
  await _client.batch(
    [
      { sql: 'DELETE FROM "ExternalApiKey"', args: [] },
      { sql: 'DELETE FROM "Media"', args: [] },
      { sql: 'DELETE FROM "Post"', args: [] },
      { sql: 'DELETE FROM "Account"', args: [] },
      { sql: 'DELETE FROM "Platform"', args: [] },
      { sql: 'DELETE FROM "User"', args: [] },
    ],
    "write"
  );
}

export function closeTestDb(): void {
  if (_client) { _client.close(); }
  _client = null;
  _db = null;
  delete (globalThis as Record<string, unknown>).__testDbOverride;
}

// mockDb — for vi.mock('@/lib/db', () => mockDb)
// Returns getDb() which calls setupTestDb() if needed, then returns the in-memory db.
export const mockDb = {
  getDb: async () => { await _setupTestDb(); return getTestDb() },
  user,
  platform,
  account,
  post,
  media,
  externalApiKey,
  DEFAULT_LOCAL_DB_PATH: 'data/nextpost.db',
  isWorkersRuntime: () => false,
};

export const setupTestDb = _setupTestDb;
export { schema };
