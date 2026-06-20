/**
 * Trash API tests
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { mockDb, setupTestDb, truncateAllTables, closeTestDb, schema } from './_db-shim'

vi.mock('@/lib/db', () => mockDb)
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

import { GET } from '@/app/api/trash/route'
import { auth } from '@/lib/auth'

const USER_ID = 'user-test-001'
const PLATFORM_ID = 'platform-twitter-001'

describe('Trash API', () => {
  beforeAll(async () => { await setupTestDb() })
  afterAll(() => { closeTestDb() })
  beforeEach(async () => {
    await truncateAllTables()
    vi.clearAllMocks()
    ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: USER_ID, name: 'test' } })
  })

  it('should return 401 when not authenticated', async () => {
    ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const response = await GET(new NextRequest('http://localhost/api/trash'))
    expect(response.status).toBe(401)
  })

  it('should return 500 when getDb throws', async () => {
    const originalGetDb = (mockDb as any).getDb
    ;(mockDb as any).getDb = async () => { throw new Error('DB error') }
    try {
      const response = await GET(new NextRequest('http://localhost/api/trash'))
      expect(response.status).toBe(500)
    } finally {
      ;(mockDb as any).getDb = originalGetDb
    }
  })

  it('should return deleted accounts', async () => {
    const db = await mockDb.getDb()
    await db.insert(schema.account).values({ id: 'acc-trash-1', userId: USER_ID, platformId: PLATFORM_ID, name: 'Trashed Account', handle: '@trashed', deletedAt: new Date().toISOString(), deletedBy: 'user' }).returning().get()
    const response = await GET(new NextRequest('http://localhost/api/trash'))
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.accounts).toBeDefined()
  })

  it('should return empty trash when nothing deleted', async () => {
    const response = await GET(new NextRequest('http://localhost/api/trash'))
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.posts).toBeDefined()
  })

  it('should return only deleted items', async () => {
    const db = await mockDb.getDb()
    await db.insert(schema.post).values({ id: 'post-active', userId: USER_ID, accountId: 'acc1', content: 'active', status: 'draft', mediaUrls: '[]', mediaThumbnails: '[]' }).returning().get()
    await db.insert(schema.post).values({ id: 'post-deleted', userId: USER_ID, accountId: 'acc1', content: 'deleted', status: 'draft', mediaUrls: '[]', mediaThumbnails: '[]', deletedAt: new Date().toISOString() }).returning().get()
    const response = await GET(new NextRequest('http://localhost/api/trash'))
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.posts.length).toBe(1)
  })
})
