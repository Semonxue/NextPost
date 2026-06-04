import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * GET /api/platforms
 *
 * 列出所有平台（含 PlatformConfig），供前端账号下拉 / 平台筛选使用
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const platforms = await prisma.platform.findMany({
      include: { config: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ platforms });
  } catch (error) {
    console.error("获取平台列表失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
