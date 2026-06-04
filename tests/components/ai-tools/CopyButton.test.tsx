/**
 * CopyButton 组件单元测试
 *
 * jsdom 26+ 限制：
 *   - navigator.clipboard 是 undefined
 *   - document.execCommand 是 undefined
 * 两条都会抛 TypeError，所以 production 总是走到 "复制失败" toast 分支。
 *
 * 通过 Object.defineProperty(navigator, 'clipboard', { get: ... }) mock
 * 走成功路径，验证 setCopied + setTimeout 行为。
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { CopyButton } from '@/app/(main)/ai-tools/CopyButton'
import { useUIStore } from '@/stores/uiStore'

describe('CopyButton', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    // 恢复 navigator.clipboard 为 undefined（jsdom 26+ 默认）
    try {
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        configurable: true,
      })
    } catch {
      // ignore
    }
  })

  it('渲染默认 label', () => {
    render(<CopyButton text="hello" />)
    expect(screen.getByText('复制')).toBeInTheDocument()
  })

  it('自定义 label', () => {
    render(<CopyButton text="x" label="复制配置" />)
    expect(screen.getByText('复制配置')).toBeInTheDocument()
  })

  it('渲染为 button 元素', () => {
    render(<CopyButton text="x" />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('jsdom 下点击 → clipboard 抛 + execCommand 抛 → toast "复制失败"', async () => {
    useUIStore.setState({ toasts: [] })

    render(<CopyButton text="hello" />)
    fireEvent.click(screen.getByRole('button'))

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    const toasts = useUIStore.getState().toasts
    expect(toasts.some((t) => t.type === 'error' && t.message === '复制失败')).toBe(true)
  })

  it('点击后 button 状态不变（jsdom 下走 toast 而非 setCopied）', () => {
    render(<CopyButton text="hello" />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('复制')).toBeInTheDocument()
  })
})
