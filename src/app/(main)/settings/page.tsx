"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import { Bot, Key, User } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useUIStore } from "@/stores/uiStore";

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const { addToast } = useUIStore();
  const [loading, setLoading] = useState(true);
  const [aiConfig, setAiConfig] = useState({
    provider: "openai",
    apiKey: "",
    model: "gpt-4",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/login");
    }
    if (status === "authenticated") {
      fetchSettings();
    }
  }, [status]);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setAiConfig({
          provider: data.aiProvider || "openai",
          apiKey: data.aiApiKey || "",
          model: data.aiModel || "gpt-4",
        });
      }
    } catch (error) {
      console.error("获取设置失败:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAI = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiConfig }),
      });
      if (res.ok) {
        addToast({ type: "success", message: "设置已保存" });
      }
    } catch {
      addToast({ type: "error", message: "保存失败" });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    if (!confirm("确定要退出登录吗？")) return;
    await signOut({ callbackUrl: "/login" });
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const aiProviders = [
    { value: "openai", label: "OpenAI (GPT-4)" },
    { value: "anthropic", label: "Anthropic (Claude)" },
    { value: "ollama", label: "Ollama (本地)" },
  ];

  const aiModels: Record<string, string[]> = {
    openai: ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"],
    anthropic: ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku"],
    ollama: ["llama2", "codellama", "mistral"],
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">设置</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">管理你的账号和 AI 配置</p>
      </div>

      {/* User Info */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <User size={20} className="text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">用户信息</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              用户名
            </label>
            <p className="text-gray-900 dark:text-white">{session?.user?.name}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              邮箱
            </label>
            <p className="text-gray-900 dark:text-white">{session?.user?.email || "未设置"}</p>
          </div>
        </div>
      </div>

      {/* AI Config */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <Bot size={20} className="text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">AI 配置</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              AI 提供商
            </label>
            <select
              value={aiConfig.provider}
              onChange={(e) => setAiConfig({ ...aiConfig, provider: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {aiProviders.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              API Key
            </label>
            <div className="relative">
              <Key size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                value={aiConfig.apiKey}
                onChange={(e) => setAiConfig({ ...aiConfig, apiKey: e.target.value })}
                placeholder="输入你的 API Key"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {aiConfig.provider === "ollama"
                ? "本地运行 Ollama 时不需要 API Key"
                : "你的 API Key 将被加密存储"}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              模型
            </label>
            <select
              value={aiConfig.model}
              onChange={(e) => setAiConfig({ ...aiConfig, model: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {aiModels[aiConfig.provider]?.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>

          <Button onClick={handleSaveAI} loading={saving} className="w-full">
            保存 AI 配置
          </Button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-red-200 dark:border-red-900">
        <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-4">危险区域</h2>
        <Button variant="danger" onClick={handleLogout} className="w-full">
          退出登录
        </Button>
      </div>
    </div>
  );
}