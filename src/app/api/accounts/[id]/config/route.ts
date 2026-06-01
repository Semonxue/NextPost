import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { DEFAULT_PLATFORM_CONFIG } from "@/lib/platform";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { id } = await params;

    // 验证账号归属
    const account = await prisma.account.findFirst({
      where: { id, userId: session.user.id },
      include: {
        platform: {
          include: {
            config: true,
          },
        },
      },
    });

    if (!account) {
      return NextResponse.json({ error: "账号不存在" }, { status: 404 });
    }

    // 获取平台配置
    const platformName = account.platform.name;
    const dbConfig = account.platform.config;

    // 如果数据库有配置，使用数据库配置；否则使用默认配置
    const config = {
      platformId: account.platformId,
      platformName,
      maxContentLength:
        dbConfig?.maxContentLength ??
        DEFAULT_PLATFORM_CONFIG[platformName as keyof typeof DEFAULT_PLATFORM_CONFIG]?.maxContentLength ??
        280,
      maxImages:
        dbConfig?.maxImages ??
        DEFAULT_PLATFORM_CONFIG[platformName as keyof typeof DEFAULT_PLATFORM_CONFIG]?.maxImages ??
        4,
      maxVideos:
        dbConfig?.maxVideos ??
        DEFAULT_PLATFORM_CONFIG[platformName as keyof typeof DEFAULT_PLATFORM_CONFIG]?.maxVideos ??
        1,
      allowMixedMedia:
        dbConfig?.allowMixedMedia ??
        DEFAULT_PLATFORM_CONFIG[platformName as keyof typeof DEFAULT_PLATFORM_CONFIG]?.allowMixedMedia ??
        true,
    };

    return NextResponse.json(config);
  } catch (error) {
    console.error("获取平台配置失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}