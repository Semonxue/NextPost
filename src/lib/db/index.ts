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
  if (typeof (globalThis as any).DB !== "undefined") {
    return (globalThis as any).DB;
  }
  if (typeof (globalThis as any).env?.DB !== "undefined") {
    return (globalThis as any).env.DB;
  }
  return null;
}

function createDb(): any {
  // Cloudflare Workers: use D1 binding (sync)
  if (process.env.STORAGE_ENGINE === "r2") {
    const d1Binding = resolveD1Binding();
    if (d1Binding) {
      console.log("[db] Using D1 (Cloudflare Workers)");
      return drizzleD1(d1Binding, { schema });
    }
  }

  // Local dev: use @libsql/client (Node.js only)
  // This branch is NOT reached in Workers (D1 is always available there via getCloudflareContext)
  console.log("[db] Using libsql (local dev)");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require("@libsql/client");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/libsql");
  const dbPath = (process.env.DATABASE_URL ?? "file:./prisma/dev.db").replace("file:", "");
  const client = createClient({ url: `file:${dbPath}` });
  return drizzle(client, { schema });
}

// Eager init
_db = createDb();

export function getDb(): any {
  return _db;
}

// Re-export schema for convenience
export * from "./schema";
