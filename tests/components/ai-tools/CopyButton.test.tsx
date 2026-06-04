/**
 * CopyButton 组件单元测试
 *
 * jsdom 26+ 限制：
 *   - navigator.clipboard 是 undefined
 *   - document.execCommand 是 undefined
 * 两条都会抛 TypeError，所以 production 总是走到 "复制失败" toast 分支。
 * 成功路径（setCopied + setTimeout）由 E2E 覆盖。
 *
 * 本测试覆盖：
 * - 默认/自定义 label 渲染
 * - 点击 → jsdom 下抛 TypeError → 走 fallback 也抛 → toast "复制失败"
 *   （这是 jsdom 26+ 下唯一可达的交互路径）
 *
 * 不用 userEvent：jsdom 下 userEvent 在 mock 缺失的剪贴板/textarea 场景
 * 行为不稳定（会变成"成功"路径），fireEvent 更确定。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { CopyButton } from '@/app/(main)/ai-tools/CopyButton'

describe('CopyButton', () => {
  beforeEach(() => {
    // 确保 navigator.clipboard / document.execCommand 是 undefined
    // （不主动 mock，让 production 走 catch + toast 分支）
  })

  afterEach(() => {
    vi.restoreAllMocks()
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
    // jsdom 26+ 默认两者都抛 TypeError，production 会走 toast 分支
    const { useUIStore } = await import('@/stores/uiStore')

    render(<CopyButton text="hello" />)
    fireEvent.click(screen.getByRole('button'))

    // 等微任务跑完
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    const toasts = useUIStore.getState().toasts
    expect(toasts.some((t) => t.type === 'error' && t.message === '复制失败')).toBe(true)
  })

  it('点击后 button 状态不变（jsdom 下走 toast 而非 setCopied）', () => {
    render(<CopyButton text="hello" />)
    fireEvent.click(screen.getByRole('button'))
    // 同步事件，没有 async 副作用
    expect(screen.getByText('复制')).toBeInTheDocument()
  })
})
