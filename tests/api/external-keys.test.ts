/**
 * External API Keys tests
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { mockDb, setupTestDb, truncateAllTables, closeTestDb, schema } from './_db-shim'
import { v4 as uuidv4 } from 'uuid'

vi.mock('@/lib/db', () => mockDb)
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

const USER_ID = 'user-test-001'

describe('External API Keys CRUD', () => {
  beforeAll(async () => { await setupTestDb() })
  afterAll(() => { closeTestDb() })
  beforeEach(async () => {
    await truncateAllTables()
    vi.clearAllMocks()
  })

  describe('DB operations', () => {
    it('should create ExternalApiKey', async () => {
      const db = await mockDb.getDb()
      const key = `npk_${uuidv4().replace(/-/g, '')}`
      const inserted = await db.insert(schema.externalApiKey).values({ userId: USER_ID, name: 'Test Key', key, permissions: 'read_report' }).returning().get()
      expect(inserted.id).toBeDefined()
      expect(inserted.key).toBe(key)
      expect(inserted.permissions).toBe('read_report')
    })

    it('should list keys for user', async () => {
      const db = await mockDb.getDb()
      await db.insert(schema.externalApiKey).values({ userId: USER_ID, name: 'My Key', key: `npk_${uuidv4().replace(/-/g, '')}`, permissions: 'read_report' }).returning().get()
      const allKeys = await db.select().from(schema.externalApiKey).all()
      const keys = allKeys.filter((row: any) => row.userId === USER_ID)
      expect(keys.length).toBeGreaterThan(0)
    })

    it('should delete key by id', async () => {
      const db = await mockDb.getDb()
      const inserted = await db.insert(schema.externalApiKey).values({ userId: USER_ID, name: 'To Delete', key: `npk_${uuidv4().replace(/-/g, '')}`, permissions: 'read_report' }).returning().get()
      await db.delete(schema.externalApiKey).where(eq(schema.externalApiKey.id, inserted.id)).run()
      const rows = await db.select().from(schema.externalApiKey).where(eq(schema.externalApiKey.id, inserted.id)).all()
      expect(rows.length).toBe(0)
    })
  })

  describe('Key format', () => {
    it('should generate key with npk_ prefix', () => {
      const keyValue = `npk_${uuidv4().replace(/-/g, '')}`
      expect(keyValue).toMatch(/^npk_[a-f0-9]{32}$/)
    })

    it('should validate key format', () => {
      expect('npk_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4').toMatch(/^npk_[a-f0-9]{32}$/)
      expect('invalid_key').not.toMatch(/^npk_[a-f0-9]{32}$/)
      expect('npk_short').not.toMatch(/^npk_[a-f0-9]{32}$/)
    })
  })

  describe('Permissions', () => {
    it('should store read_report permission', async () => {
      const db = await mockDb.getDb()
      const inserted = await db.insert(schema.externalApiKey).values({ userId: USER_ID, name: 'Read', key: `npk_${uuidv4().replace(/-/g, '')}`, permissions: 'read_report' }).returning().get()
      expect(inserted.permissions).toBe('read_report')
    })

    it('should store multiple permissions', async () => {
      const db = await mockDb.getDb()
      const inserted = await db.insert(schema.externalApiKey).values({ userId: USER_ID, name: 'Multi', key: `npk_${uuidv4().replace(/-/g, '')}`, permissions: 'read_report,manage_posts' }).returning().get()
      expect(inserted.permissions).toContain('read_report')
      expect(inserted.permissions).toContain('manage_posts')
    })
  })
})
