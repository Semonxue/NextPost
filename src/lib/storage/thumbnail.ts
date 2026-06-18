import { promises as fs } from 'fs';
import { THUMBNAIL_SIZE, THUMBNAIL_QUALITY, THUMBNAIL_MIN_SIZE, THUMBNAIL_MAX_SIZE } from '@/lib/config';

/**
 * Sharp 缩略图生成器
 * 仅在支持 Sharp 的环境中可用（Node.js）
 * Cloudflare Workers 环境会回退到禁用缩略图
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sharpModule: any = null;

async function getSharp() {
  if (sharpModule === null) {
    try {
      // 动态导入 Sharp
      sharpModule = await import('sharp');
    } catch {
      // Sharp 不可用（如 Cloudflare Workers）
      console.warn('[Thumbnail] Sharp not available, thumbnail generation disabled');
      sharpModule = false;
      return null;
    }
  }
  return sharpModule || null;
}

/**
 * 检查当前环境是否支持 Sharp
 */
export async function isSharpAvailable(): Promise<boolean> {
  const sharp = await getSharp();
  return sharp !== null;
}

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
  const sharp = await getSharp();
  
  if (!sharp) {
    // Sharp 不可用时，返回原图
    console.warn('[Thumbnail] Sharp not available, returning original image');
    return imageBuffer;
  }
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sharpInstance = (sharp as any).default ? (sharp as any).default(imageBuffer) : sharp(imageBuffer);
  
  const resized = await sharpInstance
    .resize(maxSize, maxSize, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality })
    .toBuffer();

  // 如果还是太大，递归降低质量
  if (resized.length > THUMBNAIL_MAX_SIZE && quality > 20) {
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
    return stat.size > THUMBNAIL_MIN_SIZE;
  } catch {
    return false;
  }
}
