/**
 * 缩略图生成测试
 * 
 * 测试 sharp 库生成缩略图的功能
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { generateThumbnail } from '@/lib/storage/thumbnail';

describe('缩略图生成', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = path.join(os.tmpdir(), 'nextpost-thumbnail-test-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
  });

  describe('generateThumbnail', () => {
    it('应该生成小于 30KB 的 WebP 缩略图', async () => {
      // 创建一个简单的测试图片（1x1 红色 PNG）
      // 这是一个最小的有效 PNG 文件
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, // IHDR length
        0x49, 0x48, 0x44, 0x52, // IHDR
        0x00, 0x00, 0x00, 0x01, // width
        0x00, 0x00, 0x00, 0x01, // height
        0x08, 0x02, 0x00, 0x00, 0x00, // bit depth, color type, etc
        0x90, 0x77, 0x53, 0xDE, // CRC
        0x00, 0x00, 0x00, 0x0C, // IDAT length
        0x49, 0x44, 0x41, 0x54, // IDAT
        0x08, 0xD7, 0x63, 0xF8, 0xFF, 0xFF, 0xFF, 0x00, // compressed data
        0x05, 0xFE, 0x02, 0xFE, // CRC
        0x00, 0x00, 0x00, 0x00, // IEND length
        0x49, 0x45, 0x4E, 0x44, // IEND
        0xAE, 0x42, 0x60, 0x82  // CRC
      ]);

      // 生成缩略图
      const thumbnailBuffer = await generateThumbnail(pngBuffer, 60, 70);

      // 验证结果
      expect(thumbnailBuffer).toBeInstanceOf(Buffer);
      expect(thumbnailBuffer.length).toBeLessThan(30 * 1024); // 小于 30KB
      expect(thumbnailBuffer.length).toBeGreaterThan(0);

      // 验证是 WebP 格式（RIFF...WEBP）
      const isWebP = thumbnailBuffer[0] === 0x52 && thumbnailBuffer[1] === 0x49 &&
                     thumbnailBuffer[2] === 0x46 && thumbnailBuffer[3] === 0x46 &&
                     thumbnailBuffer[8] === 0x57 && thumbnailBuffer[9] === 0x45 &&
                     thumbnailBuffer[10] === 0x42 && thumbnailBuffer[11] === 0x50;
      expect(isWebP).toBe(true);
    });

    it('应该支持自定义尺寸', async () => {
      // 使用与第一个测试相同的有效 PNG 数据
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, // IHDR length
        0x49, 0x48, 0x44, 0x52, // IHDR
        0x00, 0x00, 0x00, 0x01, // width
        0x00, 0x00, 0x00, 0x01, // height
        0x08, 0x02, 0x00, 0x00, 0x00, // bit depth, color type, etc
        0x90, 0x77, 0x53, 0xDE, // CRC
        0x00, 0x00, 0x00, 0x0C, // IDAT length
        0x49, 0x44, 0x41, 0x54, // IDAT
        0x08, 0xD7, 0x63, 0xF8, 0xFF, 0xFF, 0xFF, 0x00, // compressed data
        0x05, 0xFE, 0x02, 0xFE, // CRC
        0x00, 0x00, 0x00, 0x00, // IEND length
        0x49, 0x45, 0x4E, 0x44, // IEND
        0xAE, 0x42, 0x60, 0x82  // CRC
      ]);

      // 测试更大尺寸的缩略图
      const thumbnail = await generateThumbnail(pngBuffer, 200, 70);

      expect(thumbnail).toBeInstanceOf(Buffer);
      expect(thumbnail.length).toBeLessThan(30 * 1024);
    });

    it('应该处理空缓冲区', async () => {
      const emptyBuffer = Buffer.alloc(0);
      
      // 空缓冲区应该抛出错误
      await expect(generateThumbnail(emptyBuffer)).rejects.toThrow();
    });
  });
});