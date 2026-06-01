# 平台配置设计文档

## 版本信息

| 版本 | 日期 | 说明 |
|------|------|------|
| v0.1 | 2026-06-01 | 初始版本：平台配置、多图支持、文字长度校验 |

## 概述

本文档描述了平台配置系统的设计方案，用于支持不同社交媒体平台的差异化配置（如 Twitter 的多图上传和文字长度限制）。

## 需求分析

### Twitter 平台规则

| 限制项 | 限制值 | 说明 |
|--------|--------|------|
| 文字长度 | 280 字符 | 超出需提示用户 |
| 图片数量 | 最多 4 张 | 超出需提示用户 |
| 视频数量 | 最多 1 个 | 与图片互斥 |

### 功能需求

1. **平台配置系统**：支持不同平台的不同配置
2. **多图上传**：帖子支持上传多个媒体文件
3. **文字长度校验**：编辑时实时显示剩余字符数，超出提示
4. **媒体数量校验**：显示可上传的媒体数量限制

## 数据库设计

### 新增 PlatformConfig 表

```prisma
model PlatformConfig {
  id                String   @id @default(cuid())
  platformId        String   @unique
  maxContentLength  Int      @default(280)     // 最大文字长度
  maxImages         Int      @default(4)       // 最多图片数
  maxVideos         Int      @default(1)       // 最多视频数
  allowMixedMedia   Boolean  @default(true)    // 是否允许图片+视频混合
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  platform Platform @relation(fields: [platformId], references: [id])
}
```

### 预设配置

| 平台 | 文字长度 | 图片数 | 视频数 | 混合媒体 |
|------|----------|--------|--------|----------|
| Twitter | 280 | 4 | 1 | 是 |
| Instagram | 2200 | 10 | 1 | 是 |
| LinkedIn | 3000 | 9 | 1 | 是 |
| Facebook | 63206 | 10 | 1 | 是 |

## API 设计

### 获取平台配置

```
GET /api/accounts/:id/config
Response: {
  platformId: string,
  platformName: string,
  maxContentLength: number,
  maxImages: number,
  maxVideos: number,
  allowMixedMedia: boolean
}
```

## 前端组件设计

### 1. MediaUploader 多媒体上传组件

```typescript
interface MediaItem {
  id: string;
  preview: string;      // 缩略图（base64 或 URL）
  file?: File;          // 新上传的文件
  url?: string;         // 已存在的 URL
  type: 'image' | 'video';
}

interface MediaUploaderProps {
  platformConfig: PlatformConfig;
  initialUrls?: string[];
  onChange: (urls: string[], files: File[]) => void;
}
```

功能：
- 拖拽上传
- 点击选择（支持多选）
- 预览已上传的媒体
- 显示剩余可上传数量
- 删除单个媒体

### 2. ContentEditor 文字编辑器组件

```typescript
interface ContentEditorProps {
  platformConfig: PlatformConfig;
  value: string;
  onChange: (value: string) => void;
}
```

功能：
- 实时字符计数
- 进度条显示
- 超出限制时红色警告
- 支持 Markdown 预览（可选）

### 3. 平台配置获取 Hook

```typescript
function usePlatformConfig(accountId: string): PlatformConfig
```

## 页面更新

### posts/new/page.tsx

1. 账号选择后，获取该账号的平台配置
2. 媒体上传组件支持多图
3. 文字输入框添加字符计数

### posts/[id]/edit/page.tsx

1. 同上，支持多图和字符计数
2. 显示已上传的多个媒体

## 实现计划

- [x] 1. 更新 Prisma Schema，添加 PlatformConfig 表
- [x] 2. 迁移数据库，创建默认平台配置
- [x] 3. 创建平台配置 API
- [x] 4. 创建 MediaUploader 组件
- [x] 5. 创建 ContentEditor 组件
- [x] 6. 更新 posts/new/page.tsx
- [x] 7. 更新 posts/[id]/edit/page.tsx
- [x] 8. 编写单元测试
- [x] 9. 编写 E2E 测试
- [x] 10. 更新文档

## 验收标准

1. ✅ Twitter 账号最多上传 4 张图片
2. ✅ 文字超出 280 字符时显示警告
3. ✅ 支持多图预览和删除
4. ✅ 切换账号时，配置随之更新
5. ✅ 测试覆盖率 ≥ 80%