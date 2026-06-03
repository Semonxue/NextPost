#!/usr/bin/env node
/**
 * NextPost dev server 启动器
 *
 * 设计目标：
 * - 单一 source of truth: APP_URL
 * - 用户只配一个 env（APP_URL），自动派生 PORT / NEXTAUTH_URL / NEXT_PUBLIC_BASE_URL
 * - 避免在 10+ 个文件里 hardcode 端口号
 *
 * 用法：
 *   pnpm dev                          # 默认 APP_URL=http://localhost:3456
 *   APP_URL=https://nextpost.example.com pnpm dev   # 自定义 URL
 */

import { spawn } from 'node:child_process';
import process from 'node:process';

const APP_URL = process.env.APP_URL || 'http://localhost:3456';

// 解析 URL 拿端口
let port;
try {
  const parsed = new URL(APP_URL);
  if (parsed.port) {
    port = parsed.port;
  } else {
    // 80/443 等默认端口在 URL 里省略
    port = parsed.protocol === 'https:' ? '443' : '80';
  }
} catch (err) {
  console.error(`[dev] ❌ Invalid APP_URL: ${APP_URL}`);
  console.error(`[dev]    Expected format: http://localhost:3456 or https://example.com`);
  console.error(`[dev]    Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

// 注入到子进程环境变量
process.env.PORT = port;
process.env.NEXTAUTH_URL = APP_URL;
process.env.NEXT_PUBLIC_BASE_URL = APP_URL;

console.log(`[dev] APP_URL=${APP_URL}`);
console.log(`[dev] PORT=${port}`);
console.log(`[dev] NEXTAUTH_URL=${APP_URL}`);
console.log(`[dev] NEXT_PUBLIC_BASE_URL=${APP_URL}`);
console.log(`[dev] ────────────────────────────────────────────`);

// 启动 next dev
const child = spawn('next', ['dev', '-p', port], {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

child.on('exit', (code) => process.exit(code ?? 0));
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
