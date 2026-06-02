import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deleteFile } from "@/lib/storage";
import { localStorage } from "@/lib/storage/local";
import path from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string }> }
) {
  try {
    const { path: pathParam } = await params;
    const relativePath = decodeURIComponent(pathParam);
    const filePath = path.join(process.cwd(), "uploads", relativePath);
    
    // 读取文件
    const file = await import("fs").then(fs => fs.promises.readFile(filePath));
    
    // 获取文件扩展名来确定 MIME 类型
    const ext = path.extname(relativePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".ogg": "video/ogg",
      ".mov": "video/quicktime",
    };
    
    const contentType = mimeTypes[ext] || "application/octet-stream";
    
    return new NextResponse(file, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (error) {
    console.error("读取文件失败:", error);
    return NextResponse.json({ error: "文件未找到" }, { status: 404 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { path: pathParam } = await params;
    const url = `/uploads/${decodeURIComponent(pathParam)}`;
    
    await deleteFile(url);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除文件失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
