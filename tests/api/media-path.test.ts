/**
 * Media file access route tests
 *
 * Covers: GET /api/media/[path] and DELETE /api/media/[path]
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// Use vi.hoisted for mock functions referenced in vi.mock factories
const { mockDeleteFile } = vi.hoisted(() => ({
  mockDeleteFile: vi.fn(),
}));

// auth is already mocked globally in tests/setup.ts
vi.mock('@/lib/storage', () => ({
  deleteFile: mockDeleteFile,
  localStorage: {
    getUrl: (p: string) => `/api/uploads/${p}`,
    getRelativePath: (url: string) =>
      url.startsWith('/api/uploads/') ? url.slice('/api/uploads/'.length) : null,
  },
}));

import { GET, DELETE } from '@/app/api/media/[path]/route';
import { auth } from '@/lib/auth';

describe('Media route', () => {
  let uploadsDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockDeleteFile.mockReset().mockResolvedValue(undefined);
    uploadsDir = path.join(os.tmpdir(), 'nextpost-media-test-' + Date.now());
    await fs.mkdir(uploadsDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(uploadsDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  describe('GET /api/media/[path]', () => {
    it('should return 404 for non-existent file', async () => {
      const req = new NextRequest('http://localhost/api/media/nonexistent.jpg');
      const res = await GET(req, { params: Promise.resolve({ path: 'nonexistent.jpg' }) });

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('文件未找到');
    });

    it('should return 404 for deeply nested non-existent path', async () => {
      const req = new NextRequest('http://localhost/api/media/a/b/c/d.jpg');
      const res = await GET(req, { params: Promise.resolve({ path: 'a/b/c/d.jpg' }) });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/media/[path]', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const req = new NextRequest('http://localhost/api/media/test.jpg', { method: 'DELETE' });
      const res = await DELETE(req, { params: Promise.resolve({ path: 'test.jpg' }) });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('未授权');
    });

    it('should return 401 when session has no user id', async () => {
      vi.mocked(auth).mockResolvedValue({ user: {} } as never);

      const req = new NextRequest('http://localhost/api/media/test.jpg', { method: 'DELETE' });
      const res = await DELETE(req, { params: Promise.resolve({ path: 'test.jpg' }) });

      expect(res.status).toBe(401);
    });

    it('should call deleteFile when authenticated', async () => {
      vi.mocked(auth).mockResolvedValue({ user: { id: 'user-123' } } as never);
      mockDeleteFile.mockResolvedValue(undefined);

      const req = new NextRequest('http://localhost/api/media/2024-01-01/test.jpg', { method: 'DELETE' });
      const res = await DELETE(req, { params: Promise.resolve({ path: '2024-01-01/test.jpg' }) });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(mockDeleteFile).toHaveBeenCalledWith('/uploads/2024-01-01/test.jpg');
    });

    it('should decode URL-encoded path', async () => {
      vi.mocked(auth).mockResolvedValue({ user: { id: 'user-123' } } as never);
      mockDeleteFile.mockResolvedValue(undefined);

      const encodedPath = encodeURIComponent('2024-01-01/测试文件.jpg');
      const req = new NextRequest(`http://localhost/api/media/${encodedPath}`, { method: 'DELETE' });
      const res = await DELETE(req, { params: Promise.resolve({ path: encodedPath }) });

      expect(res.status).toBe(200);
      expect(mockDeleteFile).toHaveBeenCalledWith('/uploads/2024-01-01/测试文件.jpg');
    });

    it('should return 500 when deleteFile throws', async () => {
      vi.mocked(auth).mockResolvedValue({ user: { id: 'user-123' } } as never);
      mockDeleteFile.mockRejectedValue(new Error('Storage error'));

      const req = new NextRequest('http://localhost/api/media/test.jpg', { method: 'DELETE' });
      const res = await DELETE(req, { params: Promise.resolve({ path: 'test.jpg' }) });

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe('服务器错误');
    });
  });
});