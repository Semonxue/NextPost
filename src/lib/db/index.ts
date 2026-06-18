import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "./schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: any = null;

function resolveD1Binding(): D1Database | null {
  try {
    const ctx = getCloudflareContext();
    const env = ctx?.env as Record<string, unknown> | undefined;
    if (env?.DB) return env.DB as D1Database;
  } catch { /* not in request context */ }
  return null;
}

function createDb() {
  // Cloudflare Workers: use D1 binding
  if (process.env.STORAGE_ENGINE === "r2") {
    const d1Binding = resolveD1Binding();
    if (d1Binding) {
      console.log("[db] Using D1 (Cloudflare Workers)");
      return drizzleD1(d1Binding, { schema });
    }
  }

  // Local dev: use @libsql/client (no native compilation)
  console.log("[db] Using libsql (local dev)");
  const dbPath = (process.env.DATABASE_URL ?? "file:./prisma/dev.db").replace("file:", "");
  const client = createClient({ url: `file:${dbPath}` });
  return drizzle(client, { schema });
}

export function getDb() {
  if (!_db) _db = createDb();
  return _db;
}

// Re-export schema for convenience
export * from "./schema";