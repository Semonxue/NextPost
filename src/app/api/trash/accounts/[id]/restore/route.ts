import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * POST /api/trash/accounts/:id/restore
 *
 * 恢复已软删除的账号，清空 deletedAt
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

    const existing = await prisma.account.findFirst({
      where: {
        id,
        userId: session.user.id,
        deletedAt: { not: null },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "ACCOUNT_NOT_FOUND" }, { status: 404 });
    }

    const account = await prisma.account.update({
      where: { id },
      data: {
        deletedAt: null,
        deletedBy: null,
        deleteNote: null,
      },
      include: { platform: true },
    });

    return NextResponse.json({ success: true, account });
  } catch (error) {
    console.error("恢复账号失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
