/**
 * RevealKeyButton 补充测试 —— 独立文件避免与其他测试的 act/state 污染
 *
 * 覆盖：handleCopy 路径（line 38-44）
 *
 * jsdom 26+ 限制：navigator.clipboard.writeText 是 undefined，
 * production 进入 catch → toast "复制失败"。这是 jsdom 下唯一可达的路径。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { RevealKeyButton } from '@/app/(main)/ai-tools/RevealKeyButton'
import { useUIStore } from '@/stores/uiStore'

describe('RevealKeyButton handleCopy (v0.5+ jsdom)', () => {
  beforeEach(() => {
    useUIStore.setState({ toasts: [] })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    useUIStore.setState({ toasts: [] })
  })

  it('点击复制按钮 → jsdom 26+ 抛 TypeError → addToast error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ key: 'npk_clip_test' }),
    }) as unknown as typeof fetch

    render(<RevealKeyButton keyId="k1" />)
    fireEvent.click(screen.getByTestId('apikey-reveal-btn'))
    await waitFor(() => screen.getByTestId('apikey-revealed'))

    fireEvent.click(screen.getByTitle('复制'))

    // 给微任务跑完
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })

    const toasts = useUIStore.getState().toasts
    expect(toasts.some((t) => t.type === 'error' && t.message === '复制失败')).toBe(true)
  })
})
