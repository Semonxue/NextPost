import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { REGISTERED_PLATFORMS } from "@/lib/platform";

export async function POST(request: NextRequest) {
  try {
    const { username, password, email } = await request.json() as { username?: string; password?: string; email?: string };

    if (!username || !password) {
      return NextResponse.json(
        { error: "用户名和密码不能为空" },
        { status: 400 }
      );
    }

    // 检查用户是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "用户名已存在" },
        { status: 400 }
      );
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建用户
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        email: email || null,
      },
    });

    // 确保所有已注册平台存在（从 REGISTERED_PLATFORMS 派生）
    for (const platform of REGISTERED_PLATFORMS) {
      await prisma.platform.upsert({
        where: { name: platform.key },
        update: { icon: platform.icon },
        create: { name: platform.key, icon: platform.icon },
      });
    }

    return NextResponse.json({
      id: user.id,
      username: user.username,
      email: user.email,
    });
  } catch (error) {
    console.error("注册错误:", error);
    return NextResponse.json(
      { error: "服务器错误" },
      { status: 500 }
    );
  }
}