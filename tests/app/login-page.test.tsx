/**
 * LoginPage 客户端组件单元测试
 * 验证渲染、输入、提交触发 signIn、错误处理
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock next/navigation
const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: mockRefresh }),
  redirect: vi.fn(),
  usePathname: () => '/login',
}))

// Mock next-auth
const mockSignIn = vi.fn()
vi.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
  useSession: () => ({ data: null }),
  signOut: vi.fn(),
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

import LoginPage from '@/app/(auth)/login/page'

describe('LoginPage', () => {
  beforeEach(() => {
    mockSignIn.mockReset()
    mockPush.mockReset()
    mockRefresh.mockReset()
  })

  it('渲染用户名、密码输入框和提交按钮', () => {
    render(<LoginPage />)
    expect(screen.getByLabelText(/用户名/)).toBeInTheDocument()
    expect(screen.getByLabelText(/密码/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /登录/ })).toBeInTheDocument()
  })

  it('渲染"去注册"链接', () => {
    render(<LoginPage />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/register')
  })

  it('用户输入用户名和密码', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)
    await user.type(screen.getByLabelText(/用户名/), 'alice')
    await user.type(screen.getByLabelText(/密码/), 'secret123')
    expect(screen.getByLabelText(/用户名/)).toHaveValue('alice')
    expect(screen.getByLabelText(/密码/)).toHaveValue('secret123')
  })

  it('提交时调用 signIn 并在成功时跳转', async () => {
    mockSignIn.mockResolvedValue({ error: null, ok: true })
    const user = userEvent.setup()
    render(<LoginPage />)
    await user.type(screen.getByLabelText(/用户名/), 'alice')
    await user.type(screen.getByLabelText(/密码/), 'secret123')
    await user.click(screen.getByRole('button', { name: /登录/ }))

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('credentials', {
        username: 'alice',
        password: 'secret123',
        redirect: false,
      })
    })
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/')
    })
  })

  it('登录失败时显示错误信息', async () => {
    mockSignIn.mockResolvedValue({ error: 'CredentialsSignin', ok: false })
    const user = userEvent.setup()
    render(<LoginPage />)
    await user.type(screen.getByLabelText(/用户名/), 'alice')
    await user.type(screen.getByLabelText(/密码/), 'wrong')
    await user.click(screen.getByRole('button', { name: /登录/ }))

    await waitFor(() => {
      expect(screen.getByText('用户名或密码错误')).toBeInTheDocument()
    })
    expect(mockPush).not.toHaveBeenCalled()
  })
})
