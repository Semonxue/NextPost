import { defineConfig, devices } from '@playwright/test'

// 单一 source of truth：与 src/lib/config.ts 的 getAppUrl() 保持一致逻辑
const APP_URL = process.env.APP_URL || 'http://localhost:3456'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // 禁用并行：SQLite 不支持多 writer 同时写，会导致 DB LOCK 错误
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // 强制单 worker，与 fullyParallel: false 配合避免 SQLite DB 锁
  reporter: 'html',
  use: {
    baseURL: APP_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: APP_URL,
    reuseExistingServer: !process.env.CI,
  },
  globalSetup: './tests/e2e/global-setup.ts',
})