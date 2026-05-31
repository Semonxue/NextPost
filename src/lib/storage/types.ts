// 存储引擎抽象接口
export interface StorageEngine {
  // 上传文件，返回公开访问URL
  upload(file: Buffer, filename: string, mimeType: string): Promise<string>;
  
  // 删除文件
  delete(url: string): Promise<void>;
  
  // 获取文件访问URL
  getUrl(path: string): string;
  
  // 检查文件是否存在
  exists(path: string): Promise<boolean>;
}

export interface UploadResult {
  url: string;
  path: string;
  filename: string;
  mimeType: string;
  size: number;
}

export type StorageEngineType = 'local' | 's3' | 'r2';
