/**
 * MCP External Tools 实际函数测试
 *
 * 用模块级共享的 prisma mocks 拦截 tools.ts 顶层 new PrismaClient()。
 * 覆盖：list_accounts / get_pending_posts / get_post_detail / report_publish_result
 *       / upload_media_from_url / create_post / update_post
 *       / executeTool 错误分支 / getBaseUrl env 路径 / toAbsoluteUrl 相对路径处理
 *       / scope 强制（INSUFFICIENT_SCOPE）
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ---------- 模块级共享 mock ----------
// 必须 hoist 到模块作用域，否则 new PrismaClient() 每次会创建新实例，旧的 mock 设置会失效

const postMock = {
  findMany: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
}
const accountMock = {
  findMany: vi.fn(),
  findFirst: vi.fn(),
}

// storage mock（避免实际写盘）
vi.mock('@/lib/storage', () => ({
  uploadFile: vi.fn(async (_buf: Buffer, filename: string, mimeType: string) => ({
    url: `/api/uploads/2026-06-02/${filename}`,
    path: `/api/uploads/2026-06-02/${filename}`,
    filename,
    mimeType,
    size: _buf.length,
  })),
  deleteFile: vi.fn(async () => {}),
}))

class FakePrismaClient {
  post = postMock
  account = accountMock
}

vi.mock('@prisma/client', () => ({
  PrismaClient: FakePrismaClient,
}))

// ---------- 公共 beforeEach：重置所有 mock 引用 ----------
function resetMocks() {
  postMock.findMany = vi.fn()
  postMock.findFirst = vi.fn()
  postMock.update = vi.fn()
  postMock.create = vi.fn()
  accountMock.findMany = vi.fn()
  accountMock.findFirst = vi.fn()
}

// ---------- 测试 ----------

describe('MCP Tools - list_accounts (executeTool)', () => {
  beforeEach(() => {
    accountMock.findMany = vi.fn()
    postMock.findMany = vi.fn()
    postMock.findFirst = vi.fn()
    postMock.update = vi.fn()
  })

  it('返回脱敏后的账号列表（id/platform/displayName）', async () => {
    accountMock.findMany.mockResolvedValue([
      { id: 'a1', name: 'My Twitter', platform: { name: 'twitter' } },
      { id: 'a2', name: 'My 小红书', platform: { name: 'xiaohongshu' } },
    ])
    const { executeTool } = await import('@/mcp/external/tools')
    const result = await executeTool('list_accounts', {}, 'user-1')
    const data = JSON.parse(result.content[0].text)

    expect(data.accounts).toEqual([
      { id: 'a1', platform: 'twitter', displayName: 'My Twitter' },
      { id: 'a2', platform: 'xiaohongshu', displayName: 'My 小红书' },
    ])
  })

  it('查询条件应包含 userId 和 deletedAt: null', async () => {
    accountMock.findMany.mockResolvedValue([])
    const { executeTool } = await import('@/mcp/external/tools')
    await executeTool('list_accounts', {}, 'user-123')

    expect(accountMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-123',
          deletedAt: null,
        }),
        include: expect.objectContaining({ platform: true }),
      })
    )
  })

  it('空列表时返回空数组', async () => {
    accountMock.findMany.mockResolvedValue([])
    const { executeTool } = await import('@/mcp/external/tools')
    const result = await executeTool('list_accounts', {}, 'user-1')
    const data = JSON.parse(result.content[0].text)
    expect(data.accounts).toEqual([])
  })
})

describe('MCP Tools - get_pending_posts (executeTool)', () => {
  beforeEach(() => {
    postMock.findMany = vi.fn()
    postMock.findFirst = vi.fn()
    postMock.update = vi.fn()
    accountMock.findMany = vi.fn()
  })

  it('将相对路径媒体 URL 转为绝对 URL', async () => {
    postMock.findMany.mockResolvedValue([
      {
        id: 'p1', userId: 'user-1', accountId: 'a1',
        content: 'Hello', mediaUrls: JSON.stringify(['/uploads/test.jpg']),
        scheduledTime: new Date('2026-06-01T10:00:00Z'),
        timezone: 'Asia/Shanghai', status: 'scheduled',
        publishToken: 'tok_abc',
        account: { name: 'My Twitter' },
      },
    ])
    const { executeTool } = await import('@/mcp/external/tools')
    const result = await executeTool('get_pending_posts', { limit: 5 }, 'user-1')
    const data = JSON.parse(result.content[0].text)

    expect(data.posts).toHaveLength(1)
    expect(data.posts[0].mediaUrls[0]).toMatch(/^http:\/\/localhost:3000\/uploads\/test\.jpg$/)
  })

  it('https 绝对 URL 保持原样不拼接', async () => {
    postMock.findMany.mockResolvedValue([
      {
        id: 'p2', userId: 'user-1', accountId: 'a1',
        content: 'Hi', mediaUrls: JSON.stringify(['https://cdn.example.com/img.jpg']),
        scheduledTime: new Date(), timezone: 'UTC', status: 'scheduled',
        publishToken: 'tok_xyz',
        account: { name: 'X' },
      },
    ])
    const { executeTool } = await import('@/mcp/external/tools')
    const result = await executeTool('get_pending_posts', {}, 'user-1')
    const data = JSON.parse(result.content[0].text)

    expect(data.posts[0].mediaUrls[0]).toBe('https://cdn.example.com/img.jpg')
  })

  it('媒体列表为空时正确处理', async () => {
    postMock.findMany.mockResolvedValue([
      {
        id: 'p3', userId: 'user-1', accountId: 'a1',
        content: 'text only', mediaUrls: '[]',
        scheduledTime: new Date(), timezone: 'UTC', status: 'scheduled',
        publishToken: 'tok', account: { name: 'X' },
      },
    ])
    const { executeTool } = await import('@/mcp/external/tools')
    const result = await executeTool('get_pending_posts', {}, 'user-1')
    const data = JSON.parse(result.content[0].text)
    expect(data.posts[0].mediaUrls).toEqual([])
  })

  it('mediaUrls 为 null 或空字符串时不抛错', async () => {
    postMock.findMany.mockResolvedValue([
      {
        id: 'p4', userId: 'user-1', accountId: 'a1',
        content: 'no media', mediaUrls: '',
        scheduledTime: new Date(), timezone: 'UTC', status: 'scheduled',
        publishToken: 'tok', account: { name: 'X' },
      },
    ])
    const { executeTool } = await import('@/mcp/external/tools')
    const result = await executeTool('get_pending_posts', {}, 'user-1')
    const data = JSON.parse(result.content[0].text)
    expect(data.posts[0].mediaUrls).toEqual([])
  })

  it('支持 accountId 过滤', async () => {
    postMock.findMany.mockResolvedValue([])
    const { executeTool } = await import('@/mcp/external/tools')
    await executeTool('get_pending_posts', { accountId: 'a1', limit: 3 }, 'user-1')

    expect(postMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          accountId: 'a1',
          userId: 'user-1',
          status: 'scheduled',
        }),
        take: 3,
      })
    )
  })

  it('未传 limit 时默认 10', async () => {
    postMock.findMany.mockResolvedValue([])
    const { executeTool } = await import('@/mcp/external/tools')
    await executeTool('get_pending_posts', {}, 'user-1')
    expect(postMock.findMany.mock.calls[0][0].take).toBe(10)
  })
})

describe('MCP Tools - get_post_detail (executeTool)', () => {
  beforeEach(() => {
    postMock.findMany = vi.fn()
    postMock.findFirst = vi.fn()
    postMock.update = vi.fn()
    accountMock.findMany = vi.fn()
  })

  it('找到帖子时返回完整信息', async () => {
    postMock.findFirst.mockResolvedValue({
      id: 'p1', userId: 'user-1', accountId: 'a1',
      content: 'Hello', mediaUrls: '["/uploads/x.jpg"]',
      scheduledTime: new Date('2026-06-01T10:00:00Z'),
      timezone: 'UTC', status: 'scheduled',
      publishToken: 'tok_xyz', externalPostUrl: 'https://x.com/1',
      account: { name: 'My Twitter' },
    })
    const { executeTool } = await import('@/mcp/external/tools')
    const result = await executeTool('get_post_detail', { postId: 'p1' }, 'user-1')
    const data = JSON.parse(result.content[0].text)

    expect(data.post.id).toBe('p1')
    expect(data.post.accountId).toBe('a1')
    expect(data.post.accountDisplayName).toBe('My Twitter')
    expect(data.post.publishToken).toBe('tok_xyz')
    expect(data.post.externalPostUrl).toBe('https://x.com/1')
    expect(data.post.mediaUrls[0]).toMatch(/^http:\/\/localhost:3000/)
  })

  it('未找到时返回 error 标记', async () => {
    postMock.findFirst.mockResolvedValue(null)
    const { executeTool } = await import('@/mcp/external/tools')
    const result = await executeTool('get_post_detail', { postId: 'none' }, 'user-1')
    const data = JSON.parse(result.content[0].text)
    expect(data.error).toBe('Post not found')
  })
})

describe('MCP Tools - report_publish_result (executeTool)', () => {
  beforeEach(() => {
    postMock.findMany = vi.fn()
    postMock.findFirst = vi.fn()
    postMock.update = vi.fn()
    accountMock.findMany = vi.fn()
  })

  it('success：更新为 published，publishedAt 来自参数', async () => {
    postMock.findFirst.mockResolvedValue({
      id: 'p1', userId: 'user-1', publishToken: 'tok_abc', status: 'scheduled',
    })
    postMock.update.mockResolvedValue({})
    const { executeTool } = await import('@/mcp/external/tools')
    const result = await executeTool('report_publish_result', {
      postId: 'p1', publishToken: 'tok_abc', status: 'success',
      externalPostUrl: 'https://x.com/1',
      publishedAt: '2026-06-01T10:00:00Z',
      externalPostId: 'tw_123',
    }, 'user-1')
    const data = JSON.parse(result.content[0].text)

    expect(data.received).toBe(true)
    expect(data.postStatus).toBe('published')
    expect(postMock.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: expect.objectContaining({
        status: 'published',
        publishedAt: new Date('2026-06-01T10:00:00Z'),
        externalPostId: 'tw_123',
        externalPostUrl: 'https://x.com/1',
        publishError: null,
        publishAttempts: { increment: 1 },
      }),
    })
  })

  it('success：未传 publishedAt 时使用当前时间', async () => {
    postMock.findFirst.mockResolvedValue({
      id: 'p1', userId: 'user-1', publishToken: 'tok_abc',
    })
    postMock.update.mockResolvedValue({})
    const { executeTool } = await import('@/mcp/external/tools')
    await executeTool('report_publish_result', {
      postId: 'p1', publishToken: 'tok_abc', status: 'success',
      externalPostUrl: 'https://x.com/1',
    }, 'user-1')

    const updateArgs = postMock.update.mock.calls[0][0]
    expect(updateArgs.data.publishedAt).toBeInstanceOf(Date)
  })

  it('success：未传 externalPostId/Url 时不写入对应字段', async () => {
    postMock.findFirst.mockResolvedValue({ id: 'p1', publishToken: 'tok_abc' })
    postMock.update.mockResolvedValue({})
    const { executeTool } = await import('@/mcp/external/tools')
    await executeTool('report_publish_result', {
      postId: 'p1', publishToken: 'tok_abc', status: 'success',
      externalPostUrl: 'https://x.com/1',
    }, 'user-1')

    const updateArgs = postMock.update.mock.calls[0][0]
    expect(updateArgs.data).not.toHaveProperty('externalPostId')
    expect(updateArgs.data.externalPostUrl).toBe('https://x.com/1')
  })

  it('failed：写入错误码和错误信息，retryable=true 时返回 retryable', async () => {
    postMock.findFirst.mockResolvedValue({ id: 'p1', publishToken: 'tok_abc' })
    postMock.update.mockResolvedValue({})
    const { executeTool } = await import('@/mcp/external/tools')
    const result = await executeTool('report_publish_result', {
      postId: 'p1', publishToken: 'tok_abc', status: 'failed',
      externalPostUrl: '',
      errorCode: 'rate_limit', errorMessage: 'API rate limit exceeded',
      retryable: true,
    }, 'user-1')
    const data = JSON.parse(result.content[0].text)

    expect(data.postStatus).toBe('failed')
    expect(data.retryable).toBe(true)
    expect(postMock.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: expect.objectContaining({
        status: 'failed',
        publishError: '[rate_limit] API rate limit exceeded',
        publishAttempts: { increment: 1 },
      }),
    })
  })

  it('failed：仅有 errorMessage 无 errorCode 时不加前缀', async () => {
    postMock.findFirst.mockResolvedValue({ id: 'p1', publishToken: 'tok_abc' })
    postMock.update.mockResolvedValue({})
    const { executeTool } = await import('@/mcp/external/tools')
    await executeTool('report_publish_result', {
      postId: 'p1', publishToken: 'tok_abc', status: 'failed',
      externalPostUrl: '',
      errorMessage: 'unknown failure',
    }, 'user-1')

    const updateArgs = postMock.update.mock.calls[0][0]
    expect(updateArgs.data.publishError).toBe('unknown failure')
  })

  it('failed：errorMessage 也没有时写入 Unknown error', async () => {
    postMock.findFirst.mockResolvedValue({ id: 'p1', publishToken: 'tok_abc' })
    postMock.update.mockResolvedValue({})
    const { executeTool } = await import('@/mcp/external/tools')
    await executeTool('report_publish_result', {
      postId: 'p1', publishToken: 'tok_abc', status: 'failed',
      externalPostUrl: '',
    }, 'user-1')

    const updateArgs = postMock.update.mock.calls[0][0]
    expect(updateArgs.data.publishError).toBe('Unknown error')
  })

  it('partial：状态置为 published 但保留错误信息', async () => {
    postMock.findFirst.mockResolvedValue({ id: 'p1', publishToken: 'tok_abc' })
    postMock.update.mockResolvedValue({})
    const { executeTool } = await import('@/mcp/external/tools')
    const result = await executeTool('report_publish_result', {
      postId: 'p1', publishToken: 'tok_abc', status: 'partial',
      externalPostUrl: 'https://x.com/1',
      errorMessage: 'image upload failed',
    }, 'user-1')
    const data = JSON.parse(result.content[0].text)

    expect(data.postStatus).toBe('published')
    expect(postMock.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: expect.objectContaining({
        status: 'published',
        publishError: 'image upload failed',
      }),
    })
  })

  it('publishToken 不匹配时返回 not_found，不调 update', async () => {
    postMock.findFirst.mockResolvedValue(null)
    const { executeTool } = await import('@/mcp/external/tools')
    const result = await executeTool('report_publish_result', {
      postId: 'p1', publishToken: 'wrong', status: 'success',
      externalPostUrl: 'https://x.com/1',
    }, 'user-1')
    const data = JSON.parse(result.content[0].text)

    expect(data.received).toBe(false)
    expect(data.postStatus).toBe('not_found')
    expect(postMock.update).not.toHaveBeenCalled()
  })
})

describe('MCP Tools - executeTool 错误分支', () => {
  beforeEach(() => {
    postMock.findMany = vi.fn()
    postMock.findFirst = vi.fn()
    postMock.update = vi.fn()
    accountMock.findMany = vi.fn()
  })

  it('未知工具名返回 Unknown tool 错误', async () => {
    const { executeTool } = await import('@/mcp/external/tools')
    const result = await executeTool('nonexistent_tool', {}, 'user-1')
    const data = JSON.parse(result.content[0].text)
    expect(data.error).toContain('Unknown tool')
  })

  it('工具执行抛错时捕获并返回结构化错误', async () => {
    accountMock.findMany.mockRejectedValue(new Error('Boom'))
    const { executeTool } = await import('@/mcp/external/tools')
    const result = await executeTool('list_accounts', {}, 'user-1')
    const data = JSON.parse(result.content[0].text)
    expect(data.error).toBe('Internal server error')
    expect(data.message).toBe('Boom')
  })
})

describe('MCP Tools - getBaseUrl 环境变量', () => {
  beforeEach(() => {
    postMock.findMany = vi.fn()
    postMock.findFirst = vi.fn()
    postMock.update = vi.fn()
    accountMock.findMany = vi.fn()
  })

  it('当 NEXT_PUBLIC_BASE_URL 设置时使用它拼接', async () => {
    const original = process.env.NEXT_PUBLIC_BASE_URL
    process.env.NEXT_PUBLIC_BASE_URL = 'https://prod.example.com'
    try {
      postMock.findMany.mockResolvedValue([
        {
          id: 'p1', userId: 'user-1', accountId: 'a1', content: 'x',
          mediaUrls: JSON.stringify(['/uploads/x.jpg']),
          scheduledTime: new Date(), timezone: 'UTC', status: 'scheduled',
          publishToken: 'tok', account: { name: 'X' },
        },
      ])
      const { executeTool } = await import('@/mcp/external/tools')
      const result = await executeTool('get_pending_posts', {}, 'user-1')
      const data = JSON.parse(result.content[0].text)
      expect(data.posts[0].mediaUrls[0]).toBe('https://prod.example.com/uploads/x.jpg')
    } finally {
      if (original === undefined) delete process.env.NEXT_PUBLIC_BASE_URL
      else process.env.NEXT_PUBLIC_BASE_URL = original
    }
  })
})

// ===== v0.3 写工具测试 =====

describe('MCP Tools - upload_media_from_url (executeTool)', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    resetMocks()
    fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy as unknown as typeof fetch
  })

  it('成功：拉取 URL 存盘并返回 url/mimeType/size/filename', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'image/png']]),
      arrayBuffer: async () => Buffer.from('fake-png-data'),
    })
    const { executeTool } = await import('@/mcp/external/tools')
    const result = await executeTool(
      'upload_media_from_url',
      { url: 'https://cdn.example.com/x.png' },
      { userId: 'u1', scope: 'read_write' }
    )
    const data = JSON.parse(result.content[0].text)
    expect(data.url).toMatch(/\/api\/uploads\//)
    expect(data.mimeType).toBe('image/png')
    expect(data.size).toBe(13) // 'fake-png-data' length
    expect(data.filename).toMatch(/\.png$/)
  })

  it('支持自定义 filename', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'image/jpeg']]),
      arrayBuffer: async () => Buffer.from('xxx'),
    })
    const { executeTool } = await import('@/mcp/external/tools')
    const result = await executeTool(
      'upload_media_from_url',
      { url: 'https://example.com/x', filename: 'my-photo.jpg' },
      { userId: 'u1', scope: 'read_write' }
    )
    const data = JSON.parse(result.content[0].text)
    expect(data.filename).toBe('my-photo.jpg')
  })

  it('缺少 url 时返回 INVALID_ARGUMENT', async () => {
    const { executeTool } = await import('@/mcp/external/tools')
    const result = await executeTool(
      'upload_media_from_url',
      { url: '' },
      { userId: 'u1', scope: 'read_write' }
    )
    const data = JSON.parse(result.content[0].text)
    expect(data.errorCode).toBe('INVALID_ARGUMENT')
  })

  it('非 http/https 协议返回 INVALID_URL', async () => {
    const { executeTool } = await import('@/mcp/external/tools')
    const result = await executeTool(
      'upload_media_from_url',
      { url: 'file:///etc/passwd' },
      { userId: 'u1', scope: 'read_write' }
    )
    const data = JSON.parse(result.content[0].text)
    expect(data.errorCode).toBe('INVALID_URL')
  })

  it('非法的 URL 字符串返回 INVALID_URL', async () => {
    const { executeTool } = await import('@/mcp/external/tools')
    const result = await executeTool(
      'upload_media_from_url',
      { url: 'not-a-url' },
      { userId: 'u1', scope: 'read_write' }
    )
    const data = JSON.parse(result.content[0].text)
    expect(data.errorCode).toBe('INVALID_URL')
  })

  it('HTTP 500 返回 FETCH_FAILED 且 retryable=true', async () => {
    fetchSpy.mockResolvedValue({
      ok: false, status: 500,
      headers: new Map(),
      arrayBuffer: async () => new ArrayBuffer(0),
    })
    const { executeTool } = await import('@/mcp/external/tools')
    const result = await executeTool(
      'upload_media_from_url',
      { url: 'https://example.com/x.png' },
      { userId: 'u1', scope: 'read_write' }
    )
    const data = JSON.parse(result.content[0].text)
    expect(data.errorCode).toBe('FETCH_FAILED')
    expect(data.retryable).toBe(true)
  })

  it('HTTP 404 返回 FETCH_FAILED 且 retryable=false', async () => {
    fetchSpy.mockResolvedValue({
      ok: false, status: 404,
      headers: new Map(),
      arrayBuffer: async () => new ArrayBuffer(0),
    })
    const { executeTool } = await import('@/mcp/external/tools')
    const result = await executeTool(
      'upload_media_from_url',
      { url: 'https://example.com/missing.png' },
      { userId: 'u1', scope: 'read_write' }
    )
    const data = JSON.parse(result.content[0].text)
    expect(data.errorCode).toBe('FETCH_FAILED')
    expect(data.retryable).toBe(false)
  })

  it('网络抛错返回 FETCH_FAILED 且 retryable=true', async () => {
    fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'))
    const { executeTool } = await import('@/mcp/external/tools')
    const result = await executeTool(
      'upload_media_from_url',
      { url: 'https://example.com/x.png' },
      { userId: 'u1', scope: 'read_write' }
    )
    const data = JSON.parse(result.content[0].text)
    expect(data.errorCode).toBe('FETCH_FAILED')
    expect(data.retryable).toBe(true)
  })

  it('content-length 超限返回 FILE_TOO_LARGE', async () => {
    fetchSpy.mockResolvedValue({
      ok: true, status: 200,
      headers: new Map([['content-type', 'image/png'], ['content-length', '99999999']]),
      arrayBuffer: async () => new ArrayBuffer(0),
    })
    const { executeTool } = await import('@/mcp/external/tools')
    const result = await executeTool(
      'upload_media_from_url',
      { url: 'https://example.com/big.png' },
      { userId: 'u1', scope: 'read_write' }
    )
    const data = JSON.parse(result.content[0].text)
    expect(data.errorCode).toBe('FILE_TOO_LARGE')
  })

  it('不支持的 mime 类型返回 UNSUPPORTED_MIME', async () => {
    fetchSpy.mockResolvedValue({
      ok: true, status: 200,
      headers: new Map([['content-type', 'application/pdf']]),
      arrayBuffer: async () => new ArrayBuffer(8),
    })
    const { executeTool } = await import('@/mcp/external/tools')
    const result = await executeTool(
      'upload_media_from_url',
      { url: 'https://example.com/x.pdf' },
      { userId: 'u1', scope: 'read_write' }
    )
    const data = JSON.parse(result.content[0].text)
    expect(data.errorCode).toBe('UNSUPPORTED_MIME')
  })

  it('content-type 缺省时按 application/octet-stream 处理 → UNSUPPORTED_MIME', async () => {
    fetchSpy.mockResolvedValue({
      ok: true, status: 200,
      headers: new Map(),
      arrayBuffer: async () => new ArrayBuffer(8),
    })
    const { executeTool } = await import('@/mcp/external/tools')
    const result = await executeTool(
      'upload_media_from_url',
      { url: 'https://example.com/x' },
      { userId: 'u1', scope: 'read_write' }
    )
    const data = JSON.parse(result.content[0].text)
    expect(data.errorCode).toBe('UNSUPPORTED_MIME')
  })

  it('实际拉到的字节数超出限制时返回 FILE_TOO_LARGE', async () => {
    // content-length 没声明，但 arrayBuffer 返回超大 buffer
    const big = new Uint8Array(20 * 1024 * 1024) // 20MB
    fetchSpy.mockResolvedValue({
      ok: true, status: 200,
      headers: new Map([['content-type', 'image/png']]),
      arrayBuffer: async () => big.buffer,
    })
    const { executeTool } = await import('@/mcp/external/tools')
    const result = await executeTool(
      'upload_media_from_url',
      { url: 'https://example.com/x.png' },
      { userId: 'u1', scope: 'read_write' }
    )
    const data = JSON.parse(result.content[0].text)
    expect(data.errorCode).toBe('FILE_TOO_LARGE')
  })
})

describe('MCP Tools - create_post (executeTool)', () => {
  beforeEach(() => {
    resetMocks()
  })

  it('成功：创建 scheduled 帖，生成 publishToken', async () => {
    accountMock.findFirst.mockResolvedValue({
      id: 'a1', userId: 'u1', deletedAt: null,
    })
    postMock.create.mockResolvedValue({
      id: 'p-new', accountId: 'a1',
      content: 'Hello', mediaUrls: '[]',
      scheduledTime: new Date('2026-12-01T10:00:00Z'),
      timezone: 'Asia/Shanghai', status: 'scheduled',
      publishToken: 'tok_xyz',
      account: { name: 'My Twitter' },
    })
    const { executeTool } = await import('@/mcp/external/tools')
    const result = await executeTool(
      'create_post',
      { accountId: 'a1', content: 'Hello', scheduledTime: '2026-12-01T10:00:00Z' },
      { userId: 'u1', scope: 'read_write' }
    )
    const data = JSON.parse(result.content[0].text)
    expect(data.success).toBe(true)
    expect(data.post.id).toBe('p-new')
    expect(data.post.publishToken).toBe('tok_xyz')
    expect(postMock.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 'u1',
        accountId: 'a1',
        status: 'scheduled',
        publishToken: expect.stringMatching(/^tok_/),
      }),
    }))
  })

  it('账号不存在时返回 ACCOUNT_NOT_FOUND', async () => {
    accountMock.findFirst.mockResolvedValue(null)
    const { executeTool } = await import('@/mcp/external/tools')
    const result = await executeTool(
      'create_post',
      { accountId: 'missing', content: 'x', scheduledTime: '2026-12-01T10:00:00Z' },
      { userId: 'u1', scope: 'read_write' }
    )
    const data = JSON.parse(result.content[0].text)
    expect(data.errorCode).toBe('ACCOUNT_NOT_FOUND')
  })

  it('content + mediaUrls 都空时返回 EMPTY_CONTENT', async () => {
    accountMock.findFirst.mockResolvedValue({ id: 'a1' })
    const { executeTool } = await import('@/mcp/external/tools')
    const result = await executeTool(
      'create_post',
      { accountId: 'a1', scheduledTime: '2026-12-01T10:00:00Z' },
      { userId: 'u1', scope: 'read_write' }
    )
    const data = JSON.parse(result.content[0].text)
    expect(data.errorCode).toBe('EMPTY_CONTENT')
  })

  it('scheduledTime 不是合法 ISO 字符串返回 INVALID_SCHEDULED_TIME', async () => {
    accountMock.findFirst.mockResolvedValue({ id: 'a1' })
    const { executeTool } = await import('@/mcp/external/tools')
    const result = await executeTool(
      'create_post',
      { accountId: 'a1', content: 'x', scheduledTime: 'not-a-date' },
      { userId: 'u1', scope: 'read_write' }
    )
    const data = JSON.parse(result.content[0].text)
    expect(data.errorCode).toBe('INVALID_SCHEDULED_TIME')
  })

  it('scheduledTime 过去时间返回 SCHEDULED_TIME_IN_PAST', async () => {
    accountMock.findFirst.mockResolvedValue({ id: 'a1' })
    const { executeTool } = await import('@/mcp/external/tools')
    const result = await executeTool(
      'create_post',
      { accountId: 'a1', content: 'x', scheduledTime: '2020-01-01T00:00:00Z' },
      { userId: 'u1', scope: 'read_write' }
    )
    const data = JSON.parse(result.content[0].text)
    expect(data.errorCode).toBe('SCHEDULED_TIME_IN_PAST')
  })

  it('不带 timezone 时默认 Asia/Shanghai', async () => {
    accountMock.findFirst.mockResolvedValue({ id: 'a1' })
    postMock.create.mockResolvedValue({
      id: 'p', accountId: 'a1', content: 'x', mediaUrls: '[]',
      scheduledTime: new Date(), timezone: 'Asia/Shanghai', status: 'scheduled',
      publishToken: 'tok', account: { name: 'X' },
    })
    const { executeTool } = await import('@/mcp/external/tools')
    await executeTool(
      'create_post',
      { accountId: 'a1', content: 'x', scheduledTime: '2026-12-01T10:00:00Z' },
      { userId: 'u1', scope: 'read_write' }
    )
    expect(postMock.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ timezone: 'Asia/Shanghai' }),
    }))
  })
})

describe('MCP Tools - update_post (executeTool)', () => {
  beforeEach(() => {
    resetMocks()
  })

  it('成功：只更新 scheduledTime，content/media/account 不变', async () => {
    postMock.findFirst.mockResolvedValue({
      id: 'p1', userId: 'u1', deletedAt: null, status: 'scheduled',
      accountId: 'a1', content: 'Original', mediaUrls: '["/old.jpg"]',
      scheduledTime: new Date('2026-06-01T10:00:00Z'),
      timezone: 'Asia/Shanghai',
      publishToken: 'tok_abc',
      account: { name: 'My Twitter' },
    })
    postMock.update.mockResolvedValue({
      id: 'p1', userId: 'u1', accountId: 'a1', content: 'Original',
      mediaUrls: '["/old.jpg"]',
      scheduledTime: new Date('2026-12-01T10:00:00Z'),
      timezone: 'Asia/Shanghai', status: 'scheduled',
      publishToken: 'tok_abc',
      account: { name: 'My Twitter' },
    })
    const { executeTool } = await import('@/mcp/external/tools')
    const result = await executeTool(
      'update_post',
      { postId: 'p1', scheduledTime: '2026-12-01T10:00:00Z' },
      { userId: 'u1', scope: 'read_write' }
    )
    const data = JSON.parse(result.content[0].text)
    expect(data.success).toBe(true)
    // 关键：update 调用只包含 scheduledTime，其它字段一个都不能传
    expect(postMock.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { scheduledTime: new Date('2026-12-01T10:00:00Z') },
      include: expect.objectContaining({ account: expect.any(Object) }),
    })
  })

  it('scheduledTime 过去时间拒绝更新', async () => {
    postMock.findFirst.mockResolvedValue({
      id: 'p1', userId: 'u1', deletedAt: null, status: 'scheduled',
      accountId: 'a1', content: 'x', mediaUrls: '[]',
      scheduledTime: new Date(), timezone: 'Asia/Shanghai', publishToken: 'tok',
      account: { name: 'X' },
    })
    const { executeTool } = await import('@/mcp/external/tools')
    const result = await executeTool(
      'update_post',
      { postId: 'p1', scheduledTime: '2020-01-01T00:00:00Z' },
      { userId: 'u1', scope: 'read_write' }
    )
    const data = JSON.parse(result.content[0].text)
    expect(data.errorCode).toBe('SCHEDULED_TIME_IN_PAST')
  })

  it('帖子不存在返回 POST_NOT_FOUND', async () => {
    postMock.findFirst.mockResolvedValue(null)
    const { executeTool } = await import('@/mcp/external/tools')
    const result = await executeTool(
      'update_post',
      { postId: 'missing', scheduledTime: '2026-12-01T10:00:00Z' },
      { userId: 'u1', scope: 'read_write' }
    )
    const data = JSON.parse(result.content[0].text)
    expect(data.errorCode).toBe('POST_NOT_FOUND')
  })

  it('published 状态的帖子不可更新', async () => {
    postMock.findFirst.mockResolvedValue({
      id: 'p1', userId: 'u1', deletedAt: null, status: 'published',
      accountId: 'a1', content: 'x', mediaUrls: '[]',
      scheduledTime: new Date(), timezone: 'UTC', publishToken: 'tok',
      account: { name: 'X' },
    })
    const { executeTool } = await import('@/mcp/external/tools')
    const result = await executeTool(
      'update_post',
      { postId: 'p1', scheduledTime: '2026-12-01T10:00:00Z' },
      { userId: 'u1', scope: 'read_write' }
    )
    const data = JSON.parse(result.content[0].text)
    expect(data.errorCode).toBe('INVALID_STATUS')
  })

  it('failed 状态的帖子也不可更新', async () => {
    postMock.findFirst.mockResolvedValue({
      id: 'p1', userId: 'u1', deletedAt: null, status: 'failed',
      accountId: 'a1', content: 'x', mediaUrls: '[]',
      scheduledTime: new Date(), timezone: 'UTC', publishToken: 'tok',
      account: { name: 'X' },
    })
    const { executeTool } = await import('@/mcp/external/tools')
    const result = await executeTool(
      'update_post',
      { postId: 'p1', scheduledTime: '2026-12-01T10:00:00Z' },
      { userId: 'u1', scope: 'read_write' }
    )
    const data = JSON.parse(result.content[0].text)
    expect(data.errorCode).toBe('INVALID_STATUS')
  })

  it('只传 timezone 也能成功', async () => {
    postMock.findFirst.mockResolvedValue({
      id: 'p1', userId: 'u1', deletedAt: null, status: 'draft',
      accountId: 'a1', content: 'x', mediaUrls: '[]',
      scheduledTime: new Date(), timezone: 'Asia/Shanghai', publishToken: 'tok',
      account: { name: 'X' },
    })
    postMock.update.mockResolvedValue({
      id: 'p1', userId: 'u1', accountId: 'a1', content: 'x', mediaUrls: '[]',
      scheduledTime: new Date(), timezone: 'UTC', status: 'draft',
      publishToken: 'tok', account: { name: 'X' },
    })
    const { executeTool } = await import('@/mcp/external/tools')
    const result = await executeTool(
      'update_post',
      { postId: 'p1', timezone: 'UTC' },
      { userId: 'u1', scope: 'read_write' }
    )
    const data = JSON.parse(result.content[0].text)
    expect(data.success).toBe(true)
    expect(postMock.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { timezone: 'UTC' },
    }))
  })

  it('白名单外的字段（content/mediaUrls/accountId/status）被静默忽略', async () => {
    postMock.findFirst.mockResolvedValue({
      id: 'p1', userId: 'u1', deletedAt: null, status: 'scheduled',
      accountId: 'a1', content: 'Original', mediaUrls: '["/x.jpg"]',
      scheduledTime: new Date('2026-12-01T10:00:00Z'),
      timezone: 'Asia/Shanghai', publishToken: 'tok',
      account: { name: 'X' },
    })
    postMock.update.mockResolvedValue({
      id: 'p1', userId: 'u1', accountId: 'a1', content: 'Original',
      mediaUrls: '["/x.jpg"]', scheduledTime: new Date('2026-12-01T10:00:00Z'),
      timezone: 'Asia/Shanghai', status: 'scheduled', publishToken: 'tok',
      account: { name: 'X' },
    })
    const { executeTool } = await import('@/mcp/external/tools')
    await executeTool(
      'update_post',
      {
        postId: 'p1',
        scheduledTime: '2026-12-01T10:00:00Z',
        // 这些字段都会被忽略
        content: 'HACKED',
        mediaUrls: ['/evil.jpg'],
        accountId: 'different-account',
        status: 'published',
      } as never,
      { userId: 'u1', scope: 'read_write' }
    )
    // update.data 不应包含白名单外字段
    const updateArgs = postMock.update.mock.calls[0][0]
    expect(updateArgs.data).not.toHaveProperty('content')
    expect(updateArgs.data).not.toHaveProperty('mediaUrls')
    expect(updateArgs.data).not.toHaveProperty('accountId')
    expect(updateArgs.data).not.toHaveProperty('status')
  })

  it('啥都不传（只传 postId）也返回成功，原样返回', async () => {
    postMock.findFirst.mockResolvedValue({
      id: 'p1', userId: 'u1', deletedAt: null, status: 'scheduled',
      accountId: 'a1', content: 'x', mediaUrls: '[]',
      scheduledTime: new Date('2026-12-01T10:00:00Z'),
      timezone: 'Asia/Shanghai', publishToken: 'tok',
      account: { name: 'X' },
    })
    const { executeTool } = await import('@/mcp/external/tools')
    const result = await executeTool(
      'update_post',
      { postId: 'p1' },
      { userId: 'u1', scope: 'read_write' }
    )
    const data = JSON.parse(result.content[0].text)
    expect(data.success).toBe(true)
    expect(postMock.update).not.toHaveBeenCalled()
  })
})

describe('MCP Tools - scope 强制', () => {
  beforeEach(() => {
    resetMocks()
  })

  it('read scope 调用 create_post 返回 INSUFFICIENT_SCOPE', async () => {
    const { executeTool } = await import('@/mcp/external/tools')
    const result = await executeTool(
      'create_post',
      { accountId: 'a1', content: 'x', scheduledTime: '2026-12-01T10:00:00Z' },
      { userId: 'u1', scope: 'read' }
    )
    const data = JSON.parse(result.content[0].text)
    expect(data.errorCode).toBe('INSUFFICIENT_SCOPE')
    expect(postMock.create).not.toHaveBeenCalled()
  })

  it('write scope 调用 list_accounts 返回 INSUFFICIENT_SCOPE（write 不含 read）', async () => {
    const { executeTool } = await import('@/mcp/external/tools')
    const result = await executeTool(
      'list_accounts',
      {},
      { userId: 'u1', scope: 'write' }
    )
    const data = JSON.parse(result.content[0].text)
    expect(data.errorCode).toBe('INSUFFICIENT_SCOPE')
  })

  it('read_write scope 调用任意工具都通过', async () => {
    accountMock.findMany.mockResolvedValue([])
    accountMock.findFirst.mockResolvedValue({ id: 'a1' })
    postMock.create.mockResolvedValue({
      id: 'p', accountId: 'a1', content: 'x', mediaUrls: '[]',
      scheduledTime: new Date(), timezone: 'Asia/Shanghai', status: 'scheduled',
      publishToken: 'tok', account: { name: 'X' },
    })
    const { executeTool } = await import('@/mcp/external/tools')
    const r1 = await executeTool('list_accounts', {}, { userId: 'u1', scope: 'read_write' })
    expect(JSON.parse(r1.content[0].text).accounts).toBeDefined()

    const r2 = await executeTool(
      'create_post',
      { accountId: 'a1', content: 'x', scheduledTime: '2026-12-01T10:00:00Z' },
      { userId: 'u1', scope: 'read_write' }
    )
    expect(JSON.parse(r2.content[0].text).success).toBe(true)
  })
})

describe('MCP Tools - 向后兼容 string 调用', () => {
  beforeEach(() => {
    resetMocks()
  })

  it('executeTool 第二参传 string 时按 read scope 处理（旧的调用方式）', async () => {
    accountMock.findMany.mockResolvedValue([
      { id: 'a1', name: 'X', platform: { name: 'twitter' } },
    ])
    const { executeTool } = await import('@/mcp/external/tools')
    const result = await executeTool('list_accounts', {}, 'user-1')
    const data = JSON.parse(result.content[0].text)
    expect(data.accounts).toBeDefined()
  })

  it('向后兼容：传 string 调用 create_post 会被拒（read scope）', async () => {
    const { executeTool } = await import('@/mcp/external/tools')
    const result = await executeTool(
      'create_post',
      { accountId: 'a1', content: 'x', scheduledTime: '2026-12-01T10:00:00Z' },
      'user-1'  // 旧式 string 调用
    )
    const data = JSON.parse(result.content[0].text)
    expect(data.errorCode).toBe('INSUFFICIENT_SCOPE')
  })
})
