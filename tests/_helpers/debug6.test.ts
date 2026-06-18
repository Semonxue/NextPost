import "../_setup-mock-db";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestDb, closeTestDb, getTestDb } from "../_helpers/db";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";

describe("debug: expiresAt", () => {
  beforeAll(async () => { await setupTestDb(); });
  afterAll(() => closeTestDb());

  it("expiresAt 查询", async () => {
    const db = getTestDb();
    await db.insert(schema.externalApiKey).values({
      userId: "u1",
      name: "Test",
      key: "npk_expiredtestkey000000000000000000",
      permissions: "read",
      expiresAt: "2000-01-01T00:00:00.000Z",
    }).run();

    const rows = await db.select().from(schema.externalApiKey)
      .where(eq(schema.externalApiKey.key, "npk_expiredtestkey000000000000000000"))
      .limit(1);
    console.log("row:", JSON.stringify(rows[0]));
    console.log("expiresAt:", rows[0]?.expiresAt);
    console.log("typeof expiresAt:", typeof rows[0]?.expiresAt);
    console.log("new Date() > new Date(expiresAt):", new Date() > new Date(rows[0]?.expiresAt));
  });
});