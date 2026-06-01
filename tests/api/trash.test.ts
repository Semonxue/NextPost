import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock storage (用于永久删除时清理媒体)
vi.mock('@/lib/storage', () => ({
  deleteFile: vi.fn().mockResolvedValue(undefined),
}));

// Use vi.hoisted
const {
  mockPostFindMany,
  mockPostFindFirst,
  mockPostUpdate,
  mockPostDelete,
  mockAccountFindMany,
  mockAccountFindFirst,
  mockAccountUpdate,
  mockAccountDelete,
} = vi.hoisted(() => ({
  mockPostFindMany: vi.fn(),
  mockPostFindFirst: vi.fn(),
  mockPostUpdate: vi.fn(),
  mockPostDelete: vi.fn(),
  mockAccountFindMany: vi.fn(),
  mockAccountFindFirst: vi.fn(),
  mockAccountUpdate: vi.fn(),
  mockAccountDelete: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    post: {
      findMany: mockPostFindMany,
      findFirst: mockPostFindFirst,
      update: mockPostUpdate,
      delete: mockPostDelete,
    },
    account: {
      findMany: mockAccountFindMany,
      findFirst: mockAccountFindFirst,
      update: mockAccountUpdate,
      delete: mockAccountDelete,
    },
  },
}));


vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

import { GET } from '@/app/api/trash/route';
import { POST as RESTORE_POST } from '@/app/api/trash/posts/[id]/restore/route';
import { POST as RESTORE_ACCOUNT } from '@/app/api/trash/accounts/[id]/restore/route';
import { DELETE as DELETE_POST } from '@/app/api/trash/posts/[id]/route';
import { DELETE as DELETE_ACCOUNT } from '@/app/api/trash/accounts/[id]/route';
import { auth } from '@/lib/auth';

describe('Trash API (v0.3 软删除 + 回收站)', () => {
  const mockSession = {
    user: { id: 'user-123', name: 'testuser' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);
  });

  // 修复 mock 顺序
  // 我们需要在 mock prisma 中添加 account.findMany
  // 这里通过 mockAccountFindMany 单独提供

  describe('GET /api/trash', () => {
    it('应该返回 401 当未登录', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const response = await GET();
      expect(response.status).toBe(401);
    });

    it('应该列出当前用户已软删除的 Post 和 Account', async () => {
      const mockPosts = [
        { id: 'post-1', content: '已删除的帖子', accountId: 'acct-1' },
      ];
      const mockAccounts = [
        { id: 'acct-1', name: '已删除的账号', handle: 'deleted' },
      ];
      mockPostFindMany.mockResolvedValue(mockPosts);
      mockAccountFindMany.mockResolvedValue(mockAccounts);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.posts).toHaveLength(1);
      expect(data.accounts).toHaveLength(1);
      expect(data.totalPosts).toBe(1);
      expect(data.totalAccounts).toBe(1);
    });

    it('应该过滤只查询 deletedAt 不为 null 的项', async () => {
      mockPostFindMany.mockResolvedValue([]);
      mockAccountFindMany.mockResolvedValue([]);
      await GET();

      expect(mockPostFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: { not: null } }),
        })
      );
    });

    it('应该处理数据库错误', async () => {
      mockPostFindMany.mockRejectedValue(new Error('DB error'));
      const response = await GET();
      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/trash/posts/:id/restore', () => {
    it('应该恢复已软删除的帖子', async () => {
      mockPostFindFirst.mockResolvedValue({
        id: 'post-1',
        userId: 'user-123',
        deletedAt: new Date(),
      });
      mockPostUpdate.mockResolvedValue({ id: 'post-1', deletedAt: null });

      const response = await RESTORE_POST(
        new NextRequest('http://localhost/api/trash/posts/post-1/restore'),
        { params: Promise.resolve({ id: 'post-1' }) }
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockPostUpdate).toHaveBeenCalledWith({
        where: { id: 'post-1' },
        data: { deletedAt: null, deletedBy: null, deleteNote: null },
        include: expect.any(Object),
      });
    });

    it('应该返回 404 当帖子未软删除或不属于当前用户', async () => {
      mockPostFindFirst.mockResolvedValue(null);
      const response = await RESTORE_POST(
        new NextRequest('http://localhost/api/trash/posts/post-1/restore'),
        { params: Promise.resolve({ id: 'post-1' }) }
      );
      expect(response.status).toBe(404);
    });

    it('应该返回 401 当未登录', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const response = await RESTORE_POST(
        new NextRequest('http://localhost/api/trash/posts/post-1/restore'),
        { params: Promise.resolve({ id: 'post-1' }) }
      );
      expect(response.status).toBe(401);
    });

    it('应该返回 500 当数据库错误', async () => {
      mockPostFindFirst.mockResolvedValue({
        id: 'post-1',
        userId: 'user-123',
        deletedAt: new Date(),
      });
      mockPostUpdate.mockRejectedValue(new Error('DB error'));
      const response = await RESTORE_POST(
        new NextRequest('http://localhost/api/trash/posts/post-1/restore'),
        { params: Promise.resolve({ id: 'post-1' }) }
      );
      expect(response.status).toBe(500);
    });
  });


  describe('POST /api/trash/accounts/:id/restore', () => {
    it('应该恢复已软删除的账号', async () => {
      mockAccountFindFirst.mockResolvedValue({
        id: 'acct-1',
        userId: 'user-123',
        deletedAt: new Date(),
      });
      mockAccountUpdate.mockResolvedValue({ id: 'acct-1', deletedAt: null });

      const response = await RESTORE_ACCOUNT(
        new NextRequest('http://localhost/api/trash/accounts/acct-1/restore'),
        { params: Promise.resolve({ id: 'acct-1' }) }
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('应该返回 404 当账号未软删除或不属于当前用户', async () => {
      mockAccountFindFirst.mockResolvedValue(null);
      const response = await RESTORE_ACCOUNT(
        new NextRequest('http://localhost/api/trash/accounts/acct-1/restore'),
        { params: Promise.resolve({ id: 'acct-1' }) }
      );
      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/trash/posts/:id（永久删除）', () => {
    it('应该物理删除帖子', async () => {
      mockPostFindFirst.mockResolvedValue({
        id: 'post-1',
        userId: 'user-123',
        mediaUrls: '[]',
        deletedAt: new Date(),
      });
      mockPostDelete.mockResolvedValue({ id: 'post-1' });

      const response = await DELETE_POST(
        new NextRequest('http://localhost/api/trash/posts/post-1'),
        { params: Promise.resolve({ id: 'post-1' }) }
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockPostDelete).toHaveBeenCalledWith({ where: { id: 'post-1' } });
    });

    it('应该返回 404 当帖子未软删除', async () => {
      mockPostFindFirst.mockResolvedValue(null);
      const response = await DELETE_POST(
        new NextRequest('http://localhost/api/trash/posts/post-1'),
        { params: Promise.resolve({ id: 'post-1' }) }
      );
      expect(response.status).toBe(404);
    });

    it('应该返回 401 当未登录', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const response = await DELETE_POST(
        new NextRequest('http://localhost/api/trash/posts/post-1'),
        { params: Promise.resolve({ id: 'post-1' }) }
      );
      expect(response.status).toBe(401);
    });

    it('应该返回 500 当数据库错误', async () => {
      mockPostFindFirst.mockResolvedValue({
        id: 'post-1',
        userId: 'user-123',
        mediaUrls: '[]',
        deletedAt: new Date(),
      });
      mockPostDelete.mockRejectedValue(new Error('DB error'));
      const response = await DELETE_POST(
        new NextRequest('http://localhost/api/trash/posts/post-1'),
        { params: Promise.resolve({ id: 'post-1' }) }
      );
      expect(response.status).toBe(500);
    });

    it('应该跳过 data: 协议的媒体 URL', async () => {
      mockPostFindFirst.mockResolvedValue({
        id: 'post-1',
        userId: 'user-123',
        mediaUrls: JSON.stringify(['data:image/png;base64,abc', '/uploads/test.jpg']),
        deletedAt: new Date(),
      });
      mockPostDelete.mockResolvedValue({ id: 'post-1' });
      const { deleteFile } = await import('@/lib/storage');

      await DELETE_POST(
        new NextRequest('http://localhost/api/trash/posts/post-1'),
        { params: Promise.resolve({ id: 'post-1' }) }
      );

      // data: 开头的 URL 不应该被传递给 deleteFile
      expect(deleteFile).not.toHaveBeenCalledWith('data:image/png;base64,abc');
      // 普通 URL 应该被调用
      expect(deleteFile).toHaveBeenCalledWith('/uploads/test.jpg');
    });

    it('应该处理媒体 URL 解析错误', async () => {
      mockPostFindFirst.mockResolvedValue({
        id: 'post-1',
        userId: 'user-123',
        mediaUrls: 'invalid json {[',
        deletedAt: new Date(),
      });
      mockPostDelete.mockResolvedValue({ id: 'post-1' });

      const response = await DELETE_POST(
        new NextRequest('http://localhost/api/trash/posts/post-1'),
        { params: Promise.resolve({ id: 'post-1' }) }
      );

      // JSON 解析错误不应影响主流程
      expect(response.status).toBe(200);
      expect(mockPostDelete).toHaveBeenCalled();
    });

    it('应该跳过空 URL', async () => {
      mockPostFindFirst.mockResolvedValue({
        id: 'post-1',
        userId: 'user-123',
        mediaUrls: JSON.stringify(['', '/uploads/test.jpg']),
        deletedAt: new Date(),
      });
      mockPostDelete.mockResolvedValue({ id: 'post-1' });

      const { deleteFile } = await import('@/lib/storage');

      await DELETE_POST(
        new NextRequest('http://localhost/api/trash/posts/post-1'),
        { params: Promise.resolve({ id: 'post-1' }) }
      );

      expect(deleteFile).toHaveBeenCalledTimes(1);
      expect(deleteFile).toHaveBeenCalledWith('/uploads/test.jpg');
    });

    it('应该处理 mediaUrls 为 null 的情况', async () => {
      mockPostFindFirst.mockResolvedValue({
        id: 'post-1',
        userId: 'user-123',
        mediaUrls: null,
        deletedAt: new Date(),
      });
      mockPostDelete.mockResolvedValue({ id: 'post-1' });

      const response = await DELETE_POST(
        new NextRequest('http://localhost/api/trash/posts/post-1'),
        { params: Promise.resolve({ id: 'post-1' }) }
      );

      expect(response.status).toBe(200);
    });

    it('应该清理关联的媒体文件', async () => {

      mockPostFindFirst.mockResolvedValue({
        id: 'post-1',
        userId: 'user-123',
        mediaUrls: JSON.stringify(['/uploads/test.jpg']),
        deletedAt: new Date(),
      });
      mockPostDelete.mockResolvedValue({ id: 'post-1' });

      const { deleteFile } = await import('@/lib/storage');

      const response = await DELETE_POST(
        new NextRequest('http://localhost/api/trash/posts/post-1'),
        { params: Promise.resolve({ id: 'post-1' }) }
      );

      expect(response.status).toBe(200);
      expect(deleteFile).toHaveBeenCalledWith('/uploads/test.jpg');
    });
  });

  describe('DELETE /api/trash/accounts/:id（永久删除）', () => {
    it('应该物理删除账号', async () => {
      mockAccountFindFirst.mockResolvedValue({
        id: 'acct-1',
        userId: 'user-123',
        deletedAt: new Date(),
      });
      // 该账号下的帖子查
      mockPostFindMany.mockResolvedValue([]);
      mockAccountDelete.mockResolvedValue({ id: 'acct-1' });


      const response = await DELETE_ACCOUNT(
        new NextRequest('http://localhost/api/trash/accounts/acct-1'),
        { params: Promise.resolve({ id: 'acct-1' }) }
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockAccountDelete).toHaveBeenCalledWith({ where: { id: 'acct-1' } });
    });

    it('应该返回 404 当账号未软删除', async () => {
      mockAccountFindFirst.mockResolvedValue(null);
      const response = await DELETE_ACCOUNT(
        new NextRequest('http://localhost/api/trash/accounts/acct-1'),
        { params: Promise.resolve({ id: 'acct-1' }) }
      );
      expect(response.status).toBe(404);
    });

    it('应该返回 401 当未登录', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const response = await DELETE_ACCOUNT(
        new NextRequest('http://localhost/api/trash/accounts/acct-1'),
        { params: Promise.resolve({ id: 'acct-1' }) }
      );
      expect(response.status).toBe(401);
    });

    it('应该返回 500 当数据库错误', async () => {
      mockAccountFindFirst.mockResolvedValue({
        id: 'acct-1',
        userId: 'user-123',
        deletedAt: new Date(),
      });
      mockPostFindMany.mockResolvedValue([]);
      mockAccountDelete.mockRejectedValue(new Error('DB error'));
      const response = await DELETE_ACCOUNT(
        new NextRequest('http://localhost/api/trash/accounts/acct-1'),
        { params: Promise.resolve({ id: 'acct-1' }) }
      );
      expect(response.status).toBe(500);
    });

    it('应该清理账号下所有帖子的媒体文件', async () => {
      mockAccountFindFirst.mockResolvedValue({
        id: 'acct-1',
        userId: 'user-123',
        deletedAt: new Date(),
      });
      mockPostFindMany.mockResolvedValue([
        { id: 'post-1', mediaUrls: JSON.stringify(['/uploads/p1.jpg']) },
        { id: 'post-2', mediaUrls: JSON.stringify(['/uploads/p2.jpg', '/uploads/p2b.jpg']) },
      ]);
      mockAccountDelete.mockResolvedValue({ id: 'acct-1' });
      const { deleteFile } = await import('@/lib/storage');

      const response = await DELETE_ACCOUNT(
        new NextRequest('http://localhost/api/trash/accounts/acct-1'),
        { params: Promise.resolve({ id: 'acct-1' }) }
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.deletedPosts).toBe(2);
      expect(deleteFile).toHaveBeenCalledWith('/uploads/p1.jpg');
      expect(deleteFile).toHaveBeenCalledWith('/uploads/p2.jpg');
      expect(deleteFile).toHaveBeenCalledWith('/uploads/p2b.jpg');
    });

    it('应该处理帖子媒体 URL 解析错误', async () => {
      mockAccountFindFirst.mockResolvedValue({
        id: 'acct-1',
        userId: 'user-123',
        deletedAt: new Date(),
      });
      mockPostFindMany.mockResolvedValue([
        { id: 'post-1', mediaUrls: 'invalid json' },
        { id: 'post-2', mediaUrls: JSON.stringify(['/uploads/p2.jpg']) },
      ]);
      mockAccountDelete.mockResolvedValue({ id: 'acct-1' });

      const response = await DELETE_ACCOUNT(
        new NextRequest('http://localhost/api/trash/accounts/acct-1'),
        { params: Promise.resolve({ id: 'acct-1' }) }
      );

      // 解析错误不应影响主流程
      expect(response.status).toBe(200);
      expect(response.status).toBe(200);
    });

    it('应该跳过帖子 data: 协议的媒体 URL', async () => {
      mockAccountFindFirst.mockResolvedValue({
        id: 'acct-1',
        userId: 'user-123',
        deletedAt: new Date(),
      });
      mockPostFindMany.mockResolvedValue([
        { id: 'post-1', mediaUrls: JSON.stringify(['data:image/png;base64,abc', '/uploads/p1.jpg']) },
      ]);
      mockAccountDelete.mockResolvedValue({ id: 'acct-1' });
      const { deleteFile } = await import('@/lib/storage');

      const response = await DELETE_ACCOUNT(
        new NextRequest('http://localhost/api/trash/accounts/acct-1'),
        { params: Promise.resolve({ id: 'acct-1' }) }
      );

      expect(response.status).toBe(200);
      expect(deleteFile).not.toHaveBeenCalledWith('data:image/png;base64,abc');
      expect(deleteFile).toHaveBeenCalledWith('/uploads/p1.jpg');
    });

    it('应该处理帖子 mediaUrls 为 null 的情况', async () => {
      mockAccountFindFirst.mockResolvedValue({
        id: 'acct-1',
        userId: 'user-123',
        deletedAt: new Date(),
      });
      mockPostFindMany.mockResolvedValue([
        { id: 'post-1', mediaUrls: null },
      ]);
      mockAccountDelete.mockResolvedValue({ id: 'acct-1' });

      const response = await DELETE_ACCOUNT(
        new NextRequest('http://localhost/api/trash/accounts/acct-1'),
        { params: Promise.resolve({ id: 'acct-1' }) }
      );

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/trash/accounts/:id/restore', () => {
    it('应该返回 401 当未登录', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const response = await RESTORE_ACCOUNT(
        new NextRequest('http://localhost/api/trash/accounts/acct-1/restore'),
        { params: Promise.resolve({ id: 'acct-1' }) }
      );
      expect(response.status).toBe(401);
    });

    it('应该返回 500 当数据库错误', async () => {
      mockAccountFindFirst.mockResolvedValue({
        id: 'acct-1',
        userId: 'user-123',
        deletedAt: new Date(),
      });
      mockAccountUpdate.mockRejectedValue(new Error('DB error'));
      const response = await RESTORE_ACCOUNT(
        new NextRequest('http://localhost/api/trash/accounts/acct-1/restore'),
        { params: Promise.resolve({ id: 'acct-1' }) }
      );
      expect(response.status).toBe(500);
    });
  });
});

