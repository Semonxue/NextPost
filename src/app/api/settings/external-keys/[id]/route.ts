/**
 * 外部 API Key 单个操作接口
 *
 * DELETE /api/settings/external-keys/:id - 删除指定 Key
 * PATCH  /api/settings/external-keys/:id - 修改 name / scope
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { deleteApiKey, parseScope } from '@/mcp/external/auth';
import type { Scope } from '@/mcp/external/types';
import prisma from '@/lib/prisma';

type RouteParams = { params: Promise<{ id: string }> };

// DELETE 删除指定 Key
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Key ID is required' }, { status: 400 });
  }

  const result = await deleteApiKey(session.user.id, id);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

// PATCH 修改 name / scope
// Body: { name?: string, scope?: 'read' | 'write' | 'read_write' }
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Key ID is required' }, { status: 400 });
  }

  let body: { name?: unknown; scope?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // 至少要有一个可改字段
  if (body.name === undefined && body.scope === undefined) {
    return NextResponse.json(
      { error: 'No updatable fields provided (name / scope)' },
      { status: 400 }
    );
  }

  const data: { name?: string; permissions?: Scope } = {};

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim() === '') {
      return NextResponse.json({ error: 'name must be a non-empty string' }, { status: 400 });
    }
    data.name = body.name.trim();
  }

  if (body.scope !== undefined) {
    if (typeof body.scope !== 'string') {
      return NextResponse.json({ error: 'scope must be a string' }, { status: 400 });
    }
    // parseScope 内部会做白名单 + 安全降级；这里再做一次显式白名单以便对错误值返回 400
    const allowed = ['read', 'write', 'read_write', 'read_report'];
    if (!allowed.includes(body.scope)) {
      return NextResponse.json(
        { error: `scope must be one of: ${allowed.join(', ')}` },
        { status: 400 }
      );
    }
    data.permissions = parseScope(body.scope);
  }

  try {
    // 验证归属：只能改自己的 key
    const existing = await prisma.externalApiKey.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Key not found' }, { status: 404 });
    }

    const updated = await prisma.externalApiKey.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        permissions: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      key: {
        id: updated.id,
        name: updated.name,
        permissions: updated.permissions,
        lastUsedAt: updated.lastUsedAt?.toISOString() ?? null,
        expiresAt: updated.expiresAt?.toISOString() ?? null,
        createdAt: updated.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error updating API Key:', error);
    return NextResponse.json({ error: 'Failed to update API Key' }, { status: 500 });
  }
}