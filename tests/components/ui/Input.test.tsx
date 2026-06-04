/**
 * Input 组件单元测试
 * 验证 label 关联、error 提示、自定义 className
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from '@/components/ui/Input'

describe('Input', () => {
  it('渲染 input 元素', () => {
    render(<Input data-testid="test-input" />)
    expect(screen.getByTestId('test-input')).toBeInTheDocument()
    expect(screen.getByTestId('test-input').tagName).toBe('INPUT')
  })

  it('label 关联 input（for/htmlFor）', () => {
    render(<Input label="用户名" />)
    const input = screen.getByLabelText('用户名')
    expect(input.tagName).toBe('INPUT')
  })

  it('无 label 时不渲染 label 元素', () => {
    const { container } = render(<Input data-testid="i" />)
    expect(container.querySelector('label')).toBeNull()
  })

  it('error 时显示错误文本并应用红色样式', () => {
    render(<Input label="邮箱" error="格式不正确" data-testid="err-input" />)
    expect(screen.getByText('格式不正确')).toBeInTheDocument()
    expect(screen.getByTestId('err-input').className).toMatch(/border-red-500/)
  })

  it('无 error 时应用蓝色 focus 样式', () => {
    render(<Input data-testid="ok-input" />)
    expect(screen.getByTestId('ok-input').className).toMatch(/focus:ring-blue-500/)
  })

  it('用户输入触发 onChange', async () => {
    const onChange = vi.fn()
    render(<Input data-testid="x" onChange={onChange} />)
    await userEvent.type(screen.getByTestId('x'), 'hello')
    expect(onChange).toHaveBeenCalled()
  })

  it('支持自定义 id', () => {
    render(<Input id="custom-id" data-testid="x" />)
    expect(screen.getByTestId('x').id).toBe('custom-id')
  })

  it('label 中的空格被替换为连字符作为默认 id', () => {
    render(<Input label="用户 邮箱" data-testid="x" />)
    expect(screen.getByTestId('x').id).toBe('input-用户-邮箱')
  })
})
