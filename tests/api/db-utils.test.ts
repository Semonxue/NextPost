/**
 * Tests for public exports of src/lib/db/index.ts
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

import {
  isCloudflareWorkersRuntime,
  isWorkersRuntime,
  DEFAULT_LOCAL_DB_PATH,
} from '@/lib/db'

describe('src/lib/db/index.ts', () => {
  describe('isCloudflareWorkersRuntime', () => {
    const prevNavigator = (globalThis as Record<string, unknown>).navigator

    afterEach(() => {
      ;(globalThis as Record<string, unknown>).navigator = prevNavigator
    })

    it('returns false when process.versions.node is defined (Node.js)', () => {
      const result = isCloudflareWorkersRuntime()
      expect(result).toBe(false)
    })

    it('returns true when navigator.userAgent starts with Cloudflare-Workers', () => {
      ;(globalThis as Record<string, unknown>).navigator = { userAgent: 'Cloudflare-Workers/1.0' } as unknown as Navigator
      const result = isCloudflareWorkersRuntime()
      expect(result).toBe(true)
    })
  })

  describe('DEFAULT_LOCAL_DB_PATH', () => {
    it('is data/nextpost.db', () => {
      expect(DEFAULT_LOCAL_DB_PATH).toBe('data/nextpost.db')
    })
  })

  describe('isWorkersRuntime', () => {
    const prevNavigator = (globalThis as Record<string, unknown>).navigator

    afterEach(() => {
      ;(globalThis as Record<string, unknown>).navigator = prevNavigator
    })

    it('returns false in Node.js env', () => {
      const result = isWorkersRuntime()
      expect(result).toBe(false)
    })
  })
})
