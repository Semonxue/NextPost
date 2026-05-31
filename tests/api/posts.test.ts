import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Use vi.hoisted to properly hoist mock functions
const { mockPostFindMany, mockPostFindFirst, mockPostFindUnique, mockPostCreate, mockPostUpdate, mockPostDelete, mockPostCount, mockAccountFindFirst, mockAccountFindUnique } = vi.hoisted(() => ({
  mockPostFindMany: vi.fn(),
  mockPostFindFirst: vi.fn(),
  mockPostFindUnique: vi.fn(),
  mockPostCreate: vi.fn(),
  mockPostUpdate: vi.fn(),
  mockPostDelete: vi.fn(),
  mockPostCount: vi.fn(),
  mockAccountFindFirst: vi.fn(),
  mockAccountFindUnique: vi.fn(),
}))

// Mock prisma module
vi.mock('@/lib/prisma', () => ({
  default: {
    post: {
      findMany: mockPostFindMany,
      findFirst: mockPostFindFirst,
      findUnique: mockPostFindUnique,
      create: mockPostCreate,
      update: mockPostUpdate,
      delete: mockPostDelete,
      count: mockPostCount,
    },
    account: {
      findFirst: mockAccountFindFirst,
      findUnique: mockAccountFindUnique,
    },
  },
}))

// Mock auth
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

import { GET, POST } from '@/app/api/posts/route'
import { GET as GET_BY_ID, PATCH, DELETE } from '@/app/api/posts/[id]/route'
import { auth } from '@/lib/auth'

describe('Posts API', () => {
  const mockSession = {
    user: { id: 'user-123', name: 'testuser' },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession)
  })

  describe('GET /api/posts', () => {
    it('should return user posts', async () => {
      const mockPosts = [
        { id: 'post-1', content: '内容1', status: 'draft', accountId: 'acct-1' },
        { id: 'post-2', content: '内容2', status: 'scheduled', accountId: 'acct-1' },
      ]
      mockPostFindMany.mockResolvedValue(mockPosts)
      mockPostCount.mockResolvedValue(2)

      const response = await GET(new NextRequest('http://localhost/api/posts'))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.posts).toHaveLength(2)
      expect(data.total).toBe(2)
      expect(mockPostFindMany).toHaveBeenCalled()
    })

    it('should filter by status', async () => {
      const mockPosts = [
        { id: 'post-1', content: '内容1', status: 'draft', accountId: 'acct-1' },
      ]
      mockPostFindMany.mockResolvedValue(mockPosts)
      mockPostCount.mockResolvedValue(1)

      const response = await GET(new NextRequest('http://localhost/api/posts?status=draft'))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockPostFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'draft' }),
        })
      )
    })

    it('should filter by accountId', async () => {
      const mockPosts = [
        { id: 'post-1', content: '内容1', status: 'draft', accountId: 'acct-1' },
      ]
      mockPostFindMany.mockResolvedValue(mockPosts)
      mockPostCount.mockResolvedValue(1)

      const response = await GET(new NextRequest('http://localhost/api/posts?accountId=acct-1'))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockPostFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ accountId: 'acct-1' }),
        })
      )
    })

    it('should return 401 when not authenticated', async () => {
      ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue(null)

      const response = await GET(new NextRequest('http://localhost/api/posts'))
      expect(response.status).toBe(401)
    })
  })

  describe('POST /api/posts', () => {
    it('should create post successfully', async () => {
      mockAccountFindFirst.mockResolvedValue({ id: 'acct-1', userId: 'user-123' })
      mockPostCreate.mockResolvedValue({
        id: 'post-new',
        content: '新帖子内容',
        status: 'scheduled',
        accountId: 'acct-1',
        scheduledTime: new Date('2024-12-01T10:00:00Z'),
      })

      const request = new NextRequest('http://localhost/api/posts', {
        method: 'POST',
        body: JSON.stringify({
          accountId: 'acct-1',
          content: '新帖子内容',
          scheduledTime: '2024-12-01T10:00:00Z',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.content).toBe('新帖子内容')
      expect(data.status).toBe('scheduled')
    })

    it('should create draft when no scheduledTime', async () => {
      mockAccountFindFirst.mockResolvedValue({ id: 'acct-1', userId: 'user-123' })
      mockPostCreate.mockResolvedValue({
        id: 'post-new',
        content: '草稿内容',
        status: 'draft',
        accountId: 'acct-1',
      })

      const request = new NextRequest('http://localhost/api/posts', {
        method: 'POST',
        body: JSON.stringify({
          accountId: 'acct-1',
          content: '草稿内容',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe('draft')
    })

    it('should return 400 when accountId is missing', async () => {
      const request = new NextRequest('http://localhost/api/posts', {
        method: 'POST',
        body: JSON.stringify({ content: '测试内容' }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('请选择账号')
    })

    it('should return 400 when content and mediaUrls are both empty', async () => {
      const request = new NextRequest('http://localhost/api/posts', {
        method: 'POST',
        body: JSON.stringify({ accountId: 'acct-1' }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('内容或媒体不能同时为空')
    })

    it('should return 404 when account not found', async () => {
      mockAccountFindFirst.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/posts', {
        method: 'POST',
        body: JSON.stringify({ accountId: 'acct-999', content: '测试内容' }),
      })

      const response = await POST(request)
      expect(response.status).toBe(404)
    })
  })

  describe('GET /api/posts/:id', () => {
    it('should return post by id', async () => {
      mockPostFindFirst.mockResolvedValue({
        id: 'post-1',
        content: '帖子内容',
        status: 'draft',
        accountId: 'acct-1',
        account: { userId: 'user-123' },
      })

      const response = await GET_BY_ID(
        new NextRequest('http://localhost/api/posts/post-1'),
        { params: Promise.resolve({ id: 'post-1' }) }
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.id).toBe('post-1')
    })

    it('should return 404 when post not found', async () => {
      mockPostFindFirst.mockResolvedValue(null)

      const response = await GET_BY_ID(
        new NextRequest('http://localhost/api/posts/post-999'),
        { params: Promise.resolve({ id: 'post-999' }) }
      )
      expect(response.status).toBe(404)
    })
  })

  describe('PATCH /api/posts/:id', () => {
    it('should update post content', async () => {
      mockPostFindFirst.mockResolvedValue({
        id: 'post-1',
        content: '旧内容',
        status: 'draft',
        accountId: 'acct-1',
        account: { userId: 'user-123' },
      })
      mockPostUpdate.mockResolvedValue({
        id: 'post-1',
        content: '新内容',
        status: 'draft',
      })

      const request = new NextRequest('http://localhost/api/posts/post-1', {
        method: 'PATCH',
        body: JSON.stringify({ content: '新内容' }),
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'post-1' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.content).toBe('新内容')
    })

    it('should update post status', async () => {
      mockPostFindFirst.mockResolvedValue({
        id: 'post-1',
        content: '内容',
        status: 'draft',
        accountId: 'acct-1',
        account: { userId: 'user-123' },
      })
      mockPostUpdate.mockResolvedValue({
        id: 'post-1',
        content: '内容',
        status: 'published',
      })

      const request = new NextRequest('http://localhost/api/posts/post-1', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'published' }),
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'post-1' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe('published')
    })

    it('should return 404 when post not found', async () => {
      mockPostFindFirst.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/posts/post-999', {
        method: 'PATCH',
        body: JSON.stringify({ content: '新内容' }),
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'post-999' }) })
      expect(response.status).toBe(404)
    })
  })

  describe('DELETE /api/posts/:id', () => {
    it('should delete post successfully', async () => {
      mockPostFindFirst.mockResolvedValue({
        id: 'post-1',
        accountId: 'acct-1',
        account: { userId: 'user-123' },
      })
      mockPostDelete.mockResolvedValue({ id: 'post-1' })

      const request = new NextRequest('http://localhost/api/posts/post-1', {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: 'post-1' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(mockPostDelete).toHaveBeenCalled()
    })

    it('should return 404 when post not found', async () => {
      mockPostFindFirst.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/posts/post-999', {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: 'post-999' }) })
      expect(response.status).toBe(404)
    })
  })
})