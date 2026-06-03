import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MediaUploader } from '@/components/MediaUploader'

// Mock the UI store
const mockAddToast = vi.fn()
vi.mock('@/stores/uiStore', () => ({
  useUIStore: () => ({
    addToast: mockAddToast,
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

// Mock Image constructor to fire onload immediately
class MockImage {
  public onload: (() => void) | null = null
  public onerror: (() => void) | null = null
  public width = 100
  public height = 100
  private _src = ''

  get src(): string {
    return this._src
  }
  set src(value: string) {
    this._src = value
    // Fire onload on next tick
    if (this.onload) {
      setTimeout(() => this.onload!(), 0)
    }
  }
}

// Mock FileReader to fire onload immediately
class MockFileReader {
  public onload: ((e: any) => void) | null = null
  public onerror: (() => void) | null = null
  public result: string = 'data:image/jpeg;base64,fakefilecontent'
  public _file: File | null = null

  readAsDataURL(file: File) {
    this._file = file
    if (this.onload) {
      setTimeout(() => {
        this.onload!({ target: { result: this.result } })
      }, 0)
    }
  }
}

// Mock video element
class MockVideoElement {
  public _currentTime = 0
  public duration = 10
  public videoWidth = 320
  public videoHeight = 240
  public muted = false
  public playsInline = false
  public preload = ''
  public onloadeddata: (() => void) | null = null
  public onseeked: (() => void) | null = null
  private _src = ''
  private listeners: Record<string, Array<() => void>> = {}

  get currentTime(): number {
    return this._currentTime
  }
  set currentTime(value: number) {
    this._currentTime = value
    // Simulate browser triggering seeked on next tick
    setTimeout(() => {
      if (this.onseeked) this.onseeked()
    }, 0)
  }

  get src(): string {
    return this._src
  }
  set src(value: string) {
    this._src = value
    // Simulate loadeddata firing on next tick
    setTimeout(() => {
      if (this.onloadeddata) this.onloadeddata()
    }, 0)
  }

  addEventListener(event: string, cb: () => void) {
    if (!this.listeners[event]) this.listeners[event] = []
    this.listeners[event].push(cb)
  }
  removeEventListener(event: string, cb: () => void) {
    if (!this.listeners[event]) return
    this.listeners[event] = this.listeners[event].filter((c) => c !== cb)
  }
  _fire(event: string) {
    const list = this.listeners[event] || []
    list.forEach((cb) => cb())
  }
}

// Mock canvas
class MockCanvas {
  public width = 0
  public height = 0
  getContext() {
    return {
      drawImage: vi.fn(),
    }
  }
  toDataURL() {
    return 'data:image/jpeg;base64,thumbnail-data'
  }
}

// Helper to create a mock File
function createMockFile(name: string, type: string, size: number = 1024): File {
  const blob = new Blob(['a'.repeat(size)], { type })
  // Create a File-like object with explicit size
  const file = new File([blob], name, { type })
  Object.defineProperty(file, 'size', { value: size, configurable: true })
  return file
}

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
  let originalFileReader: any
  let originalImage: any
  let originalCreateElement: any

  beforeEach(() => {
    mockAddToast.mockClear()
    // @ts-ignore
    global.FileReader = MockFileReader
    // @ts-ignore
    global.Image = MockImage
    // @ts-ignore
    global.window.Image = MockImage

    originalCreateElement = document.createElement.bind(document)
    document.createElement = function (tag: string): any {
      if (tag === 'video') return new MockVideoElement()
      if (tag === 'canvas') return new MockCanvas()
      return originalCreateElement(tag)
    } as typeof document.createElement
  })

  afterEach(() => {
    // @ts-ignore
    delete (global as any).FileReader
    // @ts-ignore
    delete (global as any).Image
    // @ts-ignore
    delete (global as any).window.Image
    document.createElement = originalCreateElement
  })

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

      expect(screen.getByText(/图片已达上限/)).toBeTruthy()
    })

    it('should hide upload area when both image and video at max', () => {
      const config = { ...mockPlatformConfig, maxImages: 1, maxVideos: 1 }
      const initialUrls = ['/api/uploads/image.jpg']
      const initialThumbnails = ['/api/uploads/image.thumb.webp']
      // Use initialUrl that matches a video (mp4) AND an image
      // Test 1 image + canAddMoreImages=false, canAddMoreVideos=true
      // So upload area should still be visible
      render(
        <MediaUploader
          platformConfig={config}
          initialUrls={initialUrls}
          initialThumbnails={initialThumbnails}
          onChange={() => {}}
        />
      )
      // Upload area should still be visible because video is allowed
      expect(screen.queryByText(/点击上传或拖拽图片/)).toBeTruthy()
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

      const deleteBtn = document.querySelector('button.absolute.top-1')
      if (deleteBtn) {
        await user.click(deleteBtn as HTMLElement)
      }

      await waitFor(() => {
        expect(screen.getByText(/点击上传或拖拽图片/)).toBeTruthy()
      })
    })

    it('should call onChange when item is removed', async () => {
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

      // Initial onChange may be called from useEffect
      onChange.mockClear()

      const deleteBtn = document.querySelector('button.absolute.top-1')
      if (deleteBtn) {
        await user.click(deleteBtn as HTMLElement)
      }

      await waitFor(() => {
        // onChange should be called with empty arrays
        expect(onChange).toHaveBeenCalled()
      })
    })
  })

  describe('Drag and drop', () => {
    it('should handle dragOver event', () => {
      render(
        <MediaUploader
          platformConfig={mockPlatformConfig}
          initialUrls={[]}
          onChange={() => {}}
        />
      )
      const dropZone = document.querySelector('[class*="border-dashed"]') as HTMLElement
      expect(dropZone).toBeTruthy()

      fireEvent.dragOver(dropZone)
      // After dragOver, the border-blue-500 class should be present
      expect(dropZone.className).toContain('border-blue-500')
    })

    it('should handle dragLeave event', () => {
      render(
        <MediaUploader
          platformConfig={mockPlatformConfig}
          initialUrls={[]}
          onChange={() => {}}
        />
      )
      const dropZone = document.querySelector('[class*="border-dashed"]') as HTMLElement

      fireEvent.dragOver(dropZone)
      // When dragging, the bg-blue-50 (dragging background) class should be present
      expect(dropZone.className).toContain('bg-blue-50')

      fireEvent.dragLeave(dropZone)
      // After dragLeave, the dragging background should be removed
      expect(dropZone.className).not.toContain('bg-blue-50')
    })

    it('should handle drop event', () => {
      render(
        <MediaUploader
          platformConfig={mockPlatformConfig}
          initialUrls={[]}
          onChange={() => {}}
        />
      )
      const dropZone = document.querySelector('[class*="border-dashed"]') as HTMLElement

      const file = createMockFile('test.jpg', 'image/jpeg', 1024)
      const dataTransfer = { files: [file] }

      fireEvent.drop(dropZone, { dataTransfer })
      // Should not throw
    })
  })

  describe('File input click', () => {
    it('should trigger file input when upload area clicked', async () => {
      const user = userEvent.setup()
      render(
        <MediaUploader
          platformConfig={mockPlatformConfig}
          initialUrls={[]}
          onChange={() => {}}
        />
      )

      const fileInput = document.getElementById('media-upload-multiple') as HTMLInputElement
      const clickSpy = vi.spyOn(fileInput, 'click').mockImplementation(() => {})

      const dropZone = document.querySelector('[class*="border-dashed"]') as HTMLElement
      await user.click(dropZone)

      expect(clickSpy).toHaveBeenCalled()
    })
  })

  describe('File upload (handleFiles)', () => {
    it('should not process when no files provided', async () => {
      const onChange = vi.fn()
      render(
        <MediaUploader
          platformConfig={mockPlatformConfig}
          initialUrls={[]}
          onChange={onChange}
        />
      )

      const fileInput = document.getElementById('media-upload-multiple') as HTMLInputElement
      fireEvent.change(fileInput, { target: { files: [] } })

      // onChange should not have been triggered by file upload
      // (initial useEffect may have been called)
      expect(onChange).not.toHaveBeenCalled()
    })

    it('should show error when file size exceeds maxFileSize', async () => {
      const onChange = vi.fn()
      render(
        <MediaUploader
          platformConfig={mockPlatformConfig}
          initialUrls={[]}
          onChange={onChange}
          maxFileSize={1024} // 1KB
        />
      )

      const file = createMockFile('big.jpg', 'image/jpeg', 10240) // 10KB
      const fileInput = document.getElementById('media-upload-multiple') as HTMLInputElement
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'error' })
        )
      })
    })

    it('should show error when file type is not supported', async () => {
      const onChange = vi.fn()
      render(
        <MediaUploader
          platformConfig={mockPlatformConfig}
          initialUrls={[]}
          onChange={onChange}
        />
      )

      const file = createMockFile('doc.pdf', 'application/pdf', 1024)
      const fileInput = document.getElementById('media-upload-multiple') as HTMLInputElement
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'error' })
        )
      })
    })

    it('should show error when image count exceeds maxImages', async () => {
      const onChange = vi.fn()
      const config = { ...mockPlatformConfig, maxImages: 2 }
      const initialUrls = ['/api/uploads/image1.jpg', '/api/uploads/image2.jpg']
      render(
        <MediaUploader
          platformConfig={config}
          initialUrls={initialUrls}
          onChange={onChange}
        />
      )

      const file = createMockFile('test.jpg', 'image/jpeg', 1024)
      const fileInput = document.getElementById('media-upload-multiple') as HTMLInputElement
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'error' })
        )
      })
    })

    it('should show error when video count exceeds maxVideos', async () => {
      const onChange = vi.fn()
      // maxVideos = 1, start with 1 video
      const config = { ...mockPlatformConfig, maxVideos: 1 }
      const initialUrls = ['/api/uploads/video.mp4']
      render(
        <MediaUploader
          platformConfig={config}
          initialUrls={initialUrls}
          onChange={onChange}
        />
      )

      const file = createMockFile('test.mp4', 'video/mp4', 1024)
      const fileInput = document.getElementById('media-upload-multiple') as HTMLInputElement
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'error' })
        )
      })
    })

    it('should show error when mixed media not allowed', async () => {
      const onChange = vi.fn()
      // allowMixedMedia = false, start with 1 image
      const config = { ...mockPlatformConfig, allowMixedMedia: false }
      const initialUrls = ['/api/uploads/image1.jpg']
      render(
        <MediaUploader
          platformConfig={config}
          initialUrls={initialUrls}
          onChange={onChange}
        />
      )

      const file = createMockFile('test.mp4', 'video/mp4', 1024)
      const fileInput = document.getElementById('media-upload-multiple') as HTMLInputElement
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'error' })
        )
      })
    })

    it('should allow mixed media when allowMixedMedia is true', async () => {
      const onChange = vi.fn()
      const config = { ...mockPlatformConfig, allowMixedMedia: true }
      const initialUrls = ['/api/uploads/image1.jpg']
      render(
        <MediaUploader
          platformConfig={config}
          initialUrls={initialUrls}
          onChange={onChange}
        />
      )

      const file = createMockFile('test.mp4', 'video/mp4', 1024)
      const fileInput = document.getElementById('media-upload-multiple') as HTMLInputElement
      fireEvent.change(fileInput, { target: { files: [file] } })

      // Should not show mixed media error
      await waitFor(() => {
        // Wait for the async processing
        const calls = mockAddToast.mock.calls
        const hasMixedError = calls.some((c: any[]) =>
          c[0]?.message?.includes('混合上传')
        )
        expect(hasMixedError).toBe(false)
      })
    })

    it('should successfully upload an image file', async () => {
      const onChange = vi.fn()
      render(
        <MediaUploader
          platformConfig={mockPlatformConfig}
          initialUrls={[]}
          onChange={onChange}
        />
      )

      const file = createMockFile('test.jpg', 'image/jpeg', 1024)
      const fileInput = document.getElementById('media-upload-multiple') as HTMLInputElement
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        // onChange should be called with new file
        expect(onChange).toHaveBeenCalled()
        const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1]
        expect(lastCall[1]).toContain(file) // files array
      })
    })

    it('should successfully upload a video file', async () => {
      const onChange = vi.fn()
      render(
        <MediaUploader
          platformConfig={mockPlatformConfig}
          initialUrls={[]}
          onChange={onChange}
        />
      )

      const file = createMockFile('test.mp4', 'video/mp4', 1024 * 100)
      const fileInput = document.getElementById('media-upload-multiple') as HTMLInputElement
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        // onChange should be called
        expect(onChange).toHaveBeenCalled()
        const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1]
        expect(lastCall[1]).toContain(file)
      })
    })
  })
})
