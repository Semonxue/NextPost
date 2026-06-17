# NextPost 版本升级方案

> **文档版本**：v1.0  
> **创建日期**：2026-06-17  
> **最后更新**：2026-06-17

---

## 概述

本文档描述 NextPost 作为可分发软件产品的版本管理和升级机制，支持：
- 多租户独立部署（每个租户独立数据库）
- 大版本强制升级
- 自动化版本检测与迁移

### 设计决策

| 选项 | 选择 | 说明 |
|------|------|------|
| 升级策略 | **强制迁移** | 大版本必须升级，否则系统不可用 |
| 多租户隔离 | **独立数据库** | 每个租户独立 D1/R2 |
| 失败回滚 | **不支持自动回滚** | 依赖备份 + 手动恢复 |

---

## 版本管理体系

### 版本格式

采用 [SemVer](https://semver.org/lang/zh-CN/) 规范：

```
major.minor.patch
示例：1.0.0

- major: 重大架构变更，不兼容升级（必须升级）
- minor: 新功能，向后兼容
- patch: Bug 修复，向后兼容
```

### 版本文件

在项目根目录创建 `VERSION` 文件：

```
1.0.0
```

### 版本常量定义

```typescript
// src/lib/version.ts
export const CURRENT_VERSION = '1.0.0';
export const MIN_VERSION = '0.5.3';  // 支持从哪个版本直接升级
export const VERSION_REGEX = /^\d+\.\d+\.\d+$/;
```

---

## 数据库设计

### 1. 系统版本表 `_system_version`

```sql
CREATE TABLE "_system_version" (
  id TEXT PRIMARY KEY DEFAULT 'system',
  version TEXT NOT NULL,                    -- 当前版本: "1.0.0"
  last_check_at DATETIME,                   -- 最后检查远程版本时间
  last_check_version TEXT,                  -- 检查到的最新版本
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2. 升级日志表 `_system_upgrade_log`

```sql
CREATE TABLE "_system_upgrade_log" (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  from_version TEXT NOT NULL,              -- 升级前版本
  to_version TEXT NOT NULL,                -- 升级后版本
  migrated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'completed',          -- pending / completed / failed
  error_message TEXT
);
```

### 3. 初始迁移 SQL

创建 `prisma/migrations/202606170000_add_system_tables/migration.sql`：

```sql
-- ============================================
-- System Tables Migration
-- Version: 0.6.0
-- Description: 添加系统版本和升级日志表
-- ============================================

-- 创建系统版本表
CREATE TABLE IF NOT EXISTS "_system_version" (
  id TEXT PRIMARY KEY DEFAULT 'system',
  version TEXT NOT NULL,
  last_check_at DATETIME,
  last_check_version TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建升级日志表
CREATE TABLE IF NOT EXISTS "_system_upgrade_log" (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  from_version TEXT NOT NULL,
  to_version TEXT NOT NULL,
  migrated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'completed',
  error_message TEXT
);

-- 初始化版本记录（如果不存在）
INSERT OR IGNORE INTO "_system_version" (id, version, created_at, updated_at)
VALUES ('system', '0.6.0', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 创建索引
CREATE INDEX IF NOT EXISTS "_system_upgrade_log_from_idx" ON "_system_upgrade_log" (from_version);
CREATE INDEX IF NOT EXISTS "_system_upgrade_log_to_idx" ON "_system_upgrade_log" (to_version);
CREATE INDEX IF NOT EXISTS "_system_upgrade_log_status_idx" ON "_system_upgrade_log" (status);
```

---

## 迁移版本映射

### 版本迁移关系

```typescript
// src/lib/version-migrations.ts

export type MigrationVersion = string;
export type MigrationName = string;

// 版本到迁移文件的映射
// 格式: VERSION_MIGRATIONS[目标版本] = [迁移文件名数组]
export const VERSION_MIGRATIONS: Record<MigrationVersion, MigrationName[]> = {
  // v0.6.0: 初始版本（从 v0.5.x 升级时执行）
  '0.6.0': [
    '202606170000_add_system_tables',
  ],
  
  // v1.0.0: 第一个正式版本
  '1.0.0': [
    '202607010000_add_xxx_feature',
  ],
  
  // v1.1.0: 小版本更新示例
  '1.1.0': [
    '202607150000_add_xxx',
  ],
};

// 迁移文件描述
export const MIGRATION_DESCRIPTIONS: Record<MigrationName, string> = {
  '202606170000_add_system_tables': '添加系统版本和升级日志表',
  '202607010000_add_xxx_feature': '新增 XXX 功能',
  '202607150000_add_xxx': '修复 XXX 问题',
};

// 获取所有迁移文件列表
export function getAllMigrations(): MigrationName[] {
  return Object.values(VERSION_MIGRATIONS).flat();
}
```

---

## 迁移执行器

### 核心实现

```typescript
// src/lib/migrator.ts

import { prisma } from './prisma';
import { 
  VERSION_MIGRATIONS, 
  MIGRATION_DESCRIPTIONS,
  type MigrationName 
} from './version-migrations';
import { CURRENT_VERSION } from './version';

/**
 * 版本比较
 * 返回: -1 (a < b), 0 (相等), 1 (a > b)
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
    // 表不存在，返回初始版本
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
  
  // 确保初始版本记录存在
  const current = await getCurrentVersion();
  if (current === '0.0.0') {
    await prisma.$executeRaw`
      INSERT OR IGNORE INTO "_system_version" (id, version, created_at, updated_at)
      VALUES ('system', '0.5.3', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;
  }
}

/**
 * 获取需要执行的迁移列表
 */
export function collectMigrations(fromVersion: string, toVersion: string): MigrationName[] {
  const result: MigrationName[] = [];
  
  // 遍历所有版本
  for (const [version, migrations] of Object.entries(VERSION_MIGRATIONS)) {
    // 如果目标版本大于等于当前版本且小于等于目标版本
    if (compareVersions(version, fromVersion) > 0 && compareVersions(version, toVersion) <= 0) {
      result.push(...migrations);
    }
  }
  
  return result;
}

/**
 * 记录升级日志
 */
async function logUpgrade(
  fromVersion: string, 
  toVersion: string, 
  status: 'completed' | 'failed',
  errorMessage?: string
): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO "_system_upgrade_log" (from_version, to_version, status, error_message)
    VALUES (${fromVersion}, ${toVersion}, ${status}, ${errorMessage || null})
  `;
}

/**
 * 执行升级
 */
export async function runUpgrade(targetVersion: string = CURRENT_VERSION): Promise<{
  success: boolean;
  fromVersion: string;
  toVersion: string;
  migrationsRun: number;
  message: string;
}> {
  const fromVersion = await getCurrentVersion();
  
  // 如果已经是目标版本
  if (compareVersions(fromVersion, targetVersion) >= 0) {
    return {
      success: true,
      fromVersion,
      toVersion: targetVersion,
      migrationsRun: 0,
      message: `Already at version ${targetVersion}`,
    };
  }
  
  // 确保系统表存在
  await ensureSystemTables();
  
  // 获取需要执行的迁移
  const migrations = collectMigrations(fromVersion, targetVersion);
  
  if (migrations.length === 0) {
    return {
      success: true,
      fromVersion,
      toVersion: targetVersion,
      migrationsRun: 0,
      message: 'No migrations to run',
    };
  }
  
  console.log(`Running ${migrations.length} migrations from ${fromVersion} to ${targetVersion}`);
  
  // 按顺序执行迁移
  for (const migration of migrations) {
    const description = MIGRATION_DESCRIPTIONS[migration] || migration;
    console.log(`  - ${migration}: ${description}`);
    
    try {
      await executeMigration(migration);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await logUpgrade(fromVersion, targetVersion, 'failed', message);
      throw new Error(`Migration ${migration} failed: ${message}`);
    }
  }
  
  // 更新版本记录
  await prisma.$executeRaw`
    UPDATE "_system_version" 
    SET version = ${targetVersion}, updated_at = CURRENT_TIMESTAMP
    WHERE id = 'system'
  `;
  
  // 记录成功日志
  await logUpgrade(fromVersion, targetVersion, 'completed');
  
  return {
    success: true,
    fromVersion,
    toVersion: targetVersion,
    migrationsRun: migrations.length,
    message: `Upgraded from ${fromVersion} to ${targetVersion}`,
  };
}

/**
 * 执行单个迁移文件
 * 注意：D1 不支持直接读取 SQL 文件，需要在代码中执行 SQL
 */
async function executeMigration(migrationName: string): Promise<void> {
  // 从迁移映射中获取对应的 SQL
  const migrationSQL = getMigrationSQL(migrationName);
  
  if (!migrationSQL) {
    throw new Error(`Migration SQL not found for: ${migrationName}`);
  }
  
  // 分割 SQL 语句并逐条执行
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }
}

/**
 * 获取迁移 SQL（硬编码或动态加载）
 */
function getMigrationSQL(migrationName: string): string | null {
  const migrations: Record<MigrationName, string> = {
    '202606170000_add_system_tables': `
      CREATE TABLE IF NOT EXISTS "_system_version" (
        id TEXT PRIMARY KEY DEFAULT 'system',
        version TEXT NOT NULL,
        last_check_at DATETIME,
        last_check_version TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS "_system_upgrade_log" (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        from_version TEXT NOT NULL,
        to_version TEXT NOT NULL,
        migrated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'completed',
        error_message TEXT
      );
      
      INSERT OR IGNORE INTO "_system_version" (id, version, created_at, updated_at)
      VALUES ('system', '0.6.0', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    `,
    
    // 未来添加更多迁移...
  };
  
  return migrations[migrationName] || null;
}

/**
 * 获取升级日志
 */
export async function getUpgradeLogs(limit: number = 10): Promise<Array<{
  fromVersion: string;
  toVersion: string;
  status: string;
  migratedAt: Date;
  errorMessage?: string;
}>> {
  const results = await prisma.$queryRaw<Array<{
    from_version: string;
    to_version: string;
    status: string;
    migrated_at: Date;
    error_message: string | null;
  }>>`
    SELECT from_version, to_version, status, migrated_at, error_message
    FROM "_system_upgrade_log"
    ORDER BY migrated_at DESC
    LIMIT ${limit}
  `;
  
  return results.map(r => ({
    fromVersion: r.from_version,
    toVersion: r.to_version,
    status: r.status,
    migratedAt: r.migrated_at,
    errorMessage: r.error_message || undefined,
  }));
}
```

---

## API 接口

### 1. 获取版本信息

```typescript
// src/app/api/admin/version/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getCurrentVersion, ensureSystemTables, getUpgradeLogs } from '@/lib/migrator';
import { CURRENT_VERSION, MIN_VERSION } from '@/lib/version';

export async function GET() {
  // TODO: 管理员认证检查
  // const session = await auth();
  // if (!session?.user || !await isAdmin(session.user.id)) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // }
  
  try {
    await ensureSystemTables();
    const currentVersion = await getCurrentVersion();
    const logs = await getUpgradeLogs(5);
    
    // 检查是否需要强制升级
    const needsForcedUpgrade = compareVersions(currentVersion, MIN_VERSION) < 0;
    
    return NextResponse.json({
      currentVersion,
      latestVersion: CURRENT_VERSION,
      minVersion: MIN_VERSION,
      needsUpgrade: compareVersions(currentVersion, CURRENT_VERSION) < 0,
      needsForcedUpgrade,
      canUpgrade: compareVersions(currentVersion, CURRENT_VERSION) < 0,
      upgradeLogs: logs,
    });
  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to get version info',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
```

### 2. 执行升级

```typescript
// src/app/api/admin/upgrade/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { runUpgrade, ensureSystemTables } from '@/lib/migrator';
import { CURRENT_VERSION } from '@/lib/version';

export async function POST() {
  // TODO: 管理员认证检查
  // const session = await auth();
  // if (!session?.user || !await isAdmin(session.user.id)) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // }
  
  try {
    await ensureSystemTables();
    
    // 执行升级
    const result = await runUpgrade(CURRENT_VERSION);
    
    return NextResponse.json({
      success: result.success,
      fromVersion: result.fromVersion,
      toVersion: result.toVersion,
      migrationsRun: result.migrationsRun,
      message: result.message,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Upgrade failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      recovery: 'Please restore from backup and try again',
    }, { status: 500 });
  }
}
```

### 3. 检查远程最新版本

```typescript
// src/app/api/admin/version-check/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GitHub API 配置
const GITHUB_API = 'https://api.github.com/repos/Semonxue/NextPost/releases/latest';

export async function GET() {
  try {
    // 更新检查时间
    await prisma.$executeRaw`
      UPDATE "_system_version" 
      SET last_check_at = CURRENT_TIMESTAMP
      WHERE id = 'system'
    `;
    
    // 从 GitHub 获取最新版本
    const response = await fetch(GITHUB_API, {
      headers: { 
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'NextPost-Updater',
      },
    });
    
    if (!response.ok) {
      // 如果是 404，说明还没有发布
      if (response.status === 404) {
        return NextResponse.json({
          latestVersion: null,
          message: 'No releases found',
        });
      }
      throw new Error(`GitHub API error: ${response.status}`);
    }
    
    const data = await response.json();
    const latestVersion = data.tag_name?.replace(/^v/, '') || null;
    
    if (latestVersion) {
      // 更新检查到的最新版本
      await prisma.$executeRaw`
        UPDATE "_system_version" 
        SET last_check_version = ${latestVersion}
        WHERE id = 'system'
      `;
    }
    
    return NextResponse.json({
      latestVersion,
      releaseNotes: data.body || '',
      releaseUrl: data.html_url || '',
      publishedAt: data.published_at || null,
    });
  } catch (error) {
    return NextResponse.json({ 
      error: 'Version check failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
```

---

## 管理后台 UI

### 设置页面升级区块

在 `src/app/(main)/settings/page.tsx` 中添加：

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

interface VersionInfo {
  currentVersion: string;
  latestVersion: string;
  minVersion: string;
  needsUpgrade: boolean;
  needsForcedUpgrade: boolean;
  canUpgrade: boolean;
  upgradeLogs: Array<{
    fromVersion: string;
    toVersion: string;
    status: string;
    migratedAt: string;
  }>;
}

export default function SystemUpgrade() {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 获取版本信息
  const fetchVersionInfo = async () => {
    try {
      const res = await fetch('/api/admin/version');
      const data = await res.json();
      setVersionInfo(data);
    } catch (err) {
      setError('获取版本信息失败');
    }
  };

  // 检查远程版本
  const checkRemoteVersion = async () => {
    setIsChecking(true);
    try {
      const res = await fetch('/api/admin/version-check');
      await res.json();
      await fetchVersionInfo(); // 刷新版本信息
    } catch (err) {
      setError('检查新版本失败');
    } finally {
      setIsChecking(false);
    }
  };

  // 执行升级
  const handleUpgrade = async () => {
    if (!confirm('确定要升级系统吗？建议先备份数据库。')) {
      return;
    }
    
    setIsUpgrading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const res = await fetch('/api/admin/upgrade', { method: 'POST' });
      const data = await res.json();
      
      if (data.success) {
        setSuccess(`升级成功：${data.fromVersion} → ${data.toVersion}`);
        await fetchVersionInfo();
      } else {
        setError(`升级失败：${data.details}`);
      }
    } catch (err) {
      setError('升级请求失败');
    } finally {
      setIsUpgrading(false);
    }
  };

  useEffect(() => {
    fetchVersionInfo();
  }, []);

  if (!versionInfo) {
    return <div>加载中...</div>;
  }

  const needsForcedUpgrade = versionInfo.needsForcedUpgrade;
  const canUpgrade = versionInfo.canUpgrade;

  return (
    <Card>
      <CardHeader>
        <CardTitle>🆙 系统升级</CardTitle>
      </CardHeader>
      <CardContent>
        {/* 强制升级警告 */}
        {needsForcedUpgrade && (
          <div className="mb-4 p-4 bg-red-100 border border-red-300 rounded-lg">
            <h4 className="font-bold text-red-700">⚠️ 必须升级</h4>
            <p className="text-sm text-red-600 mt-1">
              当前版本 {versionInfo.currentVersion} 过旧，不再受支持。
              请立即升级到 {versionInfo.minVersion} 或更高版本。
            </p>
          </div>
        )}

        {/* 版本信息 */}
        <div className="mb-4">
          <div className="flex items-center gap-4">
            <span className="text-lg">
              当前版本: <strong>{versionInfo.currentVersion}</strong>
            </span>
            <span className="text-gray-400">→</span>
            <span className="text-lg">
              最新版本: <strong>{versionInfo.latestVersion}</strong>
            </span>
          </div>
        </div>

        {/* 操作按钮 */}
        {canUpgrade && !needsForcedUpgrade && (
          <div className="mb-4">
            <Button
              onClick={handleUpgrade}
              disabled={isUpgrading}
              className="mr-2"
            >
              {isUpgrading ? '升级中...' : `🚀 升级到 v${versionInfo.latestVersion}`}
            </Button>
            <Button
              variant="outline"
              onClick={checkRemoteVersion}
              disabled={isChecking}
            >
              {isChecking ? '检查中...' : '🔄 检查新版本'}
            </Button>
          </div>
        )}

        {/* 强制升级按钮 */}
        {needsForcedUpgrade && (
          <div className="mb-4">
            <Button
              onClick={handleUpgrade}
              disabled={isUpgrading}
              variant="destructive"
            >
              {isUpgrading ? '升级中...' : `⚡ 必须升级到 v${versionInfo.minVersion}`}
            </Button>
          </div>
        )}

        {/* 错误/成功消息 */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-700">
            {success}
          </div>
        )}

        {/* 升级日志 */}
        {versionInfo.upgradeLogs.length > 0 && (
          <div className="mt-6">
            <h4 className="font-semibold mb-2">升级历史</h4>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">时间</th>
                    <th className="px-3 py-2 text-left">版本变更</th>
                    <th className="px-3 py-2 text-left">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {versionInfo.upgradeLogs.map((log, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-2">
                        {new Date(log.migratedAt).toLocaleString('zh-CN')}
                      </td>
                      <td className="px-3 py-2">
                        {log.fromVersion} → {log.toVersion}
                      </td>
                      <td className="px-3 py-2">
                        {log.status === 'completed' ? (
                          <span className="text-green-600">✅ 成功</span>
                        ) : (
                          <span className="text-red-600">❌ 失败</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

---

## CI/CD 发布流程

### GitHub Actions 发布工作流

创建 `.github/workflows/release.yml`：

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Extract version
        id: version
        run: |
          VERSION=${GITHUB_REF#refs/tags/v}
          echo "VERSION=$VERSION" >> $GITHUB_OUTPUT
          echo "MAJOR=${VERSION%%.*}" >> $GITHUB_OUTPUT
      
      - name: Generate changelog
        id: changelog
        uses: metcalfc/changelog-builder@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          onlyMilestones: true
      
      - name: Create Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ github.ref_name }}
          name: Release ${{ github.ref_name }}
          body: ${{ steps.changelog.outputs.changelog }}
          draft: false
          prerelease: ${{ contains(github.ref_name, 'beta') || contains(github.ref_name, 'alpha') }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

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

# 预发布版本
git tag v2.0.0-beta.1
git push origin v2.0.0-beta.1
```

---

## 用户升级流程

### 首次安装

```
┌─────────────────────────────────────────────────────────────────┐
│                    首次安装 / 启动                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 用户 Fork/Clone 主版本仓库                                  │
│  2. 部署到 Cloudflare/Vercel 等平台                             │
│  3. 首次访问时，系统自动执行所有迁移                             │
│  4. 版本记录写入 _system_version 表                             │
│  5. 用户正常使用                                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 日常升级

```
┌─────────────────────────────────────────────────────────────────┐
│                      日常升级流程                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 主版本发布新版本 (git tag v1.1.0)                           │
│  2. 用户后台检测到新版本                                         │
│  3. 用户点击「升级」                                             │
│  4. 系统执行缺失的迁移                                           │
│  5. 更新版本记录                                                │
│  6. 升级完成                                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 强制升级

```
┌─────────────────────────────────────────────────────────────────┐
│                      强制升级流程                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 主版本发布重大版本 (breaking change)                        │
│  2. 主版本更新 MIN_VERSION 为新版本                             │
│  3. 用户后台显示「必须升级」警告                                 │
│  4. 用户无法跳过升级                                            │
│  5. 用户点击升级                                                │
│  6. 升级后恢复正常使用                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 开发指南

### 添加新迁移

当需要发布新版本时，按以下步骤操作：

#### 1. 更新版本常量

```typescript
// src/lib/version.ts
export const CURRENT_VERSION = '1.1.0';  // 更新为新版本
export const MIN_VERSION = '0.6.0';      // 如果有强制升级需求，更新此值
```

#### 2. 添加迁移映射

```typescript
// src/lib/version-migrations.ts
export const VERSION_MIGRATIONS: Record<string, string[]> = {
  // ... 现有版本
  
  // 新版本
  '1.1.0': [
    '202607150000_add_xxx_feature',
  ],
};

export const MIGRATION_DESCRIPTIONS: Record<string, string> = {
  // ... 现有迁移
  
  // 新迁移
  '202607150000_add_xxx_feature': '新增 XXX 功能',
};
```

#### 3. 实现迁移 SQL

在 `migrator.ts` 的 `getMigrationSQL` 函数中添加：

```typescript
function getMigrationSQL(migrationName: string): string | null {
  const migrations: Record<MigrationName, string> = {
    // ... 现有迁移
    
    '202607150000_add_xxx_feature': `
      -- 迁移 SQL
      ALTER TABLE "Post" ADD COLUMN "new_field" TEXT DEFAULT '';
    `,
  };
  
  return migrations[migrationName] || null;
}
```

#### 4. 更新 Prisma Schema（如果有变更）

```bash
# 本地生成迁移
pnpm prisma migrate dev --name add_xxx_feature
```

#### 5. 发布版本

```bash
# 更新 VERSION 文件
echo "1.1.0" > VERSION

# 提交更改
git add .
git commit -m "release: v1.1.0"
git tag v1.1.0
git push --tags
```

---

## 测试

### 单元测试

```typescript
// tests/lib/migrator.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { compareVersions, collectMigrations } from '@/lib/migrator';

describe('Version Management', () => {
  describe('compareVersions', () => {
    it('should return -1 when a < b', () => {
      expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
      expect(compareVersions('1.0.0', '1.1.0')).toBe(-1);
      expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
    });
    
    it('should return 0 when a === b', () => {
      expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    });
    
    it('should return 1 when a > b', () => {
      expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
      expect(compareVersions('1.1.0', '1.0.0')).toBe(1);
      expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
    });
  });
  
  describe('collectMigrations', () => {
    it('should return empty array when versions are equal', () => {
      const migrations = collectMigrations('1.0.0', '1.0.0');
      expect(migrations).toEqual([]);
    });
    
    it('should collect all migrations between versions', () => {
      const migrations = collectMigrations('0.5.3', '1.0.0');
      expect(migrations.length).toBeGreaterThan(0);
    });
  });
});
```

### 集成测试

```typescript
// tests/api/upgrade.test.ts
describe('Upgrade API', () => {
  it('should return current version info', async () => {
    const res = await fetch('/api/admin/version');
    const data = await res.json();
    
    expect(res.status).toBe(200);
    expect(data).toHaveProperty('currentVersion');
    expect(data).toHaveProperty('latestVersion');
    expect(data).toHaveProperty('needsUpgrade');
  });
  
  it('should not allow downgrade', async () => {
    // 尝试降级应该被拒绝
    const res = await fetch('/api/admin/upgrade', { method: 'POST' });
    const data = await res.json();
    
    // 已经在最新版本，应该返回成功但 migrationsRun = 0
    if (data.currentVersion === data.latestVersion) {
      expect(data.migrationsRun).toBe(0);
    }
  });
});
```

---

## 故障排查

### 常见问题

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| 升级后页面空白 | 迁移未执行完成 | 检查 D1 日志，确认迁移状态 |
| 版本显示为 0.0.0 | 系统表未初始化 | 访问任意页面触发初始化 |
| 迁移失败 | SQL 语法错误 | 检查迁移 SQL，查看错误日志 |
| 无法回滚 | 设计如此 | 从备份恢复数据库 |

### 调试命令

```bash
# 查看当前版本
wrangler d1 execute nextpost-db --remote --command="SELECT * FROM _system_version"

# 查看升级日志
wrangler d1 execute nextpost-db --remote --command="SELECT * FROM _system_upgrade_log ORDER BY migrated_at DESC LIMIT 10"

# 检查 Prisma 迁移状态
wrangler d1 execute nextpost-db --remote --command="SELECT * FROM _prisma_migrations"
```

---

## 附录

### 完整文件结构

```
nextpost/
├── VERSION                              # 版本文件
├── src/
│   └── lib/
│       ├── version.ts                  # 版本常量
│       ├── version-migrations.ts       # 迁移映射
│       └── migrator.ts                 # 迁移执行器
├── prisma/
│   └── migrations/
│       └── 202606170000_add_system_tables/
│           └── migration.sql           # 系统表迁移
└── .github/
    └── workflows/
        └── release.yml                  # 发布流程
```

### 相关文档

- [Cloudflare 部署方案](./CLOUDFLARE_DEPLOY.md)
- [项目计划](./PROJECT_PLAN.md)

---

**文档结束**
