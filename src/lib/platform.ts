/**
 * 平台配置类型定义
 */

/**
 * 已注册平台列表（单一来源）
 *
 * 用途：seed.ts、register/route.ts、/api/platforms 都从这里派生。
 * 未来加新平台只改这一处。
 *
 * 注：icon 路径对应 /public/icons/<file>.svg
 */
export const REGISTERED_PLATFORMS = [
  { name: "Twitter", icon: "/icons/twitter.svg" },
  { name: "Instagram", icon: "/icons/instagram.svg" },
  { name: "LinkedIn", icon: "/icons/linkedin.svg" },
  { name: "Facebook", icon: "/icons/facebook.svg" },
  { name: "Xiaohongshu", icon: "/icons/xiaohongshu.svg" },
] as const;

// 默认配置常量
export const DEFAULT_PLATFORM_CONFIG = {
  Twitter: {
    maxContentLength: 280,
    maxImages: 4,
    maxVideos: 1,
    allowMixedMedia: true,
  },
  Instagram: {
    maxContentLength: 2200,
    maxImages: 10,
    maxVideos: 1,
    allowMixedMedia: true,
  },
  LinkedIn: {
    maxContentLength: 3000,
    maxImages: 9,
    maxVideos: 1,
    allowMixedMedia: true,
  },
  Facebook: {
    maxContentLength: 63206,
    maxImages: 10,
    maxVideos: 1,
    allowMixedMedia: true,
  },
  Xiaohongshu: {
    maxContentLength: 1000,
    maxImages: 18,
    maxVideos: 1,
    allowMixedMedia: false,
  },
} as const;

// 平台配置接口
export interface PlatformConfig {
  platformId: string;
  platformName: string;
  maxContentLength: number;
  maxImages: number;
  maxVideos: number;
  allowMixedMedia: boolean;
}

// 媒体项接口
export interface MediaItem {
  id: string;
  preview: string; // 预览图（base64 或 URL）
  file?: File; // 新上传的文件
  url?: string; // 已存在的 URL
  thumbnailUrl?: string; // 缩略图 URL（服务端生成的小图）
  type: "image" | "video";
  name?: string; // 文件名
  size?: number; // 文件大小
}

// 视频文件扩展名列表
const VIDEO_EXTENSIONS = ["mp4", "webm", "ogg", "mov", "m4v", "avi", "mkv"];

/**
 * 计算文字长度（按平台算法分派，v0.5 新增）
 *
 * - Twitter：URL 固定 23 字符
 * - 其他平台（Xiaohongshu/Instagram/LinkedIn/Facebook）：UTF-16 code units
 *
 * @param platformName 平台名（如 "Twitter" / "Xiaohongshu"），默认 Twitter
 * @param content 帖子正文
 */
export function countCharsFor(platformName: string, content: string): number {
  if (platformName === "Twitter") {
    return calculateContentLength(content);
  }
  return [...content].length;
}

/**
 * 计算文字长度（用于 Twitter 等平台的字符计数）
 * Twitter 使用特殊的计数方式：
 * - 普通字符：1
 * - URL：23 字符（无论实际长度）
 *
 * @deprecated 建议用 countCharsFor(platformName, content) 按平台分派
 */
export function calculateContentLength(content: string): number {
  // 检测 URL 模式
  const urlRegex = /https?:\/\/[^\s]+/gi;
  let length = 0;
  let lastIndex = 0;
  let match;

  while ((match = urlRegex.exec(content)) !== null) {
    // 计算 URL 之前的普通字符
    length += match.index - lastIndex;
    // URL 固定计为 23 字符
    length += 23;
    lastIndex = urlRegex.lastIndex;
  }

  // 计算最后一部分
  length += content.length - lastIndex;

  return length;
}

/**
 * 获取内容状态
 */
export function getContentStatus(
  content: string,
  maxLength: number,
  platformName: string = "Twitter"
): "normal" | "warning" | "error" {
  const length = countCharsFor(platformName, content);
  if (length > maxLength) return "error";
  if (length > maxLength * 0.9) return "warning";
  return "normal";
}

/**
 * 获取剩余字符数
 */
export function getRemainingChars(
  content: string,
  maxLength: number,
  platformName: string = "Twitter"
): number {
  return maxLength - countCharsFor(platformName, content);
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 检查文件类型是否为图片
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

/**
 * 检查文件类型是否为视频
 */
export function isVideoFile(file: File): boolean {
  return file.type.startsWith("video/");
}

/**
 * 根据 MIME 类型判断是否为视频
 */
export function isVideoMimeType(mimeType: string): boolean {
  return mimeType.toLowerCase().startsWith("video/");
}

/**
 * 根据 MIME 类型判断是否为图片
 */
export function isImageMimeType(mimeType: string): boolean {
  return mimeType.toLowerCase().startsWith("image/");
}

/**
 * 根据 URL 后缀判断是否为视频 URL
 * 支持查询参数（如 .mp4?token=xxx）
 */
export function isVideoUrl(url: string): boolean {
  if (!url) return false;
  // 去掉查询参数
  const cleanUrl = url.split("?")[0].split("#")[0];
  const ext = cleanUrl.toLowerCase().split(".").pop() || "";
  return VIDEO_EXTENSIONS.includes(ext);
}

/**
 * 根据 URL 后缀判断是否为图片 URL
 */
export function isImageUrl(url: string): boolean {
  if (!url) return false;
  const cleanUrl = url.split("?")[0].split("#")[0];
  const ext = cleanUrl.toLowerCase().split(".").pop() || "";
  return ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext);
}
