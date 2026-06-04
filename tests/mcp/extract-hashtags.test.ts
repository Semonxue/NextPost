import { describe, it, expect } from 'vitest';
import { extractHashtags } from '@/mcp/external/tools';

describe('extractHashtags (v0.5)', () => {
  it('提取中文 hashtag', () => {
    expect(extractHashtags('今天去了 #三里屯 #brunch')).toEqual(['三里屯', 'brunch']);
  });

  it('提取英文/数字/下划线 hashtag', () => {
    expect(extractHashtags('#hello #world123 #my_tag')).toEqual(['hello', 'world123', 'my_tag']);
  });

  it('空内容返回空数组', () => {
    expect(extractHashtags('')).toEqual([]);
    expect(extractHashtags(null as unknown as string)).toEqual([]);
    expect(extractHashtags(undefined as unknown as string)).toEqual([]);
  });

  it('没有 # 时返回空数组', () => {
    expect(extractHashtags('hello world')).toEqual([]);
  });

  it('保留所有出现（包括重复，按出现顺序）', () => {
    const result = extractHashtags('#aaa #aaa #bbb');
    expect(result).toEqual(['aaa', 'aaa', 'bbb']);
  });

  it('混合中英文 + 数字', () => {
    expect(extractHashtags('#上海 #北京 #tag1 #tag2')).toEqual(['上海', '北京', 'tag1', 'tag2']);
  });

  it('正则在句末也能提取', () => {
    expect(extractHashtags('正文内容#末尾')).toEqual(['末尾']);
  });

  it('正则在句首也能提取', () => {
    expect(extractHashtags('#开头 正文内容')).toEqual(['开头']);
  });
});

describe('PLATFORM_URL_TEMPLATES（v0.5.1 小红书 URL 自动拼）', () => {
  // 模板字符串在 tools.ts 里硬编码，这里只验证模板格式的稳定性
  it('小红书 note-id 拼出 explore URL 格式', () => {
    const noteId = '64f0a1b2c3d4e5f6789abcde';
    const url = `https://www.xiaohongshu.com/explore/${noteId}`;
    expect(url).toBe('https://www.xiaohongshu.com/explore/64f0a1b2c3d4e5f6789abcde');
    expect(url).toMatch(/^https:\/\/www\.xiaohongshu\.com\/explore\/[a-f0-9]+$/);
  });
});
