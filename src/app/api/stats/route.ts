// @ts-nocheck
import { NextResponse } from "next/server";
import { eq, and, isNull, count } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb, post, account } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "未授权" }, { status: 401 });
    const db = getDb();
    const totalPosts = db.select({ count: count() }).from(post).where(and(eq(post.userId, session.user.id), isNull(post.deletedAt))).get();
    const draftPosts = db.select({ count: count() }).from(post).where(and(eq(post.userId, session.user.id), eq(post.status, "draft"), isNull(post.deletedAt))).get();
    const scheduledPosts = db.select({ count: count() }).from(post).where(and(eq(post.userId, session.user.id), eq(post.status, "scheduled"), isNull(post.deletedAt))).get();
    const publishedPosts = db.select({ count: count() }).from(post).where(and(eq(post.userId, session.user.id), eq(post.status, "published"), isNull(post.deletedAt))).get();
    const totalAccounts = db.select({ count: count() }).from(account).where(and(eq(account.userId, session.user.id), isNull(account.deletedAt))).get();
    return NextResponse.json({
      totalPosts: totalPosts?.count ?? 0,
      draftPosts: draftPosts?.count ?? 0,
      scheduledPosts: scheduledPosts?.count ?? 0,
      publishedPosts: publishedPosts?.count ?? 0,
      totalAccounts: totalAccounts?.count ?? 0,
    });
  } catch (error) {
    console.error("获取统计失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}