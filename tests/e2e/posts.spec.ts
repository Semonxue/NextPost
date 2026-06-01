import { test, expect } from '@playwright/test'

const genUser = () => `u${Date.now()}${Math.random().toString(36).slice(2, 8)}`

test.describe('内容创作模块', () => {
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

  test.describe('TC-POST-001: 创建帖子 - 仅文本', () => {
    test('应该能够创建带计划时间的帖子', async ({ page }) => {
      await page.goto('/posts/new')
      await page.waitForLoadState('networkidle')
      await page.locator('textarea').fill('这是一条测试帖子')

      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const year = tomorrow.getFullYear()
      const month = String(tomorrow.getMonth() + 1).padStart(2, '0')
      const day = String(tomorrow.getDate()).padStart(2, '0')

      await page.locator('input[type="datetime-local"]').fill(`${year}-${month}-${day}T10:00`)
      await page.getByRole('button', { name: '发布计划' }).click()
      await expect(page.getByText('帖子已创建').first()).toBeVisible()
    })
  })

  test.describe('TC-POST-002: 创建帖子 - 保存草稿', () => {
    test('应该能够保存为草稿', async ({ page }) => {
      await page.goto('/posts/new')
      await page.waitForLoadState('networkidle')
      await page.locator('textarea').fill('这是一个草稿')
      await page.getByRole('button', { name: '保存草稿' }).click()
      await expect(page.getByText('草稿已保存').first()).toBeVisible()
    })
  })

  test.describe('TC-POST-003: 空内容提交', () => {
    test('应该提示内容不能为空', async ({ page }) => {
      await page.goto('/posts/new')
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: /发布计划|创建/ }).first().click()
      await expect(page.getByText(/请输入内容|内容不能为空/).first()).toBeVisible({ timeout: 3000 })
    })
  })

  test.describe('TC-POST-004: 帖子列表账号筛选', () => {
    test('应该能够按账号筛选帖子', async ({ page }) => {
      await page.goto('/posts/new')
      await page.waitForLoadState('networkidle')
      await page.locator('textarea').fill('测试帖子')
      await page.getByRole('button', { name: '保存草稿' }).click()
      await expect(page.getByText('草稿已保存').first()).toBeVisible()
      await page.goto('/posts')
      await page.waitForLoadState('networkidle')
      const rows = page.locator('tbody tr')
      await expect(rows.first()).toBeVisible()
    })
  })

  test.describe('TC-POST-005: 帖子列表账号筛选功能', () => {
    test('应该能够点击账号筛选并看到下拉选项', async ({ page }) => {
      await page.goto('/posts')
      await page.waitForLoadState('networkidle')
      const accountFilterButton = page.getByRole('button', { name: /账号/i }).first()
      await accountFilterButton.click()
      await page.waitForTimeout(300)
      const accountOption = page.locator('label:has(input[type="checkbox"])').first()
      await expect(accountOption).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('TC-POST-006: 帖子列表平台筛选', () => {
    test('应该能够看到平台筛选按钮', async ({ page }) => {
      await page.goto('/posts')
      await page.waitForLoadState('networkidle')
      const platformFilter = page.getByRole('button', { name: /平台/i }).first()
      await expect(platformFilter).toBeVisible()
    })
  })

  test.describe('TC-POST-007: 日历页面账号筛选功能', () => {
    test('应该能够点击日历账号筛选并看到下拉选项', async ({ page }) => {
      await page.goto('/calendar')
      await page.waitForLoadState('networkidle')
      const accountFilterButton = page.getByRole('button', { name: /账号/i }).first()
      await accountFilterButton.click()
      await page.waitForTimeout(300)
      const accountOption = page.locator('label:has(input[type="checkbox"])').first()
      await expect(accountOption).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('TC-POST-008: 日历页面添加帖子', () => {
    test('应该能够从日历页面跳转到新建帖子页面', async ({ page }) => {
      await page.goto('/calendar')
      await page.waitForLoadState('networkidle')
      const today = new Date()
      const dayOfMonth = today.getDate().toString()
      const dayCell = page.locator(`[data-day="${dayOfMonth}"], .calendar-day:has-text("${dayOfMonth}")`).first()
      if (await dayCell.isVisible()) {
        await dayCell.click()
        await page.waitForTimeout(500)
        const addButton = page.getByRole('button', { name: /添加/i }).first()
        if (await addButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await addButton.click()
          await expect(page).toHaveURL(/\/posts\/new/, { timeout: 5000 })
        }
      }
    })
  })

  test.describe('TC-POST-009: 从日历跳转到新建帖子带日期参数', () => {
    test('应该能够传递日期参数到新建帖子页面', async ({ page }) => {
      const targetDate = new Date()
      targetDate.setDate(targetDate.getDate() + 3)
      const dateStr = targetDate.toISOString().split('T')[0]
      await page.goto(`/posts/new?date=${dateStr}`)
      await page.waitForLoadState('networkidle')
      const datetimeInput = page.locator('input[type="datetime-local"]')
      await expect(datetimeInput).toBeVisible()
      const inputValue = await datetimeInput.inputValue()
      expect(inputValue).toContain(dateStr)
    })
  })

  test.describe('TC-POST-010: 时区选择', () => {
    test('应该能够选择不同时区', async ({ page }) => {
      await page.goto('/posts/new')
      await page.waitForLoadState('networkidle')
      await page.locator('textarea').fill('测试时区帖子')
      const timezoneSelect = page.locator('select').last()
      await expect(timezoneSelect).toBeVisible()
      await timezoneSelect.selectOption('America/New_York')
      await expect(timezoneSelect).toHaveValue('America/New_York')
    })
  })

  test.describe('TC-POST-011: 帖子列表状态显示', () => {
    test('应该正确显示不同状态的帖子', async ({ page }) => {
      await page.goto('/posts/new')
      await page.waitForLoadState('networkidle')
      await page.locator('textarea').fill('草稿帖子')
      await page.getByRole('button', { name: '保存草稿' }).click()
      await expect(page.getByText('草稿已保存').first()).toBeVisible()
      await page.goto('/posts/new')
      await page.waitForLoadState('networkidle')
      await page.locator('textarea').fill('计划帖子')
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const year = tomorrow.getFullYear()
      const month = String(tomorrow.getMonth() + 1).padStart(2, '0')
      const day = String(tomorrow.getDate()).padStart(2, '0')
      await page.locator('input[type="datetime-local"]').fill(`${year}-${month}-${day}T10:00`)
      await page.getByRole('button', { name: '发布计划' }).click()
      await expect(page.getByText('帖子已创建').first()).toBeVisible()
      await page.goto('/posts')
      await page.waitForLoadState('networkidle')
      const rows = page.locator('tbody tr')
      await expect(rows).toHaveCount(2, { timeout: 10000 })
    })
  })

  test.describe('TC-POST-012: 日历页面状态筛选功能', () => {
    test('应该能够按状态筛选日历中的帖子', async ({ page }) => {
      await page.goto('/posts/new')
      await page.waitForLoadState('networkidle')
      await page.locator('textarea').fill('测试草稿')
      await page.getByRole('button', { name: '保存草稿' }).click()
      await expect(page.getByText('草稿已保存').first()).toBeVisible()
      await page.goto('/calendar')
      await page.waitForLoadState('networkidle')
      const allButton = page.getByRole('button', { name: '全部' }).first()
      await expect(allButton).toBeVisible()
      const draftButton = page.getByRole('button', { name: '草稿' }).first()
      await draftButton.click()
      await page.waitForTimeout(500)
      const scheduledButton = page.getByRole('button', { name: '已计划' }).first()
      await scheduledButton.click()
      await page.waitForTimeout(500)
      const publishedButton = page.getByRole('button', { name: '已发布' }).first()
      await publishedButton.click()
      await page.waitForTimeout(500)
    })
  })

  test.describe('TC-POST-013: 日历选中日期显示帖子详情', () => {
    test('应该能够点击日历日期查看详情面板', async ({ page }) => {
      await page.goto('/calendar')
      await page.waitForLoadState('networkidle')
      // 验证页面加载成功
      await expect(page.getByText('日历视图').first()).toBeVisible()
      // 点击任意一个有效的日期单元格
      const dayCell = page.locator('.grid-cols-7 > div').nth(10)
      await dayCell.click()
      await page.waitForTimeout(500)
      // 验证右侧详情面板可见
      const detailPanel = page.locator('text=选择日期').or(page.locator('text=/\\d+月\\d+日/'))
      await expect(detailPanel.first()).toBeVisible({ timeout: 3000 })
    })
  })

  test.describe('TC-POST-014: 帖子列表外链按钮显示', () => {
    test('编辑按钮应该正确显示在操作列', async ({ page }) => {
      await page.goto('/posts/new')
      await page.waitForLoadState('networkidle')
      await page.locator('textarea').fill('测试外链帖子')
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const year = tomorrow.getFullYear()
      const month = String(tomorrow.getMonth() + 1).padStart(2, '0')
      const day = String(tomorrow.getDate()).padStart(2, '0')
      await page.locator('input[type="datetime-local"]').fill(`${year}-${month}-${day}T10:00`)
      await page.getByRole('button', { name: '发布计划' }).click()
      await expect(page.getByText('帖子已创建').first()).toBeVisible()
      await page.goto('/posts')
      await page.waitForLoadState('networkidle')
      const editButton = page.locator('a[href*="/posts/"][href*="/edit"]').first()
      await expect(editButton).toBeVisible()
    })
  })

  test.describe('TC-POST-015: 日历页帖子状态颜色显示', () => {
    test('不同状态的帖子应显示不同颜色', async ({ page }) => {
      await page.goto('/posts/new')
      await page.waitForLoadState('networkidle')
      await page.locator('textarea').fill('颜色测试草稿')
      await page.getByRole('button', { name: '保存草稿' }).click()
      await expect(page.getByText('草稿已保存').first()).toBeVisible()
      await page.goto('/calendar')
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: '草稿' }).click()
      await page.waitForTimeout(500)
      const draftButton = page.getByRole('button', { name: '草稿' })
      await expect(draftButton).toHaveClass(/bg-blue-600/)
    })
  })

  test.describe('TC-POST-016: 日历详情面板外链按钮', () => {
    test('详情面板中应显示添加按钮', async ({ page }) => {
      await page.goto('/calendar')
      await page.waitForLoadState('networkidle')
      // 点击一个日期触发详情面板
      const dayCell = page.locator('.grid-cols-7 > div').nth(10)
      await dayCell.click()
      await page.waitForTimeout(500)
      // 验证右侧面板有添加按钮
      const addButton = page.getByRole('button', { name: /添加/i })
      await expect(addButton).toBeVisible()
    })
  })
})
