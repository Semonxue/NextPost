/**
 * Storage module tests
 *
 * Uses real filesystem operations with temp directories for reliable testing.
 * Covers: LocalStorageEngine, storage index (uploadFile, deleteFile, getFileUrl)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// Mock uuid for predictable filenames
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-1234',
}));

import { LocalStorageEngine } from '@/lib/storage/local';
import { uploadFile, deleteFile, getFileUrl } from '@/lib/storage';

describe('LocalStorageEngine', () => {
  let engine: LocalStorageEngine;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), 'nextpost-test-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
    engine = new LocalStorageEngine(tempDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  describe('getUrl', () => {
    it('should return /api/uploads/ prefixed URL', () => {
      expect(engine.getUrl('2024-01-01/test.jpg')).toBe('/api/uploads/2024-01-01/test.jpg');
    });

    it('should handle simple filename', () => {
      expect(engine.getUrl('test.jpg')).toBe('/api/uploads/test.jpg');
    });

    it('should handle nested paths', () => {
      expect(engine.getUrl('a/b/c.jpg')).toBe('/api/uploads/a/b/c.jpg');
    });
  });

  describe('getRelativePath', () => {
    it('should extract relative path from /api/uploads/ URL', () => {
      expect(engine.getRelativePath('/api/uploads/2024-01-01/test.jpg')).toBe('2024-01-01/test.jpg');
    });

    it('should return null for non-matching URL', () => {
      expect(engine.getRelativePath('/other/path/test.jpg')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(engine.getRelativePath('')).toBeNull();
    });

    it('should return null for http URL', () => {
      expect(engine.getRelativePath('http://localhost:3000/uploads/test.jpg')).toBeNull();
    });

    it('should handle paths with special characters', () => {
      expect(engine.getRelativePath('/api/uploads/test file (1).jpg')).toBe('test file (1).jpg');
    });
  });

  describe('upload', () => {
    it('should create file and return URL', async () => {
      const buffer = Buffer.from('test content');
      const url = await engine.upload(buffer, 'test.jpg', 'image/jpeg');

      expect(url).toMatch(/^\/api\/uploads\/\d{4}-\d{2}-\d{2}\/test-uuid-1234\.jpg$/);
      
      // Verify file was actually created
      const relativePath = url.replace('/api/uploads/', '');
      const filePath = path.join(tempDir, relativePath);
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('test content');
    });

    it('should preserve file extension', async () => {
      const buffer = Buffer.from('video data');
      const url = await engine.upload(buffer, 'video.mp4', 'video/mp4');
      expect(url).toMatch(/\.mp4$/);
    });

    it('should create date-based subdirectory', async () => {
      const buffer = Buffer.from('test');
      const url = await engine.upload(buffer, 'test.jpg', 'image/jpeg');
      
      const relativePath = url.replace('/api/uploads/', '');
      const today = new Date().toISOString().slice(0, 10);
      expect(relativePath).toContain(today);
    });
  });

  describe('delete', () => {
    it('should delete existing file', async () => {
      // First upload a file
      const buffer = Buffer.from('to be deleted');
      const url = await engine.upload(buffer, 'delete-me.jpg', 'image/jpeg');
      
      // Verify it exists
      const relativePath = url.replace('/api/uploads/', '');
      const filePath = path.join(tempDir, relativePath);
      await expect(fs.access(filePath)).resolves.toBeUndefined();
      
      // Delete it
      await engine.delete(url);
      
      // Verify it's gone
      await expect(fs.access(filePath)).rejects.toThrow();
    });

    it('should do nothing for non-matching URL', async () => {
      // Should not throw
      await expect(engine.delete('invalid-url')).resolves.toBeUndefined();
    });

    it('should not throw for non-existent file', async () => {
      // Should not throw (ENOENT is ignored)
      await expect(engine.delete('/api/uploads/nonexistent.jpg')).resolves.toBeUndefined();
    });
  });

  describe('exists', () => {
    it('should return true for existing file', async () => {
      // Create a test file
      const testFile = 'exists-test.txt';
      await fs.writeFile(path.join(tempDir, testFile), 'test');
      
      const result = await engine.exists(testFile);
      expect(result).toBe(true);
    });

    it('should return false for non-existing file', async () => {
      const result = await engine.exists('nonexistent-file.txt');
      expect(result).toBe(false);
    });
  });
});

describe('storage index', () => {
  describe('uploadFile', () => {
    it('should return UploadResult with correct structure', async () => {
      const buffer = Buffer.from('test content for index');
      const result = await uploadFile(buffer, 'index-test.jpg', 'image/jpeg');

      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('path');
      expect(result.filename).toBe('index-test.jpg');
      expect(result.mimeType).toBe('image/jpeg');
      expect(result.size).toBe(buffer.length);
      expect(result.url).toMatch(/^\/api\/uploads\//);
    });
  });

  describe('deleteFile', () => {
    it('should handle invalid URL gracefully', async () => {
      await expect(deleteFile('invalid-url')).resolves.toBeUndefined();
    });

    it('should handle non-existent file gracefully', async () => {
      await expect(deleteFile('/api/uploads/nonexistent.jpg')).resolves.toBeUndefined();
    });
  });

  describe('getFileUrl', () => {
    it('should return /api/uploads/ URL', () => {
      expect(getFileUrl('2024-01-01/test.jpg')).toBe('/api/uploads/2024-01-01/test.jpg');
    });

    it('should handle simple filename', () => {
      expect(getFileUrl('test.jpg')).toBe('/api/uploads/test.jpg');
    });
  });
});