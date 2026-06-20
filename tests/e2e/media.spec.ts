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
    await page.getByLabel('账号 ID').fill('testacc')
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

  test.describe('TC-MEDIA-006: 上传图片并创建帖子 - 验证媒体持久化', () => {
    test('上传图片后创建帖子，列表页应显示媒体缩略图', async ({ page }) => {
      const testImagePath = '/tmp/test-image-persist.png'
      const buffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      )
      writeFileSync(testImagePath, buffer)

      // 1. 新建帖子并上传图片
      await page.goto('/posts/new')
      await page.waitForLoadState('networkidle')
      await page.locator('textarea').fill('测试图片持久化上传')

      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles(testImagePath)

      // 等待上传预览出现（MediaUploader 中的 img）
      await expect(page.locator('.relative.group img')).toBeVisible({ timeout: 5000 })

      // 2. 保存草稿
      await page.getByRole('button', { name: '保存草稿' }).click()
      await expect(page.getByText('草稿已保存').first()).toBeVisible({ timeout: 10000 })

      // 3. 验证跳转到列表页，并且列表中显示媒体缩略图
      await expect(page).toHaveURL(/\/posts$/, { timeout: 10000 })
      await page.waitForLoadState('networkidle')

      // 帖子列表应包含该帖子
      const postRow = page.locator('tbody tr').first()
      await expect(postRow).toBeVisible({ timeout: 5000 })

      // 列表中应有媒体预览（MediaPreview 渲染的 img，由缩略图生成）
      const mediaImg = postRow.locator('img').first()
      await expect(mediaImg).toBeVisible({ timeout: 5000 })

      // 验证 img src 指向 /api/uploads/ 路径
      const imgSrc = await mediaImg.getAttribute('src')
      expect(imgSrc).toContain('/api/uploads/')

      // 4. 打开编辑页验证媒体仍在
      const editLink = postRow.locator('a[href*="/edit"]').first()
      await editLink.click()
      await page.waitForLoadState('networkidle')

      // 编辑页的 MediaUploader 应显示已有媒体
      const editorMedia = page.locator('.relative.group').first()
      await expect(editorMedia).toBeVisible({ timeout: 5000 })

      unlinkSync(testImagePath)
    })
  })

  test.describe('TC-MEDIA-007: 上传多个图片并创建帖子', () => {
    test('同时上传多个图片后创建帖子，列表应显示第一张图', async ({ page }) => {
      // 创建两个不同的测试图片（使用 10x10 的 PNG 以确保 canvas 抽帧正常工作）
      const testImagePath1 = '/tmp/test-multi-image-1.png'
      const testImagePath2 = '/tmp/test-multi-image-2.png'
      // 使用与 TC-MEDIA-001 相同的已验证有效 1x1 PNG
      const buffer1 = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      )
      const buffer2 = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      )
      writeFileSync(testImagePath1, buffer1)
      writeFileSync(testImagePath2, buffer2)

      await page.goto('/posts/new')
      await page.waitForLoadState('networkidle')
      await page.locator('textarea').fill('测试多图上传')

      // 同时上传两个文件
      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles([testImagePath1, testImagePath2])

      // 等待两个预览都出现
      const mediaItems = page.locator('.relative.group')
      await expect(mediaItems).toHaveCount(2, { timeout: 10000 })

      // 保存草稿
      await page.getByRole('button', { name: '保存草稿' }).click()
      await expect(page.getByText('草稿已保存').first()).toBeVisible({ timeout: 10000 })

      // 列表页应显示第一张图的缩略图
      await expect(page).toHaveURL(/\/posts$/, { timeout: 10000 })
      await page.waitForLoadState('networkidle')

      const postRow = page.locator('tbody tr').first()
      await expect(postRow).toBeVisible({ timeout: 5000 })
      const mediaImg = postRow.locator('img').first()
      await expect(mediaImg).toBeVisible({ timeout: 5000 })

      unlinkSync(testImagePath1)
      unlinkSync(testImagePath2)
    })
  })

  // ============================================================
  // TC-MEDIA-AUTH: /api/uploads/ 公开访问（修复: middleware 白名单）
  // ============================================================
  test.describe('TC-MEDIA-AUTH: 图片无需登录', () => {
    test('上传图片后，图片 URL 应在未登录态下返回 200', async ({ page }) => {
      // 上传图片并创建帖子
      const testImagePath = '/tmp/test-upload-auth.png'
      const buffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      )
      writeFileSync(testImagePath, buffer)

      await page.goto('/posts/new')
      await page.waitForLoadState('networkidle')
      await page.locator('textarea').fill('公开图片测试')
      await page.locator('input[type="file"]').setInputFiles(testImagePath)
      // 等待上传完成：img src 从 base64 变成 /api/uploads/ URL
      await expect(page.locator('img[src*="/api/uploads/"]')).toBeVisible({ timeout: 10000 })

      // 保存帖子，拿到 mediaUrl
      await page.getByRole('button', { name: '保存草稿' }).click()
      await expect(page.getByText('草稿已保存').first()).toBeVisible({ timeout: 5000 })

      // 从 DOM 获取 img 的 src（完整 URL）
      const imgSrc = await page.locator('img').first().getAttribute('src')
      expect(imgSrc).toBeTruthy()
      expect(imgSrc).toContain('/api/uploads/')

      // 用 Node.js fetch 模拟未登录请求（不带任何 cookie）
      const baseUrl = process.env.APP_URL || 'http://localhost:3456'
      const imgUrl = imgSrc?.startsWith('http') ? imgSrc : `${baseUrl}${imgSrc}`
      const response = await fetch(imgUrl, { redirect: 'manual' })
      // 应该返回 200（不是 307 重定向到 /login）
      expect(response.status).toBe(200)

      unlinkSync(testImagePath)
    })
  })

  // ============================================================
  // TC-FORMAT-DATETIME: 空 scheduledTime 不崩溃（修复: formatDateTimeLocal 保护）
  // ============================================================
  test.describe('TC-FORMAT-DATETIME: 编辑 scheduledTime 为空的帖子', () => {
    test('编辑 scheduledTime 为空字符串的帖子不应崩溃', async ({ page }) => {
      // 创建一个 scheduledTime 为空的帖子（via API）
      // 先确保登录
      await page.goto('/posts/new')
      await page.waitForLoadState('networkidle')
      await page.locator('textarea').fill('空时间帖子')
      await page.getByRole('button', { name: '保存草稿' }).click()
      await expect(page.getByText('草稿已保存').first()).toBeVisible({ timeout: 5000 })

      // 找刚创建的帖子并编辑（URL 形如 /posts/:id/edit）
      await page.goto('/posts')
      await page.waitForLoadState('networkidle')
      const row = page.locator('tbody tr').filter({ hasText: '空时间帖子' }).first()
      await row.locator('a[href*="/edit"]').click()
      await page.waitForLoadState('networkidle')

      // 如果 formatDateTimeLocal 没有保护，这里会 RangeError: Invalid time value
      // 页面应正常渲染（input 有值或为空，不崩溃）
      const textarea = page.locator('textarea')
      await expect(textarea).toBeVisible()
      await expect(textarea).toHaveValue('空时间帖子')
    })
  })
})
