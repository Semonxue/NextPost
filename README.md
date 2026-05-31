# NextPost - 社媒帖子发布计划工具

一款可视化社媒内容发布计划管理工具，帮助用户规划、管理多平台多账号的社交媒体发布计划，支持未来 AI 辅助编辑。

## ✨ 功能特性

### 第一期 (MVP)
- ✅ **多用户账号系统** - 简化的用户注册/登录，每个用户独立数据
- ✅ **社交账号管理** - 手动输入账号信息（不调用外部 API）
- ✅ **内容创作** - 创建帖子内容（文本/图片，支持草稿）
- ✅ **计划调度** - 单次计划，精确到分钟
- ✅ **日历视图** - 按月/周/日展示发布计划
- ✅ **列表视图** - 表格形式展示所有计划，支持筛选排序
- ✅ **计划编辑** - 修改/删除已有计划

### 第二期 (AI 辅助)
- 🔄 **AI Chat 界面** - 对话式交互，AI 理解用户意图
- 🔄 **工具调用** - AI 可调用的内置工具（增删改查计划等）
- 🔄 **流式响应** - SSE 实现打字机效果
- 📋 **多平台支持** - Instagram / LinkedIn / Facebook 等
- 📋 **周期性计划** - 支持每天/每周/每月重复

## 🛠️ 技术栈

| 层级 | 技术选型 | 说明 |
|------|---------|------|
| 框架 | Next.js 16 (App Router) | 前后端统一框架 |
| 语言 | TypeScript | 类型安全 |
| 样式 | Tailwind CSS 4 | 原子化 CSS |
| 状态管理 | Zustand | 轻量级状态管理 |
| API | Next.js Route Handlers | 内置 API 路由 |
| 数据库 | Prisma + SQLite | 环境变量切换（SQLite/PostgreSQL） |
| 认证 | NextAuth.js | 简化认证，支持 Credentials |
| AI | OpenAI / Anthropic / Ollama | 多提供商支持 |
| 测试 | Vitest + Playwright | 单元测试 + E2E 测试 |

## 🚀 快速开始

### 环境要求

- Node.js 18+
- pnpm 8+

### 安装

```bash
# 克隆项目
git clone <repository-url>
cd nextpost

# 安装依赖
pnpm install

# 生成 Prisma 客户端
pnpm prisma generate

# 初始化数据库
pnpm prisma db push
```

### 配置环境变量

创建 `.env` 文件：

```bash
# NextAuth.js (生成随机密钥: openssl rand -base64 32)
AUTH_SECRET=your-secret-key-change-in-production
NEXTAUTH_URL=http://localhost:3000

# 数据库（SQLite）
DATABASE_URL="file:./prisma/dev.db"

# 文件存储
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# AI 配置（可选）
# OPENAI_API_KEY=sk-xxx
# ANTHROPIC_API_KEY=sk-ant-xxx
# OLLAMA_BASE_URL=http://localhost:11434
```

### 启动开发服务器

```bash
pnpm dev
```

访问 [http://localhost:3000](http://localhost:3000)

### 其他命令

```bash
# 构建生产版本
pnpm build

# 启动生产服务器
pnpm start

# 代码检查
pnpm lint

# 运行测试
pnpm test              # 单元测试
pnpm test:watch        # 监听模式
pnpm test:coverage     # 覆盖率报告
pnpm test:e2e          # E2E 测试
pnpm test:e2e:ui       # E2E UI 模式
```

## 📁 项目结构

```
nextpost/
├── app/                        # Next.js App Router
│   ├── (auth)/                # 认证布局组
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (main)/                # 主布局组
│   │   ├── layout.tsx         # 侧边栏布局
│   │   ├── page.tsx           # 仪表盘
│   │   ├── calendar/page.tsx
│   │   ├── posts/
│   │   ├── accounts/page.tsx
│   │   └── settings/page.tsx
│   ├── api/                   # Route Handlers
│   │   ├── auth/[...nextauth]/
│   │   ├── accounts/
│   │   ├── posts/
│   │   └── settings/
│   ├── layout.tsx             # 根布局
│   └── globals.css
├── components/                 # 组件
│   ├── ui/                    # 通用 UI 组件
│   └── Sidebar.tsx            # 侧边栏
├── lib/                       # 工具库
│   ├── auth.ts               # NextAuth.js 配置
│   └── prisma.ts             # Prisma Client
├── stores/                    # Zustand Store
│   ├── authStore.ts
│   └── uiStore.ts
├── prisma/
│   └── schema.prisma          # 数据库 schema
├── tests/                     # 测试文件
│   ├── setup.ts
│   ├── api/                  # API 测试
│   ├── components/           # 组件测试
│   ├── stores/               # Store 测试
│   └── e2e/                  # E2E 测试
└── docs/                     # 文档
    ├── PROJECT_PLAN.md
    ├── TEST_PLAN.md
    └── UI_DESIGN.md
```

## 🗄️ 数据库模型

### User（用户）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 主键 (CUID) |
| username | string | 用户名（唯一） |
| password | string | 密码（bcrypt 加密） |
| email | string | 邮箱（可选） |
| aiProvider | string | AI 提供商 |
| aiApiKey | string | API Key |
| aiModel | string | 默认模型 |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

### Post（帖子 = 内容 + 计划）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 主键 |
| userId | string | 所属用户 |
| accountId | string | 关联账号 |
| content | string | 文本内容 |
| mediaUrls | string | 媒体文件 URL 列表 (JSON) |
| scheduledTime | DateTime | 计划发布时间 |
| timezone | string | 时区 |
| status | string | draft/scheduled/published/failed |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

### Account（社交账号）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 主键 |
| userId | string | 所属用户 |
| platformId | string | 平台 ID |
| name | string | 账号名称 |
| handle | string | 账号 handle |
| description | string | 备注描述 |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

## 🔌 API 接口

### 认证

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/auth/register | 用户注册 |
| POST | /api/auth/[...nextauth] | NextAuth.js 路由 |

### 账号管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/accounts | 获取账号列表 |
| POST | /api/accounts | 创建账号 |
| GET | /api/accounts/:id | 获取详情 |
| PATCH | /api/accounts/:id | 更新账号 |
| DELETE | /api/accounts/:id | 删除账号 |

### 帖子管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/posts | 获取帖子列表 |
| POST | /api/posts | 创建帖子 |
| GET | /api/posts/:id | 获取详情 |
| PATCH | /api/posts/:id | 更新帖子 |
| DELETE | /api/posts/:id | 删除帖子 |
| GET | /api/posts/stats | 获取统计 |

## 🧪 测试

项目使用 Vitest 进行单元测试，Playwright 进行 E2E 测试。

```bash
# 运行所有测试
pnpm test

# 运行 E2E 测试
pnpm test:e2e

# 生成覆盖率报告
pnpm test:coverage
```

## 📝 开发笔记

### 常见问题

**Q: Prisma 客户端未生成？**
```bash
pnpm prisma generate
```

**Q: 数据库迁移？**
```bash
pnpm prisma db push    # 推送到数据库
pnpm prisma studio     # 打开数据库可视化工具
```

**Q: 清除缓存？**
```bash
rm -rf .next node_modules/.prisma
pnpm prisma generate
```

## 📄 许可证

MIT License

---

*文档更新时间：2026-06-01*