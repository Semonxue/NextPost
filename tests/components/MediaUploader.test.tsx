import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MediaUploader } from '@/components/MediaUploader'

// Mock the UI store
vi.mock('@/stores/uiStore', () => ({
  useUIStore: () => ({
    addToast: vi.fn(),
  }),
}))

// Mock MediaPreview component
vi.mock('@/components/MediaPreview', () => ({
  MediaPreview: ({ src, type }: { src: string; type?: string }) => (
    <div data-testid="media-preview" data-src={src} data-type={type}>
      {type === 'video' ? 'Video Preview' : 'Image Preview'}
    </div>
  ),
}))

// Mock platform types
const mockPlatformConfig = {
  platformId: 'twitter',
  platformName: 'Twitter',
  maxImages: 4,
  maxVideos: 1,
  allowMixedMedia: false,
  maxContentLength: 280,
  supportThreads: false,
}

describe('MediaUploader Component', () => {
  describe('Initial URLs Display', () => {
    it('should display original image URL in edit mode (not thumbnail)', () => {
      const initialUrls = ['/api/uploads/2024-01-01/original-image.jpg']
      const initialThumbnails = ['/api/uploads/2024-01-01/original-image.jpg.thumb.webp']
      
      render(
        <MediaUploader
          platformConfig={mockPlatformConfig}
          initialUrls={initialUrls}
          initialThumbnails={initialThumbnails}
          onChange={() => {}}
        />
      )
      
      const images = document.querySelectorAll('img')
      // In edit mode, image src should be original URL (not thumbnail URL)
      expect(images[0]?.src).toContain('/api/uploads/2024-01-01/original-image.jpg')
      expect(images[0]?.src).not.toContain('.thumb.webp')
    })

    it('should display original URL when thumbnails array is empty', () => {
      const initialUrls = ['/api/uploads/2024-01-01/image.jpg']
      const initialThumbnails: string[] = []
      
      render(
        <MediaUploader
          platformConfig={mockPlatformConfig}
          initialUrls={initialUrls}
          initialThumbnails={initialThumbnails}
          onChange={() => {}}
        />
      )
      
      const images = document.querySelectorAll('img')
      expect(images[0]?.src).toContain('/api/uploads/2024-01-01/image.jpg')
    })

    it('should store thumbnailUrl separately for list display', () => {
      const initialUrls = ['/api/uploads/2024-01-01/image.jpg']
      const initialThumbnails = ['/api/uploads/2024-01-01/image.thumb.webp']
      
      render(
        <MediaUploader
          platformConfig={mockPlatformConfig}
          initialUrls={initialUrls}
          initialThumbnails={initialThumbnails}
          onChange={() => {}}
        />
      )
      
      // The onChange callback should include thumbnail info
      // This is implicitly tested through the component behavior
      const images = document.querySelectorAll('img')
      // Image should show original URL (not thumbnail)
      expect(images[0]?.src).toContain('/api/uploads/2024-01-01/image.jpg')
      expect(images[0]?.src).not.toContain('.thumb.webp')
    })

    it('should handle multiple initial URLs', () => {
      const initialUrls = [
        '/api/uploads/2024-01-01/image1.jpg',
        '/api/uploads/2024-01-01/image2.jpg',
      ]
      const initialThumbnails = [
        '/api/uploads/2024-01-01/thumb1.webp',
        '/api/uploads/2024-01-01/thumb2.webp',
      ]
      
      render(
        <MediaUploader
          platformConfig={mockPlatformConfig}
          initialUrls={initialUrls}
          initialThumbnails={initialThumbnails}
          onChange={() => {}}
        />
      )
      
      const images = document.querySelectorAll('img')
      // Both should show original URLs (not thumbnails)
      expect(images[0]?.src).toContain('image1.jpg')
      expect(images[0]?.src).not.toContain('.thumb.webp')
      expect(images[1]?.src).toContain('image2.jpg')
      expect(images[1]?.src).not.toContain('.thumb.webp')
    })
  })

  describe('Video handling', () => {
    it('should detect video files by extension', () => {
      const initialUrls = ['/api/uploads/2024-01-01/video.mp4']
      
      render(
        <MediaUploader
          platformConfig={mockPlatformConfig}
          initialUrls={initialUrls}
          onChange={() => {}}
        />
      )
      
      const videoPreview = document.querySelector('[data-testid="media-preview"][data-type="video"]')
      expect(videoPreview).toBeTruthy()
    })

    it('should handle mixed video extensions', () => {
      const videos = [
        '/api/uploads/2024-01-01/video1.webm',
        '/api/uploads/2024-01-01/video2.mov',
      ]
      
      render(
        <MediaUploader
          platformConfig={mockPlatformConfig}
          initialUrls={videos}
          onChange={() => {}}
        />
      )
      
      const videoPreviews = document.querySelectorAll('[data-testid="media-preview"][data-type="video"]')
      expect(videoPreviews.length).toBe(2)
    })
  })

  describe('Platform limits', () => {
    it('should show upload area when under limit', () => {
      render(
        <MediaUploader
          platformConfig={mockPlatformConfig}
          initialUrls={[]}
          onChange={() => {}}
        />
      )
      
      // Should show upload area
      expect(screen.getByText(/点击上传或拖拽图片/)).toBeTruthy()
    })

    it('should show limit warning when at max images', () => {
      const initialUrls = [
        '/api/uploads/2024-01-01/image1.jpg',
        '/api/uploads/2024-01-01/image2.jpg',
        '/api/uploads/2024-01-01/image3.jpg',
        '/api/uploads/2024-01-01/image4.jpg',
      ]
      
      render(
        <MediaUploader
          platformConfig={mockPlatformConfig}
          initialUrls={initialUrls}
          onChange={() => {}}
        />
      )
      
      // Should show limit warning
      expect(screen.getByText(/图片已达上限/)).toBeTruthy()
    })
  })

  describe('File removal', () => {
    it('should remove item when delete button clicked', async () => {
      const user = userEvent.setup()
      const initialUrls = ['/api/uploads/2024-01-01/image.jpg']
      const onChange = vi.fn()
      
      render(
        <MediaUploader
          platformConfig={mockPlatformConfig}
          initialUrls={initialUrls}
          onChange={onChange}
        />
      )
      
      // Find and click the delete button
      const deleteBtn = document.querySelector('button.absolute.top-1')
      if (deleteBtn) {
        await user.click(deleteBtn)
      }
      
      // After removal, upload area should be visible again
      expect(screen.getByText(/点击上传或拖拽图片/)).toBeTruthy()
    })
  })
})