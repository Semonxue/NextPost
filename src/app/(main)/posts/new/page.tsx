"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Image, Video, Calendar } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useUIStore } from "@/stores/uiStore";

interface Account {
  id: string;
  name: string;
  handle: string;
}

export default function NewPostPage() {
  const { status } = useSession();
  const router = useRouter();
  const { addToast } = useUIStore();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [formData, setFormData] = useState({
    accountId: "",
    content: "",
    scheduledTime: "",
    timezone: "Asia/Shanghai",
  });
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
        if (data.length > 0) {
          setFormData((prev) => ({ ...prev, accountId: data[0].id }));
        }
      }
    } catch (error) {
      console.error("获取账号失败:", error);
    }
  };

  const handleSubmit = async (asDraft: boolean) => {
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
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          scheduledTime: formData.scheduledTime || null,
          status: asDraft ? "draft" : formData.scheduledTime ? "scheduled" : "draft",
        }),
      });

      if (res.ok) {
        addToast({ type: "success", message: asDraft ? "草稿已保存" : "帖子已创建" });
        router.push("/posts");
      } else {
        const data = await res.json();
        addToast({ type: "error", message: data.error || "创建失败" });
      }
    } catch {
      addToast({ type: "error", message: "创建失败" });
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">请先添加账号</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">在创建帖子之前，你需要先添加一个社交媒体账号</p>
          <Link href="/accounts">
            <Button>前往添加账号</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/posts" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
          <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">新建帖子</h1>
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
            placeholder="输入你的帖子内容..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows={6}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            支持 Markdown 格式
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            媒体（可选）
          </label>
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer">
            <div className="flex flex-col items-center gap-2">
              <div className="flex gap-4">
                <Image size={32} className="text-gray-400" />
                <Video size={32} className="text-gray-400" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                点击上传或拖拽图片/视频到这里
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                支持 JPG, PNG, GIF, MP4（最大 10MB）
              </p>
            </div>
          </div>
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
          <Button
            variant="secondary"
            onClick={() => handleSubmit(true)}
            loading={saving}
            className="flex-1"
          >
            保存草稿
          </Button>
          <Button
            onClick={() => handleSubmit(false)}
            loading={saving}
            className="flex-1"
          >
            {formData.scheduledTime ? "发布计划" : "创建"}
          </Button>
        </div>
      </div>
    </div>
  );
}