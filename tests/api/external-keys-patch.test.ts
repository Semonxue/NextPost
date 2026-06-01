/**
 * 外部 API Key PATCH 接口测试（v0.4）
 *
 * 测试 /api/settings/external-keys/:id 的 PATCH 改 name / scope 流程。
 * 用 mocked prisma + mocked auth，与 trash.test.ts 风格保持一致。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockKeyFindFirst,
  mockKeyUpdate,
} = vi.hoisted(() => ({
  mockKeyFindFirst: vi.fn(),
  mockKeyUpdate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    externalApiKey: {
      findFirst: mockKeyFindFirst,
      update: mockKeyUpdate,
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

import { PATCH } from '@/app/api/settings/external-keys/[id]/route';
import { auth } from '@/lib/auth';

describe('PATCH /api/settings/external-keys/:id (v0.4)', () => {
  const mockSession = { user: { id: 'user-123', name: 'testuser' } };

  beforeEach(() => {
    vi.clearAllMocks();
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);
    mockKeyFindFirst.mockReset();
    mockKeyUpdate.mockReset();
  });

  const makeReq = (body: unknown) =>
    new NextRequest('http://localhost/api/settings/external-keys/k1', {
      method: 'PATCH',
      body: JSON.stringify(body),
    });

  it('应该返回 401 当未登录', async () => {
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await PATCH(makeReq({ scope: 'read_write' }), {
      params: Promise.resolve({ id: 'k1' }),
    });
    expect(res.status).toBe(401);
    expect(mockKeyUpdate).not.toHaveBeenCalled();
  });

  it('应该返回 404 当 key 不属于当前用户', async () => {
    mockKeyFindFirst.mockResolvedValue(null);
    const res = await PATCH(makeReq({ scope: 'read_write' }), {
      params: Promise.resolve({ id: 'other-user-key' }),
    });
    expect(res.status).toBe(404);
    expect(mockKeyUpdate).not.toHaveBeenCalled();
  });

  it('应该返回 400 当 body 不含可改字段', async () => {
    mockKeyFindFirst.mockResolvedValue({ id: 'k1', userId: 'user-123' });
    const res = await PATCH(makeReq({}), {
      params: Promise.resolve({ id: 'k1' }),
    });
    expect(res.status).toBe(400);
  });

  it('应该返回 400 当 scope 是非法字符串', async () => {
    mockKeyFindFirst.mockResolvedValue({ id: 'k1', userId: 'user-123' });
    const res = await PATCH(makeReq({ scope: 'super-admin' }), {
      params: Promise.resolve({ id: 'k1' }),
    });
    expect(res.status).toBe(400);
    expect(mockKeyUpdate).not.toHaveBeenCalled();
  });

  it('应该返回 400 当 scope 不是字符串', async () => {
    mockKeyFindFirst.mockResolvedValue({ id: 'k1', userId: 'user-123' });
    const res = await PATCH(makeReq({ scope: 123 }), {
      params: Promise.resolve({ id: 'k1' }),
    });
    expect(res.status).toBe(400);
  });

  it('应该返回 400 当 name 是空字符串', async () => {
    mockKeyFindFirst.mockResolvedValue({ id: 'k1', userId: 'user-123' });
    const res = await PATCH(makeReq({ name: '   ' }), {
      params: Promise.resolve({ id: 'k1' }),
    });
    expect(res.status).toBe(400);
  });

  it('应能成功把 scope 从 read 升到 read_write', async () => {
    mockKeyFindFirst.mockResolvedValue({ id: 'k1', userId: 'user-123' });
    mockKeyUpdate.mockResolvedValue({
      id: 'k1',
      name: 'Test',
      permissions: 'read_write',
      lastUsedAt: null,
      expiresAt: null,
      createdAt: new Date('2026-01-01'),
    });

    const res = await PATCH(makeReq({ scope: 'read_write' }), {
      params: Promise.resolve({ id: 'k1' }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.key.permissions).toBe('read_write');
    expect(mockKeyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'k1' },
        data: { permissions: 'read_write' },
      })
    );
  });

  it('应能同时改 name 和 scope', async () => {
    mockKeyFindFirst.mockResolvedValue({ id: 'k1', userId: 'user-123' });
    mockKeyUpdate.mockResolvedValue({
      id: 'k1',
      name: 'New Name',
      permissions: 'read_write',
      lastUsedAt: null,
      expiresAt: null,
      createdAt: new Date(),
    });

    const res = await PATCH(
      makeReq({ name: 'New Name', scope: 'read_write' }),
      { params: Promise.resolve({ id: 'k1' }) }
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.key.name).toBe('New Name');
    expect(mockKeyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'k1' },
        data: { name: 'New Name', permissions: 'read_write' },
      })
    );
  });

  it('应能接受 read_report 历史值并归一为 read', async () => {
    mockKeyFindFirst.mockResolvedValue({ id: 'k1', userId: 'user-123' });
    mockKeyUpdate.mockResolvedValue({
      id: 'k1', name: 'T', permissions: 'read',
      lastUsedAt: null, expiresAt: null, createdAt: new Date(),
    });

    const res = await PATCH(makeReq({ scope: 'read_report' }), {
      params: Promise.resolve({ id: 'k1' }),
    });
    expect(res.status).toBe(200);
    expect(mockKeyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'k1' },
        data: { permissions: 'read' },
      })
    );
  });

  it('应返回 500 当 DB 抛错', async () => {
    mockKeyFindFirst.mockResolvedValue({ id: 'k1', userId: 'user-123' });
    mockKeyUpdate.mockRejectedValue(new Error('DB error'));
    const res = await PATCH(makeReq({ scope: 'read_write' }), {
      params: Promise.resolve({ id: 'k1' }),
    });
    expect(res.status).toBe(500);
  });
});
