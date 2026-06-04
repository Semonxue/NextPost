/**
 * middleware 单元测试
 *
 * 验证：
 * - /api 路径不拦截
 * - 未登录访问受保护页面 → 重定向 /login
 * - 已登录访问 /login /register → 重定向 /
 * - 已登录访问受保护页面 → 通过
 * - 未登录访问 /login → 通过
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock next/server —— 在 import middleware 之前
vi.mock('next/server', () => ({
  NextResponse: {
    next: vi.fn(() => ({ type: 'next' })),
    redirect: vi.fn((url: URL) => ({ type: 'redirect', url: url.toString() })),
  },
}))

// Mock @/lib/auth —— middleware 用 `import { auth }` named import
// 这里让 auth 直接返回原 handler，方便测试直接调用
vi.mock('@/lib/auth', () => ({
  auth: (handler: unknown) => handler,
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() },
}))

import middleware from '@/middleware'

function fakeReq(opts: { pathname: string; isLoggedIn: boolean; url?: string }) {
  const baseUrl = opts.url ?? 'http://localhost:3456'
  return {
    nextUrl: new URL(opts.pathname, baseUrl),
    url: baseUrl,
    auth: opts.isLoggedIn ? { user: { id: 'u1' } } : null,
  }
}

describe('middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('API 路径直接通过（不拦截）', () => {
    const result = (middleware as unknown as (req: unknown) => unknown)(fakeReq({ pathname: '/api/mcp', isLoggedIn: false }))
    expect(result).toEqual({ type: 'next' })
  })

  it('未登录访问根路径 → 重定向 /login', () => {
    const result = (middleware as unknown as (req: unknown) => unknown)(fakeReq({ pathname: '/', isLoggedIn: false }))
    expect(result).toEqual(expect.objectContaining({ type: 'redirect', url: expect.stringContaining('/login') }))
  })

  it('未登录访问 /posts → 重定向 /login', () => {
    const result = (middleware as unknown as (req: unknown) => unknown)(fakeReq({ pathname: '/posts', isLoggedIn: false }))
    expect(result).toEqual(expect.objectContaining({ type: 'redirect', url: expect.stringContaining('/login') }))
  })

  it('已登录访问 /login → 重定向 /', () => {
    const result = (middleware as unknown as (req: unknown) => unknown)(fakeReq({ pathname: '/login', isLoggedIn: true }))
    expect(result).toEqual(expect.objectContaining({ type: 'redirect', url: expect.stringContaining('/') }))
  })

  it('已登录访问 /register → 重定向 /', () => {
    const result = (middleware as unknown as (req: unknown) => unknown)(fakeReq({ pathname: '/register', isLoggedIn: true }))
    expect(result).toEqual(expect.objectContaining({ type: 'redirect', url: expect.stringContaining('/') }))
  })

  it('已登录访问根路径 → 通过', () => {
    const result = (middleware as unknown as (req: unknown) => unknown)(fakeReq({ pathname: '/', isLoggedIn: true }))
    expect(result).toEqual({ type: 'next' })
  })

  it('未登录访问 /login → 通过', () => {
    const result = (middleware as unknown as (req: unknown) => unknown)(fakeReq({ pathname: '/login', isLoggedIn: false }))
    expect(result).toEqual({ type: 'next' })
  })

  it('未登录访问 /register → 通过', () => {
    const result = (middleware as unknown as (req: unknown) => unknown)(fakeReq({ pathname: '/register', isLoggedIn: false }))
    expect(result).toEqual({ type: 'next' })
  })
})
