/**
 * 外部 API Key PATCH 接口测试（v0.4）
 *
 * 【v0.4 变更】scope 不可改！PATCH 只接受 name 字段。
 * 测试覆盖：
 * - 各种拒绝路径：401 / 400 (scope) / 400 (空 name) / 400 (空 body) / 400 (DB 错)
 * - 各种接受路径：改 name 成功
 * - 完整 happy path：401 → 404 → 400 → 200
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockKeyFindFirst,
  mockKeyUpdate,
  mockKeyDeleteMany,
  mockDeleteApiKey,
} = vi.hoisted(() => ({
  mockKeyFindFirst: vi.fn(),
  mockKeyUpdate: vi.fn(),
  mockKeyDeleteMany: vi.fn(),
  mockDeleteApiKey: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    externalApiKey: {
      findFirst: mockKeyFindFirst,
      update: mockKeyUpdate,
      deleteMany: mockKeyDeleteMany,
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/mcp/external/auth', () => ({
  deleteApiKey: mockDeleteApiKey,
}));

import { PATCH, DELETE } from '@/app/api/settings/external-keys/[id]/route';
import { auth } from '@/lib/auth';

describe('PATCH /api/settings/external-keys/:id (v0.4 — name only, scope immutable)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);
    mockKeyFindFirst.mockReset();
    mockKeyUpdate.mockReset();
    mockKeyDeleteMany.mockReset();
  });

  const makeReq = (body: unknown) =>
    new NextRequest('http://localhost/api/settings/external-keys/k1', {
      method: 'PATCH',
      body: JSON.stringify(body),
    });

  // ============ 拒绝路径 ============

  it('应该返回 401 当未登录', async () => {
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await PATCH(makeReq({ name: 'X' }), {
      params: Promise.resolve({ id: 'k1' }),
    });
    expect(res.status).toBe(401);
    expect(mockKeyUpdate).not.toHaveBeenCalled();
  });

  it('应该返回 404 当 key 不属于当前用户', async () => {
    mockKeyFindFirst.mockResolvedValue(null);
    const res = await PATCH(makeReq({ name: 'New' }), {
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
    expect(mockKeyUpdate).not.toHaveBeenCalled();
  });

  it('【v0.4 关键】应该返回 400 当 body 携带 scope 字段（即使合法值）', async () => {
    mockKeyFindFirst.mockResolvedValue({ id: 'k1', userId: 'user-123' });
    const res = await PATCH(makeReq({ scope: 'read_write' }), {
      params: Promise.resolve({ id: 'k1' }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.errorCode).toBe('SCOPE_IMMUTABLE');
    expect(mockKeyUpdate).not.toHaveBeenCalled();
  });

  it('应该返回 400 当 body 携带 read scope', async () => {
    mockKeyFindFirst.mockResolvedValue({ id: 'k1', userId: 'user-123' });
    const res = await PATCH(makeReq({ scope: 'read' }), {
      params: Promise.resolve({ id: 'k1' }),
    });
    expect(res.status).toBe(400);
    expect(mockKeyUpdate).not.toHaveBeenCalled();
  });

  it('应该返回 400 当 body 携带 read_report 遗留值', async () => {
    mockKeyFindFirst.mockResolvedValue({ id: 'k1', userId: 'user-123' });
    const res = await PATCH(makeReq({ scope: 'read_report' }), {
      params: Promise.resolve({ id: 'k1' }),
    });
    expect(res.status).toBe(400);
    expect(mockKeyUpdate).not.toHaveBeenCalled();
  });

  it('应该返回 400 当 body 携带非法 scope 字符串', async () => {
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

  it('应该返回 400 当 name 不是字符串', async () => {
    mockKeyFindFirst.mockResolvedValue({ id: 'k1', userId: 'user-123' });
    const res = await PATCH(makeReq({ name: 123 }), {
      params: Promise.resolve({ id: 'k1' }),
    });
    expect(res.status).toBe(400);
  });

  it('应该返回 400 当 body 携带 name 和 scope 两者（scope 优先拒绝）', async () => {
    mockKeyFindFirst.mockResolvedValue({ id: 'k1', userId: 'user-123' });
    const res = await PATCH(makeReq({ name: 'New', scope: 'read_write' }), {
      params: Promise.resolve({ id: 'k1' }),
    });
    expect(res.status).toBe(400);
    expect(mockKeyUpdate).not.toHaveBeenCalled();
  });

  it('应该返回 500 当 DB update 抛错', async () => {
    mockKeyFindFirst.mockResolvedValue({ id: 'k1', userId: 'user-123' });
    mockKeyUpdate.mockRejectedValue(new Error('DB error'));
    const res = await PATCH(makeReq({ name: 'New' }), {
      params: Promise.resolve({ id: 'k1' }),
    });
    expect(res.status).toBe(500);
  });

  // ============ 接受路径 ============

  it('应能成功改 name', async () => {
    mockKeyFindFirst.mockResolvedValue({ id: 'k1', userId: 'user-123' });
    mockKeyUpdate.mockResolvedValue({
      id: 'k1',
      name: 'Renamed',
      permissions: 'read_write',
      lastUsedAt: null,
      expiresAt: null,
      createdAt: new Date('2026-01-01'),
    });

    const res = await PATCH(makeReq({ name: 'Renamed' }), {
      params: Promise.resolve({ id: 'k1' }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.key.name).toBe('Renamed');
    // permissions 字段返回了但**没改**（PATCH 不接受 scope）
    expect(mockKeyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'k1' },
        data: { name: 'Renamed' },
      })
    );
  });

  it('name 会 trim 后再写入', async () => {
    mockKeyFindFirst.mockResolvedValue({ id: 'k1', userId: 'user-123' });
    mockKeyUpdate.mockResolvedValue({
      id: 'k1', name: 'Trimmed', permissions: 'read',
      lastUsedAt: null, expiresAt: null, createdAt: new Date(),
    });

    await PATCH(makeReq({ name: '  Trimmed  ' }), {
      params: Promise.resolve({ id: 'k1' }),
    });
    expect(mockKeyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { name: 'Trimmed' },
      })
    );
  });
});

// ============ DELETE handler 测试 ============

const mockSession = { user: { id: 'user-123', name: 'testuser' } };

describe('DELETE /api/settings/external-keys/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);
    mockDeleteApiKey.mockReset();
  });

  const makeReq = () =>
    new NextRequest('http://localhost/api/settings/external-keys/k1', { method: 'DELETE' });

  it('应该返回 401 当未登录', async () => {
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await DELETE(makeReq(), {
      params: Promise.resolve({ id: 'k1' }),
    });
    expect(res.status).toBe(401);
    expect(mockDeleteApiKey).not.toHaveBeenCalled();
  });

  it('应该成功删除并调 deleteApiKey（带 userId 防止越权）', async () => {
    mockDeleteApiKey.mockResolvedValue({ success: true });
    const res = await DELETE(makeReq(), {
      params: Promise.resolve({ id: 'k1' }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockDeleteApiKey).toHaveBeenCalledWith('user-123', 'k1');
  });

  it('应该返回 404 当 key 不属于当前用户', async () => {
    mockDeleteApiKey.mockResolvedValue({ success: false, error: 'API Key not found or not owned by user' });
    const res = await DELETE(makeReq(), {
      params: Promise.resolve({ id: 'other-user-key' }),
    });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBeDefined();
  });

  it('应该返回 500 当 deleteApiKey 抛错', async () => {
    mockDeleteApiKey.mockRejectedValue(new Error('DB error'));
    const res = await DELETE(makeReq(), {
      params: Promise.resolve({ id: 'k1' }),
    });
    expect(res.status).toBe(500);
  });
});
