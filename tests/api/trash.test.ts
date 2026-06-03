import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Use vi.hoisted
const {
  mockPostFindMany,
  mockPostFindFirst,
  mockPostUpdate,
  mockPostDelete,
  mockPostDeleteMany,
  mockPostCount,
  mockAccountFindMany,
  mockAccountFindFirst,
  mockAccountUpdate,
  mockAccountDelete,
  mockAccountDeleteMany,
  mockAccountCount,
  mockDeleteFile,
} = vi.hoisted(() => ({
  mockPostFindMany: vi.fn(),
  mockPostFindFirst: vi.fn(),
  mockPostUpdate: vi.fn(),
  mockPostDelete: vi.fn(),
  mockPostDeleteMany: vi.fn(),
  mockPostCount: vi.fn(),
  mockAccountFindMany: vi.fn(),
  mockAccountFindFirst: vi.fn(),
  mockAccountUpdate: vi.fn(),
  mockAccountDelete: vi.fn(),
  mockAccountDeleteMany: vi.fn(),
  mockAccountCount: vi.fn(),
  mockDeleteFile: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    post: {
      findMany: mockPostFindMany,
      findFirst: mockPostFindFirst,
      update: mockPostUpdate,
      delete: mockPostDelete,
      deleteMany: mockPostDeleteMany,
      count: mockPostCount,
    },
    account: {
      findMany: mockAccountFindMany,
      findFirst: mockAccountFindFirst,
      update: mockAccountUpdate,
      delete: mockAccountDelete,
      deleteMany: mockAccountDeleteMany,
      count: mockAccountCount,
    },
  },
}));


vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

// Mock storage with configurable behavior
vi.mock('@/lib/storage', () => ({
  deleteFile: mockDeleteFile,
}));

import { GET, DELETE as DELETE_TRASH } from '@/app/api/trash/route';
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
    // Default: deleteFile resolves successfully
    mockDeleteFile.mockResolvedValue(undefined);
  });

  describe('GET /api/trash', () => {
    const makeReq = (qs = '') => new NextRequest(`http://localhost/api/trash${qs}`);

    it('应该返回 401 当未登录', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const response = await GET(makeReq());
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
      mockPostCount.mockResolvedValue(1);
      mockAccountFindMany.mockResolvedValue(mockAccounts);
      mockAccountCount.mockResolvedValue(1);

      const response = await GET(makeReq());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.posts).toHaveLength(1);
      expect(data.accounts).toHaveLength(1);
      expect(data.totalPosts).toBe(1);
      expect(data.totalAccounts).toBe(1);
    });

    it('应该过滤只查询 deletedAt 不为 null 的项', async () => {
      mockPostFindMany.mockResolvedValue([]);
      mockPostCount.mockResolvedValue(0);
      mockAccountFindMany.mockResolvedValue([]);
      mockAccountCount.mockResolvedValue(0);
      await GET(makeReq());

      expect(mockPostFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: { not: null } }),
        })
      );
    });

    it('应该处理数据库错误', async () => {
      mockPostFindMany.mockRejectedValue(new Error('DB error'));
      const response = await GET(makeReq());
      expect(response.status).toBe(500);
    });

    it('应该支持分页参数 postsLimit/postsOffset/accountsLimit/accountsOffset', async () => {
      mockPostFindMany.mockResolvedValue([]);
      mockPostCount.mockResolvedValue(0);
      mockAccountFindMany.mockResolvedValue([]);
      mockAccountCount.mockResolvedValue(0);

      await GET(makeReq('?postsLimit=10&postsOffset=20&accountsLimit=5&accountsOffset=10'));

      expect(mockPostFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10, skip: 20 }),
      );
      expect(mockAccountFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5, skip: 10 }),
      );
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

      await DELETE_POST(
        new NextRequest('http://localhost/api/trash/posts/post-1'),
        { params: Promise.resolve({ id: 'post-1' }) }
      );

      expect(mockDeleteFile).not.toHaveBeenCalledWith('data:image/png;base64,abc');
      expect(mockDeleteFile).toHaveBeenCalledWith('/uploads/test.jpg');
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

      await DELETE_POST(
        new NextRequest('http://localhost/api/trash/posts/post-1'),
        { params: Promise.resolve({ id: 'post-1' }) }
      );

      expect(mockDeleteFile).toHaveBeenCalledTimes(1);
      expect(mockDeleteFile).toHaveBeenCalledWith('/uploads/test.jpg');
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

      const response = await DELETE_POST(
        new NextRequest('http://localhost/api/trash/posts/post-1'),
        { params: Promise.resolve({ id: 'post-1' }) }
      );

      expect(response.status).toBe(200);
      expect(mockDeleteFile).toHaveBeenCalledWith('/uploads/test.jpg');
    });

    it('应该处理 deleteFile 失败（不阻塞主流程）', async () => {
      mockPostFindFirst.mockResolvedValue({
        id: 'post-1',
        userId: 'user-123',
        mediaUrls: JSON.stringify(['/uploads/test.jpg']),
        deletedAt: new Date(),
      });
      mockPostDelete.mockResolvedValue({ id: 'post-1' });
      mockDeleteFile.mockRejectedValue(new Error('File delete failed'));

      const response = await DELETE_POST(
        new NextRequest('http://localhost/api/trash/posts/post-1'),
        { params: Promise.resolve({ id: 'post-1' }) }
      );

      expect(response.status).toBe(200);
    });
  });

  describe('DELETE /api/trash/accounts/:id（永久删除）', () => {
    it('应该物理删除账号', async () => {
      mockAccountFindFirst.mockResolvedValue({
        id: 'acct-1',
        userId: 'user-123',
        deletedAt: new Date(),
      });
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

      const response = await DELETE_ACCOUNT(
        new NextRequest('http://localhost/api/trash/accounts/acct-1'),
        { params: Promise.resolve({ id: 'acct-1' }) }
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.deletedPosts).toBe(2);
      expect(mockDeleteFile).toHaveBeenCalledWith('/uploads/p1.jpg');
      expect(mockDeleteFile).toHaveBeenCalledWith('/uploads/p2.jpg');
      expect(mockDeleteFile).toHaveBeenCalledWith('/uploads/p2b.jpg');
      expect(mockDeleteFile).toHaveBeenCalledTimes(3);
    });

    it('应该处理 deleteFile 失败（账号删除不阻塞）', async () => {
      mockAccountFindFirst.mockResolvedValue({
        id: 'acct-1',
        userId: 'user-123',
        deletedAt: new Date(),
      });
      mockPostFindMany.mockResolvedValue([
        { id: 'post-1', mediaUrls: JSON.stringify(['/uploads/p1.jpg']) },
      ]);
      mockAccountDelete.mockResolvedValue({ id: 'acct-1' });
      mockDeleteFile.mockRejectedValue(new Error('File delete failed'));

      const response = await DELETE_ACCOUNT(
        new NextRequest('http://localhost/api/trash/accounts/acct-1'),
        { params: Promise.resolve({ id: 'acct-1' }) }
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('应该跳过 data: 协议的媒体 URL（账号删除）', async () => {
      mockAccountFindFirst.mockResolvedValue({
        id: 'acct-1',
        userId: 'user-123',
        deletedAt: new Date(),
      });
      mockPostFindMany.mockResolvedValue([
        { id: 'post-1', mediaUrls: JSON.stringify(['data:image/png;base64,abc', '/uploads/test.jpg']) },
      ]);
      mockAccountDelete.mockResolvedValue({ id: 'acct-1' });

      await DELETE_ACCOUNT(
        new NextRequest('http://localhost/api/trash/accounts/acct-1'),
        { params: Promise.resolve({ id: 'acct-1' }) }
      );

      expect(mockDeleteFile).not.toHaveBeenCalledWith('data:image/png;base64,abc');
      expect(mockDeleteFile).toHaveBeenCalledWith('/uploads/test.jpg');
    });
  });

  describe('DELETE /api/trash（清空回收站）', () => {
    const makeReq = () => new NextRequest('http://localhost/api/trash');

    it('应该清空回收站成功', async () => {
      mockPostFindMany.mockResolvedValue([
        { id: 'post-1', mediaUrls: JSON.stringify(['/uploads/p1.jpg']) },
        { id: 'post-2', mediaUrls: JSON.stringify(['/uploads/p2.jpg']) },
      ]);
      mockAccountFindMany.mockResolvedValue([
        { id: 'acct-1' },
        { id: 'acct-2' },
      ]);
      mockPostDeleteMany.mockResolvedValue({ count: 2 });
      mockAccountDeleteMany.mockResolvedValue({ count: 2 });

      const response = await DELETE_TRASH(makeReq());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.deletedPosts).toBe(2);
      expect(data.deletedAccounts).toBe(2);
      expect(mockPostDeleteMany).toHaveBeenCalled();
      expect(mockAccountDeleteMany).toHaveBeenCalled();
      expect(mockDeleteFile).toHaveBeenCalledWith('/uploads/p1.jpg');
      expect(mockDeleteFile).toHaveBeenCalledWith('/uploads/p2.jpg');
    });

    it('应该返回 401 当未登录', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const response = await DELETE_TRASH(makeReq());
      expect(response.status).toBe(401);
    });

    it('应该返回 500 当数据库错误', async () => {
      mockPostFindMany.mockRejectedValue(new Error('DB error'));
      const response = await DELETE_TRASH(makeReq());
      expect(response.status).toBe(500);
    });

    it('应该跳过 data: 协议的媒体 URL（清空回收站）', async () => {
      mockPostFindMany.mockResolvedValue([
        { id: 'post-1', mediaUrls: JSON.stringify(['data:image/png;base64,abc', '/uploads/test.jpg']) },
      ]);
      mockAccountFindMany.mockResolvedValue([]);
      mockPostDeleteMany.mockResolvedValue({ count: 1 });
      mockAccountDeleteMany.mockResolvedValue({ count: 0 });

      await DELETE_TRASH(makeReq());

      expect(mockDeleteFile).not.toHaveBeenCalledWith('data:image/png;base64,abc');
      expect(mockDeleteFile).toHaveBeenCalledWith('/uploads/test.jpg');
    });

    it('应该处理媒体 URL 解析错误（清空回收站）', async () => {
      mockPostFindMany.mockResolvedValue([
        { id: 'post-1', mediaUrls: 'invalid json {[' },
      ]);
      mockAccountFindMany.mockResolvedValue([]);
      mockPostDeleteMany.mockResolvedValue({ count: 1 });
      mockAccountDeleteMany.mockResolvedValue({ count: 0 });

      const response = await DELETE_TRASH(makeReq());

      expect(response.status).toBe(200);
    });

    it('应该处理空回收站', async () => {
      mockPostFindMany.mockResolvedValue([]);
      mockAccountFindMany.mockResolvedValue([]);
      mockPostDeleteMany.mockResolvedValue({ count: 0 });
      mockAccountDeleteMany.mockResolvedValue({ count: 0 });

      const response = await DELETE_TRASH(makeReq());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.deletedPosts).toBe(0);
      expect(data.deletedAccounts).toBe(0);
    });

    it('应该处理媒体 URL JSON 解析错误（不阻塞删除）', async () => {
      mockPostFindMany.mockResolvedValue([
        { id: 'post-1', mediaUrls: '{[invalid json' }, // 非法 JSON
      ]);
      mockAccountFindMany.mockResolvedValue([]);
      mockPostDeleteMany.mockResolvedValue({ count: 1 });
      mockAccountDeleteMany.mockResolvedValue({ count: 0 });

      const response = await DELETE_TRASH(makeReq());

      expect(response.status).toBe(200);
      // JSON 解析失败后仍应删除成功
      expect(mockPostDeleteMany).toHaveBeenCalled();
    });

    it('应该处理 deleteFile 失败（单个文件清理失败不阻塞主流程）', async () => {
      mockPostFindMany.mockResolvedValue([
        { id: 'post-1', mediaUrls: JSON.stringify(['/uploads/p1.jpg', '/uploads/p2.jpg']) },
      ]);
      mockAccountFindMany.mockResolvedValue([]);
      mockPostDeleteMany.mockResolvedValue({ count: 1 });
      mockAccountDeleteMany.mockResolvedValue({ count: 0 });

      // 第一个文件删除失败，第二个成功
      mockDeleteFile
        .mockRejectedValueOnce(new Error('S3 error'))
        .mockResolvedValueOnce(undefined);

      const response = await DELETE_TRASH(makeReq());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      // 两个文件都被尝试删除
      expect(mockDeleteFile).toHaveBeenCalledTimes(2);
    });
  });
});
