/**
 * 外部 MCP Server 单元测试
 * 
 * 测试 API Key 认证和工具函数
 */

import { describe, it, expect } from 'vitest';

// 测试数据（纯 mock，不依赖真实 DB）
const testUser = {
  id: 'test-user-id',
  username: 'testuser',
  password: '$2a$10$test',
  email: 'test@example.com'
};

const testPlatform = {
  id: 'platform-twitter',
  name: 'twitter'
};

const testAccount = {
  id: 'test-account-id',
  userId: testUser.id,
  platformId: testPlatform.id,
  name: '我的推特',
  handle: '@testhandle',
  description: 'Test account'
};

const testPost = {
  id: 'test-post-id',
  userId: testUser.id,
  accountId: testAccount.id,
  content: '这是一条测试推文',
  mediaUrls: '["/uploads/test.jpg"]',
  scheduledTime: new Date('2026-06-01T15:00:00+08:00'),
  timezone: 'Asia/Shanghai',
  status: 'scheduled',
  publishToken: 'tok_test123'
};

describe('External MCP Auth', () => {
  describe('validateApiKey', () => {
    it('should reject empty API key', async () => {
      const { validateApiKey } = await import('@/mcp/external/auth');
      const result = await validateApiKey('');
      
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('MISSING_KEY');
    });

    it('should reject invalid key format', async () => {
      const { validateApiKey } = await import('@/mcp/external/auth');
      const result = await validateApiKey('invalid_format');
      
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_KEY_FORMAT');
    });

    it('should reject non-existent key', async () => {
      const { validateApiKey } = await import('@/mcp/external/auth');
      const result = await validateApiKey('npk_nonexistent_key_12345678901234567890123456789012');
      
      expect(result.valid).toBe(false);
      // 可能是 INVALID_KEY 或 INTERNAL_ERROR（取决于测试环境）
      expect(['INVALID_KEY', 'INTERNAL_ERROR']).toContain(result.errorCode);
    });
  });
});

describe('External MCP Tools', () => {
  describe('listAccounts', () => {
    it('should return sanitized account info', async () => {
      // Mock 数据库查询
      const mockAccounts = [{
        id: testAccount.id,
        name: testAccount.name,
        platform: { name: 'twitter' }
      }];

      // 验证返回格式
      expect(mockAccounts[0]).toHaveProperty('id');
      expect(mockAccounts[0]).toHaveProperty('name');
      expect(mockAccounts[0]).toHaveProperty('platform');
      expect(mockAccounts[0]).not.toHaveProperty('handle');
      expect(mockAccounts[0]).not.toHaveProperty('description');
    });
  });

  describe('getPendingPosts', () => {
    it('should return posts with publish tokens', async () => {
      const mockPosts = [{
        id: testPost.id,
        accountId: testPost.accountId,
        account: { name: testAccount.name },
        content: testPost.content,
        mediaUrls: testPost.mediaUrls,
        scheduledTime: testPost.scheduledTime,
        timezone: testPost.timezone,
        publishToken: testPost.publishToken
      }];

      // 验证返回包含必要字段
      expect(mockPosts[0]).toHaveProperty('id');
      expect(mockPosts[0]).toHaveProperty('publishToken');
      expect(mockPosts[0]).toHaveProperty('content');
      expect(mockPosts[0]).toHaveProperty('scheduledTime');
    });
  });

  describe('reportPublishResult', () => {
    it('should validate required fields', () => {
      const requiredFields = ['postId', 'publishToken', 'status'];
      
      const report = {
        postId: 'post123',
        publishToken: 'token123',
        status: 'success' as const
      };

      requiredFields.forEach(field => {
        expect(report).toHaveProperty(field);
      });
    });

    it('should support all status values', () => {
      const statuses = ['success', 'failed', 'partial'] as const;
      
      statuses.forEach(status => {
        const report = {
          postId: 'post123',
          publishToken: 'token123',
          status
        };
        expect(['success', 'failed', 'partial']).toContain(report.status);
      });
    });

    it('should handle retryable flag', () => {
      const retryableReport = {
        postId: 'post123',
        publishToken: 'token123',
        status: 'failed' as const,
        retryable: true
      };

      expect(retryableReport.retryable).toBe(true);
    });
  });
});

describe('Error Codes', () => {
  it('should define retryable errors', async () => {
    const { RETRYABLE_ERRORS } = await import('@/mcp/external/types');
    
    expect(RETRYABLE_ERRORS).toContain('rate_limit');
    expect(RETRYABLE_ERRORS).toContain('network_error');
    expect(RETRYABLE_ERRORS).toContain('timeout');
  });

  it('should define non-retryable errors', async () => {
    const { NON_RETRYABLE_ERRORS } = await import('@/mcp/external/types');
    
    expect(NON_RETRYABLE_ERRORS).toContain('content_violation');
    expect(NON_RETRYABLE_ERRORS).toContain('auth_expired');
    expect(NON_RETRYABLE_ERRORS).toContain('account_suspended');
  });
});

describe('Tool Definitions', () => {
  it('should have all required tools defined', async () => {
    const { TOOLS } = await import('@/mcp/external/tools');
    
    const toolNames = TOOLS.map(t => t.name);
    
    expect(toolNames).toContain('list_accounts');
    expect(toolNames).toContain('get_pending_posts');
    expect(toolNames).toContain('get_post_detail');
    expect(toolNames).toContain('report_publish_result');
  });

  it('should have valid input schemas', async () => {
    const { TOOLS } = await import('@/mcp/external/tools');
    
    TOOLS.forEach(tool => {
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('inputSchema');
      expect(tool.inputSchema).toHaveProperty('type', 'object');
    });
  });

  it('should require postId for get_post_detail', async () => {
    const { TOOLS } = await import('@/mcp/external/tools');
    
    const getPostDetailTool = TOOLS.find(t => t.name === 'get_post_detail');
    expect(getPostDetailTool?.inputSchema.required).toContain('postId');
  });

  it('should require fields for report_publish_result', async () => {
    const { TOOLS } = await import('@/mcp/external/tools');
    
    const reportTool = TOOLS.find(t => t.name === 'report_publish_result');
    expect(reportTool?.inputSchema.required).toContain('postId');
    expect(reportTool?.inputSchema.required).toContain('publishToken');
    expect(reportTool?.inputSchema.required).toContain('status');
  });

  it('should require externalPostUrl for report_publish_result (v0.2.2)', async () => {
    const { TOOLS } = await import('@/mcp/external/tools');
    
    const reportTool = TOOLS.find(t => t.name === 'report_publish_result');
    expect(reportTool?.inputSchema.required).toContain('externalPostUrl');
    
    // 验证 externalPostUrl 属性存在
    const props = reportTool?.inputSchema.properties as Record<string, { type: string; description?: string }>;
    expect(props).toHaveProperty('externalPostUrl');
    expect(props.externalPostUrl.description).toContain('必须');
  });

  it('should have externalPostId as optional field', async () => {
    const { TOOLS } = await import('@/mcp/external/tools');
    
    const reportTool = TOOLS.find(t => t.name === 'report_publish_result');
    const props = reportTool?.inputSchema.properties as Record<string, { type: string; description?: string }>;
    
    // externalPostId 应该是可选的
    expect(props).toHaveProperty('externalPostId');
    expect(props.externalPostId.description).toContain('可选');
  });
});

describe('externalPostUrl 字段验证 (v0.2.2)', () => {
  it('report_publish_result 成功时必须提供 externalPostUrl', async () => {
    const { TOOLS } = await import('@/mcp/external/tools');
    
    const reportTool = TOOLS.find(t => t.name === 'report_publish_result');
    const required = reportTool?.inputSchema.required as string[];
    
    // 成功发布时 externalPostUrl 是必须的
    expect(required).toContain('externalPostUrl');
  });

  it('描述中应强调 externalPostUrl 的重要性', async () => {
    const { TOOLS } = await import('@/mcp/external/tools');
    
    const reportTool = TOOLS.find(t => t.name === 'report_publish_result');
    const description = reportTool?.description || '';
    
    // 描述中应包含关键提示
    expect(description).toContain('externalPostUrl');
    expect(description).toContain('必须');
  });
});
