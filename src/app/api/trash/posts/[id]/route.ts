// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { eq, and, isNotNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb, post } from "@/lib/db";
import { deleteFile } from "@/lib/storage";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "未授权" }, { status: 401 });
    const { id } = await params;
    const db = await getDb();
    const p = await db.select().from(post).where(and(eq(post.id, id), eq(post.userId, session.user.id), isNotNull(post.deletedAt))).get();
    if (!p) return NextResponse.json({ error: "帖子不存在或未删除" }, { status: 404 });
    const urls = JSON.parse(p.mediaUrls || "[]");
    for (const url of urls) { try { await deleteFile(url); } catch { /* ignore */ } }
    await db.delete(post).where(eq(post.id, id)).execute();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("永久删除帖子失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}