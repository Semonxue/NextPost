/**
 * /settings 页面外部 API Key 端到端（v0.4）
 *
 * 验证：
 * 1. 页面渲染 + scope 选择器可见
 * 2. 创建 read_write key 走通（用户能拿到 read_write 权限的 key）
 * 3. 修改已有 key 的 scope
 * 4. 列表显示 scope 标签
 * 5. 删 key
 */

import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const genUser = () => `settings_keys_${Date.now()}${Math.random().toString(36).slice(2, 6)}`;

test.describe('Settings 页面 — 外部 API Key + scope', () => {
  let username: string;
  let userId: string;

  test.beforeEach(async ({ page }) => {
    username = genUser();
    await page.goto('/register');
    await page.getByPlaceholder('请输入用户名').fill(username);
    await page.getByPlaceholder('请输入密码（至少6位）').fill('Test123456');
    await page.getByPlaceholder('请再次输入密码').fill('Test123456');
    await page.getByRole('button', { name: '注册' }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
    await page.getByPlaceholder('请输入用户名').fill(username);
    await page.getByPlaceholder('请输入密码').fill('Test123456');
    await page.getByRole('button', { name: '登录' }).click();
    await expect(page).toHaveURL('/', { timeout: 15000 });

    const user = await prisma.user.findUnique({ where: { username } });
    userId = user!.id;
  });

  test.afterEach(async () => {
    if (userId) {
      await prisma.externalApiKey.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
    }
  });

  test('TC-SETTINGS-001: 页面渲染 + scope 选择器默认 read_write', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: '外部 API Key（MCP）' })).toBeVisible();
    // 默认是 read_write（让用户能直接用 AI 创建帖子）
    const scopeSelect = page.getByTestId('new-key-scope-select');
    await expect(scopeSelect).toBeVisible();
    await expect(scopeSelect).toHaveValue('read_write');
  });

  test('TC-SETTINGS-002: UI 创建 read_write key → DB 真实写入 read_write', async ({ page }) => {
    await page.goto('/settings');

    // 填名称
    await page.getByPlaceholder(/输入 Key 名称/).fill('Claude Desktop Test');

    // scope 选 read_write（默认就是，但显式设一下）
    await page.getByTestId('new-key-scope-select').selectOption('read_write');

    // 点创建
    await page.getByRole('button', { name: '创建' }).click();

    // 完整 key 提示框出现
    await expect(page.getByText(/唯一一次显示完整 Key/)).toBeVisible({ timeout: 5000 });

    // 验证 DB 真实写入
    const dbKey = await prisma.externalApiKey.findFirst({
      where: { userId, name: 'Claude Desktop Test' },
    });
    expect(dbKey).toBeDefined();
    expect(dbKey?.permissions).toBe('read_write');
  });

  test('TC-SETTINGS-003: UI 创建 read key → DB 写入 read', async ({ page }) => {
    await page.goto('/settings');
    await page.getByPlaceholder(/输入 Key 名称/).fill('Read Only');
    await page.getByTestId('new-key-scope-select').selectOption('read');
    await page.getByRole('button', { name: '创建' }).click();

    // 等 DB 落库（轮询避免和 toast 竞争）
    await expect.poll(async () => {
      const k = await prisma.externalApiKey.findFirst({ where: { userId, name: 'Read Only' } });
      return k?.permissions;
    }, { timeout: 5000 }).toBe('read');
  });

  test('TC-SETTINGS-004: 列表显示 scope 标签', async ({ page }) => {
    // 直接造一个 read_write key
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const keyValue = 'npk_' + Array.from(randomBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    await prisma.externalApiKey.create({
      data: { userId, name: 'Display Test', key: keyValue, permissions: 'read_write' },
    });

    await page.goto('/settings');
    // 列表里能看到 key 名称
    await expect(page.getByText('Display Test')).toBeVisible();
    // 列表里能看到 read_write scope 标签
    await expect(page.getByTestId('external-keys-list').getByText('read_write').first()).toBeVisible();
  });

  test('TC-SETTINGS-005: 修改已有 key 的 scope（read → read_write）', async ({ page }) => {
    // 先造一个 read key
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const keyValue = 'npk_' + Array.from(randomBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    const created = await prisma.externalApiKey.create({
      data: { userId, name: 'Upgrade Me', key: keyValue, permissions: 'read' },
    });

    // 接受 confirm 对话框（必须在 navigation 之前注册）
    page.on('dialog', (dialog) => dialog.accept());

    await page.goto('/settings');

    // 找到这一行，改 select
    const row = page.getByTestId('external-key-row').filter({ hasText: 'Upgrade Me' });
    const scopeSelect = row.getByTestId('key-scope-select');
    await scopeSelect.selectOption('read_write');

    // 等 DB 更新
    await expect.poll(async () => {
      const k = await prisma.externalApiKey.findUnique({ where: { id: created.id } });
      return k?.permissions;
    }, { timeout: 5000 }).toBe('read_write');
  });
});

test.afterAll(async () => {
  await prisma.$disconnect();
});
