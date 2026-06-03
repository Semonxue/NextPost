import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MediaPreview, isVideoSource } from '@/components/MediaPreview'

// 创建可控制的视频 mock
class MockVideoElement {
  public src = ''
  public currentTime = 0
  public duration = 10
  public videoWidth = 320
  public videoHeight = 240
  public crossOrigin = ''
  public muted = false
  public playsInline = false
  public preload = ''
  private listeners: Record<string, Array<() => void>> = {}

  setAttribute(name: string, value: string) {
    ;(this as any)[name] = value
  }
  removeAttribute(_name: string) {
    /* noop */
  }
  addEventListener(event: string, cb: () => void) {
    if (!this.listeners[event]) this.listeners[event] = []
    this.listeners[event].push(cb)
  }
  removeEventListener(event: string, cb: () => void) {
    if (!this.listeners[event]) return
    this.listeners[event] = this.listeners[event].filter((c) => c !== cb)
  }
  load() {
    /* noop */
  }
  // 触发事件
  _fire(event: string) {
    const list = this.listeners[event] || []
    list.forEach((cb) => cb())
  }
}

// 创建可控制的 canvas mock
class MockCanvas {
  public width = 0
  public height = 0
  private context: MockCanvasContext

  constructor() {
    this.context = new MockCanvasContext()
  }
  getContext(_type: string) {
    return this.context
  }
  toDataURL(_type?: string, _quality?: number) {
    return 'data:image/jpeg;base64,mock-canvas-data'
  }
}

class MockCanvasContext {
  drawImage(_img: unknown, _x: number, _y: number, _w: number, _h: number) {
    /* noop */
  }
}

describe('isVideoSource helper', () => {
  it('returns true when type is "video"', () => {
    expect(isVideoSource('anything', 'video')).toBe(true)
  })

  it('returns false when type is "image"', () => {
    expect(isVideoSource('video.mp4', 'image')).toBe(false)
  })

  it('returns false for empty src without type', () => {
    expect(isVideoSource('')).toBe(false)
  })

  it('returns true for data URL with video mime type', () => {
    expect(isVideoSource('data:video/mp4;base64,abc123')).toBe(true)
  })

  it('returns false for data URL with image mime type', () => {
    expect(isVideoSource('data:image/png;base64,abc123')).toBe(false)
  })

  it('returns false for data URL with non-video mime type', () => {
    expect(isVideoSource('data:application/octet-stream;base64,abc')).toBe(false)
  })

  it('returns true for http URL with video extension', () => {
    expect(isVideoSource('https://example.com/video.mp4')).toBe(true)
  })

  it('returns true for relative path with video extension', () => {
    expect(isVideoSource('/uploads/clip.webm')).toBe(true)
  })

  it('returns false for URL with image extension', () => {
    expect(isVideoSource('https://example.com/image.jpg')).toBe(false)
  })

  it('returns true for mov extension', () => {
    expect(isVideoSource('https://example.com/file.mov')).toBe(true)
  })

  it('returns true for ogg extension', () => {
    expect(isVideoSource('https://example.com/file.ogg')).toBe(true)
  })
})

describe('MediaPreview Component', () => {
  let originalCreateElement: typeof document.createElement
  let lastVideo: MockVideoElement | null = null

  beforeEach(() => {
    lastVideo = null
    originalCreateElement = document.createElement.bind(document)

    // mock createElement
    document.createElement = function (tag: string): any {
      if (tag === 'video') {
        lastVideo = new MockVideoElement()
        return lastVideo
      }
      if (tag === 'canvas') {
        return new MockCanvas()
      }
      return originalCreateElement(tag)
    } as typeof document.createElement
  })

  afterEach(() => {
    document.createElement = originalCreateElement
  })

  describe('Empty src', () => {
    it('renders default fallback when src is empty', () => {
      const { container } = render(<MediaPreview src="" />)
      // Should render the container
      expect(container.firstChild).toBeTruthy()
    })

    it('renders custom fallback when src is empty', () => {
      render(
        <MediaPreview
          src=""
          fallback={<div data-testid="custom-fallback">No Media</div>}
        />
      )
      expect(screen.getByTestId('custom-fallback')).toBeTruthy()
    })

    it('renders custom fallback when src is undefined', () => {
      render(
        <MediaPreview
          src={undefined}
          fallback={<div data-testid="custom-fallback">No Media</div>}
        />
      )
      expect(screen.getByTestId('custom-fallback')).toBeTruthy()
    })
  })

  describe('Image rendering', () => {
    it('renders image element for image URL', () => {
      const { container } = render(
        <MediaPreview src="https://example.com/image.jpg" alt="test" />
      )
      const img = container.querySelector('img')
      expect(img).toBeTruthy()
      expect(img?.getAttribute('alt')).toBe('test')
      expect(img?.getAttribute('src')).toBe('https://example.com/image.jpg')
    })

    it('forces image when type="image" even with video URL', () => {
      const { container } = render(
        <MediaPreview src="https://example.com/video.mp4" type="image" />
      )
      const img = container.querySelector('img')
      expect(img).toBeTruthy()
    })

    it('applies custom imgClassName', () => {
      const { container } = render(
        <MediaPreview
          src="https://example.com/image.jpg"
          imgClassName="custom-img-class"
        />
      )
      const img = container.querySelector('img')
      expect(img?.className).toContain('custom-img-class')
    })

    it('applies fill=false for inline-block display', () => {
      const { container } = render(
        <MediaPreview
          src="https://example.com/image.jpg"
          fill={false}
          className="custom"
        />
      )
      const wrapper = container.firstChild as HTMLElement
      expect(wrapper.className).toContain('inline-block')
      expect(wrapper.className).toContain('custom')
    })

    it('applies fill=true for w-full h-full display', () => {
      const { container } = render(
        <MediaPreview
          src="https://example.com/image.jpg"
          fill={true}
          className="custom"
        />
      )
      const wrapper = container.firstChild as HTMLElement
      expect(wrapper.className).toContain('w-full')
      expect(wrapper.className).toContain('h-full')
    })
  })

  describe('Video rendering (VideoThumbnail)', () => {
    it('renders video element for video URL', () => {
      render(<MediaPreview src="https://example.com/video.mp4" />)
      // createElement should have been called for video
      expect(lastVideo).toBeTruthy()
    })

    it('forces video when type="video"', () => {
      render(
        <MediaPreview
          src="https://example.com/photo.jpg"
          type="video"
        />
      )
      expect(lastVideo).toBeTruthy()
    })

    it('sets crossOrigin, muted, playsInline, preload on video element', () => {
      render(<MediaPreview src="https://example.com/video.mp4" />)
      expect(lastVideo!.crossOrigin).toBe('anonymous')
      expect(lastVideo!.muted).toBe(true)
      expect(lastVideo!.playsInline).toBe(true)
      expect(lastVideo!.preload).toBe('metadata')
    })

    it('renders data:image URL directly without extraction', () => {
      const dataUrl = 'data:image/jpeg;base64,existingthumbnail'
      const { container } = render(
        <MediaPreview src={dataUrl} type="video" />
      )
      // Should not call createElement('video') for data:image URL
      expect(lastVideo).toBeNull()
      const img = container.querySelector('img')
      expect(img).toBeTruthy()
      expect(img?.getAttribute('src')).toBe(dataUrl)
    })

    it('shows play icon overlay for video', () => {
      const { container } = render(
        <MediaPreview src="https://example.com/video.mp4" />
      )
      // Play icon should be present (svg element)
      const svgs = container.querySelectorAll('svg')
      expect(svgs.length).toBeGreaterThan(0)
    })

    it('hides play icon when showPlayIcon=false', () => {
      const { container } = render(
        <MediaPreview
          src="https://example.com/video.mp4"
          showPlayIcon={false}
        />
      )
      // Play button container should not be present
      const playContainer = container.querySelector('.pointer-events-none')
      expect(playContainer).toBeNull()
    })

    it('shows play icon in error state when showPlayIcon=true', async () => {
      render(<MediaPreview src="https://example.com/video.mp4" />)
      // Simulate video error
      await act(async () => {
        lastVideo!._fire('error')
      })
      // Error should be set, then show fallback with play icon
      await waitFor(() => {
        const playContainer = document.querySelector('.pointer-events-none')
        expect(playContainer).toBeTruthy()
      })
    })

    it('calls onThumbnailError when video fails', async () => {
      const onError = vi.fn()
      render(
        <MediaPreview
          src="https://example.com/video.mp4"
          onThumbnailError={onError}
        />
      )
      await act(async () => {
        lastVideo!._fire('error')
      })
      await waitFor(() => {
        expect(onError).toHaveBeenCalled()
      })
    })

    it('shows custom fallback in error state', async () => {
      render(
        <MediaPreview
          src="https://example.com/video.mp4"
          fallback={<div data-testid="error-fallback">Failed</div>}
        />
      )
      await act(async () => {
        lastVideo!._fire('error')
      })
      await waitFor(() => {
        expect(screen.getByTestId('error-fallback')).toBeTruthy()
      })
    })

    it('extracts frame when video loads and seeks', async () => {
      render(<MediaPreview src="https://example.com/video.mp4" />)
      // Simulate video loaded
      await act(async () => {
        lastVideo!._fire('loadeddata')
      })
      // After loadeddata, currentTime is set
      expect(lastVideo!.currentTime).toBeGreaterThan(0)
      // Simulate seeked
      await act(async () => {
        lastVideo!._fire('seeked')
      })
      // After seeked, a thumbnail should be set
      await waitFor(() => {
        const img = document.querySelector('img')
        expect(img?.getAttribute('src')).toContain('data:image')
      })
    })

    it('handles video without width/height', async () => {
      render(<MediaPreview src="https://example.com/video.mp4" />)
      await act(async () => {
        lastVideo!.videoWidth = 0
        lastVideo!.videoHeight = 0
        lastVideo!._fire('loadeddata')
      })
      await act(async () => {
        lastVideo!._fire('seeked')
      })
      await waitFor(() => {
        const img = document.querySelector('img')
        expect(img).toBeTruthy()
      })
    })

    it('handles square video (width = height)', async () => {
      render(<MediaPreview src="https://example.com/video.mp4" />)
      await act(async () => {
        lastVideo!.videoWidth = 100
        lastVideo!.videoHeight = 100
        lastVideo!._fire('loadeddata')
      })
      await act(async () => {
        lastVideo!._fire('seeked')
      })
      await waitFor(() => {
        const img = document.querySelector('img')
        expect(img).toBeTruthy()
      })
    })

    it('handles video taller than wide', async () => {
      render(<MediaPreview src="https://example.com/video.mp4" />)
      await act(async () => {
        lastVideo!.videoWidth = 100
        lastVideo!.videoHeight = 500
        lastVideo!._fire('loadeddata')
      })
      await act(async () => {
        lastVideo!._fire('seeked')
      })
      await waitFor(() => {
        const img = document.querySelector('img')
        expect(img).toBeTruthy()
      })
    })

    it('uses Math.min(0.1, duration/2) for current time', async () => {
      // The component uses Math.min(0.1, duration/2) so it always caps at 0.1
      render(<MediaPreview src="https://example.com/video.mp4" />)
      await act(async () => {
        lastVideo!.duration = 10 // long video, target = min(0.1, 5) = 0.1
        lastVideo!._fire('loadeddata')
      })
      expect(lastVideo!.currentTime).toBe(0.1)
    })

    it('falls back to 0.1 when duration is 0', async () => {
      render(<MediaPreview src="https://example.com/video.mp4" />)
      await act(async () => {
        lastVideo!.duration = 0
        lastVideo!._fire('loadeddata')
      })
      // duration || 0 = 0, then 0/2 || 0.1 = 0.1, min(0.1, 0.1) = 0.1
      expect(lastVideo!.currentTime).toBe(0.1)
    })

    it('cleans up on unmount', () => {
      const { unmount } = render(<MediaPreview src="https://example.com/video.mp4" />)
      expect(lastVideo).toBeTruthy()
      unmount()
      // After unmount, video.src should be removed (load() called)
      // We can't easily verify this, but the unmount should not throw
    })
  })
})
