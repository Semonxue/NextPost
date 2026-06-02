import { localStorage, LocalStorageEngine } from './local';
import { StorageEngine, StorageEngineType, UploadResult } from './types';

// 根据配置选择存储引擎
function getStorageEngine(): StorageEngine {
  const engineType = (process.env.STORAGE_ENGINE || 'local') as StorageEngineType;
  
  switch (engineType) {
    case 'local':
      return localStorage;
    case 's3':
      // TODO: 实现 S3 存储引擎
      throw new Error('S3 storage not implemented yet');
    case 'r2':
      // TODO: 实现 R2 存储引擎
      throw new Error('R2 storage not implemented yet');
    default:
      return localStorage;
  }
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

// 上传文件并生成缩略图（仅本地存储支持）
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
  if (localStorage instanceof LocalStorageEngine) {
    return localStorage.uploadWithThumbnail(file, filename, mimeType);
  }
  // 其他存储引擎回退到普通上传
  const url = await uploadFile(file, filename, mimeType);
  return {
    url: url.url,
    thumbnailUrl: url.url,
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
export type { StorageEngine, StorageEngineType, UploadResult } from './types';
