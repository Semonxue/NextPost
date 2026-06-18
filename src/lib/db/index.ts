import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "./schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: any = null;

/**
 * 默认本地 SQLite 文件路径。
 *
 * 设计原则：使用中立的 `data/nextpost.db`（不是 `prisma/dev.db`）。
 * 这是 NextPost 的"项目名"目录，明确表达"这个目录属于 NextPost"，与具体 ORM 无关。
 */
export const DEFAULT_LOCAL_DB_PATH = "data/nextpost.db";

/**
 * 当前是否运行在 Cloudflare workerd 运行时（生产 / `pnpm preview` / `wrangler dev`）。
 *
 * 判断依据（按可靠性排序）：
 * 1. `navigator.userAgent` 以 `"Cloudflare-Workers"` 开头（workerd 独有）
 * 2. 不存在 `process.versions.node`（Node.js 必定有 `node` 字段；workerd 没有完整 process.versions）
 *
 * 为什么不用「是否有 D1 binding」？
 *  `next.config.ts` 调了 `initOpenNextCloudflareForDev()`，会在本地 `next dev` 进程里注入
 *  miniflare 风格的 D1 binding。如果只看 binding，dev 会误走 D1 而非本地 libsql。
 *  按运行时判断才能让本地 dev 强制走 SQLite、生产强制走 D1。
 */
export function isCloudflareWorkersRuntime(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ua = (globalThis as any).navigator?.userAgent;
  if (typeof ua === "string" && ua.startsWith("Cloudflare-Workers")) {
    return true;
  }
  // fallback：Node.js 一定有 process.versions.node，workerd 没有
  if (typeof process !== "undefined" && process.versions?.node) {
    return false;
  }
  return false;
}

/**
 * 解析 Cloudflare Workers D1 binding。
 *
 * 优先从 getCloudflareContext().env 取（OpenNext 注入），其次从 globalThis 取（兼容 workerd）。
 * 仅在 workerd 运行时解析；本地 dev 强制走 libsql，即使有 miniflare 注入的 D1 binding 也会被忽略。
 * 找不到返回 null，回退到本地 libsql。
 */
function resolveD1Binding(): D1Database | null {
  if (!isCloudflareWorkersRuntime()) {
    // 本地 dev：忽略 miniflare 注入的 binding，强制走本地 SQLite
    return null;
  }
  try {
    const ctx = getCloudflareContext();
    const env = ctx?.env as Record<string, unknown> | undefined;
    if (env?.DB) return env.DB as D1Database;
  } catch { /* not in request context */ }
  if (typeof (globalThis as any).DB !== "undefined") {
    return (globalThis as any).DB;
  }
  if (typeof (globalThis as any).env?.DB !== "undefined") {
    return (globalThis as any).env.DB;
  }
  return null;
}

/**
 * 解析本地 SQLite 路径：
 * - 优先读 `process.env.DATABASE_URL`（支持 `file:` 前缀）
 * - 否则用默认 `data/nextpost.db`
 *
 * 返回值是 libsql client 接受的 url（带 `file:` 前缀）。
 */
function resolveLocalDbUrl(): string {
  const envUrl = process.env.DATABASE_URL;
  if (envUrl) {
    // 兼容历史值 `file:./prisma/dev.db` —— 自动迁移到中立路径
    if (envUrl === "file:./prisma/dev.db" || envUrl === "file:prisma/dev.db") {
      console.warn(
        `[db] DATABASE_URL=${envUrl} 已废弃，自动重定向到 data/nextpost.db。请更新 .env / .dev.vars。`,
      );
      return `file:./${DEFAULT_LOCAL_DB_PATH}`;
    }
    return envUrl.startsWith("file:") ? envUrl : `file:${envUrl}`;
  }
  return `file:./${DEFAULT_LOCAL_DB_PATH}`;
}

async function createDb(): Promise<any> {
  // 优先级 1: Cloudflare Workers D1 binding（CF 运行时强制走这条）
  const d1Binding = resolveD1Binding();
  if (d1Binding) {
    console.log("[db] Using D1 (Cloudflare Workers)");
    return drizzleD1(d1Binding, { schema });
  }

  // 优先级 2: 本地 libsql（Node.js dev / pnpm dev / pnpm preview 走这条）
  // Dynamic import 让 Workers bundle 不尝试解析 @libsql/*
  console.log("[db] Using libsql (local dev)");
  const [{ createClient }, { drizzle }] = await Promise.all([
    import("@libsql/client"),
    import("drizzle-orm/libsql"),
  ]);
  const url = resolveLocalDbUrl();
  const client = createClient({ url });
  return drizzle(client, { schema });
}

let _initPromise: Promise<any> | null = null;

export async function getDb(): Promise<any> {
  // Test injection point — set globalThis.__testDbOverride in tests
  // to inject a test db without mocking the module.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((globalThis as any).__testDbOverride) {
    return (globalThis as any).__testDbOverride;
  }
  if (_db) return _db;
  if (!_initPromise) {
    _initPromise = createDb().then((d) => { _db = d; return _db; });
  }
  return _initPromise;
}

/**
 * 判断当前是否运行在 Cloudflare Workers 运行时。
 *
 * 用于 CLI 脚本（seed.ts）决策走 D1 还是本地 libsql。
 * 注意：必须用真正的运行时判断（`isCloudflareWorkersRuntime`），不能用
 * 「有没有 D1 binding」——本地 `next dev` 进程里通过 miniflare 也能拿到 D1 binding。
 */
export function isWorkersRuntime(): boolean {
  return isCloudflareWorkersRuntime();
}

// Re-export schema for convenience
export * from "./schema";
