/**
 * Modal 组件单元测试
 * 验证 open/close、点击遮罩关闭、点击 X 关闭
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Modal } from '@/components/ui/Modal'

describe('Modal', () => {
  it('isOpen=false 不渲染', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={() => {}} title="T">
        <p>content</p>
      </Modal>
    )
    expect(container.firstChild).toBeNull()
  })

  it('isOpen=true 渲染标题和内容', () => {
    render(
      <Modal isOpen onClose={() => {}} title="My Modal">
        <p>body</p>
      </Modal>
    )
    expect(screen.getByText('My Modal')).toBeInTheDocument()
    expect(screen.getByText('body')).toBeInTheDocument()
  })

  it('点击 X 触发 onClose', async () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen onClose={onClose} title="T">
        <p>body</p>
      </Modal>
    )
    // X 按钮是 svg 按钮，找最接近的 button
    const closeBtn = screen.getByRole('button')
    await userEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('点击遮罩（绝对定位的 div）触发 onClose', async () => {
    const onClose = vi.fn()
    const { container } = render(
      <Modal isOpen onClose={onClose} title="T">
        <p>body</p>
      </Modal>
    )
    // 第一个 absolute inset-0 的 div 是遮罩
    const overlay = container.querySelector('.absolute.inset-0')
    expect(overlay).toBeInTheDocument()
    await userEvent.click(overlay!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
