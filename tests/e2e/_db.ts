/**
 * E2E 测试用的 PrismaClient shim
 *
 * 背景：
 * - v0.6.0 起，业务代码用 Drizzle ORM
 * - 但 e2e 测试里直接操作 DB 的代码用了 `new PrismaClient()` + Prisma API
 * - 为避免逐个改 ~1400 行测试代码，写这个 shim：
 *   - 实现 PrismaClient 表面 API（user.create / findUnique / deleteMany 等）
 *   - 底层用 Drizzle + libsql
 *   - 共享 `data/nextpost.db`
 *
 * 注意：仅覆盖 e2e 测试**实际用到**的 API 集合（见 grep 结果）。
 * 完整 Prisma 兼容不是目标。
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq, and, inArray, type SQL } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import * as schema from "@/lib/db/schema";

const client = createClient({
  url: (process.env.DATABASE_URL ?? "file:./data/nextpost.db").startsWith("file:")
    ? (process.env.DATABASE_URL ?? "file:./data/nextpost.db")
    : `file:${process.env.DATABASE_URL ?? "./data/nextpost.db"}`,
});
const db = drizzle(client, { schema });

type AnyTable = any;

/** 解析 where 子句为 SQL 条件 */
function buildWhere(table: AnyTable, where?: Record<string, any>): SQL | undefined {
  if (!where) return undefined;
  const conds: SQL[] = [];
  for (const [col, val] of Object.entries(where)) {
    if (val === undefined) continue;
    if (val !== null && typeof val === "object" && "in" in val) {
      conds.push(inArray(table[col], val.in));
    } else {
      conds.push(eq(table[col], val));
    }
  }
  return conds.length > 0 ? and(...conds) : undefined;
}

/** 过滤 select 字段 */
function project<T extends Record<string, any>>(row: T, select?: Record<string, 1 | true>): Partial<T> {
  if (!select) return row;
  const out: Partial<T> = {};
  for (const k of Object.keys(select)) {
    if (k in row) (out as any)[k] = row[k];
  }
  return out;
}

class TableShim {
  constructor(private table: AnyTable) {}

  async create({ data }: { data: Record<string, any> }): Promise<any> {
    const id = data.id ?? randomUUID();
    const now = new Date().toISOString();
    const insertData: Record<string, any> = { id, ...data };
    // 自动填充 createdAt / updatedAt 如果 schema 定义了
    if ("createdAt" in this.table && !insertData.createdAt) insertData.createdAt = now;
    if ("updatedAt" in this.table && !insertData.updatedAt) insertData.updatedAt = now;
    await db.insert(this.table).values(insertData).execute();
    return insertData;
  }

  async createMany({ data }: { data: Record<string, any>[] }): Promise<{ count: number }> {
    for (const d of data) {
      await this.create({ data: d });
    }
    return { count: data.length };
  }

  async upsert({
    where,
    update = {},
    create,
  }: {
    where: Record<string, any>;
    update?: Record<string, any>;
    create: Record<string, any>;
  }): Promise<any> {
    const w = buildWhere(this.table, where);
    const existing = await db.select().from(this.table).where(w).get();
    if (existing) {
      if (Object.keys(update).length > 0) {
        await db.update(this.table).set(update).where(w).execute();
        return { ...existing, ...update };
      }
      return existing;
    }
    return this.create({ data: create });
  }

  async findUnique({
    where,
    select,
  }: {
    where: Record<string, any>;
    select?: Record<string, 1 | true>;
  }): Promise<any> {
    const w = buildWhere(this.table, where);
    const row = await db.select().from(this.table).where(w).get();
    return row ? project(row, select) : null;
  }

  async findFirst({
    where,
    select,
  }: {
    where?: Record<string, any>;
    select?: Record<string, 1 | true>;
  }): Promise<any> {
    const w = buildWhere(this.table, where);
    const row = await db.select().from(this.table).where(w).get();
    return row ? project(row, select) : null;
  }

  async findMany({
    where,
    select,
  }: {
    where?: Record<string, any>;
    select?: Record<string, 1 | true>;
  }): Promise<any[]> {
    const w = buildWhere(this.table, where);
    const rows = await db.select().from(this.table).where(w).all();
    return select ? rows.map((r: any) => project(r, select)) : rows;
  }

  async update({
    where,
    data,
  }: {
    where: Record<string, any>;
    data: Record<string, any>;
  }): Promise<any> {
    const w = buildWhere(this.table, where);
    if ("updatedAt" in this.table) data.updatedAt = new Date().toISOString();
    await db.update(this.table).set(data).where(w).execute();
    const updated = await db.select().from(this.table).where(w).get();
    return updated ?? { ...where, ...data };
  }

  async delete({ where }: { where: Record<string, any> }): Promise<any> {
    const w = buildWhere(this.table, where);
    await db.delete(this.table).where(w).execute();
    return where;
  }

  async deleteMany({ where }: { where?: Record<string, any> } = {}): Promise<{ count: number }> {
    const w = buildWhere(this.table, where);
    const result = await db.delete(this.table).where(w).run();
    return { count: (result as any).changes ?? 0 };
  }
}

export class PrismaClient {
  user: TableShim;
  platform: TableShim;
  platformConfig: TableShim;
  account: TableShim;
  post: TableShim;
  media: TableShim;
  conversation: TableShim;
  message: TableShim;
  externalApiKey: TableShim;
  aiOperationLog: TableShim;

  constructor() {
    this.user = new TableShim(schema.user);
    this.platform = new TableShim(schema.platform);
    this.platformConfig = new TableShim(schema.platformConfig);
    this.account = new TableShim(schema.account);
    this.post = new TableShim(schema.post);
    this.media = new TableShim(schema.media);
    this.conversation = new TableShim(schema.conversation);
    this.message = new TableShim(schema.message);
    this.externalApiKey = new TableShim(schema.externalApiKey);
    this.aiOperationLog = new TableShim(schema.aiOperationLog);
  }

  async $disconnect(): Promise<void> {
    client.close();
  }
}
