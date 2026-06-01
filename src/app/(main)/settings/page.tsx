"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import { Bot, Key, User, Plus, Trash2, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useUIStore } from "@/stores/uiStore";

interface ExternalApiKey {
  id: string;
  name: string;
  permissions: string;
  keyPreview: string;
  createdAt: string;
}

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
  const [externalKeys, setExternalKeys] = useState<ExternalApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyScope, setNewKeyScope] = useState<"read" | "write" | "read_write">("read_write");
  const [creating, setCreating] = useState(false);
  const [showNewKey, setShowNewKey] = useState<string | null>(null);

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
      const [settingsRes, keysRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/settings/external-keys")
      ]);
      
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setAiConfig({
          provider: data.aiProvider || "openai",
          apiKey: data.aiApiKey || "",
          model: data.aiModel || "gpt-4",
        });
      }
      
      if (keysRes.ok) {
        const keysData = await keysRes.json();
        setExternalKeys(keysData.keys || []);
      }
    } catch (error) {
      console.error("获取设置失败:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      addToast({ type: "error", message: "请输入 Key 名称" });
      return;
    }
    
    setCreating(true);
    try {
      const res = await fetch("/api/settings/external-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName, scope: newKeyScope }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setShowNewKey(data.key);
        setNewKeyName("");
        addToast({ type: "success", message: `API Key 已创建（${data.scope ?? newKeyScope}）` });
        fetchSettings();
      } else {
        addToast({ type: "error", message: "创建失败" });
      }
    } catch {
      addToast({ type: "error", message: "创建失败" });
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateScope = async (id: string, newScope: "read" | "write" | "read_write") => {
    try {
      const res = await fetch(`/api/settings/external-keys/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: newScope }),
      });
      if (res.ok) {
        addToast({ type: "success", message: `已更新为 ${newScope}` });
        fetchSettings();
      } else {
        const err = await res.json().catch(() => ({}));
        addToast({ type: "error", message: err.error || "更新失败" });
      }
    } catch {
      addToast({ type: "error", message: "更新失败" });
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm("确定要删除这个 API Key 吗？")) return;
    
    try {
      const res = await fetch(`/api/settings/external-keys/${id}?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        addToast({ type: "success", message: "已删除" });
        fetchSettings();
      } else {
        addToast({ type: "error", message: "删除失败" });
      }
    } catch {
      addToast({ type: "error", message: "删除失败" });
    }
  };

  const handleRevealKey = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/settings/external-keys/reveal?id=${id}`);
      if (res.ok) {
        const data = await res.json();
        setShowNewKey(data.key);
        addToast({ type: "info", message: `正在查看 ${name} 的完整 Key` });
      } else {
        addToast({ type: "error", message: "获取 Key 失败" });
      }
    } catch {
      addToast({ type: "error", message: "获取 Key 失败" });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addToast({ type: "success", message: "已复制到剪贴板" });
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

  // scope 颜色映射
  const scopeBadge: Record<string, string> = {
    read: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
    write: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    read_write: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
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

      {/* MCP API Keys */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <Key size={20} className="text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">外部 API Key（MCP）</h2>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          创建 API Key 用于外部 MCP 客户端（Claude Desktop / Cursor / Cherry Studio 等）调用 NextPost。
          Key 创建后只能查看一次，请妥善保存。
        </p>
        
        {/* 创建新 Key —— 含 scope 选择器 */}
        <div className="mb-4 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="输入 Key 名称（如 Claude Desktop）"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <Button onClick={handleCreateKey} loading={creating}>
              <Plus size={16} className="mr-1" />
              创建
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 dark:text-gray-400 shrink-0">权限：</label>
            <select
              value={newKeyScope}
              onChange={(e) => setNewKeyScope(e.target.value as "read" | "write" | "read_write")}
              data-testid="new-key-scope-select"
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="read">read — 只读（监控/面板）</option>
              <option value="write">write — 仅写（罕见）</option>
              <option value="read_write">read_write — 通用 AI Agent（推荐）</option>
            </select>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            💡 想用 AI 创建/更新帖子？选 <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">read_write</code>。
            详见 <a href="/ai-tools" className="text-blue-600 hover:underline">/ai-tools 页面</a>。
          </p>
        </div>
        
        {/* 新 Key 提示 */}
        {showNewKey && (
          <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
              ⚠️ API Key 已创建，这是唯一一次显示完整 Key，请立即复制保存！
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-white dark:bg-gray-800 p-2 rounded font-mono break-all">
                {showNewKey}
              </code>
              <Button variant="secondary" size="sm" onClick={() => copyToClipboard(showNewKey)}>
                <Copy size={14} />
              </Button>
            </div>
            <button
              onClick={() => setShowNewKey(null)}
              className="mt-2 text-xs text-yellow-600 dark:text-yellow-400 hover:underline"
            >
              关闭
            </button>
          </div>
        )}
        
        {/* Key 列表 —— 每行带 scope 选择器可改 */}
        {externalKeys.length > 0 ? (
          <div className="space-y-2" data-testid="external-keys-list">
            {externalKeys.map((key) => {
              // 后端可能返回 "read_report" 旧值，前端做归一化显示
              const currentScope = (
                key.permissions === "read_write" ? "read_write" :
                key.permissions === "write" ? "write" :
                "read"
              ) as "read" | "write" | "read_write";
              return (
                <div
                  key={key.id}
                  className="flex items-center justify-between gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  data-testid="external-key-row"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{key.name}</p>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${scopeBadge[currentScope]}`}
                      >
                        {currentScope}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {key.keyPreview} | 创建于 {new Date(key.createdAt).toLocaleDateString("zh-CN")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <select
                      value={currentScope}
                      data-testid="key-scope-select"
                      onChange={(e) => {
                        const newScope = e.target.value as "read" | "write" | "read_write";
                        if (newScope !== currentScope) {
                          if (confirm(`确定要把 "${key.name}" 的权限从 ${currentScope} 改为 ${newScope} 吗？`)) {
                            handleUpdateScope(key.id, newScope);
                          } else {
                            e.target.value = currentScope; // 还原 select
                          }
                        }
                      }}
                      className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="read">read</option>
                      <option value="write">write</option>
                      <option value="read_write">read_write</option>
                    </select>
                    <button
                      onClick={() => handleRevealKey(key.id, key.name)}
                      className="p-2 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg"
                      title="查看完整 Key"
                    >
                      <Key size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteKey(key.id)}
                      className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg"
                      title="删除"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
            暂无 API Key
          </p>
        )}
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
