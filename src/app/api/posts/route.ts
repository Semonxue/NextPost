import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const accountIds = searchParams.getAll("accountIds");
    const platformIds = searchParams.getAll("platformIds");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: Record<string, unknown> = { userId: session.user.id };
    if (status) where.status = status;
    
    // 多账号筛选
    if (accountIds.length > 0) {
      where.accountId = { in: accountIds };
    }
    
    // 多平台筛选（通过账号关联）
    if (platformIds.length > 0) {
      where.account = { platformId: { in: platformIds } };
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: { account: { include: { platform: true } } },
        orderBy: { scheduledTime: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.post.count({ where }),
    ]);

    return NextResponse.json({ posts, total });
  } catch (error) {
    console.error("获取帖子失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { accountId, content, mediaUrls, scheduledTime, timezone, status } = await request.json();

    if (!accountId) {
      return NextResponse.json({ error: "请选择账号" }, { status: 400 });
    }

    if (!content && (!mediaUrls || mediaUrls.length === 0)) {
      return NextResponse.json({ error: "内容或媒体不能同时为空" }, { status: 400 });
    }

    // 验证账号归属
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId: session.user.id },
    });

    if (!account) {
      return NextResponse.json({ error: "账号不存在" }, { status: 404 });
    }

    // datetime-local 返回的是本地时间，直接存储
    // 前端正确定义时区，显示时直接使用该时区
    const scheduledTimeFinal = scheduledTime ? new Date(scheduledTime) : null;
    
    const post = await prisma.post.create({
      data: {
        userId: session.user.id,
        accountId,
        content: content || "",
        mediaUrls: JSON.stringify(mediaUrls || []),
        scheduledTime: scheduledTimeFinal,
        timezone: timezone || "Asia/Shanghai",
        status: status || (scheduledTime ? "scheduled" : "draft"),
      },
      include: { account: { include: { platform: true } } },
    });

    return NextResponse.json(post);
  } catch (error) {
    console.error("创建帖子失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}