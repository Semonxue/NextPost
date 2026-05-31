import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useUIStore } from '@/stores/uiStore'

describe('useUIStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useUIStore.setState({
      sidebarOpen: true,
      toasts: [],
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useUIStore.getState()
      expect(state.sidebarOpen).toBe(true)
      expect(state.toasts).toEqual([])
    })
  })

  describe('Sidebar', () => {
    it('should toggle sidebar open/closed', () => {
      expect(useUIStore.getState().sidebarOpen).toBe(true)
      useUIStore.getState().toggleSidebar()
      expect(useUIStore.getState().sidebarOpen).toBe(false)
      useUIStore.getState().toggleSidebar()
      expect(useUIStore.getState().sidebarOpen).toBe(true)
    })

    it('should set sidebar open state', () => {
      useUIStore.getState().setSidebarOpen(false)
      expect(useUIStore.getState().sidebarOpen).toBe(false)
      useUIStore.getState().setSidebarOpen(true)
      expect(useUIStore.getState().sidebarOpen).toBe(true)
    })
  })

  describe('Toast', () => {
    it('should add a toast message', () => {
      useUIStore.getState().addToast({ type: 'success', message: '保存成功' })

      const toasts = useUIStore.getState().toasts
      expect(toasts).toHaveLength(1)
      expect(toasts[0].type).toBe('success')
      expect(toasts[0].message).toBe('保存成功')
      expect(toasts[0].id).toBeDefined()
    })

    it('should add multiple toast messages', () => {
      useUIStore.getState().addToast({ type: 'success', message: '成功1' })
      useUIStore.getState().addToast({ type: 'error', message: '错误1' })
      useUIStore.getState().addToast({ type: 'info', message: '信息1' })

      const toasts = useUIStore.getState().toasts
      expect(toasts).toHaveLength(3)
      expect(toasts[0].message).toBe('成功1')
      expect(toasts[1].message).toBe('错误1')
      expect(toasts[2].message).toBe('信息1')
    })

    it('should remove a toast message', () => {
      // Add two toasts with a small delay to ensure different IDs
      useUIStore.getState().addToast({ type: 'success', message: '保存成功' })
      
      // Small delay to get different timestamp
      const firstToast = useUIStore.getState().toasts[0]
      
      useUIStore.getState().addToast({ type: 'error', message: '删除失败' })

      const toastsBefore = useUIStore.getState().toasts
      expect(toastsBefore).toHaveLength(2)

      // Get the first toast's ID (保存成功)
      const toastIdToRemove = firstToast.id
      useUIStore.getState().removeToast(toastIdToRemove)

      const toastsAfter = useUIStore.getState().toasts
      // Should have 1 toast left (删除失败)
      expect(toastsAfter).toHaveLength(1)
      expect(toastsAfter[0].message).toBe('删除失败')
    })

    it('should handle removing non-existent toast gracefully', () => {
      useUIStore.getState().addToast({ type: 'success', message: '保存成功' })
      useUIStore.getState().removeToast('non-existent-id')

      const toasts = useUIStore.getState().toasts
      expect(toasts).toHaveLength(1)
    })

    it('should generate unique IDs for toast messages', () => {
      // Add multiple toasts quickly - IDs should still be unique based on Date.now()
      useUIStore.getState().addToast({ type: 'info', message: '消息 1' })
      useUIStore.getState().addToast({ type: 'info', message: '消息 2' })
      useUIStore.getState().addToast({ type: 'info', message: '消息 3' })

      const toasts = useUIStore.getState().toasts
      expect(toasts).toHaveLength(3)
      
      // All IDs should be unique
      const ids = toasts.map(t => t.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(3)
    })
  })
})