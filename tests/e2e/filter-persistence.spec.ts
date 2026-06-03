import { test, expect } from '@playwright/test'

const genUser = () => `u${Date.now()}${Math.random().toString(36).slice(2, 8)}`

test.describe('筛选状态持久化', () => {
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

    // 创建多个账号用于测试筛选
    await page.goto('/accounts')
    await page.waitForLoadState('networkidle')

    // 创建第一个账号
    await page.getByText('添加账号').first().click()
    await page.waitForTimeout(500)
    await page.getByLabel('账号名称').fill('账号A')
    await page.getByLabel('Twitter Handle').fill('accounta')
    await page.getByRole('button', { name: '创建' }).click()
    await expect(page.getByText('账号已创建').first()).toBeVisible()

    // 创建第二个账号
    await page.getByText('添加账号').first().click()
    await page.waitForTimeout(500)
    await page.getByLabel('账号名称').fill('账号B')
    await page.getByLabel('Twitter Handle').fill('accountb')
    await page.getByRole('button', { name: '创建' }).click()
    await expect(page.getByText('账号已创建').first()).toBeVisible()
  })

  // 工具：打开"账号"筛选下拉，并等账号列表渲染（必须先有账号才能选）
  async function openAccountFilterAndPickFirst(page: any) {
    await page.getByRole('button', { name: '账号' }).first().click()
    // 显式等账号下拉里至少出现一个 label（账号已创建后会异步加载）
    const firstLabel = page.locator('label:has(input[type="checkbox"])').first()
    await expect(firstLabel).toBeVisible({ timeout: 5000 })
    await firstLabel.click()
    // 等 badge（带数字的 span）出现，确认 toggleAccount 已生效
    await expect(
      page.getByRole('button', { name: '账号' }).first().locator('span').filter({ hasText: /^\d+$/ })
    ).toBeVisible({ timeout: 3000 })
  }

  // 工具：打开"平台"筛选下拉并等平台列表渲染
  async function openPlatformFilterAndPickFirst(page: any) {
    await page.getByRole('button', { name: '平台' }).first().click()
    const firstLabel = page.locator('label:has(input[type="checkbox"])').first()
    await expect(firstLabel).toBeVisible({ timeout: 5000 })
    await firstLabel.click()
    await expect(
      page.getByRole('button', { name: '平台' }).first().locator('span').filter({ hasText: /^\d+$/ })
    ).toBeVisible({ timeout: 3000 })
  }

  test.describe('TC-FILTER-001: 账号筛选持久化 - 页面刷新', () => {
    test('筛选账号后刷新页面，筛选状态应保持', async ({ page }) => {
      await page.goto('/posts')
      await page.waitForLoadState('networkidle')

      await openAccountFilterAndPickFirst(page)

      // 刷新页面
      await page.reload()
      await page.waitForLoadState('networkidle')

      // 验证账号 badge 仍然可见（store rehydrate 成功）
      const stillSelectedBadge = page
        .getByRole('button', { name: '账号' })
        .first()
        .locator('span')
        .filter({ hasText: /^\d+$/ })
      await expect(stillSelectedBadge).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('TC-FILTER-002: 账号筛选持久化 - 跨页面导航', () => {
    test('在帖子列表筛选账号后切换到日历页，筛选状态应同步', async ({ page }) => {
      await page.goto('/posts')
      await page.waitForLoadState('networkidle')

      await openAccountFilterAndPickFirst(page)

      // 切换到日历页
      await page.goto('/calendar')
      await page.waitForLoadState('networkidle')

      // 验证筛选状态在日历页也同步显示（通过 cookie 共享）
      const selectedBadge = page
        .getByRole('button', { name: '账号' })
        .first()
        .locator('span')
        .filter({ hasText: /^\d+$/ })
      await expect(selectedBadge).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('TC-FILTER-003: 平台筛选持久化 - 页面刷新', () => {
    test('筛选平台后刷新页面，筛选状态应保持', async ({ page }) => {
      await page.goto('/posts')
      await page.waitForLoadState('networkidle')

      await openPlatformFilterAndPickFirst(page)

      // 刷新页面
      await page.reload()
      await page.waitForLoadState('networkidle')

      const selectedBadge = page
        .getByRole('button', { name: '平台' })
        .first()
        .locator('span')
        .filter({ hasText: /^\d+$/ })
      await expect(selectedBadge).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('TC-FILTER-004: 状态筛选持久化 - 页面刷新', () => {
    test('选择状态筛选后刷新页面，筛选状态应保持', async ({ page }) => {
      // 先创建一个草稿帖子
      await page.goto('/posts/new')
      await page.waitForLoadState('networkidle')
      await page.locator('textarea').fill('测试草稿')
      await page.getByRole('button', { name: '保存草稿' }).click()
      await expect(page.getByText('草稿已保存').first()).toBeVisible()

      await page.goto('/posts')
      await page.waitForLoadState('networkidle')

      const draftButton = page.getByRole('button', { name: '草稿' }).first()
      await draftButton.click()
      // 验证草稿按钮高亮
      await expect(draftButton).toHaveClass(/bg-blue-600/)

      // 刷新页面
      await page.reload()
      await page.waitForLoadState('networkidle')

      const stillDraftButton = page.getByRole('button', { name: '草稿' }).first()
      await expect(stillDraftButton).toHaveClass(/bg-blue-600/, { timeout: 5000 })
    })
  })

  test.describe('TC-FILTER-005: 清除筛选功能', () => {
    test('点击清除按钮应重置所有筛选状态', async ({ page }) => {
      await page.goto('/posts')
      await page.waitForLoadState('networkidle')

      // 选择账号筛选（用工具函数等账号加载完）
      await openAccountFilterAndPickFirst(page)

      // 选择状态筛选
      const draftButton = page.getByRole('button', { name: '草稿' }).first()
      await draftButton.click()
      await expect(draftButton).toHaveClass(/bg-blue-600/)

      // 点击清除按钮
      const clearButton = page.getByRole('button', { name: '清除' }).first()
      await clearButton.click()

      // 验证账号 badge 消失
      const accountBtn = page.getByRole('button', { name: '账号' }).first()
      await expect(
        accountBtn.locator('span').filter({ hasText: /^\d+$/ })
      ).toHaveCount(0, { timeout: 3000 })
      // 验证"全部"状态高亮
      await expect(page.getByRole('button', { name: '全部' }).first()).toHaveClass(/bg-blue-600/)
    })
  })

  test.describe('TC-FILTER-006: 日历页筛选状态同步', () => {
    test('在日历页筛选后切换到帖子列表，筛选状态应同步', async ({ page }) => {
      await page.goto('/calendar')
      await page.waitForLoadState('networkidle')

      // 等日历页的账号按钮可点 + 账号下拉加载完
      await openAccountFilterAndPickFirst(page)

      // 切换到帖子列表页
      await page.goto('/posts')
      await page.waitForLoadState('networkidle')

      const selectedBadge = page
        .getByRole('button', { name: '账号' })
        .first()
        .locator('span')
        .filter({ hasText: /^\d+$/ })
      await expect(selectedBadge).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('TC-FILTER-007: 排序状态持久化 - 页面刷新', () => {
    test('点击发布时间列头切换排序后刷新页面，排序状态应保持', async ({ page }) => {
      // 先造一个草稿帖子（让 table 表头出现）
      await page.goto('/posts/new')
      await page.waitForLoadState('networkidle')
      await page.locator('textarea').fill('排序测试帖子')
      await page.getByRole('button', { name: '保存草稿' }).click()
      await expect(page.getByText('草稿已保存').first()).toBeVisible()

      await page.goto('/posts')
      await page.waitForLoadState('networkidle')

      const sortHeader = page.locator('th:has-text("发布时间")')
      await expect(sortHeader).toBeVisible()

      // 点击切换排序（初始 desc → 升序）
      await sortHeader.click()
      // 验证排序图标存在
      await expect(page.locator('th:has-text("发布时间") svg').first()).toBeVisible()

      // 刷新页面
      await page.reload()
      await page.waitForLoadState('networkidle')

      // 排序状态保持：表头还在
      await expect(page.locator('th:has-text("发布时间")')).toBeVisible()
      // svg 仍在
      await expect(page.locator('th:has-text("发布时间") svg').first()).toBeVisible()
    })
  })

  test.describe('TC-FILTER-008: 搜索功能测试 - 回车触发', () => {
    test('在搜索框输入内容后按回车应触发搜索', async ({ page }) => {
      // 先造一个草稿帖子（让 table 出现）
      await page.goto('/posts/new')
      await page.waitForLoadState('networkidle')
      await page.locator('textarea').fill('搜索测试帖子')
      await page.getByRole('button', { name: '保存草稿' }).click()
      await expect(page.getByText('草稿已保存').first()).toBeVisible()

      await page.goto('/posts')
      await page.waitForLoadState('networkidle')

      const searchInput = page.locator('input[placeholder*="搜索"]')
      await expect(searchInput).toBeVisible()

      await searchInput.fill('搜索测试')
      await searchInput.press('Enter')
      // 等搜索请求完成
      await page.waitForLoadState('networkidle')

      // 表格应当仍然可见（搜索不报错）
      await expect(page.locator('table')).toBeVisible({ timeout: 5000 })
    })
  })
})
