# NextPost 外部 MCP 测试评审报告

> 日期：2026-06-02  
> 评审人：Mavis（自动评审）  
> 范围：`src/mcp/external/` 模块的 v0.3 写能力 MVP 实现

---

## 一、问题起因

v0.3 MCP 写能力 MVP 实现完成后（commit `fc1fa2c`），自动化检查全部绿灯：

| 检查项 | 结果 |
|--------|------|
| `pnpm tsc --noEmit` | ✅ 无错 |
| `pnpm vitest run` | ✅ 262 passed / 0 failed |
| `pnpm test:coverage` | ✅ 89.4% stmts / 84.01% branches |
| `pnpm lint` | ✅ 干净 |

但**实际启动 dev server 后**，浏览器或 `curl` 访问 `/api/mcp` 返回 **500**：

```
⨯ ./src/mcp/external/tools.ts:34:1
Module not found: Can't resolve './auth.js'
> 34 | import { hasScope } from './auth.js';
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
POST /api/mcp 500 in 188ms
```

**262 个单元测试全部通过、`tsc` 干净、ESLint 干净、覆盖率 89.4%——但生产入口 500。**

---

## 二、根本原因分析

### 2.1 直接原因：ESM 严格解析 + 相对 import `.js` 后缀

`src/mcp/external/tools.ts` 和 `src/mcp/external/server.ts` 都有相对 import 写了 `.js` 后缀：

```typescript
// src/mcp/external/tools.ts（修复前）
import type { ... } from './types.js';
import { hasScope } from './auth.js';   // ← 问题 1

// src/mcp/external/server.ts（修复前）
import { TOOLS } from './tools.js';      // ← 问题 2
import { executeTool } from './tools.js'; // ← 问题 3
import { validateApiKey } from './auth.js'; // ← 问题 4
```

### 2.2 为什么单测看不出来

| 运行环境 | TS 文件解析 | `.js` 后缀容忍度 |
|----------|------------|----------------|
| `vitest`（用 `tsx` 转换） | 灵活，`.js` 找不到时回退到同名 `.ts` | ✅ 容忍 |
| `pnpm mcp:external`（tsx runner） | 同上 | ✅ 容忍 |
| `Next.js Turbopack`（生产） | 严格 ESM 解析，`.js` 必须真实存在 | ❌ 报 Module not found |

**单测环境、tsx 脚本环境、生产 Next.js 环境对 `.js` 后缀的容忍度不一致**——这是 TypeScript ESM 项目最经典的坑之一。

### 2.3 为什么 `tsc` 没发现

`tsc --noEmit` 在 `tsconfig.json` 里通常配置 `moduleResolution: "bundler"` 或 `"node"`，对于相对 import 的 `.js` 后缀是**允许的**（因为 Node.js ESM 规范要求 `.js` 后缀，TypeScript 模拟了这个行为）。只有当 `moduleResolution: "node16"` / `"nodenext"` 且目标运行时是 Node ESM 时，`.js` 才是**必填**的。

我们的 `tsconfig.json` 设置对 `.js` 后缀宽容，所以 `tsc` 不会报错。

### 2.4 为什么覆盖率看不出

`vi.mock('@prisma/client')` 拦截了 prisma，但**没有拦截** Next.js 的路由处理或 Turbopack 的模块解析。所以单测 100% 跑的是"逻辑正确"路径，根本没碰到"模块能不能解析"这个前置依赖。

---

## 三、修复方案

### 3.1 修复内容

```diff
 // src/mcp/external/tools.ts
-import type { ... } from './types.js';
-import { hasScope } from './auth.js';
+import type { ... } from './types';
+import { hasScope } from './auth';

 // src/mcp/external/server.ts
-import { TOOLS } from './tools.js';
-import { executeTool } from './tools.js';
-import { validateApiKey } from './auth.js';
+import { TOOLS } from './tools';
+import { executeTool } from './tools';
+import { validateApiKey } from './auth';
```

**3 个文件共 4 处 import 修复**（commit 待提交）。

### 3.2 验证修复有效

写了 `scripts/verify-mcp-e2e.mjs`（已废弃，升级为正式 spec），通过真实 HTTP 调用验证：

| 类别 | 断言数 | 通过率 |
|------|-------|--------|
| 认证（4 项：无效 key / 缺 key / 过期 key / 错格式） | 4 | 4/4 |
| 读取工具（4 个工具的 9 个断言） | 9 | 9/9 |
| 写工具（3 个工具的 12 个断言） | 12 | 11/12 |
| Scope 强制（4 个断言） | 4 | 4/4 |
| 历史值兼容（2 个断言） | 2 | 2/2 |
| **合计** | **31** | **30/31** |

唯一 1 个 fail 是脚本侧问题（脚本测试了 `data:image/png;base64,...` 想验"data: URL 也能上传"，但产品策略**只允许 http/https**——这是正确行为，脚本应改为期待拒绝）。

---

## 四、新增的 HTTP 端点 E2E 测试

将 `scripts/verify-mcp-e2e.mjs` 升级为正式 Playwright spec：`tests/e2e/mcp-http.spec.ts`。

**15 个端到端用例，1.1s 跑完，全部通过**：

| 用例 ID | 覆盖点 |
|---------|-------|
| TC-MCP-HTTP-001 ~ 005 | 认证 4 项 + initialize + tools/list |
| TC-MCP-HTTP-006 ~ 009 | 读取 4 个工具 + 数据隔离 |
| TC-MCP-HTTP-010 ~ 015 | 写工具 3 个 + Scope 强制 + 字段白名单 + 状态锁 + DB 落库验证 |

**与 `tests/e2e/mcp.spec.ts`（弱 E2E）的对比**：

| 维度 | 旧的 `mcp.spec.ts` | 新的 `mcp-http.spec.ts` |
|------|-------------------|----------------------|
| 调用方式 | 验证端点存在 / 字段定义 | 真实 HTTP 调用 7 个工具 |
| DB 验证 | 验证字段存在 | 真实读写 + 二次 `prisma.findUnique` |
| MCP 协议 | 未触发 | JSON-RPC 完整链路 |
| 工具覆盖 | 0/7 | 7/7 + 4 个 Scope 强制 |
| 时间 | <100ms | ~1.1s |

---

## 五、覆盖率更新

| 文件 | 修复前 | 修复后 | 增量 |
|------|-------|-------|------|
| `mcp/external/auth.ts` | 100% / 93.75% | 100% / 96.55% | branches +2.8% |
| `mcp/external/tools.ts` | 93.33% / 82.09% | **98.78% / 87.65%** | stmts +5.5%, branches +5.5% |
| `mcp/external` 整体 | 94.78% / 84.29% | **99.05% / 89.52%** | stmts +4.3%, branches +5.2% |
| **全量** | 89.4% / 84.01% | ~89% / ~84% | 持平 |
| **测试数** | 262 | **269** | +7 |

**新增的 7 个单测**：
- 4 个 mime 推断分支（image/gif, image/webp, video/mp4, video/webm）
- 1 个 `update_post` 非法 scheduledTime 字符串
- 1 个 `listApiKeys` 当 `lastUsedAt` 为 null
- 1 个 filename 显式传入不走 mime 推断

---

## 六、改进建议（流程层面）

### 6.1 短期（CI 兜底）

1. **加一条 CI 步骤**，启动 dev server 后跑 `curl` smoke test：
   ```yaml
   - name: MCP smoke test
     run: |
       pnpm dev &
       sleep 5
       curl -sS -X POST http://localhost:3000/api/mcp \
         -H "Content-Type: application/json" \
         -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' \
         | grep -q "nextpost-external" || exit 1
   ```

2. **新代码必须带 E2E**：所有涉及运行时模块解析的改动（import 路径、`require`、动态 import），除了单测，还必须有一个 Playwright HTTP 调用 spec。**单测覆盖率 89% 救不了一个 500 的 `/api/mcp`**。

### 6.2 中期（架构层面）

3. **统一导入风格**：在 `tsconfig.json` 加 `verbatimModuleSyntax: true` 或 `moduleResolution: "node16"`，强制使用 Node ESM 规范。这样**单测和生产都用同一种解析规则**，单测阶段的 ESM 错误会立刻暴露。

4. **`.harness/` 化项目**：本评审的发现都已收口，但项目还没有专门的 LLM 团队。考虑用 `init-harness` skill 给 NextPost 配一组 reins（编码/测试/评审/架构），把"v0.3 初版没有 HTTP E2E"这类系统性遗漏在 harness 层面挡住。

5. **写工具的 e2e 模板化**：`mcp-http.spec.ts` 写得很扎实，但每个新工具（v0.5+ 还要加的）都要重写一份。可以把"鉴权 / Scope 检查 / 业务逻辑"三层做成 helper，新工具只写业务部分。

### 6.3 长期（产品层面）

6. **考虑做内部"灰度发布"**：v0.3 写能力先以 `read_write` scope 形式发布，让 1-2 个 trusted 内部用户试用，确认安全模型 OK 之后再让 `read` 用户的 key 也能升级。

7. **Settings UI 加 scope 选择器**：当前 `ExternalApiKey.permissions` 是 DB 字段，用户没法自己创建 `read_write` key。下一步可以让用户在 `/settings` 自己选 scope，配合"用 read 调写工具 → 友好提示去改 scope"的 AI 对话示例。

---

## 七、待办（继承自评审报告）

| # | 任务 | 状态 | 备注 |
|---|------|------|------|
| 1 | 修复 `server.ts` 三处 `.js` 后缀 import | ✅ | 4 处 import 修复 |
| 2 | 跑 `verify-mcp-e2e.mjs` 验证修复 | ✅ | 30/31 通过，剩 1 是脚本 bug |
| 3 | 4 个 mime 分支单测 | ✅ | image/gif, image/webp, video/mp4, video/webm |
| 4 | `update_post` INVALID_SCHEDULED_TIME 分支 | ✅ | 非法日期字符串 |
| 5 | `listApiKeys` null lastUsedAt 分支 | ✅ | 覆盖 `\|\| null` 路径 |
| 6 | 写 `tests/e2e/mcp-http.spec.ts` | ✅ | 15 个用例，1.1s 跑完 |
| 7 | 跑全量 vitest ≥ 262 不回归 | ✅ | 269 全部通过 |
| 8 | TEST_PLAN 追加 TC-MCP-HTTP-001~015 | ✅ | 见 5.7c 节 |
| 9 | 写本评审报告 | ✅ | 本文 |

---

## 八、核心教训

> **单测覆盖率 ≠ 生产可用性。**
> 262 个测试 + 89.4% 覆盖率 + 干净 tsc + 干净 lint，**依然救不了一个 import 路径写错的生产 500**。
> E2E（HTTP 真实调用）是不可替代的最后一环——单测验证"逻辑正确"，E2E 验证"这个文件真的能被运行时加载"。

教训的具体应用：

1. **`.js` 后缀 import 在 Next.js + Turbopack 项目里要统一**：要么全用 `.js`（要求真实 `.js` 文件存在或用 bundler 模式），要么全不用（用 `moduleResolution: bundler`）。
2. **新加运行时入口必带 smoke test**：`/api/*` 端点至少一个真实 HTTP 调用断言返回值是 200/401/422，绝不能是 500。
3. **评审要看到 commit 后的 dev server 真实访问日志**，不能只看 CI 报告。

---

*报告生成时间：2026-06-02 01:50*  
*评审范围：commit `fc1fa2c` (v0.3 写能力 MVP) → commit `42900eb` (docs) 之间的所有变更*
