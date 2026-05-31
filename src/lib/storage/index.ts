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
