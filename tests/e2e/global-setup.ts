/**
 * Playwright globalSetup
 *
 * 在 webServer 启动前为 e2e 创建/确保测试账号存在。
 * 当前用于解决 posts-platform-config.spec.ts 中 4 个 test 因
 * "testuser/password123" 账号不存在而被 skip 的问题。
 *
 * 幂等：每次 e2e 跑都会跑；如果 testuser 已存在则跳过创建。
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as schema from "../../src/lib/db/schema";

export default async function globalSetup() {
  const dbPath = (process.env.DATABASE_URL ?? "file:./prisma/dev.db").replace("file:", "");
  const client = createClient({ url: `file:${dbPath}` });
  const db = drizzle(client, { schema });

  try {
    // 确保 Twitter 平台存在（register API 会做，但 globalSetup 早于 webServer）
    const existingTwitter = await db
      .select()
      .from(schema.platform)
      .where(eq(schema.platform.name, "Twitter"))
      .limit(1);

    if (existingTwitter.length === 0) {
      await db.insert(schema.platform).values({
        name: "Twitter",
        icon: "/icons/twitter.svg",
      });
    }

    // 确保 testuser 账号存在
    const existingUsers = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.username, "testuser"))
      .limit(1);

    let testuserId: string;
    if (existingUsers.length === 0) {
      const hashed = await bcrypt.hash("password123", 10);
      const inserted = await db
        .insert(schema.user)
        .values({
          username: "testuser",
          password: hashed,
          email: "testuser@example.com",
        })
        .returning({ id: schema.user.id });
      testuserId = inserted[0].id;
      console.log("[e2e globalSetup] Created testuser account");
    } else {
      testuserId = existingUsers[0].id;
      console.log("[e2e globalSetup] testuser already exists, skip");
    }

    // 给 testuser 创建一个 Twitter 账号（用于 posts-platform-config.spec.ts 里的下拉框断言）
    const twitterRows = await db
      .select()
      .from(schema.platform)
      .where(eq(schema.platform.name, "Twitter"))
      .limit(1);
    const twitter = twitterRows[0];

    if (twitter) {
      const existingAccounts = await db
        .select()
        .from(schema.account)
        .where(
          and(
            eq(schema.account.userId, testuserId),
            eq(schema.account.platformId, twitter.id),
          ),
        )
        .limit(1);

      if (existingAccounts.length === 0) {
        await db.insert(schema.account).values({
          userId: testuserId,
          platformId: twitter.id,
          name: "Test Twitter Account",
          handle: "@testuser",
          description: "E2E 测试账号",
        });
        console.log("[e2e globalSetup] Created testuser Twitter account");
      }
    }
  } catch (err) {
    console.error("[e2e globalSetup] Failed:", err);
    throw err;
  } finally {
    client.close();
  }
}