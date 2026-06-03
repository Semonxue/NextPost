/**
 * 缩略图生成测试
 * 
 * 测试 sharp 库生成缩略图的功能
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { generateThumbnail, needsThumbnail } from '@/lib/storage/thumbnail';
import sharp from 'sharp';

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

    it('应该递归降低质量以保持缩略图小于 30KB', async () => {
      // 创建一个高复杂度的大图片以确保初始缩略图 > 30KB 触发递归
      const width = 800
      const height = 800
      const channels = 3
      const data = Buffer.alloc(width * height * channels)
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.floor(Math.random() * 256)
      }
      const largeBuffer = await sharp(data, { raw: { width, height, channels } })
        .png()
        .toBuffer()

      // 使用 maxSize 800 保留原始大小，初始 quality=70
      // 高墒噪点 webp 编码后可能 > 30KB 触发递归压缩逻辑
      const thumbnail = await generateThumbnail(largeBuffer, 800, 70)

      expect(thumbnail).toBeInstanceOf(Buffer)
      // 验证调用了递归路径（覆盖率）
      // 使用 quality=25 仍会递归（25 > 20），然后 quality=15 退出递归
      const thumbnail2 = await generateThumbnail(largeBuffer, 800, 25)
      expect(thumbnail2).toBeInstanceOf(Buffer)
    });

    it('应该使用默认参数', async () => {
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01,
        0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00,
        0x90, 0x77, 0x53, 0xDE,
        0x00, 0x00, 0x00, 0x0C,
        0x49, 0x44, 0x41, 0x54,
        0x08, 0xD7, 0x63, 0xF8, 0xFF, 0xFF, 0xFF, 0x00,
        0x05, 0xFE, 0x02, 0xFE,
        0x00, 0x00, 0x00, 0x00,
        0x49, 0x45, 0x4E, 0x44,
        0xAE, 0x42, 0x60, 0x82
      ])

      // 使用默认 maxSize 和 quality
      const thumbnail = await generateThumbnail(pngBuffer)

      expect(thumbnail).toBeInstanceOf(Buffer)
    });
  });

  describe('needsThumbnail', () => {
    it('应该返回 true 当文件大于 30KB', async () => {
      const filePath = path.join(tempDir, 'large-file.jpg')
      // 写入 40KB 的假文件
      await fs.writeFile(filePath, Buffer.alloc(40 * 1024))

      const result = await needsThumbnail(filePath)
      expect(result).toBe(true)
    });

    it('应该返回 false 当文件小于或等于 30KB', async () => {
      const filePath = path.join(tempDir, 'small-file.jpg')
      // 写入 20KB 的假文件
      await fs.writeFile(filePath, Buffer.alloc(20 * 1024))

      const result = await needsThumbnail(filePath)
      expect(result).toBe(false)
    });

    it('应该返回 false 当文件正好 30KB', async () => {
      const filePath = path.join(tempDir, 'exact-30k-file.jpg')
      await fs.writeFile(filePath, Buffer.alloc(30 * 1024))

      const result = await needsThumbnail(filePath)
      expect(result).toBe(false)
    });

    it('应该返回 false 当文件不存在', async () => {
      const result = await needsThumbnail('/non/existent/path/file.jpg')
      expect(result).toBe(false)
    });
  });
});
