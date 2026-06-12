# NextPost MCP 设计文档

## 版本信息

| 版本 | 日期 | 说明 |
|------|------|------|
| v0.2 | 2026-06-01 | 初始版本，包含外部 MCP Server 设计 |
| **v0.2.1** | **2026-06-01** | **Phase 1 MVP 实现完成** |
| **v0.2.2** | **2026-06-01** | **添加 externalPostUrl 必填说明，修复发布回传问题** |
| **v0.2.3** | **2026-06-01** | **mediaUrls 返回完整 HTTP URL，CLI 可直接下载；集成端点替代独立服务** |
| **v0.4** | **2026-06-02** | **MCP 写能力 MVP**：新增 `upload_media_from_url` / `create_post` / `update_post` 三个写工具（v0.4 初版 update_post 仅支持 scheduledTime / timezone）；引入 Scope 权限系统（`read` / `write` / `read_write` 三档）；写工具受字段白名单 + 状态锁双重保护 |
| **v0.4.1** | **2026-06-02** | **本地媒体上传**：新增 `upload_media_from_path`（本地文件路径直接读取）和 `upload_media_from_base64`（base64 编码数据，上限 5MB）两个写工具 |
| **v0.4.2** | **2026-06-02** | **扩展 update_post**：支持通过外部 MCP 修改 content 和 mediaUrls，方便 AI 辅助编辑内容 |
| **v0.4.8** | **2026-06-04** | **端口单一源（APP_URL）**：所有 URL 概念（基础 URL / MCP 端点 / 媒体 URL 拼接）从 `APP_URL` env 派生（`src/lib/config.ts` 中 `getAppUrl()` / `getMcpEndpointUrl()` helper）；`dev.mjs` 启动时自动注入；默认端口 3000 → 3456。**`NEXT_PUBLIC_BASE_URL` 不再是用户可配覆盖项**——它是 `dev.mjs` 派生的 env。 |
| **v0.5.2** | **2026-06-11** | **`get_pending_posts` 时间窗口过滤**：新增可选参数 `windowMinutes`（integer，默认 60，范围 0~43200）。以服务端当前时间为中心的对称窗口 `[now-N, now+N]`，只返回 `scheduledTime` 落在区间内的待发帖子。仅影响 `get_pending_posts`，其他工具 / API / 数据库零改动。⚠️ **破坏性变更**：不传该参数时，默认只返回 ±1 小时内的帖子（旧行为：返回全部）；客户端可显式传 `43200` 还原旧行为。详见 [V0.5.2.md](./V0.5.2.md)。 |
| **v0.5.3** | **2026-06-12** | **report_publish_result 使用服务端时间**：成功（success / partial）时忽略外部 CLI 回传的 publishedAt，统一改用 NextPost 服务端收到回传时的 Date.now() 作为 Post.publishedAt。解决外部 CLI 死机 / 断网重试导致的发布时间漂移问题。publishedAt 入参字段保留以维持 schema 向后兼容（标注为已废弃，服务端忽略）。详见 [V0.5.3.md](./V0.5.3.md)。 |

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

**设计理念**：外部 AI 可能已经有 Twitter/X 的发布能力，NextPost 负责：
1. **提供计划数据**：让外部 AI 知道要发布什么（v0.2 起的 `list_accounts` / `get_pending_posts` / `get_post_detail`）
2. **接收发布结果**：外部发布后回调通知（v0.2 起的 `report_publish_result`）
3. **创建/更新计划**（v0.4 新增）：让外部 AI 在 NextPost 里直接排期，不必切到 Web UI

**特点**：
- 本地部署友好，无需公网 Webhook
- 同步模式：一次一个发布
- API Key 多用户隔离
- **v0.4 写能力受 scope 权限控制**：默认 `read` 只能读，写操作需要 `write` 或 `read_write` scope
- **v0.4 写工具受字段白名单 + 状态锁保护**：防止 AI 篡改已发布内容、误换账号、误改状态

### 1.2 内部 MCP Server（Phase 2）

**设计理念**：用户在 NextPost 设置页面与 AI 对话，AI 帮助管理发布计划。

**特点**：
- 全功能 CRUD
- 软删除机制（防止 AI 误删）
- 操作审计

---

## 二、外部 MCP Server 工具定义

### 2.1 工具清单

**读取工具（read scope）**

| 工具 | 描述 | 权限 |
|------|------|------|
| `list_accounts` | 获取账号列表（脱敏） | read |
| `get_pending_posts` | 获取待发布帖子（v0.5.2 起支持时间窗口过滤） | read |
| `get_post_detail` | 获取帖子详情 | read |
| `report_publish_result` | 报告发布结果 | read |

**写工具（write / read_write scope，v0.4 / v0.4.1，共 5 个）**

| 工具 | 描述 | 权限 | 版本 |
|------|------|------|------|
| `upload_media_from_url` | 服务端拉 URL 媒体存盘 | write | v0.4 |
| `upload_media_from_path` | 从本地文件路径读取媒体存盘 | write | v0.4.1 |
| `upload_media_from_base64` | 从 base64 编码数据上传媒体 | write | v0.4.1 |
| `create_post` | 创建 scheduled 帖子 | write | v0.4 |
| `update_post` | 限制性更新（v0.4.2 起支持 content / mediaUrls + scheduledTime / timezone） | write | v0.4 / v0.4.2 |

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

#### 2.2.2 get_pending_posts（v0.5.2 起支持 windowMinutes 时间窗口）

```typescript
// 工具定义（v0.5.2 更新）
{
  name: "get_pending_posts",
  description: "获取待发布的帖子列表，按计划时间排序。返回 accountId，请务必在发布前核对账号信息，避免发错账号。publishToken 用于后续 report_publish_result 验证。mediaUrls 返回完整 HTTP URL，CLI 可直接下载。v0.5.2 起支持 windowMinutes 参数，不传时默认 60（±1 小时），只返回当前时间前后 N 分钟内的待发帖子，适合定时轮询发布场景。",
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
      },
      windowMinutes: {                  // v0.5.2 新增
        type: "integer",
        description: "以当前时间为中心的对称时间窗口（分钟），只返回 scheduledTime 落在 [now-N, now+N] 区间内的帖子。取值 0~43200（30 天），默认 60（1 小时）。适合定时轮询发布场景，避免一次返回太多。",
        default: 60,
        minimum: 0,
        maximum: 43200
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
      "platform": "Twitter",                              // v0.5.1 新增
      "title": "",                                        // v0.5 新增（小红书等平台必需）
      "content": "这是一条测试推文",
      "mediaUrls": ["https://nextpost.example.com/uploads/2026-06-01/image.jpg"],
      "scheduledTime": "2026-06-01T15:00:00+08:00",
      "timezone": "Asia/Shanghai",
      "publishToken": "tok_xxx",                          // 用于回传验证
      "extractedTopics": ["xxx"]                          // v0.5 新增（从 content 提取的 #hashtag）
    }
  ]
}
```

**v0.5.2 时间窗口逻辑**：

```typescript
// 服务端伪代码
const now = Date.now();
const windowMs = windowMinutes * 60_000;
const lower = new Date(now - windowMs);
const upper = new Date(now + windowMs);

where.scheduledTime = {
  gte: lower,
  lte: upper,
};
```

**验证规则**：

| 取值 | 处理 |
|---|---|
| 不传 / `undefined` | 应用默认 60 |
| `null` / 字符串 / 布尔 / 对象 | 返回 `INVALID_ARGUMENT` |
| `NaN` / `Infinity` | 返回 `INVALID_ARGUMENT` |
| 小数 / 负数 / `> 43200` | 返回 `INVALID_ARGUMENT` |
| `0 ~ 43200` 整数 | 接受 |

**破坏性变更提示**：
- v0.5.0 及之前：不传 `windowMinutes` 返回所有 scheduled 帖子
- v0.5.2 起：不传 `windowMinutes` 仅返回 `±60min` 内的帖子
- 还原旧行为：显式传 `windowMinutes: 43200`

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
  description: "报告发布结果。必须提供正确的 publishToken 才能更新帖子状态。成功时 status=\"success\"，失败时 status=\"failed\" 并提供错误码。【关键】成功时必须回传 externalPostUrl（可点击的完整链接，格式如 https://x.com/user/status/123），不能只传 externalPostId，否则 NextPost 界面无法显示跳转按钮。",
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
        description: "（v0.5.3 起已废弃，服务端忽略）保留字段仅为向后兼容。NextPost 在标记 status=published 时始终使用服务端时间 (Date.now()) 写入 Post.publishedAt，避免外部 CLI 死机重试 / 时钟漂移导致的时间不一致。"
      },
      externalPostId: {
        type: "string",
        description: "外部平台帖子 ID（如 Twitter tweet ID），可选"
      },
      externalPostUrl: {
        type: "string",
        description: "【必须】外部帖子完整 URL，用于在浏览器打开，如 https://x.com/user/status/123。必须提供此字段才能在 NextPost 界面显示跳转按钮"
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
    required: ["postId", "publishToken", "status", "externalPostUrl"]
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

> ⚠️ **重要**：成功发布时必须回传 `externalPostUrl`（完整 URL），不能只传 `externalPostId`。否则 NextPost 界面无法显示"查看已发布内容"的跳转按钮。

#### 2.2.5 upload_media_from_url（v0.4 新增）

```typescript
{
  name: "upload_media_from_url",
  description: "从公网 URL 拉取媒体文件存入 NextPost，返回可在 create_post 中使用的 URL。需要 write 或 read_write 权限。文件大小上限 10MB，仅支持图片/视频。",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "媒体文件公网 URL（http/https）" },
      filename: { type: "string", description: "可选，自定义文件名" }
    },
    required: ["url"]
  }
}

// 成功返回
{
  "url": "/api/uploads/2026-06-02/abc123.png",
  "mimeType": "image/png",
  "size": 84321,
  "filename": "sunscreen.png"
}

// 失败返回（含 errorCode + 可选 retryable）
{
  "error": "file too large: 20971520 > 10485760",
  "errorCode": "FILE_TOO_LARGE"
}
// 或
{
  "error": "fetch returned 503",
  "errorCode": "FETCH_FAILED",
  "retryable": true   // 5xx 才会带 true，4xx 不会
}
```

**服务端处理流程**：
1. 校验 `url` 非空、是合法 http/https URL
2. `fetch(url)` 拉取
3. 优先用 `content-length` 头判断是否超 10MB（提前拒绝，节省带宽）
4. 拉完后用实际字节数二次校验
5. 校验 `content-type` 是否在白名单（image/jpeg|png|gif|webp, video/mp4|webm）
6. 推断文件扩展名（按 mime），调用现有 `uploadFile()` 走 `LocalStorageEngine`
7. 返回 `{ url, mimeType, size, filename }`

#### 2.2.6 create_post（v0.4 新增）

```typescript
{
  name: "create_post",
  description: "创建一个新的 scheduled 帖子。需要 write 或 read_write 权限。",
  inputSchema: {
    type: "object",
    properties: {
      accountId: { type: "string", description: "关联账号 ID" },
      content: { type: "string" },
      mediaUrls: { type: "array", items: { type: "string" } },
      scheduledTime: { type: "string", description: "ISO 8601，必须是未来时间" },
      timezone: { type: "string", description: "默认 Asia/Shanghai" }
    },
    required: ["accountId", "scheduledTime"]
  }
}

// 成功返回
{
  "success": true,
  "post": {
    "id": "clx_post_abc",
    "accountId": "acct_xyz",
    "accountDisplayName": "我的小红书",
    "content": "夏日防晒指南",
    "mediaUrls": ["/api/uploads/2026-06-02/abc.png"],
    "scheduledTime": "2026-06-02T10:00:00.000Z",
    "timezone": "Asia/Shanghai",
    "status": "scheduled",
    "publishToken": "tok_01d725b1..."   // 重要：发布后回传要用
  }
}

// 失败返回
{
  "success": false,
  "error": "scheduledTime must be in the future",
  "errorCode": "SCHEDULED_TIME_IN_PAST"
}
```

**服务端校验顺序**（任何一步失败立即返回，不写库）：
1. `accountId` 必须属于当前用户、未软删
2. `content` 与 `mediaUrls` 至少一个非空
3. `scheduledTime` 是合法 ISO 字符串
4. `scheduledTime` 必须 > 当前时间
5. `publishToken` 用 `tok_<uuid32hex>` 格式生成（与 `/api/posts` 行为一致）
6. `timezone` 缺省填 `Asia/Shanghai`
7. 创建 Post（status='scheduled'），返回完整数据

#### 2.2.7 update_post（v0.4 新增，v0.4.2 扩展）

```typescript
{
  name: "update_post",
  description: "更新 draft/scheduled 帖子的内容、媒体或发布时间。只能修改白名单字段。",
  inputSchema: {
    type: "object",
    properties: {
      postId: { type: "string" },
      content: { type: "string", description: "帖子正文" },
      mediaUrls: {
        type: "array",
        items: { type: "string" },
        description: "媒体 URL 列表（需先用 upload_media_from_* 工具上传）"
      },
      scheduledTime: { type: "string", description: "计划发布时间，ISO 8601 格式" },
      timezone: { type: "string", description: "时区，如 Asia/Shanghai" }
    },
    required: ["postId"]
  }
}

// 成功返回
{
  "success": true,
  "post": {
    "id": "clx_post_abc",
    "accountId": "acct_xyz",
    "accountDisplayName": "我的小红书",
    "content": "更新后的内容",
    "mediaUrls": ["/api/uploads/2026-06-02/abc.png"],
    "scheduledTime": "2026-06-02T15:00:00+08:00",
    "timezone": "Asia/Shanghai",
    "status": "scheduled",
    "publishToken": "tok_01d725b1..."
  }
}

// 失败返回
{
  "success": false,
  "error": "cannot update post in status 'published'",
  "errorCode": "INVALID_STATUS"
}
```

**服务端处理流程**：
1. 校验 `postId` 属于当前用户、未软删
2. **状态锁**：必须是 `draft` 或 `scheduled`，否则返回 `INVALID_STATUS`
3. **字段白名单**：服务端只接受 `content`、`mediaUrls`、`scheduledTime` 和 `timezone`；`accountId` 和 `status` **直接忽略**，不会写库
4. **内容校验**：`content` 与 `mediaUrls` 至少有一个非空，否则返回 `EMPTY_CONTENT`
5. `scheduledTime` 必须是未来时间
6. 执行 `prisma.post.update({ data: 白名单字段 })`
7. 返回更新后的 post

**v0.4.2 扩展说明**：
- 原来只支持修改 `scheduledTime` 和 `timezone`，方便 AI 辅助编辑
- 现在额外支持 `content`（帖子正文）和 `mediaUrls`（媒体 URL 列表）
- 媒体 URL 需先用 `upload_media_from_url` / `upload_media_from_path` / `upload_media_from_base64` 上传后获得
- `accountId` 仍不可改（防止 AI 误换账号）；`status` 仍不可改（防止绕过状态机）

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
      │       externalPostUrl: "https://...", │  ⚠️ 必须提供完整 URL
      │       externalPostId: "123456"        │  可选
      │     )                                  │
      │  ──────────────────────────────────► │
      │                                      │
      │  ◄────────────────────────────────── │
      │     { received: true, status: "updated" }
      │                                      │
      │  4. 用户在 NextPost 看到发布成功      │
      │     并可点击跳转按钮查看              │
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

### 3.4 Scope 权限系统（v0.4 新增）

v0.4 起，每个 API Key 都有一个 `scope` 字段，决定它能调用哪些工具。Scope 解析在 `validateApiKey` 中完成，连同 `userId` 一起返回：

```typescript
// src/mcp/external/auth.ts
export type Scope = 'read' | 'write' | 'read_write';

export function parseScope(permissions: string | null): Scope {
  switch (permissions) {
    case 'write':        return 'write';
    case 'read_write':   return 'read_write';
    case 'read':
    case 'read_report':  // 兼容 v0.2 历史值
    case null:
    case undefined:
    default:             return 'read';  // 安全默认
  }
}

export function hasScope(scope: Scope, required: 'read' | 'write'): boolean {
  if (required === 'read')  return scope === 'read' || scope === 'read_write';
  if (required === 'write') return scope === 'write' || scope === 'read_write';
  return false;
}
```

**三档 scope 对照表**：

| scope | 读取工具（4） | 写工具（5，v0.4 / v0.4.1） | 典型用途 |
|-------|--------------|-----------------|----------|
| `read`（默认） | ✅ | ❌ | 监控类客户端、只读面板 |
| `write` | ❌ | ✅ | 纯写自动化（需要时单独签发） |
| `read_write` | ✅ | ✅ | 通用 AI Agent（推荐） |

**服务端执行点**（`src/mcp/external/tools.ts` 的 `executeTool`）：

```typescript
// 每个工具声明需要的 scope
const TOOL_SCOPE: Record<string, 'read' | 'write'> = {
  list_accounts: 'read',
  get_pending_posts: 'read',
  get_post_detail: 'read',
  report_publish_result: 'read',
  // v0.4
  upload_media_from_url: 'write',
  create_post: 'write',
  update_post: 'write',
  // v0.4.1
  upload_media_from_path: 'write',
  upload_media_from_base64: 'write',
};

// 执行前检查
if (!hasScope(ctx.scope, required)) {
  return { errorCode: 'INSUFFICIENT_SCOPE', error: '...' };
}
```

**权限不足时返回示例**（HTTP 200，因为这是工具级错误，不是 transport 级）：

```json
{
  "error": "Tool 'create_post' requires 'write' or 'read_write' scope, but key has 'read'",
  "errorCode": "INSUFFICIENT_SCOPE"
}
```

**为什么三层防护（scope + 字段白名单 + 状态锁）？**
- **scope 防止越权**：read-only key 根本调不到写工具
- **字段白名单防止 AI 改危险字段**：即使有 write 权限，也只能改白名单内字段（v0.4.2 起含 content / mediaUrls / scheduledTime / timezone），accountId / status 不可改
- **状态锁防止改已发布内容**：publishing/published/failed 状态下服务端拒绝任何更新
- 三层叠加 = 单一层被绕过的风险被其它层兜住

### 3.5 写工具安全约束（v0.4 新增）

| 约束 | 适用工具 | 实现位置 |
|------|---------|---------|
| **不提供 delete** | （无） | 工具列表里根本没有删除工具；所有删除走 Web UI 软删除 |
| **字段白名单** | `update_post` | 服务端 `updatePost()` 只接受白名单内字段（v0.4.2 起含 `content` / `mediaUrls` / `scheduledTime` / `timezone`），白名单外（`accountId` / `status`）静默忽略 |
| **状态锁** | `update_post` | 服务端 `updatePost()` 检查 `existing.status ∈ {draft, scheduled}`，否则 `INVALID_STATUS` |
| **账号归属校验** | `create_post` | 服务端 `prisma.account.findFirst({ userId, deletedAt: null })` |
| **未来时间校验** | `create_post` / `update_post` | `scheduledTime > Date.now()`，否则 `SCHEDULED_TIME_IN_PAST` |
| **URL 协议白名单** | `upload_media_from_url` | 只允许 `http:` / `https:`，否则 `INVALID_URL` |
| **MIME 白名单** | `upload_media_from_url` | 6 种 image/video，否则 `UNSUPPORTED_MIME` |
| **大小限制** | `upload_media_from_url` | 10MB（与 `/api/media/upload` 一致），否则 `FILE_TOO_LARGE` |
| **windowMinutes 校验**（v0.5.2 新增）| `get_pending_posts` | 必须 integer、0 ≤ N ≤ 43200，否则 `INVALID_ARGUMENT` |

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

> **v0.5.2 备注**：`windowMinutes` 参数是 MCP 工具层参数，不入库。Post 模型零改动。

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

> ⚠️ **v0.4 重要变更**：外部 MCP **不提供** `delete` 操作。所有删除只能通过 Web UI 走软删除（`/api/posts/:id` DELETE → 设置 `deletedAt`）。删除后可在 `/api/trash` 查看、恢复或永久删除。所以本节的"AI 删除"实际只对**内部 MCP**（Phase 2）有意义。

### 5.3 写工具防护（v0.4 新增）

`update_post` 的字段白名单 + 状态锁是写在服务端的硬约束，不依赖客户端的"自觉"：

```typescript
// 字段白名单实现（v0.4.2 起 content / mediaUrls 也加入白名单）
const data: Record<string, unknown> = {};
if (content !== undefined) {        // v0.4.2: 帖子正文可改
  data.content = content;
}
if (mediaUrls !== undefined) {      // v0.4.2: 媒体列表可改
  data.mediaUrls = JSON.stringify(mediaUrls);
}
if (scheduledTime !== undefined) {  // v0.4: 计划时间可改
  data.scheduledTime = new Date(scheduledTime);
}
if (timezone !== undefined) {       // v0.4: 时区可改
  data.timezone = timezone;
}
// 客户端传 accountId / status 仍然被忽略（白名单外）
// 不抛错（保持向后兼容），但不会写库

// 状态锁
if (existing.status !== 'draft' && existing.status !== 'scheduled') {
  return { errorCode: 'INVALID_STATUS' };
}
```

> **设计哲学**：宁可"AI 改不动"，也不要"AI 误改"。改不了可以让 AI 重建，误改会污染已发布状态、绕过审核。

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

### 8.4 v0.5.2 时间窗口 — 轮询发布模式（推荐）

v0.5.2 起，建议 AI 客户端使用 `windowMinutes` 实现**轮询发布**，每 N 分钟拉一次：

```bash
# 示例：cron 每 1 分钟拉一次窗口 ±1min 的帖子（极低延迟发布）
* * * * * curl -X POST http://localhost:3456/api/mcp \
  -H "Authorization: Bearer npk_xxx" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_pending_posts","arguments":{"windowMinutes":1,"limit":5}}}'
```

```bash
# 示例：cron 每 5 分钟拉一次窗口 ±5min 的帖子（降低调用频率）
*/5 * * * * curl ... -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_pending_posts","arguments":{"windowMinutes":5,"limit":10}}}'
```

> **设计权衡**：
> - `windowMinutes` ≈ cron 间隔 × 1.5 ~ 2 倍可避免漏发
> - 例如 cron 每 5 分钟一次，`windowMinutes: 10` 可保证不漏

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

### 9.3 windowMinutes 校验错误（v0.5.2 新增）

```typescript
// 负数 / 小数 / 字符串 / 超上限 / NaN
{
  "error": "windowMinutes must be an integer between 0 and 43200",
  "errorCode": "INVALID_ARGUMENT"
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

## 十一、实现说明

### 11.1 已实现文件

| 文件 | 说明 |
|------|------|
| `src/mcp/external/types.ts` | 类型定义（错误码、脱敏数据结构、Scope、WriteResult） |
| `src/mcp/external/auth.ts` | API Key 认证（验证、生成、删除、列表）+ Scope 解析 |
| `src/mcp/external/tools.ts` | MCP 工具实现（v0.4 / v0.4.1：4 读 + 5 写 = 9 个工具 + scope 强制 + 字段白名单 + 状态锁） |
| `src/mcp/external/server.ts` | MCP Server 主入口（基于 @modelcontextprotocol/sdk） |
| `src/app/api/mcp/route.ts` | Next.js 集成 MCP 端点（带 scope 透传） |
| `src/app/api/settings/external-keys/route.ts` | API Key 管理接口 |
| `tests/mcp/external.test.ts` | 单元测试（基础：14 用例） |
| `tests/mcp/auth-coverage.test.ts` | Scope 解析 / hasScope 单元测试 |
| `tests/mcp/tools-coverage.test.ts` | 9 个工具 + scope 强制 + URL/媒体校验 + windowMinutes 全量单元测试 |
| `tests/e2e/mcp.spec.ts` | E2E 测试 |

### 11.2 启动方式

```bash
# 安装依赖后运行
pnpm install

# 启动 MCP Server（需要先设置 MCP_API_KEY 环境变量）
MCP_API_KEY=npk_your_key_here pnpm mcp:external
```

### 11.3 测试覆盖

```bash
# 运行所有测试
pnpm test

# 运行 MCP 相关测试
pnpm test -- tests/mcp/

# 运行 E2E 测试
pnpm test:e2e -- tests/e2e/mcp.spec.ts

# 覆盖率报告
pnpm test:coverage
```

**v0.5.2 覆盖率**（`mcp/external/`）：

| 文件 | Stmts | Branches | Funcs | Lines |
|------|-------|----------|-------|-------|
| `auth.ts` | 100% | 96.55% | 100% | 100% |
| `tools.ts` | ≥ 80% | ≥ 80% | ≥ 80% | ≥ 80% |

总计 ≥ 100 个 mcp 单元测试（含 windowMinutes 13 个新用例），全量测试 0 失败。

### 11.4 数据库更新

如果数据库中没有 `ExternalApiKey` 表，需要运行：

```bash
pnpm prisma db push
```

> **v0.5.2 备注**：本次更新无需迁移数据库。

### 11.5 集成端点与独立服务

NextPost 提供两种 MCP 端点方式，推荐使用集成端点：

#### 方式一：集成端点（推荐）

只需要运行 `pnpm dev`，NextPost 会自动在端口 3456 提供 MCP 端点：

```
http://localhost:3456/api/mcp
```

**配置示例**：
```json
{
  "mcpServers": {
    "nextpost": {
      "url": "http://localhost:3456/api/mcp",
      "headers": {
        "Authorization": "Bearer npk_你的APIKey"
      }
    }
  }
}
```

**优势**：
- ✅ 一次启动兼顾 Web + MCP 两个服务
- ✅ 更简单的部署和运维
- ✅ 无需额外配置端口转发

#### 方式二：独立 MCP Server

启动独立的 MCP Server（端口 3100）：

```bash
# 设置环境变量并启动
MCP_API_KEY=npk_xxx npx tsx src/mcp/external/server.ts
```

### 11.6 mediaUrls 完整 URL 说明

`get_pending_posts` 和 `get_post_detail` 返回的 `mediaUrls` 现在是**完整的 HTTP URL**，CLI 可以直接下载：

**返回示例**：
```json
{
  "mediaUrls": [
    "http://localhost:3456/uploads/2026-06-01/video.mp4",
    "http://localhost:3456/uploads/2026-06-01/image.jpg"
  ]
}
```

**URL 拼接规则**：
- 相对路径（如 `/uploads/xxx.mp4`）自动拼接基础 URL
- 完整 URL（以 `http://` 或 `https://` 开头）保持不变
- 基础 URL 从 `APP_URL` 环境变量获取（dev.mjs 启动时自动注入 `NEXT_PUBLIC_BASE_URL`），默认 `http://localhost:3456`

### 11.7 客户端缓存说明

⚠️ **MCP 客户端会缓存工具定义**

如果修改了工具的 schema（如添加/修改字段），客户端可能使用旧的缓存定义。解决方案：

1. **重启 MCP Server**（杀掉旧进程后启动新进程）
2. **断开并重新连接 MCP 连接**
3. **清除客户端缓存**（部分客户端支持）

验证工具定义是否生效：
```bash
curl -s http://localhost:3456/api/mcp -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | \
  jq '.result.tools[] | select(.name == "get_pending_posts") | .description'
```

### 11.8 externalPostUrl 字段说明

`report_publish_result` 工具中 `externalPostUrl` 是**必填字段**：

| 场景 | externalPostUrl | externalPostId |
|------|-----------------|----------------|
| 成功发布 | ✅ 必须提供完整 URL | 可选 |
| 发布失败 | ❌ 不需要 | ❌ 不需要 |
| 部分成功 | ✅ 必须提供完整 URL | 可选 |

**正确示例**：
```json
{
  "postId": "post_xxx",
  "publishToken": "tok_xxx",
  "status": "success",
  "externalPostUrl": "https://x.com/user/status/123456789",
  "publishedAt": "2026-06-01T10:00:00Z"
}
```

**错误示例**（AI 常见错误）：
```json
{
  "postId": "post_xxx",
  "publishToken": "tok_xxx",
  "status": "success",
  "externalPostId": "123456789"
  // ❌ 缺少 externalPostUrl，NextPost 界面无法显示跳转按钮
}
```

### 11.9 windowMinutes 时间窗口实现细节（v0.5.2）

**实现位置**：`src/mcp/external/tools.ts`

**核心代码片段**：

```typescript
const DEFAULT_WINDOW_MINUTES = 60;
const MAX_WINDOW_MINUTES = 43200;

export function validateWindowMinutes(
  value: unknown,
): { ok: true; value: number } | { ok: false; error: string } {
  if (value === undefined) return { ok: true, value: DEFAULT_WINDOW_MINUTES };
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return { ok: false, error: 'windowMinutes must be an integer between 0 and 43200' };
  }
  if (value < 0 || value > MAX_WINDOW_MINUTES) {
    return { ok: false, error: `windowMinutes must be an integer between 0 and ${MAX_WINDOW_MINUTES}` };
  }
  return { ok: true, value };
}

async function getPendingPosts(
  userId: string,
  accountId?: string,
  limit: number = 10,
  windowMinutes: number = DEFAULT_WINDOW_MINUTES,
): Promise<ExternalPost[]> {
  const where: Record<string, unknown> = {
    userId,
    status: 'scheduled',
    deletedAt: null,
    scheduledTime: { not: null },
  };

  if (accountId) where.accountId = accountId;

  // v0.5.2 时间窗口过滤
  const now = Date.now();
  where.scheduledTime = {
    gte: new Date(now - windowMinutes * 60_000),
    lte: new Date(now + windowMinutes * 60_000),
  };

  // ... 后续查询不变
}
```

**影响范围**：仅 `get_pending_posts`。其他工具 / API / 数据库零改动。

---

*文档生成时间：2026-06-01*
*最后更新：2026-06-11 - v0.5.2 get_pending_posts 时间窗口过滤（windowMinutes）*