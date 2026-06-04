/**
 * Button 组件单元测试
 * 验证 variant/size/loading/disabled/className
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '@/components/ui/Button'

describe('Button', () => {
  it('渲染 children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('点击触发 onClick', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Go</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('disabled 时不触发 onClick', async () => {
    const onClick = vi.fn()
    render(<Button disabled onClick={onClick}>No</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('loading 时禁用按钮', () => {
    render(<Button loading>Loading</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('loading 时显示 spinner svg', () => {
    const { container } = render(<Button loading>Loading</Button>)
    expect(container.querySelector('svg.animate-spin')).toBeInTheDocument()
  })

  it('variant=primary 应用蓝色样式', () => {
    render(<Button variant="primary">P</Button>)
    expect(screen.getByRole('button').className).toMatch(/bg-blue-600/)
  })

  it('variant=danger 应用红色样式', () => {
    render(<Button variant="danger">D</Button>)
    expect(screen.getByRole('button').className).toMatch(/bg-red-600/)
  })

  it('variant=ghost 透明背景', () => {
    render(<Button variant="ghost">G</Button>)
    expect(screen.getByRole('button').className).toMatch(/bg-transparent/)
  })

  it('size=sm 字号小', () => {
    render(<Button size="sm">S</Button>)
    expect(screen.getByRole('button').className).toMatch(/text-sm/)
  })

  it('size=lg 字号大', () => {
    render(<Button size="lg">L</Button>)
    expect(screen.getByRole('button').className).toMatch(/text-lg/)
  })

  it('自定义 className 合并', () => {
    render(<Button className="custom-class">C</Button>)
    expect(screen.getByRole('button').className).toContain('custom-class')
  })
})
