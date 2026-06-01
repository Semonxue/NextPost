import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/accounts/[id]/config/route';

const { mockAccountFindFirst, mockPlatformConfigFindUnique } = vi.hoisted(() => ({
  mockAccountFindFirst: vi.fn(),
  mockPlatformConfigFindUnique: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    account: {
      findFirst: mockAccountFindFirst,
    },
    platformConfig: {
      findUnique: mockPlatformConfigFindUnique,
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

import { auth } from '@/lib/auth';

describe('GET /api/accounts/:id/config（平台配置）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: 'user-123', name: 'testuser' },
    });
  });

  it('应该返回 401 当未登录', async () => {
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const response = await GET(
      new NextRequest('http://localhost/api/accounts/acct-1/config'),
      { params: Promise.resolve({ id: 'acct-1' }) }
    );
    expect(response.status).toBe(401);
  });

  it('应该返回 404 当账号不存在', async () => {
    mockAccountFindFirst.mockResolvedValue(null);
    const response = await GET(
      new NextRequest('http://localhost/api/accounts/acct-1/config'),
      { params: Promise.resolve({ id: 'acct-1' }) }
    );
    expect(response.status).toBe(404);
  });

  it('应该返回账号的平台配置（Twitter）', async () => {
    mockAccountFindFirst.mockResolvedValue({
      id: 'acct-1',
      platformId: 'platform-twitter',
      platform: { name: 'Twitter' },
    });
    mockPlatformConfigFindUnique.mockResolvedValue({
      platformId: 'platform-twitter',
      maxContentLength: 280,
      maxImages: 4,
      maxVideos: 1,
      allowMixedMedia: true,
    });

    const response = await GET(
      new NextRequest('http://localhost/api/accounts/acct-1/config'),
      { params: Promise.resolve({ id: 'acct-1' }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.maxContentLength).toBe(280);
    expect(data.maxImages).toBe(4);
    expect(data.maxVideos).toBe(1);
    expect(data.allowMixedMedia).toBe(true);
  });

  it('应该在没有自定义配置时使用默认配置', async () => {
    mockAccountFindFirst.mockResolvedValue({
      id: 'acct-1',
      platformId: 'platform-instagram',
      platform: { name: 'Instagram' },
    });
    mockPlatformConfigFindUnique.mockResolvedValue(null);

    const response = await GET(
      new NextRequest('http://localhost/api/accounts/acct-1/config'),
      { params: Promise.resolve({ id: 'acct-1' }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    // Instagram 默认配置应该是 2200 字符、10 张图
    expect(data.maxContentLength).toBe(2200);
    expect(data.maxImages).toBe(10);
  });

  it('应该返回 500 当数据库错误', async () => {
    mockAccountFindFirst.mockRejectedValue(new Error('DB error'));
    const response = await GET(
      new NextRequest('http://localhost/api/accounts/acct-1/config'),
      { params: Promise.resolve({ id: 'acct-1' }) }
    );
    expect(response.status).toBe(500);
  });
});
