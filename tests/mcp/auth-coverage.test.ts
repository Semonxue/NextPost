/**
 * MCP External Auth 补充测试
 * 专门覆盖 generateApiKey、deleteApiKey、listApiKeys、validateApiKey
 *
 * 关键原则：真实代码 + 真实 libsql SQLite 数据库，不 mock 业务逻辑。
 * parseScope / hasScope 是纯函数，直接测。
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { setupTestDb, closeTestDb, truncateAllTables, getTestDb } from "../_helpers/db";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { parseScope, hasScope, validateApiKey, generateApiKey, deleteApiKey, listApiKeys } from "@/mcp/external/auth";

// ===== 纯函数测试（无 DB） =====

describe("parseScope", () => {
  it("read → read", () => {
    expect(parseScope("read")).toBe("read");
  });

  it("read_report（历史值）→ read 兼容", () => {
    expect(parseScope("read_report")).toBe("read");
  });

  it("write → write", () => {
    expect(parseScope("write")).toBe("write");
  });

  it("read_write → read_write", () => {
    expect(parseScope("read_write")).toBe("read_write");
  });

  it("null / undefined / 空串 / 未知值 → read（安全默认）", () => {
    expect(parseScope(null)).toBe("read");
    expect(parseScope(undefined)).toBe("read");
    expect(parseScope("")).toBe("read");
    expect(parseScope("garbage")).toBe("read");
  });
});

describe("hasScope", () => {
  it("read 工具：read 满足，write 不满足，read_write 满足", () => {
    expect(hasScope("read", "read")).toBe(true);
    expect(hasScope("write", "read")).toBe(false);
    expect(hasScope("read_write", "read")).toBe(true);
  });

  it("write 工具：read 不满足，write 满足，read_write 满足", () => {
    expect(hasScope("read", "write")).toBe(false);
    expect(hasScope("write", "write")).toBe(true);
    expect(hasScope("read_write", "write")).toBe(true);
  });
});

// ===== DB 测试 =====

describe("validateApiKey", () => {
  let userId: string;

  beforeAll(async () => {
    await setupTestDb();
    const db = getTestDb();
    const inserted = await db.insert(schema.user).values({ username: "auth_test_user", password: "hash" }).returning();
    userId = inserted[0].id;
  });
  afterAll(() => closeTestDb());
  beforeEach(async () => {
    await truncateAllTables();
    const db = getTestDb();
    const inserted = await db.insert(schema.user).values({ username: "auth_test_user", password: "hash" }).returning();
    userId = inserted[0].id;
  });

  it("空 key → MISSING_KEY", async () => {
    const result = await validateApiKey("");
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe("MISSING_KEY");
  });

  it("不带 npk_ 前缀 → INVALID_KEY_FORMAT", async () => {
    const result = await validateApiKey("xxx");
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe("INVALID_KEY_FORMAT");
  });

  it("不存在的 key → INVALID_KEY", async () => {
    const result = await validateApiKey("npk_nonexistent123456789012345678901234");
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe("INVALID_KEY");
  });

  it("已过期的 key → KEY_EXPIRED", async () => {
    const db = getTestDb();
    // 直接用 UTC 时间字符串，避免本地时区解析歧义
    await db.insert(schema.externalApiKey).values({
      userId,
      name: "Expired Key",
      key: "npk_expiredtestkey000000000000000000",
      permissions: "read",
      expiresAt: "2000-01-01T00:00:00.000Z",
    }).run();
    const result = await validateApiKey("npk_expiredtestkey000000000000000000");
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe("KEY_EXPIRED");
  });

  it("合法 key → valid=true，userId/scope 正确", async () => {
    const db = getTestDb();
    await db.insert(schema.externalApiKey).values({
      userId,
      name: "Valid Key",
      key: "npk_validtestkey00000000000000000000",
      permissions: "read_write",
    }).run();
    const result = await validateApiKey("npk_validtestkey00000000000000000000");
    expect(result.valid).toBe(true);
    expect(result.userId).toBe(userId);
    expect(result.scope).toBe("read_write");
  });

  it("【v0.4】read_report key 自动迁移到 read，DB 里也改了", async () => {
    const db = getTestDb();
    await db.insert(schema.externalApiKey).values({
      userId,
      name: "Legacy Key",
      key: "npk_legacykey0000000000000000000000",
      permissions: "read_report",
    }).run();
    const result = await validateApiKey("npk_legacykey0000000000000000000000");
    expect(result.valid).toBe(true);
    expect(result.scope).toBe("read");
    // DB 里也该变成 read 了
    const rows = await db.select().from(schema.externalApiKey)
      .where(eq(schema.externalApiKey.key, "npk_legacykey0000000000000000000000"))
      .limit(1);
    expect(rows[0]?.permissions).toBe("read");
  });

  it("不存在的 key → INVALID_KEY", async () => {
    const result = await validateApiKey("npk_errorcase0000000000000000000000");
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe("INVALID_KEY");
  });
});

describe("generateApiKey", () => {
  let userId: string;

  beforeAll(async () => {
    await setupTestDb();
    const db = getTestDb();
    const inserted = await db.insert(schema.user).values({ username: "gen_user", password: "h" }).returning();
    userId = inserted[0].id;
  });
  afterAll(() => closeTestDb());
  beforeEach(async () => {
    await truncateAllTables();
    const db = getTestDb();
    const inserted = await db.insert(schema.user).values({ username: "gen_user", password: "h" }).returning();
    userId = inserted[0].id;
  });

  it("生成 key 带 npk_ 前缀 + 64位十六进制", async () => {
    const result = await generateApiKey(userId, "Test Key");
    expect(result.success).toBe(true);
    expect(result.key).toMatch(/^npk_[a-f0-9]{64}$/);
  });

  it("默认 scope 为 read", async () => {
    const result = await generateApiKey(userId, "Default Scope");
    expect(result.success).toBe(true);
    expect(result.scope).toBe("read");
    // DB 里确实是 read
    const db = getTestDb();
    const rows = await db.select().from(schema.externalApiKey)
      .where(eq(schema.externalApiKey.userId, userId))
      .all();
    expect(rows[0]?.permissions).toBe("read");
  });

  it("scope=read_write 透传", async () => {
    const result = await generateApiKey(userId, "RW Key", undefined, "read_write");
    expect(result.success).toBe(true);
    expect(result.scope).toBe("read_write");
  });

  it("scope=write 透传", async () => {
    const result = await generateApiKey(userId, "W Key", undefined, "write");
    expect(result.success).toBe(true);
    expect(result.scope).toBe("write");
  });

  it("scope=read_report 历史值归一为 read", async () => {
    const result = await generateApiKey(userId, "Legacy", undefined, "read_report");
    expect(result.success).toBe(true);
    expect(result.scope).toBe("read");
  });

  it("非法 scope 降级为 read（不抛错）", async () => {
    const result = await generateApiKey(userId, "Bad Scope", undefined, "totally-bogus");
    expect(result.success).toBe(true);
    expect(result.scope).toBe("read");
  });

  it("带 expiresAt 写入 DB", async () => {
    const expDate = new Date("2030-01-01");
    const result = await generateApiKey(userId, "With Expiry", expDate);
    expect(result.success).toBe(true);
    const db = getTestDb();
    const rows = await db.select().from(schema.externalApiKey)
      .where(eq(schema.externalApiKey.key, result.key!))
      .limit(1);
    expect(rows[0]?.expiresAt).toBe(expDate.toISOString());
  });
});

describe("deleteApiKey", () => {
  let userId: string;

  beforeAll(async () => {
    await setupTestDb();
    const db = getTestDb();
    const inserted = await db.insert(schema.user).values({ username: "del_user", password: "h" }).returning();
    userId = inserted[0].id;
  });
  afterAll(() => closeTestDb());
  beforeEach(async () => {
    await truncateAllTables();
    const db = getTestDb();
    const inserted = await db.insert(schema.user).values({ username: "del_user", password: "h" }).returning();
    userId = inserted[0].id;
  });

  it("key 属于该用户 → 删除成功", async () => {
    const db = getTestDb();
    await db.insert(schema.externalApiKey).values({
      userId,
      name: "To Delete",
      key: "npk_todelete000000000000000000000000",
    }).run();
    const rows = await db.select().from(schema.externalApiKey)
      .where(eq(schema.externalApiKey.key, "npk_todelete000000000000000000000000"))
      .limit(1);
    const keyId = rows[0].id;

    const result = await deleteApiKey(userId, keyId);
    expect(result.success).toBe(true);

    // DB 里确实删了
    const remaining = await db.select().from(schema.externalApiKey)
      .where(eq(schema.externalApiKey.id, keyId))
      .limit(1);
    expect(remaining[0]).toBeUndefined();
  });

  it("key 不属于该用户 → 删除失败", async () => {
    const db = getTestDb();
    // 创建另一个用户
    const otherUser = await db.insert(schema.user).values({ username: "other", password: "h" }).returning();
    const otherId = otherUser[0].id;
    // other 用户的 key
    await db.insert(schema.externalApiKey).values({
      userId: otherId,
      name: "Other Key",
      key: "npk_otherkey000000000000000000000000",
    }).run();
    const rows = await db.select().from(schema.externalApiKey)
      .where(eq(schema.externalApiKey.key, "npk_otherkey000000000000000000000000"))
      .limit(1);
    const otherKeyId = rows[0].id;

    // 当前用户尝试删除
    const result = await deleteApiKey(userId, otherKeyId);
    expect(result.success).toBe(false);

    // DB 里仍然存在
    const remaining = await db.select().from(schema.externalApiKey)
      .where(eq(schema.externalApiKey.id, otherKeyId))
      .limit(1);
    expect(remaining[0]).toBeDefined();
  });
});

describe("listApiKeys", () => {
  let userId: string;

  beforeAll(async () => {
    await setupTestDb();
    const db = getTestDb();
    const inserted = await db.insert(schema.user).values({ username: "list_user", password: "h" }).returning();
    userId = inserted[0].id;
  });
  afterAll(() => closeTestDb());
  beforeEach(async () => {
    await truncateAllTables();
    const db = getTestDb();
    const inserted = await db.insert(schema.user).values({ username: "list_user", password: "h" }).returning();
    userId = inserted[0].id;
  });

  it("返回 key 预览（前12字符 + ...）", async () => {
    const db = getTestDb();
    await db.insert(schema.externalApiKey).values({
      userId,
      name: "Preview Test",
      key: "npk_abcdefghijklmnop",
      permissions: "read",
    }).run();
    const result = await listApiKeys(userId);
    expect(result.success).toBe(true);
    expect(result.keys![0].keyPreview).toBe("npk_abcdefgh...");
  });

  it("无 key 时返回空数组", async () => {
    const result = await listApiKeys(userId);
    expect(result.success).toBe(true);
    expect(result.keys).toHaveLength(0);
  });

  it("lastUsedAt 为 null 时输出 null（不抛错）", async () => {
    const db = getTestDb();
    await db.insert(schema.externalApiKey).values({
      userId,
      name: "Never Used",
      key: "npk_neverused0000000000000000000000",
      permissions: "read",
    }).run();
    const result = await listApiKeys(userId);
    expect(result.success).toBe(true);
    expect(result.keys![0].lastUsedAt).toBeNull();
  });

  it("read_report 历史 key 在 list 前被迁移到 read", async () => {
    const db = getTestDb();
    await db.insert(schema.externalApiKey).values({
      userId,
      name: "Old Scope",
      key: "npk_oldscope00000000000000000000000",
      permissions: "read_report",
    }).run();
    const result = await listApiKeys(userId);
    expect(result.success).toBe(true);
    // listApiKeys 在返回前会迁移 read_report → read
    expect(result.keys![0].permissions).toBe("read");
  });
});