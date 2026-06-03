import { describe, it, expect, beforeEach, vi } from 'vitest'

// Use vi.hoisted to properly hoist mock functions
const { mockPostFindMany, mockPostCount, mockAccountFindMany, fsMock } = vi.hoisted(() => {
  // Shared fs mock instances
  const access = vi.fn()
  const readFile = vi.fn()
  const writeFile = vi.fn()
  const readdir = vi.fn()
  const stat = vi.fn()
  const fsMock = { access, readFile, writeFile, readdir, stat }

  return {
    mockPostFindMany: vi.fn(),
    mockPostCount: vi.fn(),
    mockAccountFindMany: vi.fn(),
    fsMock,
  }
})

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

// Mock fs with SHARED vi.fn instances
vi.mock('fs', () => ({
  default: { promises: fsMock },
  promises: fsMock,
}))

import { GET, formatBytes } from '@/app/api/stats/route'
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
      mockPostCount.mockResolvedValue(1)
      mockAccountFindMany.mockResolvedValue([
        { id: 'acc-1', name: 'Test Account', posts: [{ id: 'p1' }, { id: 'p2' }] },
      ])

      // Both scans return empty (no recursion)
      fsMock.readdir.mockResolvedValue([] as any)

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

      fsMock.readdir.mockResolvedValue([] as any)

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

    it('should return 500 when an unexpected error occurs', async () => {
      mockPostCount.mockRejectedValue(new Error('DB error'))

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('服务器错误')
    })

    it('should return account and post counts', async () => {
      // 6 count calls: accounts, posts, draft, scheduled, published, failed
      mockPostCount
        .mockResolvedValueOnce(3) // accounts
        .mockResolvedValueOnce(10) // posts
        .mockResolvedValueOnce(2) // draft
        .mockResolvedValueOnce(3) // scheduled
        .mockResolvedValueOnce(4) // published
        .mockResolvedValueOnce(1) // failed

      mockAccountFindMany.mockResolvedValue([
        { id: 'acc-1', name: 'Twitter', posts: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }, { id: 'p4' }, { id: 'p5' }] },
        { id: 'acc-2', name: 'Facebook', posts: [{ id: 'p6' }, { id: 'p7' }, { id: 'p8' }] },
      ])

      fsMock.readdir.mockResolvedValue([] as any)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.accounts).toBe(3)
      expect(data.posts).toBe(10)
      expect(data.postsByStatus.draft).toBe(2)
      expect(data.postsByStatus.scheduled).toBe(3)
      expect(data.postsByStatus.published).toBe(4)
      expect(data.postsByStatus.failed).toBe(1)
      expect(data.categories).toHaveLength(2)
      expect(data.categories[0].count).toBe(5)
      expect(data.categories[1].count).toBe(3)
    })

    it('should count thumbnails and skip non-thumbnail files', async () => {
      mockPostCount.mockResolvedValue(0)
      mockPostFindMany.mockResolvedValue([])
      mockAccountFindMany.mockResolvedValue([])

      // Only files (no subdirs) to avoid infinite recursion in test
      fsMock.readdir.mockResolvedValue([
        { name: 'thumb1.thumb.webp', isDirectory: () => false },
        { name: 'image1.jpg', isDirectory: () => false },
      ] as any)

      fsMock.stat.mockResolvedValue({ size: 1024 } as any)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      // 1 thumbnail counted
      expect(data.thumbnailStats.count).toBe(1)
      expect(data.thumbnailStats.size).toBe(1024)
    })

    it('should count media files (images and videos) excluding thumbnails', async () => {
      mockPostCount.mockResolvedValue(0)
      mockPostFindMany.mockResolvedValue([])
      mockAccountFindMany.mockResolvedValue([])

      fsMock.readdir.mockResolvedValue([
        { name: 'image.jpg', isDirectory: () => false },
        { name: 'image2.png', isDirectory: () => false },
        { name: 'image3.gif', isDirectory: () => false },
        { name: 'video.mp4', isDirectory: () => false },
        { name: 'video2.webm', isDirectory: () => false },
        { name: 'thumb.thumb.webp', isDirectory: () => false },
        { name: 'document.txt', isDirectory: () => false },
      ] as any)

      fsMock.stat.mockResolvedValue({ size: 1000 } as any)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.media).toBe(5) // 3 images + 2 videos
      expect(data.mediaStats.images.count).toBe(3)
      expect(data.mediaStats.videos.count).toBe(2)
      expect(data.mediaStats.images.size).toBe(3000)
      expect(data.mediaStats.videos.size).toBe(2000)
      expect(data.mediaStats.totalSize).toBe(5000)
    })

    it('should handle various image and video extensions', async () => {
      mockPostCount.mockResolvedValue(0)
      mockPostFindMany.mockResolvedValue([])
      mockAccountFindMany.mockResolvedValue([])

      fsMock.readdir.mockResolvedValue([
        { name: 'a.jpg', isDirectory: () => false },
        { name: 'b.jpeg', isDirectory: () => false },
        { name: 'c.png', isDirectory: () => false },
        { name: 'd.gif', isDirectory: () => false },
        { name: 'e.webp', isDirectory: () => false },
        { name: 'f.svg', isDirectory: () => false },
        { name: 'g.bmp', isDirectory: () => false },
        { name: 'h.ico', isDirectory: () => false },
        { name: 'v1.mp4', isDirectory: () => false },
        { name: 'v2.webm', isDirectory: () => false },
        { name: 'v3.mov', isDirectory: () => false },
        { name: 'v4.avi', isDirectory: () => false },
        { name: 'v5.mkv', isDirectory: () => false },
        { name: 'v6.flv', isDirectory: () => false },
        { name: 'v7.wmv', isDirectory: () => false },
      ] as any)

      fsMock.stat.mockResolvedValue({ size: 100 } as any)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.mediaStats.images.count).toBe(8)
      expect(data.mediaStats.videos.count).toBe(7)
    })

    it('should recursively scan subdirectories (with depth limit)', async () => {
      mockPostCount.mockResolvedValue(0)
      mockPostFindMany.mockResolvedValue([])
      mockAccountFindMany.mockResolvedValue([])

      // To avoid infinite recursion, we use mockImplementation that
      // returns different data based on call count:
      // - 1st call (thumb scan root): file + subdir
      // - 2nd call (thumb scan subdir): empty
      // - 3rd call (media scan root): file + subdir
      // - 4th call (media scan subdir): empty
      let readdirCount = 0
      fsMock.readdir.mockImplementation(() => {
        readdirCount++
        if (readdirCount === 1) {
          return Promise.resolve([
            { name: 'thumb1.thumb.webp', isDirectory: () => false },
            { name: 'subdir', isDirectory: () => true },
          ] as any)
        }
        if (readdirCount === 2) {
          return Promise.resolve([
            { name: 'thumb2.thumb.webp', isDirectory: () => false },
          ] as any)
        }
        if (readdirCount === 3) {
          return Promise.resolve([
            { name: 'image.jpg', isDirectory: () => false },
            { name: 'subdir', isDirectory: () => true },
          ] as any)
        }
        // 4th+ call: empty (terminate recursion)
        return Promise.resolve([] as any)
      })

      fsMock.stat.mockResolvedValue({ size: 512 } as any)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      // 2 thumbnails total (1 root + 1 subdir)
      expect(data.thumbnailStats.count).toBe(2)
      expect(data.thumbnailStats.size).toBe(1024)
      // 1 media file (image in root, subdir is empty)
      expect(data.media).toBe(1)
    })
  })

  describe('formatBytes', () => {
    it('should return "0 B" for 0 bytes', () => {
      expect(formatBytes(0)).toBe('0 B')
    })

    it('should format bytes (< 1KB)', () => {
      expect(formatBytes(500)).toBe('500 B')
    })

    it('should format kilobytes', () => {
      expect(formatBytes(1024)).toBe('1 KB')
    })

    it('should format megabytes', () => {
      expect(formatBytes(1024 * 1024)).toBe('1 MB')
    })

    it('should format gigabytes', () => {
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB')
    })

    it('should format with decimal precision', () => {
      const result = formatBytes(1536) // 1.5 KB
      expect(result).toBe('1.5 KB')
    })

    it('should format larger kilobyte values', () => {
      const result = formatBytes(1024 * 512) // 512 KB
      expect(result).toBe('512 KB')
    })
  })
})
