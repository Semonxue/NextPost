/**
 * Drizzle Kit configuration
 *
 * 中立的、与 ORM 无关的 schema 入口。
 *
 * 推送策略：
 * - 本地 SQLite：使用 `pnpm db:push` 直接推 schema 到 data/nextpost.db
 * - Cloudflare D1：使用 `pnpm db:generate` 生成 SQL，再通过 `wrangler d1 migrations apply` 推送
 *
 * 为什么 D1 走 wrangler 而不是 drizzle-kit push？
 * - D1 跑在 workerd，drizzle-kit 不能直连
 * - wrangler 是 Cloudflare 官方工具，能拿到 D1 的 remote credentials
 */

import { defineConfig } from "drizzle-kit";

const localUrl = process.env.DATABASE_URL ?? "file:./data/nextpost.db";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  // 本地 libsql client；D1 推送走 wrangler，不依赖这个 driver
  dbCredentials: {
    url: localUrl,
  },
  verbose: true,
  strict: true,
});
