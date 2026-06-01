import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { deleteFile } from "@/lib/storage";

/**
 * DELETE /api/trash/accounts/:id
 *
 * 永久删除已软删除的账号：物理删除账号 + 级联物理删除该账号下所有帖子和它们的媒体文件
 */
export async function DELETE(
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

    // 收集该账号下所有帖子的媒体文件
    const posts = await prisma.post.findMany({
      where: { accountId: id },
      select: { id: true, mediaUrls: true },
    });

    for (const post of posts) {
      try {
        if (post.mediaUrls) {
          const mediaUrls = JSON.parse(post.mediaUrls) as string[];
          for (const url of mediaUrls) {
            if (url && !url.startsWith("data:")) {
              await deleteFile(url);
            }
          }
        }
      } catch (error) {
        console.error(`删除帖子 ${post.id} 的媒体文件失败:`, error);
      }
    }

    // 物理删除账号（Prisma schema 中 onDelete: Cascade 会自动删除帖子）
    await prisma.account.delete({ where: { id } });

    return NextResponse.json({ success: true, deletedPosts: posts.length });
  } catch (error) {
    console.error("永久删除账号失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
