import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

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

    const post = await prisma.post.findFirst({
      where: { id, userId: session.user.id, deletedAt: null },
      include: { account: { include: { platform: true } } },
    });

    if (!post) {
      return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
    }

    return NextResponse.json(post);
  } catch (error) {
    console.error("获取帖子失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

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
    const { accountId, content, mediaUrls, mediaThumbnails, scheduledTime, timezone, status, externalPostUrl } = await request.json();

    // 验证帖子归属（且未被软删除）
    const existingPost = await prisma.post.findFirst({
      where: { id, userId: session.user.id, deletedAt: null },
    });

    if (!existingPost) {
      return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
    }

    // 如果更换账号，验证新账号归属
    if (accountId && accountId !== existingPost.accountId) {
      const account = await prisma.account.findFirst({
        where: { id: accountId, userId: session.user.id, deletedAt: null },
      });
      if (!account) {
        return NextResponse.json({ error: "账号不存在" }, { status: 404 });
      }
    }

    // datetime-local 返回的是本地时间，直接存储
    let scheduledTimeFinal = existingPost.scheduledTime;
    if (scheduledTime !== undefined) {
      scheduledTimeFinal = scheduledTime ? new Date(scheduledTime) : null;
    }

    const post = await prisma.post.update({
      where: { id },
      data: {
        accountId: accountId || existingPost.accountId,
        content: content !== undefined ? content : existingPost.content,
        mediaUrls: mediaUrls !== undefined ? JSON.stringify(mediaUrls) : existingPost.mediaUrls,
        mediaThumbnails: mediaThumbnails !== undefined ? JSON.stringify(mediaThumbnails) : existingPost.mediaThumbnails,
        scheduledTime: scheduledTimeFinal,
        timezone: timezone || existingPost.timezone,
        status: status !== undefined ? status : existingPost.status,
        externalPostUrl: externalPostUrl !== undefined ? externalPostUrl : existingPost.externalPostUrl,
      },
      include: { account: { include: { platform: true } } },
    });

    return NextResponse.json(post);
  } catch (error) {
    console.error("更新帖子失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

/**
 * DELETE /api/posts/:id
 *
 * 软删除帖子（v0.3）：设置 deletedAt 和 deletedBy，不立即删除媒体文件
 * - 帖子从列表/详情 API 中不再返回
 * - 帖子可以在 /api/trash 中找到并恢复
 * - 永久删除需要 DELETE /api/trash/posts/:id
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

    // 验证帖子归属
    const existingPost = await prisma.post.findFirst({
      where: { id, userId: session.user.id, deletedAt: null },
    });

    if (!existingPost) {
      return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
    }

    // 软删除：只设置 deletedAt 和 deletedBy
    await prisma.post.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: "user",
      },
    });

    return NextResponse.json({ success: true, message: "已移入回收站" });
  } catch (error) {
    console.error("软删除帖子失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
