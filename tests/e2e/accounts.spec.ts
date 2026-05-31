import { test, expect } from '@playwright/test'

test.describe('账号管理模块', () => {
  // 登录
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('用户名').fill('testuser001')
    await page.getByLabel('密码').fill('Test123456')
    await page.getByRole('button', { name: '登录' }).click()
    await expect(page).toHaveURL('/')
  })

  test.describe('TC-ACCT-001: 添加账号成功', () => {
    test('应该能够成功添加账号', async ({ page }) => {
      await page.goto('/accounts')

      // 点击添加账号
      await page.getByRole('button', { name: '添加账号' }).click()

      // 填写表单
      await page.getByLabel('账号名称').fill('我的小号')
      await page.getByLabel('Handle').fill('@myaccount')

      // 点击保存
      await page.getByRole('button', { name: '保存' }).click()

      // 验证成功提示
      await expect(page.getByText('创建成功')).toBeVisible()

      // 验证账号出现在列表中
      await expect(page.locator('text=我的小号')).toBeVisible()
    })
  })

  test.describe('TC-ACCT-003: 必填字段验证', () => {
    test('应该验证必填字段', async ({ page }) => {
      await page.goto('/accounts')

      // 点击添加账号
      await page.getByRole('button', { name: '添加账号' }).click()

      // 不填写直接保存
      await page.getByRole('button', { name: '保存' }).click()

      // 验证错误提示
      await expect(page.getByText('名称不能为空')).toBeVisible()
    })
  })

  test.describe('TC-ACCT-004: 编辑账号', () => {
    test('应该能够编辑账号', async ({ page }) => {
      await page.goto('/accounts')

      // 先添加一个账号
      await page.getByRole('button', { name: '添加账号' }).click()
      await page.getByLabel('账号名称').fill('待编辑账号')
      await page.getByLabel('Handle').fill('@toedit')
      await page.getByRole('button', { name: '保存' }).click()

      // 找到并点击编辑
      const accountRow = page.locator('tr', { hasText: '待编辑账号' })
      await accountRow.getByRole('button', { name: '编辑' }).click()

      // 修改名称
      await page.getByLabel('账号名称').clear()
      await page.getByLabel('账号名称').fill('已编辑账号')

      // 点击保存
      await page.getByRole('button', { name: '保存' }).click()

      // 验证更新成功
      await expect(page.getByText('更新成功')).toBeVisible()
      await expect(page.locator('text=已编辑账号')).toBeVisible()
    })
  })

  test.describe('TC-ACCT-005: 删除账号', () => {
    test('应该能够删除账号', async ({ page }) => {
      await page.goto('/accounts')

      // 先添加一个账号
      await page.getByRole('button', { name: '添加账号' }).click()
      await page.getByLabel('账号名称').fill('待删除账号')
      await page.getByLabel('Handle').fill('@todelete')
      await page.getByRole('button', { name: '保存' }).click()

      // 找到并点击删除
      const accountRow = page.locator('tr', { hasText: '待删除账号' })
      await accountRow.getByRole('button', { name: '删除' }).click()

      // 确认删除
      await page.getByRole('button', { name: '确认' }).click()

      // 验证成功提示
      await expect(page.getByText('删除成功')).toBeVisible()

      // 验证账号已删除
      await expect(accountRow).not.toBeVisible()
    })
  })
})