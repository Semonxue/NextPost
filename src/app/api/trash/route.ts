import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * GET /api/trash
 *
 * 列出当前用户所有已软删除的 Post 和 Account
 * 返回格式：{ posts, accounts, totalPosts, totalAccounts }
 * 支持分页参数：postsLimit, postsOffset, accountsLimit, accountsOffset
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const postsLimit = parseInt(searchParams.get("postsLimit") || "50");
    const postsOffset = parseInt(searchParams.get("postsOffset") || "0");
    const accountsLimit = parseInt(searchParams.get("accountsLimit") || "50");
    const accountsOffset = parseInt(searchParams.get("accountsOffset") || "0");

    const [postsResult, accountsResult] = await Promise.all([
      Promise.all([
        prisma.post.findMany({
          where: {
            userId: session.user.id,
            deletedAt: { not: null },
          },
          include: { account: { include: { platform: true } } },
          orderBy: { deletedAt: "desc" },
          take: postsLimit,
          skip: postsOffset,
        }),
        prisma.post.count({
          where: {
            userId: session.user.id,
            deletedAt: { not: null },
          },
        }),
      ]),
      Promise.all([
        prisma.account.findMany({
          where: {
            userId: session.user.id,
            deletedAt: { not: null },
          },
          include: { platform: true },
          orderBy: { deletedAt: "desc" },
          take: accountsLimit,
          skip: accountsOffset,
        }),
        prisma.account.count({
          where: {
            userId: session.user.id,
            deletedAt: { not: null },
          },
        }),
      ]),
    ]);

    const [posts, totalPosts] = postsResult;
    const [accounts, totalAccounts] = accountsResult;

    return NextResponse.json({
      posts,
      accounts,
      totalPosts,
      totalAccounts,
    });
  } catch (error) {
    console.error("获取回收站列表失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
