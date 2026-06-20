/**
 * Regenerate Thumbnails API tests
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { mockDb, setupTestDb, truncateAllTables, closeTestDb, schema } from './_db-shim'

vi.mock('@/lib/db', () => mockDb)
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

import { GET, POST } from '@/app/api/maintenance/regenerate-thumbnails/route'
import { auth } from '@/lib/auth'

describe('Regenerate Thumbnails API', () => {
  beforeAll(async () => { await setupTestDb() })
  afterAll(() => { closeTestDb() })
  beforeEach(async () => {
    await truncateAllTables()
    vi.clearAllMocks()
  })

  it('should return 401 when not authenticated', async () => {
    ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const response = await GET()
    expect(response.status).toBe(401)
  })

  it('GET should return { count }', async () => {
    ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: 'u1', name: 'test' } })
    const response = await GET()
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(typeof data.count).toBe('number')
  })

  it('POST should return { processed, total }', async () => {
    ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: 'u1', name: 'test' } })
    const response = await POST(new NextRequest('http://localhost/api/maintenance/regenerate-thumbnails', {
      method: 'POST',
      body: JSON.stringify({}),
    }))
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(typeof data.processed).toBe('number')
    expect(typeof data.total).toBe('number')
  })
})
