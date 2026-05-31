import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '@/stores/authStore'

describe('useAuthStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAuthStore.setState({
      isAuthenticated: false,
      user: null,
    })
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(false)
      expect(state.user).toBe(null)
    })
  })

  describe('setUser', () => {
    it('should set user and mark as authenticated when user is provided', () => {
      const testUser = { id: 'user-123', name: 'testuser', email: 'test@example.com' }
      useAuthStore.getState().setUser(testUser)

      const state = useAuthStore.getState()
      expect(state.user).toEqual(testUser)
      expect(state.isAuthenticated).toBe(true)
    })

    it('should set user to null and mark as unauthenticated', () => {
      // First set a user
      const testUser = { id: 'user-123', name: 'testuser' }
      useAuthStore.getState().setUser(testUser)
      expect(useAuthStore.getState().isAuthenticated).toBe(true)

      // Then set to null
      useAuthStore.getState().setUser(null)
      const state = useAuthStore.getState()
      expect(state.user).toBe(null)
      expect(state.isAuthenticated).toBe(false)
    })

    it('should correctly handle user without email', () => {
      const testUser = { id: 'user-123', name: 'testuser' }
      useAuthStore.getState().setUser(testUser)

      const state = useAuthStore.getState()
      expect(state.user?.name).toBe('testuser')
      expect(state.user?.email).toBe(undefined)
    })
  })

  describe('logout', () => {
    it('should clear user and mark as unauthenticated', () => {
      // First login
      const testUser = { id: 'user-123', name: 'testuser' }
      useAuthStore.getState().setUser(testUser)
      expect(useAuthStore.getState().isAuthenticated).toBe(true)

      // Then logout
      useAuthStore.getState().logout()
      const state = useAuthStore.getState()
      expect(state.user).toBe(null)
      expect(state.isAuthenticated).toBe(false)
    })
  })
})