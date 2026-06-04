import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from '@/app/api/platforms/route';

const { mockPlatformFindMany } = vi.hoisted(() => ({
  mockPlatformFindMany: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    platform: {
      findMany: mockPlatformFindMany,
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

import { auth } from '@/lib/auth';

describe('GET /api/platforms（v0.5 多平台）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: 'user-123', name: 'testuser' },
    });
  });

  it('应该返回 401 当未登录', async () => {
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it('应该返回所有平台（含 config）', async () => {
    mockPlatformFindMany.mockResolvedValue([
      {
        id: 'p-twitter',
        name: 'Twitter',
        icon: '/icons/twitter.svg',
        config: { maxContentLength: 280, maxImages: 4, maxVideos: 1, allowMixedMedia: true },
      },
      {
        id: 'p-xhs',
        name: 'Xiaohongshu',
        icon: '/icons/xiaohongshu.svg',
        config: { maxContentLength: 1000, maxImages: 18, maxVideos: 1, allowMixedMedia: false },
      },
    ]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.platforms).toHaveLength(2);
    expect(data.platforms[0].name).toBe('Twitter');
    expect(data.platforms[0].config.maxContentLength).toBe(280);
    expect(data.platforms[1].name).toBe('Xiaohongshu');
    expect(data.platforms[1].config.maxContentLength).toBe(1000);
    // 验证 prisma 查询带了 include config
    expect(mockPlatformFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ include: { config: true } })
    );
  });

  it('应该按 name 升序排序', async () => {
    mockPlatformFindMany.mockResolvedValue([]);
    await GET();
    expect(mockPlatformFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { name: 'asc' } })
    );
  });

  it('应该返回 500 当数据库错误', async () => {
    mockPlatformFindMany.mockRejectedValue(new Error('Database error'));
    const response = await GET();
    expect(response.status).toBe(500);
  });

  it('应该支持空列表', async () => {
    mockPlatformFindMany.mockResolvedValue([]);
    const response = await GET();
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.platforms).toEqual([]);
  });
});
