# NextPost Cloudflare 部署方案

> **文档版本**：v1.0  
> **创建日期**：2026-06-17  
> **最后更新**：2026-06-17

---

## 概述

本文档描述 NextPost 部署到 Cloudflare Pages 的完整方案，包括本地开发环境配置、云端资源创建、CI/CD 自动化部署以及数据隔离策略。

### 部署架构

```
┌─────────────────────────────────────────────────────────────────┐
│                     Cloudflare Pages                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐     ┌─────────────────┐                   │
│  │   Pages Site    │     │  Pages Functions │                   │
│  │   (静态资源)     │     │   (API 路由)     │                   │
│  └─────────────────┘     └─────────────────┘                   │
│           │                       │                            │
│           │                       │                            │
│  ┌────────┴────────┐     ┌────────┴────────┐                   │
│  │     R2 Bucket    │     │      D1 DB      │                   │
│  │  (媒体文件存储)   │     │   (SQLite)     │                   │
│  └─────────────────┘     └─────────────────┘                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 技术栈对应

| 组件 | 本地开发 | 云端部署 |
|------|---------|---------|
| 框架 | Next.js 16.2.6 | Cloudflare Pages |
| 数据库 | SQLite 文件 | Cloudflare D1 |
| 存储 | 本地文件系统 | Cloudflare R2 |
| 认证 | NextAuth.js | NextAuth.js (适配) |
| CI/CD | - | GitHub Actions |

---

## Phase 1：环境准备

### 1.1 安装必要工具

```bash
# 安装 Wrangler CLI
npm i -g wrangler

# 登录 Cloudflare
wrangler login

# 验证登录
wrangler whoami
```

### 1.2 创建 Cloudflare 资源

#### 创建 D1 数据库

```bash
# 创建生产数据库
wrangler d1 create nextpost-db

# 创建预览数据库（可选）
wrangler d1 create nextpost-db-preview
```

返回结果示例：
```
{d1_databases: { binding = "DB", database_name = "nextpost-db", database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" }}
```

#### 创建 R2 存储桶

```bash
# 创建生产存储桶
wrangler r2 bucket create nextpost-media

# 创建预览存储桶（可选）
wrangler r2 bucket create nextpost-media-preview
```

---

## Phase 2：项目配置

### 2.1 创建 wrangler.toml

在项目根目录创建 `wrangler.toml`：

```toml
name = "nextpost"
compatibility_date = "2024-01-01"
pages_build_output_dir = ".next"

# 生产环境 D1 数据库
[[d1_databases]]
binding = "DB"
database_name = "nextpost-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

# 生产环境 R2 存储
[[r2_buckets]]
binding = "MEDIA"
bucket_name = "nextpost-media"
```

### 2.2 环境变量配置

创建 `.dev.vars`（本地开发用，不提交到 Git）：

```bash
# .dev.vars
AUTH_SECRET=your-super-secret-key-min-32-chars
DATABASE_URL=file:./prisma/dev.db
STORAGE_ENGINE=local
NEXT_PUBLIC_BASE_URL=http://localhost:3456
NEXTAUTH_URL=http://localhost:3456
```

创建 `.env.example`（提交到 Git，作为模板）：

```bash
# .env.example

# ===================
# Cloudflare 配置
# ===================
# 在 Cloudflare Dashboard 中获取
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-api-token

# ===================
# 认证配置
# ===================
AUTH_SECRET=generate-with-openssl-rand-base64-32
NEXTAUTH_URL=https://your-domain.pages.dev

# ===================
# 数据库配置（本地开发）
# ===================
DATABASE_URL=file:./prisma/dev.db

# ===================
# 存储配置
# ===================
# local: 本地文件系统
# r2: Cloudflare R2
STORAGE_ENGINE=local

# ===================
# 公共配置
# ===================
NEXT_PUBLIC_BASE_URL=https://your-domain.pages.dev
```

### 2.3 更新 next.config.ts

```typescript
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Pages 适配
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.r2.cloudflarestorage.com',
      },
    ],
  },
  
  // 实验性功能
  experimental: {
    // 启用 Cloudflare 适配
    serverActions: {
      allowedOrigins: ['localhost:3456', '*.pages.dev'],
    },
  },
};

export default nextConfig;
```

---

## Phase 3：存储引擎实现

### 3.1 实现 R2 存储引擎

创建 `src/lib/storage/r2.ts`：

```typescript
import { StorageEngine } from './types';

export class R2StorageEngine implements StorageEngine {
  private bucket: R2Bucket;
  
  constructor(bucket: R2Bucket) {
    this.bucket = bucket;
  }
  
  async upload(file: Buffer, filename: string, mimeType: string): Promise<string> {
    const key = `uploads/${Date.now()}-${filename}`;
    
    await this.bucket.put(key, file, {
      httpMetadata: {
        contentType: mimeType,
      },
    });
    
    return key;
  }
  
  async delete(url: string): Promise<void> {
    await this.bucket.delete(url);
  }
  
  getUrl(path: string): string {
    // Cloudflare R2 公开访问 URL
    return `https://pub-xxx.r2.dev/${path}`;
  }
  
  async exists(path: string): Promise<boolean> {
    const object = await this.bucket.head(path);
    return object !== null;
  }
}

// 工厂函数
export function createR2Storage(bucket: R2Bucket): R2StorageEngine {
  return new R2StorageEngine(bucket);
}
```

### 3.2 更新存储索引文件

修改 `src/lib/storage/index.ts`：

```typescript
import { localStorage, LocalStorageEngine } from './local';
import { R2StorageEngine } from './r2';
import { StorageEngine, StorageEngineType, UploadResult } from './types';

// 获取存储引擎（根据环境变量）
function getStorageEngine(): StorageEngine {
  const engineType = (process.env.STORAGE_ENGINE || 'local') as StorageEngineType;
  
  switch (engineType) {
    case 'local':
      return localStorage;
    case 'r2':
      // 注意：R2 绑定在 Cloudflare Pages Functions 中可用
      if (process.env.MEDIA) {
        return new R2StorageEngine(process.env.MEDIA as unknown as R2Bucket);
      }
      console.warn('R2 bucket not configured, falling back to local storage');
      return localStorage;
    default:
      return localStorage;
  }
}

// ... 其他代码保持不变
```

---

## Phase 4：认证适配

### 4.1 更新 NextAuth 配置

Cloudflare Pages 需要特殊处理 NextAuth 的 `AUTH_SECRET` 和 `NEXTAUTH_URL`：

```typescript
// src/lib/auth.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "./prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "用户名", type: "text" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials) {
        // ... 保持原有逻辑
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  // Cloudflare 适配
  trustHost: true,
});
```

### 4.2 中间件更新

```typescript
// src/middleware.ts
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isAuthPage = req.nextUrl.pathname.startsWith("/login") || 
                     req.nextUrl.pathname.startsWith("/register");
  
  // API 路由允许通过（CORS 等）
  if (req.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.next();
  }
  
  // 静态资源允许通过
  if (req.nextUrl.pathname.startsWith("/_next") || 
      req.nextUrl.pathname.startsWith("/uploads")) {
    return NextResponse.next();
  }

  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

---

## Phase 5：CI/CD 自动化

### 5.1 创建 GitHub Actions 工作流

创建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main

env:
  NODE_VERSION: '20'

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
      
      - name: Install pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Type check
        run: pnpm type-check
      
      - name: Run tests
        run: pnpm test
      
      - name: Build
        run: pnpm build
        env:
          NEXT_PUBLIC_BASE_URL: ${{ secrets.NEXT_PUBLIC_BASE_URL }}
          AUTH_SECRET: ${{ secrets.AUTH_SECRET }}
      
      - name: Deploy to Cloudflare (Preview)
        if: github.event_name == 'pull_request'
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: 'nextpost'
          directory: '.next'
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}
          wranglerVersion: '3'
      
      - name: Deploy to Cloudflare (Production)
        if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: 'nextpost'
          directory: '.next'
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}
          wranglerVersion: '3'
          environment: 'production'

  e2e-test:
    runs-on: ubuntu-latest
    needs: deploy
    if: github.event_name == 'pull_request'
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
      
      - name: Install pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Install Playwright
        run: pnpm exec playwright install --with-deps chromium
      
      - name: Run E2E tests
        run: pnpm test:e2e
        env:
          NEXT_PUBLIC_BASE_URL: ${{ needs.deploy.outputs.preview_url }}
```

### 5.2 数据库迁移工作流

创建 `.github/workflows/migrate.yml`：

```yaml
name: Database Migration

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        default: 'preview'
        type: choice
        options:
          - preview
          - production

jobs:
  migrate:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Install Wrangler
        run: npm install -g wrangler
      
      - name: Run Migrations
        run: |
          wrangler d1 migrations apply nextpost-db \
            --env ${{ inputs.environment }} \
            --local
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

### 5.3 添加 Secrets

在 GitHub 仓库 Settings → Secrets and variables → Actions 中添加：

| Secret Name | 说明 |
|-------------|------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |
| `AUTH_SECRET` | NextAuth 密钥（32+ 字符） |
| `NEXT_PUBLIC_BASE_URL` | 生产环境 URL |

---

## Phase 6：本地开发环境

### 6.1 本地 D1 开发

```bash
# 创建本地 D1 数据库
wrangler d1 create nextpost-db --local

# 导入现有 schema
wrangler d1 execute nextpost-db --local --file=./prisma/migrations/xxx.sql

# 查看数据
wrangler d1 execute nextpost-db --local --command="SELECT * FROM User LIMIT 10"
```

### 6.2 本地 R2 开发

Cloudflare Pages 本地开发使用 Miniflare 模拟 R2：

```bash
# 启动本地开发服务器
wrangler pages dev .next

# 或者使用 Next.js dev
pnpm dev
```

### 6.3 同步脚本

创建 `scripts/sync-to-r2.ts` 用于同步本地文件到 R2：

```typescript
#!/usr/bin/env node
/**
 * 同步本地 uploads 目录到 R2 存储桶
 * 用法: npx tsx scripts/sync-to-r2.ts
 */

import { execSync } from 'child_process';
import { readdirSync, statSync, createReadStream } from 'fs';
import { join } from 'path';

const UPLOADS_DIR = './uploads';
const BUCKET_NAME = 'nextpost-media';

function walkDir(dir: string): string[] {
  const files: string[] = [];
  
  function traverse(currentDir: string) {
    const items = readdirSync(currentDir);
    for (const item of items) {
      const fullPath = join(currentDir, item);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        traverse(fullPath);
      } else if (stat.isFile()) {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

async function uploadFile(localPath: string) {
  const relativePath = localPath.replace(UPLOADS_DIR + '/', '');
  const r2Key = `uploads/${relativePath}`;
  
  try {
    execSync(
      `wrangler r2 object put ${BUCKET_NAME}/${r2Key} --file=${localPath}`,
      { stdio: 'pipe' }
    );
    console.log(`✅ Uploaded: ${r2Key}`);
  } catch (error) {
    console.error(`❌ Failed: ${r2Key}`, error);
  }
}

async function main() {
  console.log('🚀 Starting upload to R2...\n');
  
  const files = walkDir(UPLOADS_DIR);
  console.log(`Found ${files.length} files to upload\n`);
  
  for (const file of files) {
    await uploadFile(file);
  }
  
  console.log('\n✨ Done!');
}

main().catch(console.error);
```

---

## Phase 7：数据隔离策略

### 7.1 环境对比

| 数据类型 | 本地开发 | 预览环境 | 生产环境 |
|---------|---------|---------|---------|
| 数据库 | SQLite 文件 | D1 (preview) | D1 (production) |
| 存储 | 本地文件系统 | R2 (preview) | R2 (production) |
| 迁移 | 本地执行 | CI 自动 | CI 自动 |
| 数据 | 完全隔离 | 独立数据 | 独立数据 |

### 7.2 迁移策略

```
┌─────────────────────────────────────────────────────────────────┐
│                      开发工作流                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 本地修改 schema.prisma                                     │
│  2. pnpm prisma migrate dev --name add_xxx                     │
│  3. 本地测试通过                                                │
│  4. git commit && git push                                     │
│  5. CI 自动部署到 Preview 环境                                  │
│     - wrangler d1 migrations apply --env preview               │
│  6. 人工检查 Preview                                            │
│  7. Merge 到 main                                               │
│  8. CI 自动部署到 Production 环境                               │
│     - wrangler d1 migrations apply --env production            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.3 种子数据同步

对于 Platform、PlatformConfig 等基础数据：

```bash
# 本地导出
sqlite3 prisma/dev.db ".dump Platform PlatformConfig" > seed.sql

# 清理 SQLite 特定语法
sed -i '' "s/PRAGMA foreign_keys=ON;//g" seed.sql

# 线上导入
wrangler d1 execute nextpost-db --remote --file=seed.sql
```

---

## Phase 8：故障排查

### 8.1 常见问题

| 问题 | 解决方案 |
|------|---------|
| D1 绑定失败 | 检查 wrangler.toml 的 binding 名称 |
| R2 上传失败 | 确认 bucket 名称和权限 |
| AUTH_SECRET 错误 | 使用 `openssl rand -base64 32` 生成 |
| CORS 错误 | 配置 `_headers` 文件或 Cloudflare Dashboard |

### 8.2 调试命令

```bash
# 查看 Cloudflare 日志
wrangler pages project list
wrangler pages deployment list nextpost

# 查看 D1 数据
wrangler d1 execute nextpost-db --remote --command="SELECT * FROM _prisma_migrations"

# 测试 R2 连接
wrangler r2 object list nextpost-media
```

---

## 附录：完整 wrangler.toml 示例

```toml
name = "nextpost"
compatibility_date = "2024-01-01"
pages_build_output_dir = ".next"

# 生产环境
[env.production]
[[env.production.d1_databases]]
binding = "DB"
database_name = "nextpost-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

[[env.production.r2_buckets]]
binding = "MEDIA"
bucket_name = "nextpost-media"

# 预览环境
[env.preview]
[[env.preview.d1_databases]]
binding = "DB"
database_name = "nextpost-db-preview"
database_id = "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy"

[[env.preview.r2_buckets]]
binding = "MEDIA"
bucket_name = "nextpost-media-preview"
```

---

**文档结束**
