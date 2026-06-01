import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from '@/app/api/posts/stats/route';

const { mockPostCount } = vi.hoisted(() => ({
  mockPostCount: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    post: {
      count: mockPostCount,
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

import { auth } from '@/lib/auth';

describe('GET /api/posts/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: 'user-123', name: 'testuser' },
    });
  });

  it('应该返回所有状态的统计', async () => {
    mockPostCount
      .mockResolvedValueOnce(50) // total
      .mockResolvedValueOnce(10) // scheduled (this week)
      .mockResolvedValueOnce(20) // published
      .mockResolvedValueOnce(15); // drafts

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.totalPosts).toBe(50);
    expect(data.scheduled).toBe(10);
    expect(data.published).toBe(20);
    expect(data.drafts).toBe(15);
  });

  it('应该只统计当前用户的数据', async () => {
    mockPostCount.mockResolvedValue(0);
    await GET();

    // 4 次 count 调用都应该带 userId
    const calls = mockPostCount.mock.calls;
    for (const call of calls) {
      expect(call[0]).toEqual(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-123' }),
        })
      );
    }
  });

  it('应该返回 401 当未登录', async () => {
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it('应该处理数据库错误', async () => {
    mockPostCount.mockRejectedValue(new Error('DB error'));
    const response = await GET();
    expect(response.status).toBe(500);
  });

  it('应该统计 scheduled 时使用本周过滤', async () => {
    mockPostCount.mockResolvedValue(0);
    await GET();

    // scheduled 应该有 scheduledTime >= startOfWeek 过滤
    const scheduledCall = mockPostCount.mock.calls[1];
    expect(scheduledCall[0]).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-123',
          status: 'scheduled',
          scheduledTime: expect.objectContaining({ gte: expect.any(Date) }),
        }),
      })
    );
  });
});
