import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { id } = await params;
    const { name, handle, description } = await request.json() as { name?: string; handle?: string; description?: string };

    // 验证账号归属（且未被软删除）
    const existingAccount = await prisma.account.findFirst({
      where: { id, userId: session.user.id, deletedAt: null },
    });

    if (!existingAccount) {
      return NextResponse.json({ error: "账号不存在" }, { status: 404 });
    }

    const account = await prisma.account.update({
      where: { id },
      data: {
        name: name || existingAccount.name,
        handle: handle ? handle.replace("@", "") : existingAccount.handle,
        description: description !== undefined ? description : existingAccount.description,
      },
      include: { platform: true },
    });

    return NextResponse.json(account);
  } catch (error) {
    console.error("更新账号失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

/**
 * DELETE /api/accounts/:id
 *
 * 软删除账号（v0.3）：设置 deletedAt 和 deletedBy
 * - 账号从列表中消失
 * - 账号下的帖子不会被删除（帖子可独立恢复或永久删除）
 * - 永久删除需要 DELETE /api/trash/accounts/:id（会级联物理删除帖子和媒体）
 */
export async function DELETE(
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
    const existingAccount = await prisma.account.findFirst({
      where: { id, userId: session.user.id, deletedAt: null },
    });

    if (!existingAccount) {
      return NextResponse.json({ error: "账号不存在" }, { status: 404 });
    }

    // 软删除：只设置 deletedAt 和 deletedBy
    await prisma.account.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: "user",
      },
    });

    return NextResponse.json({ success: true, message: "已移入回收站" });
  } catch (error) {
    console.error("软删除账号失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
