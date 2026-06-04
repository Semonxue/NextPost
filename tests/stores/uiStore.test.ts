/**
 * uiStore 单元测试
 * 验证 sidebar 开关、toast 添加/移除、ID 唯一性
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from '@/stores/uiStore'

describe('useUIStore', () => {
  beforeEach(() => {
    useUIStore.setState({ sidebarOpen: true, toasts: [] })
  })

  describe('sidebar', () => {
    it('初始 sidebarOpen 为 true', () => {
      expect(useUIStore.getState().sidebarOpen).toBe(true)
    })

    it('toggleSidebar 翻转状态', () => {
      useUIStore.getState().toggleSidebar()
      expect(useUIStore.getState().sidebarOpen).toBe(false)
      useUIStore.getState().toggleSidebar()
      expect(useUIStore.getState().sidebarOpen).toBe(true)
    })

    it('setSidebarOpen 显式设置', () => {
      useUIStore.getState().setSidebarOpen(false)
      expect(useUIStore.getState().sidebarOpen).toBe(false)
      useUIStore.getState().setSidebarOpen(true)
      expect(useUIStore.getState().sidebarOpen).toBe(true)
    })
  })

  describe('toasts', () => {
    it('addToast 推入新 toast，分配唯一 id', () => {
      useUIStore.getState().addToast({ type: 'success', message: 'A' })
      useUIStore.getState().addToast({ type: 'error', message: 'B' })
      const toasts = useUIStore.getState().toasts
      expect(toasts).toHaveLength(2)
      expect(toasts[0].id).not.toBe(toasts[1].id)
      expect(toasts[0].message).toBe('A')
      expect(toasts[1].type).toBe('error')
    })

    it('removeToast 按 id 移除', () => {
      useUIStore.getState().addToast({ type: 'info', message: 'X' })
      const id = useUIStore.getState().toasts[0].id
      useUIStore.getState().removeToast(id)
      expect(useUIStore.getState().toasts).toHaveLength(0)
    })

    it('removeToast 移除不存在的 id 时不变', () => {
      useUIStore.getState().addToast({ type: 'info', message: 'X' })
      useUIStore.getState().removeToast('toast-99999')
      expect(useUIStore.getState().toasts).toHaveLength(1)
    })

    it('addToast 保持插入顺序', () => {
      useUIStore.getState().addToast({ type: 'success', message: '1' })
      useUIStore.getState().addToast({ type: 'success', message: '2' })
      useUIStore.getState().addToast({ type: 'success', message: '3' })
      const msgs = useUIStore.getState().toasts.map((t) => t.message)
      expect(msgs).toEqual(['1', '2', '3'])
    })
  })
})
