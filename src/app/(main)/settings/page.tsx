"use client";
import { useEffect, useState, useMemo } from "react";
import { useSession, signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import { Bot, Key, User, Plus, Trash2, Copy, Eye, Pencil, Check, Filter } from "lucide-react";
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
// 归一化 permissions 字段到 3 值之一
function normalizeScope(p: string): "read" | "write" | "read_write" {
  if (p === "read_write") return "read_write";
  if (p === "write") return "write";
  return "read";
}
// UI 显示标签 + 颜色
const SCOPE_META: Record<
  "read" | "write" | "read_write",
  { label: string; short: string; color: string; ring: string; bg: string }
> = {
  read: {
    label: "只读",
    short: "read",
    color: "text-gray-700 dark:text-gray-300",
    ring: "ring-gray-300 dark:ring-gray-600",
    bg: "bg-gray-50 dark:bg-gray-800/50",
  },
  write: {
    label: "仅写",
    short: "write",
    color: "text-orange-700 dark:text-orange-300",
    ring: "ring-orange-300 dark:ring-orange-700",
    bg: "bg-orange-50 dark:bg-orange-900/20",
  },
  read_write: {
    label: "读写",
    short: "read_write",
    color: "text-blue-700 dark:text-blue-300",
    ring: "ring-blue-500 dark:ring-blue-500",
    bg: "bg-blue-50 dark:bg-blue-900/20",
  },
};
type FilterMode = "all" | "read" | "read_write";
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
  // UI 上只暴露 2 类：只读 / 读写（write 罕见，从 UI 隐藏但后端保留）
  const [newKeyScope, setNewKeyScope] = useState<"read" | "read_write">("read_write");
  const [creating, setCreating] = useState(false);
  const [showNewKey, setShowNewKey] = useState<string | null>(null);
  // 列表过滤器
  const [keyFilter, setKeyFilter] = useState<FilterMode>("all");
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
        addToast({
          type: "success",
          message: `${SCOPE_META[newKeyScope].label} Key 已创建`,
        });
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
  // 分类 + 过滤
  const partitionedKeys = useMemo(() => {
    const readOnly = externalKeys.filter((k) => normalizeScope(k.permissions) === "read");
    const readWrite = externalKeys.filter((k) => normalizeScope(k.permissions) === "read_write");
    const writeOnly = externalKeys.filter((k) => normalizeScope(k.permissions) === "write");
    return { readOnly, readWrite, writeOnly };
  }, [externalKeys]);
  const filteredKeys = useMemo(() => {
    if (keyFilter === "read") return partitionedKeys.readOnly;
    if (keyFilter === "read_write") return partitionedKeys.readWrite;
    // "all" 显示 read + read_write；write-only 单独放在最后
    return [...partitionedKeys.readOnly, ...partitionedKeys.readWrite, ...partitionedKeys.writeOnly];
  }, [keyFilter, partitionedKeys]);
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
                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
          创建 API Key 用于外部 MCP 客户端（Claude Desktop / Cursor / Cherry Studio 等）调用 NextPost。
          Key 创建后只能查看一次，请妥善保存。
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          🔒 Key 的类型（只读 / 读写）在创建后<span className="font-semibold">不可修改</span>——
          防止手抖或被钓鱼瞬间从只读升级到读写。需要改？删除后重建。
        </p>
        {/* 创建新 Key —— 2 个大 radio card（只读 / 读写） */}
        <div className="mb-5 space-y-3" data-testid="create-key-form">
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
          {/* 类型选择：2 个大 radio card */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
              Key 类型
            </label>
            <div className="grid grid-cols-2 gap-2" data-testid="new-key-type-selector">
              <TypeRadio
                value="read"
                label="只读"
                desc="监控 / 只读面板用，可查看账号/帖子但不能改"
                icon={Eye}
                selected={newKeyScope === "read"}
                onSelect={() => setNewKeyScope("read")}
                testId="new-key-type-read"
              />
              <TypeRadio
                value="read_write"
                label="读写"
                desc="通用 AI Agent 用，可创建/更新帖子（推荐）"
                icon={Pencil}
                selected={newKeyScope === "read_write"}
                onSelect={() => setNewKeyScope("read_write")}
                testId="new-key-type-read_write"
              />
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              💡 <strong>读写</strong> 类型的 Key 才能让 AI 创建/更新帖子。详见{" "}
              <a href="/ai-tools" className="text-blue-600 hover:underline">/ai-tools 页面</a>。
            </p>
          </div>
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
        {/* Key 列表 —— 类型过滤 + 卡片化 */}
        {externalKeys.length > 0 ? (
          <div data-testid="external-keys-list">
            {/* 类型过滤分段控件 */}
            <div className="flex items-center gap-1 mb-3 p-1 bg-gray-100 dark:bg-gray-900/50 rounded-lg" data-testid="key-filter-tabs">
              <Filter size={14} className="text-gray-400 ml-2" />
              <FilterTab
                active={keyFilter === "all"}
                onClick={() => setKeyFilter("all")}
                label="全部"
                count={externalKeys.length}
                testId="filter-all"
              />
              <FilterTab
                active={keyFilter === "read"}
                onClick={() => setKeyFilter("read")}
                label="只读"
                count={partitionedKeys.readOnly.length}
                testId="filter-read"
              />
              <FilterTab
                active={keyFilter === "read_write"}
                onClick={() => setKeyFilter("read_write")}
                label="读写"
                count={partitionedKeys.readWrite.length}
                testId="filter-read_write"
              />
            </div>
            {filteredKeys.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                该类型下暂无 Key
              </p>
            ) : (
              <div className="space-y-2">
                {filteredKeys.map((key) => {
                  const currentScope = normalizeScope(key.permissions);
                  const meta = SCOPE_META[currentScope];
                  return (
                    <div
                      key={key.id}
                      className={`flex items-stretch gap-0 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 ${meta.bg}`}
                      data-testid="external-key-row"
                      data-scope={currentScope}
                    >
                      {/* 左侧类型色条 */}
                      <div
                        className={`w-1.5 shrink-0 ${
                          currentScope === "read_write"
                            ? "bg-blue-500"
                            : currentScope === "write"
                              ? "bg-orange-500"
                              : "bg-gray-400"
                        }`}
                      />
                      <div className="flex-1 min-w-0 flex items-center justify-between gap-2 p-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* 类型大标 */}
                            <span
                              data-testid="key-type-badge"
                              className={`text-xs font-semibold px-2 py-0.5 rounded shrink-0 ${meta.color} bg-white/60 dark:bg-black/20 border border-current/20`}
                            >
                              {meta.label}
                            </span>
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {key.name}
                            </p>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {new Date(key.createdAt).toLocaleDateString("zh-CN")}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {/* 类型不可改：API Key 的权限是创建时的契约，
                              要改请删除后重建。防止手抖或被钓鱼瞬间从只读升到读写。 */}
                          <button
                            onClick={() => handleRevealKey(key.id, key.name)}
                            data-testid="key-reveal-btn-row"
                            className="p-2 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg"
                            title="查看完整 Key"
                          >
                            <Key size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteKey(key.id)}
                            data-testid="key-delete-btn"
                            className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg"
                            title="删除（要改类型？删了重建）"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {/* 写-only key 提示（如果有） */}
            {partitionedKeys.writeOnly.length > 0 && keyFilter === "all" && (
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
                ⚠️ 有 {partitionedKeys.writeOnly.length} 个「仅写」Key（通过 API 创建），UI 不显示该类型但可正常管理
              </p>
            )}
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
// ===== 复用小组件 =====
function TypeRadio({
  label,
  desc,
  icon: Icon,
  selected,
  onSelect,
  testId,
}: {
  value: "read" | "read_write";
  label: string;
  desc: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  selected: boolean;
  onSelect: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={testId}
      className={`text-left p-3 rounded-lg border-2 transition-all ${
        selected
          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-500"
          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon
          size={16}
          className={selected ? "text-blue-600 dark:text-blue-400" : "text-gray-500"}
        />
        <span
          className={`text-sm font-semibold ${
            selected ? "text-blue-700 dark:text-blue-300" : "text-gray-900 dark:text-white"
          }`}
        >
          {label}
        </span>
        {selected && <Check size={14} className="text-blue-600 dark:text-blue-400 ml-auto" />}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{desc}</p>
    </button>
  );
}
function FilterTab({
  active,
  onClick,
  label,
  count,
  testId,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded transition-colors ${
        active
          ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
      }`}
    >
      {label}
      <span
        className={`text-xs px-1.5 py-0.5 rounded ${
          active
            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
            : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
