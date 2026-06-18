# NextPost - 社媒帖子发布计划工具

一款可视化社媒内容发布计划管理工具，帮助你规划、管理多平台多账号的社交媒体发布计划。支持 AI 辅助编辑，让内容创作更高效。

## ✨ 功能特性

### 核心功能

- **多账号管理** - 一站式管理多个社交媒体账号
- **内容创作** - 创建帖子内容，支持文本和图片
- **计划调度** - 精确到分钟的发布计划安排
- **日历视图** - 按月/周/日查看发布计划
- **列表视图** - 表格形式展示所有计划，支持筛选排序
- **回收站** - 误删内容可恢复

### AI 集成 (MCP)

- **AI 助手连接** - 通过 MCP 协议连接 AI 助手
- **智能创作** - AI 帮你创建和编辑内容
- **发布状态追踪** - AI 自动更新发布结果
- **安全权限控制** - API Key 分级权限管理

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

# 初始化数据库
pnpm db:generate
pnpm db:migrate:local && pnpm db:seed
```

### 配置环境变量

创建 `.env` 文件：

```bash
# 认证密钥 (生成: openssl rand -base64 32)
AUTH_SECRET=your-secret-key

# 数据库
DATABASE_URL="file:./data/nextpost.db"

# 文件存储
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# 应用 URL（单一源；dev.mjs 启动时会自动派生 NEXTAUTH_URL / PORT / NEXT_PUBLIC_BASE_URL）
# 生产环境改成真实域名，如 https://nextpost.example.com
APP_URL=http://localhost:3456
```

### 启动

```bash
pnpm dev
```

访问 [http://localhost:3456](http://localhost:3456)

> 想换端口？只需修改 `.env` 里的 `APP_URL`，dev.mjs 会自动解析端口并启动。

## 🤖 AI 助手集成

NextPost 支持通过 MCP 协议连接 AI 助手（如 Claude Desktop），实现智能化的社交媒体管理。

### 连接设置

1. 在设置页面创建 API Key
2. 获取 MCP 端点地址
3. 在 AI 助手中配置连接

### 配置示例

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

### AI 能帮你做什么

- 查看今日/本周发布计划
- 创建新的帖子内容
- 修改发布时间
- 追踪发布结果
- 批量管理内容

### 权限说明

| 权限级别 | 说明 |
|---------|------|
| read | 仅读取数据 |
| write | 仅创建/修改 |
| read_write | 完整访问（推荐） |

## 🛠️ 命令

```bash
pnpm dev          # 开发服务器
pnpm build        # 构建生产版本
pnpm start        # 启动生产服务器
pnpm test         # 运行测试
pnpm test:e2e     # E2E 测试
pnpm test:coverage # 覆盖率报告
```

## 📁 项目结构

```
nextpost/
├── app/           # 页面和 API
├── components/    # 组件
├── lib/           # 工具库（含统一 config.ts 集中常量）
├── mcp/           # 外部 MCP 工具实现
├── stores/        # Zustand 状态管理
├── scripts/       # 启动脚本（dev.mjs：env 解析 + 启动 next dev）
├── src/lib/db/    # 数据库（schema + drizzle client）
├── tests/         # 测试（vitest + playwright）
└── docs/          # 文档
```

## 🛠 命令

```bash
pnpm dev           # 开发服务器（脚本解析 APP_URL 后启动 next dev）
pnpm build         # 构建生产版本
pnpm start         # 启动生产服务器
pnpm test          # vitest 单元测试
pnpm test:watch    # vitest watch 模式
pnpm test:coverage # vitest 覆盖率报告
pnpm test:e2e      # Playwright e2e 测试
pnpm test:e2e:ui   # Playwright UI 模式
pnpm test:e2e:debug # Playwright 调试模式
pnpm mcp:external  # 启动独立外部 MCP Server
```

## 🧪 测试

| 层级 | 命令 | 数量 | 说明 |
|---|---|---|---|
| 单元 | `pnpm test` | 754 tests | vitest 覆盖 stores / middleware / components / page / API |
| 覆盖率 | `pnpm test:coverage` | — | 40 个被覆盖源文件全部 ≥ 80% |
| E2E | `pnpm test:e2e` | 96 passed, 0 skipped | Playwright 真实浏览器 |

E2E 通过 `tests/e2e/global-setup.ts` 自动 seed `testuser/password123` 账号 + 默认 Twitter 平台 + Twitter 账号，保证 4 个曾因账号缺失被 skip 的测试可执行。

## 📝 开发文档

更多开发细节请参考：

- [项目计划](./docs/PROJECT_PLAN.md)
- [测试计划](./docs/TEST_PLAN.md)
- [UI 设计](./docs/UI_DESIGN.md)
- [MCP 设计](./docs/MCP_DESIGN.md)

## 📄 许可证

MIT License

---

*Last updated: 2026-06-18 (v0.6.0)*