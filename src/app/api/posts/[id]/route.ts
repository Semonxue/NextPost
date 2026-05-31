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
      where: { id, userId: session.user.id },
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
    const { accountId, content, mediaUrls, scheduledTime, timezone, status } = await request.json();

    // 验证帖子归属
    const existingPost = await prisma.post.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existingPost) {
      return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
    }

    // 如果更换账号，验证新账号归属
    if (accountId && accountId !== existingPost.accountId) {
      const account = await prisma.account.findFirst({
        where: { id: accountId, userId: session.user.id },
      });
      if (!account) {
        return NextResponse.json({ error: "账号不存在" }, { status: 404 });
      }
    }

    const post = await prisma.post.update({
      where: { id },
      data: {
        accountId: accountId || existingPost.accountId,
        content: content !== undefined ? content : existingPost.content,
        mediaUrls: mediaUrls !== undefined ? JSON.stringify(mediaUrls) : existingPost.mediaUrls,
        scheduledTime: scheduledTime !== undefined ? (scheduledTime ? new Date(scheduledTime) : null) : existingPost.scheduledTime,
        timezone: timezone || existingPost.timezone,
        status: status || existingPost.status,
      },
      include: { account: { include: { platform: true } } },
    });

    return NextResponse.json(post);
  } catch (error) {
    console.error("更新帖子失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

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
      where: { id, userId: session.user.id },
    });

    if (!existingPost) {
      return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
    }

    await prisma.post.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除帖子失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}