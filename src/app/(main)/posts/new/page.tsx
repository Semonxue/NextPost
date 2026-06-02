"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useSession } from "next-auth/react";
import { redirect, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { MediaUploader } from "@/components/MediaUploader";
import { ContentEditor } from "@/components/ContentEditor";
import { useUIStore } from "@/stores/uiStore";
import { PlatformConfig, DEFAULT_PLATFORM_CONFIG } from "@/lib/platform";
// 禁用静态生成
export const dynamic = "force-dynamic";
interface Account {
  id: string;
  name: string;
  handle: string;
  platform?: {
    id: string;
    name: string;
  };
}
function NewPostContent() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useUIStore();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig | null>(null);
  const [formData, setFormData] = useState({
    accountId: "",
    content: "",
    scheduledTime: "",
    timezone: "Asia/Shanghai",
  });
  const [saving, setSaving] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [existingMediaUrls, setExistingMediaUrls] = useState<string[]>([]);
  const [mediaThumbnails, setMediaThumbnails] = useState<string[]>([]);
  // 默认平台配置
  const defaultConfig: PlatformConfig = {
    platformId: "",
    platformName: "Twitter",
    ...DEFAULT_PLATFORM_CONFIG.Twitter,
  };
  // 设置默认发布时间为24小时后，或使用URL参数中的日期
  useEffect(() => {
    const dateParam = searchParams.get("date");
    
    if (dateParam) {
      // 如果URL有date参数，使用该日期（默认时间为当天9:00）
      const date = new Date(dateParam);
      date.setHours(9, 0, 0, 0);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      setFormData(prev => ({ ...prev, scheduledTime: `${year}-${month}-${day}T${hours}:${minutes}` }));
    } else {
      // 默认设置为24小时后
      const tomorrow = new Date();
      tomorrow.setHours(tomorrow.getHours() + 24);
      const year = tomorrow.getFullYear();
      const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const day = String(tomorrow.getDate()).padStart(2, '0');
      const hours = String(tomorrow.getHours()).padStart(2, '0');
      const minutes = String(tomorrow.getMinutes()).padStart(2, '0');
      setFormData(prev => ({ ...prev, scheduledTime: `${year}-${month}-${day}T${hours}:${minutes}` }));
    }
  }, [searchParams]);
  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/login");
    }
    if (status === "authenticated") {
      fetchAccounts();
    }
  }, [status]);
  // 获取账号列表
  const fetchAccounts = async () => {
    try {
      const res = await fetch("/api/accounts");
      if (res.ok) {
        const data = await res.json();
        setAccounts(data);
        if (data.length > 0) {
          setFormData((prev) => ({ ...prev, accountId: data[0].id }));
          fetchPlatformConfig(data[0].id);
        }
      }
    } catch (error) {
      console.error("获取账号失败:", error);
    }
  };
  // 获取平台配置
  const fetchPlatformConfig = async (accountId: string) => {
    try {
      const res = await fetch(`/api/accounts/${accountId}/config`);
      if (res.ok) {
        const config = await res.json();
        setPlatformConfig(config);
      } else {
        // 使用默认配置
        const account = accounts.find((a) => a.id === accountId);
        const platformName = account?.platform?.name || "Twitter";
        setPlatformConfig({
          platformId: account?.platform?.id || "",
          platformName,
          ...DEFAULT_PLATFORM_CONFIG[platformName as keyof typeof DEFAULT_PLATFORM_CONFIG] || DEFAULT_PLATFORM_CONFIG.Twitter,
        });
      }
    } catch (error) {
      console.error("获取平台配置失败:", error);
    }
  };
  // 账号变更时获取新的平台配置
  const handleAccountChange = (accountId: string) => {
    setFormData((prev) => ({ ...prev, accountId }));
    fetchPlatformConfig(accountId);
  };
  // 媒体变更处理
  const handleMediaChange = useCallback((urls: string[], files: File[]) => {
    setExistingMediaUrls(urls);
    setMediaFiles(files);
  }, []);
  const handleSubmit = async (asDraft: boolean) => {
    if (!formData.accountId) {
      addToast({ type: "error", message: "请选择账号" });
      return;
    }
    if (!formData.content.trim()) {
      addToast({ type: "error", message: "请输入内容" });
      return;
    }
    // 检查文字长度
    if (platformConfig) {
      const { calculateContentLength } = await import("@/lib/platform");
      const contentLength = calculateContentLength(formData.content);
      if (contentLength > platformConfig.maxContentLength) {
        addToast({ type: "error", message: `内容超出限制，请控制在 ${platformConfig.maxContentLength} 字符以内` });
        return;
      }
    }
    setSaving(true);
    try {
      // 如果有新文件，先上传
      let mediaUrls: string[] = [...existingMediaUrls];
      let mediaThumbnailsResult: string[] = [...mediaThumbnails];
      
      for (const file of mediaFiles) {
        const uploadFormData = new FormData();
        uploadFormData.append("file", file);
        
        const uploadRes = await fetch("/api/media/upload", {
          method: "POST",
          body: uploadFormData,
        });
        
        if (!uploadRes.ok) {
          const error = await uploadRes.json();
          addToast({ type: "error", message: error.error || "上传失败" });
          setSaving(false);
          return;
        }
        
        const uploadData = await uploadRes.json();
        mediaUrls.push(uploadData.url);
        // 保存服务端生成的缩略图 URL
        if (uploadData.thumbnailUrl) {
          mediaThumbnailsResult.push(uploadData.thumbnailUrl);
        }
      }
      
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          mediaUrls,
          mediaThumbnails: mediaThumbnailsResult,
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
            onChange={(e) => handleAccountChange(e.target.value)}
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
          <ContentEditor
            platformConfig={platformConfig || defaultConfig}
            value={formData.content}
            onChange={(content) => setFormData((prev) => ({ ...prev, content }))}
            placeholder="输入你的帖子内容..."
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
          <MediaUploader
            platformConfig={platformConfig || defaultConfig}
            onChange={handleMediaChange}
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
// 主页面组件，用 Suspense 包裹
export default function NewPostPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    }>
      <NewPostContent />
    </Suspense>
  );
}