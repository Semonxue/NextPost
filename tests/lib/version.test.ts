/**
 * 版本号单一来源守卫（Source of Truth guard）
 *
 * ⚠️ 此测试**必须**保留且不能被绕过。
 *
 * 守住三件事：
 * 1. `APP_VERSION` 字符串与 `package.json` 的 `version` 字段**完全一致**（单一来源）
 * 2. `src/lib/version.ts` 文件源码里**没有**硬编码版本号字面量
 *    （防止有人把动态 import 改回硬编码）
 * 3. `APP_VERSION` 是个合法的 semver 字符串（X.Y.Z）
 *
 * 如果以后有人改坏了这个守卫，下面任意一条会失败，CI 会拦住。
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { APP_VERSION } from '@/lib/version';
import packageJson from '../../package.json';

describe('应用版本号单一来源（src/lib/version.ts ↔ package.json）', () => {
  it('1. APP_VERSION 必须等于 package.json 的 version 字段', () => {
    expect(APP_VERSION).toBe(packageJson.version);
  });

  it('2. APP_VERSION 必须是非空字符串', () => {
    expect(typeof APP_VERSION).toBe('string');
    expect(APP_VERSION.length).toBeGreaterThan(0);
    expect(APP_VERSION.trim()).toBe(APP_VERSION);  // 无前后空格
  });

  it('3. APP_VERSION 必须符合 semver X.Y.Z 格式（防止意外字符混入）', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/);
  });

  it('4. src/lib/version.ts 源码里不能硬编码版本号字面量（如 "0.5.0"）', () => {
    // 读取源码
    const versionFilePath = resolve(__dirname, '../../src/lib/version.ts');
    const source = readFileSync(versionFilePath, 'utf-8');

    // 去掉注释行（防止注释里的 "0.5.0" 历史说明被误判）
    const codeOnly = source
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
      .join('\n');

    // 关键断言：代码中**不应该**有形如 `APP_VERSION = "0.5.0"` 或 `APP_VERSION: string = "0.5.0"`
    // 的硬编码。但允许 `APP_VERSION = packageJson.version` 这种动态赋值。
    const hardCodedPattern = /APP_VERSION\s*[:=]\s*string?\s*=\s*["'`][\d.]+["'`]/;
    expect(
      codeOnly,
      'src/lib/version.ts 出现了硬编码版本号字面量！请从 package.json 读取，参考本文件历史背景注释。'
    ).not.toMatch(hardCodedPattern);
  });

  it('5. src/lib/version.ts 源码里必须 import package.json（防止有人改成硬编码后忘记改回）', () => {
    const versionFilePath = resolve(__dirname, '../../src/lib/version.ts');
    const source = readFileSync(versionFilePath, 'utf-8');

    // 必须有 import packageJson from '../../package.json' 之类的语句
    expect(
      source,
      'src/lib/version.ts 缺少 package.json 的 import！版本号会失去单一来源。'
    ).toMatch(/import\s+\w+\s+from\s+['"`].*package\.json['"`]/);
  });
});
