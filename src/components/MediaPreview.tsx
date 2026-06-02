"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Video } from "lucide-react";
import { isVideoMimeType, isVideoUrl } from "@/lib/platform";

/**
 * 判断 src 是否指向视频
 * - data: URL 通过 mime type 判断
 * - http(s) URL 通过后缀判断
 * - 其他（如相对路径）通过后缀判断
 */
export function isVideoSource(src: string, type?: "image" | "video"): boolean {
  if (type === "video") return true;
  if (type === "image") return false;
  if (!src) return false;
  if (src.startsWith("data:")) {
    const match = /^data:([^;,]+)/.exec(src);
    if (match && isVideoMimeType(match[1])) return true;
    return false;
  }
  return isVideoUrl(src);
}

interface MediaPreviewProps {
  /** 图片或视频的 URL/dataURL */
  src?: string;
  /** 显式指定类型（不传则自动判断） */
  type?: "image" | "video";
  /** 替代文本（用于 img alt） */
  alt?: string;
  /** 自定义类名 */
  className?: string;
  /** img 元素的类名 */
  imgClassName?: string;
  /** 缩略图最大尺寸（用于 canvas 抽帧），默认 240 */
  thumbnailSize?: number;
  /** 是否覆盖整个容器（默认 true） */
  fill?: boolean;
  /** 是否显示播放按钮（仅视频） */
  showPlayIcon?: boolean;
  /** 视频未抽帧完成时显示的占位 */
  fallback?: React.ReactNode;
  /** 视频抽帧失败回调 */
  onThumbnailError?: (error: Error) => void;
}

/**
 * 通用媒体预览组件，同时支持图片和视频：
 * - 图片：直接使用 src 显示
 * - 视频：自动从视频中抽帧生成缩略图，叠加播放图标
 *
 * 用法：
 * ```tsx
 * <MediaPreview src="/uploads/xxx.mp4" />
 * <MediaPreview src="data:image/jpeg;base64,..." type="image" />
 * ```
 */
export function MediaPreview({
  src,
  type,
  alt = "",
  className = "",
  imgClassName = "w-full h-full object-cover",
  thumbnailSize = 240,
  fill = true,
  showPlayIcon = true,
  fallback,
  onThumbnailError,
}: MediaPreviewProps) {
  const safeSrc = src ?? "";
  const isVideo = isVideoSource(safeSrc, type);
  const containerClass = fill
    ? `relative w-full h-full overflow-hidden ${className}`
    : `relative overflow-hidden inline-block ${className}`;

  if (!safeSrc) {
    return (
      <div className={containerClass}>
        {fallback ?? (
          <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-700 text-gray-400">
            <Video size={24} />
          </div>
        )}
      </div>
    );
  }

  if (!isVideo) {
    return (
      <div className={containerClass}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={safeSrc} alt={alt} className={imgClassName} />
      </div>
    );
  }

  return (
    <VideoThumbnail
      src={safeSrc}
      alt={alt}
      className={className}
      imgClassName={imgClassName}
      thumbnailSize={thumbnailSize}
      fill={fill}
      showPlayIcon={showPlayIcon}
      fallback={fallback}
      onThumbnailError={onThumbnailError}
    />
  );
}

interface VideoThumbnailProps {
  src: string;
  alt?: string;
  className?: string;
  imgClassName?: string;
  thumbnailSize: number;
  fill: boolean;
  showPlayIcon: boolean;
  fallback?: React.ReactNode;
  onThumbnailError?: (error: Error) => void;
}

/**
 * 视频缩略图组件：
 * 1. 优先使用 src 作为 data:image 的 base64（即调用方已生成好的缩略图）
 * 2. 否则通过 canvas 从视频中抽帧
 * 3. 抽帧失败时显示 fallback 或视频图标
 */
function VideoThumbnail({
  src,
  alt = "",
  className = "",
  imgClassName = "w-full h-full object-cover",
  thumbnailSize = 240,
  fill = true,
  showPlayIcon = true,
  fallback,
  onThumbnailError,
}: VideoThumbnailProps) {
  // 如果 src 本身就是 data URL 且是图片（说明已是缩略图），直接显示
  const isBase64Image =
    src.startsWith("data:image/") && !src.startsWith("data:image/svg");

  const [thumbnail, setThumbnail] = useState<string>(
    isBase64Image ? src : ""
  );
  const [loading, setLoading] = useState<boolean>(!isBase64Image);
  const [error, setError] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const generatedRef = useRef<boolean>(false);

  useEffect(() => {
    // 如果是已生成的 base64 缩略图，无需抽帧
    if (isBase64Image) {
      setLoading(false);
      return;
    }

    if (typeof window === "undefined") return;

    let cancelled = false;
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    videoRef.current = video;

    const cleanup = () => {
      try {
        video.removeAttribute("src");
        video.load();
      } catch {
        // ignore
      }
      videoRef.current = null;
    };

    const handleError = () => {
      if (cancelled || generatedRef.current) return;
      setError(true);
      setLoading(false);
      onThumbnailError?.(new Error("视频抽帧失败"));
    };

    const handleSeeked = () => {
      if (cancelled || generatedRef.current) return;
      try {
        const canvas = document.createElement("canvas");
        const maxSize = thumbnailSize;
        let width = video.videoWidth || maxSize;
        let height = video.videoHeight || maxSize;

        if (width > 0 && height > 0) {
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
        } else {
          width = maxSize;
          height = maxSize;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("无法获取 canvas 2D context");
        ctx.drawImage(video, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        generatedRef.current = true;
        setThumbnail(dataUrl);
        setLoading(false);
      } catch (err) {
        handleError();
      }
    };

    const handleLoadedData = () => {
      if (cancelled) return;
      // 抽帧时间：优先取首帧或中间帧
      const target = Math.min(0.1, (video.duration || 0) / 2 || 0.1);
      try {
        video.currentTime = target;
      } catch {
        // 某些浏览器对 data URL 抛错
        handleError();
      }
    };

    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("seeked", handleSeeked);
    video.addEventListener("error", handleError);

    try {
      video.src = src;
    } catch (err) {
      handleError();
    }

    return () => {
      cancelled = true;
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("error", handleError);
      cleanup();
    };
  }, [src, thumbnailSize, isBase64Image, onThumbnailError]);

  const containerClass = fill
    ? `relative w-full h-full overflow-hidden bg-gray-100 dark:bg-gray-700 ${className}`
    : `relative overflow-hidden inline-block bg-gray-100 dark:bg-gray-700 ${className}`;

  if (error) {
    return (
      <div className={containerClass}>
        {fallback ?? (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <Video size={24} />
          </div>
        )}
        {showPlayIcon && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/40 rounded-full p-2">
              <Play size={20} className="text-white" fill="white" />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={containerClass}>
      {thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumbnail} alt={alt} className={imgClassName} />
      ) : loading ? (
        <div className="w-full h-full flex items-center justify-center text-gray-400">
          <Video size={24} />
        </div>
      ) : null}
      {showPlayIcon && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/40 rounded-full p-2">
            <Play size={20} className="text-white" fill="white" />
          </div>
        </div>
      )}
    </div>
  );
}
