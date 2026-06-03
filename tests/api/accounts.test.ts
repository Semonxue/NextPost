import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Use vi.hoisted to properly hoist mock functions
const { mockFindMany, mockFindFirst, mockCreate, mockUpdate, mockDelete, mockFindUnique } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockFindFirst: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockFindUnique: vi.fn(),
}))

// Mock prisma module
vi.mock('@/lib/prisma', () => ({
  default: {
    account: {
      findMany: mockFindMany,
      findFirst: mockFindFirst,
      create: mockCreate,
      update: mockUpdate,
      delete: mockDelete,
    },
    platform: {
      findUnique: mockFindUnique,
    },
  },
}))

// Mock auth
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

import { GET, POST } from '@/app/api/accounts/route'
import { PATCH, DELETE } from '@/app/api/accounts/[id]/route'
import { auth } from '@/lib/auth'

describe('Accounts API', () => {
  const mockSession = {
    user: { id: 'user-123', name: 'testuser' },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession)
  })

  describe('GET /api/accounts', () => {
    it('should return user accounts', async () => {
      const mockAccounts = [
        { id: 'acct-1', name: '账号1', handle: 'acc1', platform: { name: 'Twitter' } },
        { id: 'acct-2', name: '账号2', handle: 'acc2', platform: { name: 'Twitter' } },
      ]
      mockFindMany.mockResolvedValue(mockAccounts)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveLength(2)
      expect(mockFindMany).toHaveBeenCalledWith({
        where: { userId: 'user-123', deletedAt: null },
        include: { platform: true },
        orderBy: { createdAt: 'desc' },
      })
    })


    it('should return 401 when not authenticated', async () => {
      ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue(null)

      const response = await GET()
      expect(response.status).toBe(401)
    })
  })

  describe('POST /api/accounts', () => {
    it('should create account successfully', async () => {
      const newAccount = {
        id: 'acct-new',
        name: '新账号',
        handle: 'newacc',
        platform: { name: 'Twitter' },
      }
      mockFindUnique.mockResolvedValue({ id: 'platform-twitter' })
      mockCreate.mockResolvedValue(newAccount)

      const request = new NextRequest('http://localhost/api/accounts', {
        method: 'POST',
        body: JSON.stringify({ name: '新账号', handle: '@newacc' }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.name).toBe('新账号')
      expect(mockCreate).toHaveBeenCalled()
    })

    it('should return 400 when name is missing', async () => {
      const request = new NextRequest('http://localhost/api/accounts', {
        method: 'POST',
        body: JSON.stringify({ handle: '@testacc' }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('名称和handle不能为空')
    })

    it('should return 400 when handle is missing', async () => {
      const request = new NextRequest('http://localhost/api/accounts', {
        method: 'POST',
        body: JSON.stringify({ name: '测试账号' }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('名称和handle不能为空')
    })
  })

  describe('PATCH /api/accounts/:id', () => {
    it('should return 401 when not authenticated', async () => {
      ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/accounts/acct-1', {
        method: 'PATCH',
        body: JSON.stringify({ name: '新名称' }),
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'acct-1' }) })
      expect(response.status).toBe(401)
    })

    it('should update account successfully', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'acct-1',
        name: '旧名称',
        handle: 'oldacc',
        userId: 'user-123',
      })
      mockUpdate.mockResolvedValue({
        id: 'acct-1',
        name: '新名称',
        handle: 'oldacc',
        platform: { name: 'Twitter' },
      })

      const request = new NextRequest('http://localhost/api/accounts/acct-1', {
        method: 'PATCH',
        body: JSON.stringify({ name: '新名称' }),
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'acct-1' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.name).toBe('新名称')
    })

    it('should return 404 when account not found', async () => {
      mockFindFirst.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/accounts/acct-999', {
        method: 'PATCH',
        body: JSON.stringify({ name: '新名称' }),
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'acct-999' }) })
      expect(response.status).toBe(404)
    })

    it('should keep existing description when not provided', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'acct-1',
        name: '账号',
        handle: 'oldacc',
        description: 'old description',
        userId: 'user-123',
      })
      mockUpdate.mockResolvedValue({
        id: 'acct-1',
        name: '账号',
        handle: 'oldacc',
        description: 'old description',
        platform: { name: 'Twitter' },
      })

      const request = new NextRequest('http://localhost/api/accounts/acct-1', {
        method: 'PATCH',
        body: JSON.stringify({ name: '账号' }), // No description field
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'acct-1' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      // description was not in body, so it should keep the existing value
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ description: 'old description' }),
        })
      )
    })

    it('should update description when provided', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'acct-1',
        name: '账号',
        handle: 'oldacc',
        description: 'old description',
        userId: 'user-123',
      })
      mockUpdate.mockResolvedValue({
        id: 'acct-1',
        name: '账号',
        handle: 'oldacc',
        description: 'new description',
        platform: { name: 'Twitter' },
      })

      const request = new NextRequest('http://localhost/api/accounts/acct-1', {
        method: 'PATCH',
        body: JSON.stringify({ description: 'new description' }),
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'acct-1' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ description: 'new description' }),
        })
      )
    })

    it('should clear description when set to null', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'acct-1',
        name: '账号',
        handle: 'oldacc',
        description: 'old description',
        userId: 'user-123',
      })
      mockUpdate.mockResolvedValue({
        id: 'acct-1',
        name: '账号',
        handle: 'oldacc',
        description: null,
        platform: { name: 'Twitter' },
      })

      const request = new NextRequest('http://localhost/api/accounts/acct-1', {
        method: 'PATCH',
        body: JSON.stringify({ description: null }),
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'acct-1' }) })
      expect(response.status).toBe(200)
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ description: null }),
        })
      )
    })

    it('should strip @ from handle', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'acct-1',
        name: '账号',
        handle: 'oldacc',
        userId: 'user-123',
      })
      mockUpdate.mockResolvedValue({
        id: 'acct-1',
        name: '账号',
        handle: 'newacc',
        platform: { name: 'Twitter' },
      })

      const request = new NextRequest('http://localhost/api/accounts/acct-1', {
        method: 'PATCH',
        body: JSON.stringify({ handle: '@newacc' }),
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'acct-1' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ handle: 'newacc' }),
        })
      )
    })
  })

  describe('DELETE /api/accounts/:id', () => {
    it('should return 401 when not authenticated', async () => {
      ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/accounts/acct-1', {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: 'acct-1' }) })
      expect(response.status).toBe(401)
    })

    it('should soft-delete account (not hard delete) successfully', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'acct-1',
        userId: 'user-123',
      })
      mockUpdate.mockResolvedValue({
        id: 'acct-1',
        deletedAt: new Date(),
      })

      const request = new NextRequest('http://localhost/api/accounts/acct-1', {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: 'acct-1' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      // 软删除走 update 而非 delete
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'acct-1' },
        data: expect.objectContaining({ deletedBy: 'user', deletedAt: expect.any(Date) }),
      })
      expect(mockDelete).not.toHaveBeenCalled()
    })

    it('should return 404 when account not found', async () => {
      mockFindFirst.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/accounts/acct-999', {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: 'acct-999' }) })
      expect(response.status).toBe(404)
    })
  })

})
  describe('GET /api/accounts - Error cases', () => {
    it('should return 500 on server error', async () => {
      mockFindMany.mockRejectedValue(new Error('Database error'))

      const response = await GET()
      expect(response.status).toBe(500)
    })
  })

  describe('POST /api/accounts - Error cases', () => {
    it('should return 400 when name is missing', async () => {
      mockFindUnique.mockResolvedValue({ id: 'platform-1', name: 'Twitter' })

      const req = new NextRequest('http://localhost/api/accounts', {
        method: 'POST',
        body: JSON.stringify({ handle: '@test' }),
      })
      req.headers.set('content-type', 'application/json')

      const response = await POST(req)
      expect(response.status).toBe(400)
    })

    it('should return 400 when platform not found', async () => {
      mockFindUnique.mockResolvedValue(null)

      const req = new NextRequest('http://localhost/api/accounts', {
        method: 'POST',
        body: JSON.stringify({ name: '测试', handle: 'test' }),
      })
      req.headers.set('content-type', 'application/json')

      const response = await POST(req)
      const data = await response.json()
      expect(response.status).toBe(400)
      expect(data.error).toBe('平台不存在')
    })

    it('should return 500 on server error during create', async () => {
      mockFindUnique.mockResolvedValue({ id: 'platform-1', name: 'Twitter' })
      mockCreate.mockRejectedValue(new Error('Database error'))

      const req = new NextRequest('http://localhost/api/accounts', {
        method: 'POST',
        body: JSON.stringify({ name: '测试', handle: 'test' }),
      })
      req.headers.set('content-type', 'application/json')

      const response = await POST(req)
      expect(response.status).toBe(500)
    })
  })

  describe('PATCH /api/accounts/:id - Error cases', () => {
    it('should return 404 when account not found', async () => {
      mockFindFirst.mockResolvedValue(null)

      const req = new NextRequest('http://localhost/api/accounts/acct-999', {
        method: 'PATCH',
        body: JSON.stringify({ name: '更新' }),
      })
      req.headers.set('content-type', 'application/json')

      const response = await PATCH(req, { params: Promise.resolve({ id: 'acct-999' }) })
      expect(response.status).toBe(404)
    })

    it('should return 404 when updating account of another user', async () => {
      mockFindFirst.mockResolvedValue(null)

      const req = new NextRequest('http://localhost/api/accounts/acct-other', {
        method: 'PATCH',
        body: JSON.stringify({ name: '更新' }),
      })
      req.headers.set('content-type', 'application/json')

      const response = await PATCH(req, { params: Promise.resolve({ id: 'acct-other' }) })
      expect(response.status).toBe(404)
    })

    it('should return 500 on server error during update', async () => {
      mockFindFirst.mockResolvedValueOnce({ id: 'acct-1', userId: 'user-123' })
      mockUpdate.mockRejectedValue(new Error('Database error'))

      const req = new NextRequest('http://localhost/api/accounts/acct-1', {
        method: 'PATCH',
        body: JSON.stringify({ name: '更新' }),
      })
      req.headers.set('content-type', 'application/json')

      const response = await PATCH(req, { params: Promise.resolve({ id: 'acct-1' }) })
      expect(response.status).toBe(500)
    })
  })

  describe('DELETE /api/accounts/:id - Error cases', () => {
    it('should return 404 when deleting non-existent account', async () => {
      mockFindFirst.mockResolvedValue(null)

      const req = new NextRequest('http://localhost/api/accounts/acct-999', {
        method: 'DELETE',
      })

      const response = await DELETE(req, { params: Promise.resolve({ id: 'acct-999' }) })
      expect(response.status).toBe(404)
    })

    it('should return 500 on server error during delete', async () => {
      mockFindFirst.mockResolvedValueOnce({ id: 'acct-1', userId: 'user-123' })
      mockDelete.mockRejectedValue(new Error('Database error'))

      const req = new NextRequest('http://localhost/api/accounts/acct-1', {
        method: 'DELETE',
      })

      const response = await DELETE(req, { params: Promise.resolve({ id: 'acct-1' }) })
      expect(response.status).toBe(500)
    })
  })
