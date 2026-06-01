import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 创建平台
  const platforms = [
    { name: "Twitter", icon: "twitter" },
    { name: "Instagram", icon: "instagram" },
    { name: "LinkedIn", icon: "linkedin" },
    { name: "Facebook", icon: "facebook" },
  ];

  for (const platform of platforms) {
    const existing = await prisma.platform.findUnique({
      where: { name: platform.name },
    });

    if (!existing) {
      await prisma.platform.create({
        data: platform,
      });
      console.log(`Created platform: ${platform.name}`);
    }
  }

  // 为每个平台创建配置
  const configs = [
    { name: "Twitter", maxContentLength: 280, maxImages: 4, maxVideos: 1, allowMixedMedia: true },
    { name: "Instagram", maxContentLength: 2200, maxImages: 10, maxVideos: 1, allowMixedMedia: true },
    { name: "LinkedIn", maxContentLength: 3000, maxImages: 9, maxVideos: 1, allowMixedMedia: true },
    { name: "Facebook", maxContentLength: 63206, maxImages: 10, maxVideos: 1, allowMixedMedia: true },
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