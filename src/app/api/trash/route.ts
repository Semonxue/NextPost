import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * GET /api/trash
 *
 * 列出当前用户所有已软删除的 Post 和 Account
 * 返回格式：{ posts, accounts, totalPosts, totalAccounts }
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const [posts, accounts] = await Promise.all([
      prisma.post.findMany({
        where: {
          userId: session.user.id,
          deletedAt: { not: null },
        },
        include: { account: { include: { platform: true } } },
        orderBy: { deletedAt: "desc" },
      }),
      prisma.account.findMany({
        where: {
          userId: session.user.id,
          deletedAt: { not: null },
        },
        include: { platform: true },
        orderBy: { deletedAt: "desc" },
      }),
    ]);

    return NextResponse.json({
      posts,
      accounts,
      totalPosts: posts.length,
      totalAccounts: accounts.length,
    });
  } catch (error) {
    console.error("获取回收站列表失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
