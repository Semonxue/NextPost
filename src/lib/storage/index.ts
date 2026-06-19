import { localStorage, LocalStorageEngine } from './local';
import { R2StorageEngine } from './r2';
import { StorageEngine, StorageEngineType, UploadResult } from './types';

// R2 存储引擎单例
let r2StorageInstance: R2StorageEngine | null = null;

/**
 * 获取 R2 存储引擎实例
 * 在 Cloudflare Pages Functions 中可用
 */
function getR2Engine(): R2StorageEngine | null {
  // 延迟初始化，只在需要时获取
  if (typeof globalThis.MEDIA !== 'undefined') {
    if (!r2StorageInstance) {
      const bucketName = process.env.R2_BUCKET_NAME || 'nextpost-media';
      const bucketId = process.env.R2_BUCKET_ID;
      r2StorageInstance = new R2StorageEngine(
        globalThis.MEDIA as unknown as R2Bucket,
        bucketName,
        bucketId
      );
    }
    return r2StorageInstance;
  }
  return null;
}

/**
 * 获取当前配置的存储引擎
 */
function getStorageEngine(): StorageEngine {
  const engineType = (process.env.STORAGE_ENGINE || 'local') as StorageEngineType;
  
  switch (engineType) {
    case 'local':
      return localStorage;
    case 'r2':
      // 尝试获取 R2 引擎
      const r2Engine = getR2Engine();
      if (r2Engine) {
        return r2Engine;
      }
      // 如果在非 CF 环境中，回退到本地存储
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Storage] R2 not available in local development, falling back to local storage');
        return localStorage;
      }
      throw new Error('R2 storage not configured');
    case 's3':
      // TODO: 实现 S3 存储引擎
      throw new Error('S3 storage not implemented yet');
    default:
      return localStorage;
  }
}

/**
 * 检查当前存储引擎类型
 */
export function getStorageEngineType(): StorageEngineType {
  return (process.env.STORAGE_ENGINE || 'local') as StorageEngineType;
}

/**
 * 检查是否使用 R2 存储
 */
export function isUsingR2(): boolean {
  return getStorageEngineType() === 'r2';
}

// 统一的上传接口
export async function uploadFile(
  file: Buffer,
  filename: string,
  mimeType: string
): Promise<UploadResult> {
  const engine = getStorageEngine();
  const url = await engine.upload(file, filename, mimeType);
  
  return {
    url,
    path: url, // 本地存储时 URL 即路径
    filename,
    mimeType,
    size: file.length,
  };
}

/**
 * 上传文件并生成缩略图
 * - 本地存储：使用 Sharp 生成缩略图
 * - R2 存储：不支持服务端缩略图，返回原图 URL
 */
export async function uploadFileWithThumbnail(
  file: Buffer,
  filename: string,
  mimeType: string
): Promise<{
  url: string;
  thumbnailUrl: string;
  path: string;
  filename: string;
  mimeType: string;
  size: number;
  thumbnailSize: number;
}> {
  const engineType = getStorageEngineType();
  
  // 本地存储支持缩略图
  if (engineType === 'local' && localStorage instanceof LocalStorageEngine) {
    return localStorage.uploadWithThumbnail(file, filename, mimeType);
  }
  
  // R2 不支持服务端缩略图
  const url = await uploadFile(file, filename, mimeType);
  return {
    url: url.url,
    thumbnailUrl: url.url, // R2 返回相同 URL
    path: url.path,
    filename: url.filename,
    mimeType: url.mimeType,
    size: url.size,
    thumbnailSize: 0,
  };
}

// 删除文件
export async function deleteFile(url: string): Promise<void> {
  const engine = getStorageEngine();
  await engine.delete(url);
}

// 获取文件访问 URL
export function getFileUrl(path: string): string {
  const engine = getStorageEngine();
  return engine.getUrl(path);
}

// 导出存储引擎实例和类型
export { localStorage } from './local';
export { R2StorageEngine } from './r2';
export type { StorageEngine, StorageEngineType, UploadResult } from './types';

// Cloudflare 运行时类型声明
declare global {
  // eslint-disable-next-line no-var
  var MEDIA: R2Bucket | undefined;
}
