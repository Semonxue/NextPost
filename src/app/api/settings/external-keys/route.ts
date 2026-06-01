/**
 * 外部 API Key 管理接口
 * 
 * GET  /api/settings/external-keys     - 获取 Key 列表
 * POST /api/settings/external-keys    - 创建新的 Key
 * POST /api/settings/external-keys/reveal - 查看完整 Key（需要验证）
 * DELETE /api/settings/external-keys/:id - 删除 Key
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { generateApiKey, deleteApiKey, listApiKeys } from '@/mcp/external/auth';
import prisma from '@/lib/prisma';

// GET 获取 Key 列表
export async function GET(request: NextRequest) {
  const session = await auth();
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const result = await listApiKeys(session.user.id);
  
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  
  return NextResponse.json({
    keys: result.keys
  });
}

// POST 创建新的 Key
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, expiresAt, scope } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // 校验 scope（不合法值由 generateApiKey 内部降级为 read，这里只在传了且非 string 时报错）
    if (scope !== undefined && typeof scope !== 'string') {
      return NextResponse.json(
        { error: 'scope must be a string' },
        { status: 400 }
      );
    }

    const expiresAtDate = expiresAt ? new Date(expiresAt) : undefined;
    const result = await generateApiKey(
      session.user.id,
      name,
      expiresAtDate,
      typeof scope === 'string' ? scope : undefined
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      key: result.key,
      name,
      scope: result.scope, // 返回实际写入的 scope（前端可显示）
      message: 'API Key created successfully. Please save it securely - it will not be shown again.'
    });
  } catch (error) {
    console.error('Error creating API Key:', error);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

// DELETE 删除 Key
export async function DELETE(request: NextRequest) {
  const session = await auth();
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // 从 URL 获取 ID
  const { searchParams } = new URL(request.url);
  const keyId = searchParams.get('id');
  
  if (!keyId) {
    return NextResponse.json({ error: 'Key ID is required' }, { status: 400 });
  }
  
  const result = await deleteApiKey(session.user.id, keyId);
  
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  
  return NextResponse.json({ success: true });
}

// GET /api/settings/external-keys/reveal?id=xxx - 获取完整 Key（需要再次认证）
export async function REVEAL(request: NextRequest) {
  const session = await auth();
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const { searchParams } = new URL(request.url);
  const keyId = searchParams.get('id');
  
  if (!keyId) {
    return NextResponse.json({ error: 'Key ID is required' }, { status: 400 });
  }
  
  try {
    const apiKey = await prisma.externalApiKey.findFirst({
      where: {
        id: keyId,
        userId: session.user.id
      }
    });
    
    if (!apiKey) {
      return NextResponse.json({ error: 'Key not found' }, { status: 404 });
    }
    
    return NextResponse.json({
      key: apiKey.key,
      name: apiKey.name
    });
  } catch (error) {
    console.error('Error revealing API Key:', error);
    return NextResponse.json({ error: 'Failed to reveal key' }, { status: 500 });
  }
}
