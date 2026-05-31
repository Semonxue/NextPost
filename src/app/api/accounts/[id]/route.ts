import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { id } = await params;
    const { name, handle, description } = await request.json();

    // 验证账号归属
    const existingAccount = await prisma.account.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existingAccount) {
      return NextResponse.json({ error: "账号不存在" }, { status: 404 });
    }

    const account = await prisma.account.update({
      where: { id },
      data: {
        name: name || existingAccount.name,
        handle: handle ? handle.replace("@", "") : existingAccount.handle,
        description: description !== undefined ? description : existingAccount.description,
      },
      include: { platform: true },
    });

    return NextResponse.json(account);
  } catch (error) {
    console.error("更新账号失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { id } = await params;

    // 验证账号归属
    const existingAccount = await prisma.account.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existingAccount) {
      return NextResponse.json({ error: "账号不存在" }, { status: 404 });
    }

    await prisma.account.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除账号失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}