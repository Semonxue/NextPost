// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { eq, isNull, count } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb, media } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "未授权" }, { status: 401 });
    const db = await getDb();
    const total = db.select({ count: count() }).from(media).where(isNull(media.thumbnailUrl)).get();
    return NextResponse.json({ count: total?.count ?? 0 });
  } catch (error) {
    console.error("检查缩略图失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "未授权" }, { status: 401 });
    const { force } = (await request.json()) as { force?: boolean };
    const db = await getDb();
    const items = force ? db.select().from(media).all() : db.select().from(media).where(isNull(media.thumbnailUrl)).all();
    let processed = 0;
    for (const item of items) {
      try {
        db.update(media).set({ thumbnailUrl: item.url }).where(eq(media.id, item.id)).run();
        processed++;
      } catch { /* skip */ }
    }
    return NextResponse.json({ processed, total: items.length });
  } catch (error) {
    console.error("生成缩略图失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}