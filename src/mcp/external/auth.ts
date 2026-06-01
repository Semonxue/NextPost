/**
 * 外部 MCP Server 认证模块
 *
 * API Key 验证和用户关联
 */

import { PrismaClient } from '@prisma/client';
import type { Scope } from './types';

const prisma = new PrismaClient();

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
    // 查询 API Key
    const apiKeyRecord = await prisma.externalApiKey.findUnique({
      where: { key: apiKey },
      include: { user: true }
    });

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
    await prisma.externalApiKey.update({
      where: { id: apiKeyRecord.id },
      data: { lastUsedAt: new Date() }
    });

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
 */
export async function generateApiKey(
  userId: string,
  name: string,
  expiresAt?: Date
): Promise<{
  success: boolean;
  key?: string;
  error?: string;
}> {
  try {
    // 生成随机密钥
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    const keyValue = Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const fullKey = `npk_${keyValue}`;

    // 创建 API Key 记录
    const apiKeyRecord = await prisma.externalApiKey.create({
      data: {
        userId,
        name,
        key: fullKey,
        expiresAt,
        permissions: 'read_report'
      }
    });

    return {
      success: true,
      key: fullKey
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
    const result = await prisma.externalApiKey.deleteMany({
      where: {
        id: keyId,
        userId // 确保只能删除属于自己的 Key
      }
    });

    if (result.count === 0) {
      return {
        success: false,
        error: 'API Key not found or not owned by user'
      };
    }

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
    const keys = await prisma.externalApiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    return {
      success: true,
      keys: keys.map(k => ({
        id: k.id,
        name: k.name,
        permissions: k.permissions,
        lastUsedAt: k.lastUsedAt?.toISOString() || null,
        expiresAt: k.expiresAt?.toISOString() || null,
        createdAt: k.createdAt.toISOString(),
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