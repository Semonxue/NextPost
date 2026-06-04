/**
 * RegisterPage 客户端组件单元测试
 * 验证渲染、输入、密码一致性校验、提交调用 register API
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock next/navigation
const mockPush = vi.fn()
const mockRefresh = vi.fn()
const mockSignIn = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: mockRefresh }),
  redirect: vi.fn(),
  usePathname: () => '/register',
}))

vi.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
  useSession: () => ({ data: null }),
  signOut: vi.fn(),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

import RegisterPage from '@/app/(auth)/register/page'

describe('RegisterPage', () => {
  beforeEach(() => {
    mockSignIn.mockReset()
    mockPush.mockReset()
    mockRefresh.mockReset()
    // 默认 fetch stub
    global.fetch = vi.fn() as unknown as typeof fetch
  })

  it('渲染用户名、密码、确认密码、邮箱输入框', () => {
    render(<RegisterPage />)
    expect(screen.getByLabelText(/用户名/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^密码$/)).toBeInTheDocument()
    expect(screen.getByLabelText(/确认密码/)).toBeInTheDocument()
    expect(screen.getByLabelText(/邮箱/)).toBeInTheDocument()
  })

  it('渲染"去登录"链接', () => {
    render(<RegisterPage />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/login')
  })

  it('两次密码不一致时显示错误', async () => {
    const user = userEvent.setup()
    render(<RegisterPage />)
    await user.type(screen.getByLabelText(/用户名/), 'alice')
    await user.type(screen.getByLabelText(/^密码$/), '123456')
    await user.type(screen.getByLabelText(/确认密码/), '654321')
    await user.click(screen.getByRole('button', { name: /注册/ }))

    await waitFor(() => {
      expect(screen.getByText('两次密码输入不一致')).toBeInTheDocument()
    })
  })

  it('密码少于 6 位时显示错误', async () => {
    const user = userEvent.setup()
    render(<RegisterPage />)
    await user.type(screen.getByLabelText(/用户名/), 'alice')
    await user.type(screen.getByLabelText(/^密码$/), '123')
    await user.type(screen.getByLabelText(/确认密码/), '123')
    await user.click(screen.getByRole('button', { name: /注册/ }))

    await waitFor(() => {
      expect(screen.getByText('密码长度至少为6位')).toBeInTheDocument()
    })
  })

  it('注册 API 成功 → 调 fetch + push /login?registered=true', async () => {
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'u1', username: 'alice' }),
    })

    const user = userEvent.setup()
    render(<RegisterPage />)
    await user.type(screen.getByLabelText(/用户名/), 'alice')
    await user.type(screen.getByLabelText(/^密码$/), '123456')
    await user.type(screen.getByLabelText(/确认密码/), '123456')
    await user.click(screen.getByRole('button', { name: /注册/ }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/auth/register',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('alice'),
        })
      )
    })
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login?registered=true')
    })
  })

  it('注册 API 失败时显示错误信息', async () => {
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: '用户名已存在' }),
    })

    const user = userEvent.setup()
    render(<RegisterPage />)
    await user.type(screen.getByLabelText(/用户名/), 'alice')
    await user.type(screen.getByLabelText(/^密码$/), '123456')
    await user.type(screen.getByLabelText(/确认密码/), '123456')
    await user.click(screen.getByRole('button', { name: /注册/ }))

    await waitFor(() => {
      expect(screen.getByText('用户名已存在')).toBeInTheDocument()
    })
  })
})
