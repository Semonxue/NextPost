/// <reference types="@cloudflare/workers-types" />

/**
 * Cloudflare R2 存储引擎
 * 用于在 Cloudflare Pages Functions 中存储媒体文件
 */

import { v4 as uuidv4 } from 'uuid';
import { StorageEngine } from './types';

/**
 * R2 存储引擎
 */
export class R2StorageEngine implements StorageEngine {
  private bucket: R2Bucket;
  private bucketName: string;
  private bucketId: string;

  constructor(bucket: R2Bucket, bucketName: string = 'nextpost-media', bucketId?: string) {
    this.bucket = bucket;
    this.bucketName = bucketName;
    // R2 公开访问 URL 格式: https://pub-{bucket_id}.r2.dev/{path}
    // bucket_id 是 CF 后台分配的唯一 ID（不是 bucket 名字）
    // 优先读 R2_BUCKET_ID env var，否则从 bucket 名拼接（不一定准）
    this.bucketId = bucketId || process.env.R2_BUCKET_ID || bucketName;
  }
  
  /**
   * 上传文件到 R2
   */
  async upload(file: Buffer, filename: string, mimeType: string): Promise<string> {
    const ext = filename.split('.').pop() || '';
    const uniqueName = `${uuidv4()}.${ext}`;
    const key = `uploads/${new Date().toISOString().slice(0, 10)}/${uniqueName}`;
    
    await this.bucket.put(key, file, {
      httpMetadata: {
        contentType: mimeType,
      },
      customMetadata: {
        originalFilename: filename,
        uploadedAt: new Date().toISOString(),
      },
    });
    
    return this.getUrl(key);
  }
  
  /**
   * 上传文件并生成缩略图（云端处理）
   * 注意：Cloudflare Workers 环境中无法使用 Sharp，
   * 缩略图需要在上传前在客户端预处理，或使用 Cloudflare Images
   */
  async uploadWithThumbnail(
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
    // 上传原文件
    const url = await this.upload(file, filename, mimeType);
    const key = this.getKeyFromUrl(url) || '';
    
    // R2 不支持在服务端生成缩略图
    // 返回相同 URL，客户端可使用 next/image 组件进行图片优化
    return {
      url,
      thumbnailUrl: url,
      path: key,
      filename,
      mimeType,
      size: file.length,
      thumbnailSize: 0,
    };
  }
  
  /**
   * 从 R2 删除文件
   */
  async delete(url: string): Promise<void> {
    const key = this.getKeyFromUrl(url);
    if (key) {
      await this.bucket.delete(key);
    }
  }
  
  /**
   * 获取文件的公开访问 URL
   * Cloudflare R2 需要通过 Workers 或自定义域名访问
   */
  getUrl(path: string): string {
    // 使用 Cloudflare R2 的公开访问 URL 格式
    // pub-{bucket_id}.r2.dev — bucket_id 是 CF 分配的唯一 ID，不是 bucket 名
    return `https://pub-${this.bucketId}.r2.dev/${path}`;
  }
  
  /**
   * 检查文件是否存在
   */
  async exists(path: string): Promise<boolean> {
    const key = this.getKeyFromUrl(path) || path;
    const object = await this.bucket.head(key);
    return object !== null;
  }
  
  /**
   * 从 URL 中提取 R2 key
   */
  private getKeyFromUrl(url: string): string | null {
    // 匹配 R2 公开访问 URL 格式
    const match = url.match(/https?:\/\/[^/]+\/(.+)/);
    return match ? match[1] : null;
  }
}

// 默认导出
export default R2StorageEngine;
