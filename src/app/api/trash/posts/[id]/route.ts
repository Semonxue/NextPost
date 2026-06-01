import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { deleteFile } from "@/lib/storage";

/**
 * DELETE /api/trash/posts/:id
 *
 * 永久删除已软删除的帖子：物理删除数据库记录 + 清理媒体文件
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

    // 删除关联的媒体文件
    if (existing.mediaUrls) {
      try {
        const mediaUrls = JSON.parse(existing.mediaUrls) as string[];
        for (const url of mediaUrls) {
          if (url && !url.startsWith("data:")) {
            await deleteFile(url);
          }
        }
      } catch (error) {
        console.error("删除媒体文件失败:", error);
        // 不影响主流程
      }
    }

    // 物理删除帖子
    await prisma.post.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("永久删除帖子失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
