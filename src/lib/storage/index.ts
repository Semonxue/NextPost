import { localStorage, LocalStorageEngine } from './local';
import { R2StorageEngine } from './r2';
import { StorageEngine, StorageEngineType, UploadResult } from './types';

// R2 存储引擎单例
let r2StorageInstance: R2StorageEngine | null = null;

// OpenNext Cloudflare adapter 在 init.js 中通过 AsyncLocalStorage
// 把 CF env（包含 R2/MEDIA 绑定）存在 globalThis[Symbol.for("__cloudflare-context__")]
// 参考: node_modules/@opennextjs/cloudflare/dist/cli/templates/init.js
const CLOUDFLARE_CONTEXT_KEY = '__cloudflare-context__';

/**
 * 获取 R2 存储引擎实例
 * - Cloudflare Workers: 直接读 globalThis 上的 CF context，从 env.MEDIA 拿 R2 bucket
 * - 本地开发: globalThis 上没有 CF context，返回 null，由调用方 fallback
 */
function getR2Engine(): R2StorageEngine | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx = (globalThis as any)[CLOUDFLARE_CONTEXT_KEY];
  if (ctx && typeof ctx === 'object' && ctx !== null) {
    const env = ctx.env as Record<string, unknown> | undefined;
    const media = env?.MEDIA as R2Bucket | undefined;
    if (media) {
      if (!r2StorageInstance) {
        const bucketName = process.env.R2_BUCKET_NAME || 'nextpost-media';
        r2StorageInstance = new R2StorageEngine(media, bucketName);
      }
      return r2StorageInstance;
    }
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
