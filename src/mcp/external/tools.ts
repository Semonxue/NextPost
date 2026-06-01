/**
 * 外部 MCP Server 工具定义
 * 
 * 实现四个工具：
 * - list_accounts: 获取账号列表（脱敏）
 * - get_pending_posts: 获取待发布帖子
 * - get_post_detail: 获取帖子详情
 * - report_publish_result: 报告发布结果
 */

import { PrismaClient } from '@prisma/client';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ExternalAccount, ExternalPost, ExternalPostDetail, PublishResultResponse } from './types.js';

const prisma = new PrismaClient();

// 获取基础 URL（用于拼接完整的媒体文件 URL）
function getBaseUrl(): string {
  // 在服务端使用 process.env.NEXT_PUBLIC_BASE_URL 或默认值
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }
  // 开发环境默认
  return 'http://localhost:3000';
}

// 将相对路径转换为完整 URL
function toAbsoluteUrl(relativePath: string): string {
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return relativePath;
  }
  return `${getBaseUrl()}${relativePath}`;
}

// 工具定义常量
export const TOOLS: Tool[] = [
  {
    name: 'list_accounts',
    description: '获取用户配置的所有社交账号（仅返回显示名称，不含敏感信息）',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_pending_posts',
    description: '获取待发布的帖子列表，按计划时间排序。返回 accountId，请务必在发布前核对账号信息，避免发错账号。publishToken 用于后续 report_publish_result 验证。mediaUrls 返回完整 HTTP URL，CLI 可直接下载。',
    inputSchema: {
      type: 'object',
      properties: {
        accountId: {
          type: 'string',
          description: '可选：按账号筛选'
        },
        limit: {
          type: 'number',
          description: '返回数量，默认 10',
          default: 10
        }
      }
    }
  },
  {
    name: 'get_post_detail',
    description: '获取单个帖子的完整信息，包括 accountId（请务必核对账号，避免发错）。返回 publishToken 用于发布结果回传验证。mediaUrls 返回完整 HTTP URL，CLI 可直接下载。',
    inputSchema: {
      type: 'object',
      properties: {
        postId: {
          type: 'string'
        }
      },
      required: ['postId']
    }
  },
  {
    name: 'report_publish_result',
    description: '报告发布结果。必须提供正确的 publishToken 才能更新帖子状态。成功时 status="success"，失败时 status="failed" 并提供错误码。【关键】成功时必须回传 externalPostUrl（可点击的完整链接，格式如 https://x.com/user/status/123），不能只传 externalPostId，否则 NextPost 界面无法显示跳转按钮。',
    inputSchema: {
      type: 'object',
      properties: {
        postId: {
          type: 'string',
          description: 'NextPost 帖子 ID'
        },
        publishToken: {
          type: 'string',
          description: '发布令牌，用于验证'
        },
        status: {
          type: 'string',
          enum: ['success', 'failed', 'partial'],
          description: '发布状态'
        },
        publishedAt: {
          type: 'string',
          description: '实际发布时间 ISO 8601'
        },
        externalPostId: {
          type: 'string',
          description: '外部平台帖子 ID（如 Twitter tweet ID），可选'
        },
        externalPostUrl: {
          type: 'string',
          description: '【必须】外部帖子完整 URL，用于在浏览器打开，如 https://x.com/user/status/123。必须提供此字段才能在 NextPost 界面显示跳转按钮'
        },
        errorCode: {
          type: 'string',
          description: '错误码（失败时）'
        },
        errorMessage: {
          type: 'string',
          description: '错误信息（失败时）'
        },
        retryable: {
          type: 'boolean',
          description: '是否可重试'
        }
      },
      required: ['postId', 'publishToken', 'status', 'externalPostUrl']
    }
  }
] as const;

/**
 * 获取账号列表（脱敏）
 */
async function listAccounts(userId: string): Promise<ExternalAccount[]> {
  const accounts = await prisma.account.findMany({
    where: {
      userId,
      deletedAt: null
    },
    include: {
      platform: true
    }
  });

  return accounts.map(acc => ({
    id: acc.id,
    platform: acc.platform.name,
    displayName: acc.name
  }));
}

/**
 * 获取待发布帖子
 */
async function getPendingPosts(
  userId: string,
  accountId?: string,
  limit: number = 10
): Promise<ExternalPost[]> {
  // 构建查询条件
  const where: Record<string, unknown> = {
    userId,
    status: 'scheduled',
    deletedAt: null,
    scheduledTime: { not: null }
  };

  if (accountId) {
    where.accountId = accountId;
  }

  const posts = await prisma.post.findMany({
    where,
    include: {
      account: {
        include: {
          platform: true
        }
      }
    },
    orderBy: {
      scheduledTime: 'asc'
    },
    take: limit
  });

  return posts.map(post => {
    const account = post.account as { name: string };
    // 将 mediaUrls 中的相对路径转换为完整 URL
    const rawMediaUrls = JSON.parse(post.mediaUrls || '[]') as string[];
    const mediaUrls = rawMediaUrls.map(url => toAbsoluteUrl(url));
    return {
      id: post.id,
      accountId: post.accountId,
      accountDisplayName: account.name,
      content: post.content,
      mediaUrls,
      scheduledTime: post.scheduledTime?.toISOString() || '',
      timezone: post.timezone,
      publishToken: (post as { publishToken?: string }).publishToken || ''
    };
  });
}

/**
 * 获取帖子详情
 */
async function getPostDetail(userId: string, postId: string): Promise<ExternalPostDetail | null> {
  const post = await prisma.post.findFirst({
    where: {
      id: postId,
      userId,
      deletedAt: null
    },
    include: {
      account: {
        include: {
          platform: true
        }
      }
    }
  });

  if (!post) {
    return null;
  }

  const postData = post as { 
    publishToken?: string;
    externalPostUrl?: string;
    account: { name: string };
  };
  // 将 mediaUrls 中的相对路径转换为完整 URL
  const rawMediaUrls = JSON.parse(post.mediaUrls || '[]') as string[];
  const mediaUrls = rawMediaUrls.map(url => toAbsoluteUrl(url));
  return {
    id: post.id,
    accountId: post.accountId,
    accountDisplayName: postData.account.name,
    content: post.content,
    mediaUrls,
    scheduledTime: post.scheduledTime?.toISOString() || '',
    timezone: post.timezone,
    publishToken: postData.publishToken || '',
    externalPostUrl: postData.externalPostUrl || '',
    status: post.status
  };
};

/**
 * 报告发布结果
 */
async function reportPublishResult(
  postId: string,
  publishToken: string,
  status: 'success' | 'failed' | 'partial',
  publishedAt?: string,
  externalPostId?: string,
  externalPostUrl?: string,
  errorCode?: string,
  errorMessage?: string,
  retryable?: boolean
): Promise<PublishResultResponse> {
  // 验证帖子存在且令牌匹配
  const post = await prisma.post.findFirst({
    where: {
      id: postId,
      publishToken: publishToken,
      deletedAt: null
    }
  });

  if (!post) {
    return {
      received: false,
      postStatus: 'not_found',
      message: 'Post not found or publish token mismatch'
    };
  }

  // 构建更新数据
  const updateData: Record<string, unknown> = {
    publishAttempts: { increment: 1 }
  };

  switch (status) {
    case 'success':
      updateData.status = 'published';
      updateData.publishedAt = publishedAt ? new Date(publishedAt) : new Date();
      if (externalPostId) {
        updateData.externalPostId = externalPostId;
      }
      if (externalPostUrl) {
        updateData.externalPostUrl = externalPostUrl;
      }
      updateData.publishError = null;
      break;
    case 'failed':
      updateData.status = 'failed';
      updateData.publishError = errorMessage || 'Unknown error';
      if (errorCode) {
        updateData.publishError = `[${errorCode}] ${errorMessage || ''}`;
      }
      break;
    case 'partial':
      updateData.status = 'published';
      updateData.publishedAt = publishedAt ? new Date(publishedAt) : new Date();
      updateData.publishError = errorMessage || 'Partial success';
      break;
  }

  // 更新帖子
  await prisma.post.update({
    where: { id: postId },
    data: updateData
  });

  return {
    received: true,
    postStatus: updateData.status as string,
    message: status === 'success' ? '发布结果已记录' : '发布失败已记录',
    retryable: status === 'failed' && retryable
  };
}

// 导出 reportPublishResult 供测试使用
export { reportPublishResult };

/**
 * 执行工具调用
 */
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  userId: string
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    switch (toolName) {
      case 'list_accounts': {
        const accounts = await listAccounts(userId);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ accounts }, null, 2)
          }]
        };
      }

      case 'get_pending_posts': {
        const { accountId, limit } = args as { accountId?: string; limit?: number };
        const posts = await getPendingPosts(userId, accountId, limit || 10);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ posts }, null, 2)
          }]
        };
      }

      case 'get_post_detail': {
        const { postId } = args as { postId: string };
        const post = await getPostDetail(userId, postId);
        if (!post) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ error: 'Post not found' }, null, 2)
            }]
          };
        }
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ post }, null, 2)
          }]
        };
      }

      case 'report_publish_result': {
        const {
          postId,
          publishToken,
          status,
          publishedAt,
          externalPostId,
          externalPostUrl,
          errorCode,
          errorMessage,
          retryable
        } = args as {
          postId: string;
          publishToken: string;
          status: 'success' | 'failed' | 'partial';
          publishedAt?: string;
          externalPostId?: string;
          externalPostUrl?: string;
          errorCode?: string;
          errorMessage?: string;
          retryable?: boolean;
        };
        const result = await reportPublishResult(
          postId,
          publishToken,
          status,
          publishedAt,
          externalPostId,
          externalPostUrl,
          errorCode,
          errorMessage,
          retryable
        );
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }

      default:
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ error: `Unknown tool: ${toolName}` }, null, 2)
          }]
        };
    }
  } catch (error) {
    console.error(`Error executing tool ${toolName}:`, error);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        }, null, 2)
      }]
    };
  }
}