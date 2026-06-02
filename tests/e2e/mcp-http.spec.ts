/**
 * 外部 MCP HTTP 端点 E2E 测试（v0.3）
 *
 * 通过 Playwright request fixture 真实 HTTP 调用 /api/mcp，
 * 覆盖 7 个工具 + Scope 强制 + 认证 + 数据隔离 + DB 落库。
 *
 * 与 tests/e2e/mcp.spec.ts 的关系：
 * - mcp.spec.ts：弱 E2E（只验证 API Key 端点、DB 字段、错误码常量）
 * - mcp-http.spec.ts（本文件）：强 E2E（真实 HTTP 调用 7 个工具）
 *
 * 由 scripts/verify-mcp-e2e.mjs 升级而来，已转成 Playwright 风格。
 */

import { test, expect, request as pwRequest } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE = 'http://localhost:3000';

// 辅助：拼 API Key
function makeKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return 'npk_' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// 辅助：调 MCP 协议
async function callMcp(
  apiKey: string,
  method: string,
  params: Record<string, unknown> = {},
  id = 1,
) {
  const req = await pwRequest.newContext({ baseURL: BASE });
  const body = { jsonrpc: '2.0', id, method, params };
  const res = await req.post('/api/mcp', {
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    data: body,
  });
  const json = await res.json();
  await req.dispose();
  return { status: res.status(), body: json };
}

// 工具调用的便捷包装
async function callTool(
  apiKey: string,
  name: string,
  args: Record<string, unknown> = {},
) {
  const { body } = await callMcp(apiKey, 'tools/call', { name, arguments: args });
  if (body.error) return { error: body.error };
  const text = body.result?.content?.[0]?.text;
  if (!text) return { error: 'no content' };
  return JSON.parse(text);
}

test.describe('外部 MCP HTTP 端点 v0.3 E2E', () => {
  let testUser: { id: string; username: string };
  let testPlatform: { id: string };
  let testAccount: { id: string; name: string };
  let testPost: { id: string; publishToken: string | null };
  let readKey: string;
  let writeKey: string;
  let rwKey: string;

  test.beforeAll(async () => {
    const ts = Date.now();
    testUser = await prisma.user.create({
      data: { username: `mcp_http_${ts}`, password: '$2a$10$test' },
    });
    testPlatform = await prisma.platform.create({
      data: { name: `mcp_http_platform_${ts}` },
    });
    testAccount = await prisma.account.create({
      data: {
        userId: testUser.id,
        platformId: testPlatform.id,
        name: 'HTTP Test Account',
        handle: '@http_test',
      },
    });
    testPost = await prisma.post.create({
      data: {
        userId: testUser.id,
        accountId: testAccount.id,
        content: 'HTTP test post',
        status: 'scheduled',
        scheduledTime: new Date('2026-12-01T10:00:00Z'),
        publishToken: `tok_${ts}_http`,
      },
    });

    readKey = makeKey();
    writeKey = makeKey();
    rwKey = makeKey();
    await prisma.externalApiKey.createMany({
      data: [
        { userId: testUser.id, name: 'read', key: readKey, permissions: 'read' },
        { userId: testUser.id, name: 'write', key: writeKey, permissions: 'write' },
        { userId: testUser.id, name: 'read_write', key: rwKey, permissions: 'read_write' },
      ],
    });
  });

  test.afterAll(async () => {
    // 清理顺序：先删依赖多的，最后删 user
    await prisma.post.deleteMany({ where: { userId: testUser.id } });
    await prisma.account.deleteMany({ where: { userId: testUser.id } });
    await prisma.externalApiKey.deleteMany({ where: { userId: testUser.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
    // Platform 在最后（先确保没残留引用）
    await prisma.platform.deleteMany({ where: { id: testPlatform.id } });
    await prisma.$disconnect();
  });

  // ============================================================
  test.describe('认证', () => {
    test('TC-MCP-HTTP-001: 无 Authorization 头返回 401', async () => {
      const { status, body } = await callMcp('', 'initialize', {}, 1);
      expect(status).toBe(401);
      expect(body.error?.code).toBe(-32602);
    });

    test('TC-MCP-HTTP-002: 非 npk_ 前缀返回 401', async () => {
      const { status, body } = await callMcp('bad-format-key', 'initialize', {}, 1);
      expect(status).toBe(401);
      expect(body.error?.code).toBe(-32602);
    });

    test('TC-MCP-HTTP-003: 不存在的 npk_ key 返回 401', async () => {
      const { status } = await callMcp(
        'npk_' + '0'.repeat(64),
        'initialize', {}, 1,
      );
      expect(status).toBe(401);
    });

    test('TC-MCP-HTTP-004: initialize 返回 serverInfo', async () => {
      const { body } = await callMcp(readKey, 'initialize', {}, 1);
      expect(body.result?.serverInfo?.name).toBe('nextpost-external');
      expect(body.result?.protocolVersion).toBeDefined();
    });

    test('TC-MCP-HTTP-005: tools/list 暴露全部 9 个工具（4 读 + 5 写）', async () => {
      const { body } = await callMcp(readKey, 'tools/list', {}, 1);
      const names: string[] = body.result?.tools?.map((t: { name: string }) => t.name) ?? [];
      expect(names).toEqual(
        expect.arrayContaining([
          'list_accounts',
          'get_pending_posts',
          'get_post_detail',
          'report_publish_result',
          'upload_media_from_url',
          'create_post',
          'update_post',
        ]),
      );
    });
  });

  // ============================================================
  test.describe('读取工具（4 个）', () => {
    test('TC-MCP-HTTP-006: list_accounts 返回脱敏账号（无 handle/description）', async () => {
      const data = await callTool(readKey, 'list_accounts', {});
      expect(data.accounts).toBeInstanceOf(Array);
      const acc = data.accounts.find((a: { id: string }) => a.id === testAccount.id);
      expect(acc).toBeDefined();
      expect(acc.displayName).toBe('HTTP Test Account');
      expect(acc).not.toHaveProperty('handle');
      expect(acc).not.toHaveProperty('description');
    });

    test('TC-MCP-HTTP-007: get_pending_posts 返回完整 URL', async () => {
      // 改 testPost 的 mediaUrls 为相对路径
      await prisma.post.update({
        where: { id: testPost.id },
        data: { mediaUrls: JSON.stringify(['/api/uploads/test.jpg']) },
      });
      const data = await callTool(readKey, 'get_pending_posts', { limit: 50 });
      const post = data.posts?.find((p: { id: string }) => p.id === testPost.id);
      expect(post).toBeDefined();
      expect(post.mediaUrls[0]).toMatch(/^https?:\/\//);
      // 还原
      await prisma.post.update({
        where: { id: testPost.id },
        data: { mediaUrls: '[]' },
      });
    });

    test('TC-MCP-HTTP-008: get_post_detail 返回 publishToken', async () => {
      const data = await callTool(readKey, 'get_post_detail', { postId: testPost.id });
      expect(data.post.id).toBe(testPost.id);
      expect(data.post.publishToken).toBe(testPost.publishToken);
    });

    test('TC-MCP-HTTP-009: 数据隔离 - 用户 A 看不到用户 B 的帖子', async () => {
      // 创建另一个用户和帖子
      const otherUser = await prisma.user.create({
        data: { username: `other_${Date.now()}`, password: '$2a$10$test' },
      });
      const otherAccount = await prisma.account.create({
        data: {
          userId: otherUser.id,
          platformId: testPlatform.id,
          name: 'Other Account',
          handle: '@other',
        },
      });
      const otherPost = await prisma.post.create({
        data: {
          userId: otherUser.id,
          accountId: otherAccount.id,
          content: 'Other user post',
          status: 'scheduled',
          scheduledTime: new Date('2026-12-02T10:00:00Z'),
          publishToken: `tok_other_${Date.now()}`,
        },
      });

      const data = await callTool(readKey, 'get_post_detail', { postId: otherPost.id });
      expect(data.error).toBe('Post not found');

      // 清理
      await prisma.post.delete({ where: { id: otherPost.id } });
      await prisma.account.delete({ where: { id: otherAccount.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    });
  });

  // ============================================================
  test.describe('写工具（3 个，v0.3）', () => {
    test('TC-MCP-HTTP-010: read scope 调 create_post → INSUFFICIENT_SCOPE', async () => {
      const data = await callTool(readKey, 'create_post', {
        accountId: testAccount.id,
        content: 'x',
        scheduledTime: '2027-01-01T10:00:00Z',
      });
      expect(data.errorCode).toBe('INSUFFICIENT_SCOPE');
    });

    test('TC-MCP-HTTP-011: write scope 调 list_accounts → INSUFFICIENT_SCOPE', async () => {
      const data = await callTool(writeKey, 'list_accounts', {});
      expect(data.errorCode).toBe('INSUFFICIENT_SCOPE');
    });

    test('TC-MCP-HTTP-012: read_write scope 调 create_post 成功 + DB 真实落库', async () => {
      const data = await callTool(rwKey, 'create_post', {
        accountId: testAccount.id,
        content: 'Created by E2E test',
        scheduledTime: '2027-01-01T10:00:00Z',
      });
      expect(data.success).toBe(true);
      expect(data.post.id).toBeDefined();
      expect(data.post.publishToken).toMatch(/^tok_/);

      // 验证 DB 真实记录
      const dbPost = await prisma.post.findUnique({ where: { id: data.post.id } });
      expect(dbPost).toBeDefined();
      expect(dbPost?.content).toBe('Created by E2E test');
      expect(dbPost?.status).toBe('scheduled');
      expect(dbPost?.userId).toBe(testUser.id);

      // 清理
      await prisma.post.delete({ where: { id: data.post.id } });
    });

    test('TC-MCP-HTTP-013: create_post 拒绝他人账号', async () => {
      // 创建另一个用户的账号
      const otherUser = await prisma.user.create({
        data: { username: `other_acc_${Date.now()}`, password: '$2a$10$test' },
      });
      const otherAccount = await prisma.account.create({
        data: {
          userId: otherUser.id,
          platformId: testPlatform.id,
          name: 'Other',
          handle: '@other',
        },
      });

      const data = await callTool(rwKey, 'create_post', {
        accountId: otherAccount.id,
        content: 'steal',
        scheduledTime: '2027-01-01T10:00:00Z',
      });
      expect(data.errorCode).toBe('ACCOUNT_NOT_FOUND');

      await prisma.account.delete({ where: { id: otherAccount.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    });

    test('TC-MCP-HTTP-014: create_post 拒绝过去时间', async () => {
      const data = await callTool(rwKey, 'create_post', {
        accountId: testAccount.id,
        content: 'x',
        scheduledTime: '2020-01-01T00:00:00Z',
      });
      expect(data.errorCode).toBe('SCHEDULED_TIME_IN_PAST');
    });

    test('TC-MCP-HTTP-015: update_post 字段白名单 + 状态锁', async () => {
      // 字段白名单（v0.3.2）：白名单内字段（content / mediaUrls / scheduledTime / timezone）可改，
      // 名单外的（accountId / status）静默忽略。
      const data1 = await callTool(rwKey, 'update_post', {
        postId: testPost.id,
        scheduledTime: '2027-02-01T10:00:00Z',
        content: 'HACKED',
        mediaUrls: ['/evil.jpg'],
        accountId: 'other',
        status: 'published',
      } as never);
      expect(data1.success).toBe(true);

      const dbPost = await prisma.post.findUnique({ where: { id: testPost.id } });
      expect(dbPost?.content).toBe('HACKED'); // 白名单内,被改
      expect(dbPost?.mediaUrls).toBe('["/evil.jpg"]'); // 白名单内,被改
      expect(dbPost?.status).toBe('scheduled'); // 名单外,未被改
      expect(dbPost?.accountId).toBe(testAccount.id); // 名单外,未被改
      expect(dbPost?.scheduledTime?.toISOString()).toBe('2027-02-01T10:00:00.000Z'); // 白名单内,被改

      // 2. 状态锁：published 状态拒绝
      await prisma.post.update({
        where: { id: testPost.id },
        data: { status: 'published' },
      });
      const data2 = await callTool(rwKey, 'update_post', {
        postId: testPost.id,
        scheduledTime: '2027-03-01T10:00:00Z',
      });
      expect(data2.errorCode).toBe('INVALID_STATUS');

      // 还原
      await prisma.post.update({
        where: { id: testPost.id },
        data: {
          status: 'scheduled',
          scheduledTime: new Date('2026-12-01T10:00:00Z'),
        },
      });
    });
  });
});
