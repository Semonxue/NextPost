// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { getDb, user } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "未授权" }, { status: 401 });
    const db = getDb();
    const u = await db.select().from(user).where(eq(user.id, session.user.id)).get();
    if (!u) return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    return NextResponse.json({ username: u.username, email: u.email, aiProvider: u.aiProvider, aiModel: u.aiModel });
  } catch (error) {
    console.error("获取设置失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "未授权" }, { status: 401 });
    const { email, currentPassword, newPassword, aiProvider, aiApiKey, aiModel } = await request.json();
    const db = getDb();
    const u = await db.select().from(user).where(eq(user.id, session.user.id)).get();
    if (!u) return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    const updates = {};
    if (email !== undefined) updates.email = email;
    if (aiProvider !== undefined) updates.aiProvider = aiProvider;
    if (aiApiKey !== undefined) updates.aiApiKey = aiApiKey;
    if (aiModel !== undefined) updates.aiModel = aiModel;
    if (currentPassword && newPassword) {
      const valid = await bcrypt.compare(currentPassword, u.password);
      if (!valid) return NextResponse.json({ error: "当前密码不正确" }, { status: 400 });
      updates.password = await bcrypt.hash(newPassword, 10);
    }
    db.update(user).set(updates).where(eq(user.id, session.user.id)).run();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("更新设置失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
