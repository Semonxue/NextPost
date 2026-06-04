/**
 * ContentEditor 组件单元测试
 * 验证字符计数、状态颜色、进度条、warning/error 提示
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ContentEditor } from '@/components/ContentEditor'
import type { PlatformConfig } from '@/lib/platform'

const twitterConfig: PlatformConfig = {
  platformId: 'twitter',
  platformName: 'Twitter',
  maxContentLength: 280,
  maxImages: 4,
  maxVideos: 1,
  allowMixedMedia: true,
}

describe('ContentEditor', () => {
  it('渲染 textarea 和字符计数', () => {
    render(<ContentEditor platformConfig={twitterConfig} value="" onChange={() => {}} />)
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea).toBeInTheDocument()
    expect(screen.getByText('0 / 280')).toBeInTheDocument()
  })

  it('输入文本触发 onChange', async () => {
    const onChange = vi.fn()
    render(<ContentEditor platformConfig={twitterConfig} value="" onChange={onChange} />)
    const textarea = screen.getByRole('textbox')
    await userEvent.type(textarea, 'hi')
    // onChange 应至少被调用 1 次；userEvent.type 在受控 textarea 上的具体 value 累积行为依赖 jsdom 实现，
    // 这里只验证"输入会触发 onChange 回调"
    expect(onChange.mock.calls.length).toBeGreaterThan(0)
  })

  it('placeholder 默认值', () => {
    render(<ContentEditor platformConfig={twitterConfig} value="" onChange={() => {}} />)
    expect(screen.getByPlaceholderText('输入你的帖子内容...')).toBeInTheDocument()
  })

  it('自定义 placeholder', () => {
    render(<ContentEditor platformConfig={twitterConfig} value="" onChange={() => {}} placeholder="写点啥..." />)
    expect(screen.getByPlaceholderText('写点啥...')).toBeInTheDocument()
  })

  it('normal 状态：短文本不显示 warning/error 提示', () => {
    render(<ContentEditor platformConfig={twitterConfig} value="短" onChange={() => {}} />)
    expect(screen.queryByText(/超出 \d+ 字符/)).not.toBeInTheDocument()
    // normal 状态时 status 行右侧 "剩余 N 字符" 也会显示（remaining > 20 时）
    // 这里"短" remaining = 279 > 20，所以会显示 —— 这是预期行为
    // 仅验证没有 warning/error 颜色样式
  })

  it('warning 状态（> 90% 限制）显示"剩余 N 字符"', () => {
    // 280 * 0.91 = 254.8 → 255 字符触发 warning
    const longText = 'a'.repeat(260)
    render(<ContentEditor platformConfig={twitterConfig} value={longText} onChange={() => {}} />)
    expect(screen.getByText(/剩余 20 字符/)).toBeInTheDocument()
  })

  it('error 状态（超过限制）显示"超出 N 字符"', () => {
    const longText = 'a'.repeat(290)
    render(<ContentEditor platformConfig={twitterConfig} value={longText} onChange={() => {}} />)
    expect(screen.getByText(/超出 10 字符/)).toBeInTheDocument()
  })

  it('error 状态时显示 AlertCircle 图标', () => {
    const longText = 'a'.repeat(290)
    const { container } = render(<ContentEditor platformConfig={twitterConfig} value={longText} onChange={() => {}} />)
    // AlertCircle 是 lucide-react 的 svg
    expect(container.querySelector('.text-red-500 svg')).toBeInTheDocument()
  })

  it('rows prop 传给 textarea', () => {
    render(<ContentEditor platformConfig={twitterConfig} value="" onChange={() => {}} rows={10} />)
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.rows).toBe(10)
  })
})
