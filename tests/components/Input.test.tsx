import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Input } from '@/components/ui/Input'

describe('Input Component', () => {
  describe('Rendering', () => {
    it('should render input element', () => {
      render(<Input />)
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('should render with label', () => {
      render(<Input label="用户名" />)
      expect(screen.getByText('用户名')).toBeInTheDocument()
      expect(screen.getByLabelText('用户名')).toBeInTheDocument()
    })

    it('should render with placeholder', () => {
      render(<Input placeholder="请输入内容" />)
      expect(screen.getByPlaceholderText('请输入内容')).toBeInTheDocument()
    })
  })

  describe('States', () => {
    it('should show error state', () => {
      render(<Input error="这是必填字段" />)
      expect(screen.getByText('这是必填字段')).toBeInTheDocument()
      expect(screen.getByRole('textbox')).toHaveClass('border-red-500')
    })

    it('should be disabled when disabled prop is true', () => {
      render(<Input disabled />)
      expect(screen.getByRole('textbox')).toBeDisabled()
    })
  })

  describe('Value handling', () => {
    it('should support controlled value', () => {
      render(<Input value="测试值" onChange={() => {}} />)
      expect(screen.getByRole('textbox')).toHaveValue('测试值')
    })
  })

  describe('Accessibility', () => {
    it('should associate label with input', () => {
      render(<Input label="邮箱" />)
      const input = screen.getByRole('textbox')
      const label = screen.getByText('邮箱')
      expect(label).toHaveAttribute('for')
      expect(input.id).toBe(label.getAttribute('for'))
    })

    it('should have accessible error message', () => {
      render(<Input label="密码" error="密码不能为空" />)
      const errorText = screen.getByText('密码不能为空')
      expect(errorText).toBeInTheDocument()
    })
  })

  describe('Custom attributes', () => {
    it('should support custom className', () => {
      render(<Input className="custom-input" />)
      const input = screen.getByRole('textbox')
      expect(input.className).toContain('custom-input')
    })

    it('should pass through standard input props', () => {
      render(
        <Input
          type="email"
          name="email"
          autoComplete="email"
          maxLength={100}
        />
      )
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('type', 'email')
      expect(input).toHaveAttribute('name', 'email')
      expect(input).toHaveAttribute('autocomplete', 'email')
      expect(input).toHaveAttribute('maxlength', '100')
    })
  })
})