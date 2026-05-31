import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the storage module
vi.mock('@/lib/storage', () => ({
  uploadFile: vi.fn().mockResolvedValue({
    url: '/uploads/2024-01-01/test-file.jpg',
    path: '/uploads/2024-01-01/test-file.jpg',
    filename: 'test-file.jpg',
    mimeType: 'image/jpeg',
    size: 1024,
  }),
  deleteFile: vi.fn().mockResolvedValue(undefined),
}));

// Mock auth
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

      // Create a mock form data with file
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
  });
});
