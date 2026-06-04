import { PrismaClient } from "@prisma/client";
import { REGISTERED_PLATFORMS } from "../src/lib/platform";

const prisma = new PrismaClient();

async function main() {
  // 从 REGISTERED_PLATFORMS 派生（单一来源）
  for (const platform of REGISTERED_PLATFORMS) {
    const existing = await prisma.platform.findUnique({
      where: { name: platform.key },
    });

    if (!existing) {
      await prisma.platform.create({
        data: { name: platform.key, icon: platform.icon },
      });
      console.log(`Created platform: ${platform.key} (${platform.label})`);
    }
  }

  // 为每个平台创建配置
  const configs: Array<{
    name: string;
    maxContentLength: number;
    maxImages: number;
    maxVideos: number;
    allowMixedMedia: boolean;
  }> = [
    { name: "twitter", maxContentLength: 280, maxImages: 4, maxVideos: 1, allowMixedMedia: true },
    { name: "xiaohongshu", maxContentLength: 1000, maxImages: 18, maxVideos: 1, allowMixedMedia: false },
    { name: "instagram", maxContentLength: 2200, maxImages: 10, maxVideos: 1, allowMixedMedia: true },
  ];

  for (const config of configs) {
    const platform = await prisma.platform.findUnique({
      where: { name: config.name },
      include: { config: true },
    });

    if (platform && !platform.config) {
      await prisma.platformConfig.create({
        data: {
          platformId: platform.id,
          maxContentLength: config.maxContentLength,
          maxImages: config.maxImages,
          maxVideos: config.maxVideos,
          allowMixedMedia: config.allowMixedMedia,
        },
      });
      console.log(`Created config for: ${config.name}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });