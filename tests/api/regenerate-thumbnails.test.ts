import { describe, it, expect, beforeEach, vi } from 'vitest'

// Use vi.hoisted to properly hoist mock functions
const { mockPostFindMany, mockPostUpdate, fsMock, sharpMockFn, sharpState } = vi.hoisted(() => {
  // Create shared mock instances so both `default.promises.X` and `promises.X`
  // reference the same vi.fn() instances regardless of import style.
  const access = vi.fn()
  const readFile = vi.fn()
  const writeFile = vi.fn()
  const fsMock = { access, readFile, writeFile }

  // Sharp stateful mock:
  // - The FIRST sharp() call of each test returns a large buffer (40KB)
  //   to trigger the quality-reduction recursion in generateThumbnailFromBuffer
  // - Subsequent calls return a small buffer (100 bytes) so recursion exits
  const sharpState = { callCount: 0 }
  const sharpMockFn = vi.fn().mockImplementation(() => {
    sharpState.callCount++
    return {
      resize: vi.fn().mockReturnThis(),
      webp: vi.fn().mockReturnThis(),
      toBuffer: vi.fn().mockImplementation(() => {
        // The very first sharp() invocation per test gets a 40KB buffer
        if (sharpState.callCount === 1) {
          return Promise.resolve(Buffer.alloc(40 * 1024))
        }
        return Promise.resolve(Buffer.alloc(100))
      }),
    }
  })

  return {
    mockPostFindMany: vi.fn(),
    mockPostUpdate: vi.fn(),
    fsMock,
    sharpMockFn,
    sharpState,
  }
})

// Mock prisma module
vi.mock('@/lib/prisma', () => ({
  default: {
    post: {
      findMany: mockPostFindMany,
      update: mockPostUpdate,
    },
  },
}))

// Mock auth
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

// Mock fs with SHARED vi.fn instances across default.promises and promises
vi.mock('fs', () => ({
  default: { promises: fsMock },
  promises: fsMock,
}))

// Mock sharp
vi.mock('sharp', () => ({
  default: sharpMockFn,
}))

import { POST } from '@/app/api/maintenance/regenerate-thumbnails/route'
import { auth } from '@/lib/auth'
import { promises as fs } from 'fs'

describe('Regenerate Thumbnails API', () => {
  const mockSession = {
    user: { id: 'user-123', name: 'testuser' },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession)
    // Reset sharp call counter
    sharpState.callCount = 0
  })

  describe('POST /api/maintenance/regenerate-thumbnails', () => {
    it('should process posts with mediaUrls', async () => {
      // Mock posts with media
      mockPostFindMany.mockResolvedValue([
        {
          id: 'post-1',
          mediaUrls: '["/api/uploads/2024-01-01/image.jpg"]',
        },
        {
          id: 'post-2',
          mediaUrls: '["/api/uploads/2024-01-01/image2.png"]',
        },
      ])

      // Mock fs.access to return success (file exists) - all thumb files exist
      fsMock.access.mockResolvedValue(undefined)

      // Mock fs.readFile
      fsMock.readFile.mockResolvedValue(Buffer.from('mock image data'))

      // Mock fs.writeFile
      fsMock.writeFile.mockResolvedValue(undefined)

      // Mock post update
      mockPostUpdate.mockResolvedValue({ id: 'post-1' })

      const response = await POST()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.processed).toBeGreaterThanOrEqual(0)
      expect(data.message).toBeDefined()
    })

    it('should skip posts with empty mediaUrls', async () => {
      mockPostFindMany.mockResolvedValue([
        { id: 'post-1', mediaUrls: '[]' },
        { id: 'post-2', mediaUrls: null },
      ])

      const response = await POST()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should skip thumbnails that already exist', async () => {
      mockPostFindMany.mockResolvedValue([
        {
          id: 'post-1',
          mediaUrls: '["/api/uploads/2024-01-01/image.jpg"]',
        },
      ])

      // All fs.access calls succeed (thumbnails exist)
      fsMock.access.mockResolvedValue(undefined)

      const response = await POST()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.skipped).toBeGreaterThanOrEqual(0)
    })

    it('should return 401 when not authenticated', async () => {
      ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue(null)

      const response = await POST()
      expect(response.status).toBe(401)
    })

    it('should handle invalid JSON in mediaUrls', async () => {
      mockPostFindMany.mockResolvedValue([
        { id: 'post-1', mediaUrls: 'invalid json' },
      ])

      const response = await POST()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should update database with thumbnail URLs after processing', async () => {
      mockPostFindMany.mockResolvedValue([
        {
          id: 'post-1',
          mediaUrls: '["/api/uploads/2024-01-01/image.jpg"]',
        },
      ])

      // Thumbnail doesn't exist
      fsMock.access.mockRejectedValueOnce(new Error('Thumb not found'))
      // Original file exists
      fsMock.access.mockResolvedValueOnce(undefined)

      fsMock.readFile.mockResolvedValue(Buffer.from('image'))
      fsMock.writeFile.mockResolvedValue(undefined)
      mockPostUpdate.mockResolvedValue({ id: 'post-1' })

      const response = await POST()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockPostUpdate).toHaveBeenCalled()
      expect(data.processed).toBe(1)
    })

    it('should handle /uploads/ (without /api/ prefix) URL format', async () => {
      mockPostFindMany.mockResolvedValue([
        {
          id: 'post-1',
          mediaUrls: '["/uploads/2024-01-01/image.jpg"]',
        },
      ])

      // Thumbnail doesn't exist, original file exists
      fsMock.access
        .mockRejectedValueOnce(new Error('Thumb not found'))
        .mockResolvedValueOnce(undefined)

      fsMock.readFile.mockResolvedValue(Buffer.from('img'))
      fsMock.writeFile.mockResolvedValue(undefined)
      mockPostUpdate.mockResolvedValue({ id: 'post-1' })

      const response = await POST()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.processed).toBe(1)
    })

    it('should handle full URL with /api/uploads/ in path', async () => {
      mockPostFindMany.mockResolvedValue([
        {
          id: 'post-1',
          mediaUrls: '["https://example.com/api/uploads/2024-01-01/image.jpg"]',
        },
      ])

      fsMock.access
        .mockRejectedValueOnce(new Error('Thumb not found'))
        .mockResolvedValueOnce(undefined)

      fsMock.readFile.mockResolvedValue(Buffer.from('img'))
      fsMock.writeFile.mockResolvedValue(undefined)
      mockPostUpdate.mockResolvedValue({ id: 'post-1' })

      const response = await POST()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.processed).toBe(1)
    })

    it('should mark as failed when URL is in unknown format (getFilePath returns null)', async () => {
      mockPostFindMany.mockResolvedValue([
        {
          id: 'post-1',
          // URL that doesn't match any known format -> getFilePath returns null
          mediaUrls: '["https://example.com/random/image.jpg"]',
        },
      ])

      const response = await POST()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.failed).toBe(1)
    })

    it('should mark as failed when original file does not exist', async () => {
      mockPostFindMany.mockResolvedValue([
        {
          id: 'post-1',
          mediaUrls: '["/api/uploads/2024-01-01/missing.jpg"]',
        },
      ])

      // Thumbnail doesn't exist + original file doesn't exist
      fsMock.access.mockRejectedValue(new Error('Not found'))

      const response = await POST()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.failed).toBe(1)
    })

    it('should trigger thumbnail quality reduction when buffer is too large', async () => {
      mockPostFindMany.mockResolvedValue([
        {
          id: 'post-1',
          mediaUrls: '["/api/uploads/2024-01-01/large.jpg"]',
        },
      ])

      // Thumbnail doesn't exist, original file exists
      fsMock.access
        .mockRejectedValueOnce(new Error('Thumb not found'))
        .mockResolvedValueOnce(undefined)

      fsMock.readFile.mockResolvedValue(Buffer.from('img'))
      fsMock.writeFile.mockResolvedValue(undefined)
      mockPostUpdate.mockResolvedValue({ id: 'post-1' })

      const response = await POST()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.processed).toBe(1)
      // sharp should be called multiple times due to recursive quality reduction
      // (1st call returns 40KB -> triggers recursion -> 2nd call returns 100 bytes)
      expect(sharpMockFn.mock.calls.length).toBeGreaterThanOrEqual(2)
    })

    it('should handle error during file read', async () => {
      mockPostFindMany.mockResolvedValue([
        {
          id: 'post-1',
          mediaUrls: '["/api/uploads/2024-01-01/broken.jpg"]',
        },
      ])

      // Thumbnail doesn't exist, original file exists
      fsMock.access
        .mockRejectedValueOnce(new Error('Thumb not found'))
        .mockResolvedValueOnce(undefined)

      // readFile throws
      fsMock.readFile.mockRejectedValue(new Error('Read failed'))

      const response = await POST()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.failed).toBe(1)
    })

    it('should return 500 when an unexpected error occurs', async () => {
      mockPostFindMany.mockRejectedValue(new Error('Database connection lost'))

      const response = await POST()
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('服务器错误')
    })

    it('should not update DB when thumbnailMap is empty for a post', async () => {
      mockPostFindMany.mockResolvedValue([
        {
          id: 'post-1',
          // Unsupported URL format -> getFilePath returns null, thumbnailMap stays empty
          mediaUrls: '["unsupported://url/format.jpg"]',
        },
      ])

      const response = await POST()
      const data = await response.json()

      expect(response.status).toBe(200)
      // No post update should happen because thumbnailMap was empty
      expect(mockPostUpdate).not.toHaveBeenCalled()
      expect(data.failed).toBe(1)
    })

    it('should handle mixed valid and invalid mediaUrls within a post', async () => {
      mockPostFindMany.mockResolvedValue([
        {
          id: 'post-1',
          mediaUrls: JSON.stringify([
            '/api/uploads/2024-01-01/valid.jpg',
            'https://other.com/random.jpg', // invalid format
          ]),
        },
      ])

      fsMock.access
        .mockRejectedValueOnce(new Error('Thumb not found')) // For valid one
        .mockResolvedValueOnce(undefined) // Original exists

      fsMock.readFile.mockResolvedValue(Buffer.from('img'))
      fsMock.writeFile.mockResolvedValue(undefined)
      mockPostUpdate.mockResolvedValue({ id: 'post-1' })

      const response = await POST()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.processed).toBe(1)
      expect(data.failed).toBe(1)
    })
  })
})
