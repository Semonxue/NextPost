import { test, expect } from '@playwright/test'

const genUser = () => `u${Date.now()}${Math.random().toString(36).slice(2, 8)}`

test.describe('账号管理模块', () => {
  test.beforeEach(async ({ page }) => {
    const username = genUser()

    await page.goto('/register')
    await page.getByPlaceholder('请输入用户名').fill(username)
    await page.getByPlaceholder('请输入密码（至少6位）').fill('Test123456')
    await page.getByPlaceholder('请再次输入密码').fill('Test123456')
    await page.getByRole('button', { name: '注册' }).click()

    await expect(page).toHaveURL(/\/login/, { timeout: 15000 })

    await page.getByPlaceholder('请输入用户名').fill(username)
    await page.getByPlaceholder('请输入密码').fill('Test123456')
    await page.getByRole('button', { name: '登录' }).click()

    await expect(page).toHaveURL('/', { timeout: 15000 })
  })

  test.describe('TC-ACCT-001: 添加账号成功', () => {
    test('应该能够成功添加账号', async ({ page }) => {
      await page.goto('/accounts')

      await page.getByText('添加账号').first().click()

      await page.getByLabel('账号名称').fill('我的小号')
      await page.getByLabel('Twitter Handle').fill('myaccount')

      await page.getByRole('button', { name: '创建' }).click()

      await expect(page.getByText('账号已创建').first()).toBeVisible()
    })
  })

  test.describe('TC-ACCT-003: 必填字段验证', () => {
    test('应该验证必填字段', async ({ page }) => {
      await page.goto('/accounts')

      await page.getByText('添加账号').first().click()

      await page.getByRole('button', { name: '创建' }).click()

      // 等待 toast 错误消息出现
      await expect(page.locator('.fixed.bottom-4.right-4').getByText('名称和handle不能为空').first()).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('TC-ACCT-004: 编辑账号', () => {
    test('应该能够编辑账号', async ({ page }) => {
      await page.goto('/accounts')

      await page.getByText('添加账号').first().click()
      await page.getByLabel('账号名称').fill('待编辑账号')
      await page.getByLabel('Twitter Handle').fill('toedit')
      await page.getByRole('button', { name: '创建' }).click()
      await expect(page.getByText('账号已创建').first()).toBeVisible()

      // 等待卡片出现
      await page.waitForTimeout(1000)

      // 点击第一个卡片的编辑图标按钮
      const firstCard = page.locator('.bg-white.dark\\:bg-gray-800.rounded-xl').first()
      await firstCard.locator('button').first().click()

      // 等待 Modal 打开
      await page.waitForTimeout(500)

      await page.getByLabel('账号名称').clear()
      await page.getByLabel('账号名称').fill('已编辑账号')

      // 使用 locator 查找保存按钮
      await page.locator('button:has-text("保存")').click()

      await expect(page.getByText('账号已更新').first()).toBeVisible()
    })
  })

  test.describe('TC-ACCT-005: 删除账号', () => {
    test('应该能够删除账号', async ({ page }) => {
      await page.goto('/accounts')

      await page.getByText('添加账号').first().click()
      await page.getByLabel('账号名称').fill('待删除账号')
      await page.getByLabel('Twitter Handle').fill('todelete')
      await page.getByRole('button', { name: '创建' }).click()
      await expect(page.getByText('账号已创建').first()).toBeVisible()

      // 等待 toast 消失
      await page.waitForTimeout(500)

      // 点击第一个卡片的删除图标按钮 - 先注册 dialog handler
      page.on('dialog', dialog => dialog.accept())
      const firstCard = page.locator('.bg-white.dark\\:bg-gray-800.rounded-xl').first()
      await firstCard.locator('button').last().click()

      // 等待 toast 出现
      await expect(page.locator('.fixed.bottom-4.right-4').getByText('账号已删除').first()).toBeVisible({ timeout: 10000 })
    })
  })
})
