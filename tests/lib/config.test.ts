/**
 * src/lib/config.ts 中 APP_URL helper 的单元测试
 *
 * 覆盖：
 * - getAppUrl()：默认值 / APP_URL 设置 / 空字符串 fallback
 * - getPort()：默认 3456 / 显式端口 / 默认端口（80/443）/ 解析失败回退
 * - getMcpEndpointUrl()：拼接 /api/mcp 后缀
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getAppUrl, getPort, getMcpEndpointUrl } from '@/lib/config'

describe('getAppUrl', () => {
  const original = process.env.APP_URL

  afterEach(() => {
    if (original === undefined) delete process.env.APP_URL
    else process.env.APP_URL = original
  })

  it('returns APP_URL env when set', () => {
    process.env.APP_URL = 'https://nextpost.example.com'
    expect(getAppUrl()).toBe('https://nextpost.example.com')
  })

  it('returns default when APP_URL not set', () => {
    delete process.env.APP_URL
    expect(getAppUrl()).toBe('http://localhost:3456')
  })

  it('falls back to default when APP_URL is empty string', () => {
    process.env.APP_URL = ''
    // process.env.APP_URL || DEFAULT — empty string is falsy
    expect(getAppUrl()).toBe('http://localhost:3456')
  })
})

describe('getPort', () => {
  const original = process.env.APP_URL

  afterEach(() => {
    if (original === undefined) delete process.env.APP_URL
    else process.env.APP_URL = original
  })

  it('returns 3456 by default', () => {
    delete process.env.APP_URL
    expect(getPort()).toBe(3456)
  })

  it('parses explicit port from APP_URL', () => {
    process.env.APP_URL = 'http://localhost:8080'
    expect(getPort()).toBe(8080)
  })

  it('returns 443 for https without explicit port', () => {
    process.env.APP_URL = 'https://nextpost.example.com'
    expect(getPort()).toBe(443)
  })

  it('returns 80 for http without explicit port', () => {
    process.env.APP_URL = 'http://nextpost.example.com'
    expect(getPort()).toBe(80)
  })

  it('falls back to 3456 when APP_URL is malformed', () => {
    process.env.APP_URL = 'not a valid url'
    expect(getPort()).toBe(3456)
  })

  it('parses high port numbers', () => {
    process.env.APP_URL = 'http://localhost:65535'
    expect(getPort()).toBe(65535)
  })
})

describe('getMcpEndpointUrl', () => {
  const original = process.env.APP_URL

  beforeEach(() => {
    delete process.env.APP_URL
  })

  afterEach(() => {
    if (original === undefined) delete process.env.APP_URL
    else process.env.APP_URL = original
  })

  it('appends /api/mcp to APP_URL', () => {
    process.env.APP_URL = 'https://nextpost.example.com'
    expect(getMcpEndpointUrl()).toBe('https://nextpost.example.com/api/mcp')
  })

  it('uses default APP_URL when env not set', () => {
    delete process.env.APP_URL
    expect(getMcpEndpointUrl()).toBe('http://localhost:3456/api/mcp')
  })

  it('preserves custom port in MCP endpoint', () => {
    process.env.APP_URL = 'http://localhost:9000'
    expect(getMcpEndpointUrl()).toBe('http://localhost:9000/api/mcp')
  })
})
