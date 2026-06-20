# NextPost 测试计划

## 版本信息

| 版本 | 日期 | 说明 |
|------|------|------|
| v0.1 | 2026-05-31 | MVP 基础版本测试用例 |
| **v0.2** | 2026-06-01 | **MCP 集成测试用例**：API Key、发布回传、MCP 工具、软删除 |
| **v0.3** | 2026-06-01 | **软删除 + 回收站测试用例**：软删除/恢复/永久删除/回收站页面/stats/settings/平台配置/认证补充 |
| **v0.4** | **2026-06-02** | **外部 MCP 写能力测试用例**：`upload_media_from_url` / `create_post` / `update_post` / Scope 权限强制 / 字段白名单 / 状态锁 |
| **v0.4.5** | **2026-06-03** | **覆盖率提升补充测试用例**：`MediaPreview` 组件、`MediaUploader` 组件、`Pagination` 组件、`/api/posts/[id]` PATCH 分支、`/api/accounts/[id]` PATCH/DELETE 401、`/api/accounts/[id]/config` 三层默认值回退、`/api/media/[path]` GET MIME 类型分支、`thumbnail.ts` 递归质量压缩。详见 [docs/TEST_COVERAGE_TODO.md](./TEST_COVERAGE_TODO.md) |
| **v0.4.6** | **2026-06-03** | **配置重构单测**：`src/lib/config.ts` 的常量和 helper 单测化（thumbnail / media upload / cookie 名等） |
| **v0.4.7** | **2026-06-04** | **TS 错误修复**：`tests/api/regenerate-thumbnails.test.ts` 15 处 `await POST()` 缺 Request 参数 → 全部补 `new Request(...)` |
| **v0.5.3** | **2026-06-12** | **`report_publish_result` 使用服务端时间修复测试**：<br>• **单测**：在 `tests/mcp/tools-coverage.test.ts` 的 `describe("MCP Tools - report_publish_result")` 中更新 4 个用例 + 新增 2 个用例（覆盖 success / partial 时忽略外部 publishedAt 改为使用服务端时间；空字符串/无效 ISO 也不报错）<br>• **e2e**：在 `tests/e2e/mcp-http.spec.ts` 追加 2 个用例（死机重试模拟，验证 publishedAt = Date.now() 不是 1 小时前）<br>• **回归**：其他 MCP 测试不受影响 |
| | **v0.6.0** | **2026-06-18** | **Prisma → Drizzle ORM 迁移测试待更新**：API 路由和 auth.ts 已切换到 Drizzle ORM。现有测试使用 Prisma mock，需后续更新为 Drizzle ORM mock。MCP 工具测试独立保持。 |
| | **v0.4.8** | **2026-06-04** | **端口单一源 + e2e 修复 + 核心覆盖**：<br>• **e2e 4 skipped 修复**：新增 `tests/e2e/global-setup.ts` 幂等 seed `testuser` + Twitter 平台 + Twitter 账号；`playwright.config.ts` 接入 `globalSetup`；`posts-platform-config.spec.ts` 4 个 test 从 skip → 真跑（**e2e: 92+4 skipped → 96 passed, 0 skipped**）<br>• **核心覆盖补充**（14 个新测试文件）：stores（authStore / uiStore）、middleware、4 个 components（Sidebar / ContentEditor / 2 个 ai-tools 客户端组件）、5 个 ui 组件（Button / Input / Modal / Pagination / Toast）、2 个 page.tsx（login / register）<br>• **APP_URL helper 单测**：`tests/lib/config.test.ts` 12 个 case 覆盖 `getAppUrl()` / `getPort()` / `getMcpEndpointUrl()` 三种环境、URL 解析失败回退、默认端口（80/443）等分支<br>• **vitest 状态**：577 → **671 tests**（+94），`lib/` 目录 100% statements / 100% functions / 100% lines<br>• **覆盖率**：33 → **40 个被覆盖源文件**，全部 ≥ 80% |


---

## ⚠️ 测试用例撰写注意事项

> **经验教训：** 测试必须验证功能是否真正工作，而不仅仅是 UI 元素是否存在。初始测试通过不代表功能正常。

### E2E 测试核心原则

| 原则 | 说明 | ❌ 错误示例 | ✅ 正确示例 |
|------|------|-----------|------------|
| **1. 验证数据流** | 测试必须验证数据正确传递和显示 | 只检查按钮存在 | 验证筛选后列表项数量变化 |
| **2. 验证状态变化** | 用户操作后应验证结果状态 | 只点击按钮 | 验证数据已保存/更新 |
| **3. 包含前置数据** | 测试应准备必要的测试数据 | 不创建账号直接测试筛选 | 先创建多个账号再测试筛选 |
| **4. 验证最终结果** | 不仅验证操作成功，还要验证结果 | 测试通过但列表为空 | 验证列表包含正确的数据 |

### 常见错误案例

#### 案例 1：筛选功能测试
```typescript
// ❌ 错误：只验证 UI 元素存在
test('should show account filter button', async ({ page }) => {
  await page.goto('/posts');
  await expect(page.getByRole('button', { name: /账号/i })).toBeVisible();
});
// 问题：测试通过，但无法知道筛选是否工作

// ✅ 正确：验证实际功能
test('should filter posts by account', async ({ page }) => {
  // 1. 创建测试数据
  await createTestAccount({ name: 'Account A' });
  await createTestAccount({ name: 'Account B' });
  await createTestPost({ accountId: 'Account A' });
  await createTestPost({ accountId: 'Account B' });
  
  // 2. 验证初始列表显示所有帖子
  await page.goto('/posts');
  await expect(page.locator('tbody tr')).toHaveCount(2);
  
  // 3. 执行筛选操作
  await page.getByRole('button', { name: /账号/i }).click();
  await page.getByText('Account A').click();
  
  // 4. 验证筛选结果 - 这是关键！
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.getByText('Account A')).toBeVisible();
});
```

#### 案例 2：API 响应格式兼容性
```typescript
// API 可能返回不同格式
// GET /api/accounts 可能返回 [] 或 { accounts: [] }

// ❌ 错误：假设固定格式
const accounts = data.accounts;

// ✅ 正确：兼容处理
const accounts = Array.isArray(data) ? data : data.accounts || [];
```

### 测试用例模板

```
#### TC-XXX：功能名称

| 用例ID | TC-XXX |
|--------|--------|
| **前置条件** | 用户已登录，有账号 A 和账号 B |
| **测试步骤** | 1. 创建账号 A 的帖子<br>2. 创建账号 B 的帖子<br>3. 访问列表页<br>4. 点击账号筛选<br>5. 选择账号 A |
| **预期结果** | 1. 列表只显示账号 A 的帖子<br>2. 列表不显示账号 B 的帖子 |
| **验证点** | 列表项数量 = 1，accountId = 账号 A 的 ID |
```

### 检查清单

编写 E2E 测试时，确保：

- [ ] **前置数据**：测试前是否创建了必要的测试数据？
- [ ] **初始状态**：是否验证了数据的初始状态？
- [ ] **操作步骤**：用户操作是否完整记录？
- [ ] **结果验证**：是否验证了操作后的结果？
- [ ] **数量验证**：筛选/列表是否验证了项数变化？

---

## 文档信息

| 项目 | NextPost - 社媒帖子发布计划工具 |
|------|-------------------------------|
| 版本 | v1.0 |
| 创建日期 | 2026-05-31 |
| 状态 | 待评审 |

---

## 1. 测试范围与目标

### 1.1 测试范围

本测试计划涵盖 NextPost MVP 版本的所有功能模块，包括：

| 模块 | 功能点 |
|------|--------|
| 认证模块 | 用户注册、用户登录、会话管理 |
| 账号管理 | 创建账号、编辑账号、删除账号、账号列表 |
| 内容创作 | 创建帖子、编辑帖子、删除帖子、媒体上传 |
| 计划调度 | 设置发布时间、修改时间、状态管理 |
| 日历视图 | 月视图、周视图、计划展示 |
| 列表视图 | 帖子列表、筛选、排序、分页 |
| 设置模块 | 用户信息、AI 配置 |
| API 接口 | RESTful API、Webhook |

### 1.2 测试目标

- **功能完整性**：所有 P0 功能均通过测试
- **接口正确性**：所有 API 端点返回符合预期
- **数据一致性**：数据库操作正确，级联删除正常
- **用户体验**：核心流程流畅，无阻塞性 Bug
- **安全性**：认证机制可靠，用户数据隔离

---

## 2. 测试类型定义

### 2.1 测试金字塔

```
       ┌─────────────┐
        │   E2E 测试   │  少量关键用户流程
        ├─────────────┤
        │ 集成测试   │  API路由 + 数据库
        ├─────────────┤
        │  单元测试   │  工具函数、Store、组件
       └─────────────┘
```

### 2.2 测试工具选型

| 测试类型 | 工具 | 说明 |
|---------|------|------|
| 单元测试 | Vitest | 轻量级，TypeScript 原生支持 |
| 组件测试 | Testing Library | React 组件行为测试 |
| E2E 测试 | Playwright | 现代端到端测试 |
| API 测试 | Supertest | HTTP 接口测试 |

---

## 3. 测试环境要求

### 3.1 环境配置

| 环境 | 用途 | 数据库 |
|------|------|--------|
| Dev | 本地开发 | SQLite (`dev.db`) |
| Test | 自动化测试 | SQLite内存模式 |
| Staging | 上线前验证 | PostgreSQL |

### 3.2 测试依赖

```bash
# 必需依赖
npm install -D vitest @testing-library/react @testing-library/jest-dom
npm install -D playwright @playwright/test
npm install -D supertest

# 数据库清理
npm install -D prisma
```

---

## 4. 功能模块测试用例

### 4.1 认证模块

#### TC-AUTH-001：用户注册成功

| 用例ID | TC-AUTH-001 |
|--------|-------------|
| **标题** | 用户注册成功 |
| **模块** | 认证模块 |
| **前置条件** | 用户未登录，系统无该用户名 |
| **测试步骤** | 1. 访问 `/register` 页面<br>2. 输入用户名 `testuser`<br>3. 输入密码 `Test123456`<br>4. 确认密码 `Test123456`<br>5. 点击「注册」按钮 |
| **预期结果** | 1. 注册成功，跳转到仪表盘 `/`<br>2. 显示成功 Toast 提示<br>3. 侧边栏显示用户已登录状态<br>4. 数据库 `User` 表新增一条记录 |

#### TC-AUTH-002：用户注册 - 用户名已存在

| 用例ID | TC-AUTH-002 |
|--------|-------------|
| **标题** | 用户注册 - 用户名已存在 |
| **模块** | 认证模块 |
| **前置条件** | 用户 `testuser` 已存在于数据库 |
| **测试步骤** | 1. 访问 `/register` 页面<br>2. 输入用户名 `testuser`<br>3. 输入密码 `Test123456`<br>4. 确认密码 `Test123456`<br>5. 点击「注册」按钮 |
| **预期结果** | 1. 显示错误提示「用户名已存在」<br>2. 表单保持可编辑状态<br>3. 数据库无新增记录 |

#### TC-AUTH-003：用户注册 - 密码不匹配

| 用例ID | TC-AUTH-003 |
|--------|-------------|
| **标题** | 用户注册 - 密码不匹配 |
| **模块** | 认证模块 |
| **前置条件** | 无 |
| **测试步骤** | 1. 访问 `/register` 页面<br>2. 输入用户名 `newuser`<br>3. 输入密码 `Test123456`<br>4. 确认密码 `Test123457`<br>5. 点击「注册」按钮 |
| **预期结果** | 1. 显示错误提示「两次密码输入不一致」<br>2. 提交按钮禁用或阻止提交 |

#### TC-AUTH-004：用户登录成功

| 用例ID | TC-AUTH-004 |
|--------|-------------|
| **标题** | 用户登录成功 |
| **模块** | 认证模块 |
| **前置条件** | 用户 `testuser` 已注册，密码 `Test123456` |
| **测试步骤** | 1. 访问 `/login` 页面<br>2. 输入用户名 `testuser`<br>3. 输入密码 `Test123456`<br>4. 点击「登录」按钮 |
| **预期结果** | 1. 登录成功，跳转到仪表盘 `/`<br>2. 创建会话 (Session)<br>3. 侧边栏显示用户已登录状态 |

#### TC-AUTH-005：用户登录 - 密码错误

| 用例ID | TC-AUTH-005 |
|--------|-------------|
| **标题** | 用户登录 - 密码错误 |
| **模块** | 认证模块 |
| **前置条件** | 用户 `testuser` 已注册，密码 `Test123456` |
| **测试步骤** | 1. 访问 `/login` 页面<br>2. 输入用户名 `testuser`<br>3. 输入密码 `WrongPassword`<br>4. 点击「登录」按钮 |
| **预期结果** | 1. 显示错误提示「用户名或密码错误」<br>2. 表单保持可编辑状态<br>3. 不创建会话 |

#### TC-AUTH-006：用户登录 - 用户不存在

| 用例ID | TC-AUTH-006 |
|--------|-------------|
| **标题** | 用户登录 - 用户不存在 |
| **模块** | 认证模块 |
| **前置条件** | 无 |
| **测试步骤** | 1. 访问 `/login` 页面<br>2. 输入用户名 `nonexistent`<br>3. 输入密码 `Test123456`<br>4. 点击「登录」按钮 |
| **预期结果** | 1. 显示错误提示「用户名或密码错误」<br>2. 不创建会话 |

#### TC-AUTH-007：路由保护 - 未登录访问受保护页面

| 用例ID | TC-AUTH-007 |
|--------|-------------|
| **标题** | 路由保护 - 未登录访问受保护页面 |
| **模块** | 认证模块 |
| **前置条件** | 用户未登录（无有效 Session） |
| **测试步骤** | 1. 直接访问 `/` 或 `/posts`<br>2. 或直接访问 `/accounts` |
| **预期结果** | 1. 重定向到 `/login` 页面<br>2. URL 参数可能包含 `callbackUrl` |

#### TC-AUTH-008：会话过期处理

| 用例ID | TC-AUTH-008 |
|--------|-------------|
| **标题** | 会话过期处理 |
| **模块** | 认证模块 |
| **前置条件** | 用户已登录，但 Session 已过期 |
| **测试步骤** | 1. 清除浏览器 Cookie<br>2. 尝试访问任何受保护页面 |
| **预期结果** | 1. 重定向到 `/login` 页面<br>2. 显示提示「请先登录」 |

---

### 4.2 账号管理模块

#### TC-ACCT-001：添加账号成功

| 用例ID | TC-ACCT-001 |
|--------|-------------|
| **标题** | 添加账号成功 |
| **模块** | 账号管理 |
| **前置条件** | 用户已登录 |
| **测试步骤** | 1. 访问 `/accounts` 页面<br>2. 点击「添加账号」按钮<br>3. 在弹窗中填写：账号名称「我的小号」、Handle `@myaccount`<br>4. 点击「保存」 |
| **预期结果** | 1. 弹窗关闭<br>2. 账号列表新增一条记录<br>3. 显示成功 Toast<br>4. 数据库 `Account` 表新增一条记录 |

#### TC-ACCT-002：添加账号 - Handle格式验证

| 用例ID | TC-ACCT-002 |
|--------|-------------|
| **标题** | 添加账号 - Handle 格式验证 |
| **模块** | 账号管理 |
| **前置条件** | 用户已登录 |
| **测试步骤** | 1. 访问 `/accounts` 页面<br>2. 点击「添加账号」按钮<br>3. 输入账号名称「测试账号」<br>4. 输入 Handle `invalid-handle`（包含特殊字符）<br>5. 点击「保存」 |
| **预期结果** | 1. 显示错误提示「Handle 格式不正确」<br>2. 阻止提交 |

#### TC-ACCT-003：添加账号 - 必填字段验证

| 用例ID | TC-ACCT-003 |
|--------|-------------|
| **标题** | 添加账号 - 必填字段验证 |
| **模块** | 账号管理 |
| **前置条件** | 用户已登录 |
| **测试步骤** | 1. 访问 `/accounts` 页面<br>2. 点击「添加账号」按钮<br>3. 不填写任何内容直接点击「保存」 |
| **预期结果** | 1. 显示错误提示「账号名称不能为空」<br>2. 显示错误提示「Handle 不能为空」<br>3. 阻止提交 |

#### TC-ACCT-004：编辑账号

| 用例ID | TC-ACCT-004 |
|--------|-------------|
| **标题** | 编辑账号 |
| **模块** | 账号管理 |
| **前置条件** | 用户已登录，存在账号 ID `account-001` |
| **测试步骤** | 1. 访问 `/accounts` 页面<br>2. 找到账号「我的小号」<br>3. 点击「编辑」按钮<br>4. 修改名称为「我的大号」<br>5. 点击「保存」 |
| **预期结果** | 1. 弹窗关闭<br>2. 列表中账号名称已更新<br>3. 数据库 `Account` 表该记录 `name` 字段已更新 |

#### TC-ACCT-005：删除账号

| 用例ID | TC-ACCT-005 |
|--------|-------------|
| **标题** | 删除账号 |
| **模块** | 账号管理 |
| **前置条件** | 用户已登录，存在账号 ID `account-001` |
| **测试步骤** | 1. 访问 `/accounts` 页面<br>2. 找到账号「我的大号」<br>3. 点击「删除」按钮<br>4. 在确认弹窗中点击「确认」 |
| **预期结果** | 1. 账号从列表中移除<br>2. 显示成功 Toast<br>3. 数据库 `Account` 表该记录已删除 |

#### TC-ACCT-006：删除账号 - 级联删除帖子

| 用例ID | TC-ACCT-006 |
|--------|-------------|
| **标题** | 删除账号 - 级联删除帖子 |
| **模块** | 账号管理 |
| **前置条件** | 用户已登录，账号下有 2 个帖子 |
| **测试步骤** | 1. 删除该账号 |
| **预期结果** | 1. 账号删除成功<br>2. 该账号下的帖子也一并删除<br>3. 数据库 `Post` 表相关记录已删除 |

#### TC-ACCT-007：账号数据隔离

| 用例ID | TC-ACCT-007 |
|--------|-------------|
| **标题** | 账号数据隔离 |
| **模块** | 账号管理 |
| **前置条件** | 用户 A 和用户 B，各有账号 |
| **测试步骤** | 1. 用户 A 登录，查看账号列表<br>2. 用户 B 登录，查看账号列表 |
| **预期结果** | 1. 用户 A只能看到自己的账号<br>2. 用户 B 只能看到自己的账号<br>3. 双方数据完全隔离 |

---

### 4.3 内容创作模块

#### TC-POST-001：创建帖子 - 仅文本

| 用例ID | TC-POST-001 |
|--------|-------------|
| **标题** | 创建帖子 - 仅文本 |
| **模块** | 内容创作 |
| **前置条件** | 用户已登录，存在至少一个账号 |
| **测试步骤** | 1. 访问 `/posts/new` 页面<br>2. 选择账号<br>3. 输入内容「这是一条测试推文」<br>4. 设置发布时间为明天15:00<br>5. 点击「发布」 |
| **预期结果** | 1. 创建成功，跳转到列表页或日历页<br>2.帖子状态为 `scheduled`<br>3. 数据库 `Post` 表新增一条记录<br>4. 显示成功 Toast |

#### TC-POST-002：创建帖子 - 保存草稿

| 用例ID | TC-POST-002 |
|--------|-------------|
| **标题** | 创建帖子 - 保存草稿 |
| **模块** | 内容创作 |
| **前置条件** | 用户已登录，存在至少一个账号 |
| **测试步骤** | 1. 访问 `/posts/new` 页面<br>2. 选择账号<br>3. 输入内容「草稿内容」<br>4. 不设置发布时间<br>5. 点击「保存草稿」 |
| **预期结果** | 1. 创建成功<br>2. 帖子状态为 `draft`<br>3. `scheduledTime` 为 NULL<br>4. 显示成功 Toast |

#### TC-POST-003：创建帖子 - 未选择账号

| 用例ID | TC-POST-003 |
|--------|-------------|
| **标题** | 创建帖子 - 未选择账号 |
| **模块** | 内容创作 |
| **前置条件** | 用户已登录 |
| **测试步骤** | 1. 访问 `/posts/new` 页面<br>2. 不选择账号<br>3. 输入内容<br>4. 点击「发布」 |
| **预期结果** | 1. 显示错误提示「请选择账号」<br>2. 阻止提交 |

#### TC-POST-004：创建帖子 - 空内容

| 用例ID | TC-POST-004 |
|--------|-------------|
| **标题** | 创建帖子 - 空内容 |
| **模块** | 内容创作 |
| **前置条件** | 用户已登录，存在至少一个账号 |
| **测试步骤** | 1. 访问 `/posts/new` 页面<br>2. 选择账号<br>3. 不输入任何内容<br>4. 点击「发布」 |
| **预期结果** | 1. 显示错误提示「内容不能为空」<br>2. 阻止提交 |

#### TC-POST-005：编辑帖子 - 修改内容

| 用例ID | TC-POST-005 |
|--------|-------------|
| **标题** | 编辑帖子 - 修改内容 |
| **模块** | 内容创作 |
| **前置条件** | 用户已登录，存在帖子 ID `post-001` |
| **测试步骤** | 1. 访问 `/posts/post-001/edit` 页面<br>2. 修改内容为「修改后的内容」<br>3. 点击「保存」 |
| **预期结果** | 1. 保存成功<br>2. 内容已更新<br>3. 显示成功 Toast |

#### TC-POST-006：编辑帖子 - 修改发布时间

| 用例ID | TC-POST-006 |
|--------|-------------|
| **标题** | 编辑帖子 - 修改发布时间 |
| **模块** | 内容创作 |
| **前置条件** | 用户已登录，帖子原计划时间为明天 15:00 |
| **测试步骤** | 1. 访问帖子编辑页<br>2. 修改发布时间为明天 17:00<br>3. 点击「保存」 |
| **预期结果** | 1. 保存成功<br>2. `scheduledTime` 已更新<br>3. 日历视图中的时间也相应更新 |

#### TC-POST-007：删除帖子

| 用例ID | TC-POST-007 |
|--------|-------------|
| **标题** | 删除帖子 |
| **模块** | 内容创作 |
| **前置条件** | 用户已登录，存在帖子 ID `post-001` |
| **测试步骤** | 1. 访问帖子列表页<br>2. 点击「删除」按钮<br>3. 在确认弹窗中点击「确认」 |
| **预期结果** | 1. 删除成功<br>2. 帖子不再出现在列表中<br>3. 显示成功 Toast<br>4. 数据库 `Post` 表该记录已删除<br>5. **关联的媒体文件也一并从 uploads 目录删除** |

#### TC-POST-007b：删除帖子 - 级联删除媒体文件

| 用例ID | TC-POST-007b |
|--------|-------------|
| **标题** | 删除帖子 - 级联删除媒体文件 |
| **模块** | 内容创作 |
| **前置条件** | 用户已登录，帖子包含媒体文件 |
| **测试步骤** | 1. 创建一个包含媒体文件的帖子<br>2. 验证媒体文件存在于 uploads 目录<br>3. 删除该帖子 |
| **预期结果** | 1. 帖子删除成功<br>2. 关联的媒体文件从 uploads 目录物理删除<br>3. base64 缩略图不会被删除（它们存储在数据库或内存中） |

#### TC-POST-008：时区选择

| 用例ID | TC-POST-008 |
|--------|-------------|
| **标题** | 时区选择 |
| **模块** | 内容创作 |
| **前置条件** | 用户已登录，存在至少一个账号 |
| **测试步骤** | 1. 访问 `/posts/new` 页面<br>2. 输入内容<br>3. 选择不同时区（America/New_York） |
| **预期结果** | 1. 时区选择器正确显示<br>2. 选择后可切换到其他时区<br>3. 发布时间根据时区正确计算 |

#### TC-POST-009：帖子列表状态显示

| 用例ID | TC-POST-009 |
|--------|-------------|
| **标题** | 帖子列表状态显示 |
| **模块** | 内容创作 |
| **前置条件** | 用户已登录，有草稿和计划帖子 |
| **测试步骤** | 1. 创建一个草稿帖子<br>2. 创建一个计划帖子<br>3. 访问 `/posts` 列表页 |
| **预期结果** | 1. 列表正确显示草稿状态<br>2. 列表正确显示已计划状态<br>3. 列表显示正确的发布时间 |

#### TC-POST-010：帖子数据隔离

| 用例ID | TC-POST-008 |
|--------|-------------|
| **标题** | 帖子数据隔离 |
| **模块** | 内容创作 |
| **前置条件** | 用户 A 和用户 B，各有帖子 |
| **测试步骤** | 1. 用户 A 登录，查看帖子列表<br>2. 用户 B 登录，查看帖子列表 |
| **预期结果** | 1. 用户 A 只能看到自己的帖子<br>2. 用户 B 只能看到自己的帖子 |

---

### 4.4 媒体上传模块

#### TC-MEDIA-001：上传图片 - API 测试

| 用例ID | TC-MEDIA-001 |
|--------|-------------|
| **标题** | 上传图片 - API 测试 |
| **模块** | 媒体上传 |
| **前置条件** | 用户已登录 |
| **测试步骤** | 1. POST /api/media/upload with multipart/form-data containing image file |
| **预期结果** | 1. 返回 `{ url, filename, mimeType, size }`<br>2. 状态码 200<br>3. 文件保存到 ./uploads/ 目录 |

#### TC-MEDIA-002：上传视频 - API 测试

| 用例ID | TC-MEDIA-002 |
|--------|-------------|
| **标题** | 上传视频 - API 测试 |
| **模块** | 媒体上传 |
| **前置条件** | 用户已登录 |
| **测试步骤** | 1. POST /api/media/upload with MP4 video file |
| **预期结果** | 1. 返回 `{ url, filename, mimeType, size }`<br>2. 视频文件保存到 ./uploads/ 目录 |

#### TC-MEDIA-003：上传文件 - 未授权

| 用例ID | TC-MEDIA-003 |
|--------|-------------|
| **标题** | 上传文件 - 未授权 |
| **模块** | 媒体上传 |
| **前置条件** | 用户未登录 |
| **测试步骤** | 1. POST /api/media/upload without session |
| **预期结果** | 1. 状态码 401<br>2. `{ error: "未授权" }` |

#### TC-MEDIA-004：上传文件 - 无文件

| 用例ID | TC-MEDIA-004 |
|--------|-------------|
| **标题** | 上传文件 - 无文件 |
| **模块** | 媒体上传 |
| **前置条件** | 用户已登录 |
| **测试步骤** | 1. POST /api/media/upload with empty form data |
| **预期结果** | 1. 状态码 400<br>2. `{ error: "请选择文件" }` |

#### TC-MEDIA-005：上传文件 - 文件过大

| 用例ID | TC-MEDIA-005 |
|--------|-------------|
| **标题** | 上传文件 - 文件过大 |
| **模块** | 媒体上传 |
| **前置条件** | 用户已登录 |
| **测试步骤** | 1. POST /api/media/upload with file > 10MB |
| **预期结果** | 1. 状态码 400<br>2. `{ error: "文件大小不能超过 10MB" }` |

#### TC-MEDIA-006：上传文件 - 不支持的格式

| 用例ID | TC-MEDIA-006 |
|--------|-------------|
| **标题** | 上传文件 - 不支持的格式 |
| **模块** | 媒体上传 |
| **前置条件** | 用户已登录 |
| **测试步骤** | 1. POST /api/media/upload with .exe file |
| **预期结果** | 1. 状态码 400<br>2. `{ error: "不支持的文件类型" }` |

#### TC-MEDIA-007：删除媒体 - API 测试

| 用例ID | TC-MEDIA-007 |
|--------|-------------|
| **标题** | 删除媒体 - API 测试 |
| **模块** | 媒体上传 |
| **前置条件** | 用户已登录，已上传文件 |
| **测试步骤** | 1. DELETE /api/media/:path |
| **预期结果** | 1. 状态码 200<br>2. `{ success: true }`<br>3. 文件从 ./uploads/ 删除 |

#### TC-MEDIA-008：删除媒体 - 未授权

| 用例ID | TC-MEDIA-008 |
|--------|-------------|
| **标题** | 删除媒体 - 未授权 |
| **模块** | 媒体上传 |
| **前置条件** | 用户未登录 |
| **测试步骤** | 1. DELETE /api/media/:path without session |
| **预期结果** | 1. 状态码 401 |

#### TC-MEDIA-009：帖子创建 - 带媒体上传

| 用例ID | TC-MEDIA-009 |
|--------|-------------|
| **标题** | 帖子创建 - 带媒体上传 |
| **模块** | 媒体上传 |
| **前置条件** | 用户已登录，存在账号 |
| **测试步骤** | 1. 上传图片获取 URL<br>2. POST /api/posts with mediaUrls |
| **预期结果** | 1. 帖子创建成功<br>2. mediaUrls 包含上传的 URL |

#### TC-MEDIA-010：存储引擎扩展性

| 用例ID | TC-MEDIA-010 |
|--------|-------------|
| **标题** | 存储引擎扩展性 |
| **模块** | 媒体上传 |
| **前置条件** | 代码实现 StorageEngine 接口 |
| **测试步骤** | 1. 检查 src/lib/storage/ 目录结构<br>2. 验证 local.ts 实现 StorageEngine 接口 |
| **预期结果** | 1. 接口定义在 types.ts<br>2. local.ts 实现 upload/delete/getUrl/exists 方法 |

---

### 4.5 日历视图模块

#### TC-CAL-001：日历月视图 - 默认展示

| 用例ID | TC-CAL-001 |
|--------|-------------|
| **标题** | 日历月视图 - 默认展示 |
| **模块** | 日历视图 |
| **前置条件** | 用户已登录，有多个帖子计划 |
| **测试步骤** | 1. 访问 `/calendar` 页面 |
| **预期结果** | 1. 显示当月日历<br>2. 日期格子显示当天计划数量<br>3. 有计划的日期高亮显示 |

#### TC-CAL-002：日历月视图 - 查看当天计划

| 用例ID | TC-CAL-002 |
|--------|-------------|
| **标题** | 日历月视图 - 查看当天计划 |
| **模块** | 日历视图 |
| **前置条件** | 用户已登录，某天有 3 个帖子计划 |
| **测试步骤** | 1. 访问 `/calendar` 页面<br>2. 点击有计划的日期 |
| **预期结果** | 1. 展开当天计划列表<br>2. 显示所有帖子详情<br>3. 包含时间、账号、内容预览 |

#### TC-CAL-003：日历周视图切换

| 用例ID | TC-CAL-003 |
|--------|-------------|
| **标题** | 日历周视图切换 |
| **模块** | 日历视图 |
| **前置条件** | 用户已登录 |
| **测试步骤** | 1. 访问 `/calendar` 页面<br>2. 点击「周」视图切换按钮 |
| **预期结果** | 1. 视图切换为周视图<br>2. 显示本周 7 天<br>3. 每个时段显示计划 |

#### TC-CAL-004：日历导航 - 上月

| 用例ID | TC-CAL-004 |
|--------|-------------|
| **标题** | 日历导航 - 上月 |
| **模块** | 日历视图 |
| **前置条件** | 用户已登录 |
| **测试步骤** | 1. 访问 `/calendar` 页面<br>2. 点击「上一月」箭头 |
| **预期结果** | 1. 日历显示上月<br>2. 数据相应更新 |

#### TC-CAL-005：日历导航 - 下月

| 用例ID | TC-CAL-005 |
|--------|-------------|
| **标题** | 日历导航 - 下月 |
| **模块** | 日历视图 |
| **前置条件** | 用户已登录 |
| **测试步骤** | 1. 访问 `/calendar` 页面<br>2. 点击「下一月」箭头 |
| **预期结果** | 1. 日历显示下月<br>2. 数据相应更新 |

#### TC-CAL-006：日历 - 空状态

| 用例ID | TC-CAL-006 |
|--------|-------------|
| **标题** | 日历 - 空状态 |
| **模块** | 日历视图 |
| **前置条件** | 用户已登录，当前月份无任何计划 |
| **测试步骤** | 1. 访问 `/calendar` 页面 |
| **预期结果** | 1. 日历正常显示<br>2. 所有日期格子无计划<br>3. 可能显示引导文案「暂无计划」 |

#### TC-CAL-007：日历视图 - 按账号筛选

| 用例ID | TC-CAL-007 |
|--------|-------------|
| **标题** | 日历视图 - 按账号筛选 |
| **模块** | 日历视图 |
| **前置条件** | 用户已登录，有多个账号的帖子计划 |
| **测试步骤** | 1. 访问 `/calendar` 页面<br>2. 选择账号筛选下拉框<br>3. 选择「账号A」 |
| **预期结果** | 1. 日历只显示「账号A」的计划<br>2. 其他账号计划已过滤<br>3. 筛选状态可多选 |

#### TC-CAL-008：日历视图 - 按平台筛选

| 用例ID | TC-CAL-008 |
|--------|-------------|
| **标题** | 日历视图 - 按平台筛选 |
| **模块** | 日历视图 |
| **前置条件** | 用户已登录，有多个平台的帖子计划 |
| **测试步骤** | 1. 访问 `/calendar` 页面<br>2. 选择平台筛选下拉框<br>3. 选择「Twitter」 |
| **预期结果** | 1. 日历只显示「Twitter」平台的计划<br>2. 其他平台计划已过滤<br>3. 筛选状态可多选 |

#### TC-CAL-009：日历视图 - 多账号多平台筛选

| 用例ID | TC-CAL-009 |
|--------|-------------|
| **标题** | 日历视图 - 多账号多平台筛选 |
| **模块** | 日历视图 |
| **前置条件** | 用户已登录，有多个账号和平台的帖子计划 |
| **测试步骤** | 1. 访问 `/calendar` 页面<br>2. 选择账号「账号A」和「账号B」<br>3. 选择平台「Twitter」和「Instagram」 |
| **预期结果** | 1. 日历只显示符合筛选条件的计划<br>2. 筛选标签显示当前选择<br>3. 可取消单个筛选条件 |

#### TC-CAL-010：日历视图 - 点击日期快速添加

| 用例ID | TC-CAL-010 |
|--------|-------------|
| **标题** | 日历视图 - 点击日期快速添加 |
| **模块** | 日历视图 |
| **前置条件** | 用户已登录，已选择账号和平台筛选 |
| **测试步骤** | 1. 访问 `/calendar` 页面<br>2. 点击某个日期（如6月15日） |
| **预期结果** | 1. 右侧面板显示该日期的计划列表<br>2. 面板顶部显示「添加」按钮<br>3. 点击「添加」按钮跳转到 `/posts/new?date=2026-06-15`<br>4. 新建页面默认时间为该日期 |

#### TC-CAL-011：日历视图 - 点击日期添加（无计划时）

| 用例ID | TC-CAL-011 |
|--------|-------------|
| **标题** | 日历视图 - 点击日期添加（无计划时） |
| **模块** | 日历视图 |
| **前置条件** | 用户已登录，某天没有任何计划 |
| **测试步骤** | 1. 访问 `/calendar` 页面<br>2. 点击空白日期 |
| **预期结果** | 1. 右侧面板显示「当天没有发布计划」<br>2. 显示「添加」按钮<br>3. 点击后跳转到新建页面 |

---

### 4.6 列表视图模块

#### TC-LIST-001：帖子列表 - 默认展示

| 用例ID | TC-LIST-001 |
|--------|-------------|
| **标题** | 帖子列表 - 默认展示 |
| **模块** | 列表视图 |
| **前置条件** | 用户已登录，有多个帖子 |
| **测试步骤** | 1. 访问 `/posts` 页面 |
| **预期结果** | 1. 表格展示所有帖子<br>2. 列：状态、内容预览、账号、发布时间、操作<br>3. 默认按创建时间倒序 |

#### TC-LIST-002：帖子列表 - 按账号筛选

| 用例ID | TC-LIST-002 |
|--------|-------------|
| **标题** | 帖子列表 - 按账号筛选 |
| **模块** | 列表视图 |
| **前置条件** | 用户已登录，有多个账号的帖子 |
| **测试步骤** | 1. 访问 `/posts` 页面<br>2. 选择账号筛选下拉框<br>3. 选择「我的小号」 |
| **预期结果** | 1. 列表只显示该账号的帖子<br>2. 其他账号帖子已过滤 |

#### TC-LIST-003：帖子列表 - 按状态筛选

| 用例ID | TC-LIST-003 |
|--------|-------------|
| **标题** | 帖子列表 - 按状态筛选 |
| **模块** | 列表视图 |
| **前置条件** | 用户已登录，有草稿、计划中、已发布的帖子 |
| **测试步骤** | 1. 访问 `/posts` 页面<br>2. 选择状态筛选下拉框<br>3. 选择「草稿」 |
| **预期结果** | 1. 列表只显示草稿状态的帖子<br>2. 其他状态帖子已过滤 |

#### TC-LIST-004：帖子列表 - 按日期范围筛选

| 用例ID | TC-LIST-004 |
|--------|-------------|
| **标题** | 帖子列表 - 按日期范围筛选 |
| **模块** | 列表视图 |
| **前置条件** | 用户已登录 |
| **测试步骤** | 1. 访问 `/posts` 页面<br>2. 选择日期范围<br>3. 选择本周 |
| **预期结果** | 1. 列表只显示本周的帖子<br>2. 日期范围外帖子已过滤 |

#### TC-LIST-005：帖子列表 - 按发布时间排序

| 用例ID | TC-LIST-005 |
|--------|-------------|
| **标题** | 帖子列表 - 按发布时间排序 |
| **模块** | 列表视图 |
| **前置条件** | 用户已登录，有多个帖子 |
| **测试步骤** | 1. 访问 `/posts` 页面<br>2. 点击「发布时间」列标题 |
| **预期结果** | 1. 列表按发布时间升序排列<br>2. 再次点击变为降序 |

#### TC-LIST-006：帖子列表 - 分页

| 用例ID | TC-LIST-006 |
|--------|-------------|
| **标题** | 帖子列表 - 分页 |
| **模块** | 列表视图 |
| **前置条件** | 用户已登录，帖子数量 > 20 条 |
| **测试步骤** | 1. 访问 `/posts` 页面<br>2. 查看第一页<br>3. 点击「下一页」 |
| **预期结果** | 1. 显示第二页内容<br>2. 分页器显示当前页码<br>3. 点击「上一页」可返回 |

#### TC-LIST-007：帖子列表 - 空状态

| 用例ID | TC-LIST-007 |
|--------|-------------|
| **标题** | 帖子列表 - 空状态 |
| **模块** | 列表视图 |
| **前置条件** | 用户已登录，但无任何帖子 |
| **测试步骤** | 1. 访问 `/posts` 页面 |
| **预期结果** | 1. 显示空状态插图<br>2. 显示引导文案「还没有帖子，创建一个吧」<br>3. 显示「新建帖子」按钮 |

---

### 4.7 设置模块

#### TC-SET-001：修改用户信息

| 用例ID | TC-SET-001 |
|--------|-------------|
| **标题** | 修改用户信息 |
| **模块** | 设置模块 |
| **前置条件** | 用户已登录 |
| **测试步骤** | 1. 访问 `/settings` 页面<br>2. 修改邮箱为 `new@email.com`<br>3. 点击「保存」 |
| **预期结果** | 1. 保存成功<br>2. 显示成功 Toast<br>3. 数据库 `User` 表 `email` 字段已更新 |

#### TC-SET-002：配置 AI 提供商

| 用例ID | TC-SET-002 |
|--------|-------------|
| **标题** | 配置 AI 提供商 |
| **模块** | 设置模块 |
| **前置条件** | 用户已登录 |
| **测试步骤** | 1. 访问 `/settings` 页面<br>2. 选择 AI 提供商为「OpenAI」<br>3. 输入 API Key `sk-xxx`<br>4. 选择模型「gpt-4」<br>5. 点击「保存配置」 |
| **预期结果** | 1. 保存成功<br>2. 数据库 `User` 表 `aiProvider`、`aiApiKey`、`aiModel` 已更新<br>3. API Key 应加密存储 |

#### TC-SET-003：切换 AI 提供商 - Anthropic

| 用例ID | TC-SET-003 |
|--------|-------------|
| **标题** | 切换 AI 提供商 - Anthropic |
| **模块** | 设置模块 |
| **前置条件** | 用户已登录 |
| **测试步骤** | 1. 访问 `/settings` 页面<br>2. 选择 AI 提供商为「Anthropic」<br>3. 输入 API Key<br>4. 选择模型「claude-3-opus」<br>5. 保存 |
| **预期结果** | 1. 保存成功<br>2. 配置正确切换 |

#### TC-SET-004：修改密码

| 用例ID | TC-SET-004 |
|--------|-------------|
| **标题** | 修改密码 |
| **模块** | 设置模块 |
| **前置条件** | 用户已登录，密码为 `Test123456` |
| **测试步骤** | 1. 访问 `/settings` 页面<br>2. 点击「修改密码」<br>3. 输入原密码 `Test123456`<br>4. 输入新密码 `NewPass123`<br>5. 确认新密码 `NewPass123`<br>6. 点击「确认」 |
| **预期结果** | 1. 修改成功<br>2. 显示成功 Toast<br>3. 用户需要使用新密码登录 |

#### TC-SET-005：修改密码 - 原密码错误

| 用例ID | TC-SET-005 |
|--------|-------------|
| **标题** | 修改密码 - 原密码错误 |
| **模块** | 设置模块 |
| **前置条件** | 用户已登录 |
| **测试步骤** | 1. 进入修改密码流程<br>2. 输入错误的原密码<br>3. 输入新密码<br>4. 确认新密码<br>5. 点击「确认」 |
| **预期结果** | 1. 显示错误提示「原密码不正确」<br>2. 修改失败 |

#### TC-SET-006：退出登录

| 用例ID | TC-SET-006 |
|--------|-------------|
| **标题** | 退出登录 |
| **模块** | 设置模块 |
| **前置条件** | 用户已登录 |
| **测试步骤** | 1. 访问 `/settings` 页面<br>2. 点击「退出登录」 |
| **预期结果** | 1. 会话清除<br>2. 重定向到 `/login` 页面<br>3. 访问受保护页面会要求重新登录 |

---

## 5. API 接口测试用例

### 5.1 认证 API

#### TC-API-AUTH-001：POST /api/auth/register

| 用例ID | TC-API-AUTH-001 |
|--------|-----------------|
| **方法** | POST |
| **路径** | /api/auth/register |
| **请求体** | `{ "username": "newuser", "password": "Test123456" }` |
| **预期状态码** | 201 |
| **预期响应** | `{ "id": "xxx", "username": "newuser" }` |

#### TC-API-AUTH-002：POST /api/auth/register - 用户名重复

| 用例ID | TC-API-AUTH-002 |
|--------|-----------------|
| **方法** | POST |
| **路径** | /api/auth/register |
| **请求体** | `{ "username": "existinguser", "password": "Test123456" }` |
| **预期状态码** | 400 |
| **预期响应** | `{ "error": "用户名已存在" }` |

#### TC-API-AUTH-003：GET /api/auth/me

| 用例ID | TC-API-AUTH-003 |
|--------|-----------------|
| **方法** | GET |
| **路径** | /api/auth/me |
| **请求头** | Cookie: session=valid_session |
| **预期状态码** | 200 |
| **预期响应** | `{ "id": "xxx", "username": "testuser" }` |

#### TC-API-AUTH-004：GET /api/auth/me - 未登录

| 用例ID | TC-API-AUTH-004 |
|--------|-----------------|
| **方法** | GET |
| **路径** | /api/auth/me |
| **预期状态码** | 401 |
| **预期响应** | `{ "error": "Unauthorized" }` |

---

### 5.2 账号管理 API

#### TC-API-ACCT-001：GET /api/accounts

| 用例ID | TC-API-ACCT-001 |
|--------|-----------------|
| **方法** | GET |
| **路径** | /api/accounts |
| **认证** | 有效会话 |
| **预期状态码** | 200 |
| **预期响应** | `{ "accounts": [...] }` |
| **验证点** | 只返回当前用户的账号 |

#### TC-API-ACCT-002：POST /api/accounts

| 用例ID | TC-API-ACCT-002 |
|--------|-----------------|
| **方法** | POST |
| **路径** | /api/accounts |
| **认证** | 有效会话 |
| **请求体** | `{ "name": "测试账号", "handle": "@testacc", "platformId": "xxx" }` |
| **预期状态码** | 201 |
| **预期响应** | `{ "id": "xxx", "name": "测试账号", ... }` |

#### TC-API-ACCT-003：GET /api/accounts/:id

| 用例ID | TC-API-ACCT-003 |
|--------|-----------------|
| **方法** | GET |
| **路径** | /api/accounts/:id |
| **认证** | 有效会话 |
| **预期状态码** | 200 |
| **预期响应** | `{ "id": "xxx", "name": "测试账号", ... }` |

#### TC-API-ACCT-004：GET /api/accounts/:id - 不属于自己的账号

| 用例ID | TC-API-ACCT-004 |
|--------|-----------------|
| **方法** | GET |
| **路径** | /api/accounts/:id |
| **认证** | 有效会话（但账号属于其他用户） |
| **预期状态码** | 404 |
| **预期响应** | `{ "error": "Not Found" }` |

#### TC-API-ACCT-005：PATCH /api/accounts/:id

| 用例ID | TC-API-ACCT-005 |
|--------|-----------------|
| **方法** | PATCH |
| **路径** | /api/accounts/:id |
| **认证** | 有效会话 |
| **请求体** | `{ "name": "修改后的名称" }` |
| **预期状态码** | 200 |
| **预期响应** | `{ "id": "xxx", "name": "修改后的名称", ... }` |

#### TC-API-ACCT-006：DELETE /api/accounts/:id

| 用例ID | TC-API-ACCT-006 |
|--------|-----------------|
| **方法** | DELETE |
| **路径** | /api/accounts/:id |
| **认证** | 有效会话 |
| **预期状态码** | 200 |
| **验证点** | 级联删除该账号下的所有帖子 |

---

### 5.3 帖子管理 API

#### TC-API-POST-001：GET /api/posts

| 用例ID | TC-API-POST-001 |
|--------|-----------------|
| **方法** | GET |
| **路径** | /api/posts |
| **认证** | 有效会话 |
| **预期状态码** | 200 |
| **预期响应** | `{ "posts": [...], "total": 20, "page": 1, "pageSize": 20 }` |
| **验证点** | 只返回当前用户的帖子 |

#### TC-API-POST-002：GET /api/posts - 带筛选参数

| 用例ID | TC-API-POST-002 |
|--------|-----------------|
| **方法** | GET |
| **路径** | /api/posts?status=draft&accountId=xxx |
| **认证** | 有效会话 |
| **预期状态码** | 200 |
| **预期响应** | 只包含符合筛选条件的帖子 |

#### TC-API-POST-003：POST /api/posts

| 用例ID | TC-API-POST-003 |
|--------|-----------------|
| **方法** | POST |
| **路径** | /api/posts |
| **认证** | 有效会话 |
| **请求体** | `{ "accountId": "xxx", "content": "测试内容", "scheduledTime": "2026-06-01T15:00:00Z" }` |
| **预期状态码** | 201 |
| **预期响应** | `{ "id": "xxx", "status": "scheduled", ... }` |

#### TC-API-POST-004：POST /api/posts -草稿

| 用例ID | TC-API-POST-004 |
|--------|-----------------|
| **方法** | POST |
| **路径** | /api/posts |
| **认证** | 有效会话 |
| **请求体** | `{ "accountId": "xxx", "content": "草稿内容" }` |
| **预期状态码** | 201 |
| **预期响应** | `{ "id": "xxx", "status": "draft", "scheduledTime": null }` |

#### TC-API-POST-005：GET /api/posts/:id

| 用例ID | TC-API-POST-005 |
|--------|-----------------|
| **方法** | GET |
| **路径** | /api/posts/:id |
| **认证** | 有效会话 |
| **预期状态码** | 200 |
| **预期响应** | 包含帖子的完整信息，包括关联的账号 |

#### TC-API-POST-006：PATCH /api/posts/:id

| 用例ID | TC-API-POST-006 |
|--------|-----------------|
| **方法** | PATCH |
| **路径** | /api/posts/:id |
| **认证** | 有效会话 |
| **请求体** | `{ "content": "修改后的内容" }` |
| **预期状态码** | 200 |
| **预期响应** | 更新后的帖子信息 |

#### TC-API-POST-007：PATCH /api/posts/:id - 修改状态

| 用例ID | TC-API-POST-007 |
|--------|-----------------|
| **方法** | PATCH |
| **路径** | /api/posts/:id |
| **认证** | 有效会话 |
| **请求体** | `{ "status": "published" }` |
| **预期状态码** | 200 |
| **预期响应** | `{ ... "status": "published" }` |

#### TC-API-POST-008：DELETE /api/posts/:id

| 用例ID | TC-API-POST-008 |
|--------|-----------------|
| **方法** | DELETE |
| **路径** | /api/posts/:id |
| **认证** | 有效会话 |
| **预期状态码** | 200 |
| **验证点** | 数据库记录已删除 |

#### TC-API-POST-009：GET /api/posts/stats

| 用例ID | TC-API-POST-009 |
|--------|-----------------|
| **方法** | GET |
| **路径** | /api/posts/stats |
| **认证** | 有效会话 |
| **预期状态码** | 200 |
| **预期响应** | `{ "total": 50, "draft": 10, "scheduled": 30, "published": 10 }` |

---

### 5.4 Webhook API

#### TC-API-WEBHOOK-001：POST /api/webhook/publish

| 用例ID | TC-API-WEBHOOK-001 |
|--------|---------------------|
| **方法** | POST |
| **路径** | /api/webhook/publish |
| **认证** | API Key |
| **请求体** | `{ "postId": "xxx", "platform": "twitter" }` |
| **预期状态码** | 200 |
| **预期响应** | `{ "success": true, "postId": "xxx" }` |

#### TC-API-WEBHOOK-002：GET /api/webhook/status/:postId

| 用例ID | TC-API-WEBHOOK-002 |
|--------|---------------------|
| **方法** | GET |
| **路径** | /api/webhook/status/:postId |
| **认证** | API Key |
| **预期状态码** | 200 |
| **预期响应** | `{ "postId": "xxx", "status": "published", "publishedAt": "..." }` |

---

### 5.5 外部 API Key 管理

#### TC-API-KEY-001：创建外部 API Key

| 用例ID | TC-API-KEY-001 |
|--------|-----------------|
| **方法** | POST |
| **路径** | /api/settings/external-keys |
| **认证** | 有效会话 |
| **请求体** | `{ "name": "Claude Desktop" }` |
| **预期状态码** | 201 |
| **预期响应** | `{ "id": "xxx", "key": "npk_xxx", "name": "Claude Desktop" }` |
| **验证点** | key 字段必须以 `npk_` 开头 |

#### TC-API-KEY-002：创建 API Key - 未登录

| 用例ID | TC-API-KEY-002 |
|--------|-----------------|
| **方法** | POST |
| **路径** | /api/settings/external-keys |
| **认证** | 无 |
| **预期状态码** | 401 |

#### TC-API-KEY-003：获取 API Key 列表

| 用例ID | TC-API-KEY-003 |
|--------|-----------------|
| **方法** | GET |
| **路径** | /api/settings/external-keys |
| **认证** | 有效会话 |
| **预期状态码** | 200 |
| **预期响应** | `{ "keys": [{ "id": "xxx", "name": "...", "keyPreview": "npk_a1b2..." }] }` |
| **验证点** | key 字段只显示预览，不显示完整值 |

#### TC-API-KEY-004：删除 API Key

| 用例ID | TC-API-KEY-004 |
|--------|-----------------|
| **方法** | DELETE |
| **路径** | /api/settings/external-keys/:id |
| **认证** | 有效会话 |
| **预期状态码** | 200 |
| **验证点** | 删除后该 Key 无法再访问 MCP |

#### TC-API-KEY-005：删除他人的 API Key

| 用例ID | TC-API-KEY-005 |
|--------|-----------------|
| **方法** | DELETE |
| **路径** | /api/settings/external-keys/:id |
| **认证** | 用户 A 的会话，但删除用户 B 的 Key |
| **预期状态码** | 404 |

---

### 5.6 发布回传（MCP）

#### TC-API-REPORT-001：报告发布成功

| 用例ID | TC-API-REPORT-001 |
|--------|-------------------|
| **方法** | MCP 工具调用 |
| **工具** | report_publish_result |
| **认证** | API Key |
| **请求参数** | `{ "postId": "xxx", "publishToken": "tok_xxx", "status": "success", "publishedAt": "2026-06-01T15:00:00+08:00", "externalPostId": "123456" }` |
| **预期响应** | `{ "received": true, "postStatus": "published" }` |
| **验证点** | 数据库 Post.status 更新为 published，publishedAt 记录发布时间 |

#### TC-API-REPORT-002：报告发布失败（可重试）

| 用例ID | TC-API-REPORT-002 |
|--------|-------------------|
| **方法** | MCP 工具调用 |
| **工具** | report_publish_result |
| **认证** | API Key |
| **请求参数** | `{ "postId": "xxx", "publishToken": "tok_xxx", "status": "failed", "errorCode": "rate_limit", "errorMessage": "API 限流", "retryable": true }` |
| **预期响应** | `{ "received": true, "postStatus": "failed", "retryable": true }` |
| **验证点** | 数据库 Post.status 更新为 failed，publishError 记录错误信息 |

#### TC-API-REPORT-003：报告发布失败（不可重试）

| 用例ID | TC-API-REPORT-003 |
|--------|-------------------|
| **方法** | MCP 工具调用 |
| **工具** | report_publish_result |
| **认证** | API Key |
| **请求参数** | `{ "postId": "xxx", "publishToken": "tok_xxx", "status": "failed", "errorCode": "content_violation", "errorMessage": "内容违规", "retryable": false }` |
| **预期响应** | `{ "received": true, "postStatus": "failed", "retryable": false }` |

#### TC-API-REPORT-004：回传 - 无效的 publishToken

| 用例ID | TC-API-REPORT-004 |
|--------|-------------------|
| **方法** | MCP 工具调用 |
| **工具** | report_publish_result |
| **认证** | API Key |
| **请求参数** | `{ "postId": "xxx", "publishToken": "invalid_token", "status": "success" }` |
| **预期响应** | `{ "error": "Invalid publish token", "code": "INVALID_TOKEN" }` |
| **预期状态码** | 400 |

#### TC-API-REPORT-005：回传 - 非本人帖子

| 用例ID | TC-API-REPORT-005 |
|--------|-------------------|
| **方法** | MCP 工具调用 |
| **工具** | report_publish_result |
| **认证** | 用户 A 的 API Key |
| **请求参数** | `{ "postId": "xxx" (属于用户B), "publishToken": "tok_xxx", "status": "success" }` |
| **预期响应** | `{ "error": "Post not found", "code": "NOT_FOUND" }` |
| **预期状态码** | 404 |

#### TC-API-REPORT-006：回传 - publishToken 已过期

| 用例ID | TC-API-REPORT-006 |
|--------|-------------------|
| **方法** | MCP 工具调用 |
| **工具** | report_publish_result |
| **认证** | API Key |
| **请求参数** | `{ "postId": "xxx", "publishToken": "tok_xxx", "status": "success" }` |
| **前置条件** | publishToken 已过期（超过 24 小时） |
| **预期响应** | `{ "error": "Publish token expired", "code": "TOKEN_EXPIRED" }` |

---

### 5.7 MCP 外部工具

#### TC-MCP-001：list_accounts - 获取账号列表

| 用例ID | TC-MCP-001 |
|--------|------------|
| **工具** | list_accounts |
| **认证** | API Key |
| **请求参数** | `{}` |
| **预期响应** | `{ "accounts": [{ "id": "xxx", "platform": "twitter", "displayName": "我的推特" }] }` |
| **验证点** | 不返回 handle、description 等敏感信息 |

#### TC-MCP-002：list_accounts - 多用户隔离

| 用例ID | TC-MCP-002 |
|--------|------------|
| **工具** | list_accounts |
| **认证** | 用户 A 的 API Key |
| **预期响应** | 只包含用户 A 的账号，不包含用户 B 的账号 |

#### TC-MCP-003：get_pending_posts - 获取待发布帖子

| 用例ID | TC-MCP-003 |
|--------|------------|
| **工具** | get_pending_posts |
| **认证** | API Key |
| **请求参数** | `{ "limit": 10 }` |
| **预期响应** | `{ "posts": [{ "id": "xxx", "content": "...", "publishToken": "tok_xxx" }] }` |
| **验证点** | 只返回 status=scheduled 的帖子 |

#### TC-MCP-004：get_pending_posts - 按账号筛选

| 用例ID | TC-MCP-004 |
|--------|------------|
| **工具** | get_pending_posts |
| **认证** | API Key |
| **请求参数** | `{ "accountId": "acc_xxx", "limit": 5 }` |
| **预期响应** | 只返回指定账号的待发布帖子 |

#### TC-MCP-005：get_post_detail - 获取帖子详情

| 用例ID | TC-MCP-005 |
|--------|------------|
| **工具** | get_post_detail |
| **认证** | API Key |
| **请求参数** | `{ "postId": "xxx" }` |
| **预期响应** | `{ "post": { "id": "xxx", "content": "...", "mediaUrls": [...], "publishToken": "tok_xxx" } }` |
| **验证点** | 返回完整内容包含 mediaUrls 和 publishToken |

#### TC-MCP-006：get_post_detail - 不存在的帖子

| 用例ID | TC-MCP-006 |
|--------|------------|
| **工具** | get_post_detail |
| **认证** | API Key |
| **请求参数** | `{ "postId": "nonexistent" }` |
| **预期响应** | `{ "error": "Post not found" }` |

---

### 5.7a 外部 MCP 写工具（v0.4 新增）

> **设计说明**：v0.4 起，外部 MCP 具备写能力（受 scope 控制）。共 3 个写工具，每个都需要 `write` 或 `read_write` scope。`update_post` 还受字段白名单 + 状态锁双重保护。

#### TC-MCP-W-001：upload_media_from_url - 成功拉取 PNG

| 用例ID | TC-MCP-W-001 |
|--------|------------|
| **工具** | upload_media_from_url |
| **认证** | API Key（scope: write 或 read_write） |
| **请求参数** | `{ "url": "https://cdn.example.com/x.png" }` |
| **预期响应** | `{ "url": "/api/uploads/2026-06-02/uuid.png", "mimeType": "image/png", "size": 12345, "filename": "..." }` |
| **验证点** | 文件成功落盘，URL 可直接用于 create_post |

#### TC-MCP-W-002：upload_media_from_url - 缺 url 参数

| 用例ID | TC-MCP-W-002 |
|--------|------------|
| **请求参数** | `{ }`（缺 url） |
| **预期响应** | `{ "error": "url is required", "errorCode": "INVALID_ARGUMENT" }` |

#### TC-MCP-W-003：upload_media_from_url - 非 http/https 协议

| 用例ID | TC-MCP-W-003 |
|--------|------------|
| **请求参数** | `{ "url": "file:///etc/passwd" }` |
| **预期响应** | `{ "errorCode": "INVALID_URL" }` |
| **验证点** | 不允许 `file://` / `ftp://` 等协议 |

#### TC-MCP-W-004：upload_media_from_url - 文件超 10MB

| 用例ID | TC-MCP-W-004 |
|--------|------------|
| **请求参数** | 模拟返回 content-length 99999999 的 URL |
| **预期响应** | `{ "errorCode": "FILE_TOO_LARGE" }` |

#### TC-MCP-W-005：upload_media_from_url - 不支持的 mime

| 用例ID | TC-MCP-W-005 |
|--------|------------|
| **请求参数** | 模拟返回 content-type `application/pdf` |
| **预期响应** | `{ "errorCode": "UNSUPPORTED_MIME" }` |

#### TC-MCP-W-006：upload_media_from_url - HTTP 5xx 标记可重试

| 用例ID | TC-MCP-W-006 |
|--------|------------|
| **请求参数** | 模拟返回 HTTP 500 |
| **预期响应** | `{ "errorCode": "FETCH_FAILED", "retryable": true }` |
| **验证点** | 5xx 自动标记 retryable=true，4xx 不会 |

#### TC-MCP-W-007：create_post - 成功创建

| 用例ID | TC-MCP-W-007 |
|--------|------------|
| **工具** | create_post |
| **请求参数** | `{ "accountId": "acct_owned", "content": "Hello", "scheduledTime": "<未来时间>", "mediaUrls": ["/api/uploads/abc.png"] }` |
| **预期响应** | `{ "success": true, "post": { "id": "p_new", "publishToken": "tok_xxx", "status": "scheduled", ... } }` |
| **验证点** | publishToken 格式 `tok_` 开头；返回 post 包含完整字段 |

#### TC-MCP-W-008：create_post - 账号不属于当前用户

| 用例ID | TC-MCP-W-008 |
|--------|------------|
| **请求参数** | `{ "accountId": "other_user_account", ... }` |
| **预期响应** | `{ "errorCode": "ACCOUNT_NOT_FOUND" }` |
| **验证点** | 不能借别人的账号发帖 |

#### TC-MCP-W-009：create_post - content + mediaUrls 都空

| 用例ID | TC-MCP-W-009 |
|--------|------------|
| **请求参数** | `{ "accountId": "acct", "scheduledTime": "..." }`（无 content 无 mediaUrls） |
| **预期响应** | `{ "errorCode": "EMPTY_CONTENT" }` |

#### TC-MCP-W-010：create_post - scheduledTime 是过去时间

| 用例ID | TC-MCP-W-010 |
|--------|------------|
| **请求参数** | `{ "scheduledTime": "2020-01-01T00:00:00Z", ... }` |
| **预期响应** | `{ "errorCode": "SCHEDULED_TIME_IN_PAST" }` |

#### TC-MCP-W-011：create_post - scheduledTime 格式非法

| 用例ID | TC-MCP-W-011 |
|--------|------------|
| **请求参数** | `{ "scheduledTime": "not-a-date", ... }` |
| **预期响应** | `{ "errorCode": "INVALID_SCHEDULED_TIME" }` |

#### TC-MCP-W-012：update_post - 成功改 scheduledTime

| 用例ID | TC-MCP-W-012 |
|--------|------------|
| **工具** | update_post |
| **预置数据** | 1 个 status='scheduled' 的帖子属于当前用户 |
| **请求参数** | `{ "postId": "p1", "scheduledTime": "<新未来时间>" }` |
| **预期响应** | `{ "success": true, "post": { "scheduledTime": "...", "content": "<未变>", "publishToken": "<原 token>" } }` |
| **验证点** | scheduledTime 更新；content/media/account/status 全部不变；publishToken 不重新生成 |

#### TC-MCP-W-013：update_post - published 状态不可改

| 用例ID | TC-MCP-W-013 |
|--------|------------|
| **预置数据** | 1 个 status='published' 的帖子 |
| **请求参数** | `{ "postId": "p_published", "scheduledTime": "..." }` |
| **预期响应** | `{ "errorCode": "INVALID_STATUS" }` |
| **验证点** | publishing/published/failed 状态全部锁定 |

#### TC-MCP-W-014：update_post - failed 状态也不可改

| 用例ID | TC-MCP-W-014 |
|--------|------------|
| **预置数据** | 1 个 status='failed' 的帖子 |
| **预期响应** | `{ "errorCode": "INVALID_STATUS" }` |

#### TC-MCP-W-015：update_post - 字段白名单（content 被忽略）

| 用例ID | TC-MCP-W-015 |
|--------|------------|
| **预置数据** | 1 个帖子，content='Original' |
| **请求参数** | `{ "postId": "p1", "scheduledTime": "...", "content": "HACKED", "mediaUrls": ["/evil.jpg"], "accountId": "other", "status": "published" }` |
| **预期响应** | `{ "success": true, "post": { "content": "Original", "mediaUrls": [...原...], "accountId": "<原>" } }` |
| **验证点** | 字段白名单：content/mediaUrls/accountId/status 全部被静默忽略，不写库 |

#### TC-MCP-W-016：update_post - 帖子不属于当前用户

| 用例ID | TC-MCP-W-016 |
|--------|------------|
| **请求参数** | `{ "postId": "其他用户的帖子", "scheduledTime": "..." }` |
| **预期响应** | `{ "errorCode": "POST_NOT_FOUND" }` |

---

### 5.7b Scope 权限强制（v0.4 新增）

#### TC-MCP-S-001：read scope 调 create_post 被拒

| 用例ID | TC-MCP-S-001 |
|--------|------------|
| **预置数据** | API Key permissions='read' |
| **工具** | create_post |
| **预期响应** | `{ "error": "Tool 'create_post' requires 'write' or 'read_write' scope, but key has 'read'", "errorCode": "INSUFFICIENT_SCOPE" }` |
| **验证点** | read 调写工具立即拒绝，不查 DB，不返回部分数据 |

#### TC-MCP-S-002：write scope 调 list_accounts 被拒

| 用例ID | TC-MCP-S-002 |
|--------|------------|
| **预置数据** | API Key permissions='write' |
| **工具** | list_accounts |
| **预期响应** | `{ "errorCode": "INSUFFICIENT_SCOPE" }` |
| **验证点** | write scope 严格不含 read，三档完全隔离 |

#### TC-MCP-S-003：read_write scope 任意工具都通过

| 用例ID | TC-MCP-S-003 |
|--------|------------|
| **预置数据** | API Key permissions='read_write' |
| **步骤** | 分别调用 list_accounts、get_post_detail、create_post、update_post |
| **预期** | 全部不返回 INSUFFICIENT_SCOPE |

#### TC-MCP-S-004：read_report 历史值自动映射为 read

| 用例ID | TC-MCP-S-004 |
|--------|------------|
| **预置数据** | API Key permissions='read_report'（v0.2 历史值） |
| **步骤** | 调 list_accounts（read 工具） |
| **预期** | 正常通过（向后兼容） |
| **步骤** | 调 create_post（write 工具） |
| **预期** | INSUFFICIENT_SCOPE |

#### TC-MCP-S-005：缺失 permissions 默认为 read

| 用例ID | TC-MCP-S-005 |
|--------|------------|
| **预置数据** | API Key permissions=null |
| **预期** | scope 解析为 'read'，行为同 TC-MCP-S-004 |

---

### 5.7c HTTP 端点 E2E（v0.4 新增，Playwright request fixture）

> **设计说明**：v0.4 起，所有 MCP 工具都通过 `/api/mcp` HTTP 端点对外。单元测试用 `vi.mock` 拦截 prisma，**无法覆盖 transport 层（Next.js Turbopack、路由 handler、JSON-RPC 解析）**。本节用 Playwright `request` fixture 真实 HTTP 调用，验证整条链路通畅。
>
> **历史教训**：v0.4 初版实现完成时，262 个单元测试全绿、tsc 干净，但生产 `/api/mcp` 返回 500——原因是 `server.ts` 有 3 处 `./tools.js` / `./auth.js` 相对 import，Next.js Turbopack 不容忍而 vitest/tsx 容忍。**本节就是兜底这种"测试都过但线上挂"的情况**。

#### TC-MCP-HTTP-001：无 Authorization 头返回 401

| 用例ID | TC-MCP-HTTP-001 |
|--------|------------|
| **真实 HTTP** | `POST /api/mcp` 头不带 Authorization |
| **body** | `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}` |
| **预期** | HTTP 401，body 含 `{"jsonrpc":"2.0","error":{"code":-32602,"message":"API key required..."}}` |
| **验证点** | 鉴权拦截在路由 handler，不进 prisma |

#### TC-MCP-HTTP-002：非 npk_ 前缀返回 401

| 用例ID | TC-MCP-HTTP-002 |
|--------|------------|
| **头** | `Authorization: Bearer bad-format-key` |
| **预期** | HTTP 401，errorCode INVALID_KEY_FORMAT |

#### TC-MCP-HTTP-003：不存在的 npk_ key 返回 401

| 用例ID | TC-MCP-HTTP-003 |
|--------|------------|
| **头** | `Authorization: Bearer npk_000...0`（全 0） |
| **预期** | HTTP 401，errorCode INVALID_KEY |

#### TC-MCP-HTTP-004：initialize 返回 serverInfo

| 用例ID | TC-MCP-HTTP-004 |
|--------|------------|
| **预期响应** | `{result:{serverInfo:{name:"nextpost-external",version:"0.4.2"},protocolVersion:"2024-11-05"}}` |

#### TC-MCP-HTTP-005：tools/list 暴露全部 7 个工具

| 用例ID | TC-MCP-HTTP-005 |
|--------|------------|
| **预期** | 7 个 name 都在 list 里：`list_accounts` / `get_pending_posts` / `get_post_detail` / `report_publish_result` / `upload_media_from_url` / `create_post` / `update_post` |

#### TC-MCP-HTTP-006：list_accounts 脱敏

| 用例ID | TC-MCP-HTTP-006 |
|--------|------------|
| **预期响应** | `accounts[].displayName` 有值，`accounts[].handle` / `accounts[].description` 不存在 |
| **验证点** | 真实 HTTP 链路脱敏生效，不是只在单元 mock 里脱敏 |

#### TC-MCP-HTTP-007：get_pending_posts 媒体 URL 转绝对

| 用例ID | TC-MCP-HTTP-007 |
|--------|------------|
| **预置** | 1 个 scheduled 帖子，mediaUrls=`["/api/uploads/test.jpg"]` |
| **预期** | 返回的 `posts[0].mediaUrls[0]` 以 `http://` 或 `https://` 开头 |
| **验证点** | `toAbsoluteUrl` 在 HTTP 链路生效，客户端可直接下载 |

#### TC-MCP-HTTP-008：get_post_detail 返回 publishToken

| 用例ID | TC-MCP-HTTP-008 |
|--------|------------|
| **预期响应** | `post.publishToken` 字段值与 DB 一致 |

#### TC-MCP-HTTP-009：数据隔离

| 用例ID | TC-MCP-HTTP-009 |
|--------|------------|
| **预置** | 用户 A 调 get_post_detail(post_B_id) |
| **预期** | `{"error":"Post not found"}` |

#### TC-MCP-HTTP-010：read scope 调 create_post → INSUFFICIENT_SCOPE

| 用例ID | TC-MCP-HTTP-010 |
|--------|------------|
| **预置** | read scope API Key |
| **预期响应** | `{"errorCode":"INSUFFICIENT_SCOPE"}` |
| **验证点** | 真实 HTTP 链路 scope 拦截，prisma 不被调 |

#### TC-MCP-HTTP-011：write scope 调 list_accounts → INSUFFICIENT_SCOPE

| 用例ID | TC-MCP-HTTP-011 |
|--------|------------|
| **预置** | write scope API Key |
| **预期响应** | `{"errorCode":"INSUFFICIENT_SCOPE"}` |

#### TC-MCP-HTTP-012：read_write scope create_post 成功 + DB 落库

| 用例ID | TC-MCP-HTTP-012 |
|--------|------------|
| **调用** | create_post 正常参数 |
| **预期** | `success=true`, `post.id` 有值, `post.publishToken` 以 `tok_` 开头 |
| **二次验证** | `prisma.post.findUnique({id})` 查得到记录，userId/status/content 都正确 |
| **验证点** | 不只接口返回成功，**真实写库** |

#### TC-MCP-HTTP-013：create_post 拒绝他人账号

| 用例ID | TC-MCP-HTTP-013 |
|--------|------------|
| **预置** | 另一个用户的 account.id |
| **预期** | `{"errorCode":"ACCOUNT_NOT_FOUND"}` |

#### TC-MCP-HTTP-014：create_post 拒绝过去时间

| 用例ID | TC-MCP-HTTP-014 |
|--------|------------|
| **预期** | `{"errorCode":"SCHEDULED_TIME_IN_PAST"}` |

#### TC-MCP-HTTP-015：update_post 字段白名单 + 状态锁（真实 DB 验证）

| 用例ID | TC-MCP-HTTP-015 |
|--------|------------|
| **调用 1** | update_post 携带 content/mediaUrls/accountId/status + 合法 scheduledTime |
| **预期响应** | `success=true` |
| **二次验证** | `prisma.post.findUnique` 查 DB：content/mediaUrls/accountId/status **全部未被改**，scheduledTime 被改 |
| **调用 2** | 把 post.status 改为 'published'，再调 update_post |
| **预期** | `{"errorCode":"INVALID_STATUS"}` |

---

### 5.8 软删除 + 回收站（v0.3 新增）

> **设计说明**：v0.3 起，用户在 UI 上点击「删除」走软删除（设置 `deletedAt`），而不是物理删除。`/api/trash` 端点用于列出已删除项、恢复或永久删除。本节中的 v0.2 预留的「MCP 内部软删除」仍作为 Phase 2 任务。

#### TC-SOFT-101：用户软删除帖子

| 用例ID | TC-SOFT-101 |
|--------|-------------|
| **模块** | 帖子管理 |
| **前置条件** | 用户已登录，存在帖子 ID `post-001` |
| **测试步骤** | 1. 在 `/posts` 列表中点击帖子的删除按钮<br>2. 在确认弹窗中点击「确认」 |
| **预期结果** | 1. 帖子从列表中消失（`findMany` 过滤了 `deletedAt: null`）<br>2. 数据库 `Post` 表该记录的 `deletedAt` 被设置，`deletedBy = "user"`<br>3. 关联的媒体文件**保留**在 uploads 目录（软删除不清理）<br>4. 帖子在 `/trash` 页面可见 |
| **验证点** | 调用 `GET /api/posts` 看不到该帖子；调用 `GET /api/trash` 能看到该帖子 |

#### TC-SOFT-102：用户软删除账号

| 用例ID | TC-SOFT-102 |
|--------|-------------|
| **模块** | 账号管理 |
| **前置条件** | 用户已登录，存在账号 |
| **测试步骤** | 1. 在 `/accounts` 列表中点击账号的删除按钮<br>2. 确认删除 |
| **预期结果** | 1. 账号从列表消失<br>2. `Account.deletedAt` 被设置，`deletedBy = "user"`<br>3. 账号下的帖子**不**被删除（帖子可独立恢复）<br>4. 账号在 `/trash` 页面可见 |

#### TC-SOFT-103：帖子被软删除后创建同账号新帖子仍然成功

| 用例ID | TC-SOFT-103 |
|--------|-------------|
| **模块** | 帖子管理 |
| **前置条件** | 用户已登录，有一个账号 |
| **测试步骤** | 1. 创建帖子 A<br>2. 软删除帖子 A<br>3. 创建新帖子 B（同账号） |
| **预期结果** | 帖子 B 创建成功，不受帖子 A 删除影响 |

#### TC-SOFT-104：软删除帖子后调用 MCP `get_pending_posts` 不返回该帖子

| 用例ID | TC-SOFT-104 |
|--------|-------------|
| **模块** | MCP 外部 |
| **前置条件** | 帖子 ID `post-001` 已被软删除 |
| **测试步骤** | 通过 MCP 客户端调用 `get_pending_posts` |
| **预期结果** | 返回列表中不包含已软删除的帖子 |

#### TC-SOFT-105：回收站列表 API - GET /api/trash

| 用例ID | TC-SOFT-105 |
|--------|-------------|
| **方法** | GET |
| **路径** | /api/trash |
| **认证** | 有效会话 |
| **预期状态码** | 200 |
| **预期响应** | `{ posts: [...], accounts: [...], totalPosts, totalAccounts }` |
| **验证点** | 只返回当前用户**已软删除**的 Post 和 Account；未删除的不返回 |

#### TC-SOFT-106：恢复已软删除的帖子

| 用例ID | TC-SOFT-106 |
|--------|-------------|
| **方法** | POST |
| **路径** | /api/trash/posts/:id/restore |
| **认证** | 有效会话 |
| **前置条件** | 帖子已被软删除 |
| **预期状态码** | 200 |
| **预期结果** | 1. `Post.deletedAt` 被清空<br>2. 帖子在 `GET /api/posts` 中重新出现<br>3. 帖子从 `GET /api/trash` 中消失 |
| **验证点** | 数据库 `deletedAt = null`；列表 API 能看到 |

#### TC-SOFT-107：恢复已软删除的账号

| 用例ID | TC-SOFT-107 |
|--------|-------------|
| **方法** | POST |
| **路径** | /api/trash/accounts/:id/restore |
| **预期结果** | 同 TC-SOFT-106，作用于 Account |

#### TC-SOFT-108：永久删除帖子

| 用例ID | TC-SOFT-108 |
|--------|-------------|
| **方法** | DELETE |
| **路径** | /api/trash/posts/:id |
| **认证** | 有效会话 |
| **前置条件** | 帖子已被软删除 |
| **预期状态码** | 200 |
| **预期结果** | 1. 数据库 `Post` 表该记录被物理删除<br>2. 关联的媒体文件从 uploads 目录物理删除<br>3. 从 `GET /api/trash` 列表中消失 |
| **验证点** | 直接查询 `prisma.post.findUnique` 返回 null；uploads 目录文件不存在 |

#### TC-SOFT-109：永久删除账号

| 用例ID | TC-SOFT-109 |
|--------|-------------|
| **方法** | DELETE |
| **路径** | /api/trash/accounts/:id |
| **预期结果** | 1. `Account` 物理删除<br>2. 该账号下的**所有帖子**也一并级联物理删除<br>3. 这些帖子的媒体文件一并删除 |

#### TC-SOFT-110：恢复/永久删除不属于自己的资源

| 用例ID | TC-SOFT-110 |
|--------|-------------|
| **前置条件** | 用户 A 拥有帖子 `post-A` |
| **测试步骤** | 用户 B 调用 `POST /api/trash/posts/post-A/restore` 或 `DELETE /api/trash/posts/post-A` |
| **预期结果** | 返回 404 POST_NOT_FOUND（不泄露存在性） |

#### TC-SOFT-111：回收站页面 E2E - 列表展示

| 用例ID | TC-SOFT-111 |
|--------|-------------|
| **模块** | 回收站 UI |
| **前置条件** | 用户已登录，已软删除 1 个帖子和 1 个账号 |
| **测试步骤** | 1. 访问 `/trash`<br>2. 查看页面 |
| **预期结果** | 1. 页面正常加载<br>2. 显示帖子和账号两个 Tab<br>3. 帖子 Tab 默认激活，显示 1 个软删除帖子<br>4. 切换账号 Tab 显示 1 个软删除账号 |
| **验证点** | DOM 中可见删除时间、原始内容、删除者、操作按钮 |

#### TC-SOFT-112：回收站页面 E2E - 恢复帖子

| 用例ID | TC-SOFT-112 |
|--------|-------------|
| **模块** | 回收站 UI |
| **前置条件** | 帖子已被软删除 |
| **测试步骤** | 1. 访问 `/trash`<br>2. 点击帖子项的「恢复」按钮 |
| **预期结果** | 1. 显示成功 Toast「已恢复」<br>2. 帖子从回收站列表中消失<br>3. 访问 `/posts` 能看到该帖子 |

#### TC-SOFT-113：回收站页面 E2E - 永久删除

| 用例ID | TC-SOFT-113 |
|--------|-------------|
| **模块** | 回收站 UI |
| **前置条件** | 帖子已被软删除 |
| **测试步骤** | 1. 访问 `/trash`<br>2. 点击「永久删除」按钮<br>3. 在确认弹窗中点击「确认」 |
| **预期结果** | 1. 显示成功 Toast「已永久删除」<br>2. 帖子从回收站列表中消失<br>3. 调用 `GET /api/trash` 不再返回该帖子 |

#### TC-SOFT-114：回收站页面 E2E - 永久删除二次确认

| 用例ID | TC-SOFT-114 |
|--------|-------------|
| **模块** | 回收站 UI |
| **测试步骤** | 1. 在回收站点击「永久删除」<br>2. 在确认弹窗中点击「取消」 |
| **预期结果** | 1. 弹窗关闭<br>2. 帖子仍保留在回收站列表中 |

#### TC-SOFT-115：回收站页面 E2E - 空状态

| 用例ID | TC-SOFT-115 |
|--------|-------------|
| **模块** | 回收站 UI |
| **前置条件** | 当前用户无任何已删除项 |
| **测试步骤** | 访问 `/trash` |
| **预期结果** | 显示空状态插图 + 引导文案「回收站是空的」 |
]<]minimax[>[</invoke>
]<]minimax[>[</tool_call>

---

### 5.9 覆盖率补充测试用例（v0.5 新增）

> **设计说明**：v0.5 主要为提升测试覆盖率（Branch 分支从 ~85% 提升到 92.21%），补充之前未覆盖的边界场景。本节详组补充的所有测试用例，与现有测试代码一一对应。

#### 5.9.1 `MediaPreview` 组件

##### TC-PREVIEW-001：`isVideoSource` 工具函数 - 显式 type 优先级

| 用例ID | TC-PREVIEW-001 |
|--------|------------|
| **函数** | `isVideoSource(src, type?)` |
| **验证点** | 显式传入的 `type` 参数优先级最高 |
| **测试场景** | `type='video'` → 总是 true<br>`type='image'` → 总是 false<br>其他 type 仍根据 src 判断 |

##### TC-PREVIEW-002：`isVideoSource` - data: URL MIME 判断

| 用例ID | TC-PREVIEW-002 |
|--------|------------|
| **函数** | `isVideoSource` |
| **验证点** | data: URL 根据 mime 识别 |
| **测试场景** | `data:video/mp4;base64,...` → true<br>`data:image/png;base64,...` → false<br>`data:application/...` → false |

##### TC-PREVIEW-003：`isVideoSource` - URL 后缀判断

| 用例ID | TC-PREVIEW-003 |
|--------|------------|
| **函数** | `isVideoSource` |
| **验证点** | 各种视频后缀名识别 |
| **测试场景** | `.mp4` / `.webm` / `.ogg` / `.mov` 路径 → true<br>`.jpg` 路径 → false<br>空 src → false |

##### TC-PREVIEW-004：`MediaPreview` 组件 - 空 src 渲染 Fallback

| 用例ID | TC-PREVIEW-004 |
|--------|------------|
| **验证点** | 空 src（包含 undefined）渲染 default fallback 或自定义 fallback |
| **测试场景** | `<MediaPreview src="" />` 渲染默认占位<br>`<MediaPreview src={undefined} fallback={...} />` 渲染自定义 fallback |

##### TC-PREVIEW-005：`MediaPreview` - 强制类型覆盖

| 用例ID | TC-PREVIEW-005 |
|--------|------------|
| **验证点** | 显式 `type` 覆盖自动判断 |
| **测试场景** | `type='image'` 与 `.mp4` URL → 渲染 img 元素<br>`type='video'` 与 `.jpg` URL → 触发 VideoThumbnail |

##### TC-PREVIEW-006：`MediaPreview` - data:image 直接透传

| 用例ID | TC-PREVIEW-006 |
|--------|------------|
| **验证点** | `data:image/jpeg;base64,...` URL 直接作为缩略图显示，不进行视频抽帧 |
| **验证点** | `data:image/svg+xml,...` 仍会触发视频抽帧逻辑 |

##### TC-PREVIEW-007：`VideoThumbnail` - 抽帧错误处理

| 用例ID | TC-PREVIEW-007 |
|--------|------------|
| **验证点** | 视频加载出错时调用 `onThumbnailError` 回调、显示错误状态（fallback + 播放图标） |
| **测试场景** | 触发 `video.error` 事件 → onThumbnailError 被调用，错误状态下仍显示 play 图标 |

##### TC-PREVIEW-008：`VideoThumbnail` - 抽帧成功

| 用例ID | TC-PREVIEW-008 |
|--------|------------|
| **验证点** | `loadeddata` 后计算抽帧时间（`min(0.1, duration/2)`）→ `seeked` 后生成 dataURL 缩略图 |
| **测试场景** | 触发 `loadeddata` 后 `currentTime=0.1`<br>触发 `seeked` 后 thumbnail 设置为 data:image/jpeg;base64,... |

##### TC-PREVIEW-009：`VideoThumbnail` - 异常尺寸（0/正方形/纵高）处理

| 用例ID | TC-PREVIEW-009 |
|--------|------------|
| **验证点** | videoWidth=0 或 videoHeight=0 时使用 maxSize 默认值 |
| **测试场景** | 0x0、正方形、纵高 各种情况都能生成缩略图 |

##### TC-PREVIEW-010：`VideoThumbnail` - 卸载清理

| 用例ID | TC-PREVIEW-010 |
|--------|------------|
| **验证点** | 组件卸载时 video src 被清空、不报 error |
| **测试场景** | unmount 后不报错 |

---

#### 5.9.2 `MediaUploader` 组件

##### TC-UPLOADER-001：初始 URL 预览使用原图

| 用例ID | TC-UPLOADER-001 |
|--------|------------|
| **验证点** | 编辑场景下预览 img 总是使用 original URL，不使用 thumbnail |
| **测试场景** | initialUrls + initialThumbnails 传入，验证渲染的 img.src 是 original URL，不包含 `.thumb.webp` |

##### TC-UPLOADER-002：视频识别

| 用例ID | TC-UPLOADER-002 |
|--------|------------|
| **验证点** | 根据文件后缀识别 video（mp4/webm/mov/ogg） |
| **测试场景** | 混合视频扩展名的 initialUrls 全部走 MediaPreview 视频分支 |

##### TC-UPLOADER-003：图片/视频数量限制

| 用例ID | TC-UPLOADER-003 |
|--------|------------|
| **验证点** | 超过 `maxImages`/`maxVideos` 时通过 `addToast` 提示，且不添加 |
| **测试场景** | maxImages=2 时上传第 3 张图 → 错误 toast；类似地验证 video 限制 |

##### TC-UPLOADER-004：文件大小限制

| 用例ID | TC-UPLOADER-004 |
|--------|------------|
| **验证点** | 超过 `maxFileSize` 时通过 `addToast` 提示，不添加 |
| **测试场景** | maxFileSize=1KB 上传 10KB 文件 → 错误 toast |

##### TC-UPLOADER-005：不支持的格式

| 用例ID | TC-UPLOADER-005 |
|--------|------------|
| **验证点** | 不属于 image/* 或 video/* 的文件被拒绝 |
| **测试场景** | 上传 application/pdf → 错误 toast |

##### TC-UPLOADER-006：混合媒体限制

| 用例ID | TC-UPLOADER-006 |
|--------|------------|
| **验证点** | 当 `allowMixedMedia=false` 且已有图片时，上传视频被拒绝 |
| **测试场景** | maxImages=0、maxVideos=1、allowMixedMedia=false 场景下上传 mp4 → 错误 toast |

##### TC-UPLOADER-007：拖拽上传交互

| 用例ID | TC-UPLOADER-007 |
|--------|------------|
| **验证点** | dragOver/dragLeave/drop 事件均能正确处理 |
| **测试场景** | dragOver 切换 isDragging 状态，drop 触发文件处理，不报错 |

##### TC-UPLOADER-008：点击上传区触发文件选择

| 用例ID | TC-UPLOADER-008 |
|--------|------------|
| **验证点** | 点击上传区调用隐藏 input 的 click() |
| **测试场景** | 点击后 vi.spyOn(input, 'click') 被调用 |

##### TC-UPLOADER-009：文件输入变更触发处理

| 用例ID | TC-UPLOADER-009 |
|--------|------------|
| **验证点** | input onChange 触发 handleFiles |
| **测试场景** | 变更 input.files 后 onChange 被调用 |

##### TC-UPLOADER-010：文件缩略图生成成功上传

| 用例ID | TC-UPLOADER-010 |
|--------|------------|
| **验证点** | generateThumbnail 完成后 onChange 回调被调用，files 包含新文件 |
| **测试场景** | 模拟上传 jpg/png/mp4 文件后 onChange 被调用 |

---

#### 5.9.3 `Pagination` 组件

##### TC-PAGINATION-001：超过 5 页 - currentPage <= 3 显示首页 5 页

| 用例ID | TC-PAGINATION-001 |
|--------|------------|
| **验证点** | totalPages=10、currentPage=2 时显示 1,2,3,4,5 |

##### TC-PAGINATION-002：超过 5 页 - currentPage >= totalPages-2 显示末页 5 页

| 用例ID | TC-PAGINATION-002 |
|--------|------------|
| **验证点** | totalPages=10、currentPage=9 时显示 6,7,8,9,10 |

##### TC-PAGINATION-003：超过 5 页 - currentPage 中间页显示中间 5 页

| 用例ID | TC-PAGINATION-003 |
|--------|------------|
| **验证点** | totalPages=10、currentPage=5 时显示 3,4,5,6,7 |

##### TC-PAGINATION-004：点击页码调用 onPageChange

| 用例ID | TC-PAGINATION-004 |
|--------|------------|
| **验证点** | 点击页码按钮调用 onPageChange(pageNum) |

##### TC-PAGINATION-005：当前页高亮

| 用例ID | TC-PAGINATION-005 |
|--------|------------|
| **验证点** | 当前页码按钮有 `bg-blue-600` class |

##### TC-PAGINATION-006：每页条数选择器

| 用例ID | TC-PAGINATION-006 |
|--------|------------|
| **验证点** | onPageSizeChange 被提供时显示 select，change 时调用回调 |

---

#### 5.9.4 `/api/posts/[id]` PATCH 分支

##### TC-POSTID-PATCH-001：未认证返回 401

| 用例ID | TC-POSTID-PATCH-001 |
|--------|------------|
| **路径** | PATCH /api/posts/:id |
| **测试** | session 为 null |
| **预期** | 401 `{ error: "未授权" }` |

##### TC-POSTID-PATCH-002：切换账号成功

| 用例ID | TC-POSTID-PATCH-002 |
|--------|------------|
| **路径** | PATCH /api/posts/:id |
| **请求体** | `{ "accountId": "new-account" }` |
| **预期** | 验证新账号归属，更新成功 |

##### TC-POSTID-PATCH-003：修改 scheduledTime 为日期

| 用例ID | TC-POSTID-PATCH-003 |
|--------|------------|
| **路径** | PATCH /api/posts/:id |
| **请求体** | `{ "scheduledTime": "2025-01-15T10:00:00Z" }` |
| **预期** | scheduledTime 更新为 Date 对象 |

##### TC-POSTID-PATCH-004：清空 scheduledTime

| 用例ID | TC-POSTID-PATCH-004 |
|--------|------------|
| **路径** | PATCH /api/posts/:id |
| **请求体** | `{ "scheduledTime": "" }` |
| **预期** | scheduledTime 更新为 null（`scheduledTime ? new Date : null`） |

##### TC-POSTID-PATCH-005：更新 mediaUrls 和 mediaThumbnails

| 用例ID | TC-POSTID-PATCH-005 |
|--------|------------|
| **路径** | PATCH /api/posts/:id |
| **请求体** | `{ "mediaUrls": [...], "mediaThumbnails": [...] }` |
| **预期** | 两个字段都被 JSON.stringify 后保存 |

##### TC-POSTID-PATCH-006：更新 externalPostUrl

| 用例ID | TC-POSTID-PATCH-006 |
|--------|------------|
| **路径** | PATCH /api/posts/:id |
| **请求体** | `{ "externalPostUrl": "https://twitter.com/.../status/123" }` |
| **预期** | externalPostUrl 被更新 |

##### TC-POSTID-PATCH-007：切换到其他用户账号被拒

| 用例ID | TC-POSTID-PATCH-007 |
|--------|------------|
| **路径** | PATCH /api/posts/:id |
| **请求体** | `{ "accountId": "other-user-account" }` |
| **预期** | 404 `{ error: "账号不存在" }` |

##### TC-POSTID-DELETE-001：DELETE 未认证返回 401

| 用例ID | TC-POSTID-DELETE-001 |
|--------|------------|
| **路径** | DELETE /api/posts/:id |
| **测试** | session 为 null |
| **预期** | 401 `{ error: "未授权" }` |

---

#### 5.9.5 `/api/accounts/[id]` PATCH/DELETE 401 + description 分支

##### TC-ACCTID-PATCH-001：PATCH 未认证返回 401

| 用例ID | TC-ACCTID-PATCH-001 |
|--------|------------|
| **路径** | PATCH /api/accounts/:id |
| **测试** | session 为 null |
| **预期** | 401 `{ error: "未授权" }` |

##### TC-ACCTID-PATCH-002：保留 description（未提供时不修改）

| 用例ID | TC-ACCTID-PATCH-002 |
|--------|------------|
| **路径** | PATCH /api/accounts/:id |
| **请求体** | `{ "name": "新名称" }`（不传 description） |
| **预期** | 验证 update.data.description 仍为原值（`description !== undefined ? description : existing.description` true 分支） |

##### TC-ACCTID-PATCH-003：更新 description

| 用例ID | TC-ACCTID-PATCH-003 |
|--------|------------|
| **路径** | PATCH /api/accounts/:id |
| **请求体** | `{ "description": "新描述" }` |
| **预期** | description 被更新 |

##### TC-ACCTID-PATCH-004：清空 description 为 null

| 用例ID | TC-ACCTID-PATCH-004 |
|--------|------------|
| **路径** | PATCH /api/accounts/:id |
| **请求体** | `{ "description": null }` |
| **预期** | description 显式设为 null（`description !== undefined` true 分支） |

##### TC-ACCTID-DELETE-001：DELETE 未认证返回 401

| 用例ID | TC-ACCTID-DELETE-001 |
|--------|------------|
| **路径** | DELETE /api/accounts/:id |
| **测试** | session 为 null |
| **预期** | 401 `{ error: "未授权" }` |

---

#### 5.9.6 `/api/accounts/[id]/config` 三层默认值回退

##### TC-PLATFORM-CFG-001：自定义配置完全覆盖默认值

| 用例ID | TC-PLATFORM-CFG-001 |
|--------|------------|
| **路径** | GET /api/accounts/:id/config |
| **预置** | 平台 Twitter，dbConfig 提供 maxContentLength=1000/maxImages=10/maxVideos=2/allowMixedMedia=false |
| **预期** | 所有字段采用 dbConfig 值（验证三层 `??` 表达式的 true 分支） |

##### TC-PLATFORM-CFG-002：部分配置 + 默认回退

| 用例ID | TC-PLATFORM-CFG-002 |
|--------|------------|
| **路径** | GET /api/accounts/:id/config |
| **预置** | 平台 Twitter，dbConfig 只提供 maxContentLength=500 |
| **预期** | maxContentLength=500（dbConfig），maxImages=4/maxVideos=1/allowMixedMedia=true（Twitter 默认） |

##### TC-PLATFORM-CFG-003：未知平台 + 无配置 → 全局默认值

| 用例ID | TC-PLATFORM-CFG-003 |
|--------|------------|
| **路径** | GET /api/accounts/:id/config |
| **预置** | 平台 "UnknownPlatform"（不在 DEFAULT_PLATFORM_CONFIG），config=null |
| **预期** | maxContentLength=280/maxImages=4/maxVideos=1/allowMixedMedia=true（全局默认） |

---

#### 5.9.7 `/api/media/[path]` GET MIME 分支

##### TC-MEDIAPATH-001：jpep/jpg/png/gif/webp 图片 MIME

| 用例ID | TC-MEDIAPATH-001 |
|--------|------------|
| **路径** | GET /api/media/:path |
| **预置** | uploads 目录下存在各种扩展名文件 |
| **预期** | Content-Type 正确：`image/jpeg` / `image/jpeg` / `image/png` / `image/gif` / `image/webp` |

##### TC-MEDIAPATH-002：mp4/webm/ogg/mov 视频 MIME

| 用例ID | TC-MEDIAPATH-002 |
|--------|------------|
| **路径** | GET /api/media/:path |
| **预置** | uploads 目录下存在各种视频文件 |
| **预期** | Content-Type 正确：`video/mp4` / `video/webm` / `video/ogg` / `video/quicktime` |

##### TC-MEDIAPATH-003：未知扩展名 → application/octet-stream

| 用例ID | TC-MEDIAPATH-003 |
|--------|------------|
| **路径** | GET /api/media/:path |
| **预置** | uploads 目录下存在 `.xyz` 文件 |
| **预期** | Content-Type 为 `application/octet-stream` |

##### TC-MEDIAPATH-004：URL 编码路径解码

| 用例ID | TC-MEDIAPATH-004 |
|--------|------------|
| **路径** | GET /api/media/:encodedPath |
| **预置** | uploads/2024-01-01/test decode.jpg |
| **预期** | decodeURIComponent 正确处理中文、空格、`%E6%B5%8B%E8%AF%95` 等 |

##### TC-MEDIAPATH-005：缓存头

| 用例ID | TC-MEDIAPATH-005 |
|--------|------------|
| **路径** | GET /api/media/:path |
| **预期** | `Cache-Control: public, max-age=31536000` |

---

#### 5.9.8 `lib/storage/thumbnail.ts` 递归质量压缩

##### TC-THUMB-001：`generateThumbnail` 默认参数

| 用例ID | TC-THUMB-001 |
|--------|------------|
| **函数** | `generateThumbnail(buffer)` |
| **验证点** | 不传 maxSize/quality 时使用默认 60/70 |
| **测试场景** | 默认调用返回 WebP Buffer |

##### TC-THUMB-002：`generateThumbnail` 递归压缩

| 用例ID | TC-THUMB-002 |
|--------|------------|
| **函数** | `generateThumbnail` |
| **验证点** | 当初始 webp 超过 30KB 且 quality>20 时递归 quality-10 直至达标 |
| **测试场景** | 高墒噪点 800x800 图片能触发递归路径 |

##### TC-THUMB-003：`needsThumbnail` > 30KB

| 用例ID | TC-THUMB-003 |
|--------|------------|
| **函数** | `needsThumbnail(filePath)` |
| **验证点** | 文件 > 30KB → true |

##### TC-THUMB-004：`needsThumbnail` <= 30KB

| 用例ID | TC-THUMB-004 |
|--------|------------|
| **函数** | `needsThumbnail(filePath)` |
| **验证点** | 文件 <= 30KB → false |
| **边界** | 30KB 整不触发缩略图生成 |

##### TC-THUMB-005：`needsThumbnail` 文件不存在

| 用例ID | TC-THUMB-005 |
|--------|------------|
| **函数** | `needsThumbnail(filePath)` |
| **验证点** | 不存在路径 → false（不抛错） |

---

### 5.10 v0.5 测试覆盖快照

| 文件 | 原始覆盖率（Branch） | 当前覆盖率（Branch） | 备注 |
|------|---------------------|---------------------|------|
| `MediaPreview.tsx` | 89.53% | 89.53% | v0.4 已达标，v0.5 补充边界用例 |
| `MediaUploader.tsx` | 87.2% | 87.2% | v0.4 已达标，v0.5 补充错误提示分支 |
| `Pagination.tsx` | 100% | 100% | 全部页码范围覆盖 |
| `/api/posts/[id]/route.ts` | 72.22% | **100%** | v0.5 重点提升：401 + PATCH 全部分支 |
| `/api/accounts/[id]/route.ts` | 78.57% | **100%** | v0.5 重点提升：401 + description 三态 |
| `/api/accounts/[id]/config/route.ts` | 75% | **100%** | v0.5 重点提升：三层 ?? 三种状态 |
| `/api/media/[path]/route.ts` | 50% | **100%** | v0.5 重点提升：所有 MIME 类型 |
| `lib/storage/thumbnail.ts` | 66.66% | **100%** | v0.5 重点提升：递归路径 + needsThumbnail |
| **总体 Branch 覆盖率** | ~85% | **92.21%** | 从 ~85% 提升到 92.21% |

**v0.5 新增/补充的测试总数**：约 70+ 个独立测试用例


| 用例ID | 测试场景 | 预期指标 |
|--------|---------|----------|
| TC-PERF-001 | 首页加载 | FCP< 1.5s |
| TC-PERF-002 | 帖子列表加载 (20条) | < 500ms |
| TC-PERF-003 | 帖子列表加载 (100条) | < 1s |
| TC-PERF-004 | 日历视图加载 | < 800ms |
| TC-PERF-005 | 图片上传 (5MB) | < 3s |

### 6.2 安全测试

| 用例ID | 测试场景 | 预期结果 |
|--------|---------|----------|
| TC-SEC-001 | SQL 注入 - 用户名 | 被转义，无注入风险 |
| TC-SEC-002 | XSS - 帖子内容 | 被转义，无脚本执行 |
| TC-SEC-003 | 越权访问 - 其他用户帖子 | 返回 404 |
| TC-SEC-004 | CSRF - 表单提交 | Token 验证通过 |
| TC-SEC-005 | 暴力破解登录 | 5 次失败后锁定 |

### 6.3 MCP 安全测试

| 用例ID | 测试场景 | 预期结果 |
|--------|---------|----------|
| TC-MCP-SEC-001 | 无效 API Key 访问 | 返回 401，连接被拒绝 |
| TC-MCP-SEC-002 | 过期 API Key 访问 | 返回 401，提示 Key 已过期 |
| TC-MCP-SEC-003 | 用户 A 的 Key 访问用户 B 的数据 | 数据隔离，只返回用户 A 的数据 |
| TC-MCP-SEC-004 | 外部 MCP 获取账号 - 敏感信息泄露 | 不返回 handle、description |
| TC-MCP-SEC-005 | 外部 MCP 获取帖子 - 完整内容 | 返回 content、mediaUrls、publishToken |
| TC-MCP-SEC-006 | publishToken 伪造攻击 | 返回 400 INVALID_TOKEN |
| TC-MCP-SEC-007 | 回传时修改他人帖子 | 返回 404 POST_NOT_FOUND |
| TC-MCP-SEC-008 | read scope 调 create_post | 返回 INSUFFICIENT_SCOPE，不查 DB |
| TC-MCP-SEC-009 | write scope 调 list_accounts | 返回 INSUFFICIENT_SCOPE（三档严格隔离） |
| TC-MCP-SEC-010 | update_post 携带 content/mediaUrls 字段 | 字段被静默忽略，不写库 |
| TC-MCP-SEC-011 | update_post 修改已 published 帖子 | 返回 INVALID_STATUS |
| TC-MCP-SEC-012 | upload_media_from_url 走 file:// 协议 | 返回 INVALID_URL，不读盘 |
| TC-MCP-SEC-013 | upload_media_from_url 上传 50MB 文件 | 返回 FILE_TOO_LARGE |

---

## 7. 兼容性测试

### 7.1 浏览器兼容性

| 用例ID | 浏览器 | 版本 | 预期结果 |
|--------|--------|------|----------|
| TC-COMP-001 | Chrome | 最新版 | 正常 |
| TC-COMP-002 | Chrome | 120 | 正常 |
| TC-COMP-003 | Firefox | 最新版 | 正常 |
| TC-COMP-004 | Firefox | 121 | 正常 |
| TC-COMP-005 | Safari | 17+ | 正常 |
| TC-COMP-006 | Edge | 最新版 | 正常 |

### 7.2 响应式布局

| 用例ID | 屏幕尺寸 | 预期结果 |
|--------|---------|----------|
| TC-RESP-001 | 1920x1080 (Desktop) | 完整侧边栏 |
| TC-RESP-002 | 1024x768 (Tablet) | 可折叠侧边栏 |
| TC-RESP-003 | 375x667 (Mobile) | 底部导航，汉堡菜单 |

---

## 8. 测试执行计划

### 8.1 里程碑

| 阶段 | 内容 | 目标日期 |
|------|------|----------|
| M1 | 测试环境搭建 | 第 1 天 |
| M2 | 单元测试编写 | 第 2-3 天 |
| M3 | 集成测试编写 | 第 4-5 天 |
| M4 | E2E 测试编写 | 第 6-7 天 |
| M5 | 第一轮测试执行 | 第 8-10 天 |
| M6 | Bug 修复与复测 | 第 11-13 天 |
| M7 | 第二轮测试执行 | 第 14-15 天 |
| M8 | 测试报告输出 | 第 16 天 |

### 8.2 测试优先级

| 优先级 | 说明 | 覆盖模块 |
|--------|------|----------|
| P0 | 核心流程，必须通过 | 认证、账号管理、帖子管理 |
| P1 | 重要功能，应该通过 | 日历、列表、设置 |
| P2 | 增强功能，可以延迟 | 媒体上传、性能测试 |

---

## 9. 测试交付物

|交付物 | 说明 | 模板 |
|--------|------|------|
| 测试计划 | 本文档 | TEST_PLAN.md |
| 测试用例 | 所有用例详情 | TEST_CASES.md |
| 测试脚本 | 自动化测试代码 | tests/ |
| 测试报告 | 执行结果汇总 | TEST_REPORT.md |
| Bug 记录 | 缺陷跟踪 | BUG_LIST.md |

---

## 10. 附录

### 10.1 测试数据模板

```sql
-- 测试用户
INSERT INTO User (id, username, password, email)
VALUES ('user-test-001', 'testuser', '$2b$10$...', 'test@example.com');

-- 测试账号
INSERT INTO Account (id, userId, name, handle, platformId) 
VALUES ('acct-test-001', 'user-test-001', '测试账号', '@testacc', 'platform-twitter');

-- 测试帖子
INSERT INTO Post (id, userId, accountId, content, scheduledTime, status) 
VALUES ('post-test-001', 'user-test-001', 'acct-test-001', '测试内容', '2026-06-01 15:00:00', 'scheduled');
```

### 10.2 术语表

| 术语 | 说明 |
|------|------|
| MVP | Minimum Viable Product，最小可行产品 |
| E2E | End to End，端到端测试 |
| FCP | First Contentful Paint，首次内容绘制 |
| P0/P1/P2 | 优先级定义，P0 最高 |

---

### 10.3 v0.4 测试覆盖快照

| 模块 | 单元测试 | 覆盖率（stmts） | 备注 |
|------|---------|-----------------|------|
| `mcp/external/auth.ts` | 17 用例 | 100% | parseScope / hasScope / validateApiKey / generateApiKey / deleteApiKey / listApiKeys |
| `mcp/external/tools.ts` | 41 用例 | 93.33% | 4 读 + 5 写 + scope 强制 + URL/媒体校验 + 错误分支 |
| `mcp/external/server.ts` | 集成 E2E | — | 端到端流程 |
| **全量** | **262 用例** | **89.4%** stmts / **84%** branches | 0 失败，tsc 干净 |

**新增加的安全断言**（相对 v0.4 初版）：

- 写工具不允许 read scope 调（5 个工具 × 2 个错 scope = 10 断言）
- 写工具不允许 write scope 调读工具（2 断言）
- 字段白名单静默忽略（2 断言：accountId / status 各一，content / mediaUrls 在 v0.4.2 起已加入白名单可改）
- 状态锁拒绝 publishing/published/failed（3 断言）
- 媒体 URL 协议白名单 + mime 白名单 + 大小限制（5 断言）
- 过去时间拒绝（2 断言：create + update）

---

*文档生成时间：2026-05-31*
*最后更新：2026-06-04（v0.4.8 端口单一源 + e2e 4 skipped 修复 + 核心覆盖补充；vitest 671 通过 / e2e 96 通过 0 skipped）*
