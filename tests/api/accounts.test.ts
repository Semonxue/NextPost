/**
 * Accounts API tests
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { mockDb, setupTestDb, truncateAllTables, closeTestDb, schema } from './_db-shim'

vi.mock('@/lib/db', () => mockDb)
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

import { GET, POST } from '@/app/api/accounts/route'
import { GET as GET_BY_ID, PATCH, DELETE } from '@/app/api/accounts/[id]/route'
import { auth } from '@/lib/auth'
import { eq } from 'drizzle-orm'

const USER_ID = 'user-test-001'
const PLATFORM_ID = 'platform-twitter-001'

describe('Accounts API', () => {
  beforeAll(async () => { await setupTestDb() })
  afterAll(() => { closeTestDb() })
  beforeEach(async () => {
    await truncateAllTables()
    vi.clearAllMocks()
    ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: USER_ID, name: 'test' } })
    await setupTestDb()
    await mockDb.getDb().then(db =>
      db.insert(schema.platform).values({ id: PLATFORM_ID, name: 'Twitter', icon: '/icons/twitter.svg' }).returning().get()
    )
  })

  describe('GET /api/accounts', () => {
    it('should return user accounts', async () => {
      const db = await mockDb.getDb()
      await db.insert(schema.account).values({ id: 'acct-1', userId: USER_ID, platformId: PLATFORM_ID, name: '账号1', handle: 'acc1' }).returning().get()
      await db.insert(schema.account).values({ id: 'acct-2', userId: USER_ID, platformId: PLATFORM_ID, name: '账号2', handle: 'acc2' }).returning().get()

      const response = await GET()
      const data = await response.json()
      expect(response.status).toBe(200)
      expect(data.accounts).toBeDefined()
      expect(Array.isArray(data.accounts)).toBe(true)
      expect(data.accounts.length).toBe(2)
    })

    it('should return empty accounts when none exist', async () => {
      const response = await GET()
      const data = await response.json()
      expect(response.status).toBe(200)
      expect(data.accounts).toEqual([])
    })

    it('should return 401 when not authenticated', async () => {
      ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue(null)
      const response = await GET()
      expect(response.status).toBe(401)
    })

    it('should exclude deleted accounts', async () => {
      const db = await mockDb.getDb()
      await db.insert(schema.account).values({ id: 'acct-active', userId: USER_ID, platformId: PLATFORM_ID, name: '活跃账号', handle: 'active' }).returning().get()
      await db.insert(schema.account).values({ id: 'acct-deleted', userId: USER_ID, platformId: PLATFORM_ID, name: '已删除账号', handle: 'deleted', deletedAt: new Date().toISOString(), deletedBy: 'user' }).returning().get()
      const response = await GET()
      const data = await response.json()
      expect(data.accounts.length).toBe(1)
      expect(data.accounts[0].name).toBe('活跃账号')
    })
  })

  describe('POST /api/accounts', () => {
    it('should create account with 201', async () => {
      const request = new NextRequest('http://localhost/api/accounts', {
        method: 'POST',
        body: JSON.stringify({ name: '新账号', handle: '@newacc', platformId: PLATFORM_ID }),
      })
      const response = await POST(request)
      const data = await response.json()
      expect(response.status).toBe(201)
      expect(data.name).toBe('新账号')
    })

    it('should create account with description', async () => {
      const request = new NextRequest('http://localhost/api/accounts', {
        method: 'POST',
        body: JSON.stringify({ name: '带描述账号', handle: '@withdesc', platformId: PLATFORM_ID, description: '这是一个描述' }),
      })
      const response = await POST(request)
      const data = await response.json()
      expect(response.status).toBe(201)
      expect(data.description).toBe('这是一个描述')
    })

    it('should return 400 when name is missing', async () => {
      const request = new NextRequest('http://localhost/api/accounts', {
        method: 'POST',
        body: JSON.stringify({ handle: '@testacc', platformId: PLATFORM_ID }),
      })
      const response = await POST(request)
      const data = await response.json()
      expect(response.status).toBe(400)
      expect(data.error).toBe('名称和handle不能为空')
    })

    it('should return 400 when handle is missing', async () => {
      const request = new NextRequest('http://localhost/api/accounts', {
        method: 'POST',
        body: JSON.stringify({ name: '测试账号', platformId: PLATFORM_ID }),
      })
      const response = await POST(request)
      const data = await response.json()
      expect(response.status).toBe(400)
      expect(data.error).toBe('名称和handle不能为空')
    })

    it('should return 400 when platformId is missing', async () => {
      const request = new NextRequest('http://localhost/api/accounts', {
        method: 'POST',
        body: JSON.stringify({ name: '测试账号', handle: '@test' }),
      })
      const response = await POST(request)
      const data = await response.json()
      expect(response.status).toBe(400)
      expect(data.error).toBe('请选择平台')
    })

    it('should return 401 when not authenticated', async () => {
      ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue(null)
      const request = new NextRequest('http://localhost/api/accounts', {
        method: 'POST',
        body: JSON.stringify({ name: '新账号', handle: '@new', platformId: PLATFORM_ID }),
      })
      const response = await POST(request)
      expect(response.status).toBe(401)
    })

    it('should create account with description', async () => {
      const request = new NextRequest('http://localhost/api/accounts', {
        method: 'POST',
        body: JSON.stringify({ name: '带描述账号', handle: '@desc', platformId: PLATFORM_ID, description: '我的账号描述' }),
      })
      const response = await POST(request)
      const data = await response.json()
      expect(response.status).toBe(201)
      expect(data.description).toBe('我的账号描述')
    })
  })

  describe('PATCH /api/accounts/:id', () => {
    it('should update account successfully', async () => {
      const db = await mockDb.getDb()
      await db.insert(schema.account).values({ id: 'acct-1', userId: USER_ID, platformId: PLATFORM_ID, name: '旧名称', handle: 'oldacc' }).returning().get()
      const request = new NextRequest('http://localhost/api/accounts/acct-1', {
        method: 'PATCH',
        body: JSON.stringify({ name: '新名称' }),
      })
      const response = await PATCH(request, { params: Promise.resolve({ id: 'acct-1' }) })
      const data = await response.json()
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should update account description', async () => {
      const db = await mockDb.getDb()
      await db.insert(schema.account).values({ id: 'acct-desc', userId: USER_ID, platformId: PLATFORM_ID, name: '旧名称', handle: 'oldacc' }).returning().get()
      const request = new NextRequest('http://localhost/api/accounts/acct-desc', {
        method: 'PATCH',
        body: JSON.stringify({ description: '新描述' }),
      })
      const response = await PATCH(request, { params: Promise.resolve({ id: 'acct-desc' }) })
      expect(response.status).toBe(200)
    })

    it('should update account platformId', async () => {
      const db = await mockDb.getDb()
      await db.insert(schema.account).values({ id: 'acct-plat', userId: USER_ID, platformId: PLATFORM_ID, name: '名称', handle: 'accplat' }).returning().get()
      await db.insert(schema.platform).values({ id: 'platform-ins-001', name: 'Instagram', icon: '/icons/instagram.svg' }).returning().get()
      const request = new NextRequest('http://localhost/api/accounts/acct-plat', {
        method: 'PATCH',
        body: JSON.stringify({ platformId: 'platform-ins-001' }),
      })
      const response = await PATCH(request, { params: Promise.resolve({ id: 'acct-plat' }) })
      expect(response.status).toBe(200)
    })

    it('should return 404 when not found', async () => {
      const request = new NextRequest('http://localhost/api/accounts/non-existent', {
        method: 'PATCH',
        body: JSON.stringify({ name: '新名称' }),
      })
      const response = await PATCH(request, { params: Promise.resolve({ id: 'non-existent' }) })
      expect(response.status).toBe(404)
    })

    it('should return 401 when not authenticated', async () => {
      ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue(null)
      const request = new NextRequest('http://localhost/api/accounts/acct-1', { method: 'PATCH', body: JSON.stringify({ name: 'n' }) })
      const response = await PATCH(request, { params: Promise.resolve({ id: 'acct-1' }) })
      expect(response.status).toBe(401)
    })
  })

  describe('DELETE /api/accounts/:id', () => {
    it('should soft-delete account', async () => {
      const db = await mockDb.getDb()
      await db.insert(schema.account).values({ id: 'acct-del-1', userId: USER_ID, platformId: PLATFORM_ID, name: '要删除', handle: 'delacc' }).returning().get()
      const response = await DELETE(new NextRequest('http://localhost/api/accounts/acct-del-1', { method: 'DELETE' }), { params: Promise.resolve({ id: 'acct-del-1' }) })
      const data = await response.json()
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      const deleted = await db.select().from(schema.account).where(eq(schema.account.id, 'acct-del-1')).get()
      expect(deleted?.deletedAt).toBeDefined()
    })

    it('should also soft-delete posts belonging to account', async () => {
      const db = await mockDb.getDb()
      await db.insert(schema.account).values({ id: 'acct-del-2', userId: USER_ID, platformId: PLATFORM_ID, name: '账号', handle: 'acc' }).returning().get()
      await db.insert(schema.post).values({ id: 'post-to-delete', userId: USER_ID, accountId: 'acct-del-2', content: 'draft', status: 'draft', mediaUrls: '[]', mediaThumbnails: '[]' }).returning().get()
      await DELETE(new NextRequest('http://localhost/api/accounts/acct-del-2', { method: 'DELETE' }), { params: Promise.resolve({ id: 'acct-del-2' }) })
      const deletedPost = await db.select().from(schema.post).where(eq(schema.post.id, 'post-to-delete')).get()
      expect(deletedPost?.deletedAt).toBeDefined()
    })

    it('should return 404 when not found', async () => {
      const response = await DELETE(new NextRequest('http://localhost/api/accounts/non-existent', { method: 'DELETE' }), { params: Promise.resolve({ id: 'non-existent' }) })
      expect(response.status).toBe(404)
    })

    it('should return 401 when not authenticated', async () => {
      ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue(null)
      const response = await DELETE(new NextRequest('http://localhost/api/accounts/acct-1', { method: 'DELETE' }), { params: Promise.resolve({ id: 'acct-1' }) })
      expect(response.status).toBe(401)
    })
  })

  // ===== Error path: GET /api/accounts =====
  describe('GET /api/accounts error path', () => {
    it('should return 500 when getDb throws', async () => {
      // Override getDb to throw during this test
      const originalGetDb = (mockDb as any).getDb
      ;(mockDb as any).getDb = async () => { throw new Error('DB error') }
      try {
        const response = await GET()
        expect(response.status).toBe(500)
      } finally {
        ;(mockDb as any).getDb = originalGetDb
      }
    })
  })

  // ===== Error path: POST /api/accounts =====
  describe('POST /api/accounts error path', () => {
    it('should return 500 when getDb throws on insert', async () => {
      const originalGetDb = (mockDb as any).getDb
      ;(mockDb as any).getDb = async () => { throw new Error('DB error') }
      try {
        const request = new NextRequest('http://localhost/api/accounts', {
          method: 'POST',
          body: JSON.stringify({ name: '新账号', handle: '@new', platformId: PLATFORM_ID }),
        })
        const response = await POST(request)
        expect(response.status).toBe(500)
      } finally {
        ;(mockDb as any).getDb = originalGetDb
      }
    })
  })

  // ===== PATCH /api/accounts/:id error path =====
  describe('PATCH /api/accounts/:id error path', () => {
    it('should return 500 when getDb throws', async () => {
      const db = await mockDb.getDb()
      await db.insert(schema.account).values({ id: 'acct-err-1', userId: USER_ID, platformId: PLATFORM_ID, name: 'Error Test', handle: '@err1' }).returning().get()
      const originalGetDb = (mockDb as any).getDb
      ;(mockDb as any).getDb = async () => { throw new Error('DB error') }
      try {
        const request = new NextRequest('http://localhost/api/accounts/acct-err-1', { method: 'PATCH', body: JSON.stringify({ name: 'Updated' }) })
        const response = await PATCH(request, { params: Promise.resolve({ id: 'acct-err-1' }) })
        expect(response.status).toBe(500)
      } finally {
        ;(mockDb as any).getDb = originalGetDb
      }
    })
  })

  // ===== DELETE /api/accounts/:id error path =====
  describe('DELETE /api/accounts/:id error path', () => {
    it('should return 500 when getDb throws', async () => {
      const db = await mockDb.getDb()
      await db.insert(schema.account).values({ id: 'acct-err-2', userId: USER_ID, platformId: PLATFORM_ID, name: 'Error Test 2', handle: '@err2' }).returning().get()
      const originalGetDb = (mockDb as any).getDb
      ;(mockDb as any).getDb = async () => { throw new Error('DB error') }
      try {
        const response = await DELETE(new NextRequest('http://localhost/api/accounts/acct-err-2', { method: 'DELETE' }), { params: Promise.resolve({ id: 'acct-err-2' }) })
        expect(response.status).toBe(500)
      } finally {
        ;(mockDb as any).getDb = originalGetDb
      }
    })
  })

  // ===== GET /api/accounts/:id error path =====
  describe('GET /api/accounts/:id error path', () => {
    it('should return 500 when getDb throws', async () => {
      const db = await mockDb.getDb()
      await db.insert(schema.account).values({ id: 'acct-err-3', userId: USER_ID, platformId: PLATFORM_ID, name: 'Error Test 3', handle: '@err3' }).returning().get()
      const originalGetDb = (mockDb as any).getDb
      ;(mockDb as any).getDb = async () => { throw new Error('DB error') }
      try {
        const response = await GET_BY_ID(new NextRequest('http://localhost/api/accounts/acct-err-3'), { params: Promise.resolve({ id: 'acct-err-3' }) })
        expect(response.status).toBe(500)
      } finally {
        ;(mockDb as any).getDb = originalGetDb
      }
    })
  })

  // ===== GET /api/accounts/:id =====
  describe('GET /api/accounts/:id', () => {
    it('should return account by id', async () => {
      const db = await mockDb.getDb()
      await db.insert(schema.account).values({ id: 'acct-get-1', userId: USER_ID, platformId: PLATFORM_ID, name: '获取账号', handle: '@get1' }).returning().get()
      const response = await GET_BY_ID(new NextRequest('http://localhost/api/accounts/acct-get-1'), { params: Promise.resolve({ id: 'acct-get-1' }) })
      const data = await response.json()
      expect(response.status).toBe(200)
      expect(data.name).toBe('获取账号')
    })

    it('should return 404 when not found', async () => {
      const response = await GET_BY_ID(new NextRequest('http://localhost/api/accounts/no-such'), { params: Promise.resolve({ id: 'no-such' }) })
      expect(response.status).toBe(404)
    })

    it('should return 401 when not authenticated', async () => {
      ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue(null)
      const response = await GET_BY_ID(new NextRequest('http://localhost/api/accounts/acct-get-1'), { params: Promise.resolve({ id: 'acct-get-1' }) })
      expect(response.status).toBe(401)
    })

    it('should not return other users accounts', async () => {
      const db = await mockDb.getDb()
      await db.insert(schema.account).values({ id: 'acct-other', userId: 'other-user', platformId: PLATFORM_ID, name: '别人账号', handle: '@other' }).returning().get()
      const response = await GET_BY_ID(new NextRequest('http://localhost/api/accounts/acct-other'), { params: Promise.resolve({ id: 'acct-other' }) })
      expect(response.status).toBe(404)
    })
  })
})
