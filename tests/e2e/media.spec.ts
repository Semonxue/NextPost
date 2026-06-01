import { test, expect } from '@playwright/test'
import { writeFileSync, unlinkSync } from 'fs'

const genUser = () => `u${Date.now()}${Math.random().toString(36).slice(2, 8)}`

test.describe('媒体上传模块', () => {
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

    await page.goto('/accounts')
    await page.waitForLoadState('networkidle')
    await page.getByText('添加账号').first().click()
    await page.waitForTimeout(500)
    await page.getByLabel('账号名称').fill('测试账号')
    await page.getByLabel('Twitter Handle').fill('testacc')
    await page.getByRole('button', { name: '创建' }).click()
    await expect(page.getByText('账号已创建').first()).toBeVisible()
  })

  test.describe('TC-MEDIA-001: 上传图片', () => {
    test('应该能够上传图片到帖子', async ({ page }) => {
      const testImagePath = '/tmp/test-image.png'
      const buffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      )
      writeFileSync(testImagePath, buffer)

      await page.goto('/posts/new')
      await page.waitForLoadState('networkidle')
      await page.locator('textarea').fill('测试图片上传')

      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles(testImagePath)

      await expect(page.locator('img')).toBeVisible({ timeout: 5000 })

      unlinkSync(testImagePath)
    })
  })

  test.describe('TC-MEDIA-002: 上传视频提示', () => {
    test('应该显示支持的文件类型', async ({ page }) => {
      await page.goto('/posts/new')
      await page.waitForLoadState('networkidle')
      await page.locator('textarea').fill('测试视频上传')

      const dropZone = page.locator('div.border-dashed')
      await expect(dropZone).toBeVisible()

      await expect(page.getByText('支持 JPG, PNG, GIF, MP4（最大 10MB）')).toBeVisible()
    })
  })

  test.describe('TC-MEDIA-005: 移除已上传媒体', () => {
    test('应该能够移除已选择的媒体文件', async ({ page }) => {
      const testImagePath = '/tmp/test-image-remove.png'
      const buffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      )
      writeFileSync(testImagePath, buffer)

      await page.goto('/posts/new')
      await page.waitForLoadState('networkidle')
      await page.locator('textarea').fill('测试移除媒体')

      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles(testImagePath)

      // 等待图片出现
      await expect(page.locator('img')).toBeVisible({ timeout: 5000 })

      // 悬停到图片上以显示删除按钮，然后点击
      const imageContainer = page.locator('.relative.group').first()
      await imageContainer.hover()
      
      // 点击删除按钮（带有 X 图标的按钮）
      const deleteButton = page.locator('button.rounded-full').filter({ has: page.locator('svg') }).first()
      await deleteButton.click()

      // 验证图片已被移除
      await expect(page.locator('img')).not.toBeVisible()

      unlinkSync(testImagePath)
    })
  })
})
