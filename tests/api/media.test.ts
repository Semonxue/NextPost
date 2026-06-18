/**
 * Media API tests
 *
 * Tests POST /api/media/upload and DELETE /api/media/[path].
 * Uses @/lib/storage mock for reliable testing without real filesystem.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/storage', () => ({
  uploadFile: vi.fn().mockResolvedValue({
    url: '/api/uploads/2024-01-01/test-file.jpg',
    path: '/api/uploads/2024-01-01/test-file.jpg',
    filename: 'test-file.jpg',
    mimeType: 'image/jpeg',
    size: 1024,
  }),
  uploadFileWithThumbnail: vi.fn().mockResolvedValue({
    url: '/api/uploads/2024-01-01/test-file.jpg',
    thumbnailUrl: '/api/uploads/2024-01-01/test-file_thumb.webp',
    path: '/api/uploads/2024-01-01/test-file.jpg',
    filename: 'test-file.jpg',
    mimeType: 'image/jpeg',
    size: 1024,
    thumbnailSize: 512,
  }),
  deleteFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

import { POST } from '@/app/api/media/upload/route';
import { DELETE } from '@/app/api/media/[path]/route';
import { auth } from '@/lib/auth';

describe('Media API', () => {
  const mockSession = {
    user: { id: 'user-123', name: 'testuser' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);
  });

  describe('POST /api/media/upload', () => {
    it('should return 401 when not authenticated', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('file', mockFile);

      const request = new NextRequest('http://localhost/api/media/upload', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it('should return 400 when no file provided', async () => {
      const formData = new FormData();

      const request = new NextRequest('http://localhost/api/media/upload', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('请选择文件');
    });

    it('should return 400 when file type is not allowed', async () => {
      const mockFile = new File(['test'], 'test.exe', { type: 'application/x-msdownload' });
      const formData = new FormData();
      formData.append('file', mockFile);

      const request = new NextRequest('http://localhost/api/media/upload', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('不支持的文件类型');
    });

    it('should upload file successfully', async () => {
      const { uploadFileWithThumbnail } = await import('@/lib/storage');

      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('file', mockFile);

      const request = new NextRequest('http://localhost/api/media/upload', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.url).toBe('/api/uploads/2024-01-01/test-file.jpg');
      expect(data.thumbnailUrl).toBe('/api/uploads/2024-01-01/test-file_thumb.webp');
      expect(data.filename).toBe('test-file.jpg');
      expect(uploadFileWithThumbnail).toHaveBeenCalled();
    });

    it('should upload video file successfully', async () => {
      const { uploadFileWithThumbnail } = await import('@/lib/storage');

      const mockFile = new File(['test'], 'video.mp4', { type: 'video/mp4' });
      const formData = new FormData();
      formData.append('file', mockFile);

      const request = new NextRequest('http://localhost/api/media/upload', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(uploadFileWithThumbnail).toHaveBeenCalled();
    });

    it('should handle upload error', async () => {
      const { uploadFileWithThumbnail } = await import('@/lib/storage');
      (uploadFileWithThumbnail as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Upload failed'));

      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('file', mockFile);

      const request = new NextRequest('http://localhost/api/media/upload', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /api/media/:path', () => {
    it('should return 401 when not authenticated', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/media/test-path', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ path: 'test-path' }) });
      expect(response.status).toBe(401);
    });

    it('should delete file successfully', async () => {
      const { deleteFile } = await import('@/lib/storage');

      const request = new NextRequest('http://localhost/api/media/test-path', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ path: 'test-path' }) });
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(deleteFile).toHaveBeenCalled();
    });

    it('should handle delete error', async () => {
      const { deleteFile } = await import('@/lib/storage');
      (deleteFile as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Delete failed'));

      const request = new NextRequest('http://localhost/api/media/test-path', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ path: 'test-path' }) });
      expect(response.status).toBe(500);
    });
  });
})
