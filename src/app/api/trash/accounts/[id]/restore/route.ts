// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { eq, and, isNotNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb, account } from "@/lib/db";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "未授权" }, { status: 401 });
    const { id } = await params;
    const db = getDb();
    const acct = await db.select().from(account).where(and(eq(account.id, id), eq(account.userId, session.user.id), isNotNull(account.deletedAt))).get();
    if (!acct) return NextResponse.json({ error: "账号不存在或未删除" }, { status: 404 });
    db.update(account).set({ deletedAt: null, deletedBy: null, deleteNote: null }).where(eq(account.id, id)).run();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("恢复账号失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}