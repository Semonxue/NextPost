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

async function createDb(): Promise<any> {
  // Cloudflare Workers: prefer D1 binding (always available in CF Workers env)
  const d1Binding = resolveD1Binding();
  if (d1Binding) {
    console.log("[db] Using D1 (Cloudflare Workers)");
    return drizzleD1(d1Binding, { schema });
  }

  // Local dev: use @libsql/client (Node.js only — never reached in Workers)
  // Dynamic import so Workers bundle doesn't try to resolve @libsql/* at build time
  console.log("[db] Using libsql (local dev)");
  const [{ createClient }, { drizzle }] = await Promise.all([
    import("@libsql/client"),
    import("drizzle-orm/libsql"),
  ]);
  const dbPath = (process.env.DATABASE_URL ?? "file:./prisma/dev.db").replace("file:", "");
  const client = createClient({ url: `file:${dbPath}` });
  return drizzle(client, { schema });
}

let _initPromise: Promise<any> | null = null;

export async function getDb(): Promise<any> {
  if (_db) return _db;
  if (!_initPromise) {
    _initPromise = createDb().then((d) => { _db = d; return _db; });
  }
  return _initPromise;
}

// Re-export schema for convenience
export * from "./schema";
