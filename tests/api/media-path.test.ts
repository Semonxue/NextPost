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

    it('should return 200 and image for existing jpg file', async () => {
      // Create a test file in the actual uploads directory relative to cwd
      const testFilePath = path.join(process.cwd(), 'uploads', 'test-route.jpg');
      const testBuffer = Buffer.from('fake jpg content');
      await fs.mkdir(path.dirname(testFilePath), { recursive: true });
      await fs.writeFile(testFilePath, testBuffer);

      try {
        const req = new NextRequest('http://localhost/api/media/test-route.jpg');
        const res = await GET(req, { params: Promise.resolve({ path: 'test-route.jpg' }) });

        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toBe('image/jpeg');
        expect(res.headers.get('Cache-Control')).toContain('max-age=31536000');
        const data = await res.arrayBuffer();
        expect(Buffer.from(data).toString()).toBe('fake jpg content');
      } finally {
        await fs.unlink(testFilePath).catch(() => {})
        await fs.rmdir(path.dirname(testFilePath)).catch(() => {})
      }
    });

    it('should return 200 for png file with correct mime', async () => {
      const testFilePath = path.join(process.cwd(), 'uploads', 'test-route.png');
      await fs.mkdir(path.dirname(testFilePath), { recursive: true });
      await fs.writeFile(testFilePath, Buffer.from('png content'));

      try {
        const req = new NextRequest('http://localhost/api/media/test-route.png');
        const res = await GET(req, { params: Promise.resolve({ path: 'test-route.png' }) });
        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toBe('image/png');
      } finally {
        await fs.unlink(testFilePath).catch(() => {})
        await fs.rmdir(path.dirname(testFilePath)).catch(() => {})
      }
    });

    it('should return 200 for video mp4 with correct mime', async () => {
      const testFilePath = path.join(process.cwd(), 'uploads', 'test-route.mp4');
      await fs.mkdir(path.dirname(testFilePath), { recursive: true });
      await fs.writeFile(testFilePath, Buffer.from('mp4 content'));

      try {
        const req = new NextRequest('http://localhost/api/media/test-route.mp4');
        const res = await GET(req, { params: Promise.resolve({ path: 'test-route.mp4' }) });
        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toBe('video/mp4');
      } finally {
        await fs.unlink(testFilePath).catch(() => {})
        await fs.rmdir(path.dirname(testFilePath)).catch(() => {})
      }
    });

    it('should return 200 for webm with correct mime', async () => {
      const testFilePath = path.join(process.cwd(), 'uploads', 'test-route.webm');
      await fs.mkdir(path.dirname(testFilePath), { recursive: true });
      await fs.writeFile(testFilePath, Buffer.from('webm content'));

      try {
        const req = new NextRequest('http://localhost/api/media/test-route.webm');
        const res = await GET(req, { params: Promise.resolve({ path: 'test-route.webm' }) });
        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toBe('video/webm');
      } finally {
        await fs.unlink(testFilePath).catch(() => {})
        await fs.rmdir(path.dirname(testFilePath)).catch(() => {})
      }
    });

    it('should return 200 for ogg with correct mime', async () => {
      const testFilePath = path.join(process.cwd(), 'uploads', 'test-route.ogg');
      await fs.mkdir(path.dirname(testFilePath), { recursive: true });
      await fs.writeFile(testFilePath, Buffer.from('ogg content'));

      try {
        const req = new NextRequest('http://localhost/api/media/test-route.ogg');
        const res = await GET(req, { params: Promise.resolve({ path: 'test-route.ogg' }) });
        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toBe('video/ogg');
      } finally {
        await fs.unlink(testFilePath).catch(() => {})
        await fs.rmdir(path.dirname(testFilePath)).catch(() => {})
      }
    });

    it('should return 200 for mov with correct mime', async () => {
      const testFilePath = path.join(process.cwd(), 'uploads', 'test-route.mov');
      await fs.mkdir(path.dirname(testFilePath), { recursive: true });
      await fs.writeFile(testFilePath, Buffer.from('mov content'));

      try {
        const req = new NextRequest('http://localhost/api/media/test-route.mov');
        const res = await GET(req, { params: Promise.resolve({ path: 'test-route.mov' }) });
        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toBe('video/quicktime');
      } finally {
        await fs.unlink(testFilePath).catch(() => {})
        await fs.rmdir(path.dirname(testFilePath)).catch(() => {})
      }
    });

    it('should return 200 for jpeg with correct mime', async () => {
      const testFilePath = path.join(process.cwd(), 'uploads', 'test-route.jpeg');
      await fs.mkdir(path.dirname(testFilePath), { recursive: true });
      await fs.writeFile(testFilePath, Buffer.from('jpeg content'));

      try {
        const req = new NextRequest('http://localhost/api/media/test-route.jpeg');
        const res = await GET(req, { params: Promise.resolve({ path: 'test-route.jpeg' }) });
        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toBe('image/jpeg');
      } finally {
        await fs.unlink(testFilePath).catch(() => {})
        await fs.rmdir(path.dirname(testFilePath)).catch(() => {})
      }
    });

    it('should return 200 for gif with correct mime', async () => {
      const testFilePath = path.join(process.cwd(), 'uploads', 'test-route.gif');
      await fs.mkdir(path.dirname(testFilePath), { recursive: true });
      await fs.writeFile(testFilePath, Buffer.from('gif content'));

      try {
        const req = new NextRequest('http://localhost/api/media/test-route.gif');
        const res = await GET(req, { params: Promise.resolve({ path: 'test-route.gif' }) });
        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toBe('image/gif');
      } finally {
        await fs.unlink(testFilePath).catch(() => {})
        await fs.rmdir(path.dirname(testFilePath)).catch(() => {})
      }
    });

    it('should return 200 for webp with correct mime', async () => {
      const testFilePath = path.join(process.cwd(), 'uploads', 'test-route.webp');
      await fs.mkdir(path.dirname(testFilePath), { recursive: true });
      await fs.writeFile(testFilePath, Buffer.from('webp content'));

      try {
        const req = new NextRequest('http://localhost/api/media/test-route.webp');
        const res = await GET(req, { params: Promise.resolve({ path: 'test-route.webp' }) });
        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toBe('image/webp');
      } finally {
        await fs.unlink(testFilePath).catch(() => {})
        await fs.rmdir(path.dirname(testFilePath)).catch(() => {})
      }
    });

    it('should return octet-stream for unknown extension', async () => {
      const testFilePath = path.join(process.cwd(), 'uploads', 'test-route.xyz');
      await fs.mkdir(path.dirname(testFilePath), { recursive: true });
      await fs.writeFile(testFilePath, Buffer.from('xyz content'));

      try {
        const req = new NextRequest('http://localhost/api/media/test-route.xyz');
        const res = await GET(req, { params: Promise.resolve({ path: 'test-route.xyz' }) });
        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toBe('application/octet-stream');
      } finally {
        await fs.unlink(testFilePath).catch(() => {})
        await fs.rmdir(path.dirname(testFilePath)).catch(() => {})
      }
    });

    it('should decode URL-encoded path for GET', async () => {
      const testFilePath = path.join(process.cwd(), 'uploads', '2024-01-01', 'test decode.jpg');
      await fs.mkdir(path.dirname(testFilePath), { recursive: true });
      await fs.writeFile(testFilePath, Buffer.from('decoded content'));

      try {
        const encodedPath = encodeURIComponent('2024-01-01/test decode.jpg')
        const req = new NextRequest(`http://localhost/api/media/${encodedPath}`);
        const res = await GET(req, { params: Promise.resolve({ path: encodedPath }) });
        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toBe('image/jpeg');
      } finally {
        await fs.unlink(testFilePath).catch(() => {})
        await fs.rmdir(path.dirname(testFilePath)).catch(() => {})
      }
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