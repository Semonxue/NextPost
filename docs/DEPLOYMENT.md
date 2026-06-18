# NextPost 部署指南

> **目标读者**：想把 NextPost 部署到自己环境的开发者 / 运维
> **最后更新**：2026-06-18
> **适用版本**：v0.6.0+

NextPost 是一份**单 Next.js 应用**，业务代码完全相同，可跑在三种环境。按用户场景选一种：

| 场景 | 适合谁 | DB | 存储 | 启动命令 |
|---|---|---|---|---|
| [本地单用户](#本地单用户) | 个人开发者 / 试用 | SQLite (`data/nextpost.db`) | 本地 `./uploads/` | `pnpm dev` |
| [Cloudflare Workers](#cloudflare-workers-推荐) | 个人 / 小团队 / 想公网访问 | Cloudflare D1 | Cloudflare R2 | `pnpm deploy` |
| [自有服务器 / NAS](#自有服务器自托管) | 不想用 CF / 数据敏感 | （当前需手动改 DB URL） | 本地 `./uploads/` | `pnpm build && pnpm start` |

---

## 1. 本地单用户

最简单的部署：完全在你电脑上跑，数据存本地 SQLite，零云成本。

### 1.1 前置要求

- Node.js 18+
- pnpm 8+

### 1.2 一键启动

```bash
git clone https://github.com/Semonxue/NextPost.git
cd nextPost
pnpm install

# 初始化 DB + 注入平台数据
pnpm db:generate
pnpm db:migrate:local
pnpm db:seed

# 启动 dev server
pnpm dev
```

打开 http://localhost:3456 注册账号即可使用。

### 1.3 数据位置

| 数据 | 位置 |
|---|---|
| DB | `data/nextpost.db`（git ignore） |
| 媒体文件 | `uploads/` 目录（git ignore） |
| 会话密钥 | `.env` 里的 `AUTH_SECRET` |

### 1.4 升级

```bash
git pull
pnpm install
pnpm db:generate       # 如果 schema 改了
pnpm db:migrate:local  # 应用新 migration
```

---

## 2. Cloudflare Workers（推荐）

> 详细教程：[CLOUDFLARE_DEPLOY.md](./CLOUDFLARE_DEPLOY.md)

**适合**：想公网访问、想给多设备用、想低运维成本

**资源**：
- 1 × Worker（运行 Next.js SSR，OpenNext 适配）
- 1 × D1（Cloudflare 托管的 SQLite）
- 1 × R2 bucket（媒体文件）

**成本**：CF 免费额度通常够个人使用

### 2.1 准备 CF 资源

1. Cloudflare 账号（[注册](https://dash.cloudflare.com/sign-up)）
2. 创建 D1 database：`nextpost-db`（记下 `database_id`）
3. 创建 R2 bucket：`nextpost-media`（开公开访问）
4. 创建 API Token：My Profile → API Tokens → Create Token → 选 "Edit Cloudflare Workers" 模板

### 2.2 配置项目

更新 `wrangler.jsonc`：

```jsonc
{
  "d1_databases": [{
    "binding": "DB",
    "database_name": "nextpost-db",
    "database_id": "<你的 D1 database_id>"  // ← 替换
  }],
  "r2_buckets": [{
    "binding": "MEDIA",
    "bucket_name": "nextpost-media"  // ← 替换
  }],
  "vars": {
    "NEXT_PUBLIC_BASE_URL": "https://nextpost.<account>.workers.dev",
    "STORAGE_ENGINE": "r2",
    "R2_BUCKET_NAME": "nextpost-media"
  }
}
```

### 2.3 部署

#### 方式 A：GitHub Actions（推荐）

GitHub repo → Settings → Secrets → 添加：

| Secret | 值 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | 第 1 步拿到的 token |
| `CLOUDFLARE_ACCOUNT_ID` | CF Dashboard Overview 右侧可见 |
| `AUTH_SECRET` | `openssl rand -base64 32` 生成 |
| `NEXT_PUBLIC_BASE_URL` | `https://nextpost.<account>.workers.dev` |

push 到 main → GitHub Actions 自动 build + deploy。

#### 方式 B：本地手动 deploy

```bash
pnpm deploy
# 等价于：opennextjs-cloudflare build && opennextjs-cloudflare deploy
```

### 2.4 首次部署后必做：初始化 D1

D1 不会自动建表，也不会自动 seed。首次部署后：

```bash
# 1. 生成 migration（如果还没生成）
pnpm db:generate

# 2. 把 migration 推到远程 D1
pnpm db:migrate:remote
# 等价于：wrangler d1 migrations apply nextpost-db --remote

# 3. 注入平台 seed 数据
pnpm db:seed:d1
# 等价于：用 wrangler 上下文执行 src/lib/db/seed.ts
```

> **如果 `pnpm db:seed:d1` 跑不了**（不在 wrangler 上下文）：
> 参见 [CLOUDFLARE_DEPLOY.md#初始化-d1-数据](./CLOUDFLARE_DEPLOY.md#初始化-d1-数据首次部署后必做) 用 SQL 命令手动 seed。

### 2.5 升级

```bash
git pull
# 本地：
pnpm db:generate       # 如果 schema 改了
# 远程：
pnpm db:migrate:remote
```

---

## 3. 自有服务器（自托管）

**适合**：不想用 CF / 数据敏感 / 已有 VPS / NAS

> ⚠️ **当前分支不直接支持**——`getDb()` 只识别 D1 和本地 libsql，不支持 Postgres/MySQL。
> 自托管到 Node.js 服务器会**自动回退到本地 libsql**（`data/nextpost.db`），
> 所以**单实例可用**，但**多实例不共享 DB**（需要外置 DB）。

### 3.1 单实例（推荐，v0.6.0 可用）

```bash
# 在你的服务器上
git clone https://github.com/Semonxue/NextPost.git
cd nextPost
pnpm install --frozen-lockfile

# Build
pnpm build

# 配置 .env（同本地）
AUTH_SECRET=<openssl rand -base64 32>
DATABASE_URL="file:./data/nextpost.db"  # 走本地 libsql
APP_URL=https://nextpost.example.com

# 初始化 DB
pnpm db:migrate:local
pnpm db:seed

# 用 systemd / pm2 / docker 起服务
pnpm start
```

#### 用 PM2 守护

```bash
pnpm add -g pm2
pm2 start "pnpm start" --name nextpost
pm2 save
pm2 startup
```

#### 用 Docker

`Dockerfile` 模板：

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@10.11.0 --activate && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
ENV AUTH_SECRET=change-me
ENV DATABASE_URL=file:./data/nextpost.db
ENV APP_URL=http://localhost:3000
EXPOSE 3000
CMD ["pnpm", "start"]
```

### 3.2 多实例（需要外置 DB）

如果想多实例共享数据，需要把 DB 换成外置的（Postgres/MySQL）：

1. 修改 `src/lib/db/index.ts` 加 Postgres/MySQL driver 分支
2. 重新 build
3. 用外置 DB 的 connection string 设置 `DATABASE_URL`

**目前未实现，需要自托管的可以提 issue / PR**。

---

## 4. 选择建议

| 需求 | 推荐方案 |
|---|---|
| 试用 / 学习 NextPost | 本地单用户 |
| 一个人长期用，多设备访问 | Cloudflare Workers |
| 团队 / 公网公开产品 | Cloudflare Workers + 加权限层 |
| 数据绝不出本地 | 自托管 + 单实例 |
| 多副本 / 高可用 | 自托管 + 外置 DB（待实现） |

---

## 5. 数据库 schema 演进（所有部署方式通用）

### 修改字段

1. 改 `src/lib/db/schema.ts`
2. 跑 `pnpm db:generate` 生成 migration SQL
3. 审查 `drizzle/0001_xxx.sql` 内容
4. 提交代码

### 应用 migration

| 部署方式 | 命令 |
|---|---|
| 本地 | `pnpm db:migrate:local` |
| Cloudflare D1 | `pnpm db:migrate:remote` |
| 自托管 | `pnpm db:migrate:local`（进程需重启 / 多实例需轮询） |

---

**文档结束**
