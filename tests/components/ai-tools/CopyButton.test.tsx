/**
 * CopyButton 组件单元测试
 *
 * 简化：jsdom 26+ 提供 navigator.clipboard.writeText stub（resolved），
 * onClick 内部 try 分支总是成功，导致 catch/fallback 路径在 jsdom 下不可达。
 * 实际 copy 行为由 e2e 覆盖；这里只测 UI 渲染相关属性。
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CopyButton } from '@/app/(main)/ai-tools/CopyButton'

describe('CopyButton', () => {
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
})
