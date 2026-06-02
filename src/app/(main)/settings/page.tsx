"use client";
import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Key, User, Plus, Trash2, Copy, Eye, Pencil, Check, Filter, BarChart3, Settings2, RefreshCw, Database } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useUIStore } from "@/stores/uiStore";

interface ExternalApiKey {
  id: string;
  name: string;
  permissions: string;
  keyPreview: string;
  createdAt: string;
}

interface MediaStats {
  totalSize: number;
  images: { count: number; size: number };
  videos: { count: number; size: number };
}

interface ThumbnailStats {
  count: number;
  size: number;
}

interface Stats {
  accounts: number;
  posts: number;
  postsByStatus: {
    draft: number;
    scheduled: number;
    published: number;
    failed: number;
  };
  media: number;
  mediaStats: MediaStats;
  thumbnailStats: ThumbnailStats;
  categories: {
    name: string;
    count: number;
  }[];
}

// 格式化字节大小
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
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
type TabType = "profile" | "apikeys" | "maintenance" | "stats";

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const { addToast } = useUIStore();
  const [activeTab, setActiveTab] = useState<TabType>("profile");
  const [loading, setLoading] = useState(true);
  const [externalKeys, setExternalKeys] = useState<ExternalApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyScope, setNewKeyScope] = useState<"read" | "read_write">("read_write");
  const [creating, setCreating] = useState(false);
  const [showNewKey, setShowNewKey] = useState<string | null>(null);
  const [keyFilter, setKeyFilter] = useState<FilterMode>("all");
  
  // 数据维护
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateProgress, setRegenerateProgress] = useState(0);
  
  // 统计
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

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
      const keysRes = await fetch("/api/settings/external-keys");
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

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const res = await fetch("/api/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error("获取统计失败:", error);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "stats" && !stats) {
      fetchStats();
    }
  }, [activeTab]);

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

  const handleRegenerateThumbnails = async () => {
    if (!confirm("确定要重新生成所有缩略图吗？这可能需要一些时间。")) return;
    setRegenerating(true);
    setRegenerateProgress(0);
    try {
      const res = await fetch("/api/maintenance/regenerate-thumbnails", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setRegenerateProgress(100);
        addToast({ 
          type: "success", 
          message: data.message || `成功处理 ${data.processed} 个，跳过 ${data.skipped} 个，失败 ${data.failed} 个` 
        });
        // 重新获取统计
        fetchStats();
      } else {
        addToast({ type: "error", message: "重新生成缩略图失败" });
      }
    } catch {
      addToast({ type: "error", message: "重新生成缩略图失败" });
    } finally {
      setRegenerating(false);
    }
  };

  const partitionedKeys = useMemo(() => {
    const readOnly = externalKeys.filter((k) => normalizeScope(k.permissions) === "read");
    const readWrite = externalKeys.filter((k) => normalizeScope(k.permissions) === "read_write");
    const writeOnly = externalKeys.filter((k) => normalizeScope(k.permissions) === "write");
    return { readOnly, readWrite, writeOnly };
  }, [externalKeys]);

  const filteredKeys = useMemo(() => {
    if (keyFilter === "read") return partitionedKeys.readOnly;
    if (keyFilter === "read_write") return partitionedKeys.readWrite;
    return [...partitionedKeys.readOnly, ...partitionedKeys.readWrite, ...partitionedKeys.writeOnly];
  }, [keyFilter, partitionedKeys]);

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const tabs = [
    { id: "profile" as TabType, label: "用户信息", icon: User },
    { id: "apikeys" as TabType, label: "API Keys", icon: Key },
    { id: "maintenance" as TabType, label: "数据维护", icon: Database },
    { id: "stats" as TabType, label: "统计", icon: BarChart3 },
  ];

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">设置</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">管理你的账号</p>
      </div>

      {/* Tab 切换 */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 内容 */}
      {activeTab === "profile" && (
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
      )}

      {activeTab === "apikeys" && (
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

          {/* 创建新 Key */}
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

            {/* Key 类型选择 */}
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

          {/* Key 列表 */}
          {externalKeys.length > 0 ? (
            <div data-testid="external-keys-list">
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
      )}

      {activeTab === "maintenance" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <Database size={20} className="text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">数据维护</h2>
          </div>
          
          <div className="space-y-4">
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">重新生成缩略图</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    重新生成所有帖子的媒体缩略图，适用于图片更新后需要刷新缩略图的情况。
                  </p>
                </div>
                <Button
                  onClick={handleRegenerateThumbnails}
                  loading={regenerating}
                  variant="secondary"
                >
                  <RefreshCw size={16} className="mr-1" />
                  重新生成
                </Button>
              </div>
              {regenerating && (
                <div className="mt-3">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${regenerateProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">正在处理...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "stats" && (
        <div className="space-y-4">
          {statsLoading ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            </div>
          ) : stats ? (
            <>
              {/* 概览卡片 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">账号</h3>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{stats.accounts}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">帖子</h3>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{stats.posts}</p>
                </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">媒体</h3>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{stats.media}</p>
              </div>
            </div>

            {/* 存储统计 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">存储统计</h3>
                <button
                  onClick={() => fetchStats()}
                  disabled={statsLoading}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 disabled:opacity-50"
                >
                  <RefreshCw size={14} className={statsLoading ? "animate-spin" : ""} />
                  刷新
                </button>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">素材总体积</span>
                    <span className="text-lg font-bold text-gray-900 dark:text-white">
                      {formatBytes(stats.mediaStats.totalSize)}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl">🖼️</span>
                      <span className="text-sm text-blue-600 dark:text-blue-400">图片</span>
                    </div>
                    <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{stats.mediaStats.images.count} 张</p>
                    <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">
                      {formatBytes(stats.mediaStats.images.size)}
                    </p>
                  </div>
                  <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl">🎬</span>
                      <span className="text-sm text-purple-600 dark:text-purple-400">视频</span>
                    </div>
                    <p className="text-xl font-bold text-purple-700 dark:text-purple-300">{stats.mediaStats.videos.count} 个</p>
                    <p className="text-xs text-purple-500 dark:text-purple-400 mt-1">
                      {formatBytes(stats.mediaStats.videos.size)}
                    </p>
                  </div>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">📸</span>
                      <div>
                        <span className="text-sm font-medium text-green-700 dark:text-green-300">缩略图</span>
                        <p className="text-xs text-green-600 dark:text-green-400">已生成 · {stats.thumbnailStats.count} 个</p>
                      </div>
                    </div>
                    <span className="text-lg font-bold text-green-700 dark:text-green-300">
                      {formatBytes(stats.thumbnailStats.size)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

              {/* 帖子状态分布 */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">帖子状态分布</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                    <p className="text-sm text-gray-500 dark:text-gray-400">草稿</p>
                    <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">{stats.postsByStatus.draft}</p>
                  </div>
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-sm text-blue-600 dark:text-blue-400">已计划</p>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.postsByStatus.scheduled}</p>
                  </div>
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-sm text-green-600 dark:text-green-400">已发布</p>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-300">{stats.postsByStatus.published}</p>
                  </div>
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400">失败</p>
                    <p className="text-2xl font-bold text-red-700 dark:text-red-300">{stats.postsByStatus.failed}</p>
                  </div>
                </div>
              </div>

              {/* 账号统计 */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">按账号统计</h3>
                  <button
                    onClick={() => fetchStats()}
                    className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    刷新
                  </button>
                </div>
                {stats.categories.length > 0 ? (
                  <div className="space-y-2">
                    {stats.categories.map((cat, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                        <span className="text-gray-700 dark:text-gray-300">{cat.name}</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{cat.count} 帖</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                    暂无数据
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                加载统计失败，请点击刷新按钮重试
              </p>
            </div>
          )}
        </div>
      )}
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