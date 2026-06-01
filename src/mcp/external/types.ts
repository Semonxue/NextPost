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
  mediaUrls: string[];
  scheduledTime: string;
  timezone: string;
  publishToken: string;
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