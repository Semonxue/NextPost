// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { eq, and, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb, account, post } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "未授权" }, { status: 401 });
    const { id } = await params;
    const db = getDb();
    const acct = await db.select().from(account).where(and(eq(account.id, id), eq(account.userId, session.user.id))).get();
    if (!acct) return NextResponse.json({ error: "账号不存在" }, { status: 404 });
    return NextResponse.json(acct);
  } catch (error) {
    console.error("获取账号详情失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "未授权" }, { status: 401 });
    const { id } = await params;
    const { name, handle, description, platformId } = await request.json();
    const db = getDb();
    const existing = await db.select().from(account).where(and(eq(account.id, id), eq(account.userId, session.user.id))).get();
    if (!existing) return NextResponse.json({ error: "账号不存在" }, { status: 404 });
    const updates = { updatedAt: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (handle !== undefined) updates.handle = handle;
    if (description !== undefined) updates.description = description;
    if (platformId !== undefined) updates.platformId = platformId;
    db.update(account).set(updates).where(eq(account.id, id)).run();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("更新账号失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "未授权" }, { status: 401 });
    const { id } = await params;
    const db = getDb();
    const existing = await db.select().from(account).where(and(eq(account.id, id), eq(account.userId, session.user.id))).get();
    if (!existing) return NextResponse.json({ error: "账号不存在" }, { status: 404 });
    db.update(account).set({ deletedAt: new Date().toISOString(), deletedBy: "user" }).where(eq(account.id, id)).run();
    db.update(post).set({ deletedAt: new Date().toISOString(), deletedBy: "user" }).where(and(eq(post.accountId, id), isNull(post.deletedAt))).run();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除账号失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
