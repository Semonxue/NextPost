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

### MCP API Key 管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/settings/external-keys | 获取 Key 列表 |
| POST | /api/settings/external-keys | 创建新 Key |
| GET | /api/settings/external-keys/reveal?id=xxx | 查看完整 Key |
| DELETE | /api/settings/external-keys/:id | 删除 Key |

## 🤖 MCP 外部集成

### 概述

NextPost 提供外部 MCP Server，允许第三方应用（如 Claude Desktop）通过 MCP 协议访问帖子数据、发布结果回传等功能。

### 架构

```
┌─────────────────┐     MCP 协议      ┌─────────────────┐
│  Claude Desktop │ ◄───────────────► │  NextPost MCP   │
│   或其他 MCP    │                   │   Server        │
│    客户端      │                   │  (外部服务)     │
└─────────────────┘                   └────────┬────────┘
                                                │
                                          API Key 认证
                                                │
                                        ┌────────▼────────┐
                                        │   NextPost       │
                                        │   数据库         │
                                        └─────────────────┘
```

### 功能

- **list_accounts** - 获取当前用户的社交账号列表（脱敏）
- **get_pending_posts** - 获取待发布的帖子列表
- **get_post_detail** - 获取帖子详情（含完整内容）
- **report_publish_result** - 第三方报告发布结果

### 启动 MCP Server

NextPost 提供两种 MCP 端点方式，**推荐使用集成端点**：

#### 方式一：集成端点（推荐）

只需要运行 `pnpm dev`，NextPost 会自动在端口 3000 提供 MCP 端点：

```
http://localhost:3000/api/mcp
```

**优势**：
- ✅ 一次启动兼顾 Web + MCP 两个服务
- ✅ 更简单的部署和运维
- ✅ 无需额外配置端口转发

**配置示例：**
```json
{
  "mcpServers": {
    "nextpost": {
      "url": "http://localhost:3000/api/mcp",
      "headers": {
        "Authorization": "Bearer npk_你的APIKey"
      }
    }
  }
}
```

#### 方式二：独立 MCP Server（可选）

启动独立的 MCP Server（端口 3100）：

```bash
# 1. 在设置页面创建 API Key
#    访问 /settings → 外部 API Key → 创建 Key

# 2. 启动 MCP Server
pnpm mcp:external

# 3. MCP 端点: http://localhost:3100
```

#### API Key 获取

访问 `/settings` → 外部 API Key → 创建 Key

### MCP 工具详细说明

#### list_accounts
```json
{
  "name": "list_accounts",
  "description": "获取用户已添加的社交账号列表",
  "inputSchema": {
    "type": "object",
    "properties": {},
    "required": []
  }
}
```

#### get_pending_posts
```json
{
  "name": "get_pending_posts", 
  "description": "获取待发布的帖子列表",
  "inputSchema": {
    "type": "object",
    "properties": {
      "limit": { "type": "number", "description": "返回数量限制" }
    }
  }
}
```

#### get_post_detail
```json
{
  "name": "get_post_detail",
  "description": "获取帖子详情",
  "inputSchema": {
    "type": "object", 
    "properties": {
      "postId": { "type": "string", "description": "帖子 ID" }
    },
    "required": ["postId"]
  }
}
```

#### report_publish_result
```json
{
  "name": "report_publish_result",
  "description": "报告第三方发布结果",
  "inputSchema": {
    "type": "object",
    "properties": {
      "postId": { "type": "string" },
      "publishToken": { "type": "string" },
      "status": { "type": "string", "enum": ["success", "failed", "partial"] },
      "externalPostId": { "type": "string" },
      "externalPostUrl": { "type": "string", "description": "外部帖子链接（发布成功时提供，可点击打开）" },
      "errorCode": { "type": "string" },
      "errorMessage": { "type": "string" },
      "publishedAt": { "type": "string" }
    },
    "required": ["postId", "publishToken", "status"]
  }
}
```

### 发布结果回传示例

第三方平台发布成功后调用：
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "report_publish_result",
    "arguments": {
      "postId": "clx123abc",
      "publishToken": "tok_abc123",
      "status": "success",
      "externalPostId": "twitter_12345",
      "publishedAt": "2026-06-01T10:00:00Z"
    }
  }
}
```

### 错误码

**可重试错误 (RETRYABLE_ERRORS)**
- `rate_limit` - 限流
- `network_error` - 网络错误
- `timeout` - 超时
- `service_unavailable` - 服务不可用

**不可重试错误 (NON_RETRYABLE_ERRORS)**
- `content_violation` - 内容违规
- `auth_expired` - 认证过期
- `duplicate_content` - 重复内容
- `account_suspended` - 账号被封

### MCP 客户端配置指南

NextPost MCP Server 支持标准的 MCP 协议，以下是各客户端的配置方法。

#### 配置要点

| 配置项 | 说明 |
|--------|------|
| `url` | MCP Server 端点地址 |
| `Authorization` | Bearer Token 认证，值为你的 API Key |
| `Content-Type` | 必须为 `application/json` |

**API Key 获取：** 访问 `/settings` → 外部 API Key → 创建 Key

#### Claude Desktop

编辑 `~/.claude/claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "nextpost": {
      "url": "http://localhost:3000/api/mcp",
      "headers": {
        "Authorization": "Bearer npk_你的APIKey",
        "Content-Type": "application/json"
      }
    }
  }
}
```

#### Cherry Studio

1. 打开设置 → MCP 服务器
2. 点击「添加 MCP 服务」
3. 填写配置：

```json
{
  "name": "NextPost",
  "url": "http://localhost:3000/api/mcp",
  "headers": {
    "Authorization": "Bearer npk_你的APIKey",
    "Content-Type": "application/json"
  }
}
```

#### VS Code / Cursor (Cline / Continue)

编辑 `.vscode/mcp.json` 或项目配置：

```json
{
  "mcpServers": {
    "nextpost": {
      "url": "http://localhost:3000/api/mcp",
      "headers": {
        "Authorization": "Bearer npk_你的APIKey"
      }
    }
  }
}
```

#### OpenCode

编辑 `opencode.json` 或通过配置界面添加：

```json
{
  "mcp": {
    "servers": {
      "nextpost": {
        "url": "http://localhost:3000/api/mcp",
        "auth": "Bearer npk_你的APIKey"
      }
    }
  }
}
```

#### Zed Editor

编辑 `~/.config/zed/mcp.json`：

```json
{
  "mcpServers": {
    "nextpost": {
      "url": "http://localhost:3000/api/mcp",
      "headers": {
        "Authorization": "Bearer npk_你的APIKey"
      }
    }
  }
}
```

#### 其他通用客户端

标准 MCP 配置格式：

```json
{
  "mcpServers": {
    "nextpost": {
      "url": "http://localhost:3000/api/mcp",
      "headers": {
        "Authorization": "Bearer npk_你的APIKey"
      }
    }
  }
}
```

或使用 SSE 传输模式：

```json
{
  "mcpServers": {
    "nextpost": {
      "url": "http://localhost:3000/api/mcp",
      "transportType": "sse",
      "headers": {
        "Authorization": "Bearer npk_你的APIKey"
      }
    }
  }
}
```

#### 常见问题

**Q: 连接失败？**
- 确保 NextPost 服务已启动：`pnpm dev`
- 检查端口 3000 是否被占用
- 确认 API Key 格式正确（以 `npk_` 开头）

**Q: 认证失败？**
- API Key 必须通过 `Authorization: Bearer` 头传递
- Key 过期或被删除后需要重新创建

**Q: 跨域问题？**
- 如果客户端和 Server 不在同一域名，可能需要配置 CORS
- 开发环境可使用 `http://localhost:3000`

### 💬 AI 对话示例

通过 MCP 集成，你可以让 AI 助手帮你管理社交媒体内容。以下是一些对话示例：

#### 场景 1：查看今日发布计划

**用户：** 今天有哪些帖子需要发布？

**AI：** 让我帮你查看一下今天的发布计划。

[调用 `get_pending_posts` 工具]

根据查询结果，今天有 **2 个帖子**需要发布：

1. **@twitter_marketing** - 9:00 AM
   内容：「618 大促倒计时！错过等一年，点击领取专属优惠」
   媒体：图片 × 1

2. **@wechat_official** - 2:00 PM  
   内容：「新品上市 | 夏日必备清凉好物来袭」
   媒体：视频 × 1

需要我帮你检查这些帖子的发布时间吗？

---

#### 场景 2：创建新帖子

**用户：** 帮我创建一条小红书帖子，内容是关于夏季防晒产品的推广，明天上午10点发布

**AI：** 好的，我来帮你创建这条帖子。

请问：
1. 你想关联哪个小红书账号？
2. 需要附带产品图片吗？

**用户：** 关联 @beauty_brand，使用产品图1.jpg

**AI：** 明白了，让我创建这条帖子。

[调用 `list_accounts` 工具确认账号存在]

已创建帖子：
- 📌 **小红书** - @beauty_brand
- 📅 明天 10:00 AM
- 📝 内容：「夏日防晒指南 | 5 款实测好物推荐 ☀️
   
点击查看详情...
   
#夏季 #防晒 #美妆

」
- 🖼️ 附带 1 张图片

帖子状态：**已计划**  
Publish Token：`tok_a1b2c3d4...`

如果第三方平台发布成功，会自动更新状态为「已发布」。

---

#### 场景 3：检查发布状态

**用户：** 昨天发的那条推文状态怎么样？

**AI：** 让我查询一下发布状态。

[调用 `get_post_detail` 查看帖子详情]

📊 **发布状态报告**

帖子 ID：`clx123abc`  
状态：`published` ✅  
实际发布时间：2026-05-31 14:23:07  
外部帖子 ID：`twitter_987654321`

帖子内容：「新品发布倒计时！🎉」
- 发布成功 ✅

如果状态是 `failed`，会显示错误原因，你可以决定是否重试。

---

#### 场景 4：处理发布失败

**用户：** 有一条帖子发布失败了，帮我看看是什么原因

**AI：** 让我查看一下帖子详情。

[调用 `get_post_detail`]

📋 **帖子信息**

ID：`clx789xyz`  
内容：「限时优惠活动开始了！」
状态：`failed` ❌  
错误码：`rate_limit`  
错误信息：`API rate limit exceeded, please retry after 1 hour`

**解决方案：**

这是可重试的错误（限流），你可以：
1. 等待 1 小时后自动重试
2. 或者修改发布时间，避开高峰时段

需要我帮你调整发布时间吗？

---

#### 场景 5：批量操作

**用户：** 帮我看看这周发布了哪些内容

**AI：** 让我查询一下本周的发布记录。

[调用 `get_pending_posts` 获取本周所有帖子]

📊 **本周发布报告（5/26 - 6/1）**

| 平台 | 账号 | 发布时间 | 状态 |
|------|------|----------|------|
| Twitter | @marketing | 5/26 10:00 | ✅ 已发布 |
| 小红书 | @beauty | 5/27 14:00 | ✅ 已发布 |
| 微信 | @official | 5/28 09:00 | ✅ 已发布 |
| Twitter | @marketing | 5/29 15:00 | ✅ 已发布 |
| 小红书 | @beauty | 5/30 11:00 | ❌ 失败 |
| 微信 | @official | 6/1 10:00 | ⏳ 待发布 |

**统计：**
- 总计：6 条帖子
- 已发布：4 条
- 失败：1 条
- 待发布：1 条

---

### publishToken 详解

**什么是 publishToken？**

`publishToken` 是一个安全令牌，格式为 `tok_xxxxxxxx`，用于验证发布结果回传的合法性。

**工作流程：**

```
1. AI 通过 get_pending_posts 获取帖子
   → 返回 publishToken (tok_xxx)

2. 第三方平台发布成功后
   → 调用 report_publish_result(postId, publishToken, status)

3. 系统验证 token 匹配后
   → 更新帖子状态为 "published"
   → 记录 externalPostId、publishedAt 等信息
```

**为什么需要 token？**

- **安全验证**：确保只有拿到 token 的请求才能更新帖子状态
- **防止伪造**：第三方无法冒充其他帖子更新状态
- **幂等性**：同一个 token 只能更新对应的帖子

**使用示例：**

```json
// 1. AI 获取帖子（含 token）
{
  "id": "clx123abc",
  "content": "Hello World",
  "publishToken": "tok_01d725b11ed74fbde350766ee364041b",
  "scheduledTime": "2026-06-01T10:00:00Z"
}

// 2. 发布成功后回传
{
  "method": "tools/call",
  "params": {
    "name": "report_publish_result",
    "arguments": {
      "postId": "clx123abc",
      "publishToken": "tok_01d725b11ed74fbde350766ee364041b",
      "status": "success",
      "externalPostId": "twitter_123456",
      "publishedAt": "2026-06-01T10:02:30Z"
    }
  }
}

// 3. 如果发布失败
{
  "arguments": {
    "postId": "clx123abc",
    "publishToken": "tok_01d725b11ed74fbde350766ee364041b",
    "status": "failed",
    "errorCode": "rate_limit",
    "errorMessage": "API rate limit exceeded"
  }
}
```

### 对话技巧

1. **明确指定平台** - 如「小红书」「Twitter」可加快查询
2. **提供时间范围** - 如「这周」「今天」「本月」
3. **指定账号** - 如「用 @beauty_brand 账号发」
4. **询问状态** - 「发布成功了吗？」会帮你检查状态

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