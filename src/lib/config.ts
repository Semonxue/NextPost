/**
 * NextPost 统一配置
 * 所有全局配置参数应在此文件中定义，避免到处硬编码
 */

// ============ 缩略图配置 ============
/** 服务端缩略图尺寸（最大边），单位：像素 */
export const THUMBNAIL_SIZE = 90;
/** 服务端缩略图质量（1-100） */
export const THUMBNAIL_QUALITY = 70;
/** 缩略图最大文件大小（超过此大小才会生成缩略图），单位：字节 */
export const THUMBNAIL_MIN_SIZE = 30 * 1024; // 30KB
/** 缩略图最大文件大小限制，单位：字节 */
export const THUMBNAIL_MAX_SIZE = 30 * 1024; // 30KB
/** 缩略图文件后缀 */
export const THUMBNAIL_SUFFIX = ".thumb.webp";

// ============ 前端抽帧配置 ============
/** 前端 canvas 抽帧尺寸（最大边），单位：像素 */
export const FRONTEND_THUMBNAIL_SIZE = 240;
/** 前端抽帧 JPEG 质量（0-1） */
export const FRONTEND_THUMBNAIL_QUALITY = 0.7;

// ============ MCP 服务配置 ============
export const MCP_SERVER_NAME = "nextpost-external";
export const MCP_SERVER_VERSION = "0.4.2";
export const MCP_PORT = parseInt(process.env.MCP_PORT || "3100", 10);

// ============ 媒体上传配置 ============
/** 最大媒体文件大小，单位：字节（10MB） */
export const MAX_MEDIA_SIZE = 10 * 1024 * 1024;
/** 最大 base64 编码文件大小，单位：字节（5MB 原始文件 ≈ 6.7MB base64） */
export const MAX_BASE64_SIZE = 5 * 1024 * 1024;
/** 允许的 MIME 类型 */
export const ALLOWED_MIME_TYPES: Set<string> = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/webm",
]);
export type AllowedMimeType = "image/jpeg" | "image/png" | "image/gif" | "image/webp" | "video/mp4" | "video/webm";

// ============ 文件扩展名配置 ============
/** 视频文件扩展名 */
export const VIDEO_EXTENSIONS = ["mp4", "webm", "ogg", "mov", "m4v", "avi", "mkv"] as const;
/** 图片文件扩展名 */
export const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"] as const;
/** 视频扩展名到 MIME 类型的映射 */
export const EXT_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
};
/** MIME 类型到扩展名的映射 */
export const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
};

// ============ Cookie 配置 ============
/** 过滤状态 Cookie 名称 */
export const COOKIE_FILTER_ACCOUNTS = "np_filter_accounts";
export const COOKIE_FILTER_PLATFORMS = "np_filter_platforms";
export const COOKIE_FILTER_STATUS = "np_filter_status";
export const COOKIE_FILTER_SORT_FIELD = "np_filter_sort_field";
export const COOKIE_FILTER_SORT_ORDER = "np_filter_sort_order";
/** Settings 页面当前 tab Cookie 名称（刷新后保持 tab 状态） */
export const COOKIE_SETTINGS_TAB = "np_settings_tab";

// ============ API 配置 ============
/** 默认分页大小 */
export const DEFAULT_PAGE_SIZE = 500;
/** 回收站默认分页限制 */
export const TRASH_PAGE_SIZE = 50;

/** publishToken 前缀 */
export const PUBLISH_TOKEN_PREFIX = "tok_";
/** API Key 前缀 */
export const API_KEY_PREFIX = "npk_";

// ============ 应用 URL 配置（单一 source of truth）============

/**
 * 获取应用对外 URL（含 scheme + host + port）
 * 单一 source of truth：所有需要拼完整 URL 的地方都从这里读
 *
 * 优先级：process.env.APP_URL > NEXT_PUBLIC_BASE_URL > localhost:3456
 *
 * - 本地开发：APP_URL 未设置 → NEXT_PUBLIC_BASE_URL 未设置 → localhost:3456
 * - CF Workers 部署：wrangler.jsonc vars 设置 NEXT_PUBLIC_BASE_URL
 * - 需要单独覆盖时：设置 APP_URL（如有特殊路由需求）
 */
export function getAppUrl(): string {
  return process.env.APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3456";
}

/**
 * 解析 APP_URL 拿端口号
 * - 默认 URL 默认端口是 3456
 * - 用户配的 APP_URL 解析失败时回退到 3456
 */
export function getPort(): number {
  try {
    const port = new URL(getAppUrl()).port;
    if (port) return parseInt(port, 10);
    // 80/443 等默认端口 URL 里可能省略
    const protocol = new URL(getAppUrl()).protocol;
    return protocol === "https:" ? 443 : 80;
  } catch {
    return 3456;
  }
}

/** MCP HTTP 端点完整 URL（用于 UI 展示、curl 示例、客户端配置模板） */
export function getMcpEndpointUrl(): string {
  return `${getAppUrl()}/api/mcp`;
}