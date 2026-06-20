/**
 * Storage module coverage tests
 *
 * Supplements storage.test.ts to improve coverage to 80%+
 * Covers: needsThumbnail, uploadWithThumbnail, deleteFile, getStorageEngine branches
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

// Mock uuid for predictable filenames
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-coverage',
}));

// Mock sharp for thumbnail tests
vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    resize: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('mocked-thumbnail')),
  })),
}));

import { generateThumbnail, needsThumbnail } from '@/lib/storage/thumbnail';
import { LocalStorageEngine } from '@/lib/storage/local';
import { uploadFile, deleteFile, getFileUrl, uploadFileWithThumbnail } from '@/lib/storage';

describe('thumbnail.ts coverage', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = `thumb-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await fs.mkdir(path.join(UPLOADS_DIR, testDir), { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(path.join(UPLOADS_DIR, testDir), { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('needsThumbnail', () => {
    it('should return true for file > 30KB', async () => {
      const bigFile = path.join(UPLOADS_DIR, testDir, 'big.jpg');
      // Create a 50KB file
      const buffer = Buffer.alloc(50 * 1024, 0xff);
      await fs.writeFile(bigFile, buffer);

      const result = await needsThumbnail(bigFile);
      expect(result).toBe(true);
    });

    it('should return false for file <= 30KB', async () => {
      const smallFile = path.join(UPLOADS_DIR, testDir, 'small.jpg');
      const buffer = Buffer.alloc(10 * 1024, 0xff);
      await fs.writeFile(smallFile, buffer);

      const result = await needsThumbnail(smallFile);
      expect(result).toBe(false);
    });

    it('should return false for non-existent file', async () => {
      const result = await needsThumbnail('/nonexistent/file.jpg');
      expect(result).toBe(false);
    });

    it('should return true for file exactly > 30KB', async () => {
      const exactFile = path.join(UPLOADS_DIR, testDir, 'exact.jpg');
      const buffer = Buffer.alloc(30 * 1024 + 1, 0xff);
      await fs.writeFile(exactFile, buffer);

      const result = await needsThumbnail(exactFile);
      expect(result).toBe(true);
    });

    it('should return false for file exactly 30KB', async () => {
      const exactFile = path.join(UPLOADS_DIR, testDir, 'exact30.jpg');
      const buffer = Buffer.alloc(30 * 1024, 0xff);
      await fs.writeFile(exactFile, buffer);

      const result = await needsThumbnail(exactFile);
      expect(result).toBe(false);
    });
  });

  describe('generateThumbnail', () => {
    it('should call sharp with correct parameters', async () => {
      const sharp = await import('sharp');
      const mockSharp = vi.mocked(sharp.default);

      const buffer = Buffer.from('test image data');
      await generateThumbnail(buffer, 120, 80);

      expect(mockSharp).toHaveBeenCalledWith(buffer);
    });

    it('should use default parameters', async () => {
      const sharp = await import('sharp');
      const mockSharp = vi.mocked(sharp.default);

      const buffer = Buffer.from('test image data');
      await generateThumbnail(buffer);

      expect(mockSharp).toHaveBeenCalledWith(buffer);
    });
  });
});

describe('storage/index.ts coverage', () => {
  const originalEnv = process.env.STORAGE_ENGINE;

  afterEach(() => {
    process.env.STORAGE_ENGINE = originalEnv;
  });

  describe('getStorageEngine branches', () => {
    it('should return localStorage for "local" engine', async () => {
      process.env.STORAGE_ENGINE = 'local';
      const result = await uploadFile(Buffer.from('test'), 'test.jpg', 'image/jpeg');
      expect(result.url).toMatch(/^\/api\/uploads\//);
    });

    it('should throw error for "s3" engine', async () => {
      process.env.STORAGE_ENGINE = 's3';
      await expect(uploadFile(Buffer.from('test'), 'test.jpg', 'image/jpeg')).rejects.toThrow('S3 storage not implemented yet');
    });

    it('should throw error for "r2" engine', async () => {
      process.env.STORAGE_ENGINE = 'r2';
      await expect(uploadFile(Buffer.from('test'), 'test.jpg', 'image/jpeg')).rejects.toThrow('R2 storage not configured');
    });

    it('should fallback to localStorage for unknown engine', async () => {
      process.env.STORAGE_ENGINE = 'unknown';
      const result = await uploadFile(Buffer.from('test'), 'test.jpg', 'image/jpeg');
      expect(result.url).toMatch(/^\/api\/uploads\//);
    });
  });

  describe('deleteFile', () => {
    it('should handle invalid URL gracefully', async () => {
      await expect(deleteFile('invalid-url')).resolves.toBeUndefined();
    });

    it('should handle non-existent file gracefully', async () => {
      await expect(deleteFile('/api/uploads/nonexistent-file-12345.jpg')).resolves.toBeUndefined();
    });
  });

  describe('getFileUrl', () => {
    it('should return full URL with /api/uploads/ prefix', () => {
      expect(getFileUrl('2024-01-01/file.jpg')).toBe('/api/uploads/2024-01-01/file.jpg');
    });

    it('should handle empty path', () => {
      expect(getFileUrl('')).toBe('/api/uploads/');
    });

    it('should handle deeply nested path', () => {
      expect(getFileUrl('a/b/c/d.jpg')).toBe('/api/uploads/a/b/c/d.jpg');
    });
  });

  describe('uploadFile result structure', () => {
    it('should return correct UploadResult fields', async () => {
      const buffer = Buffer.from('test upload');
      const result = await uploadFile(buffer, 'result-test.png', 'image/png');

      expect(result).toEqual({
        url: expect.stringMatching(/^\/api\/uploads\//),
        path: expect.stringMatching(/^\/api\/uploads\//),
        filename: 'result-test.png',
        mimeType: 'image/png',
        size: buffer.length,
      });
    });
  });

  describe('uploadFileWithThumbnail', () => {
    it('should return result with thumbnailUrl', async () => {
      const buffer = Buffer.from('test thumbnail upload');
      const result = await uploadFileWithThumbnail(buffer, 'thumb-test.jpg', 'image/jpeg');

      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('thumbnailUrl');
      expect(result).toHaveProperty('path');
      expect(result).toHaveProperty('filename', 'thumb-test.jpg');
      expect(result).toHaveProperty('mimeType', 'image/jpeg');
      expect(result).toHaveProperty('size', buffer.length);
      expect(result).toHaveProperty('thumbnailSize');
    });

    it('should handle video mime type without generating thumbnail', async () => {
      const buffer = Buffer.from('test video upload');
      const result = await uploadFileWithThumbnail(buffer, 'video.mp4', 'video/mp4');

      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('thumbnailUrl');
      // For video, thumbnailUrl should be same as url (no thumbnail generated)
      expect(result.thumbnailUrl).toBe(result.url);
    });
  });
});

describe('LocalStorageEngine uploadWithThumbnail', () => {
  let engine: LocalStorageEngine;
  // unique subdirectory for test isolation
  let testDir: string;

  beforeEach(async () => {
    testDir = `test-thumb-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await fs.mkdir(path.join(UPLOADS_DIR, testDir), { recursive: true });
    engine = new LocalStorageEngine();
  });

  afterEach(async () => {
    try {
      await fs.rm(path.join(UPLOADS_DIR, testDir), { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('should upload image and generate thumbnail', async () => {
    const buffer = Buffer.from('image data for thumbnail');
    const result = await engine.uploadWithThumbnail(buffer, 'photo.jpg', 'image/jpeg');

    expect(result.url).toMatch(/^\/api\/uploads\//);
    expect(result.thumbnailUrl).toMatch(/^\/api\/uploads\//);
    expect(result.filename).toBe('photo.jpg');
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.size).toBe(buffer.length);

    // Verify original file exists in uploads dir
    const relPath = result.url.replace('/api/uploads/', '');
    await expect(fs.access(path.join(UPLOADS_DIR, relPath))).resolves.toBeUndefined();
  });

  it('should upload video without thumbnail', async () => {
    const buffer = Buffer.from('video data');
    const result = await engine.uploadWithThumbnail(buffer, 'clip.mp4', 'video/mp4');

    expect(result.url).toMatch(/^\/api\/uploads\//);
    expect(result.thumbnailUrl).toBe(result.url);
    expect(result.mimeType).toBe('video/mp4');
  });

  it('should handle non-image mime type', async () => {
    const buffer = Buffer.from('document content');
    const result = await engine.uploadWithThumbnail(buffer, 'doc.pdf', 'application/pdf');

    expect(result.url).toMatch(/^\/api\/uploads\//);
    expect(result.thumbnailUrl).toBe(result.url);
  });

  it('should extract baseName from filename correctly', async () => {
    const buffer = Buffer.from('test');
    const result = await engine.uploadWithThumbnail(buffer, 'my-image.png', 'image/png');

    // thumbnailPath should use baseName_thumb.webp
    expect(result.thumbnailUrl).toContain('my-image_thumb.webp');
  });
});