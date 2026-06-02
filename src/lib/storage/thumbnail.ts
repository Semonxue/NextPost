import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';

// 缩略图配置
const THUMBNAIL_SIZE = 60; // 缩略图尺寸（最大边）
const THUMBNAIL_QUALITY = 70; // JPEG 质量

/**
 * 生成缩略图
 * @param imageBuffer 原始图片 Buffer
 * @param maxSize 最大尺寸
 * @returns 缩略图 Buffer（WebP 格式，小于 30KB）
 */
export async function generateThumbnail(
  imageBuffer: Buffer,
  maxSize: number = THUMBNAIL_SIZE,
  quality: number = THUMBNAIL_QUALITY
): Promise<Buffer> {
  const resized = await sharp(imageBuffer)
    .resize(maxSize, maxSize, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality })
    .toBuffer();

  // 如果还是太大，递归降低质量
  if (resized.length > 30 * 1024 && quality > 20) {
    return generateThumbnail(imageBuffer, maxSize, quality - 10);
  }

  return resized;
}

/**
 * 检查图片是否需要生成缩略图
 * @param filePath 文件路径
 * @returns 是否需要生成
 */
export async function needsThumbnail(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    // 如果文件小于 30KB，不需要生成
    return stat.size > 30 * 1024;
  } catch {
    return false;
  }
}