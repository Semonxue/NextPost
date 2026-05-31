import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        aiProvider: true,
        aiApiKey: true,
        aiModel: true,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("获取设置失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { aiConfig } = await request.json();

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        aiProvider: aiConfig?.provider,
        aiApiKey: aiConfig?.apiKey,
        aiModel: aiConfig?.model,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("更新设置失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}