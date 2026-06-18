/**
 * Tests for src/lib/storage/r2.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('uuid', () => ({ v4: () => 'mocked-uuid-123' }))

import { R2StorageEngine } from '@/lib/storage/r2'

describe('R2StorageEngine', () => {
  let mockBucket: { put: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn>; head: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    mockBucket = {
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      head: vi.fn().mockResolvedValue({ httpMetadata: { contentType: 'image/jpeg' } }),
    }
  })

  it('should upload file to R2 bucket', async () => {
    const engine = new R2StorageEngine(mockBucket as unknown as R2Bucket, 'test-bucket')
    const buffer = Buffer.from('fake file data')
    const url = await engine.upload(buffer, 'test.jpg', 'image/jpeg')
    expect(url).toContain('uploads/')
    expect(mockBucket.put).toHaveBeenCalled()
  })

  it('should delete file from R2 bucket', async () => {
    const engine = new R2StorageEngine(mockBucket as unknown as R2Bucket, 'test-bucket')
    // Pass a full R2 URL so getKeyFromUrl can extract the key
    await engine.delete('https://pub-test-bucket.r2.dev/uploads/2024-01-01/mock-file.jpg')
    expect(mockBucket.delete).toHaveBeenCalledWith('uploads/2024-01-01/mock-file.jpg')
  })

  it('should return correct URL', () => {
    const engine = new R2StorageEngine(mockBucket as unknown as R2Bucket, 'test-bucket')
    const url = engine.getUrl('uploads/2024-01-01/mock-file.jpg')
    expect(url).toContain('uploads/2024-01-01/mock-file.jpg')
  })
})
