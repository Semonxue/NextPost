import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";

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
    const search = searchParams.get("search");
    const sortField = searchParams.get("sortField") || "scheduledTime";
    const sortOrder = searchParams.get("sortOrder") || "desc";
    const limit = parseInt(searchParams.get("limit") || "500");
    const offset = parseInt(searchParams.get("offset") || "0");

    // 过滤已软删除的帖子（v0.3）
    const where: Record<string, unknown> = {
      userId: session.user.id,
      deletedAt: null,
    };
    if (status) where.status = status;

    // 多账号筛选
    if (accountIds.length > 0) {
      where.accountId = { in: accountIds };
    }

    // 多平台筛选（通过账号关联）
    if (platformIds.length > 0) {
      where.account = { platformId: { in: platformIds } };
    }

    // 搜索筛选（内容或账号名）
    if (search) {
      where.OR = [
        { content: { contains: search } },
        { account: { name: { contains: search } } },
        { account: { handle: { contains: search } } },
      ];
    }

    // 排序字段映射
    const validSortFields = ["scheduledTime", "createdAt", "updatedAt"];
    const orderByField = validSortFields.includes(sortField) ? sortField : "scheduledTime";
    const orderByOrder = sortOrder === "asc" ? "asc" : "desc";

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: { account: { include: { platform: true } } },
        orderBy: { [orderByField]: orderByOrder },
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

    const { accountId, content, title, mediaUrls, mediaThumbnails, scheduledTime, timezone, status } = (await request.json()) as { accountId?: string; content?: string; title?: string; mediaUrls?: string[]; mediaThumbnails?: string[]; scheduledTime?: string; timezone?: string; status?: string };

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

    // 确定最终状态
    const finalStatus = status || (scheduledTime ? "scheduled" : "draft");

    // 为 scheduled 状态的帖子生成 publishToken
    const publishToken = finalStatus === "scheduled"
      ? `tok_${uuidv4().replace(/-/g, "")}`
      : null;

    const post = await prisma.post.create({
      data: {
        userId: session.user.id,
        accountId,
        content: content || "",
        title: title || null,
        mediaUrls: JSON.stringify(mediaUrls || []),
        mediaThumbnails: JSON.stringify(mediaThumbnails || []), // 缩略图 URL 数组
        scheduledTime: scheduledTimeFinal,
        timezone: timezone || "Asia/Shanghai",
        status: finalStatus,
        publishToken,
      },
      include: { account: { include: { platform: true } } },
    });

    return NextResponse.json(post);
  } catch (error) {
    console.error("创建帖子失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
