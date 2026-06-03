import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * GET /api/posts/stats
 * 
 * 获取当前用户的帖子统计数据（只统计回收站外的数据）
 * 排除：帖子本身在回收站 或 关联账号在回收站 的帖子
 * 返回格式：{ totalPosts, scheduled, published, drafts }
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    // 只统计回收站外的数据：
    // 1. 帖子本身的 deletedAt 为 null
    // 2. 关联账号的 deletedAt 也为 null
    const whereCondition = {
      userId: session.user.id,
      deletedAt: null,
      account: {
        deletedAt: null,
      },
    };

    const [total, scheduled, published, drafts] = await Promise.all([
      prisma.post.count({ where: whereCondition }),
      prisma.post.count({
        where: {
          ...whereCondition,
          status: "scheduled",
          scheduledTime: { gte: startOfWeek },
        },
      }),
      prisma.post.count({
        where: { ...whereCondition, status: "published" },
      }),
      prisma.post.count({ where: { ...whereCondition, status: "draft" } }),
    ]);

    return NextResponse.json({
      totalPosts: total,
      scheduled,
      published,
      drafts,
    });
  } catch (error) {
    console.error("获取统计失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
