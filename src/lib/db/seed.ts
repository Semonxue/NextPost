// @ts-nocheck
/**
 * Drizzle seed script
 *
 * 双模式 seed：
 * - 自动检测：有 D1 binding 用 D1，否则用本地 libsql
 * - 显式覆盖：`--local` / `--d1` 强制走对应模式
 *
 * 数据来源：`REGISTERED_PLATFORMS` + `DEFAULT_PLATFORM_CONFIG`（src/lib/platform.ts）
 * 保证应用代码和 DB seed 同步。
 *
 * 用法：
 *   pnpm db:seed          # 自动检测
 *   pnpm db:seed:local    # 强制本地 libsql
 *   pnpm db:seed:d1       # 强制 Cloudflare D1（需在 wrangler d1 execute 上下文）
 */

import { eq } from "drizzle-orm";
import { isWorkersRuntime } from "./index";
import * as schema from "./schema";
import { REGISTERED_PLATFORMS } from "../../lib/platform";

const DEFAULT_PLATFORM_CONFIG: Record<string, {
  maxContentLength: number;
  maxImages: number;
  maxVideos: number;
  allowMixedMedia: boolean;
}> = {
  twitter:     { maxContentLength: 280,  maxImages: 4,  maxVideos: 1, allowMixedMedia: true  },
  xiaohongshu: { maxContentLength: 1000, maxImages: 18, maxVideos: 1, allowMixedMedia: false },
  instagram:   { maxContentLength: 2200, maxImages: 10, maxVideos: 1, allowMixedMedia: true  },
};

async function seedLocal(): Promise<void> {
  console.log("[seed] Mode: local libsql");
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");
  const raw = process.env.DATABASE_URL ?? "file:./data/nextpost.db";
  const url = raw.startsWith("file:") ? raw : `file:${raw}`;
  const client = createClient({ url });
  const db = drizzle(client, { schema });
  await runSeed(db);
}

async function seedD1(): Promise<void> {
  console.log("[seed] Mode: Cloudflare D1 (remote)");
  const d1 = (globalThis as any).DB as D1Database | undefined;
  if (!d1) {
    throw new Error(
      "[seed] D1 binding not found. Run this command via `wrangler d1 execute` or inside a Workers context.",
    );
  }
  const { drizzle: drizzleD1 } = await import("drizzle-orm/d1");
  const db = drizzleD1(d1, { schema });
  await runSeed(db);
}

async function runSeed(db: any): Promise<void> {
  // 1. 平台元数据（来自 REGISTERED_PLATFORMS）
  for (const platform of REGISTERED_PLATFORMS) {
    const existing = await db.select().from(schema.platform)
      .where(eq(schema.platform.name, platform.key))
      .get();
    if (!existing) {
      await db.insert(schema.platform)
        .values({ name: platform.key, icon: platform.icon ?? null })
        .execute();
      console.log(`  ✓ Created platform: ${platform.key} (${platform.label})`);
    } else {
      console.log(`  · Platform exists: ${platform.key}`);
    }
  }

  // 2. 平台内容配置
  for (const [name, cfg] of Object.entries(DEFAULT_PLATFORM_CONFIG)) {
    const plt = await db.select().from(schema.platform)
      .where(eq(schema.platform.name, name))
      .get();
    if (!plt) {
      console.warn(`  ! Platform "${name}" not found, skip config`);
      continue;
    }
    const existingConfig = await db.select().from(schema.platformConfig)
      .where(eq(schema.platformConfig.platformId, plt.id))
      .get();
    if (!existingConfig) {
      await db.insert(schema.platformConfig)
        .values({ platformId: plt.id, ...cfg })
        .execute();
      console.log(`  ✓ Created config: ${name}`);
    } else {
      console.log(`  · Config exists: ${name}`);
    }
  }

  console.log("[seed] Done.");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const forceLocal = args.includes("--local");
  const forceD1 = args.includes("--d1");

  try {
    if (forceD1) {
      await seedD1();
    } else if (forceLocal) {
      await seedLocal();
    } else if (isWorkersRuntime() && (globalThis as any).DB) {
      await seedD1();
    } else {
      await seedLocal();
    }
    process.exit(0);
  } catch (err) {
    console.error("[seed] Failed:", err);
    process.exit(1);
  }
}

main();
