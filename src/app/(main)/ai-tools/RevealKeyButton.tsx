"use client";

/**
 * Reveal API Key 按钮（client 组件）
 *
 * 调 /api/settings/external-keys/reveal?id=xxx 拿完整 key，
 * 然后显示在一个 input 里，附带"复制"按钮。
 */

import { useState } from "react";
import { Eye, EyeOff, Copy, Check } from "lucide-react";
import { useUIStore } from "@/stores/uiStore";

export function RevealKeyButton({ keyId }: { keyId: string }) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const { addToast } = useUIStore();

  const handleReveal = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/settings/external-keys/reveal?id=${keyId}`);
      if (res.ok) {
        const data = await res.json();
        setRevealed(data.key);
      } else {
        addToast({ type: "error", message: "获取 key 失败" });
      }
    } catch {
      addToast({ type: "error", message: "网络错误" });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!revealed) return;
    try {
      await navigator.clipboard.writeText(revealed);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      addToast({ type: "error", message: "复制失败" });
    }
  };

  if (revealed) {
    return (
      <div className="flex items-center gap-1" data-testid="apikey-revealed">
        <input
          readOnly
          value={revealed}
          className="w-56 px-2 py-1 text-xs font-mono bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-700 dark:text-gray-300"
          onClick={(e) => e.currentTarget.select()}
        />
        <button
          type="button"
          onClick={handleCopy}
          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
          title="复制"
        >
          {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
        </button>
        <button
          type="button"
          onClick={() => setRevealed(null)}
          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
          title="隐藏"
        >
          <EyeOff size={14} />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleReveal}
      disabled={loading}
      className="px-3 py-1.5 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded transition-colors disabled:opacity-50"
      data-testid="apikey-reveal-btn"
    >
      <Eye size={12} className="inline mr-1" />
      {loading ? "加载中..." : "Reveal"}
    </button>
  );
}
