import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const accounts = await prisma.account.findMany({
      where: { userId: session.user.id, deletedAt: null },
      include: { platform: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(accounts);
  } catch (error) {
    console.error("获取账号失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { name, handle, description, platformId } = await request.json();

    if (!name || !handle) {
      return NextResponse.json({ error: "名称和handle不能为空" }, { status: 400 });
    }

    if (!platformId) {
      return NextResponse.json({ error: "请选择平台" }, { status: 400 });
    }

    // 校验 platform 存在性
    const platform = await prisma.platform.findUnique({
      where: { id: platformId },
    });

    if (!platform) {
      return NextResponse.json({ error: "平台不存在" }, { status: 400 });
    }

    const account = await prisma.account.create({
      data: {
        userId: session.user.id,
        platformId: platform.id,
        name,
        handle: handle.replace("@", ""),
        description: description || null,
      },
      include: { platform: true },
    });

    return NextResponse.json(account);
  } catch (error) {
    console.error("创建账号失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
