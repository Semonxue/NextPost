import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from '@/components/ui/Button'

describe('Button Component', () => {
  describe('Rendering', () => {
    it('should render button with children', () => {
      render(<Button>点击我</Button>)
      expect(screen.getByRole('button', { name: '点击我' })).toBeInTheDocument()
    })

    it('should render with different variants', () => {
      const { rerender } = render(<Button variant="primary">Primary</Button>)
      expect(screen.getByRole('button')).toBeInTheDocument()

      rerender(<Button variant="secondary">Secondary</Button>)
      expect(screen.getByRole('button')).toBeInTheDocument()

      rerender(<Button variant="danger">Danger</Button>)
      expect(screen.getByRole('button')).toBeInTheDocument()

      rerender(<Button variant="ghost">Ghost</Button>)
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('should render with different sizes', () => {
      const { rerender } = render(<Button size="sm">Small</Button>)
      expect(screen.getByRole('button')).toBeInTheDocument()

      rerender(<Button size="md">Medium</Button>)
      expect(screen.getByRole('button')).toBeInTheDocument()

      rerender(<Button size="lg">Large</Button>)
      expect(screen.getByRole('button')).toBeInTheDocument()
    })
  })

  describe('States', () => {
    it('should be disabled when disabled prop is true', () => {
      render(<Button disabled>禁用按钮</Button>)
      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('should show loading spinner when loading is true', () => {
      render(<Button loading>加载中</Button>)
      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
      expect(button.querySelector('svg')).toBeInTheDocument() // spinner SVG
    })

    it('should be disabled when loading', () => {
      render(<Button loading>加载中</Button>)
      expect(screen.getByRole('button')).toBeDisabled()
    })
  })

  describe('Interactions', () => {
    it('should call onClick when clicked', async () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick}>点击我</Button>)
      
      screen.getByRole('button').click()
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('should not call onClick when disabled', () => {
      const handleClick = vi.fn()
      render(<Button disabled onClick={handleClick}>禁用</Button>)
      
      screen.getByRole('button').click()
      expect(handleClick).not.toHaveBeenCalled()
    })

    it('should not call onClick when loading', () => {
      const handleClick = vi.fn()
      render(<Button loading onClick={handleClick}>加载中</Button>)
      
      screen.getByRole('button').click()
      expect(handleClick).not.toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('should render as a button element', () => {
      render(<Button>按钮</Button>)
      expect(screen.getByRole('button')).toBeTruthy()
    })

    it('should support custom className', () => {
      render(<Button className="custom-class">自定义样式</Button>)
      const button = screen.getByRole('button')
      expect(button.className).toContain('custom-class')
    })
  })
})