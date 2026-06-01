/**
 * NextPost MCP HTTP 端点
 * 
 * 提供与主服务 (3000 端口) 集成的 MCP 接口
 * 支持通过 Authorization header 传递 API Key 进行认证
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/mcp/external/auth';
import { TOOLS, executeTool } from '@/mcp/external/tools';

const SERVER_NAME = 'nextpost-external';
const SERVER_VERSION = '0.1.0';

/**
 * 获取 Authorization header 中的 API Key
 */
function getApiKey(req: NextRequest): string | null {
  const auth = req.headers.get('authorization');
  if (auth && auth.startsWith('Bearer ')) {
    return auth.substring(7);
  }
  return null;
}

/**
 * 处理 MCP 请求
 */
async function handleMcpRequest(body: any, userId: string, scope: 'read' | 'write' | 'read_write') {
  const { method, id, params } = body;

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
      const { name, arguments: args } = params;
      const result = await executeTool(name, args || {}, { userId, scope });
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
}

export async function POST(request: NextRequest) {
  try {
    // 获取 API Key 并验证
    const apiKey = getApiKey(request);
    
    if (!apiKey) {
      return NextResponse.json({
        jsonrpc: '2.0',
        error: {
          code: -32602,
          message: 'API key required. Provide via Authorization: Bearer <key> header.'
        }
      }, { status: 401 });
    }

    const validation = await validateApiKey(apiKey);
    
    if (!validation.valid) {
      return NextResponse.json({
        jsonrpc: '2.0',
        error: {
          code: -32602,
          message: validation.error || 'Invalid API key'
        }
      }, { status: 401 });
    }

    const body = await request.json();
    const response = await handleMcpRequest(body, validation.userId!, validation.scope || 'read');

    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json({
      jsonrpc: '2.0',
      error: {
        code: -32700,
        message: error.message || 'Parse error'
      }
    }, { status: 400 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}
