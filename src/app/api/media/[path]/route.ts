import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deleteFile } from "@/lib/storage";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { path } = await params;
    const url = `/uploads/${decodeURIComponent(path)}`;
    
    await deleteFile(url);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除文件失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
