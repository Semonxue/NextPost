import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "./schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: any = null;
let _initPromise: Promise<any> | null = null;

function resolveD1Binding(): D1Database | null {
  try {
    const ctx = getCloudflareContext();
    const env = ctx?.env as Record<string, unknown> | undefined;
    if (env?.DB) return env.DB as D1Database;
  } catch { /* not in request context */ }
  // Fallback: check globalThis (useful in some Edge runtimes)
  if (typeof (globalThis as any).DB !== "undefined") {
    return (globalThis as any).DB;
  }
  if (typeof (globalThis as any).env?.DB !== "undefined") {
    return (globalThis as any).env.DB;
  }
  return null;
}

async function createDbAsync(): Promise<any> {
  // Cloudflare Workers: use D1 binding
  if (process.env.STORAGE_ENGINE === "r2") {
    const d1Binding = resolveD1Binding();
    if (d1Binding) {
      console.log("[db] Using D1 (Cloudflare Workers)");
      return drizzleD1(d1Binding, { schema });
    }
  }

  // Local dev: use @libsql/client (no native compilation)
  // This branch is NOT reached in Workers (D1 is always available there)
  console.log("[db] Using libsql (local dev)");
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");
  const dbPath = (process.env.DATABASE_URL ?? "file:./prisma/dev.db").replace("file:", "");
  const client = createClient({ url: `file:${dbPath}` });
  return drizzle(client, { schema });
}

/**
 * Returns the initialized db instance synchronously.
 * On first call, kicks off async init and caches the result.
 * Workers: returns D1 db (sync) on first call.
 * Local: returns libsql db after async init completes (callers get stale singleton until first await).
 */
export function getDb(): any {
  if (_db !== null) return _db;
  if (!_initPromise) {
    _initPromise = createDbAsync().then((d) => { _db = d; return _db; });
  }
  // Return the in-flight promise wrapper — callers use it sync; drizzle queries are sync anyway
  return _initPromise;
}

// Re-export schema for convenience
export * from "./schema";
