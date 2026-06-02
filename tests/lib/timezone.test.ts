/**
 * 时区转换测试
 * 
 * 测试 formatDateTimeLocal 函数的时区转换功能
 */

import { describe, it, expect } from 'vitest';

// 模拟 formatDateTimeLocal 函数（与 edit 页面中的实现相同）
const formatDateTimeLocal = (date: Date, timezone: string): string => {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || "";
    const year = getPart("year");
    const month = getPart("month");
    const day = getPart("day");
    const hour = getPart("hour");
    const minute = getPart("minute");
    return `${year}-${month}-${day}T${hour}:${minute}`;
  } catch {
    return date.toISOString().slice(0, 16);
  }
};

describe('时区转换', () => {
  describe('formatDateTimeLocal', () => {
    it('应该正确转换 UTC 时间到 Asia/Shanghai (UTC+8)', () => {
      // 2024-01-01 00:00 UTC = 2024-01-01 08:00 Shanghai
      const utcDate = new Date('2024-01-01T00:00:00Z');
      const result = formatDateTimeLocal(utcDate, 'Asia/Shanghai');
      expect(result).toBe('2024-01-01T08:00');
    });

    it('应该正确转换 UTC 时间到 America/New_York (UTC-5)', () => {
      // 2024-01-01 12:00 UTC = 2024-01-01 07:00 New York
      const utcDate = new Date('2024-01-01T12:00:00Z');
      const result = formatDateTimeLocal(utcDate, 'America/New_York');
      expect(result).toBe('2024-01-01T07:00');
    });

    it('应该正确转换 UTC 时间到 Europe/London (UTC+0)', () => {
      // 2024-01-01 10:30 UTC = 2024-01-01 10:30 London
      const utcDate = new Date('2024-01-01T10:30:00Z');
      const result = formatDateTimeLocal(utcDate, 'Europe/London');
      expect(result).toBe('2024-01-01T10:30');
    });

    it('应该正确转换 UTC 时间到 Asia/Tokyo (UTC+9)', () => {
      // 2024-01-01 00:00 UTC = 2024-01-01 09:00 Tokyo
      const utcDate = new Date('2024-01-01T00:00:00Z');
      const result = formatDateTimeLocal(utcDate, 'Asia/Tokyo');
      expect(result).toBe('2024-01-01T09:00');
    });

    it('应该返回正确格式 YYYY-MM-DDTHH:mm', () => {
      const utcDate = new Date('2024-06-15T14:45:00Z');
      const result = formatDateTimeLocal(utcDate, 'Asia/Shanghai');
      // 14:45 UTC = 22:45 Shanghai
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
      expect(result).toBe('2024-06-15T22:45');
    });

    it('应该处理午夜时间', () => {
      // 2024-01-01 16:00 UTC = 2024-01-02 00:00 Shanghai (跨天)
      const utcDate = new Date('2024-01-01T16:00:00Z');
      const result = formatDateTimeLocal(utcDate, 'Asia/Shanghai');
      expect(result).toBe('2024-01-02T00:00');
    });

    it('应该处理无效时区时回退到 ISO 格式', () => {
      const utcDate = new Date('2024-01-01T12:00:00Z');
      // 使用无效时区
      const result = formatDateTimeLocal(utcDate, 'Invalid/Timezone');
      // 应该回退到 ISO 格式
      expect(result).toBe('2024-01-01T12:00');
    });
  });
});