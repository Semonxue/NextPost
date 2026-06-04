/**
 * Sidebar 组件单元测试
 * 验证导航渲染、active 状态、移动端 toggle、logout
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock next/navigation usePathname
const mockPathname = vi.fn()
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  redirect: vi.fn(),
}))

// Mock next/link 保持简单
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

// Mock next-auth useSession
const mockSession = vi.fn()
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: mockSession() }),
  signOut: vi.fn(),
  signIn: vi.fn(),
}))

// Mock ui store
const mockToggleSidebar = vi.fn()
const mockSidebarOpen = { value: true }
vi.mock('@/stores/uiStore', () => ({
  useUIStore: () => ({ sidebarOpen: mockSidebarOpen.value, toggleSidebar: mockToggleSidebar }),
}))

import { Sidebar } from '@/components/Sidebar'

describe('Sidebar', () => {
  beforeEach(() => {
    mockPathname.mockReturnValue('/')
    mockSession.mockReturnValue(null)
    mockToggleSidebar.mockClear()
  })

  it('渲染 NextPost logo', () => {
    render(<Sidebar />)
    expect(screen.getByText('NextPost')).toBeInTheDocument()
  })

  it('渲染所有导航项', () => {
    render(<Sidebar />)
    expect(screen.getByText('仪表盘')).toBeInTheDocument()
    expect(screen.getByText('日历视图')).toBeInTheDocument()
    expect(screen.getByText('帖子列表')).toBeInTheDocument()
    expect(screen.getByText('AI tools')).toBeInTheDocument()
    expect(screen.getByText('设置')).toBeInTheDocument()
    expect(screen.getByText('回收站')).toBeInTheDocument()
  })

  it('点击设置菜单展开子菜单，显示账号管理', async () => {
    render(<Sidebar />)
    // 默认子菜单是折叠的
    expect(screen.queryByText('账号管理')).not.toBeInTheDocument()
    // 点击设置菜单
    await userEvent.click(screen.getByText('设置'))
    // 子菜单应该展开
    expect(screen.getByText('账号管理')).toBeInTheDocument()
    expect(screen.getByText('常规设置')).toBeInTheDocument()
  })

  it('访问账号管理页面时自动展开设置菜单', () => {
    mockPathname.mockReturnValue('/accounts')
    render(<Sidebar />)
    expect(screen.getByText('账号管理')).toBeInTheDocument()
    expect(screen.getByText('常规设置')).toBeInTheDocument()
  })

  it('未登录时显示"登录"链接', () => {
    render(<Sidebar />)
    expect(screen.getByText('登录')).toBeInTheDocument()
  })

  it('已登录时显示用户名和退出按钮', () => {
    mockSession.mockReturnValue({ user: { name: 'Alice', email: 'alice@example.com' } })
    render(<Sidebar />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
  })

  it('已登录但无 email 时显示"已登录"', () => {
    mockSession.mockReturnValue({ user: { name: 'Bob' } })
    render(<Sidebar />)
    expect(screen.getByText('已登录')).toBeInTheDocument()
  })

  it('点击导航项触发 toggleSidebar（移动端）', async () => {
    // 模拟移动端宽度
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 500 })
    render(<Sidebar />)
    await userEvent.click(screen.getByText('帖子列表'))
    expect(mockToggleSidebar).toHaveBeenCalled()
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1280 })
  })

  it('点击移动端 toggle 按钮', async () => {
    render(<Sidebar />)
    const toggleBtn = screen.getAllByRole('button')[0] // 第一个 button 是移动端 toggle
    await userEvent.click(toggleBtn)
    expect(mockToggleSidebar).toHaveBeenCalledTimes(1)
  })

  it('sidebarOpen=false 时：移动端 toggle 显示 Menu 图标，sidebar 用 -translate-x-full', () => {
    mockSidebarOpen.value = false
    render(<Sidebar />)
    const toggleBtn = screen.getAllByRole('button')[0]
    expect(toggleBtn.querySelector('svg')).toHaveClass('lucide-menu')
    const aside = document.querySelector('aside')
    expect(aside?.className).toMatch(/-translate-x-full/)
    mockSidebarOpen.value = true
  })

  it('点击导航项时 window.innerWidth >= 1024 不触发 toggleSidebar', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1280 })
    render(<Sidebar />)
    await userEvent.click(screen.getByText('帖子列表'))
    expect(mockToggleSidebar).not.toHaveBeenCalled()
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1280 })
  })

  it('点击退出按钮触发 signOut', async () => {
    mockSession.mockReturnValue({ user: { name: 'Alice' } })
    const { signOut } = await import('next-auth/react')
    render(<Sidebar />)
    const logoutBtn = screen.getByTitle('退出登录')
    await userEvent.click(logoutBtn)
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/login' })
  })
})
