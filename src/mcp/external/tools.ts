/**
 * 外部 MCP Server 工具定义
 *
 * v0.2 读取工具：
 * - list_accounts: 获取账号列表（脱敏）
 * - get_pending_posts: 获取待发布帖子
 * - get_post_detail: 获取帖子详情
 * - report_publish_result: 报告发布结果
 *
 * v0.3 MVP 写工具（需要 write / read_write scope）：
 * - upload_media_from_url: 从 URL 拉取媒体存到 NextPost
 * - create_post: 创建 scheduled 帖子
 * - update_post: 限制性更新（仅 scheduledTime / timezone）
 *
 * 设计原则：
 * - 外部 MCP 不提供 delete
 * - update 字段白名单（content/media/account/status 全部不可改）
 * - status 锁：仅 draft / scheduled 可改；publishing/published/failed 全部锁死
 */

import { PrismaClient } from '@prisma/client';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import type {
  ExternalAccount,
  ExternalPost,
  ExternalPostDetail,
  PublishResultResponse,
  Scope,
  ToolRequiredScope,
  WriteResult,
  UploadMediaResult,
} from './types';
import { uploadFile } from '@/lib/storage';
import { hasScope } from './auth';

const prisma = new PrismaClient();

// 单个工具需要的最低 scope
const TOOL_SCOPE: Record<string, ToolRequiredScope> = {
  list_accounts: 'read',
  get_pending_posts: 'read',
  get_post_detail: 'read',
  report_publish_result: 'read',
  // v0.3 write
  upload_media_from_url: 'write',
  create_post: 'write',
  update_post: 'write',
};

// 文件大小上限（与 /api/media/upload 保持一致）
const MAX_MEDIA_SIZE = 10 * 1024 * 1024;
// 允许的 mime 类型
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
]);

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
  },
  // ===== v0.3 MVP: 写工具 =====
  {
    name: 'upload_media_from_url',
    description: '从公网 URL 拉取媒体文件存入 NextPost，返回可在 create_post 中使用的 URL。需要 write 或 read_write 权限。文件大小上限 10MB，仅支持图片/视频（image/jpeg, image/png, image/gif, image/webp, video/mp4, video/webm）。',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: '媒体文件公网 URL（http/https）'
        },
        filename: {
          type: 'string',
          description: '可选，自定义文件名（不含路径）。不传则从 URL 或 content-type 推断'
        }
      },
      required: ['url']
    }
  },
  {
    name: 'create_post',
    description: '创建一个新的 scheduled 帖子。需要 write 或 read_write 权限。content 与 mediaUrls 至少要有一个非空；scheduledTime 必须是未来时间的 ISO 8601 字符串（如 2026-06-02T10:00:00+08:00）。返回的 publishToken 是后续发布结果回传的关键。',
    inputSchema: {
      type: 'object',
      properties: {
        accountId: {
          type: 'string',
          description: '关联账号 ID（先用 list_accounts 获取）'
        },
        content: {
          type: 'string',
          description: '帖子正文'
        },
        mediaUrls: {
          type: 'array',
          items: { type: 'string' },
          description: '媒体 URL 列表（先用 upload_media_from_url 拿到），可空'
        },
        scheduledTime: {
          type: 'string',
          description: '计划发布时间，ISO 8601 格式'
        },
        timezone: {
          type: 'string',
          description: '时区，如 Asia/Shanghai。默认 Asia/Shanghai'
        }
      },
      required: ['accountId', 'scheduledTime']
    }
  },
  {
    name: 'update_post',
    description: '更新一个 draft 或 scheduled 帖子的发布时间/时区。需要 write 或 read_write 权限。【重要】只能修改 scheduledTime 和 timezone，其它字段（content/mediaUrls/accountId/status）一律忽略，不会被改动。已进入 publishing/published/failed 状态的帖子不可修改。',
    inputSchema: {
      type: 'object',
      properties: {
        postId: {
          type: 'string',
          description: '要更新的帖子 ID'
        },
        scheduledTime: {
          type: 'string',
          description: '新的计划发布时间，ISO 8601 格式'
        },
        timezone: {
          type: 'string',
          description: '新的时区'
        }
      },
      required: ['postId']
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

// ===== v0.3 MVP 写工具实现 =====

/**
 * 从 URL 拉取媒体存到 NextPost
 */
async function uploadMediaFromUrl(
  userId: string,
  url: string,
  filename?: string
): Promise<UploadMediaResult | { error: string; errorCode: string; retryable?: boolean }> {
  if (!url || typeof url !== 'string') {
    return { error: 'url is required', errorCode: 'INVALID_ARGUMENT' };
  }

  // 仅允许 http/https
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { error: 'invalid url format', errorCode: 'INVALID_URL' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { error: 'only http/https URLs are allowed', errorCode: 'INVALID_URL' };
  }

  // 拉取
  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    return {
      error: `failed to fetch url: ${err instanceof Error ? err.message : 'unknown'}`,
      errorCode: 'FETCH_FAILED',
      retryable: true,
    };
  }

  if (!response.ok) {
    return {
      error: `fetch returned ${response.status}`,
      errorCode: 'FETCH_FAILED',
      retryable: response.status >= 500,
    };
  }

  // 文件大小校验（优先用 content-length）
  const contentLength = response.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_MEDIA_SIZE) {
    return {
      error: `file too large: ${contentLength} > ${MAX_MEDIA_SIZE}`,
      errorCode: 'FILE_TOO_LARGE',
    };
  }

  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_MEDIA_SIZE) {
    return {
      error: `file too large: ${arrayBuffer.byteLength} > ${MAX_MEDIA_SIZE}`,
      errorCode: 'FILE_TOO_LARGE',
    };
  }

  // mime 校验
  const contentType = (response.headers.get('content-type') || 'application/octet-stream')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(contentType)) {
    return {
      error: `unsupported mime type: ${contentType}`,
      errorCode: 'UNSUPPORTED_MIME',
    };
  }

  // 推断文件名
  const inferredExt = (() => {
    if (contentType === 'image/jpeg') return '.jpg';
    if (contentType === 'image/png') return '.png';
    if (contentType === 'image/gif') return '.gif';
    if (contentType === 'image/webp') return '.webp';
    if (contentType === 'video/mp4') return '.mp4';
    if (contentType === 'video/webm') return '.webm';
    return '';
  })();
  const finalFilename = filename || `${Date.now()}${inferredExt}`;

  const buffer = Buffer.from(arrayBuffer);
  const result = await uploadFile(buffer, finalFilename, contentType);

  return {
    url: result.url,
    mimeType: result.mimeType,
    size: result.size,
    filename: result.filename,
  };
}

/**
 * 提取 Post 写入返回的字段
 */
function formatPostForWrite(post: {
  id: string;
  accountId: string;
  content: string;
  mediaUrls: string;
  scheduledTime: Date | null;
  timezone: string;
  status: string;
  publishToken: string | null;
  account?: { name: string } | null;
}): NonNullable<WriteResult['post']> {
  return {
    id: post.id,
    accountId: post.accountId,
    accountDisplayName: post.account?.name || '',
    content: post.content,
    mediaUrls: JSON.parse(post.mediaUrls || '[]') as string[],
    scheduledTime: post.scheduledTime?.toISOString() || '',
    timezone: post.timezone,
    status: post.status,
    publishToken: post.publishToken || '',
  };
}

/**
 * 创建 scheduled 帖子
 */
async function createPost(
  userId: string,
  accountId: string,
  content: string,
  mediaUrls: string[],
  scheduledTime: string,
  timezone?: string
): Promise<WriteResult> {
  // 校验账号归属
  const account = await prisma.account.findFirst({
    where: { id: accountId, userId, deletedAt: null },
  });
  if (!account) {
    return { success: false, error: 'account not found or not owned by user', errorCode: 'ACCOUNT_NOT_FOUND' };
  }

  // 校验 content + media 不能都空
  const hasContent = typeof content === 'string' && content.trim().length > 0;
  const hasMedia = Array.isArray(mediaUrls) && mediaUrls.length > 0;
  if (!hasContent && !hasMedia) {
    return { success: false, error: 'content or mediaUrls required', errorCode: 'EMPTY_CONTENT' };
  }

  // 校验 scheduledTime 是未来
  const scheduledDate = new Date(scheduledTime);
  if (isNaN(scheduledDate.getTime())) {
    return { success: false, error: 'invalid scheduledTime', errorCode: 'INVALID_SCHEDULED_TIME' };
  }
  if (scheduledDate.getTime() <= Date.now()) {
    return { success: false, error: 'scheduledTime must be in the future', errorCode: 'SCHEDULED_TIME_IN_PAST' };
  }

  // 生成 publishToken（与 /api/posts 保持一致的格式）
  const publishToken = `tok_${crypto.randomUUID().replace(/-/g, '')}`;

  const post = await prisma.post.create({
    data: {
      userId,
      accountId,
      content: content || '',
      mediaUrls: JSON.stringify(mediaUrls || []),
      scheduledTime: scheduledDate,
      timezone: timezone || 'Asia/Shanghai',
      status: 'scheduled',
      publishToken,
    },
    include: { account: { include: { platform: true } } },
  });

  return { success: true, post: formatPostForWrite(post) };
}

/**
 * 限制性更新帖子（仅 scheduledTime / timezone）
 */
async function updatePost(
  userId: string,
  postId: string,
  scheduledTime?: string,
  timezone?: string
): Promise<WriteResult> {
  // 找帖子（必须在 draft/scheduled 状态，未软删）
  const existing = await prisma.post.findFirst({
    where: { id: postId, userId, deletedAt: null },
    include: { account: true },
  });
  if (!existing) {
    return { success: false, error: 'post not found or not owned by user', errorCode: 'POST_NOT_FOUND' };
  }

  if (existing.status !== 'draft' && existing.status !== 'scheduled') {
    return {
      success: false,
      error: `cannot update post in status '${existing.status}'`,
      errorCode: 'INVALID_STATUS',
    };
  }

  // 字段白名单
  const data: Record<string, unknown> = {};
  if (scheduledTime !== undefined) {
    const date = new Date(scheduledTime);
    if (isNaN(date.getTime())) {
      return { success: false, error: 'invalid scheduledTime', errorCode: 'INVALID_SCHEDULED_TIME' };
    }
    if (date.getTime() <= Date.now()) {
      return { success: false, error: 'scheduledTime must be in the future', errorCode: 'SCHEDULED_TIME_IN_PAST' };
    }
    data.scheduledTime = date;
  }
  if (timezone !== undefined) {
    data.timezone = timezone;
  }

  // 没东西可改也算成功（白名单字段都未传）
  if (Object.keys(data).length === 0) {
    return {
      success: true,
      post: formatPostForWrite(existing),
    };
  }

  const post = await prisma.post.update({
    where: { id: postId },
    data,
    include: { account: { include: { platform: true } } },
  });

  return { success: true, post: formatPostForWrite(post) };
}

/**
 * 工具执行上下文
 */
export interface ToolContext {
  userId: string;
  scope: Scope;
}

/**
 * 执行工具调用
 */
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  context: string | ToolContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  // 向后兼容：旧的调用方式传 userId 字符串
  const ctx: ToolContext = typeof context === 'string'
    ? { userId: context, scope: 'read' }
    : context;

  // scope 检查
  const required = TOOL_SCOPE[toolName];
  if (!required) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ error: `Unknown tool: ${toolName}` }, null, 2)
      }]
    };
  }
  if (required === 'read' && !hasScope(ctx.scope, 'read')) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: `Tool '${toolName}' requires 'read' or 'read_write' scope, but key has '${ctx.scope}'`,
          errorCode: 'INSUFFICIENT_SCOPE',
        }, null, 2)
      }]
    };
  }
  if (required === 'write' && !hasScope(ctx.scope, 'write')) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: `Tool '${toolName}' requires 'write' or 'read_write' scope, but key has '${ctx.scope}'`,
          errorCode: 'INSUFFICIENT_SCOPE',
        }, null, 2)
      }]
    };
  }

  try {
    switch (toolName) {
      case 'list_accounts': {
        const accounts = await listAccounts(ctx.userId);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ accounts }, null, 2)
          }]
        };
      }

      case 'get_pending_posts': {
        const { accountId, limit } = args as { accountId?: string; limit?: number };
        const posts = await getPendingPosts(ctx.userId, accountId, limit || 10);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ posts }, null, 2)
          }]
        };
      }

      case 'get_post_detail': {
        const { postId } = args as { postId: string };
        const post = await getPostDetail(ctx.userId, postId);
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

      // ===== v0.3 写工具 =====
      case 'upload_media_from_url': {
        const { url, filename } = args as { url: string; filename?: string };
        const result = await uploadMediaFromUrl(ctx.userId, url, filename);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }

      case 'create_post': {
        const { accountId, content, mediaUrls, scheduledTime, timezone } = args as {
          accountId: string;
          content?: string;
          mediaUrls?: string[];
          scheduledTime: string;
          timezone?: string;
        };
        const result = await createPost(
          ctx.userId,
          accountId,
          content || '',
          mediaUrls || [],
          scheduledTime,
          timezone
        );
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }

      case 'update_post': {
        const { postId, scheduledTime, timezone } = args as {
          postId: string;
          scheduledTime?: string;
          timezone?: string;
        };
        const result = await updatePost(ctx.userId, postId, scheduledTime, timezone);
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