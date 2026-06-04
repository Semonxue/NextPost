/**
 * ToastContainer 组件单元测试
 * 验证渲染、3 秒后自动移除
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { useUIStore } from '@/stores/uiStore'
import { ToastContainer } from '@/components/ui/Toast'

describe('ToastContainer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useUIStore.setState({ toasts: [] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('toasts 为空时不渲染任何 toast', () => {
    const { container } = render(<ToastContainer />)
    // 只有最外层 div，里面没有 toast
    expect(container.querySelector('.flex.flex-col.gap-2')?.children.length ?? 0).toBe(0)
  })

  it('渲染 success toast', () => {
    act(() => {
      useUIStore.getState().addToast({ type: 'success', message: 'Saved!' })
    })
    render(<ToastContainer />)
    expect(screen.getByText('Saved!')).toBeInTheDocument()
  })

  it('渲染 error toast', () => {
    act(() => {
      useUIStore.getState().addToast({ type: 'error', message: 'Failed' })
    })
    render(<ToastContainer />)
    expect(screen.getByText('Failed')).toBeInTheDocument()
  })

  it('渲染 info toast', () => {
    act(() => {
      useUIStore.getState().addToast({ type: 'info', message: 'FYI' })
    })
    render(<ToastContainer />)
    expect(screen.getByText('FYI')).toBeInTheDocument()
  })

  it('3 秒后自动移除', () => {
    act(() => {
      useUIStore.getState().addToast({ type: 'success', message: 'Bye' })
    })
    render(<ToastContainer />)
    expect(screen.getByText('Bye')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.queryByText('Bye')).not.toBeInTheDocument()
  })

  it('多个 toast 同时显示', () => {
    act(() => {
      useUIStore.getState().addToast({ type: 'success', message: 'A' })
      useUIStore.getState().addToast({ type: 'error', message: 'B' })
    })
    render(<ToastContainer />)
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  it('点击 X 按钮立即移除', () => {
    act(() => {
      useUIStore.getState().addToast({ type: 'info', message: 'Clickable' })
    })
    render(<ToastContainer />)
    const closeBtns = screen.getAllByRole('button')
    expect(closeBtns.length).toBeGreaterThan(0)
    act(() => {
      closeBtns[0].click()
    })
    expect(screen.queryByText('Clickable')).not.toBeInTheDocument()
  })
})
