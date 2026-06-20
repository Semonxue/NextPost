/**
 * 测试 DB 桥接（空文件，保留用于兼容旧 import）
 *
 * 现在 setupTestDb() 直接通过 globalThis.__testDbOverride 注入测试 db，
 * 业务代码的 getDb() 会自动优先使用注入的 db。
 * 不再需要 vi.mock。
 */
