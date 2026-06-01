/**
 * MCP External Auth 补充测试
 * 专门覆盖 generateApiKey、deleteApiKey、listApiKeys
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// 用 class 作为 PrismaClient
const createModelMock = () => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  delete: vi.fn(),
  deleteMany: vi.fn(),
  count: vi.fn(),
  upsert: vi.fn(),
})

const externalApiKeyMock = createModelMock()
const postMock = createModelMock()
const accountMock = createModelMock()

// 用 class，让 new PrismaClient() 返回一个实例，实例上有这些属性
class FakePrismaClient {
  externalApiKey = externalApiKeyMock
  post = postMock
  account = accountMock
  user = createModelMock()
  media = createModelMock()
  platform = createModelMock()
  platformConfig = createModelMock()
}

vi.mock('@prisma/client', () => ({
  PrismaClient: FakePrismaClient,
}))

describe('MCP Auth - 补充测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 重新赋值以避免 clearAllMocks 影响
    externalApiKeyMock.findUnique = vi.fn()
    externalApiKeyMock.create = vi.fn()
    externalApiKeyMock.update = vi.fn()
    externalApiKeyMock.deleteMany = vi.fn()
    externalApiKeyMock.findMany = vi.fn()
  })

  describe('validateApiKey', () => {
    it('should reject empty key', async () => {
      const { validateApiKey } = await import('@/mcp/external/auth')
      const result = await validateApiKey('')
      expect(result.valid).toBe(false)
      expect(result.errorCode).toBe('MISSING_KEY')
    })

    it('should reject key without npk_ prefix', async () => {
      const { validateApiKey } = await import('@/mcp/external/auth')
      const result = await validateApiKey('xxx')
      expect(result.valid).toBe(false)
      expect(result.errorCode).toBe('INVALID_KEY_FORMAT')
    })

    it('should reject non-existent key', async () => {
      externalApiKeyMock.findUnique.mockResolvedValue(null)
      const { validateApiKey } = await import('@/mcp/external/auth')
      const result = await validateApiKey('npk_nonexistent123456789012345678901234')
      expect(result.valid).toBe(false)
      expect(result.errorCode).toBe('INVALID_KEY')
    })

    it('should reject expired key', async () => {
      externalApiKeyMock.findUnique.mockResolvedValue({
        id: 'k1', userId: 'u1', key: 'npk_x',
        expiresAt: new Date('2000-01-01'),
      })
      const { validateApiKey } = await import('@/mcp/external/auth')
      const result = await validateApiKey('npk_x')
      expect(result.errorCode).toBe('KEY_EXPIRED')
    })

    it('should accept valid key and return user', async () => {
      externalApiKeyMock.findUnique.mockResolvedValue({
        id: 'k1', userId: 'u1', key: 'npk_valid', expiresAt: null,
      })
      externalApiKeyMock.update.mockResolvedValue({})
      const { validateApiKey } = await import('@/mcp/external/auth')
      const result = await validateApiKey('npk_valid')
      expect(result.valid).toBe(true)
      expect(result.userId).toBe('u1')
    })

    it('should handle db errors', async () => {
      externalApiKeyMock.findUnique.mockRejectedValue(new Error('DB error'))
      const { validateApiKey } = await import('@/mcp/external/auth')
      const result = await validateApiKey('npk_x')
      expect(result.errorCode).toBe('INTERNAL_ERROR')
    })
  })

  describe('generateApiKey', () => {
    it('should generate key with npk_ prefix', async () => {
      externalApiKeyMock.create.mockResolvedValue({ id: 'k1' })
      const { generateApiKey } = await import('@/mcp/external/auth')
      const result = await generateApiKey('u1', 'Test Key')
      expect(result.success).toBe(true)
      expect(result.key).toMatch(/^npk_[a-f0-9]{64}$/)
    })

    it('should support expiresAt', async () => {
      externalApiKeyMock.create.mockResolvedValue({ id: 'k1' })
      const { generateApiKey } = await import('@/mcp/external/auth')
      const exp = new Date('2030-01-01')
      await generateApiKey('u1', 'Test', exp)
      expect(externalApiKeyMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ expiresAt: exp }) })
      )
    })

    it('should handle errors', async () => {
      externalApiKeyMock.create.mockRejectedValue(new Error('DB error'))
      const { generateApiKey } = await import('@/mcp/external/auth')
      const result = await generateApiKey('u1', 'Test')
      expect(result.success).toBe(false)
    })
  })

  describe('deleteApiKey', () => {
    it('should delete when key belongs to user', async () => {
      externalApiKeyMock.deleteMany.mockResolvedValue({ count: 1 })
      const { deleteApiKey } = await import('@/mcp/external/auth')
      const result = await deleteApiKey('u1', 'k1')
      expect(result.success).toBe(true)
    })

    it('should fail when no rows deleted', async () => {
      externalApiKeyMock.deleteMany.mockResolvedValue({ count: 0 })
      const { deleteApiKey } = await import('@/mcp/external/auth')
      const result = await deleteApiKey('u1', 'k1')
      expect(result.success).toBe(false)
    })

    it('should handle errors', async () => {
      externalApiKeyMock.deleteMany.mockRejectedValue(new Error('DB error'))
      const { deleteApiKey } = await import('@/mcp/external/auth')
      const result = await deleteApiKey('u1', 'k1')
      expect(result.success).toBe(false)
    })
  })

  describe('listApiKeys', () => {
    it('should return key previews', async () => {
      const date = new Date('2026-01-01')
      externalApiKeyMock.findMany.mockResolvedValue([
        {
          id: 'k1', name: 'Test', key: 'npk_abcdefghijklmnop',
          permissions: 'read_report', lastUsedAt: date, expiresAt: null,
          createdAt: date,
        },
      ])
      const { listApiKeys } = await import('@/mcp/external/auth')
      const result = await listApiKeys('u1')
      expect(result.success).toBe(true)
      expect(result.keys![0].keyPreview).toBe('npk_abcdefgh...')

    })

    it('should return empty array when no keys', async () => {
      externalApiKeyMock.findMany.mockResolvedValue([])
      const { listApiKeys } = await import('@/mcp/external/auth')
      const result = await listApiKeys('u1')
      expect(result.success).toBe(true)
      expect(result.keys).toHaveLength(0)
    })

    it('should handle errors', async () => {
      externalApiKeyMock.findMany.mockRejectedValue(new Error('DB error'))
      const { listApiKeys } = await import('@/mcp/external/auth')
      const result = await listApiKeys('u1')
      expect(result.success).toBe(false)
    })
  })
})

// ===== v0.3 Scope 解析与权限校验 =====
describe('parseScope', () => {
  it('read → read', async () => {
    const { parseScope } = await import('@/mcp/external/auth')
    expect(parseScope('read')).toBe('read')
  })

  it('read_report（历史值）→ read 兼容', async () => {
    const { parseScope } = await import('@/mcp/external/auth')
    expect(parseScope('read_report')).toBe('read')
  })

  it('write → write', async () => {
    const { parseScope } = await import('@/mcp/external/auth')
    expect(parseScope('write')).toBe('write')
  })

  it('read_write → read_write', async () => {
    const { parseScope } = await import('@/mcp/external/auth')
    expect(parseScope('read_write')).toBe('read_write')
  })

  it('null / undefined / 未知值 → read（安全默认）', async () => {
    const { parseScope } = await import('@/mcp/external/auth')
    expect(parseScope(null)).toBe('read')
    expect(parseScope(undefined)).toBe('read')
    expect(parseScope('')).toBe('read')
    expect(parseScope('garbage')).toBe('read')
  })
})

describe('hasScope', () => {
  it('read 工具：read 满足，write 不满足，read_write 满足', async () => {
    const { hasScope } = await import('@/mcp/external/auth')
    expect(hasScope('read', 'read')).toBe(true)
    expect(hasScope('write', 'read')).toBe(false)
    expect(hasScope('read_write', 'read')).toBe(true)
  })

  it('write 工具：read 不满足，write 满足，read_write 满足', async () => {
    const { hasScope } = await import('@/mcp/external/auth')
    expect(hasScope('read', 'write')).toBe(false)
    expect(hasScope('write', 'write')).toBe(true)
    expect(hasScope('read_write', 'write')).toBe(true)
  })
})

describe('validateApiKey 应返回 scope', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    externalApiKeyMock.findUnique = vi.fn()
    externalApiKeyMock.update = vi.fn()
  })

  it('permissions=read_report 应映射为 scope=read', async () => {
    externalApiKeyMock.findUnique.mockResolvedValue({
      id: 'k1', userId: 'u1', key: 'npk_x', permissions: 'read_report', expiresAt: null,
    })
    externalApiKeyMock.update.mockResolvedValue({})
    const { validateApiKey } = await import('@/mcp/external/auth')
    const result = await validateApiKey('npk_x')
    expect(result.valid).toBe(true)
    expect(result.scope).toBe('read')
  })

  it('permissions=read_write 应映射为 scope=read_write', async () => {
    externalApiKeyMock.findUnique.mockResolvedValue({
      id: 'k1', userId: 'u1', key: 'npk_x', permissions: 'read_write', expiresAt: null,
    })
    externalApiKeyMock.update.mockResolvedValue({})
    const { validateApiKey } = await import('@/mcp/external/auth')
    const result = await validateApiKey('npk_x')
    expect(result.scope).toBe('read_write')
  })

  it('permissions 缺失时应默认为 read', async () => {
    externalApiKeyMock.findUnique.mockResolvedValue({
      id: 'k1', userId: 'u1', key: 'npk_x', expiresAt: null,
    })
    externalApiKeyMock.update.mockResolvedValue({})
    const { validateApiKey } = await import('@/mcp/external/auth')
    const result = await validateApiKey('npk_x')
    expect(result.scope).toBe('read')
  })
})
