/**
 * 外部 MCP Server 主入口
 * 
 * 基于 @modelcontextprotocol/sdk 实现
 * 支持外部 AI 客户端通过 HTTP 调用
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema,
  Tool,
  CallToolRequest,
  JsonRpcRequest
} from '@modelcontextprotocol/sdk/types.js';
import { TOOLS } from './tools.js';
import { executeTool } from './tools.js';
import { validateApiKey } from './auth.js';

// 服务器配置
const SERVER_NAME = 'nextpost-external';
const SERVER_VERSION = '0.1.0';
const PORT = parseInt(process.env.MCP_PORT || '3100');

// 创建服务器实例
const server = new Server(
  {
    name: SERVER_NAME,
    version: SERVER_VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 存储当前用户 ID（通过认证获取）
let currentUserId: string | null = null;
let currentKeyId: string | null = null;

/**
 * 初始化服务器
 */
async function initializeServer() {
  // 注册工具列表处理器
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: TOOLS as Tool[]
    };
  });

  // 注册工具调用处理器
  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
    const { name, arguments: args } = request.params;

    if (!currentUserId) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ 
            error: 'Unauthorized',
            code: 'NOT_AUTHENTICATED'
          }, null, 2)
        }]
      };
    }

    return executeTool(name, args || {}, currentUserId);
  });
}

/**
 * 从请求头获取 API Key
 */
function getApiKeyFromHeaders(req: any): string | null {
  const auth = req.headers?.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    return auth.substring(7);
  }
  return null;
}

/**
 * 处理 MCP 请求
 */
async function handleMcpRequest(body: any, req: any): Promise<any> {
  const { method, id, params } = body;

  try {
    // 如果还没有认证，尝试从 header 获取 API Key
    if (!currentUserId) {
      const apiKey = getApiKeyFromHeaders(req);
      if (apiKey) {
        const validation = await validateApiKey(apiKey);
        if (validation.valid) {
          currentUserId = validation.userId!;
          currentKeyId = validation.keyId!;
          console.error(`[NextPost External MCP] Authenticated for user: ${currentUserId}`);
        }
      }
    }

    switch (method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: {
              name: SERVER_NAME,
              version: SERVER_VERSION
            }
          }
        };

      case 'tools/list':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            tools: TOOLS.map(t => ({
              name: t.name,
              description: t.description,
              inputSchema: t.inputSchema
            }))
          }
        };

      case 'tools/call':
        if (!currentUserId) {
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: 'Not authenticated. Please provide API key via Authorization header.'
            }
          };
        }

        const { name, arguments: args } = params;
        const result = await executeTool(name, args || {}, currentUserId);
        return {
          jsonrpc: '2.0',
          id,
          result
        };

      default:
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`
          }
        };
    }
  } catch (error: any) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: error.message || 'Internal error'
      }
    };
  }
}

/**
 * 启动 HTTP 服务器
 */
async function startHttpServer() {
  const http = await import('http');

  const serverInstance = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method !== 'POST') {
      res.writeHead(405);
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const request = JSON.parse(body);
        const response = await handleMcpRequest(request, req);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch (error: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          jsonrpc: '2.0',
          error: { code: -32700, message: error.message }
        }));
      }
    });
  });

  return new Promise<void>((resolve) => {
    serverInstance.listen(PORT, () => {
      console.error(`[NextPost External MCP] HTTP Server listening on port ${PORT}`);
      console.error(`[NextPost External MCP] Endpoint: http://localhost:${PORT}/mcp`);
      console.error(`[NextPost External MCP] Available tools: ${TOOLS.map(t => t.name).join(', ')}`);
    });
  });
}

/**
 * 启动服务器
 */
async function startServer() {
  // 从环境变量获取 API Key（可选，如果设置则启动时验证）
  const apiKey = process.env.MCP_API_KEY;

  if (apiKey) {
    // 验证 API Key
    const validation = await validateApiKey(apiKey);

    if (!validation.valid) {
      console.error(`ERROR: ${validation.error}`);
      console.error(`Code: ${validation.errorCode}`);
      process.exit(1);
    }

    currentUserId = validation.userId!;
    currentKeyId = validation.keyId!;

    console.error(`[NextPost External MCP] Authenticated for user: ${currentUserId}`);
  } else {
    console.error('[NextPost External MCP] No MCP_API_KEY set, using per-request authentication');
  }

  // 初始化服务器
  await initializeServer();

  // 启动 HTTP 服务器
  await startHttpServer();
}

// 启动
startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

export { server, startServer };
