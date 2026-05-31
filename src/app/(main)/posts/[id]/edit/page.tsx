"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect, useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, Image, Video } from "lucide-react";
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
  mediaUrls: string | null;
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
  const [isDragging, setIsDragging] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [originalMediaUrl, setOriginalMediaUrl] = useState<string | null>(null);

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
        if (postData.mediaUrls) {
          const urls = JSON.parse(postData.mediaUrls);
          if (urls.length > 0) {
            setMediaPreview(urls[0]);
            setOriginalMediaUrl(urls[0]);
          }
        }
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

  // 生成缩略图
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
    
    if (file.size > 10 * 1024 * 1024) {
      addToast({ type: "error", message: "文件大小不能超过 10MB" });
      return;
    }
    
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      addToast({ type: "error", message: "请上传图片或视频文件" });
      return;
    }
    
    setMediaFile(file);
    const thumbnail = await generateThumbnail(file);
    setMediaPreview(thumbnail);
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
      // 如果有新文件，先上传
      let mediaUrls: string[] = [];
      
      if (mediaFile) {
        // 上传新文件
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
      } else if (mediaPreview && mediaPreview !== originalMediaUrl) {
        // 使用 base64 缩略图（编辑后未上传新文件）
        mediaUrls = [mediaPreview];
      } else if (originalMediaUrl) {
        // 保留原文件
        mediaUrls = [originalMediaUrl];
      }
      
      const res = await fetch(`/api/posts/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          mediaUrls,
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
            onClick={() => document.getElementById("media-upload-edit")?.click()}
          >
            <input
              id="media-upload-edit"
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
            {mediaPreview ? (
              <div className="relative">
                <img src={mediaPreview} alt="Preview" className="max-h-40 mx-auto rounded-lg" />
                <button
                  onClick={(e) => { e.stopPropagation(); setMediaPreview(null); setMediaFile(null); setOriginalMediaUrl(null); }}
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
