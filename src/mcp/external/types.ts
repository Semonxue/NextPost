/**
 * 外部 MCP Server 类型定义
 */

// 账号脱敏信息
export interface ExternalAccount {
  id: string;
  platform: string;
  displayName: string;
}

// 帖子信息
export interface ExternalPost {
  id: string;
  accountId: string;
  accountDisplayName: string;
  content: string;
  title?: string;          // v0.5 新增（小红书等平台必需）
  mediaUrls: string[];
  scheduledTime: string;
  timezone: string;
  publishToken: string;
  extractedTopics?: string[];  // v0.5 新增：从 content 提取的 #hashtag（computed）
}

// 帖子详情
export interface ExternalPostDetail extends ExternalPost {
  status: string;
  externalPostUrl?: string;
}

// 发布结果报告
export interface PublishResultReport {
  postId: string;
  publishToken: string;
  status: 'success' | 'failed' | 'partial';
  publishedAt?: string;
  externalPostId?: string;
  externalPostUrl: string; // 必填，用于 NextPost 界面显示跳转按钮
  errorCode?: string;
  errorMessage?: string;
  retryable?: boolean;
}

// 发布结果响应
export interface PublishResultResponse {
  received: boolean;
  postStatus: string;
  message: string;
  retryable?: boolean;
}

// ===== MVP v0.3: 外部 MCP 写能力 =====

// API Key 权限范围
// - read: 只读 + 报告发布结果（默认）
// - write: 创建/更新帖子、上传媒体
// - read_write: 上述两者
// 兼容历史值 read_report → read
export type Scope = 'read' | 'write' | 'read_write';

// 工具执行需要的最小 scope
export type ToolRequiredScope = 'read' | 'write';

// 媒体上传（URL 拉取）参数
export interface UploadMediaFromUrlArgs {
  url: string;
  filename?: string;
}

// 媒体上传结果
export interface UploadMediaResult {
  url: string;
  mimeType: string;
  size: number;
  filename: string;
}

// 创建帖子参数
export interface CreatePostArgs {
  accountId: string;
  content: string;
  title?: string;          // v0.5 新增
  mediaUrls?: string[];
  scheduledTime: string; // ISO 8601
  timezone?: string;     // 默认 Asia/Shanghai
}

// 更新帖子参数（v0.3.2 扩展：支持 content 和 mediaUrls；v0.5 新增 title）
export interface UpdatePostArgs {
  postId: string;
  content?: string;
  title?: string;
  mediaUrls?: string[];
  scheduledTime?: string;
  timezone?: string;
}

// 写操作结果（统一格式）
export interface WriteResult {
  success: boolean;
  error?: string;
  errorCode?: string;
  retryable?: boolean;
  // create_post 成功时附带 post
  post?: {
    id: string;
    accountId: string;
    accountDisplayName: string;
    content: string;
    title?: string;
    mediaUrls: string[];
    scheduledTime: string;
    timezone: string;
    status: string;
    publishToken: string;
  };
}

// 可重试错误码
export const RETRYABLE_ERRORS = [
  'rate_limit',
  'network_error',
  'timeout',
  'service_unavailable',
] as const;

// 不可重试错误码
export const NON_RETRYABLE_ERRORS = [
  'content_violation',
  'auth_expired',
  'duplicate_content',
  'account_suspended',
] as const;

export type RetryableError = typeof RETRYABLE_ERRORS[number];
export type NonRetryableError = typeof NON_RETRYABLE_ERRORS[number];