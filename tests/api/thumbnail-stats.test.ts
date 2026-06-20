/**
 * Stats API tests
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { mockDb, setupTestDb, truncateAllTables, closeTestDb, schema } from './_db-shim'

vi.mock('@/lib/db', () => mockDb)
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

import { GET } from '@/app/api/stats/route'
import { formatBytes } from '@/lib/utils'
import { auth } from '@/lib/auth'

const USER_ID = 'stats-user-001'

describe('Stats API', () => {
  beforeAll(async () => { await setupTestDb() })
  afterAll(() => { closeTestDb() })
  beforeEach(async () => {
    await truncateAllTables()
    vi.clearAllMocks()
    ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: USER_ID, name: 'test' } })
  })

  describe('GET /api/stats', () => {
    it('should return 401 when not authenticated', async () => {
      ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue(null)
      const response = await GET()
      expect(response.status).toBe(401)
    })

    it('should return 500 when getDb throws', async () => {
      ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: USER_ID, name: 'test' } })
      const originalGetDb = (mockDb as any).getDb
      ;(mockDb as any).getDb = async () => { throw new Error('DB error') }
      try {
        const response = await GET()
        expect(response.status).toBe(500)
      } finally {
        ;(mockDb as any).getDb = originalGetDb
      }
    })

    it('should return zero counts when no data', async () => {
      const response = await GET()
      const data = await response.json()
      expect(response.status).toBe(200)
      expect(data.totalPosts).toBe(0)
      expect(data.draftPosts).toBe(0)
      expect(data.scheduledPosts).toBe(0)
      expect(data.publishedPosts).toBe(0)
      expect(data.totalAccounts).toBe(0)
    })

    it('should return correct counts after seeding data', async () => {
      const db = await mockDb.getDb()
      await db.insert(schema.account).values({ id: 'acc-stats-1', userId: USER_ID, platformId: 'p1', name: 'Twitter', handle: 'test' }).returning().get()
      await db.insert(schema.post).values({ id: 'post-draft-1', userId: USER_ID, accountId: 'acc-stats-1', content: 'draft post', status: 'draft', mediaUrls: '[]', mediaThumbnails: '[]' }).returning().get()
      await db.insert(schema.post).values({ id: 'post-scheduled-1', userId: USER_ID, accountId: 'acc-stats-1', content: 'scheduled post', status: 'scheduled', mediaUrls: '[]', mediaThumbnails: '[]' }).returning().get()
      await db.insert(schema.post).values({ id: 'post-published-1', userId: USER_ID, accountId: 'acc-stats-1', content: 'published post', status: 'published', mediaUrls: '[]', mediaThumbnails: '[]' }).returning().get()
      // Deleted post — should not be counted
      await db.insert(schema.post).values({ id: 'post-deleted-1', userId: USER_ID, accountId: 'acc-stats-1', content: 'deleted', status: 'draft', mediaUrls: '[]', mediaThumbnails: '[]', deletedAt: new Date().toISOString() }).returning().get()

      const response = await GET()
      const data = await response.json()
      expect(data.totalPosts).toBe(3)
      expect(data.draftPosts).toBe(1)
      expect(data.scheduledPosts).toBe(1)
      expect(data.publishedPosts).toBe(1)
      expect(data.totalAccounts).toBe(1)
    })

    it('should not count other users posts', async () => {
      const db = await mockDb.getDb()
      await db.insert(schema.post).values({ id: 'post-other', userId: 'other-user', accountId: 'acc-other', content: 'other', status: 'published', mediaUrls: '[]', mediaThumbnails: '[]' }).returning().get()
      const response = await GET()
      const data = await response.json()
      expect(data.totalPosts).toBe(0)
    })
  })

  describe('formatBytes', () => {
    it('should return "0 B" for 0', () => { expect(formatBytes(0)).toBe('0 B') })
    it('should format < 1KB', () => { expect(formatBytes(500)).toBe('500 B') })
    it('should format KB', () => { expect(formatBytes(1024)).toBe('1 KB') })
    it('should format MB', () => { expect(formatBytes(1024 * 1024)).toBe('1 MB') })
    it('should format GB', () => { expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB') })
    it('should format with decimal precision', () => { expect(formatBytes(1536)).toBe('1.5 KB') })
  })
})
