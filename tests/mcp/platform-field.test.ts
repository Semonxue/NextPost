/**
 * MCP 工具 platform 字段返回测试（v0.5.1）
 *
 * 验证 getPendingPosts / getPostDetail / listAccounts 返回结构包含 platform 字段
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'

// Mock Prisma
const prisma = new PrismaClient()

let testUserId: string
let testPlatformId: string
let testAccountId: string
let testPostId: string

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { username: `mcp_platform_${Date.now()}`, password: 'hash' }
  })
  testUserId = user.id

  // 用 upsert 标准 Twitter 平台
  const platform = await prisma.platform.upsert({
    where: { name: 'Twitter' },
    update: {},
    create: { name: 'Twitter', icon: '/icons/twitter.svg' }
  })
  testPlatformId = platform.id

  const account = await prisma.account.create({
    data: {
      userId: testUserId,
      platformId: testPlatformId,
      name: 'MCP Platform Test',
      handle: '@mcptest'
    }
  })
  testAccountId = account.id

  const post = await prisma.post.create({
    data: {
      userId: testUserId,
      accountId: testAccountId,
      content: '#test hashtag content',
      title: 'Test Title',
      mediaUrls: '[]',
      mediaThumbnails: '[]',
      status: 'scheduled',
      scheduledTime: new Date(Date.now() + 24 * 3600 * 1000), // get_pending_posts 要求非 null
      publishToken: 'tok_test'
    }
  })
  testPostId = post.id
})

afterAll(async () => {
  // 清理（级联删除 post，然后 user）
  await prisma.post.deleteMany({ where: { userId: testUserId } })
  await prisma.account.deleteMany({ where: { userId: testUserId } })
  await prisma.user.delete({ where: { id: testUserId } })
  await prisma.$disconnect()
})

// Mock tools 依赖的 prisma
vi.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: prisma,
}))

vi.mock('@/lib/storage', () => ({
  uploadFile: vi.fn(),
}))

import { executeTool, extractHashtags } from '@/mcp/external/tools'

describe('MCP platform 字段（v0.5.1）', () => {
  it('list_accounts 返回含 platform + platformId 字段', async () => {
    const result = await executeTool('list_accounts', {}, { userId: testUserId, scope: 'read' })
    const text = result.content[0].text
    const data = JSON.parse(text)
    expect(data.accounts).toBeInstanceOf(Array)
    const acc = data.accounts.find((a: { id: string }) => a.id === testAccountId)
    expect(acc).toBeDefined()
    expect(acc.platform).toBe('Twitter') // 名字 string
    expect(acc.platformId).toBeTruthy() // 新的 v0.5.1 字段
    expect(acc.platformId).toBe(testPlatformId)
  })

  it('get_pending_posts 返回 Post 含 platform 字段', async () => {
    const result = await executeTool('get_pending_posts', {}, { userId: testUserId, scope: 'read' })
    const data = JSON.parse(result.content[0].text)
    const post = data.posts.find((p: { id: string }) => p.id === testPostId)
    expect(post).toBeDefined()
    expect(post.platform).toBe('Twitter') // v0.5.1 新增
    expect(post.title).toBe('Test Title') // v0.5
    expect(post.extractedTopics).toEqual(['test']) // v0.5 computed
  })

  it('get_post_detail 返回 Post 含 platform 字段', async () => {
    const result = await executeTool('get_post_detail', { postId: testPostId }, { userId: testUserId, scope: 'read' })
    const data = JSON.parse(result.content[0].text)
    expect(data.post).toBeDefined()
    expect(data.post.platform).toBe('Twitter') // v0.5.1 新增
    expect(data.post.title).toBe('Test Title')
    expect(data.post.extractedTopics).toEqual(['test'])
  })

  it('create_post 返回 post 含 platform 字段', async () => {
    const future = new Date(Date.now() + 24 * 3600 * 1000).toISOString()
    const result = await executeTool(
      'create_post',
      {
        accountId: testAccountId,
        content: 'create_post test',
        title: 'New Title',
        scheduledTime: future,
      },
      { userId: testUserId, scope: 'write' }
    )
    const data = JSON.parse(result.content[0].text)
    expect(data.post).toBeDefined()
    expect(data.post.platform).toBe('Twitter') // v0.5.1 新增
    expect(data.post.title).toBe('New Title')
  })
})
