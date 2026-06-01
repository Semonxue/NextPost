"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect, useRouter, useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const { addToast } = useUIStore();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [formData, setFormData] = useState({
    accountId: "",
    content: "",
    scheduledTime: "",
    timezone: "Asia/Shanghai",
  });
  const [saving, setSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

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
      // 如果有新文件，先上传
      let mediaUrls: string[] = [];
      if (mediaFile) {
        const uploadFormData = new FormData();
        uploadFormData.append("file", mediaFile);
        
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
        mediaUrls = [uploadData.url];
      } else if (mediaPreview && mediaPreview.startsWith("/uploads/")) {
        // 如果是已上传的文件，使用已有URL
        mediaUrls = [mediaPreview];
      }
      
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          mediaUrls,
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

  // 生成缩略图（用于预览）
  const generateThumbnail = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new window.Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            const maxSize = 200;
            let width = img.width;
            let height = img.height;
            
            if (width > height) {
              if (width > maxSize) {
                height = (height * maxSize) / width;
                width = maxSize;
              }
            } else {
              if (height > maxSize) {
                width = (width * maxSize) / height;
                height = maxSize;
              }
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx?.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL("image/jpeg", 0.7));
          };
          img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
      } else if (file.type.startsWith("video/")) {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.muted = true;
        video.playsInline = true;
        
        const reader = new FileReader();
        reader.onload = (e) => {
          video.src = e.target?.result as string;
        };
        
        video.onloadeddata = () => {
          video.currentTime = 0.1;
        };
        
        video.onseeked = () => {
          const canvas = document.createElement("canvas");
          const maxSize = 200;
          let width = video.videoWidth;
          let height = video.videoHeight;
          
          if (width > height) {
            if (width > maxSize) {
              height = (height * maxSize) / width;
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = (width * maxSize) / height;
              height = maxSize;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(video, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.7));
        };
        
        reader.readAsDataURL(file);
      } else {
        resolve("");
      }
    });
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    
    // 检查文件大小（10MB）
    if (file.size > 10 * 1024 * 1024) {
      addToast({ type: "error", message: "文件大小不能超过 10MB" });
      return;
    }
    
    // 检查文件类型
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      addToast({ type: "error", message: "请上传图片或视频文件" });
      return;
    }
    
    setMediaFile(file);
    
    // 生成缩略图用于预览
    const thumbnail = await generateThumbnail(file);
    setMediaPreview(thumbnail);
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
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              isDragging
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                : "border-gray-300 dark:border-gray-600 hover:border-blue-500"
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFileUpload(e.dataTransfer.files);
            }}
            onClick={() => document.getElementById('media-upload')?.click()}
          >
            <input
              id="media-upload"
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
            {mediaPreview ? (
              <div className="relative">
                <img src={mediaPreview} alt="Preview" className="max-h-40 mx-auto rounded-lg" />
                <button
                  onClick={(e) => { e.stopPropagation(); setMediaPreview(null); setMediaFile(null); }}
                  className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full text-xs"
                >
                  ✕
                </button>
              </div>
            ) : (
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
            )}
          </div>
          {mediaFile && (
            <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
              已选择: {mediaFile.name} (提交时会自动上传)
            </p>
          )}
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
