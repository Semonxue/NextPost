// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { eq, and, isNull, or, like, inArray, desc, asc, count } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb, post, account, platform } from "@/lib/db";

async function attachAccountAndPlatform(db, postRows) {
  if (postRows.length === 0) return [];
  const accountIds = [...new Set(postRows.map(p => p.accountId))];
  const accounts = db.select().from(account).where(inArray(account.id, accountIds)).all();
  const platformIds = [...new Set(accounts.map(a => a.platformId))];
  const platforms = db.select().from(platform).where(inArray(platform.id, platformIds)).all();
  const accMap = new Map(accounts.map(a => [a.id, a]));
  const platMap = new Map(platforms.map(p => [p.id, p]));
  return postRows.map(p => {
    const acc = accMap.get(p.accountId);
    return { ...p, account: acc ? { ...acc, platform: platMap.get(acc.platformId) || null } : null };
  });
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "未授权" }, { status: 401 });
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const accountId = searchParams.get("accountId");
    const platformId = searchParams.get("platformId");
    const search = searchParams.get("search");
    const sort = searchParams.get("sort") || "createdAt";
    const order = searchParams.get("order") || "desc";
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const conditions = [eq(post.userId, session.user.id), isNull(post.deletedAt)];
    if (status) conditions.push(eq(post.status, status));
    if (search) conditions.push(or(like(post.content, '%' + search + '%'), like(post.title, '%' + search + '%')));
    if (accountId) conditions.push(eq(post.accountId, accountId));
    if (platformId) {
      const platformAccounts = db.select({ id: account.id }).from(account).where(eq(account.platformId, platformId)).all();
      if (platformAccounts.length > 0) conditions.push(inArray(post.accountId, platformAccounts.map(a => a.id)));
    }

    const sortCol = sort === "scheduledTime" ? post.scheduledTime : sort === "status" ? post.status : post.createdAt;
    const orderFn = order === "asc" ? asc : desc;

    const rows = await db.select().from(post).where(and(...conditions)).orderBy(orderFn(sortCol)).limit(limit).offset(offset).all();
    const total = db.select({ count: count() }).from(post).where(and(...conditions)).get();
    const posts = await attachAccountAndPlatform(db, rows);

    return NextResponse.json({ posts, total: total?.count ?? 0 });
  } catch (error) {
    console.error("获取帖子失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "未授权" }, { status: 401 });
    const { content, title, mediaUrls, mediaThumbnails, scheduledTime, timezone, status, accountId } = await request.json();
    if (!content) return NextResponse.json({ error: "内容不能为空" }, { status: 400 });
    if (!accountId) return NextResponse.json({ error: "请选择账号" }, { status: 400 });
    const db = getDb();
    const result = await db.insert(post).values({
      userId: session.user.id,
      accountId,
      content,
      title: title || null,
      mediaUrls: JSON.stringify(mediaUrls || []),
      mediaThumbnails: JSON.stringify(mediaThumbnails || []),
      scheduledTime: scheduledTime || null,
      timezone: timezone || "Asia/Shanghai",
      status: status || "draft",
    }).returning().get();
    const rows = await db.select().from(post).leftJoin(account, eq(post.accountId, account.id)).leftJoin(platform, eq(account.platformId, platform.id)).where(eq(post.id, result.id)).all();
    const p = rows[0];
    return NextResponse.json(p ? { ...p.post, account: p.account ? { ...p.account, platform: p.platform } : null } : result, { status: 201 });
  } catch (error) {
    console.error("创建帖子失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
