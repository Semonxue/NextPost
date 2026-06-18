import "../_setup-mock-db";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestDb, closeTestDb, getTestDb } from "./db";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";

describe("debug: 同一 db 实例？", () => {
  beforeAll(async () => {
    await setupTestDb();
  });
  afterAll(() => closeTestDb());

  it("对比 helper db 和 getDb() 是否同一实例", async () => {
    const helperDb = getTestDb();
    const modDb = await (await import("@/lib/db")).getDb();
    console.log("helperDb === modDb:", helperDb === modDb);
    console.log("helperDb type:", helperDb.constructor.name);
    console.log("modDb type:", modDb.constructor.name);

    // 同一个 db 的两次 select 结果一致吗？
    const userInserted = await helperDb
      .insert(schema.user)
      .values({ username: "x", password: "h" })
      .returning();
    const userId = userInserted[0].id;
    console.log("userId via helper:", userId);

    // 用 helper 查
    const viaHelper = await helperDb
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, userId))
      .get();
    console.log("viaHelper:", JSON.stringify(viaHelper));

    // 用业务代码的 getDb 查
    const viaMod = await modDb
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, userId))
      .get();
    console.log("viaMod:", JSON.stringify(viaMod));
  });
});