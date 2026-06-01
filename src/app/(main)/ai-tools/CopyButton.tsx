"use client";

/**
 * 复制按钮（client 组件）
 *
 * 通用：传入 text，点击后复制到剪贴板，1.5s 内显示 ✓
 */

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { useUIStore } from "@/stores/uiStore";

export function CopyButton({
  text,
  label = "复制",
}: {
  text: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const { addToast } = useUIStore();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback for older browsers / non-secure contexts
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        addToast({ type: "error", message: "复制失败" });
      }
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="px-2.5 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-100 rounded transition-colors flex items-center gap-1"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "已复制" : label}
    </button>
  );
}
