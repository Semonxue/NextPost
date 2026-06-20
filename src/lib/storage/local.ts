import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { StorageEngine, UploadResult } from './types';
import { generateThumbnail } from './thumbnail';

// 确保目录存在
async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

// 本地存储引擎
export class LocalStorageEngine implements StorageEngine {
  // baseDir 和 baseUrl 不再在 constructor 里通过 process.cwd() 计算
  // 这样可以避免 Turbopack 在模块加载时追踪 uploads/ 目录
  private readonly baseUrl = '/api/uploads';

  // 每个方法内部用 path.join(process.cwd(), ...) — Turbopack 不会在加载时追踪
  private getBaseDir(): string {
    return path.join(process.cwd(), 'uploads');
  }

  async upload(file: Buffer, filename: string, mimeType: string): Promise<string> {
    // 生成唯一文件名
    const ext = path.extname(filename);
    const uniqueName = `${uuidv4()}${ext}`;
    const relativePath = `${new Date().toISOString().slice(0, 10)}/${uniqueName}`;
    
    // 确保目录存在
    const baseDir = this.getBaseDir();
    const dirPath = path.join(baseDir, path.dirname(relativePath));
    await ensureDir(dirPath);
    
    // 写入文件
    const filePath = path.join(baseDir, relativePath);
    await fs.writeFile(filePath, file);
    
    return this.getUrl(relativePath);
  }

  /**
   * 上传图片并生成缩略图
   * @returns 上传结果，包含 originalUrl 和 thumbnailUrl
   */
  async uploadWithThumbnail(file: Buffer, filename: string, mimeType: string, _thumbnailBase64?: string): Promise<{
    url: string;
    thumbnailUrl: string;
    path: string;
    filename: string;
    mimeType: string;
    size: number;
    thumbnailSize: number;
  }> {
    // 生成唯一文件名
    const ext = path.extname(filename);
    const baseName = path.basename(filename, ext);
    const uniqueName = `${uuidv4()}${ext}`;
    const relativePath = `${new Date().toISOString().slice(0, 10)}/${uniqueName}`;
    const thumbnailPath = `${new Date().toISOString().slice(0, 10)}/${baseName}_thumb.webp`;
    
    const baseDir = this.getBaseDir();
    // 确保目录存在
    const dirPath = path.join(baseDir, path.dirname(relativePath));
    await ensureDir(dirPath);
    
    // 写入原文件
    const filePath = path.join(baseDir, relativePath);
    await fs.writeFile(filePath, file);
    
    // 生成并写入缩略图（仅对图片生成）
    const isImage = mimeType.startsWith('image/');
    let thumbnailBuffer: Buffer | null = null;
    
    if (isImage) {
      try {
        thumbnailBuffer = await generateThumbnail(file);
        const thumbPath = path.join(baseDir, thumbnailPath);
        await fs.writeFile(thumbPath, thumbnailBuffer);
      } catch (err) {
        console.error('生成缩略图失败:', err);
      }
    }
    
    return {
      url: this.getUrl(relativePath),
      thumbnailUrl: thumbnailBuffer ? this.getUrl(thumbnailPath) : this.getUrl(relativePath),
      path: relativePath,
      filename,
      mimeType,
      size: file.length,
      thumbnailSize: thumbnailBuffer?.length || 0,
    };
  }

  async delete(url: string): Promise<void> {
    const relativePath = this.getRelativePath(url);
    if (!relativePath) return;
    
    const filePath = path.join(this.getBaseDir(), relativePath);
    try {
      await fs.unlink(filePath);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * 获取文件访问 URL（用于媒体预览）
   */
  getUrl(relativePath: string): string {
    return `/api/uploads/${relativePath}`;
  }
  
  /**
   * 获取相对路径（用于内部文件操作）
   */
  getRelativePath(url: string): string | null {
    if (url.startsWith("/api/uploads/")) {
      return url.slice("/api/uploads/".length);
    }
    return null;
  }

  async exists(relativePath: string): Promise<boolean> {
    const filePath = path.join(this.getBaseDir(), relativePath);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

// 创建并导出默认实例
export const localStorage = new LocalStorageEngine();
