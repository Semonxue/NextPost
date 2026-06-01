# NextPost MCP 设计文档

## 版本信息

| 版本 | 日期 | 说明 |
|------|------|------|
| v0.2 | 2026-06-01 | 初始版本，包含外部 MCP Server 设计 |

## 概述

本文档描述 NextPost 的 MCP (Model Context Protocol) 集成设计，支持外部 AI 客户端（如 Claude Desktop、OpenCode）调用 NextPost 功能进行社交媒体发布。

---

## 一、架构概览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    NextPost MCP 分层架构                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      内部 MCP Server                            │    │
│  │                        (全功能)                                  │    │
│  │  · 账号 CRUD · 帖子 CRUD · 媒体 · 对话 · 设置                    │    │
│  │  · 用户认证 · 软删除 · AI 操作审计                               │    │
│  │  · Phase 2 实现                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      外部 MCP Server                            │    │
│  │                    (MVP - Phase 1)                              │    │
│  │  · 账号只读（脱敏）· 帖子只读 · 发布回传                         │    │
│  │  · API Key 认证                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.1 外部 MCP Server（Phase 1 - MVP）

**设计理念**：外部 AI 可能已经有 Twitter/X 的发布能力，NextPost 只负责：
1. **提供计划数据**：让外部 AI 知道要发布什么
2. **接收发布结果**：外部发布后回调通知

**特点**：
- 本地部署友好，无需公网 Webhook
- 同步模式：一次一个发布
- API Key 多用户隔离

### 1.2 内部 MCP Server（Phase 2）

**设计理念**：用户在 NextPost 设置页面与 AI 对话，AI 帮助管理发布计划。

**特点**：
- 全功能 CRUD
- 软删除机制（防止 AI 误删）
- 操作审计

---

## 二、外部 MCP Server 工具定义

### 2.1 工具清单

| 工具 | 方法 | 描述 | 权限 |
|------|------|------|------|
| `list_accounts` | 读取 | 获取账号列表（脱敏） | read |
| `get_pending_posts` | 读取 | 获取待发布帖子 | read |
| `get_post_detail` | 读取 | 获取帖子详情 | read |
| `report_publish_result` | 回传 | 报告发布结果 | report |

### 2.2 工具详细定义

#### 2.2.1 list_accounts

```typescript
// 工具定义
{
  name: "list_accounts",
  description: "获取用户配置的所有社交账号（仅返回显示名称，不含敏感信息）",
  inputSchema: {
    type: "object",
    properties: {}
  }
}

// 返回示例
{
  "accounts": [
    {
      "id": "xxx",
      "platform": "twitter",
      "displayName": "我的推特"
    }
  ]
}

// 数据脱敏：只返回 platform 和 displayName，不返回 handle、description 等
```

#### 2.2.2 get_pending_posts

```typescript
// 工具定义
{
  name: "get_pending_posts",
  description: "获取待发布的帖子列表，按计划时间排序",
  inputSchema: {
    type: "object",
    properties: {
      accountId: { 
        type: "string", 
        description: "可选：按账号筛选"
      },
      limit: { 
        type: "number", 
        description: "返回数量，默认 10" 
      }
    }
  }
}

// 返回示例
{
  "posts": [
    {
      "id": "post_xxx",
      "accountId": "acc_xxx",
      "accountDisplayName": "我的推特",
      "content": "这是一条测试推文",
      "mediaUrls": ["/uploads/2026-06-01/image.jpg"],
      "scheduledTime": "2026-06-01T15:00:00+08:00",
      "timezone": "Asia/Shanghai",
      "publishToken": "tok_xxx"  // 用于回传验证
    }
  ]
}
```

#### 2.2.3 get_post_detail

```typescript
// 工具定义
{
  name: "get_post_detail",
  description: "获取单个帖子的完整信息",
  inputSchema: {
    type: "object",
    properties: {
      postId: { 
        type: "string" 
      }
    },
    required: ["postId"]
  }
}

// 返回示例
{
  "post": {
    "id": "post_xxx",
    "accountId": "acc_xxx",
    "accountDisplayName": "我的推特",
    "content": "这是一条测试推文",
    "mediaUrls": ["/uploads/2026-06-01/image.jpg"],
    "scheduledTime": "2026-06-01T15:00:00+08:00",
    "timezone": "Asia/Shanghai",
    "status": "scheduled",
    "publishToken": "tok_xxx"
  }
}
```

#### 2.2.4 report_publish_result

```typescript
// 工具定义
{
  name: "report_publish_result",
  description: "外部 AI 发布完成后报告结果",
  inputSchema: {
    type: "object",
    properties: {
      postId: { 
        type: "string", 
        description: "NextPost 帖子 ID" 
      },
      publishToken: { 
        type: "string", 
        description: "发布令牌，用于验证" 
      },
      status: { 
        type: "string", 
        enum: ["success", "failed", "partial"],
        description: "发布状态" 
      },
      publishedAt: { 
        type: "string", 
        description: "实际发布时间 ISO 8601" 
      },
      externalPostId: { 
        type: "string", 
        description: "外部平台返回的帖子 ID" 
      },
      errorCode: { 
        type: "string", 
        description: "错误码（失败时）" 
      },
      errorMessage: { 
        type: "string", 
        description: "错误信息（失败时）" 
      },
      retryable: { 
        type: "boolean", 
        description: "是否可重试" 
      }
    },
    required: ["postId", "publishToken", "status"]
  }
}

// 返回示例 - 成功
{
  "received": true,
  "postStatus": "published",
  "message": "发布结果已记录"
}

// 返回示例 - 失败
{
  "received": true,
  "postStatus": "failed",
  "message": "发布失败已记录",
  "retryable": true
}
```

### 2.3 发布流程

```
┌─────────────┐                       ┌─────────────┐
│  外部 AI    │                       │  NextPost   │
│  OpenCode   │                       │  External   │
│            │                       │  MCP        │
└─────┬───────┘                       └──────┬──────┘
      │                                      │
      │  1. get_pending_posts()              │
      │  ──────────────────────────────────► │
      │                                      │
      │  ◄────────────────────────────────── │
      │     [{ id, content, publishToken }]   │
      │                                      │
      │  2. 外部 AI 发布到 Twitter/X          │
      │                                      │
      │  3. report_publish_result(            │
      │       postId, publishToken,           │
      │       status: "success",              │
      │       publishedAt: "...",             │
      │       externalPostId: "123456"        │
      │     )                                  │
      │  ──────────────────────────────────► │
      │                                      │
      │  ◄────────────────────────────────── │
      │     { received: true, status: "updated" }
      │                                      │
      │  4. 用户在 NextPost 看到发布成功       │
```

---

## 三、认证机制

### 3.1 多用户 API Key

每个用户可生成多个 API Key，用于不同设备/应用：

```typescript
// ExternalApiKey 模型
interface ExternalApiKey {
  id: string;
  userId: string;
  name: string;           // 密钥名称，如 "Claude Desktop"
  key: string;            // 密钥值，格式: npk_xxx
  permissions: string;    // 权限范围
  lastUsedAt: Date;
  expiresAt: Date;         // 可选过期时间
  createdAt: Date;
}
```

### 3.2 密钥生成

```typescript
// 生成 API Key
async function generateExternalApiKey(userId: string, name: string) {
  const key = crypto.randomBytes(32).toString("hex");
  
  await prisma.externalApiKey.create({
    data: {
      userId,
      name,
      key: `npk_${key}`,
    }
  });
  
  return `npk_${key}`;  // 前缀便于识别
}

// 验证 API Key
async function validateApiKey(key: string) {
  const apiKey = await prisma.externalApiKey.findUnique({
    where: { key },
    include: { user: true }
  });
  
  if (!apiKey) return null;
  if (apiKey.expiresAt && new Date() > apiKey.expiresAt) return null;
  
  // 更新最后使用时间
  await prisma.externalApiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() }
  });
  
  return apiKey.user;
}
```

### 3.3 MCP Server 认证

```typescript
// MCP Server 启动时验证
export async function startExternalServer() {
  const apiKey = process.env.MCP_API_KEY;
  
  if (!apiKey) {
    console.error("MCP_API_KEY is required");
    process.exit(1);
  }
  
  const user = await validateApiKey(apiKey);
  if (!user) {
    console.error("Invalid API Key");
    process.exit(1);
  }
  
  console.log(`External MCP Server started for user: ${user.id}`);
  
  // 所有工具调用都会带上 userId 上下文
  return { userId: user.id };
}
```

---

## 四、数据模型扩展

### 4.1 Post 模型扩展

```prisma
model Post {
  // ... 现有字段
  
  // MCP 发布相关字段
  publishToken     String?                    // 外部发布验证令牌
  publishTokenExp  DateTime?                 // 令牌过期时间
  publishedAt      DateTime?                 // 实际发布时间
  externalPostId   String?                    // 外部平台帖子 ID
  publishError     String?                    // 发布错误信息
  publishAttempts  Int      @default(0)       // 发布尝试次数
  
  // 软删除字段 (Phase 2)
  deletedAt  DateTime?
  deletedBy  String?    // "user" | "ai"
  deleteNote String?
}
```

### 4.2 Account 模型扩展

```prisma
model Account {
  // ... 现有字段
  
  // 软删除字段 (Phase 2)
  deletedAt  DateTime?
  deletedBy  String?    // "user" | "ai"
  deleteNote String?
}
```

---

## 五、安全设计

### 5.1 数据脱敏

| 信息类型 | 内部 MCP | 外部 MCP |
|---------|---------|---------|
| 账号 ID | ✅ | ✅ |
| 平台类型 | ✅ | ✅ |
| 显示名称 | ✅ | ✅ |
| 账号 Handle | ✅ | ❌ |
| 账号描述 | ✅ | ❌ |
| 帖子内容 | ✅ | ✅ |
| 媒体 URL | ✅ | ✅ |
| 发布令牌 | ✅ | ✅ (仅获取时) |

### 5.2 软删除策略（Phase 2）

```typescript
// 软删除状态机
enum DeleteStatus {
  ACTIVE = "active",        // 正常
  SOFT_DELETED = "soft_deleted",  // 待确认
  HARD_DELETED = "hard_deleted"   // 已永久删除
}

// AI 删除操作
async function aiDeletePost(postId: string, reason: string, aiModel: string) {
  await prisma.post.update({
    where: { id: postId },
    data: {
      deletedAt: new Date(),
      deletedBy: "ai",
      deleteNote: reason,
    }
  });
  
  // 记录审计日志
  await prisma.aiOperationLog.create({
    data: {
      operation: "delete",
      entityType: "post",
      entityId: postId,
      aiModel,
    }
  });
}
```

---

## 六、文件结构

```
src/
├── mcp/
│   ├── server.ts              # MCP Server 入口
│   ├── external/
│   │   ├── server.ts          # 外部 MCP Server
│   │   ├── tools.ts           # 外部工具定义
│   │   └── auth.ts            # API Key 认证
│   ├── internal/
│   │   ├── server.ts          # 内部 MCP Server (Phase 2)
│   │   ├── tools.ts           # 工具定义
│   │   ├── auth.ts            # 用户认证
│   │   └── audit.ts           # AI 操作审计
│   └── shared/
│       ├── types.ts           # 共享类型
│       └── prisma.ts          # 数据库操作
├── app/
│   └── api/
│       └── settings/
│           └── external-keys/ # API Key 管理接口
│               └── route.ts
└── lib/
    └── storage/
        └── index.ts           # 文件存储
```

---

## 七、技术依赖

```json
{
  "@modelcontextprotocol/sdk": "^0.5.0"
}
```

---

## 八、使用方式

### 8.1 启动外部 MCP Server

```bash
# 单独进程运行
npm run mcp:external

# 或与 NextPost 一起
npm run dev:mcp
```

### 8.2 Claude Desktop 配置

```json
// ~/.claude-desktop/settings.json 或项目配置
{
  "mcpServers": {
    "nextpost-external": {
      "command": "node",
      "args": ["./dist/mcp/external/server.js"],
      "env": {
        "MCP_API_KEY": "npk_your_api_key_here",
        "DATABASE_URL": "file:./prisma/dev.db"
      }
    }
  }
}
```

### 8.3 用户操作流程

```
┌─────────────────────────────────────────────────────────────────┐
│                    用户使用流程                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 用户在 NextPost 设置页面                                   │
│     设置 → 外部 API 密钥 → [生成密钥]                           │
│                              │                                  │
│                              ▼                                  │
│  2. 复制生成的 API Key                                       │
│     npk_a1b2c3d4e5f6...                                        │
│                              │                                  │
│                              ▼                                  │
│  3. 在 Claude Desktop / OpenCode 配置 MCP                     │
│     填入 API Key                                              │
│                              │                                  │
│                              ▼                                  │
│  4. 用户向 AI 提问                                             │
│     "帮我发布今天的推文"                                       │
│                              │                                  │
│                              ▼                                  │
│  5. AI 调用 MCP 工具获取计划并发布                              │
│     · get_pending_posts() → 获取计划                           │
│     · 发布到 Twitter                                           │
│     · report_publish_result() → 报告结果                       │
│                              │                                  │
│                              ▼                                  │
│  6. NextPost 状态更新                                          │
│     用户在 UI 查看发布结果                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 九、错误处理

### 9.1 发布结果错误码

```typescript
// 可重试错误
const RETRYABLE_ERRORS = [
  "rate_limit",           // 限流
  "network_error",        // 网络错误
  "timeout",              // 超时
  "service_unavailable",  // 服务不可用
];

// 不可重试错误
const NON_RETRYABLE_ERRORS = [
  "content_violation",    // 内容违规
  "auth_expired",         // 认证过期
  "duplicate_content",     // 重复内容
  "account_suspended",    // 账号被封
];
```

### 9.2 API Key 错误

```typescript
// 无效 Key
{
  "error": "Invalid API Key",
  "code": "INVALID_KEY"
}

// Key 过期
{
  "error": "API Key has expired",
  "code": "KEY_EXPIRED"
}

// 权限不足
{
  "error": "Insufficient permissions",
  "code": "PERMISSION_DENIED"
}
```

---

## 十、后续规划

### Phase 1 (MVP) - 当前实现
- [x] 外部 MCP Server
- [x] 外部 API Key 管理
- [x] 发布回传机制

### Phase 2 - 内部 MCP + 安全
- [ ] 内部 MCP Server（全功能）
- [ ] 软删除机制
- [ ] AI 操作审计
- [ ] 回收站页面

---

*文档生成时间：2026-06-01*