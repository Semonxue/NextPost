/**
 * 外部 API Key 单个操作接口
 * 
 * DELETE /api/settings/external-keys/:id - 删除指定 Key
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { deleteApiKey } from '@/mcp/external/auth';

type RouteParams = { params: Promise<{ id: string }> };

// DELETE 删除指定 Key
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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