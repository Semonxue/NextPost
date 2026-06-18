// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { eq, and, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb, post, account, platform } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "未授权" }, { status: 401 });
    const { id } = await params;
    const db = await getDb();
    const rows = await db.select().from(post).leftJoin(account, eq(post.accountId, account.id)).leftJoin(platform, eq(account.platformId, platform.id)).where(and(eq(post.id, id), eq(post.userId, session.user.id), isNull(post.deletedAt))).all();
    const p = rows[0];
    if (!p) return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
    return NextResponse.json({ ...p.Post, account: p.Account ? { ...p.Account, platform: p.Platform } : null });
  } catch (error) {
    console.error("获取帖子详情失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "未授权" }, { status: 401 });
    const { id } = await params;
    const { content, title, mediaUrls, mediaThumbnails, scheduledTime, timezone, status, accountId } = await request.json();
    const db = await getDb();
    const existing = await db.select().from(post).where(and(eq(post.id, id), eq(post.userId, session.user.id))).get();
    if (!existing) return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
    const updates = { updatedAt: new Date().toISOString() };
    if (content !== undefined) updates.content = content;
    if (title !== undefined) updates.title = title;
    if (mediaUrls !== undefined) updates.mediaUrls = JSON.stringify(mediaUrls);
    if (mediaThumbnails !== undefined) updates.mediaThumbnails = JSON.stringify(mediaThumbnails);
    if (scheduledTime !== undefined) updates.scheduledTime = scheduledTime;
    if (timezone !== undefined) updates.timezone = timezone;
    if (status !== undefined) updates.status = status;
    if (accountId !== undefined) updates.accountId = accountId;
    await db.update(post).set(updates).where(eq(post.id, id)).execute();
    const rows = await db.select().from(post).leftJoin(account, eq(post.accountId, account.id)).leftJoin(platform, eq(account.platformId, platform.id)).where(eq(post.id, id)).all();
    const p = rows[0];
    return NextResponse.json(p ? { ...p.Post, account: p.Account ? { ...p.Account, platform: p.Platform } : null } : null);
  } catch (error) {
    console.error("更新帖子失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "未授权" }, { status: 401 });
    const { id } = await params;
    const db = await getDb();
    const existing = await db.select().from(post).where(and(eq(post.id, id), eq(post.userId, session.user.id))).get();
    if (!existing) return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
    await db.update(post).set({ deletedAt: new Date().toISOString(), deletedBy: "user" }).where(eq(post.id, id)).execute();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除帖子失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
