// @ts-nocheck
/**
 * 外部 MCP Server 认证模块
 *
 * API Key 验证和用户关联
 */

import { eq } from "drizzle-orm";
import { getDb, externalApiKey } from "@/lib/db";
import type { Scope } from "./types";

/**
 * 把数据库里 permissions 字段映射成内部 Scope
 *
 * 兼容历史值：
 * - read_report / read → 'read'
 * - write → 'write'
 * - read_write → 'read_write'
 * - 其它 / 缺失 → 'read'（安全默认）
 */
export function parseScope(permissions: string | null | undefined): Scope {
  switch (permissions) {
    case 'write':
      return 'write';
    case 'read_write':
      return 'read_write';
    case 'read':
    case 'read_report':
    case null:
    case undefined:
    default:
      return 'read';
  }
}

/**
 * 判断当前 scope 是否覆盖需要的 scope
 *
 * 规则：
 * - 需要 read  → scope ∈ {read, read_write}
 * - 需要 write → scope ∈ {write, read_write}
 */
export function hasScope(scope: Scope, required: 'read' | 'write'): boolean {
  if (required === 'read') {
    return scope === 'read' || scope === 'read_write';
  }
  // required === 'write'
  return scope === 'write' || scope === 'read_write';
}

/**
 * 验证 API Key 并返回关联用户
 */
export async function validateApiKey(apiKey: string): Promise<{
  valid: boolean;
  userId?: string;
  keyId?: string;
  scope?: Scope;
  error?: string;
  errorCode?: string;
}> {
  if (!apiKey) {
    return {
      valid: false,
      error: 'API Key is required',
      errorCode: 'MISSING_KEY'
    };
  }

  // 验证格式
  if (!apiKey.startsWith('npk_')) {
    return {
      valid: false,
      error: 'Invalid API Key format',
      errorCode: 'INVALID_KEY_FORMAT'
    };
  }

  try {
    const db = getDb();
    // 查询 API Key
    const apiKeyRecord = db.select().from(externalApiKey).where(eq(externalApiKey.key, apiKey)).get();

    if (!apiKeyRecord) {
      return {
        valid: false,
        error: 'Invalid API Key',
        errorCode: 'INVALID_KEY'
      };
    }

    // 检查是否过期
    if (apiKeyRecord.expiresAt && new Date() > apiKeyRecord.expiresAt) {
      return {
        valid: false,
        error: 'API Key has expired',
        errorCode: 'KEY_EXPIRED'
      };
    }

    // 更新最后使用时间
    db.update(externalApiKey)
      .set({ lastUsedAt: new Date().toISOString() })
      .where(eq(externalApiKey.id, apiKeyRecord.id))
      .run();

    // 【v0.4 修复】自动迁移遗留的 'read_report' → 'read'。
    // 背景：v0.2 时代所有 key 默认是 'read_report'，但用户/AI 客户端经常误以为是
    // 'read_write'。parseScope 会静默降级为 'read'，所以工具调用都返回 INSUFFICIENT_SCOPE。
    // 这里主动把 DB 改对，让状态自我修复，并打日志提醒（用户后续能通过 Settings UI
    // 看到这条 key 的真实 scope = 'read'，需要的话手动删了重建为 read_write）。
    if (apiKeyRecord.permissions === 'read_report') {
      db.update(externalApiKey)
        .set({ permissions: 'read' })
        .where(eq(externalApiKey.id, apiKeyRecord.id))
        .run();
      console.warn(
        `[MCP Auth] Auto-migrated legacy key ${apiKeyRecord.id} (name="${apiKeyRecord.name}", user=${apiKeyRecord.userId}) from 'read_report' to 'read'. User should recreate if they need write.`
      );
      apiKeyRecord.permissions = 'read';
    }

    return {
      valid: true,
      userId: apiKeyRecord.userId,
      keyId: apiKeyRecord.id,
      scope: parseScope(apiKeyRecord.permissions)
    };
  } catch (error) {
    console.error('Error validating API Key:', error);
    return {
      valid: false,
      error: 'Internal server error',
      errorCode: 'INTERNAL_ERROR'
    };
  }
}

/**
 * 生成新的 API Key
 *
 * @param scope 权限范围（默认 'read'）。合法值：'read' | 'write' | 'read_write'。
 *              其它值 / 缺失都安全降级为 'read'。
 */
export async function generateApiKey(
  userId: string,
  name: string,
  expiresAt?: Date,
  scope?: Scope | string
): Promise<{
  success: boolean;
  key?: string;
  scope?: Scope;
  error?: string;
}> {
  try {
    const db = getDb();
    // 解析并归一化 scope
    const finalScope: Scope = parseScope(scope);

    // 生成随机密钥
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    const keyValue = Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const fullKey = `npk_${keyValue}`;

    // 创建 API Key 记录
    db.insert(externalApiKey)
      .values({
        userId,
        name,
        key: fullKey,
        expiresAt: expiresAt?.toISOString() ?? null,
        permissions: finalScope,
      })
      .run();

    return {
      success: true,
      key: fullKey,
      scope: finalScope,
    };
  } catch (error) {
    console.error('Error generating API Key:', error);
    return {
      success: false,
      error: 'Failed to generate API Key'
    };
  }
}

/**
 * 删除 API Key
 */
export async function deleteApiKey(
  userId: string,
  keyId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const db = getDb();
    // 先验证归属
    const existing = db.select().from(externalApiKey)
      .where(eq(externalApiKey.id, keyId))
      .get();
    if (!existing || existing.userId !== userId) {
      return {
        success: false,
        error: 'API Key not found or not owned by user'
      };
    }
    db.delete(externalApiKey)
      .where(eq(externalApiKey.id, keyId))
      .run();
    return { success: true };
  } catch (error) {
    console.error('Error deleting API Key:', error);
    return {
      success: false,
      error: 'Failed to delete API Key'
    };
  }
}

/**
 * 获取用户的 API Key 列表（不包含完整密钥）
 */
export async function listApiKeys(userId: string): Promise<{
  success: boolean;
  keys?: Array<{
    id: string;
    name: string;
    permissions: string;
    lastUsedAt: string | null;
    expiresAt: string | null;
    createdAt: string;
    keyPreview: string; // 只显示前8位
  }>;
  error?: string;
}> {
  try {
    const db = getDb();
    // 【v0.4】先把遗留的 read_report 一次性迁到 read，让 Settings UI 展示真实 scope
    db.update(externalApiKey)
      .set({ permissions: 'read' })
      .where(eq(externalApiKey.permissions, 'read_report'))
      .run();

    const keys = db.select().from(externalApiKey)
      .where(eq(externalApiKey.userId, userId))
      .all();

    return {
      success: true,
      keys: keys.map((k: typeof externalApiKey.$inferSelect) => ({
        id: k.id,
        name: k.name,
        permissions: k.permissions,
        lastUsedAt: k.lastUsedAt || null,
        expiresAt: k.expiresAt || null,
        createdAt: k.createdAt,
        keyPreview: k.key.substring(0, 12) + '...'
      }))
    };
  } catch (error) {
    console.error('Error listing API Keys:', error);
    return {
      success: false,
      error: 'Failed to list API Keys'
    };
  }
}