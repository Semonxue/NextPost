/**
 * Platforms API tests
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { mockDb, setupTestDb, truncateAllTables, closeTestDb, schema } from './_db-shim'

vi.mock('@/lib/db', () => mockDb)
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

import { GET } from '@/app/api/platforms/route'
import { auth } from '@/lib/auth'

describe('GET /api/platforms', () => {
  beforeAll(async () => { await setupTestDb() })
  afterAll(() => { closeTestDb() })
  beforeEach(async () => { await truncateAllTables(); vi.clearAllMocks() })

  it('should return 401 when not authenticated', async () => {
    ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const response = await GET()
    expect(response.status).toBe(401)
  })

  it('should return platforms as { platforms }', async () => {
    ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: 'u1', name: 'test' } })
    const db = await mockDb.getDb()
    await db.insert(schema.platform).values({ id: 'p1', name: 'Twitter', icon: '/icons/twitter.svg' }).returning().get()
    await db.insert(schema.platform).values({ id: 'p2', name: 'Instagram', icon: '/icons/instagram.svg' }).returning().get()
    const response = await GET()
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.platforms).toBeDefined()
    expect(Array.isArray(data.platforms)).toBe(true)
    expect(data.platforms.length).toBe(2)
  })

  it('should return empty platforms when none exist', async () => {
    ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: 'u1', name: 'test' } })
    const response = await GET()
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.platforms).toEqual([])
  })

  it('should return 500 when getDb throws', async () => {
    ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: 'u1', name: 'test' } })
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
