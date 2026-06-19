"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Image, Video, X, Upload, AlertCircle } from "lucide-react";
import { MediaItem, PlatformConfig, formatFileSize, isImageFile, isVideoFile } from "@/lib/platform";
import { useUIStore } from "@/stores/uiStore";
import { MediaPreview } from "@/components/MediaPreview";

interface MediaUploaderProps {
  platformConfig: PlatformConfig;
  initialUrls?: string[];
  initialThumbnails?: string[]; // 服务端生成的缩略图 URL 数组
  onChange: (uploadedUrls: string[], uploadedThumbnails: string[], pendingFiles: File[]) => void;
  maxFileSize?: number; // 默认 10MB
}

export function MediaUploader({
  platformConfig,
  initialUrls = [],
  initialThumbnails = [],
  onChange,
  maxFileSize = 10 * 1024 * 1024,
}: MediaUploaderProps) {
  const { addToast } = useUIStore();
  const [isDragging, setIsDragging] = useState(false);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>(() => {
    // 初始化已有媒体 - 编辑界面显示原图，缩略图仅用于列表等轻量场景
    return initialUrls.map((url, index) => ({
      id: `initial-${index}`,
      preview: url, // 始终使用原图作为预览（编辑界面需要看到原图）
      url,
      thumbnailUrl: initialThumbnails[index] || "", // 服务端缩略图仅存储，不用于预览
      type: url.match(/\.(mp4|webm|ogg|mov)$/i) ? "video" : "image",
    }));
  });

  // 生成缩略图
  const generateThumbnail = useCallback(
    (file: File): Promise<string> => {
      return new Promise((resolve) => {
        if (isImageFile(file)) {
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
        } else if (isVideoFile(file)) {
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
    },
    []
  );

  // 用 ref 记录上一次的 mediaItems，避免 useEffect 初始化时重复通知
  const prevMediaItemsRef = useRef<MediaItem[] | null>(null);

  // 当 mediaItems 变化时，通过 useEffect 通知父组件（避免在 setState updater 中触发父组件更新）
  useEffect(() => {
    // 跳过首次渲染（初始化不需要通知父组件）
    if (prevMediaItemsRef.current === null) {
      prevMediaItemsRef.current = mediaItems;
      return;
    }
    prevMediaItemsRef.current = mediaItems;
    const uploadedUrls = mediaItems.filter((m) => m.url).map((m) => m.url as string);
    const uploadedThumbnails = mediaItems.filter((m) => m.url).map((m) => (m.thumbnailUrl ?? m.url) as string);
    // 只传还没有 URL 的文件（已上传的不要在提交时重复上传）
    const pendingFiles = mediaItems.filter((m) => m.file && !m.url).map((m) => m.file!);
    onChange(uploadedUrls, uploadedThumbnails, pendingFiles);
  }, [mediaItems, onChange]);

  // 处理文件选择
  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const fileArray = Array.from(files);
      // 使用本地累积列表跟踪新增项，避免 React 异步 state 导致闭包陈旧值
      const newItems: MediaItem[] = [];
      // 动态计数，在循环中累加
      let imageCount = mediaItems.filter((m) => m.type === "image").length;
      let videoCount = mediaItems.filter((m) => m.type === "video").length;
      const hasExistingImages = mediaItems.some((m) => m.type === "image");

      for (const file of fileArray) {
        // 检查文件大小
        if (file.size > maxFileSize) {
          addToast({ type: "error", message: `${file.name} 超过 ${formatFileSize(maxFileSize)} 限制` });
          continue;
        }

        // 检查文件类型
        if (!isImageFile(file) && !isVideoFile(file)) {
          addToast({ type: "error", message: `${file.name} 格式不支持` });
          continue;
        }

        const type = isImageFile(file) ? "image" : "video";

        // 检查数量限制（使用动态计数）
        if (type === "image" && imageCount >= platformConfig.maxImages) {
          addToast({ type: "error", message: `最多只能上传 ${platformConfig.maxImages} 张图片` });
          continue;
        }

        if (type === "video" && videoCount >= platformConfig.maxVideos) {
          addToast({ type: "error", message: `最多只能上传 ${platformConfig.maxVideos} 个视频` });
          continue;
        }

        // 检查混合媒体限制
        if (type === "video" && (hasExistingImages || imageCount > 0) && !platformConfig.allowMixedMedia) {
          addToast({ type: "error", message: `该平台不支持图片和视频混合上传` });
          continue;
        }

        // 生成本地预览缩略图（立即显示，提升 UX）
        const thumbnail = await generateThumbnail(file);
        const itemId = `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newItem: MediaItem = {
          id: itemId,
          preview: thumbnail,
          file,
          type,
          name: file.name,
          size: file.size,
        };

        // 后台上传，上传成功后用服务端 URL 替换预览
        uploadToServer(file, itemId);

        newItems.push(newItem);
        // 更新动态计数
        if (type === "image") imageCount++;
        else videoCount++;
      }

      if (newItems.length === 0) return;

      // 合并新项到 state（useEffect 会自动通知父组件）
      setMediaItems((prev) => [...prev, ...newItems]);
    },
    [mediaItems, platformConfig, maxFileSize, generateThumbnail, addToast]
  );

  // 后台上传文件到服务器，上传成功后更新 item.preview 为服务端 URL
  // 这样 img src 会从 base64 data URL 切换到 /api/uploads/...，便于 E2E 测试验证
  const uploadToServer = useCallback(
    (file: File, itemId: string) => {
      const formData = new FormData();
      formData.append("file", file);

      fetch("/api/media/upload", { method: "POST", body: formData })
        .then((res) => {
          if (!res.ok) throw new Error("上传失败");
          return res.json() as Promise<{ url: string; thumbnailUrl: string }>;
        })
        .then((data) => {
          // 上传成功：用服务端 URL 替换本地 base64 预览
          setMediaItems((prev) =>
            prev.map((item) =>
              item.id === itemId
                ? { ...item, preview: data.url, url: data.url, thumbnailUrl: data.thumbnailUrl }
                : item
            )
          );
        })
        .catch((err) => {
          console.error("媒体上传失败:", err);
          addToast({ type: "error", message: "媒体上传失败" });
        });
    },
    [addToast]
  );

  // 删除媒体项
  const handleRemove = useCallback(
    (id: string) => {
      // 直接更新 state，useEffect 会自动通知父组件
      setMediaItems((prev) => prev.filter((m) => m.id !== id));
    },
    []
  );

  // 拖拽事件
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  // 统计
  const currentImages = mediaItems.filter((m) => m.type === "image").length;
  const currentVideos = mediaItems.filter((m) => m.type === "video").length;
  const canAddMoreImages = currentImages < platformConfig.maxImages;
  const canAddMoreVideos = currentVideos < platformConfig.maxVideos;
  const canAddMore = canAddMoreImages || canAddMoreVideos;
  const remainingImages = platformConfig.maxImages - currentImages;
  const remainingVideos = platformConfig.maxVideos - currentVideos;

  return (
    <div className="space-y-3">
      {/* 已上传的媒体预览 */}
      {mediaItems.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {mediaItems.map((item) => (
            <div key={item.id} className="relative group">
              <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                {item.type === "video" ? (
                  <MediaPreview
                    src={item.preview}
                    type="video"
                    className="w-full h-full"
                    imgClassName="w-full h-full object-cover"
                    showPlayIcon={true}
                  />
                ) : (
                  <img
                    src={item.preview}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                )}
                {item.file && item.type === "video" && (
                  <span className="absolute bottom-1 left-1 text-xs bg-black/50 text-white px-1 rounded z-10">
                    {formatFileSize(item.size || 0)}
                  </span>
                )}
              </div>
              <button
                onClick={() => handleRemove(item.id)}
                className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={14} />
              </button>
              {item.name && (
                <p className="mt-1 text-xs text-gray-500 truncate" title={item.name}>
                  {item.name}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 上传区域 */}
      {canAddMore && (
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
            isDragging
              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
              : "border-gray-300 dark:border-gray-600 hover:border-blue-500"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById("media-upload-multiple")?.click()}
        >
          <input
            id="media-upload-multiple"
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <div className="flex flex-col items-center gap-2">
            <div className="flex gap-4">
              <Image size={28} className="text-gray-400" />
              <Video size={28} className="text-gray-400" />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              点击上传或拖拽图片/视频到这里
            </p>
            <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-500">
              {canAddMoreImages && <span>图片 ({remainingImages}/{platformConfig.maxImages})</span>}
              {canAddMoreVideos && <span>视频 ({remainingVideos}/{platformConfig.maxVideos})</span>}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              支持 JPG, PNG, GIF, MP4（最大 10MB）
            </p>
          </div>
        </div>
      )}

      {/* 限制提示 */}
      {(currentImages >= platformConfig.maxImages || currentVideos >= platformConfig.maxVideos) && (
        <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
          <AlertCircle size={16} />
          <span>
            {currentImages >= platformConfig.maxImages && `图片已达上限 (${platformConfig.maxImages})`}
            {currentImages >= platformConfig.maxImages && currentVideos >= platformConfig.maxVideos && "，"}
            {currentVideos >= platformConfig.maxVideos && `视频已达上限 (${platformConfig.maxVideos})`}
          </span>
        </div>
      )}
    </div>
  );
}