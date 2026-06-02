/**
 * AI tools 页面（v0.3）
 *
 * 数据来源：
 * - 工具列表：`src/mcp/external/tools.ts` 里的 `TOOLS` 常量 —— 跟 /api/mcp 接口
 *   同一份 source of truth，所以"动态从本地 MCP 加载"是真实而非硬编码。
 * - 用户 API Key：`prisma.externalApiKey.findMany` —— 跟 /api/settings/external-keys
 *   同一份表。
 *
 * 交互部分（reveal / copy）走两个小 client 组件，主页面是 Server Component
 * 确保首屏就是真实数据。
 */

import type { Metadata } from "next";

export const metadata: Metadata = { title: "AI tools" };

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TOOLS, TOOL_SCOPE } from "@/mcp/external/tools";
import prisma from "@/lib/prisma";
import { ShieldAlert, Wrench, Plug, KeyRound, ScrollText } from "lucide-react";
import { CopyButton } from "./CopyButton";

export const dynamic = "force-dynamic";

// ---- 工具分类 ----
const READ_TOOLS = TOOLS.filter((t) => TOOL_SCOPE[t.name] === "read");
const WRITE_TOOLS = TOOLS.filter((t) => TOOL_SCOPE[t.name] === "write");

// ---- 各客户端配置模板（key 用占位符，实际渲染时替换） ----
const CONFIG_TEMPLATES: Array<{
  client: string;
  config: Record<string, unknown>;
}> = [
  {
    client: "Claude Desktop",
    config: {
      mcpServers: {
        nextpost: {
          url: "http://localhost:3000/api/mcp",
          headers: {
            Authorization: "Bearer __API_KEY__",
            "Content-Type": "application/json",
          },
        },
      },
    },
  },
  {
    client: "Cursor / Cline / Continue",
    config: {
      mcpServers: {
        nextpost: {
          url: "http://localhost:3000/api/mcp",
          headers: { Authorization: "Bearer __API_KEY__" },
        },
      },
    },
  },
  {
    client: "Cherry Studio",
    config: {
      name: "NextPost",
      url: "http://localhost:3000/api/mcp",
      headers: {
        Authorization: "Bearer __API_KEY__",
        "Content-Type": "application/json",
      },
    },
  },
  {
    client: "VS Code (.vscode/mcp.json)",
    config: {
      servers: {
        nextpost: {
          url: "http://localhost:3000/api/mcp",
          headers: { Authorization: "Bearer __API_KEY__" },
        },
      },
    },
  },
];

export default async function AIToolsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  // 拉当前用户的 API Keys（脱敏预览 + 必要元数据）
  // 注意：完整 key 仅在服务端内存中存在，前端只看到 preview；reveal 由 client 组件单独请求
  const rawKeys = await prisma.externalApiKey.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      permissions: true,
      key: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
  });
  // 服务端脱敏：只把前 12 位 preview 发到前端
  const keys = rawKeys.map((k) => ({
    id: k.id,
    name: k.name,
    permissions: k.permissions,
    keyPreview: k.key.substring(0, 12) + "...",
    lastUsedAt: k.lastUsedAt,
    expiresAt: k.expiresAt,
    createdAt: k.createdAt,
  }));

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-20">
      {/* ============ Hero ============ */}
      <header>
        <div className="flex items-center gap-3 mb-2">
          <Wrench size={28} className="text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">AI tools</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
          NextPost 通过 <a href="https://modelcontextprotocol.io" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">MCP (Model Context Protocol)</a>
          {" "}对外暴露 {TOOLS.length} 个工具，让外部 AI（Claude Desktop / Cursor / Cherry Studio 等）可以直接
          读取你的账号、创建/更新发布计划。下方内容<strong>实时</strong>从本地 MCP 源加载，不是硬编码。
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
            MCP v0.3
          </span>
          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded">
            工具数：{TOOLS.length}
          </span>
          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded">
            读取：{READ_TOOLS.length}
          </span>
          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded">
            写入：{WRITE_TOOLS.length}
          </span>
        </div>
      </header>

      {/* ============ 1. MCP 配置 ============ */}
      <section>
        <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white mb-4">
          <Plug size={20} className="text-blue-600" />
          1. MCP 配置
        </h2>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-6">
          {/* 端点 */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">MCP 端点</h3>
            <code className="block bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-4 py-2 rounded-lg font-mono text-sm">
              POST http://localhost:3000/api/mcp
            </code>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              启动 <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">pnpm dev</code> 后即可用。
              通信走标准 JSON-RPC 2.0，认证用 <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">Authorization: Bearer &lt;API Key&gt;</code>。
            </p>
          </div>

          {/* 你的 Keys —— 仅展示状态 + 跳转设置（不在此页做 Key 管理） */}
          <div className="flex items-center justify-between gap-3 bg-gray-50 dark:bg-gray-900 rounded-lg px-4 py-3" data-testid="apikey-summary">
            <div className="flex items-center gap-2 min-w-0">
              <KeyRound size={16} className="text-gray-500 shrink-0" />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                你当前有 <strong data-testid="apikey-count">{keys.length}</strong> 个 API Key
              </span>
            </div>
            <a
              href="/settings"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline shrink-0"
              data-testid="goto-settings-link"
            >
              去设置管理 →
            </a>
          </div>

          {/* 客户端配置示例 */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              客户端配置示例
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              把 <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">__API_KEY__</code> 替换成上面
              reveal 出的完整 key（以 <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">npk_</code> 开头）。
            </p>
            <div className="space-y-3">
              {CONFIG_TEMPLATES.map((t) => (
                <details
                  key={t.client}
                  className="group border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <summary className="cursor-pointer px-4 py-2.5 bg-gray-50 dark:bg-gray-900 text-sm font-medium text-gray-800 dark:text-gray-200 flex items-center justify-between">
                    <span>{t.client}</span>
                    <span className="text-gray-400 group-open:rotate-90 transition-transform">▶</span>
                  </summary>
                  <div className="relative">
                    <pre className="bg-gray-900 text-gray-100 text-xs p-4 rounded-b-lg overflow-x-auto">
                      <code>{JSON.stringify(t.config, null, 2)}</code>
                    </pre>
                    <div className="absolute top-2 right-2">
                      <CopyButton
                        text={JSON.stringify(t.config, null, 2).replace(/__API_KEY__/g, "<YOUR_KEY>")}
                        label="复制配置"
                      />
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </div>

          {/* Scope 表 */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              权限范围（Scope）
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="py-2 pr-4 font-medium">scope</th>
                    <th className="py-2 pr-4 font-medium">读取工具</th>
                    <th className="py-2 pr-4 font-medium">写工具</th>
                    <th className="py-2 font-medium">典型用途</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 dark:text-gray-300">
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 pr-4"><code className="text-xs">read</code></td>
                    <td className="py-2 pr-4">✅</td>
                    <td className="py-2 pr-4">❌</td>
                    <td className="py-2">监控类、只读面板</td>
                  </tr>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 pr-4"><code className="text-xs">write</code></td>
                    <td className="py-2 pr-4">❌</td>
                    <td className="py-2 pr-4">✅</td>
                    <td className="py-2">纯写自动化（少见）</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4"><code className="text-xs">read_write</code></td>
                    <td className="py-2 pr-4">✅</td>
                    <td className="py-2 pr-4">✅</td>
                    <td className="py-2"><strong>通用 AI Agent（推荐）</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 2. MCP 工具（动态） ============ */}
      <section>
        <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white mb-4">
          <ScrollText size={20} className="text-blue-600" />
          2. MCP 工具（{TOOLS.length} 个，实时从 <code className="text-base">src/mcp/external/tools.ts</code> 加载）
        </h2>

        {/* 读取工具 */}
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 mt-6">
          读取工具（{READ_TOOLS.length}）
        </h3>
        <div className="space-y-3">
          {READ_TOOLS.map((tool) => (
            <ToolCard key={tool.name} tool={tool} />
          ))}
        </div>

        {/* 写入工具 */}
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 mt-8">
          写入工具（{WRITE_TOOLS.length}，需 write / read_write scope）
        </h3>
        <div className="space-y-3">
          {WRITE_TOOLS.map((tool) => (
            <ToolCard key={tool.name} tool={tool} />
          ))}
        </div>
      </section>

      {/* ============ 3. 安全约束 ============ */}
      <section>
        <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white mb-4">
          <ShieldAlert size={20} className="text-orange-500" />
          3. 写工具安全约束
        </h2>
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-6 space-y-4 text-sm text-gray-800 dark:text-gray-200">
          <div>
            <strong className="text-orange-700 dark:text-orange-300">不提供 delete</strong>：
            外部 MCP 没有任何删除工具。所有删除必须走 Web UI（v0.3 软删除 → 回收站 → 永久删除）。
          </div>
          <div>
            <strong className="text-orange-700 dark:text-orange-300">update_post 字段白名单</strong>：
            服务端只接受 <code className="bg-white dark:bg-gray-800 px-1 rounded text-xs">scheduledTime</code> 和{" "}
            <code className="bg-white dark:bg-gray-800 px-1 rounded text-xs">timezone</code>。
            其它字段（content / mediaUrls / accountId / status）<strong>静默忽略</strong>，不写库。
          </div>
          <div>
            <strong className="text-orange-700 dark:text-orange-300">update_post 状态锁</strong>：
            只有 <code className="bg-white dark:bg-gray-800 px-1 rounded text-xs">draft</code> /{" "}
            <code className="bg-white dark:bg-gray-800 px-1 rounded text-xs">scheduled</code> 状态的帖子可改。
            publishing / published / failed 全部锁死（避免与第三方发布竞态）。
          </div>
          <div>
            <strong className="text-orange-700 dark:text-orange-300">upload_media_from_url 限制</strong>：
            仅允许 <code className="bg-white dark:bg-gray-800 px-1 rounded text-xs">http://</code> /{" "}
            <code className="bg-white dark:bg-gray-800 px-1 rounded text-xs">https://</code>，文件大小 ≤ 10MB，
            仅支持 6 种图片/视频 mime。
          </div>
        </div>
      </section>
    </div>
  );
}

// ===== 工具卡片（Server Component） =====
function ToolCard({ tool }: { tool: (typeof TOOLS)[number] }) {
  const required = TOOL_SCOPE[tool.name];
  return (
    <details
      className="group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
      data-testid={`tool-card-${tool.name}`}
    >
      <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-base font-mono font-semibold text-gray-900 dark:text-white">
              {tool.name}
            </code>
            <span
              className={`text-xs px-1.5 py-0.5 rounded ${
                required === "write"
                  ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
                  : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
              }`}
            >
              {required}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
            {tool.description}
          </p>
        </div>
        <span className="text-gray-400 group-open:rotate-90 transition-transform shrink-0">▶</span>
      </summary>
      <div className="border-t border-gray-200 dark:border-gray-700 px-5 py-4 space-y-3">
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">说明</div>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
            {tool.description}
          </p>
        </div>
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">inputSchema</div>
          <pre className="bg-gray-900 text-gray-100 text-xs p-3 rounded overflow-x-auto">
            <code>{JSON.stringify(tool.inputSchema, null, 2)}</code>
          </pre>
        </div>
      </div>
    </details>
  );
}
