/**
 * 外部 API Key 完整 Key 查看接口
 * 
 * GET /api/settings/external-keys/reveal?id=xxx - 获取完整 Key（需要已登录）
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
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