#!/usr/bin/env python3
"""
从 Prisma dev.db.backup 迁移数据到 Drizzle data/nextpost.db

仅迁移：User, Account, Post, Platform, PlatformConfig
- title 字段在 Prisma 里不存在，写 NULL
- 跳过已有的数据（按 id 去重）
"""
import sqlite3, sys

SRC = "/Users/semonxue/Workplace/Works/ai-dev/nextPost/prisma/prisma/dev.db.backup-20260604-183707"
DST = "/Users/semonxue/Workplace/Works/ai-dev/nextpost/data/nextpost.db"

def unix_to_iso(val):
    """Convert Unix ms timestamp (10-15 digit) to ISO string, return None for empty/invalid."""
    if val is None or val == '' or val == 'null':
        return None
    s = str(val).strip()
    if not s.isdigit():
        return val  # already not a timestamp
    if len(s) == 10:  # seconds
        ms = int(s) * 1000
    elif len(s) >= 13:  # milliseconds (13-15 digits)
        ms = int(s)
    else:
        return val  # weird length, return as-is
    from datetime import datetime, timezone
    dt = datetime.fromtimestamp(ms / 1000, tz=timezone.utc)
    return dt.isoformat()

TIME_FIELDS = {"scheduledTime", "publishedAt", "createdAt", "updatedAt", "deletedAt", "publishTokenExp"}

def migrate_table(src_conn, dst_conn, table, columns, extra_defaults=None):
    extra = extra_defaults or {}
    src_cols = ", ".join(columns)
    dst_cols = ", ".join(columns + list(extra.keys()))
    placeholders = ", ".join(["?"] * (len(columns) + len(extra)))
    q = f"INSERT OR IGNORE INTO {table} ({dst_cols}) VALUES ({placeholders})"

    src_cur = src_conn.cursor()
    src_cur.execute(f"SELECT {src_cols} FROM {table}")
    rows = src_cur.fetchall()
    inserted = 0
    for row in rows:
        try:
            # Convert timestamp fields
            converted = []
            for i, col in enumerate(columns):
                if col in TIME_FIELDS:
                    converted.append(unix_to_iso(row[i]))
                else:
                    converted.append(row[i])
            dst_conn.execute(q, tuple(converted) + tuple(extra.values()))
            inserted += 1
        except Exception as e:
            pass  # skip bad rows silently
    dst_conn.commit()
    print(f"  {table}: {inserted}/{len(rows)} inserted")
    return inserted

def main():
    src = sqlite3.connect(SRC)
    dst = sqlite3.connect(DST)

    print(f"Source: {SRC}")
    print(f"Dest:   {DST}")
    print()

    # Platform — 先迁平台，Account 依赖 platformId
    migrate_table(src, dst, "Platform", [
        "id","name","icon","createdAt"
    ])

    # User
    migrate_table(src, dst, "User", [
        "id","username","password","email",
        "aiProvider","aiApiKey","aiModel",
        "createdAt","updatedAt"
    ])

    # Account
    migrate_table(src, dst, "Account", [
        "id","userId","platformId","name","handle","description",
        "deletedAt","deletedBy","deleteNote","createdAt","updatedAt"
    ])

    # PlatformConfig
    try:
        migrate_table(src, dst, "PlatformConfig", [
            "id","platformId","maxContentLength","maxImages","maxVideos","allowMixedMedia",
            "createdAt","updatedAt"
        ])
    except Exception as e:
        print(f"  PlatformConfig: skipped ({e})")

    # Post — title 在 Prisma 不存在，写 NULL
    migrate_table(src, dst, "Post", [
        "id","userId","accountId","content","mediaUrls","mediaThumbnails",
        "scheduledTime","timezone","status",
        "publishToken","publishTokenExp","publishedAt",
        "externalPostId","externalPostUrl","publishError","publishAttempts",
        "deletedAt","deletedBy","deleteNote","createdAt","updatedAt"
    ], extra_defaults={"title": None})

    # 统计
    print()
    print("=== 迁移后统计 ===")
    for table in ["User","Account","Post","Platform"]:
        try:
            c = dst.cursor()
            c.execute(f"SELECT COUNT(*) FROM {table}")
            print(f"  {table}: {c.fetchone()[0]}")
        except:
            pass

    src.close()
    dst.close()
    print("\nDone.")

if __name__ == "__main__":
    main()
