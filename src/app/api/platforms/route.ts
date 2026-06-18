// @ts-nocheck
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb, platform } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "未授权" }, { status: 401 });
    const db = await getDb();
    const platforms = db.select().from(platform).all();
    return NextResponse.json(platforms);
  } catch (error) {
    console.error("获取平台失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}