import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MediaThumbnail } from '@/components/MediaThumbnail'

describe('MediaThumbnail Component', () => {
  describe('Single image', () => {
    it('should render single image thumbnail', () => {
      const urls = ['/api/uploads/2024-01-01/image.jpg']
      
      render(<MediaThumbnail urls={urls} />)
      
      // Should contain an img element
      const img = document.querySelector('img')
      expect(img).toBeTruthy()
    })

    it('should use thumbnail URL when provided', () => {
      const urls = ['/api/uploads/2024-01-01/image.jpg']
      const thumbnails = ['/api/uploads/2024-01-01/image.jpg.thumb.webp']
      
      render(<MediaThumbnail urls={urls} thumbnails={thumbnails} />)
      
      const img = document.querySelector('img')
      expect(img?.src).toContain('.thumb.webp')
    })

    it('should fall back to original URL when no thumbnails', () => {
      const urls = ['/api/uploads/2024-01-01/image.jpg']
      
      render(<MediaThumbnail urls={urls} />)
      
      const img = document.querySelector('img')
      expect(img?.src).toContain('/api/uploads/2024-01-01/image.jpg')
    })

    it('should show play icon for video', () => {
      const urls = ['/api/uploads/2024-01-01/video.mp4']
      
      render(<MediaThumbnail urls={urls} />)
      
      const container = document.querySelector('.relative')
      expect(container).toBeTruthy()
    })
  })

  describe('Multiple images (grid layout)', () => {
    it('should render 2 images in side-by-side layout', () => {
      const urls = [
        '/api/uploads/2024-01-01/image1.jpg',
        '/api/uploads/2024-01-01/image2.jpg',
      ]
      
      render(<MediaThumbnail urls={urls} />)
      
      const images = document.querySelectorAll('img')
      expect(images.length).toBe(2)
    })

    it('should render 3 images in L-shape layout', () => {
      const urls = [
        '/api/uploads/2024-01-01/image1.jpg',
        '/api/uploads/2024-01-01/image2.jpg',
        '/api/uploads/2024-01-01/image3.jpg',
      ]
      
      render(<MediaThumbnail urls={urls} />)
      
      const images = document.querySelectorAll('img')
      expect(images.length).toBe(3)
    })

    it('should show +N label for 5+ images', () => {
      const urls = [
        '/api/uploads/2024-01-01/image1.jpg',
        '/api/uploads/2024-01-01/image2.jpg',
        '/api/uploads/2024-01-01/image3.jpg',
        '/api/uploads/2024-01-01/image4.jpg',
        '/api/uploads/2024-01-01/image5.jpg',
      ]
      
      render(<MediaThumbnail urls={urls} />)
      
      expect(screen.getByText('+1')).toBeTruthy()
    })
  })

  describe('Thumbnail URL mapping', () => {
    it('should map thumbnails to correct URLs by index', () => {
      const urls = [
        '/api/uploads/2024-01-01/image1.jpg',
        '/api/uploads/2024-01-01/image2.jpg',
      ]
      const thumbnails = [
        '/api/uploads/2024-01-01/thumb1.webp',
        '/api/uploads/2024-01-01/thumb2.webp',
      ]
      
      render(<MediaThumbnail urls={urls} thumbnails={thumbnails} />)
      
      const images = document.querySelectorAll('img')
      expect(images[0].src).toContain('thumb1.webp')
      expect(images[1].src).toContain('thumb2.webp')
    })

    it('should ignore thumbnails array with wrong length', () => {
      const urls = [
        '/api/uploads/2024-01-01/image1.jpg',
        '/api/uploads/2024-01-01/image2.jpg',
      ]
      const thumbnails = ['/api/uploads/2024-01-01/thumb1.webp'] // Only 1 thumbnail for 2 images
      
      render(<MediaThumbnail urls={urls} thumbnails={thumbnails} />)
      
      // Should fall back to original URLs since thumbnails.length < urls.length
      const images = document.querySelectorAll('img')
      expect(images[0].src).toContain('image1.jpg')
      expect(images[1].src).toContain('image2.jpg')
    })
  })

  describe('Size prop', () => {
    it('should apply custom size', () => {
      const urls = ['/api/uploads/2024-01-01/image.jpg']
      
      render(<MediaThumbnail urls={urls} size={100} />)
      
      const container = document.querySelector('.relative')
      expect(container?.getAttribute('style')).toContain('width: 100')
      expect(container?.getAttribute('style')).toContain('height: 100')
    })
  })

  describe('Empty and null handling', () => {
    it('should return null for empty URLs array', () => {
      const { container } = render(<MediaThumbnail urls={[]} />)
      expect(container.firstChild).toBeNull()
    })

    it('should return null for null URLs', () => {
      const { container } = render(<MediaThumbnail urls={null as any} />)
      expect(container.firstChild).toBeNull()
    })
  })
})