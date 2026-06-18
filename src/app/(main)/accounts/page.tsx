"use client";
import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Plus, Edit2, Trash2, Globe, Search, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useUIStore } from "@/stores/uiStore";
import { getPlatformBadgeClasses, getPlatformStyle } from "@/lib/platform-style";
interface Account {
  id: string;
  name: string;
  handle: string;
  description?: string;
  platform: { id: string; name: string; icon?: string };
}
interface Platform {
  id: string;
  name: string;
  icon?: string;
  config?: { maxContentLength: number; maxImages: number; maxVideos: number; allowMixedMedia: boolean } | null;
}
export default function AccountsPage() {
  const { data: session, status } = useSession();
  const { addToast } = useUIStore();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [formData, setFormData] = useState({ name: "", handle: "", description: "", platformId: "" });
  const [saving, setSaving] = useState(false);
  // 平台筛选 + 搜索（v0.5.1 新增）
  const [platformFilter, setPlatformFilter] = useState<string>(""); // "" = 全部
  const [searchQuery, setSearchQuery] = useState("");

  // 过滤后的账号列表
  const filteredAccounts = useMemo(() => {
    return accounts.filter((a) => {
      if (platformFilter && a.platform?.id !== platformFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return (
          a.name.toLowerCase().includes(q) ||
          a.handle.toLowerCase().includes(q) ||
          (a.description || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [accounts, platformFilter, searchQuery]);
  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/login");
    }
    if (status === "authenticated") {
      fetchAccounts();
      fetchPlatforms();
    }
  }, [status]);
  const fetchAccounts = async () => {
    try {
      const res = await fetch("/api/accounts");
      if (res.ok) {
        const data = await res.json() as { accounts?: Account[] };
        setAccounts(data.accounts || []);
      }
    } catch (error) {
      console.error("获取账号失败:", error);
    } finally {
      setLoading(false);
    }
  };
  const fetchPlatforms = async () => {
    try {
      const res = await fetch("/api/platforms");
      if (res.ok) {
        const data = await res.json() as { platforms?: Platform[] };
        setPlatforms(data.platforms || []);
        // 默认选第一个平台（创建账号时）
        setFormData((prev) => prev.platformId ? prev : { ...prev, platformId: data.platforms?.[0]?.id || "" });
      }
    } catch (error) {
      console.error("获取平台列表失败:", error);
    }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 客户端验证
    if (!formData.name.trim() || !formData.handle.trim()) {
      addToast({ type: "error", message: "名称和handle不能为空" });
      return;
    }
    if (!editingAccount && !formData.platformId) {
      addToast({ type: "error", message: "请选择平台" });
      return;
    }

    setSaving(true);
    try {
      const url = editingAccount ? `/api/accounts/${editingAccount.id}` : "/api/accounts";
      const method = editingAccount ? "PATCH" : "POST";
      // 编辑时不传 platformId（平台绑定后不允许改）
      const body = editingAccount
        ? { name: formData.name, handle: formData.handle, description: formData.description }
        : { ...formData };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        addToast({ type: "success", message: editingAccount ? "账号已更新" : "账号已创建" });
        fetchAccounts();
        setModalOpen(false);
        setEditingAccount(null);
        setFormData({ name: "", handle: "", description: "", platformId: platforms[0]?.id || "" });
      } else {
        const data = await res.json() as { error?: string };
        addToast({ type: "error", message: data.error || "操作失败" });
      }
    } catch (error) {
      addToast({ type: "error", message: "操作失败" });
    } finally {
      setSaving(false);
    }
  };
  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个账号吗？")) return;
    try {
      const res = await fetch(`/api/accounts/${id}`, { method: "DELETE" });
      if (res.ok) {
        addToast({ type: "success", message: "账号已删除" });
        fetchAccounts();
      }
    } catch {
      addToast({ type: "error", message: "删除失败" });
    }
  };
  const openEditModal = (account: Account) => {
    setEditingAccount(account);
    setFormData({ name: account.name, handle: account.handle, description: account.description || "", platformId: "" });
    setModalOpen(true);
  };
  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">账号管理</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">管理你的社交媒体账号</p>
        </div>
        <Button onClick={() => { setEditingAccount(null); setFormData({ name: "", handle: "", description: "", platformId: platforms[0]?.id || "" }); setModalOpen(true); }}>
          <Plus size={20} className="mr-2" />
          添加账号
        </Button>
      </div>

      {/* 筛选 + 搜索（v0.5.1 新增） */}
      <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索账号名 / handle / 描述"
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-xs text-gray-500 dark:text-gray-400">平台：</span>
          <button
            onClick={() => setPlatformFilter("")}
            className={`px-2 py-1 text-xs rounded ${
              platformFilter === ""
                ? "bg-blue-600 text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            全部 ({accounts.length})
          </button>
          {platforms.map((p) => {
            const count = accounts.filter((a) => a.platform?.id === p.id).length;
            if (count === 0) return null; // 平台无账号就不显示
            return (
              <button
                key={p.id}
                onClick={() => setPlatformFilter(p.id)}
                className={`px-2 py-1 text-xs rounded ${
                  platformFilter === p.id
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                {getPlatformStyle(p.name).label} ({count})
              </button>
            );
          })}
        </div>
        {(platformFilter || searchQuery) && (
          <button
            onClick={() => { setPlatformFilter(""); setSearchQuery(""); }}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1"
          >
            <X size={12} /> 清除
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(() => {
          if (accounts.length === 0) {
            return (
              <div className="col-span-full bg-white dark:bg-gray-800 rounded-xl p-8 text-center border border-gray-200 dark:border-gray-700">
                <Globe className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">暂无账号</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">添加你的第一个社交媒体账号开始使用</p>
                <Button onClick={() => setModalOpen(true)}>
                  <Plus size={20} className="mr-2" />
                  添加账号
                </Button>
              </div>
            );
          }
          if (filteredAccounts.length === 0) {
            return (
              <div className="col-span-full bg-white dark:bg-gray-800 rounded-xl p-8 text-center border border-gray-200 dark:border-gray-700">
                <p className="text-gray-500 dark:text-gray-400">没有匹配的账号</p>
              </div>
            );
          }
          return filteredAccounts.map((account) => (
            <div
              key={account.id}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Globe className="text-blue-500" size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{account.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">@{account.handle}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEditModal(account)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <Edit2 size={16} className="text-gray-500" />
                  </button>
                  <button
                    onClick={() => handleDelete(account.id)}
                    data-testid="delete-account-button"
                    aria-label="删除账号"
                    className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} className="text-red-500" />
                  </button>
                </div>
              </div>
              {account.description && (
                <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">{account.description}</p>
              )}
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <span className={getPlatformBadgeClasses(account.platform?.name)}>
                  <span aria-hidden>{getPlatformStyle(account.platform?.name).label}</span>
                </span>
              </div>
            </div>
          ));
        })()}
      </div>
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingAccount ? "编辑账号" : "添加账号"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {editingAccount ? (
            // 编辑时显示当前平台（不可改）
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">平台</label>
              <div className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 text-sm">
                {getPlatformStyle(editingAccount.platform?.name).label || "—"}
                <span className="ml-2 text-xs text-gray-400">（平台不可修改）</span>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">平台</label>
              <select
                value={formData.platformId}
                onChange={(e) => setFormData({ ...formData, platformId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">请选择平台</option>
                {platforms.map((p) => (
                  <option key={p.id} value={p.id}>{getPlatformStyle(p.name).label}</option>
                ))}
              </select>
            </div>
          )}
          <Input
            label="账号名称"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="例如：我的小号"
          />
          <Input
            label="账号 ID"
            value={formData.handle}
            onChange={(e) => setFormData({ ...formData, handle: e.target.value })}
            placeholder="各平台的用户名 / 用户ID / 小红书号 等"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">描述（可选）</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="添加备注..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              rows={3}
            />
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)} className="flex-1">
              取消
            </Button>
            <Button type="submit" loading={saving} className="flex-1">
              {editingAccount ? "保存" : "创建"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}