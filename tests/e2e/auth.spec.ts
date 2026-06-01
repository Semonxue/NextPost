import { test, expect } from '@playwright/test'

// 生成唯一用户名
const genUser = () => `u${Date.now()}${Math.random().toString(36).slice(2, 8)}`

test.describe('认证模块', () => {
  test.describe('TC-AUTH-001: 用户注册成功', () => {
    test('应该能够成功注册新用户', async ({ page }) => {
      const username = genUser()
      
      await page.goto('/register')
      await page.getByPlaceholder('请输入用户名').fill(username)
      await page.getByPlaceholder('请输入密码（至少6位）').fill('Test123456')
      await page.getByPlaceholder('请再次输入密码').fill('Test123456')
      await page.getByRole('button', { name: '注册' }).click()
      
      // 等待跳转到登录页
      await expect(page).toHaveURL(/\/login/, { timeout: 15000 })
    })
  })

  test.describe('TC-AUTH-002: 用户名已存在', () => {
    test('应该提示用户名已存在', async ({ page }) => {
      const username = genUser()
      
      // 先注册一个用户
      await page.goto('/register')
      await page.getByPlaceholder('请输入用户名').fill(username)
      await page.getByPlaceholder('请输入密码（至少6位）').fill('Test123456')
      await page.getByPlaceholder('请再次输入密码').fill('Test123456')
      await page.getByRole('button', { name: '注册' }).click()
      
      // 等待跳转到登录页
      await expect(page).toHaveURL(/\/login/, { timeout: 15000 })
      
      // 尝试用同一个用户名注册
      await page.goto('/register')
      await page.getByPlaceholder('请输入用户名').fill(username)
      await page.getByPlaceholder('请输入密码（至少6位）').fill('Test123456')
      await page.getByPlaceholder('请再次输入密码').fill('Test123456')
      await page.getByRole('button', { name: '注册' }).click()
      
      // 验证错误提示
      await expect(page.getByText('用户名已存在')).toBeVisible()
    })
  })

  test.describe('TC-AUTH-003: 密码不匹配', () => {
    test('应该提示密码不一致', async ({ page }) => {
      await page.goto('/register')
      await page.getByPlaceholder('请输入用户名').fill(genUser())
      await page.getByPlaceholder('请输入密码（至少6位）').fill('Test123456')
      await page.getByPlaceholder('请再次输入密码').fill('DifferentPassword')
      await page.getByRole('button', { name: '注册' }).click()
      
      // 验证错误提示
      await expect(page.getByText('两次密码输入不一致')).toBeVisible()
    })
  })

  test.describe('TC-AUTH-004: 用户登录成功', () => {
    test('应该能够成功登录', async ({ page }) => {
      const username = genUser()
      
      // 先注册用户
      await page.goto('/register')
      await page.getByPlaceholder('请输入用户名').fill(username)
      await page.getByPlaceholder('请输入密码（至少6位）').fill('Test123456')
      await page.getByPlaceholder('请再次输入密码').fill('Test123456')
      await page.getByRole('button', { name: '注册' }).click()
      
      // 等待跳转到登录页
      await expect(page).toHaveURL(/\/login/, { timeout: 15000 })
      
      // 登录
      await page.getByPlaceholder('请输入用户名').fill(username)
      await page.getByPlaceholder('请输入密码').fill('Test123456')
      await page.getByRole('button', { name: '登录' }).click()
      
      // 等待登录成功并跳转到首页
      await expect(page).toHaveURL('/', { timeout: 15000 })
    })
  })

  test.describe('TC-AUTH-005: 密码错误', () => {
    test('应该提示密码错误', async ({ page }) => {
      const username = genUser()
      
      // 先注册用户
      await page.goto('/register')
      await page.getByPlaceholder('请输入用户名').fill(username)
      await page.getByPlaceholder('请输入密码（至少6位）').fill('Test123456')
      await page.getByPlaceholder('请再次输入密码').fill('Test123456')
      await page.getByRole('button', { name: '注册' }).click()
      
      // 等待跳转到登录页
      await expect(page).toHaveURL(/\/login/, { timeout: 15000 })
      
      // 尝试用错误密码登录
      await page.getByPlaceholder('请输入用户名').fill(username)
      await page.getByPlaceholder('请输入密码').fill('WrongPassword')
      await page.getByRole('button', { name: '登录' }).click()
      
      // 验证错误提示
      await expect(page.getByText('用户名或密码错误')).toBeVisible()
    })
  })
})
