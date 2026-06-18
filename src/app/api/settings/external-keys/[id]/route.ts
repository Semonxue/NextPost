/**
 * 外部 API Key 单个操作接口
 *
 * DELETE /api/settings/external-keys/:id - 删除指定 Key
 * PATCH  /api/settings/external-keys/:id - 修改 name（scope 不可改）
 *
 * 【v0.4 安全设计】scope 在创建后不可修改。原因：
 *   1. 防手抖 / 防钓鱼：UI 已经不允许改，但 API 直接调也能改就是漏洞
 *   2. 审计干净：要改权限必须删了重建，DB 里有完整的"创建"事件
 *   3. 一致性：UI / API 行为统一
 * 如需升级权限（只读 → 读写），请用户删除后重新创建。
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { deleteApiKey } from '@/mcp/external/auth';
import { getDb, externalApiKey } from '@/lib/db';

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

  try {
    const result = await deleteApiKey(session.user.id, id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting API Key:', error);
    return NextResponse.json({ error: 'Failed to delete API Key' }, { status: 500 });
  }
}

// PATCH 修改 name（scope 不可改）
// Body: { name?: string }
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
    body = (await request.json()) as { name?: unknown; scope?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // 【v0.4 安全】scope 字段不接受。即使传了也直接 400 拒绝。
  if (body.scope !== undefined) {
    return NextResponse.json(
      {
        error: "scope is immutable after creation. Delete the key and create a new one if you need different permissions.",
        errorCode: 'SCOPE_IMMUTABLE',
      },
      { status: 400 }
    );
  }

  // 至少要有一个可改字段
  if (body.name === undefined) {
    return NextResponse.json(
      { error: 'No updatable fields provided (only "name" is supported via PATCH)' },
      { status: 400 }
    );
  }

  if (typeof body.name !== 'string' || body.name.trim() === '') {
    return NextResponse.json({ error: 'name must be a non-empty string' }, { status: 400 });
  }
  const data: { name: string } = { name: body.name.trim() };

  try {
    const db = await getDb();
    // 验证归属：只能改自己的 key
    const existing = db.select().from(externalApiKey)
      .where(and(eq(externalApiKey.id, id), eq(externalApiKey.userId, session.user.id)))
      .get();
    if (!existing) {
      return NextResponse.json({ error: 'Key not found' }, { status: 404 });
    }

    db.update(externalApiKey).set(data).where(eq(externalApiKey.id, id)).run();

    const updated = db.select().from(externalApiKey)
      .where(eq(externalApiKey.id, id))
      .get();

    return NextResponse.json({
      success: true,
      key: {
        id: updated!.id,
        name: updated!.name,
        permissions: updated!.permissions,
        lastUsedAt: updated!.lastUsedAt || null,
        expiresAt: updated!.expiresAt || null,
        createdAt: updated!.createdAt,
      },
    });
  } catch (error) {
    console.error('Error updating API Key:', error);
    return NextResponse.json({ error: 'Failed to update API Key' }, { status: 500 });
  }
}
