# NextPost Cloudflare Workers 部署方案

> **文档版本**：v2.0（2026-06-18 重写）
> **历史**：v1.0 为 Pages 方案，已废弃——Pages 不支持 Next.js SSR，改为 Workers + OpenNext

---

## 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                   Cloudflare Workers                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐     ┌──────────────────────────────┐  │
│  │   OpenNext Worker     │     │   Cloudflare Edge Network    │  │
│  │  (Next.js SSR 运行时)  │     │   (全球 CDN, 边缘计算)       │  │
│  └──────────┬───────────┘     └──────────────────────────────┘  │
│              │                                                    │
│   ┌─────────┴─────────┐                                          │
│   │                   │                                          │
│ ┌─┴───┐         ┌────┴────┐                                     │
│ │  D1  │         │    R2    │                                     │
│ │ DB   │         │  媒体存储 │                                     │
│ └──────┘         └──────────┘                                     │
└─────────────────────────────────────────────────────────────────┘
```

**为什么用 Workers 而不是 Pages：**
- Pages 只有简单 SSR，无 Node.js runtime
- Next.js App Router 需要完整 Node.js 支持
- Workers 通过 `nodejs_compat` flag 提供 Node.js API

**为什么用 OpenNext：**
- Next.js 原生 build 输出无法直接在 Workers 运行
- OpenNext 把 `.next/` 转换成 Workers 可执行的格式

---

## 技术栈

| 组件 | 本地开发 | 云端部署 |
|------|---------|---------|
| 框架 | Next.js 16.2.6 + Turbopack (dev) | Next.js 16 + **Webpack** (prod) + OpenNext |
| 数据库 | Drizzle ORM + SQLite (dev.db) | Cloudflare D1 (通过 Drizzle D1 adapter) |
| 存储 | 本地文件系统 | Cloudflare R2 |
| 认证 | NextAuth.js | NextAuth.js (适配) |
| CI/CD | — | GitHub Actions + wrangler |

---

## 部署清单

### 需要准备的东西

- Cloudflare 账号（免费可用）
- GitHub 仓库（已连接）
- D1 数据库：`nextpost-db`（可复用现有）
- R2 bucket：`nextpost-media`（可复用现有）
- `CLOUDFLARE_API_TOKEN`：在 CF Dashboard 创建
- `CLOUDFLARE_ACCOUNT_ID`：在 CF Dashboard Overview 复制

### GitHub Secrets（必须设置）

进入 **GitHub repo → Settings → Secrets and variables → Actions → New repository secret**：

| Secret Name | 值 | 备注 |
|-------------|---|------|
| `CLOUDFLARE_API_TOKEN` | CF API Token | 创建时选 "Edit Cloudflare Workers" 模板 |
| `CLOUDFLARE_ACCOUNT_ID` | CF Account ID | Dashboard Overview 右侧可见 |
| `AUTH_SECRET` | `openssl rand -base64 32` 生成 | NextAuth 会话密钥 |
| `NEXT_PUBLIC_BASE_URL` | `https://nextpost.<ACCOUNT_ID>.workers.dev` | 部署后才知道，可先填占位符 |

> `CLOUDFLARE_API_TOKEN` 创建步骤：CF Dashboard → My Profile → API Tokens → Create Token → 选 "Edit Cloudflare Workers" 模板 → Create

---

## 本地开发

```bash
# 安装依赖（包含 @opennextjs/cloudflare）
pnpm install

# 本地开发（Node.js 运行时）
pnpm dev

# 预览 Workers 运行时效果（本地）
pnpm preview

# 直接部署到 CF Workers（需先 wrangler auth login）
pnpm deploy
```

**重要**：`pnpm dev` 使用 Next.js Turbopack 开发服务器；`pnpm preview` 使用 Cloudflare workerd 运行时预览，和线上环境一致。

---

## 构建流程

```
pnpm build
│
├─ next build --webpack     ← Webpack bundler（不能用 Turbopack）
│   生成 .next/ 目录
│
└─ opennextjs-cloudflare    ← OpenNext 转换
    │
    ├─ 读取 .next/ 和 wrangler.jsonc
    ├─ 转换 Next.js build → Workers 格式
    ├─ 输出 .open-next/worker.js
    └─ 准备部署
```

**为什么用 Webpack 而不是 Turbopack：**
- Turbopack + pnpm 符号链接 → esbuild 找不到 `sharp-*` 模块 → OpenNext build 失败
- Webpack 稳定支持 Next.js 16

---

## wrangler.jsonc 配置说明

```jsonc
{
  "name": "nextpost",                    // Workers 项目名
  "main": ".open-next/worker.js",        // OpenNext 生成，不要改
  "compatibility_date": "2024-12-30",
  "compatibility_flags": [
    "nodejs_compat",                     // 开启 Node.js API（D1/R2/Prisma 必需）
    "global_fetch_strictly_public"        // 允许 fetch 公开 URL
  ],
  "assets": {
    "directory": ".open-next/assets",     // 静态资源
    "binding": "ASSETS"
  },
  "services": [
    { "binding": "WORKER_SELF_REFERENCE", "service": "nextpost" }
  ],
  "d1_databases": [
    {
      "binding": "DB",                   // 代码里读取 globalThis.DB
      "database_name": "nextpost-db",
      "database_id": "acfaa8c9-..."     // 从 CF Dashboard D1 数据库页面复制
    }
  ],
  "r2_buckets": [
    {
      "binding": "MEDIA",                // 代码里读取 globalThis.MEDIA
      "bucket_name": "nextpost-media"
    }
  ]
}
```

### 绑定在代码中的使用方式

**D1（数据库）：**
```ts
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
// Workers 运行时自动从 binding "DB" 读取
```

**R2（文件存储）：**
```ts
// src/lib/storage/r2.ts
const bucket: R2Bucket = globalThis.MEDIA as R2Bucket
await bucket.put(key, file)
```

---

## 环境变量配置

### CF Dashboard（Workers Settings）

进入 **Workers & Pages → nextpost → Settings → Environment Variables**：

| Variable | Production Value | Notes |
|----------|----------------|-------|
| `AUTH_SECRET` | 随机密钥 | `openssl rand -base64 32` |
| `STORAGE_ENGINE` | `r2` | 启用 R2 存储 |
| `R2_BUCKET_NAME` | `nextpost-media` | R2 bucket 名称 |
| `NEXT_PUBLIC_BASE_URL` | `https://nextpost.xxx.workers.dev` | Workers URL |
| `NEXTJS_ENV` | `production` | OpenNext 运行时环境 |

### 本地 .dev.vars

```bash
# .dev.vars（本地开发用 Wrangler 时读取）
NEXTJS_ENV=development
AUTH_SECRET=dev-secret-please-change
DATABASE_URL=file:./prisma/dev.db
STORAGE_ENGINE=local
NEXT_PUBLIC_BASE_URL=http://localhost:3456
```

---

## 数据库迁移

```bash
# 推送 Prisma schema 到远程 D1
pnpm prisma migrate deploy

# 或直接执行 SQL
wrangler d1 execute nextpost-db --remote --file=prisma/migrations/xxx/migration.sql

# 查看数据
wrangler d1 execute nextpost-db --remote --command="SELECT * FROM User LIMIT 10"
```

---

## 常见问题

### 1. build 失败：`Could not resolve "sharp-xxx"`

**原因**：Turbopack 在 pnpm 环境创建了无法被 esbuild 解析的符号链接。

**解决**：`next.config.ts` 设为 `images: { unoptimized: true }`（已配置）；生产 build 用 `--webpack`（已在 package.json 配置）。

### 2. build 失败：`REVEAL is not a valid Route export field`

**原因**：Turbopack 放过了非标准 HTTP 方法导出，Webpack 会正确报错。

**解决**：删除路由文件中的 `export async function REVEAL(...)`，使用 `/reveal` 子路由。

### 3. 部署后 404

**原因**：用了 Cloudflare Pages 而非 Workers。Pages 不支持 Next.js 动态路由。

**解决**：确认 GitHub Actions 使用 `wrangler-action`（Workers），不是 `pages-action`（Pages）。

### 4. R2 文件无法访问

**原因**：R2 bucket 未开启公开访问。

**解决**：CF Dashboard → R2 → nextpost-media → Settings → Public access → Enable。

### 5. D1 查询失败

**原因**：D1 迁移未执行，或 binding 名称不匹配。

**解决**：确认 `wrangler.jsonc` 中 `binding = "DB"` 与代码中 `globalThis.DB` 一致。

---

## 本地 vs 线上数据隔离

| | 本地开发 | 线上生产 |
|---|---|---|
| 数据库 | SQLite (`prisma/dev.db`) | Cloudflare D1 |
| 存储 | `./uploads/` 目录 | R2 bucket |
| 数据隔离 | 完全隔离 | 通过 `userId` 隔离 |

---

## 文件结构

```
nextpost/
├── wrangler.jsonc              ← Workers 配置（D1/R2 绑定）
├── open-next.config.ts         ← OpenNext Cloudflare 配置
├── .dev.vars                  ← 本地 Wrangler 环境变量
├── public/_headers            ← CDN 缓存头
└── .github/workflows/
    └── deploy.yml             ← 自动部署（push → Workers）
```

---

## 下一步

1. 设置 GitHub Secrets（见上文）
2. 第一次 push 触发 GitHub Actions → 自动部署
3. 部署成功后，从 CF Dashboard 复制 Workers URL
4. 把 `NEXT_PUBLIC_BASE_URL` 更新为实际 URL
5. 配置 R2 bucket 公开访问：`cf r2 bucket nextpost-media --public-access`

---

**文档结束**
