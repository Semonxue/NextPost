import "../_setup-mock-db";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestDb, closeTestDb, getTestDb } from "./db";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";

describe("debug: validateApiKey step by step", () => {
  beforeAll(async () => {
    await setupTestDb();
  });
  afterAll(() => closeTestDb());

  it("只看 validateApiKey 的 select 部分", async () => {
    const db = getTestDb();
    // 1. 建用户
    const u = await db.insert(schema.user).values({ username: "bob", password: "h" }).returning();
    const userId = u[0].id;

    // 2. 手动插入一个 apiKey
    await db.insert(schema.externalApiKey).values({
      userId,
      name: "Manual",
      key: "npk_manual1234567890123456789012345678",
      permissions: "read",
    });

    // 3. 用 drizzle 等价逻辑查
    const raw = await db.select().from(schema.externalApiKey).where(
      eq(schema.externalApiKey.key, "npk_manual1234567890123456789012345678")
    ).get();
    console.log("raw select result:", JSON.stringify(raw));

    // 4. 关键：直接在同一个 db 实例上用 .get() 查询
    const testKey = "npk_manual1234567890123456789012345678";
    const rec = db.select().from(schema.externalApiKey).where(
      eq(schema.externalApiKey.key, testKey)
    ).get();
    console.log("rec (not awaited):", JSON.stringify(rec));
    const recAwaited = await rec;
    console.log("rec (awaited):", JSON.stringify(recAwaited));
    console.log("recAwaited.id:", recAwaited?.id);
    console.log("recAwaited.userId:", recAwaited?.userId);
  });
});