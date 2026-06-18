// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb, account, platformConfig } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "未授权" }, { status: 401 });
    const { id } = await params;
    const db = await getDb();
    const acct = await db.select().from(account).where(and(eq(account.id, id), eq(account.userId, session.user.id))).get();
    if (!acct) return NextResponse.json({ error: "账号不存在" }, { status: 404 });
    const config = await db.select().from(platformConfig).where(eq(platformConfig.platformId, acct.platformId)).get();
    return NextResponse.json(config || null);
  } catch (error) {
    console.error("获取平台配置失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}