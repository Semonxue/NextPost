/**
 * 平台色标映射（v0.5 增强 UX）
 *
 * 单一来源：所有 UI 渲染平台色标/标签都从这里取。
 * 加新平台时只要在这里加一条。
 */

export interface PlatformStyle {
  /** Tailwind 背景色 class（含 hover/dark 变体） */
  bgClass: string;
  /** Tailwind 文字色 class */
  textClass: string;
  /** 简写 icon emoji（fallback） */
  icon: string;
  /** 平台 display 名（标准化） */
  label: string;
}

const FALLBACK_STYLE: PlatformStyle = {
  bgClass: 'bg-gray-100 dark:bg-gray-700',
  textClass: 'text-gray-700 dark:text-gray-300',
  icon: '○',
  label: '未知平台',
};

const STYLES: Record<string, PlatformStyle> = {
  twitter: {
    bgClass: 'bg-gray-900 dark:bg-gray-200',
    textClass: 'text-white dark:text-gray-900',
    icon: '𝕏',
    label: 'Twitter / X',
  },
  xiaohongshu: {
    bgClass: 'bg-red-500',
    textClass: 'text-white',
    icon: '📕',
    label: '小红书',
  },
  instagram: {
    bgClass: 'bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400',
    textClass: 'text-white',
    icon: '📷',
    label: 'Instagram',
  },
  linkedin: {
    bgClass: 'bg-blue-700',
    textClass: 'text-white',
    icon: '💼',
    label: 'LinkedIn',
  },
  facebook: {
    bgClass: 'bg-blue-600',
    textClass: 'text-white',
    icon: '👥',
    label: 'Facebook',
  },
};

export function getPlatformStyle(name?: string | null): PlatformStyle {
  if (!name) return FALLBACK_STYLE;
  // 不区分大小写匹配
  const key = Object.keys(STYLES).find((k) => k.toLowerCase() === name.toLowerCase());
  return (key && STYLES[key]) || { ...FALLBACK_STYLE, label: name };
}

/** 紧凑的"平台徽章" React 元素 className（用于行内标签） */
export function getPlatformBadgeClasses(name?: string | null): string {
  const s = getPlatformStyle(name);
  return `inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${s.bgClass} ${s.textClass}`;
}
