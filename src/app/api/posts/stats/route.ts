import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

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

    const [total, scheduled, published, drafts] = await Promise.all([
      prisma.post.count({ where: { userId: session.user.id } }),
      prisma.post.count({
        where: {
          userId: session.user.id,
          status: "scheduled",
          scheduledTime: { gte: startOfWeek },
        },
      }),
      prisma.post.count({
        where: { userId: session.user.id, status: "published" },
      }),
      prisma.post.count({ where: { userId: session.user.id, status: "draft" } }),
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