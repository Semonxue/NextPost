import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { deleteFile } from "@/lib/storage";

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

/**
 * DELETE /api/trash
 * 
 * 全部删除：永久删除当前用户回收站中的所有数据
 * 返回格式：{ success, deletedPosts, deletedAccounts }
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    // 获取回收站中的所有帖子和账号
    const [trashedPosts, trashedAccounts] = await Promise.all([
      prisma.post.findMany({
        where: { userId: session.user.id, deletedAt: { not: null } },
        select: { id: true, mediaUrls: true },
      }),
      prisma.account.findMany({
        where: { userId: session.user.id, deletedAt: { not: null } },
        select: { id: true },
      }),
    ]);

    // 收集所有需要清理的媒体文件 URL
    const mediaUrlsToDelete: string[] = [];
    for (const post of trashedPosts) {
      if (post.mediaUrls) {
        try {
          const urls = JSON.parse(post.mediaUrls) as string[];
          for (const url of urls) {
            // 跳过 data: 协议和空 URL
            if (url && !url.startsWith("data:")) {
              mediaUrlsToDelete.push(url);
            }
          }
        } catch {
          // JSON 解析错误，忽略该条
        }
      }
    }

    // 并行删除所有帖子（级联删除关联数据）
    await prisma.post.deleteMany({
      where: { userId: session.user.id, deletedAt: { not: null } },
    });

    // 删除所有账号（级联删除关联数据）
    await prisma.account.deleteMany({
      where: { userId: session.user.id, deletedAt: { not: null } },
    });

    // 异步清理媒体文件（不阻塞主流程）
    for (const url of mediaUrlsToDelete) {
      deleteFile(url).catch((err) => console.error(`清理媒体文件失败: ${url}`, err));
    }

    return NextResponse.json({
      success: true,
      deletedPosts: trashedPosts.length,
      deletedAccounts: trashedAccounts.length,
    });
  } catch (error) {
    console.error("清空回收站失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
