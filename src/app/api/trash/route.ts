// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { eq, and, isNotNull, desc, count } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb, post, account, platform } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "未授权" }, { status: 401 });
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const postsLimit = parseInt(searchParams.get("postsLimit") || "50");
    const postsOffset = parseInt(searchParams.get("postsOffset") || "0");
    const accountsLimit = parseInt(searchParams.get("accountsLimit") || "50");
    const accountsOffset = parseInt(searchParams.get("accountsOffset") || "0");

    const postRows = db.select().from(post).leftJoin(account, eq(post.accountId, account.id)).leftJoin(platform, eq(account.platformId, platform.id)).where(and(eq(post.userId, session.user.id), isNotNull(post.deletedAt))).orderBy(desc(post.deletedAt)).limit(postsLimit).offset(postsOffset).all();
    const totalPosts = db.select({ count: count() }).from(post).where(and(eq(post.userId, session.user.id), isNotNull(post.deletedAt))).get();

    const accountRows = db.select().from(account).leftJoin(platform, eq(account.platformId, platform.id)).where(and(eq(account.userId, session.user.id), isNotNull(account.deletedAt))).orderBy(desc(account.deletedAt)).limit(accountsLimit).offset(accountsOffset).all();
    const totalAccounts = db.select({ count: count() }).from(account).where(and(eq(account.userId, session.user.id), isNotNull(account.deletedAt))).get();

    return NextResponse.json({
      posts: postRows.map(r => ({ ...r.post, account: r.account ? { ...r.account, platform: r.platform } : null })),
      accounts: accountRows.map(r => ({ ...r.account, platform: r.platform })),
      totalPosts: totalPosts?.count ?? 0,
      totalAccounts: totalAccounts?.count ?? 0,
    });
  } catch (error) {
    console.error("获取回收站失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}