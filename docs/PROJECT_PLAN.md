# NextPost - 社媒帖子发布计划工具

## 版本信息

| 版本 | 日期 | 说明 |
|------|------|------|
| v0.1 | 2026-05-31 | MVP 基础版本：用户认证、账号管理、帖子管理、日历/列表视图、媒体上传 |
| **v0.2** | 2026-06-01 | **MCP 集成**：外部 MCP Server、外部 API Key 管理、发布回传机制 |
| **v0.3** | 2026-06-01 | **软删除 + 回收站**：所有删除走软删除，提供回收站页面，可恢复或永久删除 |
| **v0.4** | **2026-06-02** | **MCP 写能力 MVP**：新增 `upload_media_from_url` / `create_post` / `update_post` 三个写工具；引入 Scope 权限系统（`read` / `write` / `read_write` 三档）；写工具受字段白名单 + 状态锁双重保护 |
| **v0.4.1** | **2026-06-02** | **本地媒体上传**：新增 `upload_media_from_path`（本地文件路径）和 `upload_media_from_base64`（base64 编码数据，上限 5MB）两个写工具 |
| **v0.4.2** | **2026-06-02** | **扩展 update_post**：支持通过外部 MCP 修改 content 和 mediaUrls，方便 AI 辅助编辑内容 |


---

## 概述

NextPost 是一个可视化社媒内容发布计划管理工具，帮助用户规划、管理多平台多账号的社交媒体发布计划，支持 AI 辅助编辑和 MCP 集成。

---

## 需求清单

### 第一期（MVP）

| 序号 | 功能模块 | 详细描述 | 优先级 |
|------|---------|---------|--------|
| 1 | **多用户账号系统** | 简化的用户注册/登录（无需 OAuth），每个用户独立数据 | P0 |
| 2 | **Twitter 账号管理** | 用户手动输入账号信息（不调用 Twitter API） | P0 |
| 3 | **内容创作** | 创建帖子内容（文本/图片/视频，支持草稿） | P0 |
| 4 | **计划调度** | 单次计划，精确到分钟 | P0 |
| 5 | **日历视图** | 按月/周/日展示发布计划，支持账号/平台筛选，点击日期可快速添加 | P0 |
| 6 | **列表视图** | 表格形式展示所有计划，支持状态筛选、账号/平台筛选 | P0 |
| 7 | **计划编辑** | 修改/删除已有计划 | P0 |
| 8 | **媒体管理** | 上传/预览图片和视频，文件存储 | P1 |
| 9 | **发布 Webhook** | 预留发布接口，第三方服务触发 | P0 |
| 9b | **软删除 + 回收站（v0.3）** | 所有删除操作走软删除（设置 `deletedAt`），提供回收站页面，可恢复或永久删除 | P0 |


### 第二期（MCP 集成）

| 序号 | 功能模块 | 详细描述 | 优先级 |
|------|---------|---------|--------|
| 10 | **外部 MCP Server** | 提供读取和发布回传接口，供外部 AI 调用 | P1 |
| 11 | **外部 API Key 管理** | 用户生成和管理 MCP 访问密钥 | P1 |
| 10b | **MCP 写能力 MVP（v0.4）** | 新增 `upload_media_from_url` / `create_post` / `update_post` 三个写工具（v0.4.1 新增 path/base64 两个上传变体；v0.4.2 起 update_post 支持 content / mediaUrls 可改），让外部 AI 直接在 NextPost 排期 | P1 |
| 10c | **API Key Scope 权限（v0.4）** | 三档 scope：`read`（默认）/ `write` / `read_write`；写工具受字段白名单 + 状态锁双重保护 | P1 |
| 12 | **内部 MCP Server** | 全功能 AI 辅助工具（Phase 2） | P2 |
| 13 | **AI 操作软删除** | AI 删除操作设为软删除，用户可在回收站恢复（Phase 2） | P2 |

### 第三期（AI 辅助增强）

| 序号 | 功能模块 | 详细描述 | 优先级 |
|------|---------|---------|--------|
| 14 | AI Chat 界面 | 对话式交互，AI 理解用户意图 | P1 |
| 15 | 工具定义 | AI 可调用的内置工具（增删改查计划等） | P1 |
| 16 | 流式响应 | SSE 实现打字机效果 | P1 |
| 17 | 多平台支持 | Instagram / LinkedIn / Facebook 等 | P2 |
| 18 | 周期性计划 | 支持每天/每周/每月重复 | P2 |
| 19 | Twitter OAuth | 真实 Twitter 账号授权绑定 | P2 |
| 20 | 团队协作 | 多用户、权限管理 | P2 |
| 21 | 数据统计 | 发布效果分析、报表 | P3 |

---

## 技术架构

### 技术栈（Next.js 方案）

| 层级 | 技术选型 | 说明 |
|------|---------|------|
| 框架 | Next.js App Router | 前后端统一框架 |
| 语言 | TypeScript | 类型安全 |
| 样式 | Tailwind CSS | 原子化 CSS |
| 状态管理 | Zustand | 轻量级状态管理 |
| API | Next.js Route Handlers | 内置 API 路由 |
| 数据库 | Prisma + SQLite | 环境变量切换（SQLite/PostgreSQL） |
| 认证 | NextAuth.js | 简化认证，支持 Credentials |
| AI | OpenAI / Anthropic / Ollama | 多提供商支持 |
| 流式 | Server-Sent Events (SSE) | AI 打字效果 |

### Next.js 最佳实践

| 实践 | 说明 |
|------|------|
| 服务端组件 | 页面容器、数据获取用 Server Component |
| 客户端组件 | 表单交互、AI 对话用 Client Component |
| 路由分组 | `(auth)` 认证组、`(main)` 主布局组 |
| 中间件 | 统一认证检查、路由保护 |
| 优化 | `next/image` 图片、`next/font` 字体 |

### 文件存储架构

系统支持多种存储引擎，通过环境变量 `STORAGE_ENGINE` 切换：

| 存储引擎 | 环境变量值 | 说明 |
|---------|-----------|------|
| 本地存储 | `local` | 文件存储在 `./uploads/` 目录 |
| S3 兼容 | `s3` | AWS S3 或兼容存储（如 MinIO） |
| R2 | `r2` | Cloudflare R2 对象存储 |

#### 存储接口设计

```typescript
// src/lib/storage/types.ts
interface StorageEngine {
  upload(file: Buffer, filename: string, mimeType: string): Promise<string>;
  delete(url: string): Promise<void>;
  getUrl(path: string): string;
  exists(path: string): Promise<boolean>;
}

// src/lib/storage/local.ts - 本地存储实现
// 文件存储在 ./uploads/YYYY-MM-DD/filename.ext
// 访问 URL: /uploads/YYYY-MM-DD/filename.ext

// src/lib/storage/index.ts - 统一导出
export async function uploadFile(file: Buffer, filename: string, mimeType: string): Promise<UploadResult>;
export async function deleteFile(url: string): Promise<void>;
```

#### API 接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/media/upload | 上传媒体文件（multipart/form-data） |
| DELETE | /api/media/:path | 删除媒体文件 |

### 系统架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         NextPost 系统架构                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      Next.js App Router                         │    │
│  │  ┌──────────────────────────────────────────────────────────┐   │    │
│  │  │  (auth) 布局组           │         (main) 布局组          │   │    │
│  │  │  · 登录页                │  · 仪表盘 · 日历 · 列表         │   │    │
│  │  │  · 注册页                │  · 账号 · AI对话 · 设置         │   │    │
│  │  └──────────────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      MCP Server 层                              │    │
│  │  ┌─────────────────────┐      ┌─────────────────────┐          │    │
│  │  │   外部 MCP Server   │      │   内部 MCP Server   │          │    │
│  │  │   (受限功能)         │      │   (全功能)           │          │    │
│  │  │   · 账号只读         │      │   · 账号 CRUD       │          │    │
│  │  │   · 帖子只读         │      │   · 帖子 CRUD       │          │    │
│  │  │   · 发布回传         │      │   · 媒体管理        │          │    │
│  │  │   · API Key 认证     │      │   · 对话管理        │          │    │
│  │  └─────────────────────┘      └─────────────────────┘          │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                  Next.js Route Handlers                         │    │
│  │  ┌──────────────┐  ┌────────┴────────┐  ┌──────────────┐        │    │
│  │  │  业务 API    │  │   AI 服务层     │  │  外部 API    │        │    │
│  │  │ · accounts   │  │ · Chat 端点     │  │ · API Keys  │        │    │
│  │  │ · posts       │  │ · 流式响应     │  │ · 回传处理  │        │    │
│  │  │ · media       │  │ · 上下文管理   │  │             │        │    │
│  │  │ · auth        │  │ · Tool 路由    │  │             │        │    │
│  │  └──────────────┘  └────────────────┘  └──────────────┘        │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      AI Clients                                  │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │    │
│  │  │ Claude      │  │  OpenCode   │  │  本地 AI    │              │    │
│  │  │ Desktop     │  │  (外部)      │  │  (内部)     │              │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘              │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## AI 模块详细设计

### 工具定义（Tools）

AI 可调用的内置工具，用于操作业务数据：

```typescript
// tools/post.tools.ts
const postTools = [
  {
    name: 'list_posts',
    description: '获取用户的帖子列表',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        accountId: { type: 'string' }
      }
    }
  },
  {
    name: 'create_post',
    description: '创建新帖子',
    parameters: {
      type: 'object',
      required: ['accountId', 'content'],
      properties: {
        accountId: { type: 'string' },
        content: { type: 'string' },
        scheduledTime: { type: 'string' },
        mediaUrls: { type: 'array', items: { type: 'string' } }
      }
    }
  },
  {
    name: 'update_post',
    description: '修改帖子内容或时间',
    parameters: {
      type: 'object',
      required: ['postId'],
      properties: {
        postId: { type: 'string' },
        content: { type: 'string' },
        scheduledTime: { type: 'string' },
        mediaUrls: { type: 'array', items: { type: 'string' } }
      }
    }
  },
  {
    name: 'delete_post',
    description: '删除帖子',
    parameters: {
      type: 'object',
      required: ['postId'],
      properties: {
        postId: { type: 'string' }
      }
    }
  }
];

// tools/account.tools.ts
const accountTools = [
  {
    name: 'list_accounts',
    description: '获取用户的社交账号列表',
    parameters: { type: 'object', properties: {} }
  },
  {
    name: 'create_account',
    description: '添加新的社交账号',
    parameters: {
      type: 'object',
      required: ['name', 'handle'],
      properties: {
        name: { type: 'string' },
        handle: { type: 'string' },
        description: { type: 'string' }
      }
    }
  }
];
```

### 流式响应实现（SSE）

```typescript
// app/api/ai/chat/route.ts
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const { messages } = await request.json();
  
  const stream = new ReadableStream({
    async start(controller) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [...systemPrompt, ...messages],
        stream: true,
      });
      
      for await (const chunk of completion) {
        controller.enqueue(new TextEncoder().encode(
          chunk.choices[0]?.delta?.content || ''
        ));
      }
      controller.close();
    }
  });
  
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' }
  });
}
```

### 工具执行流程

```
用户: "帮我把明天下午3点的计划改成5点"
     ↓
┌─────────┐      ┌─────────────┐      ┌────────────────┐
│  GPT-4  │ ──▶ │ 解析意图    │ ──▶  │ 调用 Tool      │
│        │      │ update_time │      │ update_post    │
└─────────┘      └─────────────┘      └────────────────┘
     │                                        │
     │ 工具结果                                │
     ↓                                        ↓
┌─────────┐      ┌─────────────┐      ┌────────────────┐
│  GPT-4  │ ──▶ │ 格式化回复  │ ──▶  │ 返回给用户      │
│ (总结)   │      │             │      │                │
└─────────┘      └─────────────┘      └────────────────┘
```

---

## 数据模型

### User（用户）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 主键 (CUID) |
| username | string | 用户名（唯一） |
| password | string | 密码（bcrypt 加密） |
| email | string | 邮箱（可选） |
| aiProvider | string | AI 提供商（openai/anthropic/ollama） |
| aiApiKey | string | API Key（加密存储） |
| aiModel | string | 默认模型 |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

### Account（Twitter 账号）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 主键 |
| userId | string | 所属用户 |
| name | string | 账号名称（用户自定义） |
| handle | string | Twitter handle（@xxx） |
| description | string | 备注描述 |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

### Post（帖子 = 内容 + 计划合并）⭐

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 主键 |
| userId | string | 所属用户 |
| accountId | string | 关联账号 |
| content | string | 文本内容 |
| mediaUrls | string[] | 媒体文件 URL 列表 |
| scheduledTime | DateTime | 计划发布时间（精确到分钟） |
| timezone | string | 时区（默认 Asia/Shanghai） |
| status | enum | draft/scheduled/published/failed |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

### Media（媒体）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 主键 |
| userId | string | 上传用户 |
| type | enum | image/video |
| url | string | 文件路径（如 `/uploads/xxx.jpg`） |
| filename | string | 原始文件名 |
| size | number | 文件大小（字节） |
| mimeType | string | MIME 类型 |
| uploadedAt | DateTime | 上传时间 |

### Conversation（AI 对话）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 主键 |
| userId | string | 所属用户 |
| title | string | 对话标题 |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

### Message（AI 消息）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 主键 |
| conversationId | string | 关联对话 |
| role | enum | user/assistant/system |
| content | string | 消息内容 |
| toolCalls | json | 工具调用记录（数组） |
| toolResults | json | 工具执行结果（数组） |
| model | string | 使用的模型（如 gpt-4） |
| createdAt | DateTime | 创建时间 |

---

## 目录结构（Next.js）

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
│   │   │   ├── page.tsx        # 列表视图
│   │   │   ├── new/page.tsx   # 创建
│   │   │   └── [id]/edit/page.tsx
│   │   ├── accounts/page.tsx
│   │   ├── chat/page.tsx
│   │   └── settings/page.tsx
│   ├── api/                   # Route Handlers
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── accounts/route.ts
│   │   ├── posts/route.ts
│   │   ├── media/upload/route.ts
│   │   └── ai/chat/route.ts
│   ├── layout.tsx             # 根布局
│   └── globals.css
├── components/                 # 组件
│   ├── ui/                    # 通用 UI
│   ├── chat/                  # AI 对话
│   ├── calendar/              # 日历
│   └── post/                  # 帖子
├── lib/                       # 工具库
│   ├── auth.ts               # NextAuth.js 配置
│   ├── prisma.ts             # Prisma Client
│   └── openai.ts             # OpenAI Client
├── hooks/                     # 自定义 Hooks
├── stores/                    # Zustand Store
├── prisma/
│   └── schema.prisma
├── public/                    # 静态资源
├── package.json
└── README.md
```

---

## 开发计划（Next.js）

### 阶段 1 - 基础搭建（约 3-5 天）

- [ ] 项目初始化（`npx create-next-app`）
- [ ] 配置 TypeScript + Tailwind CSS
- [ ] Prisma + SQLite 数据库配置
- [ ] NextAuth.js 认证（Credentials）
- [ ] 基础布局（侧边栏 + 路由分组）
- [ ] 基础 Route Handlers 骨架

### 阶段 2 - 核心功能（1-2 周）

- [ ] Twitter 账号管理（CRUD）
- [ ] 内容创建与编辑（富文本/媒体上传）
- [ ] 计划调度（单次，精确到分钟）
- [ ] 日历视图
- [ ] 列表视图

### 阶段 3 - AI 辅助（1-2 周）

- [ ] AI 提供商配置（OpenAI/Anthropic/Ollama）
- [ ] Chat 界面开发（Client Component）
- [ ] 工具定义（post/account/media）
- [ ] 流式响应（SSE）
- [ ] 上下文管理
- [ ] 对话历史持久化

### 阶段 4 - 发布接口（3-5 天）

- [ ] Webhook API（供第三方调用）
- [ ] 发布状态查询
- [ ] 中间件保护

---

## 测试最佳实践

### 测试分层策略

| 测试类型 | 目标 | 覆盖率要求 |
|---------|------|-----------|
| 单元测试 | 纯函数、工具函数、API 处理逻辑 | ≥80% |
| 集成测试 | API 端点、数据库操作 | 关键路径全覆盖 |
| E2E 测试 | 用户实际使用场景 | 核心功能全覆盖 |

### E2E 测试要点

**❌ 避免的错误做法：**
```typescript
// 只检查按钮存在，没有验证功能
test('should show account filter', async ({ page }) => {
  await page.goto('/posts');
  await expect(page.getByRole('button', { name: /账号/i })).toBeVisible();
  // 测试通过，但功能可能不工作！
});
```

**✅ 正确的做法：**
```typescript
// 验证实际功能工作
test('should filter posts by account', async ({ page }) => {
  // 1. 创建测试数据
  await createTestPost({ accountId: 'account-1' });
  await createTestPost({ accountId: 'account-2' });
  
  // 2. 验证列表显示所有帖子
  await page.goto('/posts');
  await expect(page.locator('tbody tr')).toHaveCount(2);
  
  // 3. 点击筛选并验证功能
  await page.getByRole('button', { name: /账号/i }).click();
  await page.getByText('account-1').click();
  
  // 4. 验证筛选结果
  await expect(page.locator('tbody tr')).toHaveCount(1);
});
```

### 常见问题案例

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| 测试通过但功能不工作 | 只测试 UI 元素存在 | 必须测试数据交互和状态变化 |
| API 响应格式不一致 | 前端假设 `data.accounts`，实际返回 `data[]` | 统一响应格式或前端兼容处理 |
| 筛选功能不可用 | 数据解析失败导致列表为空 | 验证 API 调用和数据流 |

### API 响应规范

为避免类似问题，API 响应应遵循统一规范：

```typescript
// ✅ 推荐：统一响应格式
// GET /api/accounts
return NextResponse.json({ 
  accounts: [...],  // 始终使用对象包裹数组
  total: accounts.length 
});

// ⚠️ 避免：返回裸数组
return NextResponse.json(accounts); // 需要前端兼容处理
```

**更新记录：**
- 2026-06-01：新增测试最佳实践章节，记录 E2E 测试常见问题

---

## 环境变量配置

```bash
# .env.local (NextAuth.js)
AUTH_SECRET=your-secret-key-change-in-production
NEXTAUTH_URL=http://localhost:3456

# 数据库（Prisma）
DATABASE_URL="file:./prisma/dev.db"

# 可选：切换到 PostgreSQL
# DATABASE_URL="postgresql://user:pass@localhost:5432/nextpost"

# 文件存储
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# AI 配置（用户可在设置中配置）
# OPENAI_API_KEY=sk-xxx
# ANTHROPIC_API_KEY=sk-ant-xxx
# OLLAMA_BASE_URL=http://localhost:11434
```

---

## API 接口设计

### 认证

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/auth/register | 用户注册 |
| POST | /api/auth/login | 用户登录 |
| GET | /api/auth/me | 获取当前用户 |

### 账号管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/accounts | 获取当前用户的账号列表 |
| POST | /api/accounts | 创建账号 |
| GET | /api/accounts/:id | 获取账号详情 |
| PATCH | /api/accounts/:id | 更新账号 |
| DELETE | /api/accounts/:id | 删除账号 |

### 帖子管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/posts | 获取帖子列表 |
| POST | /api/posts | 创建帖子 |
| GET | /api/posts/:id | 获取详情 |
| PATCH | /api/posts/:id | 更新（内容/时间/状态） |
| DELETE | /api/posts/:id | 删除 |
| GET | /api/posts/stats | 获取统计 |

### 媒体管理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/media/upload | 上传媒体文件 |
| GET | /api/media/:id | 获取媒体信息 |
| DELETE | /api/media/:id | 删除媒体 |

### AI 对话

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/ai/chat | 发送消息（流式响应） |
| GET | /api/ai/messages | 获取对话历史 |
| POST | /api/ai/conversations | 创建新对话 |
| GET | /api/ai/conversations | 获取对话列表 |
| DELETE | /api/ai/conversations/:id | 删除对话 |
| GET | /api/ai/tools | 获取可用工具列表 |

### 发布接口（Webhook）

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/webhook/publish | 触发发布（外部调用） |
| GET | /api/webhook/status/:postId | 查询发布状态 |

### 外部 API Key 管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/settings/external-keys | 获取用户的 API Key 列表 |
| POST | /api/settings/external-keys | 创建新的 API Key |
| DELETE | /api/settings/external-keys/:id | 删除 API Key |
| POST | /api/settings/external-keys/reveal | 查看完整 API Key（仅一次） |

### 回收站（软删除管理，v0.3 新增）

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/trash | 列出已软删除的 Post 和 Account |
| POST | /api/trash/posts/:id/restore | 恢复已软删除的帖子 |
| POST | /api/trash/accounts/:id/restore | 恢复已软删除的账号 |
| DELETE | /api/trash/posts/:id | 永久删除帖子（物理删除+清理媒体） |
| DELETE | /api/trash/accounts/:id | 永久删除账号（物理删除） |

### 软删除设计（v0.3 新增）

#### 设计原则

1. **统一软删除**：`DELETE /api/posts/:id` 和 `DELETE /api/accounts/:id` 改为**软删除**，设置 `deletedAt = new Date()`，`deletedBy = "user"`
2. **过滤生效**：所有列表/详情查询（`findMany`、`findFirst`）默认过滤 `deletedAt: null`，软删除的记录不再出现在业务接口中
3. **可恢复**：通过 `/api/trash/*/restore` 清除 `deletedAt`，记录恢复使用
4. **可永久删除**：通过 `/api/trash/*/delete` 从数据库物理删除，账号下的帖子也会联联删除；帖子的媒体文件也会联联删除
5. **可追溯**：`deletedBy` 区分是用户还是 AI 删除（为 Phase 2 内部 MCP 预留），`deleteNote` 可填入删除原因

#### 软删除状态机

```
active ─── DELETE ──▶ soft_deleted ─── DELETE /api/trash/... ──▶ hard_deleted
  ▲                          │
  └──────── restore ─────────┘
```

#### API 响应

```typescript
// GET /api/trash 响应
{
  posts: [{ id, content, accountId, deletedAt, deletedBy, deleteNote, ... }],
  accounts: [{ id, name, handle, deletedAt, deletedBy, deleteNote, ... }],
  totalPosts: number,
  totalAccounts: number
}
```

#### 媒体文件清理

- 软删除帖子时**不**立即删除媒体文件（避免误删后无法恢复）
- 永久删除帖子时才联联删除媒体文件
- 软删除账号时**不**级联处理帖子（帖子可独立恢复）

#### 回收站 UI

- 路径：`/trash`
- Tab 切换：帖子 / 账号
- 每项显示：类型、原始内容、删除时间、删除者、原因
- 操作：恢复、永久删除
- 永久删除需二次确认
- 空状态插图


---

## 技术选型说明

### 为什么选择这些技术？

| 技术 | 选择原因 |
|------|---------|
| **Next.js** | 前后端统一框架，简化部署，SSR/SSG 支持 |
| **NextAuth.js** | 简化认证，支持多种 Provider |
| **Zustand** | 比 Redux 更轻量，TypeScript 支持好 |
| **SSE** | 简单可靠，比 WebSocket 更适合 AI 流式响应 |
| **Prisma** | 通用数据库连接器，支持 SQLite/PostgreSQL |

### 未来扩展方向

1. **MCP 集成**：当 MCP 生态成熟后，可快速迁移
2. **本地模型**：通过 Ollama 支持完全私有的 AI
3. **多模态**：图片理解、语音交互

---

*文档生成时间：2026-05-31*