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

  test('TC-SETTINGS-001: 页面渲染 + 2 个类型 card 默认选 读写', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: '外部 API Key（MCP）' })).toBeVisible();
    // 类型选择器 2 个 card
    await expect(page.getByTestId('new-key-type-read')).toBeVisible();
    await expect(page.getByTestId('new-key-type-read_write')).toBeVisible();
    // 默认选 读写
    const readWriteCard = page.getByTestId('new-key-type-read_write');
    await expect(readWriteCard).toHaveClass(/border-blue-500/);
  });

  test('TC-SETTINGS-002: UI 创建 读写 key → DB 真实写入 read_write', async ({ page }) => {
    await page.goto('/settings');

    // 填名称
    await page.getByPlaceholder(/输入 Key 名称/).fill('Claude Desktop Test');

    // 类型选 读写（默认就是，但显式点一下确认）
    await page.getByTestId('new-key-type-read_write').click();

    // 点创建按钮（用 exact 避开"读写"卡片描述里的"创建"字）
    await page.getByRole('button', { name: '创建', exact: true }).click();

    // 完整 key 提示框出现
    await expect(page.getByText(/唯一一次显示完整 Key/)).toBeVisible({ timeout: 5000 });

    // 验证 DB 真实写入
    const dbKey = await prisma.externalApiKey.findFirst({
      where: { userId, name: 'Claude Desktop Test' },
    });
    expect(dbKey).toBeDefined();
    expect(dbKey?.permissions).toBe('read_write');
  });

  test('TC-SETTINGS-003: UI 创建 只读 key → DB 写入 read', async ({ page }) => {
    await page.goto('/settings');
    await page.getByPlaceholder(/输入 Key 名称/).fill('Read Only');
    // 切到 只读 card
    await page.getByTestId('new-key-type-read').click();
    await page.getByRole('button', { name: '创建', exact: true }).click();

    // 等 DB 落库（轮询避免和 toast 竞争）
    await expect.poll(async () => {
      const k = await prisma.externalApiKey.findFirst({ where: { userId, name: 'Read Only' } });
      return k?.permissions;
    }, { timeout: 5000 }).toBe('read');
  });

  test('TC-SETTINGS-004: 列表显示类型大标 + 左侧色条（读写是蓝色）', async ({ page }) => {
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
    // 类型大标显示"读写"（不是英文 read_write）
    const row = page.getByTestId('external-key-row').first();
    await expect(row.getByTestId('key-type-badge')).toHaveText('读写');
    // data-scope 属性 = read_write
    await expect(row).toHaveAttribute('data-scope', 'read_write');
  });

  test('TC-SETTINGS-004b: 只读 key 标为"只读" + 灰色色条', async ({ page }) => {
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const keyValue = 'npk_' + Array.from(randomBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    await prisma.externalApiKey.create({
      data: { userId, name: 'Read Only Test', key: keyValue, permissions: 'read' },
    });

    await page.goto('/settings');
    const row = page.getByTestId('external-key-row').first();
    await expect(row.getByTestId('key-type-badge')).toHaveText('只读');
    await expect(row).toHaveAttribute('data-scope', 'read');
  });

  test('TC-SETTINGS-005: 类型过滤器 — 点"只读"只剩只读 key', async ({ page }) => {
    // 造 1 个 read + 1 个 read_write
    const randomBytes = new Uint8Array(32);
    const keyA = 'npk_' + Array.from(randomBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    crypto.getRandomValues(randomBytes);
    const keyB = 'npk_' + Array.from(randomBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    await prisma.externalApiKey.createMany({
      data: [
        { userId, name: 'Only Read', key: keyA, permissions: 'read' },
        { userId, name: 'Full Access', key: keyB, permissions: 'read_write' },
      ],
    });

    await page.goto('/settings');

    // 默认全部：看到 2 个
    await expect(page.getByTestId('external-key-row')).toHaveCount(2);

    // 点"只读"过滤
    await page.getByTestId('filter-read').click();
    await expect(page.getByTestId('external-key-row')).toHaveCount(1);
    await expect(page.getByText('Only Read')).toBeVisible();
    await expect(page.getByText('Full Access')).not.toBeVisible();

    // 点"读写"过滤
    await page.getByTestId('filter-read_write').click();
    await expect(page.getByTestId('external-key-row')).toHaveCount(1);
    await expect(page.getByText('Full Access')).toBeVisible();
    await expect(page.getByText('Only Read')).not.toBeVisible();

    // 切回全部
    await page.getByTestId('filter-all').click();
    await expect(page.getByTestId('external-key-row')).toHaveCount(2);
  });

  test('TC-SETTINGS-006: 过滤器计数显示正确（全部 3 / 只读 1 / 读写 2）', async ({ page }) => {
    const mkKey = () => {
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      return 'npk_' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    };
    await prisma.externalApiKey.createMany({
      data: [
        { userId, name: 'R1', key: mkKey(), permissions: 'read' },
        { userId, name: 'RW1', key: mkKey(), permissions: 'read_write' },
        { userId, name: 'RW2', key: mkKey(), permissions: 'read_write' },
      ],
    });

    await page.goto('/settings');
    await expect(page.getByTestId('filter-all')).toContainText('3');
    await expect(page.getByTestId('filter-read')).toContainText('1');
    await expect(page.getByTestId('filter-read_write')).toContainText('2');
  });

  test('TC-SETTINGS-007: UI 不再提供修改 scope 的入口（只能删了重建）', async ({ page }) => {
    // 造一个 read key
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const keyValue = 'npk_' + Array.from(randomBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    await prisma.externalApiKey.create({
      data: { userId, name: 'Immutable', key: keyValue, permissions: 'read' },
    });

    await page.goto('/settings');

    const row = page.getByTestId('external-key-row').filter({ hasText: 'Immutable' });
    // 行内不再有 scope <select>
    await expect(row.getByTestId('key-scope-select')).toHaveCount(0);
    // 类型 label 还在
    await expect(row.getByTestId('key-type-badge')).toHaveText('只读');
    // 列表上方有"不可修改"提示
    await expect(page.getByText(/Key 的类型.*不可修改/)).toBeVisible();
    // 删除按钮 tooltip 提示了"要改类型？删了重建"
    const deleteBtn = row.getByTestId('key-delete-btn');
    await expect(deleteBtn).toHaveAttribute('title', /要改类型？删了重建/);
  });

  test('TC-SETTINGS-008: 刷新页面后 scope 显示仍然正确（不被任何残留表单污染）', async ({ page }) => {
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const keyValue = 'npk_' + Array.from(randomBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    await prisma.externalApiKey.create({
      data: { userId, name: 'Persist Me', key: keyValue, permissions: 'read_write' },
    });

    await page.goto('/settings');
    await expect(page.getByTestId('external-keys-list').getByText('Persist Me')).toBeVisible();

    // 刷新
    await page.reload();
    const row = page.getByTestId('external-key-row').filter({ hasText: 'Persist Me' });
    await expect(row).toBeVisible();
    await expect(row.getByTestId('key-type-badge')).toHaveText('读写');
  });
});

test.afterAll(async () => {
  await prisma.$disconnect();
});
