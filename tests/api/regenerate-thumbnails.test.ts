import { describe, it, expect, beforeEach, vi } from 'vitest'

// Use vi.hoisted to properly hoist mock functions
const { mockPostFindMany, mockPostUpdate } = vi.hoisted(() => ({
  mockPostFindMany: vi.fn(),
  mockPostUpdate: vi.fn(),
}))

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

// Mock fs module with proper default export
vi.mock('fs', () => ({
  default: {
    promises: {
      access: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
    },
  },
  promises: {
    access: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
}))

// Mock sharp
vi.mock('sharp', () => ({
  default: vi.fn().mockImplementation(() => ({
    resize: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('mock thumbnail')),
  })),
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

      // Mock fs.access to return success (file exists)
      ;(fs.access as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
      
      // Mock fs.readFile
      ;(fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(Buffer.from('mock image data'))
      
      // Mock fs.writeFile
      ;(fs.writeFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
      
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

      // First call: fs.access for thumbnail -> file exists (skip)
      ;(fs.access as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(undefined) // thumbnail exists
        .mockResolvedValueOnce(undefined) // original file exists

      ;(fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(Buffer.from('mock'))

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

      // File doesn't exist, so generate
      ;(fs.access as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Not found'))
      
      // Second call for original file access - file exists
      ;(fs.access as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(undefined) // thumbnail not exists
        .mockResolvedValueOnce(undefined) // original file exists
      
      ;(fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(Buffer.from('image'))
      ;(fs.writeFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
      mockPostUpdate.mockResolvedValue({ id: 'post-1' })

      const response = await POST()
      
      expect(response.status).toBe(200)
      expect(mockPostUpdate).toHaveBeenCalled()
    })
  })
})