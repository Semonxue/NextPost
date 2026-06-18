/**
 * Auth API tests
 */
import { describe, it, expect, vi } from 'vitest'

// NextAuth handlers 需要 mock，否则返回 undefined
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
  handlers: {
    GET: vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })),
    POST: vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })),
  },
}))

import { GET, POST } from '@/app/api/auth/[...nextauth]/route'

describe('Auth API ([...nextauth])', () => {
  it('GET delegates to next-auth GET handler', async () => {
    const response = await GET(new Request('http://localhost/api/auth/session'))
    expect(response.status).toBeLessThan(500)
  })

  it('POST delegates to next-auth POST handler', async () => {
    const response = await POST(new Request('http://localhost/api/auth/callback/twitter', { method: 'POST' }))
    expect(response.status).toBeLessThan(500)
  })
})
