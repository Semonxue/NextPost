import { describe, it, expect } from 'vitest'
import { getPlatformStyle, getPlatformBadgeClasses } from '@/lib/platform-style'

describe('platform-style（v0.5.1 平台色标）', () => {
  it('getPlatformStyle 已知平台', () => {
    expect(getPlatformStyle('Twitter').label).toBe('Twitter / X')
    expect(getPlatformStyle('Twitter').bgClass).toMatch(/gray-900|gray-200/)
    expect(getPlatformStyle('Xiaohongshu').label).toBe('小红书')
    expect(getPlatformStyle('Xiaohongshu').bgClass).toBe('bg-red-500')
    expect(getPlatformStyle('Instagram').bgClass).toMatch(/gradient/)
    expect(getPlatformStyle('LinkedIn').bgClass).toBe('bg-blue-700')
    expect(getPlatformStyle('Facebook').bgClass).toBe('bg-blue-600')
  })

  it('不区分大小写匹配', () => {
    expect(getPlatformStyle('twitter').label).toBe('Twitter / X')
    expect(getPlatformStyle('TWITTER').label).toBe('Twitter / X')
    expect(getPlatformStyle('Xiaohongshu').label).toBe('小红书')
  })

  it('未知平台 fallback（label 用 platform 名）', () => {
    const s = getPlatformStyle('Mastodon')
    expect(s.label).toBe('Mastodon')
    expect(s.bgClass).toMatch(/gray/)
  })

  it('null / undefined 返回 fallback', () => {
    expect(getPlatformStyle(null).label).toBe('未知平台')
    expect(getPlatformStyle(undefined).label).toBe('未知平台')
    expect(getPlatformStyle('').label).toBe('未知平台')
  })

  it('getPlatformBadgeClasses 返回完整 className', () => {
    const cls = getPlatformBadgeClasses('Twitter')
    expect(cls).toMatch(/bg-gray-900/)
    expect(cls).toMatch(/text-white/)
  })

  it('getPlatformBadgeClasses 未知平台用 fallback 灰', () => {
    const cls = getPlatformBadgeClasses('Unknown')
    expect(cls).toMatch(/bg-gray-100/)
  })
})
