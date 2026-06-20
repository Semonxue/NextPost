import "../_setup-mock-db";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestDb, closeTestDb, truncateAllTables, getTestDb } from "../_helpers/db";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { validateApiKey } from "@/mcp/external/auth";

describe("debug: expired key flow", () => {
  beforeAll(async () => { await setupTestDb(); });
  afterAll(() => closeTestDb());

  it("expired key check", async () => {
    await truncateAllTables();
    const db = getTestDb();

    const u = await db.insert(schema.user).values({ username: "auth_test_user", password: "hash" }).returning();
    const userId = u[0].id;
    console.log("userId:", userId);

    await db.insert(schema.externalApiKey).values({
      userId,
      name: "Expired Key",
      key: "npk_expiredtestkey000000000000000000",
      permissions: "read",
      expiresAt: "2000-01-01T00:00:00.000Z",
    }).run();

    const rows = await db.select().from(schema.externalApiKey)
      .where(eq(schema.externalApiKey.key, "npk_expiredtestkey000000000000000000"))
      .limit(1);
    console.log("apiKey row:", JSON.stringify(rows[0]));

    const result = await validateApiKey("npk_expiredtestkey000000000000000000");
    console.log("validateApiKey result:", result);
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe("KEY_EXPIRED");
  });
});