import "../_setup-mock-db";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestDb, closeTestDb, getTestDb } from "./db";
import * as schema from "@/lib/db/schema";
import { generateApiKey, validateApiKey } from "@/mcp/external/auth";
import { eq } from "drizzle-orm";

describe("debug: auth flow", () => {
  beforeAll(async () => {
    await setupTestDb();
  });
  afterAll(() => closeTestDb());

  it("generate + validate roundtrip", async () => {
    const db = getTestDb();
    const userInserted = await db
      .insert(schema.user)
      .values({ username: "u1", password: "h" })
      .returning();
    const userId = userInserted[0].id;
    console.log("userId:", userId);

    const gen = await generateApiKey(userId, "Test");
    console.log("generated key:", gen.key);

    const allKeys = await db.select().from(schema.externalApiKey).all();
    console.log("all keys after generate:", JSON.stringify(allKeys, null, 2));

    if (gen.key) {
      const found = await db
        .select()
        .from(schema.externalApiKey)
        .where(eq(schema.externalApiKey.key, gen.key))
        .get();
      console.log("found by key:", JSON.stringify(found, null, 2));
    }

    const result = await validateApiKey(gen.key!);
    console.log("validate result:", result);
  });
});