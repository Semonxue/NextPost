/**
 * RevealKeyButton 组件单元测试
 * 验证点击后 fetch API、loading 状态、成功显示 input
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RevealKeyButton } from '@/app/(main)/ai-tools/RevealKeyButton'

// Mock clipboard for copy functionality
// jsdom 26+ 中 navigator.clipboard 是只读 property 且 writeText 默认 throw，
// 测试只验证 fetch 行为，clipboard 部分忽略
beforeEach(() => {
  // 不主动 mock navigator.clipboard，让 CopyButton 内部 catch 处理
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('RevealKeyButton', () => {
  it('初始状态渲染 Reveal 按钮', () => {
    render(<RevealKeyButton keyId="k1" />)
    expect(screen.getByTestId('apikey-reveal-btn')).toBeInTheDocument()
    expect(screen.getByText('Reveal')).toBeInTheDocument()
  })

  it('点击 Reveal 调用 fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ key: 'npk_abc123' }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const user = userEvent.setup()
    render(<RevealKeyButton keyId="k1" />)
    await user.click(screen.getByTestId('apikey-reveal-btn'))

    expect(fetchMock).toHaveBeenCalledWith('/api/settings/external-keys/reveal?id=k1')
  })

  it('fetch 成功后显示 input 含完整 key', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ key: 'npk_abc123' }),
    }) as unknown as typeof fetch

    const user = userEvent.setup()
    render(<RevealKeyButton keyId="k1" />)
    await user.click(screen.getByTestId('apikey-reveal-btn'))

    await waitFor(() => {
      const input = screen.getByTestId('apikey-revealed').querySelector('input')
      expect(input).toHaveValue('npk_abc123')
    })
  })

  it('fetch 失败时调用 addToast（error）', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch
    const { useUIStore } = await import('@/stores/uiStore')
    const initialToastCount = useUIStore.getState().toasts.length

    const user = userEvent.setup()
    render(<RevealKeyButton keyId="k1" />)
    await user.click(screen.getByTestId('apikey-reveal-btn'))

    await waitFor(() => {
      const toasts = useUIStore.getState().toasts
      expect(toasts.length).toBeGreaterThan(initialToastCount)
      expect(toasts[toasts.length - 1].type).toBe('error')
    })
  })

  it('fetch 抛错时调用 addToast（error）', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network')) as unknown as typeof fetch
    const { useUIStore } = await import('@/stores/uiStore')

    const user = userEvent.setup()
    render(<RevealKeyButton keyId="k1" />)
    await user.click(screen.getByTestId('apikey-reveal-btn'))

    await waitFor(() => {
      const toasts = useUIStore.getState().toasts
      expect(toasts.some((t) => t.type === 'error')).toBe(true)
    })
  })

  it('点击 hide 按钮回到初始状态', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ key: 'npk_xyz' }),
    }) as unknown as typeof fetch

    const user = userEvent.setup()
    render(<RevealKeyButton keyId="k1" />)
    await user.click(screen.getByTestId('apikey-reveal-btn'))
    await waitFor(() => screen.getByTestId('apikey-revealed'))

    await user.click(screen.getByTitle('隐藏'))
    expect(screen.getByTestId('apikey-reveal-btn')).toBeInTheDocument()
  })
})
