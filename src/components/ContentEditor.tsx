"use client";

import { useMemo } from "react";
import {
  calculateContentLength,
  getContentStatus,
  getRemainingChars,
  PlatformConfig,
} from "@/lib/platform";
import { AlertCircle } from "lucide-react";

interface ContentEditorProps {
  platformConfig: PlatformConfig;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

export function ContentEditor({
  platformConfig,
  value,
  onChange,
  placeholder = "输入你的帖子内容...",
  rows = 6,
}: ContentEditorProps) {
  const charCount = useMemo(() => calculateContentLength(value), [value]);
  const remaining = useMemo(
    () => getRemainingChars(value, platformConfig.maxContentLength),
    [value, platformConfig.maxContentLength]
  );
  const status = useMemo(
    () => getContentStatus(value, platformConfig.maxContentLength),
    [value, platformConfig.maxContentLength]
  );

  // 计算进度条百分比
  const progressPercent = useMemo(() => {
    const percent = (charCount / platformConfig.maxContentLength) * 100;
    return Math.min(percent, 100);
  }, [charCount, platformConfig.maxContentLength]);

  // 状态颜色
  const statusColor = useMemo(() => {
    switch (status) {
      case "error":
        return "text-red-500";
      case "warning":
        return "text-amber-500";
      default:
        return "text-gray-500 dark:text-gray-400";
    }
  }, [status]);

  const progressColor = useMemo(() => {
    switch (status) {
      case "error":
        return "bg-red-500";
      case "warning":
        return "bg-amber-500";
      default:
        return "bg-blue-500";
    }
  }, [status]);

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
        rows={rows}
      />

      {/* 字符计数和进度条 */}
      <div className="space-y-1">
        {/* 进度条 */}
        <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-200 ${progressColor}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* 字符统计 */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span className={statusColor}>
              {charCount} / {platformConfig.maxContentLength}
            </span>
            {status === "error" && (
              <span className="flex items-center gap-1 text-red-500">
                <AlertCircle size={14} />
                超出 {Math.abs(remaining)} 字符
              </span>
            )}
            {status === "warning" && (
              <span className="text-amber-500">剩余 {remaining} 字符</span>
            )}
          </div>
          {remaining > 20 && (
            <span className="text-gray-400">剩余 {remaining} 字符</span>
          )}
        </div>
      </div>
    </div>
  );
}