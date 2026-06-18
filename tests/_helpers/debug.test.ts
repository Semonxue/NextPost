import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestDb, closeTestDb, getTestDb } from "./db";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";

describe("debug: insert + select", () => {
  beforeAll(async () => {
    await setupTestDb();
  });
  afterAll(() => closeTestDb());

  it("insert user + select back", async () => {
    const db = getTestDb();
    const inserted = await db
      .insert(schema.user)
      .values({ username: "alice", password: "hash" })
      .returning();
    console.log("inserted[0]:", JSON.stringify(inserted[0], null, 2));

    const all = await db.select().from(schema.user).all();
    console.log("all:", JSON.stringify(all, null, 2));

    const found = await db.select().from(schema.user).where(eq(schema.user.id, "nonexistent")).get();
    console.log("found (should be undefined):", found);
  });

  it("insert apiKey + select back", async () => {
    const db = getTestDb();
    const inserted = await db
      .insert(schema.externalApiKey)
      .values({
        userId: "u1",
        name: "Test",
        key: "npk_test123",
        permissions: "read",
      })
      .returning();
    console.log("apiKey inserted[0]:", JSON.stringify(inserted[0], null, 2));

    const found = await db.select().from(schema.externalApiKey).all();
    console.log("apiKey all:", JSON.stringify(found, null, 2));
  });
});