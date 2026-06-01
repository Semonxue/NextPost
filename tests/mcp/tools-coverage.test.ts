/**
 * MCP External Tools 实际函数测试
 *
 * 用模块级共享的 prisma mocks 拦截 tools.ts 顶层 new PrismaClient()。
 * 覆盖：list_accounts / get_pending_posts / get_post_detail / report_publish_result
 *       / executeTool 错误分支 / getBaseUrl env 路径 / toAbsoluteUrl 相对路径处理
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ---------- 模块级共享 mock ----------
// 必须 hoist 到模块作用域，否则 new PrismaClient() 每次会创建新实例，旧的 mock 设置会失效

const postMock = {
  findMany: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
}
const accountMock = {
  findMany: vi.fn(),
}

class FakePrismaClient {
  post = postMock
  account = accountMock
}

vi.mock('@prisma/client', () => ({
  PrismaClient: FakePrismaClient,
}))

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
