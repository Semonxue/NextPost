import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Pagination } from '@/components/ui/Pagination'

describe('Pagination Component', () => {
  it('renders nothing when total items is 0', () => {
    render(
      <Pagination
        currentPage={1}
        totalItems={0}
        pageSize={20}
        onPageChange={vi.fn()}
      />
    )
    expect(screen.queryByText('显示')).toBeNull()
  })

  it('renders pagination controls when there are items', () => {
    render(
      <Pagination
        currentPage={1}
        totalItems={50}
        pageSize={20}
        onPageChange={vi.fn()}
      />
    )
    expect(screen.getByText('显示 1-20，共 50 条')).toBeTruthy()
  })

  it('calls onPageChange when clicking next button', () => {
    const onPageChange = vi.fn()
    render(
      <Pagination
        currentPage={1}
        totalItems={50}
        pageSize={20}
        onPageChange={onPageChange}
      />
    )
    const buttons = screen.getAllByRole('button')
    // Last button is next button (ChevronRight)
    fireEvent.click(buttons[buttons.length - 1])
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('calls onPageChange when clicking previous button', () => {
    const onPageChange = vi.fn()
    render(
      <Pagination
        currentPage={2}
        totalItems={50}
        pageSize={20}
        onPageChange={onPageChange}
      />
    )
    const buttons = screen.getAllByRole('button')
    // First button is previous button (ChevronLeft)
    fireEvent.click(buttons[0])
    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it('disables previous button on first page', () => {
    render(
      <Pagination
        currentPage={1}
        totalItems={50}
        pageSize={20}
        onPageChange={vi.fn()}
      />
    )
    const buttons = screen.getAllByRole('button')
    expect(buttons[0]).toBeDisabled()
  })

  it('disables next button on last page', () => {
    render(
      <Pagination
        currentPage={3}
        totalItems={50}
        pageSize={20}
        onPageChange={vi.fn()}
      />
    )
    const buttons = screen.getAllByRole('button')
    expect(buttons[buttons.length - 1]).toBeDisabled()
  })

  it('shows page size selector when onPageSizeChange is provided', () => {
    render(
      <Pagination
        currentPage={1}
        totalItems={50}
        pageSize={20}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        pageSizeOptions={[10, 20, 50]}
      />
    )
    expect(screen.getByText('每页')).toBeTruthy()
    const select = screen.getByRole('combobox')
    expect(select).toBeTruthy()
  })

  it('calls onPageSizeChange when changing page size', () => {
    const onPageSizeChange = vi.fn()
    render(
      <Pagination
        currentPage={1}
        totalItems={50}
        pageSize={20}
        onPageChange={vi.fn()}
        onPageSizeChange={onPageSizeChange}
        pageSizeOptions={[10, 20, 50]}
      />
    )
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: '10' } })
    expect(onPageSizeChange).toHaveBeenCalledWith(10)
  })
})