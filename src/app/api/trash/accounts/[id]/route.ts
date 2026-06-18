// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { eq, and, isNotNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb, account, post } from "@/lib/db";
import { deleteFile } from "@/lib/storage";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "未授权" }, { status: 401 });
    const { id } = await params;
    const db = await getDb();
    const acct = await db.select().from(account).where(and(eq(account.id, id), eq(account.userId, session.user.id), isNotNull(account.deletedAt))).get();
    if (!acct) return NextResponse.json({ error: "账号不存在或未删除" }, { status: 404 });
    const posts = db.select().from(post).where(eq(post.accountId, id)).all();
    for (const p of posts) {
      const urls = JSON.parse(p.mediaUrls || "[]");
      for (const url of urls) { try { await deleteFile(url); } catch { /* ignore */ } }
    }
    db.delete(post).where(eq(post.accountId, id)).run();
    db.delete(account).where(eq(account.id, id)).run();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("永久删除账号失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}