/**
 * authStore 单元测试
 * 验证用户状态、isAuthenticated、setUser/logout 行为
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '@/stores/authStore'

describe('useAuthStore', () => {
  beforeEach(() => {
    // 重置 store 到初始状态
    useAuthStore.setState({ isAuthenticated: false, user: null })
  })

  it('初始状态：未登录、用户为 null', () => {
    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(false)
    expect(state.user).toBeNull()
  })

  it('setUser 传入用户后 isAuthenticated 自动为 true', () => {
    const user = { id: 'u1', name: 'Alice', email: 'alice@example.com' }
    useAuthStore.getState().setUser(user)
    const state = useAuthStore.getState()
    expect(state.user).toEqual(user)
    expect(state.isAuthenticated).toBe(true)
  })

  it('setUser 传入 null 后 isAuthenticated 为 false', () => {
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'u1', name: 'Alice' } })
    useAuthStore.getState().setUser(null)
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })

  it('logout 重置为初始状态', () => {
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'u1', name: 'Alice' } })
    useAuthStore.getState().logout()
    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(false)
    expect(state.user).toBeNull()
  })

  it('支持不带 email 的 user 对象', () => {
    useAuthStore.getState().setUser({ id: 'u2', name: 'Bob' })
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })
})
