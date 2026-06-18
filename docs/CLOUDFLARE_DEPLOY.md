# NextPost Cloudflare 部署方案

> **文档版本**：v1.0  
> **创建日期**：2026-06-17  
> **最后更新**：2026-06-17

---

## 概述

本文档描述 NextPost 部署到 Cloudflare Pages 的完整方案。

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
│           │                       │                              │
│           │                       │                              │
│  ┌────────┴────────┐     ┌────────┴────────┐                   │
│  │     R2 Bucket    │     │      D1 DB      │                   │
│  │  (媒体文件存储)   │     │   (共享数据库)   │                   │
│  └─────────────────┘     └─────────────────┘                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 技术栈对应

| 组件 | 本地开发 | 云端部署 |
|------|---------|---------|
| 框架 | Next.js 16.2.6 | Cloudflare Pages |
| 数据库 | SQLite 文件 | Cloudflare D1（共享） |
| 存储 | 本地文件系统 | Cloudflare R2 |
| 认证 | NextAuth.js | NextAuth.js (适配) |
| CI/CD | - | GitHub Actions |

### 多租户隔离策略

**共享数据库 + userId 隔离**

- 所有租户共享同一个 D1 数据库
- 通过 `userId` 字段实现数据隔离
- Prisma 查询自动带上 `userId` 条件
- R2 存储桶共用，通过路径前缀区分（`uploads/{userId}/`）

---

## 第一步：Cloudflare 资源创建

### 1.1 登录 Cloudflare

访问 [Cloudflare Dashboard](https://dash.cloudflare.com/) 并登录。

### 1.2 创建 D1 数据库

**方式一：通过 Dashboard**

1. 进入 **Workers & Pages** → **D1 Databases**
2. 点击 **Create database**
3. 输入数据库名称：`nextpost-db`
4. 选择区域（默认即可）
5. 点击 **Create**

**方式二：通过 Wrangler CLI**

```bash
# 安装 Wrangler
npm i -g wrangler

# 登录
wrangler login

# 创建数据库
wrangler d1 create nextpost-db
```

返回结果示例：
```
✅ Successfully created D1 database 'nextpost-db'
{d1_databases: { binding = "DB", database_name = "nextpost-db", database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" }}
```

**记录下 `database_id`**，稍后需要用到。

### 1.3 创建 R2 存储桶

**方式一：通过 Dashboard**

1. 进入 **Workers & Pages** → **R2 Object Storage**
2. 点击 **Create bucket**
3. 输入存储桶名称：`nextpost-media`
4. 点击 **Create bucket**

**方式二：通过 Wrangler CLI**

```bash
wrangler r2 bucket create nextpost-media
```

### 1.4 创建 Cloudflare API Token

1. 进入 **My Profile** → **API Tokens**
2. 点击 **Create Token**
3. 选择 **Edit Cloudflare Workers** 模板
4. 设置以下权限：
   - `Account: Workers:Edit`
   - `User: Scripts:Edit`
   - `Zone: Cache Purge`
5. 点击 **Create Token**
6. **复制并保存 Token**（只会显示一次）

### 1.5 获取 Account ID

1. 进入 **Overview** 页面
2. 滚动到右侧，复制 **Account ID**

---

## 第二步：配置 GitHub Secrets

### 2.1 添加 Secrets

在 GitHub 仓库 **Settings** → **Secrets and variables** → **Actions** 中添加：

| Secret Name | 值 |
|-------------|---|
| `CLOUDFLARE_API_TOKEN` | 刚才创建的 API Token |
| `CLOUDFLARE_ACCOUNT_ID` | 刚才获取的 Account ID |
| `AUTH_SECRET` | 随机密钥，生成方式见下方 |

**生成 AUTH_SECRET：**

```bash
openssl rand -base64 32
```

### 2.2 添加 Variables（可选）

| Variable Name | 值 |
|---------------|---|
| `NEXT_PUBLIC_BASE_URL` | 你的域名，如 `https://nextpost.pages.dev` |

---

## 第三步：配置 wrangler.toml

在项目根目录创建 `wrangler.toml`：

```toml
name = "nextpost"
compatibility_date = "2024-01-01"
pages_build_output_dir = ".next"

# D1 数据库绑定
[[d1_databases]]
binding = "DB"
database_name = "nextpost-db"
database_id = "你的-database-id"
```

---

## 第四步：创建 Cloudflare Pages 项目

### 4.1 通过 Dashboard 创建

1. 进入 **Workers & Pages** → **Create application**
2. 选择 **Pages** → **Connect to Git**
3. 选择你的 GitHub 仓库
4. 配置构建设置：
   - **Project name**: `nextpost`
   - **Build command**: `pnpm build`
   - **Build output directory**: `.next`
   - **Root directory**: `/`
5. 点击 **Deploy**

### 4.2 绑定 D1 数据库

部署后，进入项目 **Settings** → **Functions** → **D1 Database Bindings**：
- 变量名：`DB`
- D1 database：选择 `nextpost-db`

### 4.3 绑定 R2 存储桶

进入项目 **Settings** → **Functions** → **R2 Database Bindings**：
- 变量名：`MEDIA`
- R2 bucket：选择 `nextpost-media`

### 4.4 配置环境变量

进入项目 **Settings** → **Environment variables**：

**Production 环境：**
| Variable | Value |
|----------|-------|
| `AUTH_SECRET` | 你的随机密钥 |
| `NEXT_PUBLIC_BASE_URL` | `https://nextpost.pages.dev` |
| `STORAGE_ENGINE` | `r2` |
| `DATABASE_URL` | （留空或删除） |

---

## 第五步：运行数据库迁移

### 5.1 推送 Prisma Schema

```bash
# 安装 Wrangler（如果还没安装）
npm i -g wrangler

# 登录
wrangler login

# 创建本地 D1 数据库（用于生成迁移）
wrangler d1 create nextpost-db --local

# 生成迁移（使用现有 schema）
pnpm prisma migrate dev --name init

# 将迁移推送到远程 D1
pnpm prisma migrate deploy
```

或者直接执行 SQL：

```bash
# 查看生成的 SQL
cat prisma/migrations/*/migration.sql

# 在远程 D1 执行
wrangler d1 execute nextpost-db --remote --file=prisma/migrations/xxx/migration.sql
```

### 5.2 运行 Seed

```bash
# 种子数据会创建默认平台配置
pnpm prisma db seed
```

---

## 第六步：本地开发配置

### 6.1 环境变量

创建 `.env.local`：

```bash
# .env.local（本地开发用）
AUTH_SECRET=你的本地随机密钥
DATABASE_URL=file:./prisma/dev.db
STORAGE_ENGINE=local
NEXT_PUBLIC_BASE_URL=http://localhost:3456
```

创建 `.dev.vars`（Wrangler 本地开发用）：

```bash
# .dev.vars
AUTH_SECRET=你的本地随机密钥
```

### 6.2 本地开发

```bash
# 本地开发（SQLite + 本地文件）
pnpm dev

# 或者用 Wrangler 本地模拟 Cloudflare 环境
wrangler pages dev .next
```

---

## CI/CD 工作流

### 部署触发条件

| 事件 | 行为 |
|------|------|
| Push 到 `main` | 部署到 Production |
| Push 到 PR | 部署到 Preview |
| 打标签 `v*` | 创建 Release |

### 部署流程

```
┌─────────────────────────────────────────────────────────────────┐
│                      GitHub Actions                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 检出代码                                                    │
│  2. 安装 pnpm 依赖                                              │
│  3. 运行测试 (vitest)                                          │
│  4. 构建项目 (pnpm build)                                      │
│  5. 部署到 Cloudflare Pages                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 本地开发与线上数据隔离

```
┌─────────────────────────────────────────────────────────────────┐
│                        本地开发环境                               │
├─────────────────────────────────────────────────────────────────┤
│  数据库: SQLite 文件 (prisma/dev.db)                           │
│  存储:   本地目录 (./uploads/)                                  │
│  数据:   完全隔离，不影响线上                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        线上生产环境                               │
├─────────────────────────────────────────────────────────────────┤
│  数据库: Cloudflare D1 (共享)                                   │
│  存储:   Cloudflare R2 (共享，通过 userId 隔离)                  │
│  数据:   所有用户共享同一数据库                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 故障排查

### 常见问题

| 问题 | 解决方案 |
|------|---------|
| D1 绑定失败 | 检查 wrangler.toml 的 `binding = "DB"` |
| R2 上传失败 | 确认 R2 bucket 名称和 `STORAGE_ENGINE=r2` |
| AUTH_SECRET 错误 | 使用 `openssl rand -base64 32` 生成 |
| 部署失败 | 检查 GitHub Actions 日志 |

### 调试命令

```bash
# 查看 D1 数据
wrangler d1 execute nextpost-db --remote --command="SELECT * FROM User LIMIT 10"

# 查看 R2 文件
wrangler r2 object list nextpost-media

# 查看部署状态
wrangler pages project list
```

---

## 实现状态 (v0.5.3+)

以下代码已实现并可使用：

### 已实现
- ✅ **R2 存储引擎** (`src/lib/storage/r2.ts`)
  - 支持 `upload / uploadWithThumbnail / delete / exists / getUrl`
  - Cloudflare Workers 环境下自动检测 `MEDIA` 绑定
  - 缩略图生成在 CF 环境自动降级（返回原图 URL）
- ✅ **Sharp 兼容** (`src/lib/storage/thumbnail.ts`)
  - 使用动态导入，在不支持 Sharp 的环境中优雅降级
- ✅ **存储引擎自动选择** (`src/lib/storage/index.ts`)
  - 通过 `STORAGE_ENGINE` 环境变量切换 local/r2
- ✅ **wrangler.toml** 配置文件
  - 已包含 D1/R2 绑定的注释示例
  - 本地 `.dev.vars` 开发配置
- ✅ **next.config.ts** 适配
  - 配置 R2 远程图片模式
  - 设置 serverActions 允许的 origin

### 部署后配置步骤

1. **绑定资源**：在 Cloudflare Dashboard 中绑定 D1（`DB`）和 R2（`MEDIA`）
2. **设置环境变量**：
   - `AUTH_SECRET` - NextAuth 加密密钥
   - `STORAGE_ENGINE=r2` - 启用 R2 存储
   - `NEXT_PUBLIC_BASE_URL` - 站点 URL
3. **运行迁移**：`wrangler d1 migrations apply nextpost-db`
4. **种子数据**（可选）：部署一个简单的 seed 脚本

### 已知限制

- **缩略图**：Cloudflare Workers 不支持 Sharp，CF 环境下不上传缩略图，使用原图替代
- **本地存储**：本地开发仍用 `prisma/dev.db` SQLite 文件 + `./uploads/` 目录
- **数据隔离**：D1 共享数据库，通过 `userId` 字段隔离；R2 通过路径前缀隔离

---

## 下一步

部署完成后，可以继续实施：

1. **R2 公开访问配置** - 启用 R2 公开访问或配置自定义域名
2. **CI/CD 配置** - 接入 GitHub Actions 自动部署
3. **多租户改造** - 支持多租户升级

详见 [VERSION_UPGRADE.md](./VERSION_UPGRADE.md)

---

**文档结束**
