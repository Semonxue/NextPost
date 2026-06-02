import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadFileWithThumbnail } from "@/lib/storage";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    
    if (!file) {
      return NextResponse.json({ error: "请选择文件" }, { status: 400 });
    }

    // 检查文件大小（10MB）
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "文件大小不能超过 10MB" }, { status: 400 });
    }

    // 检查文件类型
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4", "video/webm"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "不支持的文件类型" }, { status: 400 });
    }

    // 读取文件并上传（自动生成缩略图）
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadFileWithThumbnail(buffer, file.name, file.type);

    return NextResponse.json({
      url: result.url,
      thumbnailUrl: result.thumbnailUrl,
      filename: result.filename,
      mimeType: result.mimeType,
      size: result.size,
      thumbnailSize: result.thumbnailSize,
    });
  } catch (error) {
    console.error("上传文件失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
