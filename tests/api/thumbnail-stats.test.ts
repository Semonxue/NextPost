import { describe, it, expect, beforeEach, vi } from 'vitest'

// Use vi.hoisted to properly hoist mock functions
const { mockPostFindMany, mockPostCount, mockAccountFindMany } = vi.hoisted(() => ({
  mockPostFindMany: vi.fn(),
  mockPostCount: vi.fn(),
  mockAccountFindMany: vi.fn(),
}))

// Mock prisma module
vi.mock('@/lib/prisma', () => ({
  default: {
    account: {
      count: mockPostCount,
      findMany: mockAccountFindMany,
    },
    post: {
      findMany: mockPostFindMany,
      count: mockPostCount,
    },
  },
}))

// Mock auth
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

// Mock fs module with proper default export
vi.mock('fs', () => ({
  default: {
    promises: {
      readdir: vi.fn(),
      stat: vi.fn(),
      access: vi.fn(),
      writeFile: vi.fn(),
      readFile: vi.fn(),
    },
  },
  promises: {
    readdir: vi.fn(),
    stat: vi.fn(),
    access: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
  },
}))

import { GET } from '@/app/api/stats/route'
import { auth } from '@/lib/auth'
import { promises as fs } from 'fs'

describe('Stats API - Thumbnail Stats', () => {
  const mockSession = {
    user: { id: 'user-123', name: 'testuser' },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession)
  })

  describe('GET /api/stats - Thumbnail Statistics', () => {
    it('should return thumbnailStats with valid structure', async () => {
      // Mock account count
      mockPostCount.mockResolvedValue(1)
      
      // Mock posts for status distribution
      mockPostCount.mockResolvedValueOnce(1) // accounts
      mockPostCount.mockResolvedValueOnce(5) // total posts
      mockPostCount.mockResolvedValue(2) // draft count
      
      // Mock posts with media
      mockPostFindMany.mockResolvedValue([
        { id: 'post-1', mediaUrls: '[]', mediaThumbnails: '[]' },
      ])
      
      // Mock account stats
      mockAccountFindMany.mockResolvedValue([
        { name: 'Test Account', _count: { posts: 5 } },
      ])
      
      // Mock fs to simulate empty uploads directory
      ;(fs.readdir as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ENOENT'))
      ;(fs.stat as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ENOENT'))
      
      const response = await GET()
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.thumbnailStats).toBeDefined()
      expect(typeof data.thumbnailStats.count).toBe('number')
      expect(typeof data.thumbnailStats.size).toBe('number')
      expect(data.thumbnailStats.count).toBe(0)
      expect(data.thumbnailStats.size).toBe(0)
    })

    it('should return zero stats when no thumbnails exist', async () => {
      mockPostCount.mockResolvedValue(0)
      mockPostFindMany.mockResolvedValue([])
      mockAccountFindMany.mockResolvedValue([])
      
      // Mock fs to return empty
      ;(fs.readdir as ReturnType<typeof vi.fn>).mockResolvedValue([] as any)
      ;(fs.stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 0 } as any)
      
      const response = await GET()
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.thumbnailStats.count).toBe(0)
      expect(data.thumbnailStats.size).toBe(0)
    })

    it('should return 401 when not authenticated', async () => {
      ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue(null)
      
      const response = await GET()
      expect(response.status).toBe(401)
    })
  })
})