// @ts-nocheck
/**
 * Drizzle seed script
 *
 * 初始化平台和配置数据（从 REGISTERED_PLATFORMS 派生）
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import * as schema from "./schema";
import { REGISTERED_PLATFORMS } from "../../lib/platform";

const dbPath = (process.env.DATABASE_URL ?? "file:./prisma/dev.db").replace("file:", "");
const client = createClient({ url: `file:${dbPath}` });
const db = drizzle(client, { schema });

async function main() {
  // 插入平台
  for (const platform of REGISTERED_PLATFORMS) {
    const existing = await db.select().from(schema.platform)
      .where(eq(schema.platform.name, platform.key))
      .get();

    if (!existing) {
      db.insert(schema.platform)
        .values({
          name: platform.key,
          icon: platform.icon ?? null,
        })
        .run();
      console.log(`Created platform: ${platform.key} (${platform.label})`);
    }
  }

  // 平台配置
  const configs = [
    { name: "twitter",     maxContentLength: 280,  maxImages: 4,  maxVideos: 1, allowMixedMedia: true  },
    { name: "xiaohongshu", maxContentLength: 1000, maxImages: 18, maxVideos: 1, allowMixedMedia: false },
    { name: "instagram",    maxContentLength: 2200, maxImages: 10, maxVideos: 1, allowMixedMedia: true  },
  ];

  for (const cfg of configs) {
    const plt = db.select().from(schema.platform)
      .where(eq(schema.platform.name, cfg.name))
      .get();

    if (!plt) {
      console.warn(`Platform ${cfg.name} not found, skipping config`);
      continue;
    }

    // 检查是否已有 config
    const existingConfig = await db.select().from(schema.platformConfig)
      .where(eq(schema.platformConfig.platformId, plt.id))
      .get();

    if (!existingConfig) {
      db.insert(schema.platformConfig)
        .values({
          platformId: plt.id,
          maxContentLength: cfg.maxContentLength,
          maxImages: cfg.maxImages,
          maxVideos: cfg.maxVideos,
          allowMixedMedia: cfg.allowMixedMedia,
        })
        .run();
      console.log(`Created config for: ${cfg.name}`);
    }
  }

  console.log("Seed complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
