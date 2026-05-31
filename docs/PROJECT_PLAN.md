# NextPost - 社媒帖子发布计划工具

## 概述

NextPost 是一个可视化社媒内容发布计划管理工具，帮助用户规划、管理多平台多账号的社交媒体发布计划，支持未来 AI 辅助编辑。

---

## 需求清单

### 第一期（MVP）

| 序号 | 功能模块 | 详细描述 | 优先级 |
|------|---------|---------|--------|
| 1 | **多用户账号系统** | 简化的用户注册/登录（无需 OAuth），每个用户独立数据 | P0 |
| 2 | **Twitter 账号管理** | 用户手动输入账号信息（不调用 Twitter API） | P0 |
| 3 | **内容创作** | 创建帖子内容（文本/图片/视频，支持草稿） | P0 |
| 4 | **计划调度** | 单次计划，精确到分钟 | P0 |
| 5 | **日历视图** | 按月/周/日展示发布计划 | P0 |
| 6 | **列表视图** | 表格形式展示所有计划，支持筛选排序 | P0 |
| 7 | **计划编辑** | 修改/删除已有计划 | P0 |
| 8 | **媒体管理** | 上传/预览图片和视频，文件存储 | P1 |
| 9 | **发布 Webhook** | 预留发布接口，第三方服务触发 | P0 |

### 第二期（AI 辅助）

| 序号 | 功能模块 | 详细描述 | 优先级 |
|------|---------|---------|--------|
| 10 | AI Chat 界面 | 对话式交互，AI 理解用户意图 | P1 |
| 11 | Tools 定义 | AI 可调用的内置工具（增删改查计划等） | P1 |
| 12 | 流式响应 | SSE 实现打字机效果 | P1 |
| 13 | 多平台支持 | Instagram / LinkedIn / Facebook 等 | P2 |
| 14 | 周期性计划 | 支持每天/每周/每月重复 | P2 |
| 15 | Twitter OAuth | 真实 Twitter 账号授权绑定 | P2 |
| 16 | 团队协作 | 多用户、权限管理 | P2 |
| 17 | 数据统计 | 发布效果分析、报表 | P3 |

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

### 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js App Router                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  (auth) 布局组           │         (main) 布局组          │   │
│  │  · 登录页                │  · 仪表盘 · 日历 · 列表         │   │
│  │  · 注册页                │  · 账号 · AI对话 · 设置         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                     ┌────────┴────────┐                        │
│                     │   AI 组件层      │                        │
│                     │ · ChatWindow    │                        │
│                     │ · MessageList   │                        │
│                     │ · ToolCallUI    │                        │
│                     └────────┬────────┘                        │
└─────────────────────────────┼──────────────────────────────────┘
                              │ SSE / REST API
┌─────────────────────────────┼──────────────────────────────────┐
│                  Next.js Route Handlers                         │
│  ┌──────────────┐  ┌────────┴────────┐  ┌──────────────┐        │
│  │  业务 API    │  │   AI 服务层     │  │  工具层      │        │
│  │ · accounts   │  │ · Chat 端点     │  │ · post       │        │
│  │ · posts       │  │ · 流式响应     │  │ · account    │        │
│  │ · media       │  │ · 上下文管理   │  │ · media      │        │
│  │ · auth        │  │ · Tool 路由    │  │              │        │
│  └──────────────┘  └────────────────┘  └──────────────┘        │
└─────────────────────────────┬──────────────────────────────────┘
                              │
┌─────────────────────────────┼──────────────────────────────────┐
│                      AI Providers                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  OpenAI     │  │  Anthropic  │  │   Ollama    │              │
│  │  (GPT-4)    │  │  (Claude)   │  │  (Local)    │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
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

## 环境变量配置

```bash
# .env.local (NextAuth.js)
AUTH_SECRET=your-secret-key-change-in-production
NEXTAUTH_URL=http://localhost:3000

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