// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb, user, platform } from "@/lib/db";
import { REGISTERED_PLATFORMS } from "@/lib/platform";

export async function POST(request: NextRequest) {
  try {
    const { username, password, email } = await request.json();
    if (!username || !password) return NextResponse.json({ error: "用户名和密码不能为空" }, { status: 400 });
    const db = getDb();
    const existing = await db.select().from(user).where(eq(user.username, username)).get();
    if (existing) return NextResponse.json({ error: "用户名已存在" }, { status: 400 });
    const hashed = await bcrypt.hash(password, 10);
    const result = await db.insert(user).values({ username, password: hashed, email: email || null }).returning().get();
    for (const plat of REGISTERED_PLATFORMS) {
      const p = await db.select().from(platform).where(eq(platform.name, plat.key)).get();
      if (!p) db.insert(platform).values({ name: plat.key, icon: plat.icon }).run();
      else if (p.icon !== plat.icon) db.update(platform).set({ icon: plat.icon }).where(eq(platform.id, p.id)).run();
    }
    return NextResponse.json({ id: result.id, username: result.username, email: result.email });
  } catch (error) {
    console.error("注册错误:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
