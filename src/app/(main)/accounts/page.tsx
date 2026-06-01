"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Plus, Edit2, Trash2, Globe } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useUIStore } from "@/stores/uiStore";

interface Account {
  id: string;
  name: string;
  handle: string;
  description?: string;
  platform: { name: string; icon?: string };
}

export default function AccountsPage() {
  const { data: session, status } = useSession();
  const { addToast } = useUIStore();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [formData, setFormData] = useState({ name: "", handle: "", description: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/login");
    }
    if (status === "authenticated") {
      fetchAccounts();
    }
  }, [status]);

  const fetchAccounts = async () => {
    try {
      const res = await fetch("/api/accounts");
      if (res.ok) {
        const data = await res.json();
        setAccounts(data);
      }
    } catch (error) {
      console.error("获取账号失败:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 客户端验证
    if (!formData.name.trim() || !formData.handle.trim()) {
      addToast({ type: "error", message: "名称和handle不能为空" });
      return;
    }
    
    setSaving(true);

    try {
      const url = editingAccount ? `/api/accounts/${editingAccount.id}` : "/api/accounts";
      const method = editingAccount ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        addToast({ type: "success", message: editingAccount ? "账号已更新" : "账号已创建" });
        fetchAccounts();
        setModalOpen(false);
        setEditingAccount(null);
        setFormData({ name: "", handle: "", description: "" });
      } else {
        const data = await res.json();
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
    setFormData({ name: account.name, handle: account.handle, description: account.description || "" });
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
        <Button onClick={() => { setEditingAccount(null); setFormData({ name: "", handle: "", description: "" }); setModalOpen(true); }}>
          <Plus size={20} className="mr-2" />
          添加账号
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.length === 0 ? (
            <div className="col-span-full bg-white dark:bg-gray-800 rounded-xl p-8 text-center border border-gray-200 dark:border-gray-700">
              <Globe className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">暂无账号</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">添加你的第一个社交媒体账号开始使用</p>
            <Button onClick={() => setModalOpen(true)}>
              <Plus size={20} className="mr-2" />
              添加账号
            </Button>
          </div>
        ) : (
          accounts.map((account) => (
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
REPLACE

                </div>
              </div>
              {account.description && (
                <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">{account.description}</p>
              )}
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <span className="text-xs text-gray-500 dark:text-gray-400">{account.platform?.name || "Twitter"}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingAccount ? "编辑账号" : "添加账号"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="账号名称"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="例如：我的小号"
          />
          <Input
            label="Twitter Handle"
            value={formData.handle}
            onChange={(e) => setFormData({ ...formData, handle: e.target.value })}
            placeholder="例如：username"
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