import "../_setup-mock-db";
import { describe, it, expect } from "vitest";

describe("debug: mock 状态", () => {
  it("看 mock 的 @/lib/db 实际导出", async () => {
    const mod = await import("@/lib/db");
    console.log("mod.getDb type:", typeof mod.getDb);
    console.log("mod keys:", Object.keys(mod));
    console.log("mod.getDb === vi.fn():", (mod.getDb as any).mock !== undefined);

    // 调用看返回什么
    const db = await mod.getDb();
    console.log("db type:", typeof db);
    console.log("db keys:", Object.keys(db).slice(0, 10));
    console.log("db.select type:", typeof (db as any).select);
  });
});