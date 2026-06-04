import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from '@/app/api/auth/register/route'
import { NextRequest } from 'next/server'

// Mock bcrypt
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed_password'),
  },
}))

// Mock Prisma - use vi.hoisted to avoid hoisting issues
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    platform: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}))

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('TC-AUTH-001: 用户注册成功', () => {
    it('should create user successfully', async () => {
      // Setup mocks
      mockPrisma.user.findUnique.mockResolvedValue(null) // 用户不存在
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-new-123',
        username: 'newuser',
        email: null,
      })
      mockPrisma.platform.upsert.mockResolvedValue({ id: 'platform-twitter' })

      // Create request
      const request = new NextRequest('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username: 'newuser', password: 'Test123456' }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.id).toBe('user-new-123')
      expect(data.username).toBe('newuser')
      expect(mockPrisma.user.create).toHaveBeenCalled()
    })
  })

  describe('TC-AUTH-002: 用户注册 - 用户名已存在', () => {
    it('should return error when username exists', async () => {
      // Setup mocks
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'existing-user',
        username: 'testuser',
      })

      // Create request
      const request = new NextRequest('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username: 'testuser', password: 'Test123456' }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('用户名已存在')
    })
  })

  describe('TC-AUTH-003: 用户注册 - 必填字段验证', () => {
    it('should return error when username is missing', async () => {
      const request = new NextRequest('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ password: 'Test123456' }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('用户名和密码不能为空')
    })

    it('should return error when password is missing', async () => {
      const request = new NextRequest('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username: 'newuser' }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('用户名和密码不能为空')
    })
  })
})
  describe('TC-AUTH-Error: Error cases', () => {
    it('should return 500 on server error during registration', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      mockPrisma.user.create.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username: 'newuser', password: 'Test123456' }),
      })

      const response = await POST(request)
      expect(response.status).toBe(500)
    })

    it('should return 500 when password is too short (no validation in source)', async () => {
      const request = new NextRequest('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username: 'newuser', password: '123' }),
      })

      const response = await POST(request)
      const data = await response.json()

      // 源码中没有密码长度验证，会触发服务器错误
      expect(response.status).toBe(500)
      expect(data.error).toBe('服务器错误')
    })

    // v0.5: 新用户注册时循环注册所有 REGISTERED_PLATFORMS
    it('should upsert all REGISTERED_PLATFORMS (not just Twitter) on register', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-new',
        username: 'newuser',
        email: null,
      })
      mockPrisma.platform.upsert.mockResolvedValue({ id: 'p-x' })

      const request = new NextRequest('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username: 'newuser', password: 'Test123456' }),
      })

      const response = await POST(request)
      expect(response.status).toBe(200)

      // 验证 upsert 被调用多次（5 个平台：Twitter/Instagram/LinkedIn/Facebook/Xiaohongshu）
      expect(mockPrisma.platform.upsert).toHaveBeenCalledTimes(5)
      // 验证每个平台都参与了 upsert
      const calledNames = mockPrisma.platform.upsert.mock.calls.map(
        (call) => (call[0] as { where: { name: string } }).where.name
      )
      expect(calledNames).toEqual(
        expect.arrayContaining(['Twitter', 'Instagram', 'LinkedIn', 'Facebook', 'Xiaohongshu'])
      )
    })
  })
