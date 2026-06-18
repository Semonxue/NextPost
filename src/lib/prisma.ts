import "../app/polyfills";
import { PrismaClient } from "@prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";

let _prisma: PrismaClient | null = null;

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

function createPrisma(): PrismaClient {
  const binding = resolveD1Binding();
  if (binding) {
    console.log("[prisma] Using D1 adapter");
    return new PrismaClient({ adapter: new PrismaD1(binding), log: ["error"] });
  }
  console.log("[prisma] Using local SQLite driver");
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function getPrisma(): PrismaClient {
  if (!_prisma) _prisma = createPrisma();
  return _prisma;
}

export const prisma = new Proxy({} as unknown as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma();
    const value = (client as any)[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export default prisma;