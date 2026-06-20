# NextPost 版本升级方案

> **文档版本**：v1.0  
> **创建日期**：2026-06-17  
> **最后更新**：2026-06-17

---

## 概述

本文档描述 NextPost 作为可分发软件产品的版本管理和升级机制。

### 设计决策

| 选项 | 选择 | 说明 |
|------|------|------|
| 升级策略 | **强制迁移** | 大版本必须升级，否则系统不可用 |
| 多租户隔离 | **共享数据库** | 通过 userId 隔离数据 |
| 失败回滚 | **不支持自动回滚** | 依赖备份 + 手动恢复 |

### 版本来源

版本号统一从 `package.json` 的 `version` 字段读取：

```typescript
// src/lib/version.ts
import packageJson from '../../package.json';
export const APP_VERSION: string = packageJson.version;
```

升级版本时，**只需要修改 `package.json` 的 `version` 字段**。

---

## 数据库设计

### 系统版本表 `_system_version`

```sql
CREATE TABLE "_system_version" (
  id TEXT PRIMARY KEY DEFAULT 'system',
  version TEXT NOT NULL,
  last_check_at DATETIME,
  last_check_version TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 升级日志表 `_system_upgrade_log`

```sql
CREATE TABLE "_system_upgrade_log" (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  from_version TEXT NOT NULL,
  to_version TEXT NOT NULL,
  migrated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'completed',
  error_message TEXT
);
```

---

## 迁移版本映射

### 版本迁移关系

```typescript
// src/lib/version-migrations.ts

export const VERSION_MIGRATIONS: Record<string, string[]> = {
  // v0.6.0: 初始版本
  '0.6.0': [
    '202606170000_add_system_tables',
  ],
  
  // v1.0.0: 第一个正式版本
  '1.0.0': [
    '202607010000_add_xxx_feature',
  ],
};

export const MIGRATION_DESCRIPTIONS: Record<string, string> = {
  '202606170000_add_system_tables': '添加系统版本和升级日志表',
  '202607010000_add_xxx_feature': '新增 XXX 功能',
};
```

---

## 迁移执行器

### 核心实现

```typescript
// src/lib/migrator.ts

import { prisma } from './prisma';
import packageJson from '../../package.json';

// 从 package.json 读取当前版本
const CURRENT_VERSION = packageJson.version;

/**
 * 版本比较
 */
export function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  
  for (let i = 0; i < 3; i++) {
    if (partsA[i] < partsB[i]) return -1;
    if (partsA[i] > partsB[i]) return 1;
  }
  return 0;
}

/**
 * 获取当前系统版本
 */
export async function getCurrentVersion(): Promise<string> {
  try {
    const result = await prisma.$queryRaw<Array<{ version: string }>>`
      SELECT version FROM "_system_version" WHERE id = 'system'
    `;
    return result?.[0]?.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * 确保系统表存在
 */
export async function ensureSystemTables(): Promise<void> {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "_system_version" (
      id TEXT PRIMARY KEY DEFAULT 'system',
      version TEXT NOT NULL,
      last_check_at DATETIME,
      last_check_version TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;
  
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "_system_upgrade_log" (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      from_version TEXT NOT NULL,
      to_version TEXT NOT NULL,
      migrated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'completed',
      error_message TEXT
    )
  `;
}

/**
 * 执行升级
 */
export async function runUpgrade(targetVersion: string = CURRENT_VERSION): Promise<{
  success: boolean;
  fromVersion: string;
  toVersion: string;
  message: string;
}> {
  const fromVersion = await getCurrentVersion();
  
  if (compareVersions(fromVersion, targetVersion) >= 0) {
    return { success: true, fromVersion, toVersion: targetVersion, message: 'Already at latest version' };
  }
  
  await ensureSystemTables();
  
  // 执行迁移（共享数据库，所有用户数据保留）
  // ... 执行具体迁移 ...
  
  // 更新版本
  await prisma.$executeRaw`
    UPDATE "_system_version" SET version = ${targetVersion}, updated_at = CURRENT_TIMESTAMP WHERE id = 'system'
  `;
  
  // 记录日志
  await prisma.$executeRaw`
    INSERT INTO "_system_upgrade_log" (from_version, to_version, status) VALUES (${fromVersion}, ${targetVersion}, 'completed')
  `;
  
  return { success: true, fromVersion, toVersion: targetVersion, message: 'Upgrade completed' };
}
```

---

## API 接口

### 1. 获取版本信息

```typescript
// src/app/api/admin/version/route.ts
import { NextResponse } from 'next/server';
import { getCurrentVersion, ensureSystemTables } from '@/lib/migrator';
import { prisma } from '@/lib/prisma';
import packageJson from '../../package.json';

export async function GET() {
  try {
    await ensureSystemTables();
    const currentVersion = await getCurrentVersion();
    const latestVersion = packageJson.version;
    
    const logs = await prisma.$queryRaw<Array<any>>`
      SELECT from_version, to_version, status, migrated_at 
      FROM "_system_upgrade_log" 
      ORDER BY migrated_at DESC 
      LIMIT 5
    `;
    
    return NextResponse.json({
      currentVersion,
      latestVersion,
      needsUpgrade: compareVersions(currentVersion, latestVersion) < 0,
      upgradeLogs: logs,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get version' }, { status: 500 });
  }
}
```

### 2. 执行升级

```typescript
// src/app/api/admin/upgrade/route.ts
import { NextResponse } from 'next/server';
import { runUpgrade, ensureSystemTables } from '@/lib/migrator';

export async function POST() {
  try {
    await ensureSystemTables();
    const result = await runUpgrade();
    
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: 'Upgrade failed',
      recovery: '请从备份恢复数据库'
    }, { status: 500 });
  }
}
```

---

## 发布流程

### 版本标签规范

```bash
# 发布补丁版本
git tag v1.0.1
git push origin v1.0.1

# 发布小版本
git tag v1.1.0
git push origin v1.1.0

# 发布大版本
git tag v2.0.0
git push origin v2.0.0
```

### GitHub Actions 自动发布

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Create Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ github.ref_name }}
```

---

## 升级注意事项

### 共享数据库升级

由于采用共享数据库方案，升级时：

1. **所有用户数据不受影响** - 迁移只修改系统表
2. **原子性** - 迁移要么全部成功，要么全部回滚
3. **向后兼容** - 新字段有默认值，不影响旧代码

### 迁移编写原则

```typescript
// ✅ 正确的迁移
ALTER TABLE "Post" ADD COLUMN "new_field" TEXT DEFAULT '';
CREATE TABLE IF NOT EXISTS "_system_version" (...);

// ❌ 错误的迁移（会丢失数据）
DROP TABLE "Post";  // 禁止删除用户数据表
ALTER TABLE "Post" DROP COLUMN "content";  // 禁止删除必要字段
```

---

**文档结束**
