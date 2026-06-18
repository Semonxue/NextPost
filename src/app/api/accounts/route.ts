// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { eq, and, isNull, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb, account, platform } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "未授权" }, { status: 401 });
    const db = getDb();
    const rows = await db.select().from(account).leftJoin(platform, eq(account.platformId, platform.id)).where(and(eq(account.userId, session.user.id), isNull(account.deletedAt))).orderBy(desc(account.createdAt)).all();
    return NextResponse.json(rows.map(r => ({ ...r.account, platform: r.platform })));
  } catch (error) {
    console.error("获取账号失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "未授权" }, { status: 401 });
    const { name, handle, description, platformId } = await request.json();
    if (!name || !handle) return NextResponse.json({ error: "名称和handle不能为空" }, { status: 400 });
    if (!platformId) return NextResponse.json({ error: "请选择平台" }, { status: 400 });
    const db = getDb();
    const result = await db.insert(account).values({ userId: session.user.id, platformId, name, handle, description: description || null }).returning().get();
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("创建账号失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
