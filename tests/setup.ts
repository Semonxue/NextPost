// @ts-nocheck
import '@testing-library/jest-dom'
import { vi } from 'vitest'

// 默认 APP_URL（vitest 不会启动 dev server，需给个兜底；
// 真实环境由 dev.mjs 注入 process.env.APP_URL）
if (!process.env.APP_URL) {
  process.env.APP_URL = 'http://localhost:3456'
}

// Mock NextAuth
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: {
    GET: vi.fn(),
    POST: vi.fn(),
  },
}))

// Mock next/navigation
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/',
}))

// Mock next/image
vi.mock('next/image', () => {
  return {
    __esModule: true,
    default: function MockImage(props: { src: string; alt: string }) {
      return null
    },
  }
})

// Global test timeout
vi.setConfig({
  testTimeout: 10000,
})