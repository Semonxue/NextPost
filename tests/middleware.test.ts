/**
 * middleware 单元测试
 *
 * 策略：只 mock next-auth/jwt，不 mock next/server，
 * 让 middleware 用真实的 NextResponse。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock next-auth/jwt（不在 Edge 环境运行）
vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn(),
}))

import { getToken } from 'next-auth/jwt'
import { middleware } from '@/middleware'

// Helper: 构造一个 minimal Request-like 对象
function fakeReq(url: string) {
  return {
    url,
  } as unknown as Request
}

describe('middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // --- 放行路由 ---
  it('GET /api/mcp → 通过（不放行）', async () => {
    // middleware 的 matcher 包含 /api/mcp，但代码里单独判断了 /api/mcp 放行
    ;(getToken as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const result = await middleware(fakeReq('http://localhost/api/mcp'))
    expect(result).toBeInstanceOf(Response) // NextResponse.next() 返回真实 Response
    expect((result as Response).status).toBe(200)
  })

  it('GET /api/auth/... → 通过', async () => {
    ;(getToken as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const result = await middleware(fakeReq('http://localhost/api/auth/session'))
    expect((result as Response).status).toBe(200)
  })

  it('GET /favicon → 通过', async () => {
    ;(getToken as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const result = await middleware(fakeReq('http://localhost/favicon.ico'))
    expect((result as Response).status).toBe(200)
  })

  // --- 未登录重定向 ---
  it('未登录访问 / → 重定向 /login', async () => {
    ;(getToken as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const result = await middleware(fakeReq('http://localhost/'))
    expect((result as Response).status).toBe(307)
    // NextResponse.redirect with base URL produces full URL: "http://localhost/login"
    expect((result as Response).headers.get('location')).toMatch(/\/login$/)
  })

  it('未登录访问 /posts → 重定向 /login', async () => {
    ;(getToken as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const result = await middleware(fakeReq('http://localhost/posts'))
    expect((result as Response).status).toBe(307)
    expect((result as Response).headers.get('location')).toMatch(/\/login$/)
  })

  it('未登录访问 /dashboard → 重定向 /login', async () => {
    ;(getToken as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const result = await middleware(fakeReq('http://localhost/dashboard'))
    expect((result as Response).status).toBe(307)
    expect((result as Response).headers.get('location')).toMatch(/\/login$/)
  })

  // --- 已登录访问 auth 页面 → 重定向 / ---
  it('已登录访问 /login → 重定向 /', async () => {
    ;(getToken as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u1', name: 'test' })
    const result = await middleware(fakeReq('http://localhost/login'))
    expect((result as Response).status).toBe(307)
    expect((result as Response).headers.get('location')).toMatch(/\/$/)
  })

  it('已登录访问 /register → 重定向 /', async () => {
    ;(getToken as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u1', name: 'test' })
    const result = await middleware(fakeReq('http://localhost/register'))
    expect((result as Response).status).toBe(307)
    expect((result as Response).headers.get('location')).toMatch(/\/$/)
  })

  // --- 已登录访问受保护页面 → 通过 ---
  it('已登录访问 / → 通过', async () => {
    ;(getToken as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u1', name: 'test' })
    const result = await middleware(fakeReq('http://localhost/'))
    expect((result as Response).status).toBe(200)
  })

  it('已登录访问 /posts → 通过', async () => {
    ;(getToken as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u1', name: 'test' })
    const result = await middleware(fakeReq('http://localhost/posts'))
    expect((result as Response).status).toBe(200)
  })

  // --- 未登录访问 auth 页面 → 通过 ---
  it('未登录访问 /login → 通过', async () => {
    ;(getToken as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const result = await middleware(fakeReq('http://localhost/login'))
    expect((result as Response).status).toBe(200)
  })

  it('未登录访问 /register → 通过', async () => {
    ;(getToken as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const result = await middleware(fakeReq('http://localhost/register'))
    expect((result as Response).status).toBe(200)
  })
})
