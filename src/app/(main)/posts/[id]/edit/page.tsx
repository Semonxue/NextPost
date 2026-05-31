"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect, useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useUIStore } from "@/stores/uiStore";

interface Account {
  id: string;
  name: string;
  handle: string;
}

interface Post {
  id: string;
  content: string;
  accountId: string;
  scheduledTime: string | null;
  timezone: string;
  status: string;
}

export default function EditPostPage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const { addToast } = useUIStore();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [post, setPost] = useState<Post | null>(null);
  const [formData, setFormData] = useState({
    accountId: "",
    content: "",
    scheduledTime: "",
    timezone: "Asia/Shanghai",
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/login");
    }
    if (status === "authenticated") {
      fetchData();
    }
  }, [status]);

  const fetchData = async () => {
    try {
      const [accountsRes, postRes] = await Promise.all([
        fetch("/api/accounts"),
        fetch(`/api/posts/${params.id}`),
      ]);

      if (accountsRes.ok) {
        setAccounts(await accountsRes.json());
      }

      if (postRes.ok) {
        const postData = await postRes.json();
        setPost(postData);
        setFormData({
          accountId: postData.accountId,
          content: postData.content,
          scheduledTime: postData.scheduledTime ? new Date(postData.scheduledTime).toISOString().slice(0, 16) : "",
          timezone: postData.timezone,
        });
      } else {
        addToast({ type: "error", message: "帖子不存在" });
        router.push("/posts");
      }
    } catch (error) {
      console.error("获取数据失败:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.accountId) {
      addToast({ type: "error", message: "请选择账号" });
      return;
    }

    if (!formData.content.trim()) {
      addToast({ type: "error", message: "请输入内容" });
      return;
    }

    setSaving(true);

    try {
      const res = await fetch(`/api/posts/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          scheduledTime: formData.scheduledTime || null,
          status: formData.scheduledTime ? "scheduled" : "draft",
        }),
      });

      if (res.ok) {
        addToast({ type: "success", message: "帖子已更新" });
        router.push("/posts");
      } else {
        const data = await res.json();
        addToast({ type: "error", message: data.error || "更新失败" });
      }
    } catch {
      addToast({ type: "error", message: "更新失败" });
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/posts" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
          <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">编辑帖子</h1>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            选择账号
          </label>
          <select
            value={formData.accountId}
            onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                @{account.handle} ({account.name})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            内容
          </label>
          <textarea
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows={6}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              发布时间
            </label>
            <div className="relative">
              <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="datetime-local"
                value={formData.scheduledTime}
                onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              时区
            </label>
            <select
              value={formData.timezone}
              onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="Asia/Shanghai">Asia/Shanghai (UTC+8)</option>
              <option value="America/New_York">America/New_York (UTC-5)</option>
              <option value="Europe/London">Europe/London (UTC+0)</option>
              <option value="Asia/Tokyo">Asia/Tokyo (UTC+9)</option>
            </select>
          </div>
        </div>

        <div className="flex gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="secondary" onClick={() => router.push("/posts")} className="flex-1">
            取消
          </Button>
          <Button onClick={handleSubmit} loading={saving} className="flex-1">
            保存更改
          </Button>
        </div>
      </div>
    </div>
  );
}