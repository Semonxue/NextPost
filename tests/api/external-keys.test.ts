/**
 * 外部 API Key 管理接口测试
 * 
 * 测试 API Key 的 CRUD 操作
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

describe('External API Keys CRUD', () => {
  let testUser: { id: string; username: string };
  let testApiKey: { id: string; key: string; name: string };

  beforeAll(async () => {
    // 创建测试用户
    testUser = await prisma.user.create({
      data: {
        username: `test_apikey_${Date.now()}`,
        password: '$2a$10$test_hash',
      }
    });
  });

  afterAll(async () => {
    // 清理测试数据
    try {
      await prisma.externalApiKey.deleteMany({ where: { userId: testUser.id } });
      await prisma.user.delete({ where: { id: testUser.id } });
    } catch (e) {
      // 忽略清理错误
    }
  });

  describe('数据库模型验证', () => {
    it('should create ExternalApiKey with required fields', async () => {
      const keyValue = `npk_${uuidv4().replace(/-/g, '')}`;
      
      const apiKey = await prisma.externalApiKey.create({
        data: {
          userId: testUser.id,
          name: 'Test Key',
          key: keyValue,
          permissions: 'read_report',
        }
      });

      expect(apiKey).toBeDefined();
      expect(apiKey.id).toBeDefined();
      expect(apiKey.key).toBe(keyValue);
      expect(apiKey.name).toBe('Test Key');
      expect(apiKey.userId).toBe(testUser.id);
      expect(apiKey.permissions).toBe('read_report');
      expect(apiKey.createdAt).toBeDefined();
    });

    it('should list keys for user', async () => {
      const keys = await prisma.externalApiKey.findMany({
        where: { userId: testUser.id }
      });

      expect(Array.isArray(keys)).toBe(true);
      expect(keys.length).toBeGreaterThan(0);
    });

    it('should delete key by id', async () => {
      const keyValue = `npk_${uuidv4().replace(/-/g, '')}`;
      
      const apiKey = await prisma.externalApiKey.create({
        data: {
          userId: testUser.id,
          name: 'Key to Delete',
          key: keyValue,
          permissions: 'read_report',
        }
      });

      // 验证创建成功
      const found = await prisma.externalApiKey.findUnique({
        where: { id: apiKey.id }
      });
      expect(found).toBeDefined();

      // 删除
      await prisma.externalApiKey.delete({
        where: { id: apiKey.id }
      });

      // 验证删除成功
      const deleted = await prisma.externalApiKey.findUnique({
        where: { id: apiKey.id }
      });
      expect(deleted).toBeNull();
    });

    it('should not delete another users key', async () => {
      const otherUser = await prisma.user.create({
        data: {
          username: `other_user_${Date.now()}`,
          password: '$2a$10$other_hash',
        }
      });

      const keyValue = `npk_${uuidv4().replace(/-/g, '')}`;
      
      const otherKey = await prisma.externalApiKey.create({
        data: {
          userId: otherUser.id,
          name: 'Other User Key',
          key: keyValue,
          permissions: 'read_report',
        }
      });

      // 尝试用当前用户的 ID 删除其他用户的 key（应该失败或返回 0）
      const result = await prisma.externalApiKey.deleteMany({
        where: { 
          userId: testUser.id,
          id: otherKey.id 
        }
      });

      // 应该没有删除任何记录
      expect(result.count).toBe(0);

      // 其他用户的 key 仍然存在
      const stillExists = await prisma.externalApiKey.findUnique({
        where: { id: otherKey.id }
      });
      expect(stillExists).toBeDefined();

      // 清理
      await prisma.externalApiKey.delete({ where: { id: otherKey.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    });
  });

  describe('API Key 格式验证', () => {
    it('should generate key with npk_ prefix', () => {
      const keyValue = `npk_${uuidv4().replace(/-/g, '')}`;
      
      expect(keyValue).toMatch(/^npk_[a-f0-9]{32}$/);
    });

    it('should validate key format', () => {
      const validKey = 'npk_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';
      const invalidKeys = [
        'invalid_key',
        'npk_short',
        'NPK_A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4', // 大写
        'apk_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4', // 错误前缀
      ];

      // 验证有效 key
      expect(validKey).toMatch(/^npk_[a-f0-9]{32}$/);

      // 验证无效 key
      invalidKeys.forEach(key => {
        expect(key).not.toMatch(/^npk_[a-f0-9]{32}$/);
      });
    });
  });

  describe('权限字段验证', () => {
    it('should support read_report permission', async () => {
      const keyValue = `npk_${uuidv4().replace(/-/g, '')}`;
      
      const apiKey = await prisma.externalApiKey.create({
        data: {
          userId: testUser.id,
          name: 'Read Report Key',
          key: keyValue,
          permissions: 'read_report',
        }
      });

      expect(apiKey.permissions).toBe('read_report');
    });

    it('should support multiple permissions', async () => {
      const keyValue = `npk_${uuidv4().replace(/-/g, '')}`;
      
      const apiKey = await prisma.externalApiKey.create({
        data: {
          userId: testUser.id,
          name: 'Multi Permission Key',
          key: keyValue,
          permissions: 'read_report,manage_posts',
        }
      });

      expect(apiKey.permissions).toContain('read_report');
      expect(apiKey.permissions).toContain('manage_posts');
    });
  });

  // ====== v0.4 新增：scope 系统端到端 ======

  describe('scope 持久化（DB 层）', () => {
    it('read_write scope 应能存进 DB 并取回一致', async () => {
      const keyValue = `npk_${uuidv4().replace(/-/g, '')}`;
      const apiKey = await prisma.externalApiKey.create({
        data: {
          userId: testUser.id,
          name: 'Read-Write Key',
          key: keyValue,
          permissions: 'read_write',
        }
      });
      const fetched = await prisma.externalApiKey.findUnique({ where: { id: apiKey.id } });
      expect(fetched?.permissions).toBe('read_write');
    });

    it('write scope 应能存进 DB', async () => {
      const keyValue = `npk_${uuidv4().replace(/-/g, '')}`;
      const apiKey = await prisma.externalApiKey.create({
        data: {
          userId: testUser.id,
          name: 'Write Only Key',
          key: keyValue,
          permissions: 'write',
        }
      });
      const fetched = await prisma.externalApiKey.findUnique({ where: { id: apiKey.id } });
      expect(fetched?.permissions).toBe('write');
    });
  });
});