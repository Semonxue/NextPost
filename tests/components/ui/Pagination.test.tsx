/**
 * Pagination 组件单元测试
 * 验证翻页、pageSize 切换、单页时隐藏
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Pagination } from '@/components/ui/Pagination'

describe('Pagination', () => {
  it('总页数 ≤ 1 时不渲染', () => {
    const { container } = render(
      <Pagination
        currentPage={1}
        totalItems={5}
        pageSize={10}
        onPageChange={() => {}}
      />
    )
    // pageSizeOptions[0] = 10, totalItems=5 < 10 → 隐藏
    expect(container.firstChild).toBeNull()
  })

  it('总页数 > 1 时渲染页码', () => {
    render(
      <Pagination
        currentPage={1}
        totalItems={50}
        pageSize={10}
        onPageChange={() => {}}
      />
    )
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('点击页码触发 onPageChange', async () => {
    const onPageChange = vi.fn()
    render(
      <Pagination
        currentPage={1}
        totalItems={50}
        pageSize={10}
        onPageChange={onPageChange}
      />
    )
    await userEvent.click(screen.getByText('3'))
    expect(onPageChange).toHaveBeenCalledWith(3)
  })

  it('首页时上一页按钮 disabled', () => {
    render(
      <Pagination
        currentPage={1}
        totalItems={50}
        pageSize={10}
        onPageChange={() => {}}
      />
    )
    // 第一个 Button 是 ChevronLeft
    const prevBtn = screen.getAllByRole('button')[0]
    expect(prevBtn).toBeDisabled()
  })

  it('末页时下一页按钮 disabled', () => {
    render(
      <Pagination
        currentPage={5}
        totalItems={50}
        pageSize={10}
        onPageChange={() => {}}
      />
    )
    // 最后一个 Button 是 ChevronRight
    const buttons = screen.getAllByRole('button')
    const nextBtn = buttons[buttons.length - 1]
    expect(nextBtn).toBeDisabled()
  })

  it('有 onPageSizeChange 时显示每页选择器', () => {
    render(
      <Pagination
        currentPage={1}
        totalItems={50}
        pageSize={10}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
      />
    )
    expect(screen.getByText(/每页/)).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('切换 pageSize 触发 onPageSizeChange', async () => {
    const onPageSizeChange = vi.fn()
    render(
      <Pagination
        currentPage={1}
        totalItems={50}
        pageSize={10}
        onPageChange={() => {}}
        onPageSizeChange={onPageSizeChange}
      />
    )
    await userEvent.selectOptions(screen.getByRole('combobox'), '20')
    expect(onPageSizeChange).toHaveBeenCalledWith(20)
  })

  it('显示范围信息（startItem-endItem / total）', () => {
    render(
      <Pagination
        currentPage={2}
        totalItems={50}
        pageSize={10}
        onPageChange={() => {}}
      />
    )
    // startItem = (2-1)*10+1 = 11, endItem = min(2*10, 50) = 20
    expect(screen.getByText(/显示 11-20，共 50 条/)).toBeInTheDocument()
  })
})
