import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { StorageEngine, UploadResult } from './types';

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
  private baseDir: string;
  private baseUrl: string;

  constructor(baseDir: string = './uploads', baseUrl: string = '/api/uploads') {
    this.baseDir = path.resolve(process.cwd(), baseDir);
    this.baseUrl = baseUrl;
  }

  async upload(file: Buffer, filename: string, mimeType: string): Promise<string> {
    // 生成唯一文件名
    const ext = path.extname(filename);
    const uniqueName = `${uuidv4()}${ext}`;
    const relativePath = `${new Date().toISOString().slice(0, 10)}/${uniqueName}`;
    
    // 确保目录存在
    const dirPath = path.join(this.baseDir, path.dirname(relativePath));
    await ensureDir(dirPath);
    
    // 写入文件
    const filePath = path.join(this.baseDir, relativePath);
    await fs.writeFile(filePath, file);
    
    return this.getUrl(relativePath);
  }

  async delete(url: string): Promise<void> {
    const relativePath = this.getRelativePath(url);
    if (!relativePath) return;
    
    const filePath = path.join(this.baseDir, relativePath);
    try {
      await fs.unlink(filePath);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  getUrl(relativePath: string): string {
    return `${this.baseUrl}/${relativePath}`;
  }

  async exists(relativePath: string): Promise<boolean> {
    const filePath = path.join(this.baseDir, relativePath);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private getRelativePath(url: string): string | null {
    if (url.startsWith(this.baseUrl)) {
      return url.slice(this.baseUrl.length + 1);
    }
    return null;
  }
}

// 创建并导出默认实例
export const localStorage = new LocalStorageEngine();
