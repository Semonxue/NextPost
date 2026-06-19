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
   * @param thumbnailBase64 可选，客户端预生成的 base64 缩略图（如 canvas 生成的预览图）
   */
  async uploadWithThumbnail(
    file: Buffer,
    filename: string,
    mimeType: string,
    thumbnailBase64?: string
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

    // 如果有客户端预生成的缩略图 base64，上传到 R2
    if (thumbnailBase64) {
      const thumbnailUrl = await this.uploadThumbnail(thumbnailBase64, key);
      return {
        url,
        thumbnailUrl,
        path: key,
        filename,
        mimeType,
        size: file.length,
        thumbnailSize: Buffer.from(thumbnailBase64.split(',')[1] || '', 'base64').length,
      };
    }

    // 没有缩略图时返回原图 URL
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
   * 将 base64 图片数据上传为 R2 中的缩略图
   * 存储路径 = originalKey 替换文件名部分加 -thumb 前缀
   * 例: uploads/2026-06-20/abc.png → uploads/2026-06-20/abc-thumb.png
   */
  async uploadThumbnail(base64Data: string, originalKey: string): Promise<string> {
    // base64 格式: "data:image/jpeg;base64,/9j/4AAQ..."
    const parts = base64Data.match(/^data:([^;]+);base64,(.+)$/);
    if (!parts) {
      // 非标准 base64，直接用原图
      return this.getUrl(originalKey);
    }
    const mimeType = parts[1];
    const base64Content = parts[2];
    const buffer = Buffer.from(base64Content, 'base64');

    // 构造缩略图 key：把文件名部分加 -thumb
    const thumbKey = originalKey.replace(/(\.[^.]+)$/, '-thumb$1');
    await this.bucket.put(thumbKey, buffer, {
      httpMetadata: { contentType: mimeType },
      customMetadata: { originalKey, isThumbnail: 'true' },
    });

    return this.getUrl(thumbKey);
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
