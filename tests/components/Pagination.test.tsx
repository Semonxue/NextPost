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

  it('renders nothing when total items is less than first page size option', () => {
    render(
      <Pagination
        currentPage={1}
        totalItems={5}
        pageSize={20}
        onPageChange={vi.fn()}
        pageSizeOptions={[10]}
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

  describe('Page number buttons (totalPages > 5)', () => {
    it('shows first 5 pages when currentPage <= 3', () => {
      // 100 items / 10 per page = 10 pages, currentPage = 2 -> shows 1..5
      render(
        <Pagination
          currentPage={2}
          totalItems={100}
          pageSize={10}
          onPageChange={vi.fn()}
        />
      )
      // Should render page numbers 1, 2, 3, 4, 5
      expect(screen.getByText('1')).toBeTruthy()
      expect(screen.getByText('2')).toBeTruthy()
      expect(screen.getByText('3')).toBeTruthy()
      expect(screen.getByText('4')).toBeTruthy()
      expect(screen.getByText('5')).toBeTruthy()
    })

    it('shows last 5 pages when currentPage >= totalPages - 2', () => {
      // 100 items / 10 per page = 10 pages, currentPage = 9 -> shows 6..10
      render(
        <Pagination
          currentPage={9}
          totalItems={100}
          pageSize={10}
          onPageChange={vi.fn()}
        />
      )
      // Should render page numbers 6, 7, 8, 9, 10
      expect(screen.getByText('6')).toBeTruthy()
      expect(screen.getByText('7')).toBeTruthy()
      expect(screen.getByText('8')).toBeTruthy()
      expect(screen.getByText('9')).toBeTruthy()
      expect(screen.getByText('10')).toBeTruthy()
    })

    it('shows pages around currentPage when in middle range', () => {
      // 100 items / 10 per page = 10 pages, currentPage = 5 -> shows 3,4,5,6,7
      render(
        <Pagination
          currentPage={5}
          totalItems={100}
          pageSize={10}
          onPageChange={vi.fn()}
        />
      )
      // Should render page numbers 3, 4, 5, 6, 7
      expect(screen.getByText('3')).toBeTruthy()
      expect(screen.getByText('4')).toBeTruthy()
      expect(screen.getByText('5')).toBeTruthy()
      expect(screen.getByText('6')).toBeTruthy()
      expect(screen.getByText('7')).toBeTruthy()
    })

    it('calls onPageChange when clicking a page number', () => {
      const onPageChange = vi.fn()
      // 100 items / 10 per page = 10 pages, currentPage = 2 -> shows 1..5
      render(
        <Pagination
          currentPage={2}
          totalItems={100}
          pageSize={10}
          onPageChange={onPageChange}
        />
      )
      // Click page number 4
      const page4Btn = screen.getByText('4')
      fireEvent.click(page4Btn)
      expect(onPageChange).toHaveBeenCalledWith(4)
    })

    it('highlights current page with blue background', () => {
      const { container } = render(
        <Pagination
          currentPage={3}
          totalItems={100}
          pageSize={10}
          onPageChange={vi.fn()}
        />
      )
      // The page 3 button should have bg-blue-600 class
      const page3Btn = screen.getByText('3')
      expect(page3Btn.className).toContain('bg-blue-600')
    })

    it('renders all pages when totalPages <= 5', () => {
      // 50 items / 20 per page = 3 pages
      render(
        <Pagination
          currentPage={1}
          totalItems={50}
          pageSize={20}
          onPageChange={vi.fn()}
        />
      )
      // Should render all 3 page numbers
      expect(screen.getByText('1')).toBeTruthy()
      expect(screen.getByText('2')).toBeTruthy()
      expect(screen.getByText('3')).toBeTruthy()
      // Should not render page 6+
      expect(screen.queryByText('6')).toBeNull()
    })
  })
})
