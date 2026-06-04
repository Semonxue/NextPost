# MCP 客户端对接指南（v0.5 新增）

> **目标读者**：通过 NextPost MCP Server（`/api/mcp`）对接的 AI 客户端（Claude Desktop / 自主 agent）  
> **版本**：v0.5.0  
> **最后更新**：2026-06-04

---

## 1. 工作流概览

```
┌──────────────┐                ┌─────────────────┐                ┌──────────────┐
│  AI 客户端    │   MCP 协议     │  NextPost 服务  │   HTTP/CLI     │  社交平台     │
│              │ ◀────────────▶ │                 │ ◀────────────▶ │              │
│  Claude      │  /api/mcp      │  帖子规划/调度  │  opencli ...   │  X / XHS     │
│  Desktop     │  JSON-RPC      │  结果回传       │                │  / Instagram │
└──────────────┘                └─────────────────┘                └──────────────┘
```

**NextPost 负责**：帖子规划、调度、状态追踪、媒体托管  
**AI 客户端负责**：拉取待发布帖子 → 调 `opencli` 完成实际发布 → 回传结果

---

## 2. 平台命令对照表

按 `account.platform.name` 选择对应的 `opencli` 命令：

| Platform | 命令 | 必填参数 | 可选参数 |
|---|---|---|---|
| **Twitter** | `opencli twitter post <text> --images <paths>` | `text` | `--images`（最多 4 张） |
| **Xiaohongshu** | `opencli xiaohongshu publish <content> --title T --images <paths>` | `content`, `title`, `images` | `--topics`（逗号分隔）, `--draft` |
| **Instagram**（图） | `opencli instagram post <caption> --media <paths>` | `media` | `caption` |
| **Instagram**（视频） | `opencli instagram reel` | — | — |
| **Instagram**（文字） | `opencli instagram note <content>` | `content` | — |
| **Instagram**（story） | `opencli instagram story` | — | — |

### 2.1 媒体类型判断逻辑

Instagram 的发布命令按媒体类型分 4 种，AI 客户端应：

```python
if account.platform.name == "Instagram":
    media = post["mediaUrls"]
    has_video = any(url_looks_like_video(url) for url in media)
    if has_video:
        cmd = ["opencli", "instagram", "reel"]
    elif len(media) == 0:
        cmd = ["opencli", "instagram", "note", post["content"]]
    else:
        # 图片或图文轮播
        cmd = ["opencli", "instagram", "post", post["content"], "--media", ",".join(media)]
```

### 2.2 标题处理

小红书 **必须**有标题（最多 20 字）。AI 客户端发布前应检查：

```python
if account.platform.name == "Xiaohongshu" and not post.get("title"):
    # 提示用户填写 title，或从 content 第一行截取
    raise Error("小红书需要 title 字段（最多 20 字）")
```

### 2.3 Hashtag 处理

小红书支持 `--topics` 参数（逗号分隔，不含 # 号）。NextPost v0.5 在 MCP 响应中提供 `extractedTopics` 字段（从 `content` 中正则提取），AI 客户端可直接使用：

```python
topics = post.get("extractedTopics", [])
if topics and account.platform.name == "Xiaohongshu":
    cmd += ["--topics", ",".join(topics)]
```

**正则规则**（NextPost 端实现）：`/#([\p{L}\p{N}_]+)/gu`
- 支持中文、英文、数字、下划线
- 例：`"#三里屯 #brunch #2024"` → `["三里屯", "brunch", "2024"]`

---

## 3. 发布后 URL 处理

不同平台发布后拿 URL 的方式不同：

| Platform | 发布后 URL 来源 | 推荐做法 |
|---|---|---|
| **Twitter** | `opencli twitter post` 返回 `id + url` | 直接用 `url` 字段 |
| **Xiaohongshu** | `opencli xiaohongshu publish` **不返回 url** | 方案 A（推荐）：发布成功后调 `opencli xiaohongshu note <note-id>` 拿详情；方案 B：从 `detail` 字符串解析 note-id，拼 `https://www.xiaohongshu.com/explore/<note-id>` |
| **Instagram** | `opencli instagram post/reel/note` 返回 `url` | 直接用 `url` 字段 |

### 3.1 小红书 URL workaround 详解

**方案 A**（推荐，依赖少）：
```bash
# 1. 发布
result=$(opencli xiaohongshu publish "正文" --title "标题" --images "/path/to/img.jpg")
# 2. 从 result 的 detail 字段解析 note-id
note_id=$(echo "$result" | grep -oE '[a-f0-9]{24}' | head -1)
# 3. 拿详情拿 URL
opencli xiaohongshu note "$note_id"
# 4. 提取 url 字段，回传 NextPost
```

**方案 B**（简单，依赖 note-id 解析）：
```python
# 假设 detail 字段含 note-id（如 "发布成功 id=abc123"）
note_id = parse_note_id_from_detail(result["detail"])
external_url = f"https://www.xiaohongshu.com/explore/{note_id}"
```

---

## 4. MCP 工具调用示例

### 4.1 拉取待发布帖子

```json
// 请求
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get_pending_posts",
    "arguments": { "limit": 10 }
  }
}

// 响应（v0.5 新增 title + extractedTopics）
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{
      "type": "text",
      "text": "{\"posts\":[{\"id\":\"...\",\"accountId\":\"...\",\"content\":\"今天去了 #三里屯 #brunch\",\"title\":\"周末探店\",\"mediaUrls\":[\"https://nextpost.example.com/uploads/abc.jpg\"],\"scheduledTime\":\"2026-06-05T19:00:00+08:00\",\"timezone\":\"Asia/Shanghai\",\"publishToken\":\"tok_...\",\"extractedTopics\":[\"三里屯\",\"brunch\"]}]}"
    }]
  }
}
```

### 4.2 报告发布结果

```json
// 请求（success）
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "report_publish_result",
    "arguments": {
      "postId": "...",
      "publishToken": "tok_...",
      "status": "success",
      "publishedAt": "2026-06-05T19:00:30+08:00",
      "externalPostId": "abc123",
      "externalPostUrl": "https://x.com/user/status/abc123"
    }
  }
}
```

**注意**：`externalPostUrl` 必填——NextPost 界面用此字段显示跳转按钮。

---

## 5. 错误码对照

| 错误码 | 含义 | 客户端处理 |
|---|---|---|
| `NOT_AUTHENTICATED` | API Key 缺失/无效 | 检查 Authorization 头 |
| `INSUFFICIENT_SCOPE` | API Key 权限不足 | 提示用户在 NextPost 设置页升级权限 |
| `ACCOUNT_NOT_FOUND` | accountId 不存在或非本用户 | 重新调 `list_accounts` 拿最新列表 |
| `POST_NOT_FOUND` | postId 不存在或令牌不匹配 | 跳过此帖，拉下一条 |
| `INVALID_STATUS` | 帖子状态非 draft/scheduled | 跳过此帖（已发布/失败/正在发布） |
| `EMPTY_CONTENT` | content 与 mediaUrls 同时为空 | 跳过此帖 |
| `INVALID_SCHEDULED_TIME` | scheduledTime 不合法 | 跳过此帖 |
| `SCHEDULED_TIME_IN_PAST` | 计划时间已过 | 跳过此帖 |

---

## 6. 端到端示例（伪代码）

```python
import json
import subprocess
import requests

# 1. MCP 拉待发布帖子
posts = call_mcp("get_pending_posts", {"limit": 10})

for post in posts:
    # 2. 拿账号信息
    account = get_account(post["accountId"])
    platform = account["platform"]["name"]
    
    # 3. 下载媒体
    media_paths = [download(url) for url in post["mediaUrls"]]
    
    # 4. 按平台选 opencli 命令
    if platform == "Twitter":
        cmd = ["opencli", "twitter", "post", post["content"]]
        if media_paths:
            cmd += ["--images", ",".join(media_paths)]
    elif platform == "Xiaohongshu":
        cmd = ["opencli", "xiaohongshu", "publish", post["content"],
               "--title", post.get("title", ""),
               "--images", ",".join(media_paths)]
        if post.get("extractedTopics"):
            cmd += ["--topics", ",".join(post["extractedTopics"])]
    elif platform == "Instagram":
        # ... 按媒体类型选 post/reel/note
        pass
    
    # 5. 执行
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    # 6. 解析结果，构造 externalPostUrl
    parsed = json.loads(result.stdout)
    if platform == "Xiaohongshu":
        # 走 workaround 拿 note-id
        note_id = parse_note_id(parsed["detail"])
        external_url = f"https://www.xiaohongshu.com/explore/{note_id}"
    else:
        external_url = parsed["url"]
    
    # 7. 回传 NextPost
    call_mcp("report_publish_result", {
        "postId": post["id"],
        "publishToken": post["publishToken"],
        "status": "success",
        "externalPostUrl": external_url,
    })
```

---

## 7. 变更日志

| 版本 | 变更 |
|---|---|
| v0.5.0 | 新增 `title` 字段（`create_post` / `update_post` / `get_pending_posts` / `get_post_detail`）；新增 `extractedTopics` 计算字段（`get_pending_posts` / `get_post_detail`）；Xiaohongshu 平台支持 |
| v0.4.2 | `update_post` 支持 `content` / `mediaUrls` |
| v0.4.0 | 新增 `upload_media_from_*` / `create_post` / `update_post` |
| v0.3.0 | 新增 `report_publish_result` / 媒体上传 |
| v0.2.0 | 初始：`list_accounts` / `get_pending_posts` / `get_post_detail` |
