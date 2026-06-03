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

  it('应该使用数据库自定义配置（覆盖默认值）', async () => {
    // 当数据库中存在自定义配置时，应使用数据库配置
    mockAccountFindFirst.mockResolvedValue({
      id: 'acct-1',
      platformId: 'platform-twitter',
      platform: {
        name: 'Twitter',
        config: {
          maxContentLength: 1000, // 覆盖默认 280
          maxImages: 10, // 覆盖默认 4
          maxVideos: 2, // 覆盖默认 1
          allowMixedMedia: false, // 覆盖默认 true
        },
      },
    });

    const response = await GET(
      new NextRequest('http://localhost/api/accounts/acct-1/config'),
      { params: Promise.resolve({ id: 'acct-1' }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.maxContentLength).toBe(1000);
    expect(data.maxImages).toBe(10);
    expect(data.maxVideos).toBe(2);
    expect(data.allowMixedMedia).toBe(false);
  });

  it('应该在未知平台名且无配置时使用全局默认值', async () => {
    // 未知平台名 (不在 DEFAULT_PLATFORM_CONFIG 中) 且没有数据库配置
    mockAccountFindFirst.mockResolvedValue({
      id: 'acct-1',
      platformId: 'platform-unknown',
      platform: {
        name: 'UnknownPlatform',
        config: null,
      },
    });

    const response = await GET(
      new NextRequest('http://localhost/api/accounts/acct-1/config'),
      { params: Promise.resolve({ id: 'acct-1' }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    // 应使用全局默认值
    expect(data.maxContentLength).toBe(280);
    expect(data.maxImages).toBe(4);
    expect(data.maxVideos).toBe(1);
    expect(data.allowMixedMedia).toBe(true);
  });

  it('应该部分覆盖配置 (部分使用 dbConfig, 部分使用默认)', async () => {
    // 数据库配置只提供部分字段，其他使用默认
    mockAccountFindFirst.mockResolvedValue({
      id: 'acct-1',
      platformId: 'platform-twitter',
      platform: {
        name: 'Twitter',
        config: {
          maxContentLength: 500,
          // maxImages 不提供 -> 使用默认
          // maxVideos 不提供 -> 使用默认
          // allowMixedMedia 不提供 -> 使用默认
        },
      },
    });

    const response = await GET(
      new NextRequest('http://localhost/api/accounts/acct-1/config'),
      { params: Promise.resolve({ id: 'acct-1' }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.maxContentLength).toBe(500); // 来自 dbConfig
    expect(data.maxImages).toBe(4); // 来自 Twitter 默认
    expect(data.maxVideos).toBe(1); // 来自 Twitter 默认
    expect(data.allowMixedMedia).toBe(true); // 来自 Twitter 默认
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
