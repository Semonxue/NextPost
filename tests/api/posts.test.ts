/**
 * Posts API tests
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { mockDb, setupTestDb, truncateAllTables, closeTestDb, schema } from './_db-shim'

vi.mock('@/lib/db', () => mockDb)
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

import { GET, POST } from '@/app/api/posts/route'
import { GET as GET_BY_ID, PATCH, DELETE } from '@/app/api/posts/[id]/route'
import { auth } from '@/lib/auth'

const USER_ID = 'user-test-001'
const PLATFORM_ID = 'platform-twitter-001'
const ACCOUNT_ID = 'acct-test-001'

describe('Posts API', () => {
  beforeAll(async () => { await setupTestDb() })
  afterAll(() => { closeTestDb() })
  beforeEach(async () => {
    await truncateAllTables()
    vi.clearAllMocks()
    ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: USER_ID, name: 'test' } })
    const db = await mockDb.getDb()
    await db.insert(schema.platform).values({ id: PLATFORM_ID, name: 'Twitter', icon: '/icons/twitter.svg' }).returning().get()
    await db.insert(schema.account).values({ id: ACCOUNT_ID, userId: USER_ID, platformId: PLATFORM_ID, name: '测试账号', handle: '@testacc' }).returning().get()
  })

  // ===== GET /api/posts =====
  describe('GET /api/posts', () => {
    it('should return posts as { posts, total }', async () => {
      const db = await mockDb.getDb()
      await db.insert(schema.post).values({ id: 'post-1', userId: USER_ID, accountId: ACCOUNT_ID, content: '帖子1', status: 'draft', mediaUrls: '[]', mediaThumbnails: '[]' }).returning().get()
      await db.insert(schema.post).values({ id: 'post-2', userId: USER_ID, accountId: ACCOUNT_ID, content: '帖子2', status: 'scheduled', mediaUrls: '[]', mediaThumbnails: '[]' }).returning().get()
      const response = await GET(new NextRequest('http://localhost/api/posts'))
      const data = await response.json()
      expect(response.status).toBe(200)
      expect(data.posts).toBeDefined()
      expect(Array.isArray(data.posts)).toBe(true)
      expect(data.posts.length).toBe(2)
      expect(data.total).toBe(2)
    })

    it('should return empty when no posts', async () => {
      const response = await GET(new NextRequest('http://localhost/api/posts'))
      const data = await response.json()
      expect(response.status).toBe(200)
      expect(data.posts).toEqual([])
      expect(data.total).toBe(0)
    })

    it('should return 401 when not authenticated', async () => {
      ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue(null)
      const response = await GET(new NextRequest('http://localhost/api/posts'))
      expect(response.status).toBe(401)
    })

    it('should filter by status', async () => {
      const db = await mockDb.getDb()
      await db.insert(schema.post).values({ id: 'post-draft', userId: USER_ID, accountId: ACCOUNT_ID, content: '草稿', status: 'draft', mediaUrls: '[]', mediaThumbnails: '[]' }).returning().get()
      await db.insert(schema.post).values({ id: 'post-pub', userId: USER_ID, accountId: ACCOUNT_ID, content: '已发布', status: 'published', mediaUrls: '[]', mediaThumbnails: '[]' }).returning().get()
      const response = await GET(new NextRequest('http://localhost/api/posts?status=draft'))
      const data = await response.json()
      expect(data.posts.every((p: any) => p.status === 'draft')).toBe(true)
      expect(data.total).toBe(1)
    })

    it('should search by content keyword', async () => {
      const db = await mockDb.getDb()
      await db.insert(schema.post).values({ id: 'post-match', userId: USER_ID, accountId: ACCOUNT_ID, content: '这是一个旅游帖子', status: 'draft', mediaUrls: '[]', mediaThumbnails: '[]' }).returning().get()
      await db.insert(schema.post).values({ id: 'post-no', userId: USER_ID, accountId: ACCOUNT_ID, content: '无关内容', status: 'draft', mediaUrls: '[]', mediaThumbnails: '[]' }).returning().get()
      const response = await GET(new NextRequest('http://localhost/api/posts?search=旅游'))
      const data = await response.json()
      expect(data.posts.length).toBe(1)
      expect(data.posts[0].id).toBe('post-match')
    })

    it('should exclude deleted posts', async () => {
      const db = await mockDb.getDb()
      await db.insert(schema.post).values({ id: 'post-active', userId: USER_ID, accountId: ACCOUNT_ID, content: '活跃', status: 'draft', mediaUrls: '[]', mediaThumbnails: '[]' }).returning().get()
      await db.insert(schema.post).values({ id: 'post-deleted', userId: USER_ID, accountId: ACCOUNT_ID, content: '已删', status: 'draft', mediaUrls: '[]', mediaThumbnails: '[]', deletedAt: new Date().toISOString() }).returning().get()
      const response = await GET(new NextRequest('http://localhost/api/posts'))
      const data = await response.json()
      expect(data.posts.length).toBe(1)
      expect(data.posts[0].id).toBe('post-active')
    })

    it('should not see other users posts', async () => {
      const db = await mockDb.getDb()
      await db.insert(schema.post).values({ id: 'post-other', userId: 'other-user', accountId: 'other-acct', content: '别人帖子', status: 'draft', mediaUrls: '[]', mediaThumbnails: '[]' }).returning().get()
      const response = await GET(new NextRequest('http://localhost/api/posts'))
      const data = await response.json()
      expect(data.total).toBe(0)
    })

    it('should filter by accountId', async () => {
      const db = await mockDb.getDb()
      const otherAccount = await db.insert(schema.account).values({ id: 'other-acct', userId: USER_ID, platformId: PLATFORM_ID, name: 'Other', handle: '@other' }).returning().get()
      await db.insert(schema.post).values({ id: 'post-acc1', userId: USER_ID, accountId: ACCOUNT_ID, content: '账号1帖', status: 'draft', mediaUrls: '[]', mediaThumbnails: '[]' }).returning().get()
      await db.insert(schema.post).values({ id: 'post-acc2', userId: USER_ID, accountId: otherAccount.id, content: '账号2帖', status: 'draft', mediaUrls: '[]', mediaThumbnails: '[]' }).returning().get()
      const response = await GET(new NextRequest(`http://localhost/api/posts?accountId=${ACCOUNT_ID}`))
      const data = await response.json()
      expect(data.total).toBe(1)
      expect(data.posts[0].id).toBe('post-acc1')
    })

    it('should support limit and offset pagination', async () => {
      const db = await mockDb.getDb()
      for (let i = 0; i < 5; i++) {
        await db.insert(schema.post).values({ id: `post-pag-${i}`, userId: USER_ID, accountId: ACCOUNT_ID, content: `帖子${i}`, status: 'draft', mediaUrls: '[]', mediaThumbnails: '[]' }).returning().get()
      }
      const response = await GET(new NextRequest('http://localhost/api/posts?limit=2&offset=1'))
      const data = await response.json()
      expect(data.posts.length).toBeLessThanOrEqual(2)
      expect(data.total).toBe(5)
    })

    it('should sort by createdAt ascending', async () => {
      const response = await GET(new NextRequest('http://localhost/api/posts?sort=createdAt&order=asc'))
      expect(response.status).toBe(200)
    })

    it('should sort by status', async () => {
      const response = await GET(new NextRequest('http://localhost/api/posts?sort=status&order=asc'))
      expect(response.status).toBe(200)
    })

    it('should sort by scheduledTime', async () => {
      const response = await GET(new NextRequest('http://localhost/api/posts?sort=scheduledTime&order=asc'))
      expect(response.status).toBe(200)
    })

    it('should return 500 when getDb throws on list', async () => {
      const originalGetDb = (mockDb as any).getDb
      ;(mockDb as any).getDb = async () => { throw new Error('DB error') }
      try {
        const response = await GET(new NextRequest('http://localhost/api/posts'))
        expect(response.status).toBe(500)
      } finally {
        ;(mockDb as any).getDb = originalGetDb
      }
    })

    it('should use default sort for invalid sort field', async () => {
      const response = await GET(new NextRequest('http://localhost/api/posts?sort=invalid&order=asc'))
      expect(response.status).toBe(200)
    })

    it('should filter by platformId', async () => {
      const response = await GET(new NextRequest(`http://localhost/api/posts?platformId=${PLATFORM_ID}`))
      expect(response.status).toBe(200)
    })
  })

  // ===== POST /api/posts =====
  describe('POST /api/posts', () => {
    it('should create post with 201', async () => {
      const request = new NextRequest('http://localhost/api/posts', {
        method: 'POST',
        body: JSON.stringify({ accountId: ACCOUNT_ID, content: '新帖子', status: 'draft' }),
      })
      const response = await POST(request)
      const data = await response.json()
      expect(response.status).toBe(201)
      expect(data.content).toBe('新帖子')
      expect(data.id).toBeDefined()
    })

    it('should create post with title and mediaThumbnails', async () => {
      const request = new NextRequest('http://localhost/api/posts', {
        method: 'POST',
        body: JSON.stringify({ accountId: ACCOUNT_ID, content: '带图帖子', title: '标题党', mediaUrls: ['https://x.com/img.jpg'], mediaThumbnails: ['https://x.com/thumb.jpg'] }),
      })
      const response = await POST(request)
      const data = await response.json()
      expect(response.status).toBe(201)
      expect(data.title).toBe('标题党')
    })

    it('should create scheduled post', async () => {
      const request = new NextRequest('http://localhost/api/posts', {
        method: 'POST',
        body: JSON.stringify({ accountId: ACCOUNT_ID, content: '定时帖', status: 'scheduled', scheduledTime: '2025-12-01T10:00:00' }),
      })
      const response = await POST(request)
      const data = await response.json()
      expect(response.status).toBe(201)
      expect(data.status).toBe('scheduled')
    })

    it('should return 400 when content missing', async () => {
      const request = new NextRequest('http://localhost/api/posts', {
        method: 'POST',
        body: JSON.stringify({ accountId: ACCOUNT_ID }),
      })
      const response = await POST(request)
      expect(response.status).toBe(400)
    })

    it('should return 400 when accountId missing', async () => {
      const request = new NextRequest('http://localhost/api/posts', {
        method: 'POST',
        body: JSON.stringify({ content: '测试内容' }),
      })
      const response = await POST(request)
      const data = await response.json()
      expect(response.status).toBe(400)
      expect(data.error).toBe('请选择账号')
    })

    it('should return 401 when not authenticated', async () => {
      ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue(null)
      const request = new NextRequest('http://localhost/api/posts', { method: 'POST', body: JSON.stringify({ accountId: ACCOUNT_ID, content: 't' }) })
      const response = await POST(request)
      expect(response.status).toBe(401)
    })

    it('should return 500 when getDb throws on create', async () => {
      const originalGetDb = (mockDb as any).getDb
      ;(mockDb as any).getDb = async () => { throw new Error('DB error') }
      try {
        const request = new NextRequest('http://localhost/api/posts', { method: 'POST', body: JSON.stringify({ accountId: ACCOUNT_ID, content: 'Error post' }) })
        const response = await POST(request)
        expect(response.status).toBe(500)
      } finally {
        ;(mockDb as any).getDb = originalGetDb
      }
    })
  })

  // ===== GET /api/posts/:id =====
  describe('GET /api/posts/:id', () => {
    it('should return post by id', async () => {
      const db = await mockDb.getDb()
      await db.insert(schema.post).values({ id: 'post-detail', userId: USER_ID, accountId: ACCOUNT_ID, content: '详情帖', status: 'draft', mediaUrls: '[]', mediaThumbnails: '[]' }).returning().get()
      const response = await GET_BY_ID(new NextRequest('http://localhost/api/posts/post-detail'), { params: Promise.resolve({ id: 'post-detail' }) })
      const data = await response.json()
      expect(response.status).toBe(200)
      expect(data.content).toBe('详情帖')
      expect(data.account).toBeDefined()
      expect(data.account.platform).toBeDefined()
    })

    it('should return 404 when not found', async () => {
      const response = await GET_BY_ID(new NextRequest('http://localhost/api/posts/no'), { params: Promise.resolve({ id: 'no' }) })
      expect(response.status).toBe(404)
    })

    it('should return 401 when not authenticated', async () => {
      ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue(null)
      const response = await GET_BY_ID(new NextRequest('http://localhost/api/posts/post-1'), { params: Promise.resolve({ id: 'post-1' }) })
      expect(response.status).toBe(401)
    })
  })

  // ===== PATCH /api/posts/:id =====
  describe('PATCH /api/posts/:id', () => {
    it('should update post content', async () => {
      const db = await mockDb.getDb()
      await db.insert(schema.post).values({ id: 'post-patch', userId: USER_ID, accountId: ACCOUNT_ID, content: '旧内容', status: 'draft', mediaUrls: '[]', mediaThumbnails: '[]' }).returning().get()
      const request = new NextRequest('http://localhost/api/posts/post-patch', { method: 'PATCH', body: JSON.stringify({ content: '新内容' }) })
      const response = await PATCH(request, { params: Promise.resolve({ id: 'post-patch' }) })
      const data = await response.json()
      expect(response.status).toBe(200)
      expect(data.content).toBe('新内容')
    })

    it('should update post status', async () => {
      const db = await mockDb.getDb()
      await db.insert(schema.post).values({ id: 'post-status', userId: USER_ID, accountId: ACCOUNT_ID, content: '状态帖', status: 'draft', mediaUrls: '[]', mediaThumbnails: '[]' }).returning().get()
      const request = new NextRequest('http://localhost/api/posts/post-status', { method: 'PATCH', body: JSON.stringify({ status: 'published' }) })
      const response = await PATCH(request, { params: Promise.resolve({ id: 'post-status' }) })
      const data = await response.json()
      expect(response.status).toBe(200)
      expect(data.status).toBe('published')
    })

    it('should return 404 when not found', async () => {
      const request = new NextRequest('http://localhost/api/posts/no', { method: 'PATCH', body: JSON.stringify({ content: 'n' }) })
      const response = await PATCH(request, { params: Promise.resolve({ id: 'no' }) })
      expect(response.status).toBe(404)
    })

    it('should return 401 when not authenticated', async () => {
      ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue(null)
      const request = new NextRequest('http://localhost/api/posts/post-1', { method: 'PATCH', body: JSON.stringify({ content: 'n' }) })
      const response = await PATCH(request, { params: Promise.resolve({ id: 'post-1' }) })
      expect(response.status).toBe(401)
    })

    it('should update post title', async () => {
      const db = await mockDb.getDb()
      await db.insert(schema.post).values({ id: 'post-ttl', userId: USER_ID, accountId: ACCOUNT_ID, content: '内容', status: 'draft', mediaUrls: '[]', mediaThumbnails: '[]' }).returning().get()
      const request = new NextRequest('http://localhost/api/posts/post-ttl', { method: 'PATCH', body: JSON.stringify({ title: '新标题' }) })
      const response = await PATCH(request, { params: Promise.resolve({ id: 'post-ttl' }) })
      const data = await response.json()
      expect(response.status).toBe(200)
      expect(data.title).toBe('新标题')
    })

    it('should update mediaUrls', async () => {
      const db = await mockDb.getDb()
      await db.insert(schema.post).values({ id: 'post-med', userId: USER_ID, accountId: ACCOUNT_ID, content: '内容', status: 'draft', mediaUrls: '[]', mediaThumbnails: '[]' }).returning().get()
      const request = new NextRequest('http://localhost/api/posts/post-med', { method: 'PATCH', body: JSON.stringify({ mediaUrls: ['https://example.com/img.jpg'] }) })
      const response = await PATCH(request, { params: Promise.resolve({ id: 'post-med' }) })
      expect(response.status).toBe(200)
    })

    it('should update mediaThumbnails', async () => {
      const db = await mockDb.getDb()
      await db.insert(schema.post).values({ id: 'post-thumb', userId: USER_ID, accountId: ACCOUNT_ID, content: '内容', status: 'draft', mediaUrls: '[]', mediaThumbnails: '[]' }).returning().get()
      const request = new NextRequest('http://localhost/api/posts/post-thumb', { method: 'PATCH', body: JSON.stringify({ mediaThumbnails: ['https://example.com/thumb.jpg'] }) })
      const response = await PATCH(request, { params: Promise.resolve({ id: 'post-thumb' }) })
      expect(response.status).toBe(200)
    })

    it('should update scheduledTime and timezone', async () => {
      const db = await mockDb.getDb()
      await db.insert(schema.post).values({ id: 'post-sch', userId: USER_ID, accountId: ACCOUNT_ID, content: '内容', status: 'draft', mediaUrls: '[]', mediaThumbnails: '[]' }).returning().get()
      const request = new NextRequest('http://localhost/api/posts/post-sch', { method: 'PATCH', body: JSON.stringify({ scheduledTime: '2025-06-01T10:00:00', timezone: 'Asia/Shanghai' }) })
      const response = await PATCH(request, { params: Promise.resolve({ id: 'post-sch' }) })
      expect(response.status).toBe(200)
    })

    it('should update accountId', async () => {
      const db = await mockDb.getDb()
      await db.insert(schema.post).values({ id: 'post-ai', userId: USER_ID, accountId: ACCOUNT_ID, content: '内容', status: 'draft', mediaUrls: '[]', mediaThumbnails: '[]' }).returning().get()
      await db.insert(schema.account).values({ id: 'acct-2', userId: USER_ID, platformId: PLATFORM_ID, name: '账号2', handle: '@acc2' }).returning().get()
      const request = new NextRequest('http://localhost/api/posts/post-ai', { method: 'PATCH', body: JSON.stringify({ accountId: 'acct-2' }) })
      const response = await PATCH(request, { params: Promise.resolve({ id: 'post-ai' }) })
      const data = await response.json()
      expect(response.status).toBe(200)
      expect(data.accountId).toBe('acct-2')
    })
  })

  // ===== DELETE /api/posts/:id =====
  describe('DELETE /api/posts/:id', () => {
    it('should soft-delete post and return success', async () => {
      const db = await mockDb.getDb()
      await db.insert(schema.post).values({ id: 'post-del', userId: USER_ID, accountId: ACCOUNT_ID, content: '待删除', status: 'draft', mediaUrls: '[]', mediaThumbnails: '[]' }).returning().get()
      const response = await DELETE(new NextRequest('http://localhost/api/posts/post-del', { method: 'DELETE' }), { params: Promise.resolve({ id: 'post-del' }) })
      const data = await response.json()
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should return 404 when not found', async () => {
      const response = await DELETE(new NextRequest('http://localhost/api/posts/no', { method: 'DELETE' }), { params: Promise.resolve({ id: 'no' }) })
      expect(response.status).toBe(404)
    })

    it('should return 401 when not authenticated', async () => {
      ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue(null)
      const response = await DELETE(new NextRequest('http://localhost/api/posts/post-1', { method: 'DELETE' }), { params: Promise.resolve({ id: 'post-1' }) })
      expect(response.status).toBe(401)
    })

    it('should return 500 when getDb throws on delete', async () => {
      const db = await mockDb.getDb()
      await db.insert(schema.post).values({ id: 'post-err-1', userId: USER_ID, accountId: ACCOUNT_ID, content: 'Error test', status: 'draft', mediaUrls: '[]', mediaThumbnails: '[]' }).returning().get()
      const originalGetDb = (mockDb as any).getDb
      ;(mockDb as any).getDb = async () => { throw new Error('DB error') }
      try {
        const response = await DELETE(new NextRequest('http://localhost/api/posts/post-err-1', { method: 'DELETE' }), { params: Promise.resolve({ id: 'post-err-1' }) })
        expect(response.status).toBe(500)
      } finally {
        ;(mockDb as any).getDb = originalGetDb
      }
    })
  })

  // ===== GET /api/posts/:id error path =====
  describe('GET /api/posts/:id error path', () => {
    it('should return 500 when getDb throws', async () => {
      const db = await mockDb.getDb()
      await db.insert(schema.post).values({ id: 'post-err-2', userId: USER_ID, accountId: ACCOUNT_ID, content: 'Error test 2', status: 'draft', mediaUrls: '[]', mediaThumbnails: '[]' }).returning().get()
      const originalGetDb = (mockDb as any).getDb
      ;(mockDb as any).getDb = async () => { throw new Error('DB error') }
      try {
        const response = await GET_BY_ID(new NextRequest('http://localhost/api/posts/post-err-2'), { params: Promise.resolve({ id: 'post-err-2' }) })
        expect(response.status).toBe(500)
      } finally {
        ;(mockDb as any).getDb = originalGetDb
      }
    })
  })

  // ===== PATCH /api/posts/:id error path =====
  describe('PATCH /api/posts/:id error path', () => {
    it('should return 500 when getDb throws', async () => {
      const db = await mockDb.getDb()
      await db.insert(schema.post).values({ id: 'post-err-3', userId: USER_ID, accountId: ACCOUNT_ID, content: 'Error test 3', status: 'draft', mediaUrls: '[]', mediaThumbnails: '[]' }).returning().get()
      const originalGetDb = (mockDb as any).getDb
      ;(mockDb as any).getDb = async () => { throw new Error('DB error') }
      try {
        const request = new NextRequest('http://localhost/api/posts/post-err-3', { method: 'PATCH', body: JSON.stringify({ content: 'Updated' }) })
        const response = await PATCH(request, { params: Promise.resolve({ id: 'post-err-3' }) })
        expect(response.status).toBe(500)
      } finally {
        ;(mockDb as any).getDb = originalGetDb
      }
    })
  })
})
