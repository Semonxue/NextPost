"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useSession } from "next-auth/react";
import { redirect, useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, Copy, ExternalLink, Key, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { MediaUploader } from "@/components/MediaUploader";
import { ContentEditor } from "@/components/ContentEditor";
import { useUIStore } from "@/stores/uiStore";
import { PlatformConfig, DEFAULT_PLATFORM_CONFIG } from "@/lib/platform";
import { getPlatformBadgeClasses } from "@/lib/platform-style";
interface Account {
  id: string;
  name: string;
  handle: string;
  platform?: {
    id: string;
    name: string;
  };
}
interface Post {
  id: string;
  content: string;
  title?: string | null;
  accountId: string;
  scheduledTime: string | null;
  publishedAt: string | null;
  timezone: string;
  status: string;
  mediaUrls: string | null;
  mediaThumbnails: string | null;
  externalPostUrl: string | null;
  publishToken: string | null;
}
export default function EditPostPage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { addToast } = useUIStore();
  
  // 根据来源决定返回路径
  const fromCalendar = searchParams.get("from") === "calendar";
  const backUrl = fromCalendar ? "/calendar" : "/posts";
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [post, setPost] = useState<Post | null>(null);
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig | null>(null);
  const [formData, setFormData] = useState({
    accountId: "",
    content: "",
    title: "",
    scheduledTime: "",
    timezone: "Asia/Shanghai",
    status: "draft",
    externalPostUrl: "",
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [existingMediaUrls, setExistingMediaUrls] = useState<string[]>([]);
  const [mediaThumbnails, setMediaThumbnails] = useState<string[]>([]);
  // 默认平台配置
  const defaultConfig: PlatformConfig = {
    platformId: "",
    platformName: "Twitter",
    ...DEFAULT_PLATFORM_CONFIG.Twitter,
  };
  // 将 UTC Date 对象转换为指定时区的 datetime-local 格式字符串
  const formatDateTimeLocal = (date: Date, timezone: string): string => {
    try {
      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const parts = formatter.formatToParts(date);
      const getPart = (type: string) => parts.find(p => p.type === type)?.value || "";
      const year = getPart("year");
      const month = getPart("month");
      const day = getPart("day");
      const hour = getPart("hour");
      const minute = getPart("minute");
      return `${year}-${month}-${day}T${hour}:${minute}`;
    } catch {
      // 如果时区转换失败，使用本地时间
      return date.toISOString().slice(0, 16);
    }
  };
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
        const accountsData = await accountsRes.json();
        setAccounts(accountsData);
      }
      if (postRes.ok) {
        const postData = await postRes.json();
        setPost(postData);
        setFormData({
          accountId: postData.accountId,
          content: postData.content,
          title: postData.title || "",
          scheduledTime: postData.scheduledTime ? formatDateTimeLocal(new Date(postData.scheduledTime), postData.timezone) : "",
          timezone: postData.timezone,
          status: postData.status,
          externalPostUrl: postData.externalPostUrl || "",
        });
        
        // 解析已有媒体
        if (postData.mediaUrls) {
          const urls = JSON.parse(postData.mediaUrls);
          setExistingMediaUrls(urls);
        }
        
        // 解析已有缩略图
        if (postData.mediaThumbnails) {
          const thumbnails = JSON.parse(postData.mediaThumbnails);
          setMediaThumbnails(thumbnails);
        }
        
        // 获取平台配置
        fetchPlatformConfig(postData.accountId);
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
  const handleSubmit = async () => {
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
      
      // 根据状态决定 scheduledTime：只有 scheduled 状态才保留计划时间，其他状态保留原值
      let scheduledTimeValue = post?.scheduledTime || null;
      if (formData.status === "scheduled" && formData.scheduledTime) {
        scheduledTimeValue = formData.scheduledTime;
      }
      
      const res = await fetch(`/api/posts/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: formData.accountId,
          content: formData.content,
          mediaUrls,
          mediaThumbnails: mediaThumbnailsResult,
          scheduledTime: scheduledTimeValue,
          timezone: formData.timezone,
          status: formData.status,
          externalPostUrl: formData.externalPostUrl || null,
        }),
      });
      if (res.ok) {
        addToast({ type: "success", message: "帖子已更新" });
        router.push(backUrl);
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
  const handleStatusChange = (newStatus: string) => {
    setFormData({ ...formData, status: newStatus });
  };
  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  const statusOptions = [
    { value: "draft", label: "草稿", color: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300" },
    { value: "scheduled", label: "已计划", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" },
    { value: "published", label: "已发布", color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" },
  ];
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href={backUrl} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
          <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">编辑帖子</h1>
        {/* 平台标签：让用户一眼看到这个帖子发到哪个平台 */}
        {(() => {
          // 从账号列表反查当前 post 的平台
          const acc = accounts.find((a) => a.id === post?.accountId);
          if (!acc?.platform) return null;
          return (
            <span className={getPlatformBadgeClasses(acc.platform.name)}>
              <span aria-hidden>{acc.platform.name}</span>
            </span>
          );
        })()}
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 space-y-6">
        {/* 状态切换 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            帖子状态
          </label>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleStatusChange(opt.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  formData.status === opt.value
                    ? `${opt.color} ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-800`
                    : "bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600"
                }`}
              >
                {formData.status === opt.value && <RefreshCw size={14} className="inline mr-1" />}
                {opt.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            切换状态：草稿（未发布）→ 已计划（定时发布）→ 已发布（已对外发布）
          </p>
        </div>
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
            标题（可选，小红书等平台必需）
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="例如：周末探店分享"
            maxLength={20}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            小红书标题最多 20 字；其他平台可留空
          </p>
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
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            媒体（可选）
          </label>
          <MediaUploader
            platformConfig={platformConfig || defaultConfig}
            initialUrls={existingMediaUrls}
            initialThumbnails={mediaThumbnails}
            onChange={handleMediaChange}
          />
        </div>
        {/* Publish Token - 只读显示 */}
        {post?.publishToken && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Key size={14} className="inline mr-1" />
              Publish Token（MCP 发布验证用）
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded font-mono break-all text-gray-700 dark:text-gray-300">
                {post.publishToken}
              </code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(post.publishToken!);
                  addToast({ type: "success", message: "Token 已复制" });
                }}
                className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="复制 Token"
              >
                <Copy size={16} />
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              外部 MCP 客户端发布后回传结果时需要此 Token 进行验证
            </p>
          </div>
        )}
        {/* 外部链接 - 已发布帖子专用 */}
        {formData.status === "published" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <ExternalLink size={14} className="inline mr-1" />
              发布链接
            </label>
            <input
              type="url"
              value={formData.externalPostUrl}
              onChange={(e) => setFormData({ ...formData, externalPostUrl: e.target.value })}
              placeholder="https://x.com/user/status/123..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              输入发布后的外部链接，方便快速查看已发布的内容
            </p>
          </div>
        )}
        {/* 实际发布时间 - 已发布帖子显示 */}
        {formData.status === "published" && post?.publishedAt && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              实际发布时间
            </label>
            <div className="px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 text-sm">
              {new Date(post.publishedAt).toLocaleString("zh-CN", {
                timeZone: "Asia/Shanghai",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })} (北京时间)
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              这是帖子实际发布的时间，由 MCP 客户端报告
            </p>
          </div>
        )}
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
            {formData.status === "scheduled" && (
              <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                设置发布时间后，帖子将按计划发布
              </p>
            )}
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
          <Button variant="secondary" onClick={() => router.push(backUrl)} className="flex-1">
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