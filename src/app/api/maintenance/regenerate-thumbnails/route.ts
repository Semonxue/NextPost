import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { promises as fs } from "fs";
import path from "path";

// 缩略图生成配置
const THUMBNAIL_SIZE = 60;
const THUMBNAIL_QUALITY = 70;

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    // 获取所有有媒体的帖子
    const postsWithMedia = await prisma.post.findMany({
      where: {
        userId: session.user.id,
        deletedAt: null,
      },
      select: {
        id: true,
        mediaUrls: true
      }
    });

    // 过滤并解析有媒体文件的帖子
    const postsWithValidMedia = postsWithMedia.filter(post => {
      try {
        const urls = JSON.parse(post.mediaUrls || "[]");
        return Array.isArray(urls) && urls.length > 0;
      } catch {
        return false;
      }
    });

    // 统计信息
    let processed = 0;
    let skipped = 0;
    let failed = 0;

    for (const post of postsWithValidMedia) {
      let mediaUrls: string[] = [];
      try {
        mediaUrls = JSON.parse(post.mediaUrls || "[]");
      } catch {
        continue;
      }

      const thumbnailMap = new Map<string, string>(); // 存储 mediaUrl -> thumbnailUrl 映射

      for (const mediaUrl of mediaUrls) {
        // 检查是否已有缩略图文件（避免重复生成）
        const thumbPath = getThumbPath(mediaUrl);
        if (thumbPath) {
          try {
            await fs.access(thumbPath);
            // 缩略图已存在，记录路径
            thumbnailMap.set(mediaUrl, getThumbnailUrl(mediaUrl));
            skipped++;
            continue;
          } catch {
            // 文件不存在，继续生成
          }
        }

        try {
          // 获取实际文件路径
          const filePath = getFilePath(mediaUrl);
          if (!filePath) {
            failed++;
            continue;
          }
          
          // 检查文件是否存在
          await fs.access(filePath);
          
          // 读取文件并生成缩略图
          const imageBuffer = await fs.readFile(filePath);
          const thumbnail = await generateThumbnailFromBuffer(imageBuffer);
          
          // 保存缩略图
          if (thumbPath) {
            await fs.writeFile(thumbPath, thumbnail);
            thumbnailMap.set(mediaUrl, getThumbnailUrl(mediaUrl));
            processed++;
          }
        } catch (err) {
          console.warn(`处理失败: ${mediaUrl}`, err);
          failed++;
        }
      }

      // 更新数据库中的缩略图记录（只更新有媒体的文件）
      if (thumbnailMap.size > 0) {
        const thumbnails: string[] = mediaUrls.map(url => thumbnailMap.get(url) || "");
        
        await prisma.post.update({
          where: { id: post.id },
          data: { mediaThumbnails: JSON.stringify(thumbnails) }
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      skipped,
      failed,
      total: processed + skipped + failed,
      message: `成功处理 ${processed} 个，跳过 ${skipped} 个已有文件，失败 ${failed} 个`
    });
  } catch (error) {
    console.error("重新生成缩略图失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

/**
 * 根据 mediaUrl 获取实际文件路径
 */
function getFilePath(mediaUrl: string): string | null {
  let relativePath: string;
  
  if (mediaUrl.startsWith("/api/uploads/")) {
    relativePath = mediaUrl.replace(/^\/api\//, "/");
  } else if (mediaUrl.startsWith("/uploads/")) {
    relativePath = mediaUrl;
  } else if (mediaUrl.includes("/api/uploads/")) {
    const match = mediaUrl.match(/\/api\/(uploads\/.*)$/);
    if (match) {
      relativePath = "/" + match[1];
    } else {
      return null;
    }
  } else {
    return null;
  }
  
  return path.join(process.cwd(), relativePath);
}

/**
 * 根据 mediaUrl 获取缩略图文件路径
 */
function getThumbPath(mediaUrl: string): string | null {
  const filePath = getFilePath(mediaUrl);
  return filePath ? filePath + ".thumb.webp" : null;
}

/**
 * 根据 mediaUrl 获取缩略图 URL（完整的可访问路径）
 */
function getThumbnailUrl(mediaUrl: string): string {
  // 生成完整的可访问路径（带 /api 前缀）
  if (mediaUrl.startsWith("/api/uploads/")) {
    return mediaUrl + ".thumb.webp";
  } else if (mediaUrl.startsWith("/uploads/")) {
    return "/api" + mediaUrl + ".thumb.webp";
  } else if (mediaUrl.includes("/api/uploads/")) {
    const match = mediaUrl.match(/(\/api\/uploads\/.*)$/);
    return match ? match[1] + ".thumb.webp" : "";
  }
  return "";
}

/**
 * 从 Buffer 生成缩略图
 */
async function generateThumbnailFromBuffer(
  imageBuffer: Buffer,
  maxSize: number = THUMBNAIL_SIZE,
  quality: number = THUMBNAIL_QUALITY
): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  
  const resized = await sharp(imageBuffer)
    .resize(maxSize, maxSize, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality })
    .toBuffer();

  if (resized.length > 30 * 1024 && quality > 20) {
    return generateThumbnailFromBuffer(imageBuffer, maxSize, quality - 10);
  }

  return resized;
}