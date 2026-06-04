/**
 * Playwright globalSetup
 *
 * 在 webServer 启动前为 e2e 创建/确保测试账号存在。
 * 当前用于解决 posts-platform-config.spec.ts 中 4 个 test 因
 * "testuser/password123" 账号不存在而被 skip 的问题。
 *
 * 幂等：每次 e2e 跑都会跑；如果 testuser 已存在则跳过创建。
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

export default async function globalSetup() {
  const prisma = new PrismaClient()
  try {
    // 确保 Twitter 平台存在（register API 会做，但 globalSetup 早于 webServer）
    await prisma.platform.upsert({
      where: { name: 'Twitter' },
      update: {},
      create: { name: 'Twitter', icon: '/icons/twitter.svg' },
    })

    // 确保 testuser 账号存在
    const existing = await prisma.user.findUnique({
      where: { username: 'testuser' },
    })
    let testuserId: string
    if (!existing) {
      const hashed = await bcrypt.hash('password123', 10)
      const user = await prisma.user.create({
        data: {
          username: 'testuser',
          password: hashed,
          email: 'testuser@example.com',
        },
      })
      testuserId = user.id
      console.log('[e2e globalSetup] Created testuser account')
    } else {
      testuserId = existing.id
      console.log('[e2e globalSetup] testuser already exists, skip')
    }

    // 给 testuser 创建一个 Twitter 账号（用于 posts-platform-config.spec.ts 里的下拉框断言）
    const twitter = await prisma.platform.findUnique({ where: { name: 'Twitter' } })
    if (twitter) {
      const existingAccount = await prisma.account.findFirst({
        where: { userId: testuserId, platformId: twitter.id },
      })
      if (!existingAccount) {
        await prisma.account.create({
          data: {
            userId: testuserId,
            platformId: twitter.id,
            name: 'Test Twitter Account',
            handle: '@testuser',
            description: 'E2E 测试账号',
          },
        })
        console.log('[e2e globalSetup] Created testuser Twitter account')
      }
    }
  } catch (err) {
    console.error('[e2e globalSetup] Failed:', err)
    throw err
  } finally {
    await prisma.$disconnect()
  }
}
