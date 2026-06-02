"use client";

import { MediaPreview } from "@/components/MediaPreview";

interface MediaThumbnailProps {
  /** 媒体 URL 数组 */
  urls: string[];
  /** 可选：缩略图 URL 数组（每个缩略图不超过 30KB） */
  thumbnails?: string[];
  /** 容器尺寸（宽高相同） */
  size?: number;
  /** 额外 className */
  className?: string;
}

/**
 * 多媒体拼接缩略图组件
 * - 1 张：全尺寸显示
 * - 2 张：左右各半
 * - 3 张：左半 + 右上下
 * - 4 张及以上：2x2 网格 + 覆盖 "+N" 标签
 *
 * 会优先使用 thumbnails 数组中的缩略图 URL（如果有的话）
 */
export function MediaThumbnail({
  urls,
  thumbnails,
  size = 48,
  className = "",
}: MediaThumbnailProps) {
  if (!urls || urls.length === 0) return null;

  const containerClass = `relative flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 ${className}`;
  const count = urls.length;

  // 准备缩略图 URL 数组（优先使用 thumbnails，否则使用 urls 本身）
  const thumbnailUrls = thumbnails && thumbnails.length >= urls.length
    ? thumbnails
    : urls;

  // 1 张：全尺寸
  if (count === 1) {
    return (
      <div className={containerClass} style={{ width: size, height: size }}>
        <MediaPreview
          src={thumbnailUrls[0]}
          alt="媒体预览"
          fill={true}
          imgClassName="w-full h-full object-cover"
          showPlayIcon={true}
          thumbnailSize={size}
        />
      </div>
    );
  }

  const half = size / 2;
  const gap = 1; // 图片之间的间距

  // 2 张：左右各半
  if (count === 2) {
    return (
      <div className={`${containerClass} flex`} style={{ width: size, height: size }}>
        <div className="overflow-hidden" style={{ width: half - gap / 2, height: size }}>
          <MediaPreview
            src={thumbnailUrls[0]}
            alt=""
            fill={true}
            imgClassName="w-full h-full object-cover"
            showPlayIcon={false}
            thumbnailSize={half}
          />
        </div>
        <div className="overflow-hidden" style={{ width: half - gap / 2, height: size, marginLeft: gap }}>
          <MediaPreview
            src={thumbnailUrls[1]}
            alt=""
            fill={true}
            imgClassName="w-full h-full object-cover"
            showPlayIcon={false}
            thumbnailSize={half}
          />
        </div>
      </div>
    );
  }

  // 3 张：左半 + 右上下
  if (count === 3) {
    return (
      <div className={`${containerClass} flex`} style={{ width: size, height: size }}>
        <div className="overflow-hidden" style={{ width: half - gap / 2, height: size }}>
          <MediaPreview
            src={thumbnailUrls[0]}
            alt=""
            fill={true}
            imgClassName="w-full h-full object-cover"
            showPlayIcon={false}
            thumbnailSize={half}
          />
        </div>
        <div className="flex flex-col" style={{ width: half - gap / 2, marginLeft: gap }}>
          <div className="overflow-hidden" style={{ height: half - gap / 2 }}>
            <MediaPreview
              src={thumbnailUrls[1]}
              alt=""
              fill={true}
              imgClassName="w-full h-full object-cover"
              showPlayIcon={false}
              thumbnailSize={half}
            />
          </div>
          <div className="overflow-hidden" style={{ height: half - gap / 2, marginTop: gap }}>
            <MediaPreview
              src={thumbnailUrls[2]}
              alt=""
              fill={true}
              imgClassName="w-full h-full object-cover"
              showPlayIcon={false}
              thumbnailSize={half}
            />
          </div>
        </div>
      </div>
    );
  }

  // 4 张及以上：2x2 网格 + 可能显示 +N
  const extra = count - 4;
  return (
    <div className={containerClass} style={{ width: size, height: size }}>
      <div className="grid grid-cols-2 grid-rows-2 w-full h-full" style={{ gap }}>
        {urls.slice(0, 4).map((url, i) => (
          <div key={i} className="overflow-hidden">
            <MediaPreview
              src={thumbnailUrls[i] || url}
              alt=""
              fill={true}
              imgClassName="w-full h-full object-cover"
              showPlayIcon={false}
              thumbnailSize={half}
            />
          </div>
        ))}
      </div>
      {extra > 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <span className="text-white text-xs font-bold">+{extra}</span>
        </div>
      )}
    </div>
  );
}