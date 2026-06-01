import { test, expect, request } from '@playwright/test'

const genUser = () => `u${Date.now()}${Math.random().toString(36).slice(2, 8)}`

/**
 * 软删除 + 回收站 E2E 测试
 *
 * 验证回收站页面的恢复/永久删除功能（使用 API 模拟软删除，避开 UI confirm 时序问题）
 */

test.describe('软删除 + 回收站模块', () => {
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

  // 辅助函数：通过 UI 创建账号
  async function createAccountViaUI(page: any, name: string, handle: string) {
    await page.goto('/accounts')
    await page.waitForLoadState('networkidle')
    await page.getByText('添加账号').first().click()
    await page.waitForTimeout(300)
    await page.getByLabel('账号名称').fill(name)
    await page.getByLabel('Twitter Handle').fill(handle)
    await page.getByRole('button', { name: '创建' }).click()
    await expect(page.getByText('账号已创建').first()).toBeVisible({ timeout: 10000 })
  }

  // 辅助函数：通过 UI 创建草稿帖子
  async function createDraftPostViaUI(page: any, content: string) {
    await page.goto('/posts/new')
    await page.waitForLoadState('networkidle')
    await page.locator('textarea').fill(content)
    await page.getByRole('button', { name: '保存草稿' }).click()
    await expect(page.getByText('草稿已保存').first()).toBeVisible({ timeout: 10000 })
  }

  // 辅助函数：通过 API 获取帖子列表
  async function getFirstPostIdViaAPI(page: any): Promise<string | null> {
    const res = await page.request.get('/api/posts')
    if (res.ok()) {
      const data = await res.json()
      if (data.posts && data.posts.length > 0) {
        return data.posts[0].id
      }
    }
    return null
  }

  // 辅助函数：通过 API 获取账号列表
  async function getFirstAccountIdViaAPI(page: any): Promise<string | null> {
    const res = await page.request.get('/api/accounts')
    if (res.ok()) {
      const data = await res.json()
      const accounts = Array.isArray(data) ? data : data.accounts || []
      if (accounts.length > 0) {
        return accounts[0].id
      }
    }
    return null
  }

  // 辅助函数：通过 API 软删除帖子
  async function softDeletePostViaAPI(page: any, id: string) {
    const res = await page.request.delete(`/api/posts/${id}`)
    return res.ok()
  }

  // 辅助函数：通过 API 软删除账号
  async function softDeleteAccountViaAPI(page: any, id: string) {
    const res = await page.request.delete(`/api/accounts/${id}`)
    return res.ok()
  }

  test.describe('TC-SOFT-111：回收站页面 - 列表展示', () => {
    test('软删除帖子后，回收站能看到该帖子', async ({ page }) => {
      await createAccountViaUI(page, '测试账号', 'softacc1')
      await createDraftPostViaUI(page, '软删除测试帖子')

      // 通过 API 软删除
      const postId = await getFirstPostIdViaAPI(page)
      expect(postId).not.toBeNull()
      const ok = await softDeletePostViaAPI(page, postId!)
      expect(ok).toBe(true)

      // 跳转到回收站
      await page.goto('/trash')
      await page.waitForLoadState('networkidle')

      // 验证帖子 Tab 激活且显示了 1 个已删除帖子
      const trashItems = page.locator('[data-testid="trash-post-item"]')
      await expect(trashItems).toHaveCount(1, { timeout: 10000 })
      await expect(trashItems.first()).toContainText('软删除测试帖子')
    })

    test('软删除账号后，回收站账号 Tab 能看到', async ({ page }) => {
      await createAccountViaUI(page, '待删除账号', 'tobedel1')

      // 通过 API 软删除账号
      const accountId = await getFirstAccountIdViaAPI(page)
      expect(accountId).not.toBeNull()
      const ok = await softDeleteAccountViaAPI(page, accountId!)
      expect(ok).toBe(true)

      // 跳转到回收站
      await page.goto('/trash')
      await page.waitForLoadState('networkidle')

      // 切换到账号 Tab
      await page.getByTestId('tab-accounts').click()
      await page.waitForTimeout(500)

      // 验证账号 Tab 看到 1 个
      const accountItems = page.locator('[data-testid="trash-account-item"]')
      await expect(accountItems).toHaveCount(1, { timeout: 10000 })
      await expect(accountItems.first()).toContainText('待删除账号')
    })
  })

  test.describe('TC-SOFT-112：恢复帖子', () => {
    test('恢复后帖子在 /posts 列表重新出现', async ({ page }) => {
      await createAccountViaUI(page, '恢复测试账号', 'restore1')
      await createDraftPostViaUI(page, '要被恢复的帖子')

      // 软删除
      const postId = await getFirstPostIdViaAPI(page)
      await softDeletePostViaAPI(page, postId!)

      // 验证 /posts 列表已看不到
      await page.goto('/posts')
      await page.waitForLoadState('networkidle')
      await expect(page.locator('tbody tr')).toHaveCount(0)

      // 跳到回收站恢复
      await page.goto('/trash')
      await page.waitForLoadState('networkidle')
      await page.getByTestId('restore-button').first().click()
      await page.waitForTimeout(1500)

      // 验证回到 /posts 能看到
      await page.goto('/posts')
      await page.waitForLoadState('networkidle')
      await expect(page.locator('tbody tr').filter({ hasText: '要被恢复的帖子' })).toHaveCount(1)
    })
  })

  test.describe('TC-SOFT-115：空回收站状态', () => {
    test('新用户回收站显示空状态', async ({ page }) => {
      await page.goto('/trash')
      await page.waitForLoadState('networkidle')
      const emptyState = page.getByTestId('empty-state')
      await expect(emptyState).toBeVisible({ timeout: 10000 })
      await expect(emptyState).toContainText('回收站是空的')
    })
  })

  test.describe('TC-SOFT-114：永久删除二次确认', () => {
    test('取消永久删除时，帖子仍在回收站', async ({ page }) => {
      await createAccountViaUI(page, '永久删除账号', 'perm1')
      await createDraftPostViaUI(page, '待永久删除的帖子')

      // 软删除
      const postId = await getFirstPostIdViaAPI(page)
      await softDeletePostViaAPI(page, postId!)

      // 跳到回收站
      await page.goto('/trash')
      await page.waitForLoadState('networkidle')

      // 点击永久删除 - 但拒绝确认
      page.once('dialog', dialog => dialog.dismiss())
      await page.getByTestId('permanent-delete-button').first().click()
      await page.waitForTimeout(500)

      // 帖子应该还在
      const items = page.locator('[data-testid="trash-post-item"]')
      await expect(items).toHaveCount(1)
    })
  })

  test.describe('TC-SOFT-113：永久删除', () => {
    test('确认永久删除后从回收站消失', async ({ page }) => {
      await createAccountViaUI(page, '永久删除账号2', 'perm2')
      await createDraftPostViaUI(page, '真的要永久删除')

      // 软删除
      const postId = await getFirstPostIdViaAPI(page)
      await softDeletePostViaAPI(page, postId!)

      // 跳到回收站 - 确认永久删除
      await page.goto('/trash')
      await page.waitForLoadState('networkidle')
      // 接受 confirm 弹窗
      page.once('dialog', dialog => dialog.accept())
      await page.getByTestId('permanent-delete-button').first().click()
      await page.waitForTimeout(2000)

      // 应该看到空状态
      const emptyState = page.getByTestId('empty-state')
      await expect(emptyState).toBeVisible({ timeout: 10000 })
    })
  })
})
