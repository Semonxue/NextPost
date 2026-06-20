import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestDb, closeTestDb, getTestDb } from "./db";
import * as schema from "@/lib/db/schema";
import { validateApiKey, generateApiKey, listApiKeys } from "@/mcp/external/auth";

describe("smoke: test db helper works", () => {
  beforeAll(async () => {
    await setupTestDb();
  });
  afterAll(() => closeTestDb());

  it("通过真实 DB 验证 generateApiKey → validateApiKey → listApiKeys 端到端", async () => {
    // 1. 准备 user
    const db = getTestDb();
    const insertedUser = await db
      .insert(schema.user)
      .values({ username: "alice", password: "hash" })
      .returning();
    const userId = insertedUser[0].id;

    // 2. 调真实 auth.ts 的 generateApiKey
    const genResult = await generateApiKey(userId, "Test Key");
    expect(genResult.success).toBe(true);
    expect(genResult.key).toMatch(/^npk_[a-f0-9]{64}$/);
    expect(genResult.scope).toBe("read");

    // 3. 调真实 validateApiKey
    const validateResult = await validateApiKey(genResult.key!);
    expect(validateResult.valid).toBe(true);
    expect(validateResult.userId).toBe(userId);
    expect(validateResult.scope).toBe("read");

    // 4. 调真实 listApiKeys
    const listResult = await listApiKeys(userId);
    expect(listResult.success).toBe(true);
    expect(listResult.keys).toHaveLength(1);
    expect(listResult.keys![0].name).toBe("Test Key");
  });
});