import { test, expect } from '@playwright/test'

test.describe('认证模块', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test.describe('TC-AUTH-001: 用户注册成功', () => {
    test('应该能够成功注册新用户', async ({ page }) => {
      // 点击注册链接
      await page.getByRole('link', { name: '注册' }).click()
      await expect(page).toHaveURL('/register')

      // 填写注册表单
      await page.getByLabel('用户名').fill('testuser001')
      await page.getByLabel('密码').fill('Test123456')
      await page.getByLabel('确认密码').fill('Test123456')

      // 点击注册按钮
      await page.getByRole('button', { name: '注册' }).click()

      // 验证跳转到首页
      await expect(page).toHaveURL('/')

      // 验证用户已登录
      await expect(page.locator('text=仪表盘')).toBeVisible()
    })
  })

  test.describe('TC-AUTH-002: 用户名已存在', () => {
    test('应该提示用户名已存在', async ({ page }) => {
      // 先创建一个用户
      await page.getByRole('link', { name: '注册' }).click()
      await page.getByLabel('用户名').fill('existinguser')
      await page.getByLabel('密码').fill('Test123456')
      await page.getByLabel('确认密码').fill('Test123456')
      await page.getByRole('button', { name: '注册' }).click()
      await expect(page).toHaveURL('/')

      // 登出
      await page.getByRole('button', { name: '退出登录' }).click()
      await expect(page).toHaveURL('/login')

      // 尝试注册相同用户名
      await page.getByRole('link', { name: '注册' }).click()
      await page.getByLabel('用户名').fill('existinguser')
      await page.getByLabel('密码').fill('Test123456')
      await page.getByLabel('确认密码').fill('Test123456')
      await page.getByRole('button', { name: '注册' }).click()

      // 验证错误提示
      await expect(page.getByText('用户名已存在')).toBeVisible()
    })
  })

  test.describe('TC-AUTH-003: 密码不匹配', () => {
    test('应该提示密码不一致', async ({ page }) => {
      await page.getByRole('link', { name: '注册' }).click()
      await page.getByLabel('用户名').fill('newuser')
      await page.getByLabel('密码').fill('Test123456')
      await page.getByLabel('确认密码').fill('DifferentPass')
      await page.getByRole('button', { name: '注册' }).click()

      // 验证错误提示
      await expect(page.getByText('两次密码输入不一致')).toBeVisible()
    })
  })

  test.describe('TC-AUTH-004: 用户登录成功', () => {
    test('应该能够成功登录', async ({ page }) => {
      await page.getByLabel('用户名').fill('testuser001')
      await page.getByLabel('密码').fill('Test123456')
      await page.getByRole('button', { name: '登录' }).click()

      await expect(page).toHaveURL('/')
      await expect(page.locator('text=仪表盘')).toBeVisible()
    })
  })

  test.describe('TC-AUTH-005: 密码错误', () => {
    test('应该提示密码错误', async ({ page }) => {
      await page.getByLabel('用户名').fill('testuser001')
      await page.getByLabel('密码').fill('WrongPassword')
      await page.getByRole('button', { name: '登录' }).click()

      await expect(page.getByText('用户名或密码错误')).toBeVisible()
    })
  })

  test.describe('TC-AUTH-007: 路由保护', () => {
    test('未登录应重定向到登录页', async ({ page }) => {
      await page.context().clearCookies()
      await page.goto('/')
      
      await expect(page).toHaveURL(/\/login/)
    })
  })
})