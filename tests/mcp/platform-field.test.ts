/**
 * MCP 工具 platform 字段返回测试（v0.5.1）
 *
 * 验证 getPendingPosts / getPostDetail / listAccounts 返回结构包含 platform 字段
 * 使用真实 SQLite DB + 真实 tools.ts 代码
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { setupTestDb, closeTestDb, truncateAllTables, getTestDb } from "../_helpers/db";
import * as schema from "@/lib/db/schema";
import { executeTool } from "@/mcp/external/tools";

let testUserId: string;
let testPlatformId: string;
let testAccountId: string;
let testPostId: string;

beforeAll(async () => {
  await setupTestDb();
});

afterAll(() => closeTestDb());

beforeEach(async () => {
  await truncateAllTables();
  const db = getTestDb();

  // 建用户
  const user = await db.insert(schema.user).values({ username: `mcp_platform_${Date.now()}`, password: "hash" }).returning();
  testUserId = user[0].id;

  // 建平台
  const platform = await db.insert(schema.platform).values({ name: "Twitter", icon: "/icons/twitter.svg" }).returning();
  testPlatformId = platform[0].id;

  // 建账号
  const account = await db.insert(schema.account).values({
    userId: testUserId,
    platformId: testPlatformId,
    name: "MCP Platform Test",
    handle: "@mcptest",
  }).returning();
  testAccountId = account[0].id;

  // 建帖子（scheduled 状态，发布时间在 ±30 天窗口内）
  const futureTime = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const post = await db.insert(schema.post).values({
    userId: testUserId,
    accountId: testAccountId,
    content: "#test hashtag content",
    title: "Test Title",
    mediaUrls: "[]",
    mediaThumbnails: "[]",
    status: "scheduled",
    scheduledTime: futureTime,
    publishToken: "tok_test",
  }).returning();
  testPostId = post[0].id;
});

describe("MCP platform 字段（v0.5.1）", () => {
  it("list_accounts 返回含 platform + platformId 字段", async () => {
    const result = await executeTool("list_accounts", {}, { userId: testUserId, scope: "read" });
    const data = JSON.parse(result.content[0].text);
    expect(data.accounts).toBeInstanceOf(Array);
    const acc = data.accounts.find((a: { id: string }) => a.id === testAccountId);
    expect(acc).toBeDefined();
    expect(acc.platform).toBe("Twitter");
    expect(acc.platformId).toBe(testPlatformId);
  });

  it("get_pending_posts 返回 Post 含 platform + title + extractedTopics 字段", async () => {
    const result = await executeTool("get_pending_posts", { windowMinutes: 43200 }, { userId: testUserId, scope: "read" });
    const data = JSON.parse(result.content[0].text);
    const post = data.posts.find((p: { id: string }) => p.id === testPostId);
    expect(post).toBeDefined();
    expect(post.platform).toBe("Twitter");
    expect(post.title).toBe("Test Title");
    expect(post.extractedTopics).toEqual(["test"]);
  });

  it("get_post_detail 返回 Post 含 platform + title + extractedTopics 字段", async () => {
    const result = await executeTool("get_post_detail", { postId: testPostId }, { userId: testUserId, scope: "read" });
    const data = JSON.parse(result.content[0].text);
    expect(data.post).toBeDefined();
    expect(data.post.platform).toBe("Twitter");
    expect(data.post.title).toBe("Test Title");
    expect(data.post.extractedTopics).toEqual(["test"]);
  });

  it("create_post 返回 post 含 platform + title 字段", async () => {
    const future = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
    const result = await executeTool(
      "create_post",
      {
        accountId: testAccountId,
        content: "create_post test",
        title: "New Title",
        scheduledTime: future,
      },
      { userId: testUserId, scope: "write" },
    );
    const data = JSON.parse(result.content[0].text);
    expect(data.post).toBeDefined();
    expect(data.post.platform).toBe("Twitter");
    expect(data.post.title).toBe("New Title");
  });
});