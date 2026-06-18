# 平台配置总览（v0.5 新增）

> **目标读者**：NextPost 开发者 + AI 客户端集成方  
> **最后更新**：2026-06-04

---

## 1. 已支持平台

| 平台 ID | 平台名 | opencli 命令 | 内容限制 | 媒体限制 | 字符算法 | 发布后是否返回 URL |
|---|---|---|---|---|---|---|
| `twitter` | Twitter | `opencli twitter post` | 280 字 | 最多 4 图 / 1 视频 | URL 固定 23 字符 | ✅ 是 |
| `instagram` | Instagram | `opencli instagram post / reel / note / story` | 2200 字 | 最多 10 媒体（图+视频混合） | UTF-16 code units | ✅ 是 |
| `linkedin` | LinkedIn | （暂未开放 opencli） | 3000 字 | 最多 9 图 / 1 视频 | UTF-16 code units | — |
| `facebook` | Facebook | （暂未开放 opencli） | 63206 字 | 最多 10 图 / 1 视频 | UTF-16 code units | — |
| `xiaohongshu` | 小红书 | `opencli xiaohongshu publish` | 1000 字 | 最多 9 图（图文）/ 1 视频 | UTF-16 code units | ❌ 否（需 workaround） |

---

## 2. 单一来源

平台元数据在 `src/lib/platform.ts` 的 `REGISTERED_PLATFORMS` 常量定义，**全应用从这一处派生**：

- `src/lib/db/seed.ts`（DB seed 插入）
- `src/app/api/auth/register/route.ts`（新用户注册时补全）
- `src/app/api/platforms/route.ts`（前端拉列表）

未来加新平台 = 在 `REGISTERED_PLATFORMS` 数组加一条，并在 `DEFAULT_PLATFORM_CONFIG` 加对应 spec。

---

## 3. 各平台发布命令详情

### 3.1 Twitter

```bash
opencli twitter post <text> --images <img1,img2,...>  # 最多 4 张
```

**返回**：`status, message, text, id, url`  
**URL 模板**：`https://x.com/<handle>/status/<id>`

### 3.2 Xiaohongshu（小红书）

```bash
opencli xiaohongshu publish <content> \
  --title "标题"           # 必填，最多 20 字
  --images <img1,img2,...>  # 必填，最多 9 张
  [--topics "话题1,话题2"]  # 可选，逗号分隔，不含 #
  [--draft]                # 可选，保存为草稿
```

**返回**：`status, detail`（**注意：没有 url**）  
**URL 模板**：`https://www.xiaohongshu.com/explore/<note-id>`  
**workaround**：发布后调 `opencli xiaohongshu note <note-id>` 拿详情，再从详情拿 URL；或从 `detail` 字符串解析 note-id 拼 URL。

### 3.3 Instagram

```bash
# 图文轮播
opencli instagram post [<caption>] --media <path1,path2,...>  # 最多 10 个

# 短视频
opencli instagram reel

# 纯文字笔记
opencli instagram note <content>

# Story
opencli instagram story
```

**返回**：`status, detail, url`（图文/reel/note/story）  
**URL 模板**：`https://www.instagram.com/p/<shortcode>/`（图文/视频）或 `https://www.instagram.com/stories/<username>/<id>/`（story）

---

## 4. 字符计数算法

| 平台 | 算法 | 备注 |
|---|---|---|
| Twitter | URL 固定 23 字符 + 其他字符 1 | 兼容历史逻辑 |
| 其他平台 | `[...content].length` | UTF-16 code units |

实现：`src/lib/platform.ts:countCharsFor(platformName, content)`

---

## 5. 添加新平台 checklist

1. 在 `src/lib/platform.ts` 的 `REGISTERED_PLATFORMS` 数组加一条
2. 在 `src/lib/platform.ts` 的 `DEFAULT_PLATFORM_CONFIG` 加对应 spec
3. 跑 `pnpm pnpm db:seed` 同步到 DB
4. 在 `/public/icons/` 加对应 SVG 图标
5. （可选）写 `opencli <platform>` 适配
6. 在 `docs/MCP_CLIENT_GUIDE.md` 加平台命令说明
7. 在 `docs/PLATFORM_CONFIG.md`（本文档）加平台规则
