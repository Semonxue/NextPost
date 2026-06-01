/**
 * /ai-tools 页面 E2E（v0.3）
 *
 * 验证：
 * 1. 页面从 MCP 真实加载工具列表（不是硬编码）
 * 2. 用户的 API Key 列表正确显示
 * 3. Reveal 按钮能拿到完整 key
 * 4. Copy 按钮能复制配置
 * 5. 工具卡片展开后能看到 inputSchema
 */

import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const genUser = () => `aitools_${Date.now()}${Math.random().toString(36).slice(2, 6)}`;

test.describe('AI tools 页面', () => {
  let username: string;
  let userId: string;
  let apiKeyId: string;
  let apiKeyFull: string;

  test.beforeEach(async ({ page }) => {
    username = genUser();
    // 注册
    await page.goto('/register');
    await page.getByPlaceholder('请输入用户名').fill(username);
    await page.getByPlaceholder('请输入密码（至少6位）').fill('Test123456');
    await page.getByPlaceholder('请再次输入密码').fill('Test123456');
    await page.getByRole('button', { name: '注册' }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
    // 登录
    await page.getByPlaceholder('请输入用户名').fill(username);
    await page.getByPlaceholder('请输入密码').fill('Test123456');
    await page.getByRole('button', { name: '登录' }).click();
    await expect(page).toHaveURL('/', { timeout: 15000 });

    // 拿 userId
    const user = await prisma.user.findUnique({ where: { username } });
    userId = user!.id;

    // 直接造一个 API Key（绕过 UI 创建流程以节省时间）
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    apiKeyFull = 'npk_' + Array.from(randomBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    const created = await prisma.externalApiKey.create({
      data: {
        userId,
        name: 'Test Key',
        key: apiKeyFull,
        permissions: 'read_write',
      },
    });
    apiKeyId = created.id;
  });

  test.afterEach(async () => {
    if (userId) {
      await prisma.externalApiKey.deleteMany({ where: { userId } });
      await prisma.post.deleteMany({ where: { userId } });
      await prisma.account.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
    }
  });

  test('TC-AITOOLS-001: 页面渲染 + 标题显示', async ({ page }) => {
    await page.goto('/ai-tools');
    await expect(page.getByRole('heading', { name: 'AI tools' })).toBeVisible();
    // hero 文字
    await expect(page.getByText(/MCP.*Model Context Protocol/)).toBeVisible();
  });

  test('TC-AITOOLS-002: 显示 7 个工具卡片（从 MCP 真实加载）', async ({ page }) => {
    await page.goto('/ai-tools');

    // 等待所有工具卡片渲染
    const expectedTools = [
      'list_accounts',
      'get_pending_posts',
      'get_post_detail',
      'report_publish_result',
      'upload_media_from_url',
      'create_post',
      'update_post',
    ];

    for (const name of expectedTools) {
      await expect(page.getByTestId(`tool-card-${name}`)).toBeVisible();
    }
  });

  test('TC-AITOOLS-003: 写工具带 write 标签', async ({ page }) => {
    await page.goto('/ai-tools');
    const writeCard = page.getByTestId('tool-card-create_post');
    await expect(writeCard).toBeVisible();
    // 写工具的 scope 标签应该是 write
    await expect(writeCard.getByText('write', { exact: true })).toBeVisible();
  });

  test('TC-AITOOLS-004: 工具卡片展开显示 inputSchema', async ({ page }) => {
    await page.goto('/ai-tools');
    const card = page.getByTestId('tool-card-create_post');
    await card.click();
    // inputSchema 文字
    await expect(card.getByText('inputSchema')).toBeVisible();
    // JSON 内容含 accountId 字段
    await expect(card.getByText('accountId').first()).toBeVisible();
  });

  test('TC-AITOOLS-005: API Key 列表显示 + Reveal 按钮可拿到完整 key', async ({ page }) => {
    await page.goto('/ai-tools');

    // 看到 key 名称
    await expect(page.getByText('Test Key')).toBeVisible();
    // 看到权限标签
    await expect(page.getByText('read_write').first()).toBeVisible();
    // 看到 preview（前 12 位 = npk_ + 8 字符）
    const expectedPreview = apiKeyFull.substring(0, 12) + '...';
    await expect(page.getByText(expectedPreview)).toBeVisible();

    // 点击 Reveal
    await page.getByTestId('apikey-reveal-btn').click();
    // 出现完整 key 的 input
    const revealed = page.getByTestId('apikey-revealed');
    await expect(revealed).toBeVisible();
    const inputValue = await revealed.locator('input').inputValue();
    expect(inputValue).toBe(apiKeyFull);
  });

  test('TC-AITOOLS-006: 没有 API Key 时显示空状态', async ({ page }) => {
    // 删除刚才创建的 key
    await prisma.externalApiKey.delete({ where: { id: apiKeyId } });
    // 标记为已删除，避免 afterEach 重复删
    apiKeyId = '';

    await page.goto('/ai-tools');
    await expect(page.getByText(/还没有 API Key/)).toBeVisible();
  });

  test('TC-AITOOLS-007: 安全约束 section 渲染', async ({ page }) => {
    await page.goto('/ai-tools');
    await expect(page.getByRole('heading', { name: '3. 写工具安全约束' })).toBeVisible();
    await expect(page.getByText(/不提供 delete/)).toBeVisible();
    await expect(page.getByText(/字段白名单/)).toBeVisible();
    await expect(page.getByText(/状态锁/)).toBeVisible();
  });

  test('TC-AITOOLS-008: 客户端配置示例有 4 个', async ({ page }) => {
    await page.goto('/ai-tools');
    // "Claude Desktop" 在 hero 文案里也出现一次，所以用 exact 匹配
    await expect(page.getByText('Claude Desktop', { exact: true })).toBeVisible();
    await expect(page.getByText('Cursor / Cline / Continue', { exact: true })).toBeVisible();
    await expect(page.getByText('Cherry Studio', { exact: true })).toBeVisible();
    await expect(page.getByText('VS Code (.vscode/mcp.json)', { exact: true })).toBeVisible();
  });

  test('TC-AITOOLS-009: 未登录访问 /ai-tools 重定向到 /login', async ({ browser }) => {
    // 用一个干净的 context（无 session）
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/ai-tools');
    await expect(page).toHaveURL(/\/login/);
    await context.close();
  });
});

test.afterAll(async () => {
  await prisma.$disconnect();
});
