import { test, expect } from '@playwright/test'

test.describe('内容创作模块', () => {
  // 登录
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('用户名').fill('testuser001')
    await page.getByLabel('密码').fill('Test123456')
    await page.getByRole('button', { name: '登录' }).click()
    await expect(page).toHaveURL('/')
  })

  test.describe('TC-POST-001: 创建帖子 - 仅文本', () => {
    test('应该能够创建带计划时间的帖子', async ({ page }) => {
      await page.goto('/posts/new')

      // 选择账号
      await page.locator('select').selectOption({ index: 1 })

      // 输入内容
      await page.getByLabel('内容').fill('这是一条测试推文')

      // 设置发布时间 (明天15:00)
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const dateStr = tomorrow.toISOString().split('T')[0]
      await page.getByLabel('日期').fill(dateStr)
      await page.getByLabel('时间').fill('15:00')

      // 点击发布
      await page.getByRole('button', { name: '发布' }).click()

      // 验证跳转到列表页
      await expect(page).toHaveURL('/posts')

      // 验证成功提示
      await expect(page.getByText('创建成功')).toBeVisible()
    })
  })

  test.describe('TC-POST-002: 创建帖子 - 保存草稿', () => {
    test('应该能够保存为草稿', async ({ page }) => {
      await page.goto('/posts/new')

      // 选择账号
      await page.locator('select').selectOption({ index: 1 })

      // 输入内容
      await page.getByLabel('内容').fill('这是一条草稿')

      // 点击保存草稿
      await page.getByRole('button', { name: '保存草稿' }).click()

      // 验证成功提示
      await expect(page.getByText('创建成功')).toBeVisible()

      // 验证草稿状态
      await page.goto('/posts')
      await expect(page.locator('text=草稿')).toBeVisible()
    })
  })

  test.describe('TC-POST-003: 未选择账号', () => {
    test('应该提示选择账号', async ({ page }) => {
      await page.goto('/posts/new')

      // 不选择账号，直接输入内容
      await page.getByLabel('内容').fill('测试内容')

      // 点击发布
      await page.getByRole('button', { name: '发布' }).click()

      // 验证错误提示
      await expect(page.getByText('请选择账号')).toBeVisible()
    })
  })

  test.describe('TC-POST-004: 空内容', () => {
    test('应该提示内容不能为空', async ({ page }) => {
      await page.goto('/posts/new')

      // 选择账号
      await page.locator('select').selectOption({ index: 1 })

      // 不输入内容
      // 点击发布
      await page.getByRole('button', { name: '发布' }).click()

      // 验证错误提示
      await expect(page.getByText('内容或媒体不能同时为空')).toBeVisible()
    })
  })

  test.describe('TC-POST-007: 删除帖子', () => {
    test('应该能够删除帖子', async ({ page }) => {
      // 先创建一个帖子
      await page.goto('/posts/new')
      await page.locator('select').selectOption({ index: 1 })
      await page.getByLabel('内容').fill('待删除的帖子')
      await page.getByRole('button', { name: '保存草稿' }).click()

      // 前往列表页
      await page.goto('/posts')

      // 找到并点击删除
      const postRow = page.locator('tr', { hasText: '待删除的帖子' })
      await postRow.getByRole('button', { name: '删除' }).click()

      // 确认删除
      await page.getByRole('button', { name: '确认' }).click()

      // 验证成功提示
      await expect(page.getByText('删除成功')).toBeVisible()

      // 验证帖子已删除
      await expect(postRow).not.toBeVisible()
    })
  })
})