// @ts-nocheck
import { NextResponse } from "next/server";
import { eq, and, isNull, count } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb, post } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "未授权" }, { status: 401 });
    const db = await getDb();
    const total = db.select({ count: count() }).from(post).where(and(eq(post.userId, session.user.id), isNull(post.deletedAt))).get();
    const scheduled = db.select({ count: count() }).from(post).where(and(eq(post.userId, session.user.id), eq(post.status, "scheduled"), isNull(post.deletedAt))).get();
    const draft = db.select({ count: count() }).from(post).where(and(eq(post.userId, session.user.id), eq(post.status, "draft"), isNull(post.deletedAt))).get();
    const published = db.select({ count: count() }).from(post).where(and(eq(post.userId, session.user.id), eq(post.status, "published"), isNull(post.deletedAt))).get();
    return NextResponse.json({ total: total?.count ?? 0, scheduled: scheduled?.count ?? 0, draft: draft?.count ?? 0, published: published?.count ?? 0 });
  } catch (error) {
    console.error("获取统计失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}