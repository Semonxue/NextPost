import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * POST /api/trash/posts/:id/restore
 *
 * 恢复已软删除的帖子，清空 deletedAt
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { id } = await params;

    // 验证帖子存在且属于当前用户，且已被软删除
    const existing = await prisma.post.findFirst({
      where: {
        id,
        userId: session.user.id,
        deletedAt: { not: null },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "POST_NOT_FOUND" }, { status: 404 });
    }

    const post = await prisma.post.update({
      where: { id },
      data: {
        deletedAt: null,
        deletedBy: null,
        deleteNote: null,
      },
      include: { account: { include: { platform: true } } },
    });

    return NextResponse.json({ success: true, post });
  } catch (error) {
    console.error("恢复帖子失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
