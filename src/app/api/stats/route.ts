import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { promises as fs } from "fs";
import path from "path";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    // 获取账号数量
    const accounts = await prisma.account.count({
      where: { userId: session.user.id, deletedAt: null }
    });

    // 获取帖子数量（排除回收站：帖子本身和关联账号都不在回收站）
    const posts = await prisma.post.count({
      where: { 
        userId: session.user.id, 
        deletedAt: null,
        account: { deletedAt: null }
      }
    });

    // 获取帖子状态分布
    const [draft, scheduled, published, failed] = await Promise.all([
      prisma.post.count({
        where: { userId: session.user.id, status: "draft", deletedAt: null, account: { deletedAt: null } }
      }),
      prisma.post.count({
        where: { userId: session.user.id, status: "scheduled", deletedAt: null, account: { deletedAt: null } }
      }),
      prisma.post.count({
        where: { userId: session.user.id, status: "published", deletedAt: null, account: { deletedAt: null } }
      }),
      prisma.post.count({
        where: { userId: session.user.id, status: "failed", deletedAt: null, account: { deletedAt: null } }
      }),
    ]);

    // 扫描服务端缩略图文件（uploads 目录下的 *.thumb.webp 文件）
    const uploadDir = path.join(process.cwd(), "uploads");
    let thumbnailCount = 0;
    let thumbnailSize = 0;
    
    const scanThumbnails = async (dirPath: string) => {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          if (entry.isDirectory()) {
            await scanThumbnails(fullPath);
          } else if (entry.name.endsWith(".thumb.webp")) {
            const stat = await fs.stat(fullPath);
            thumbnailSize += stat.size;
            thumbnailCount++;
          }
        }
      } catch {
        // 忽略无法访问的目录
      }
    };
    
    try {
      await scanThumbnails(uploadDir);
    } catch {
      // uploads 目录可能不存在
    }

    // 计算媒体统计 - 通过扫描实际文件（uploadDir 已在上面定义）
    let totalMediaSize = 0;
    let totalMediaCount = 0;
    let imagesCount = 0;
    let imagesSize = 0;
    let videosCount = 0;
    let videosSize = 0;

    // 图片和视频扩展名
    const imageExts = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".ico"];
    const videoExts = [".mp4", ".webm", ".mov", ".avi", ".mkv", ".flv", ".wmv"];

    // 递归扫描目录
    const scanDir = async (dirPath: string) => {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          if (entry.isDirectory()) {
            await scanDir(fullPath);
          } else {
            const ext = path.extname(entry.name).toLowerCase();
            const stat = await fs.stat(fullPath);
            
            // 跳过缩略图文件（服务端缩略图）
            if (entry.name.endsWith(".thumb.webp")) {
              // 不计入统计，因为这是服务端缩略图，不是用户上传的媒体
              continue;
            }
            // 图片
            else if (imageExts.includes(ext)) {
              totalMediaSize += stat.size;
              totalMediaCount++;
              imagesCount++;
              imagesSize += stat.size;
            } 
            // 视频
            else if (videoExts.includes(ext)) {
              totalMediaSize += stat.size;
              totalMediaCount++;
              videosCount++;
              videosSize += stat.size;
            }
          }
        }
      } catch (err) {
        // 忽略无法访问的目录
      }
    };

    try {
      await scanDir(uploadDir);
    } catch (err) {
      // uploads 目录可能不存在
    }

    // 按账号统计帖子（排除回收站中的帖子）
    const accountStats = await prisma.account.findMany({
      where: { userId: session.user.id, deletedAt: null },
      select: {
        id: true,
        name: true,
        posts: {
          where: { deletedAt: null },
          select: { id: true }
        }
      },
      orderBy: { name: "asc" }
    });

    const categories = accountStats.map(acc => ({
      name: acc.name,
      count: acc.posts.length
    }));

    return NextResponse.json({
      accounts,
      posts,
      postsByStatus: {
        draft,
        scheduled,
        published,
        failed
      },
      media: totalMediaCount,
      mediaStats: {
        totalSize: totalMediaSize,
        images: {
          count: imagesCount,
          size: imagesSize
        },
        videos: {
          count: videosCount,
          size: videosSize
        }
      },
      thumbnailStats: {
        count: thumbnailCount,
        size: thumbnailSize
      },
      categories
    });
  } catch (error) {
    console.error("获取统计失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}


