/**
 * cronToHuman Utility — Unit Tests (GAP-11)
 */

import { describe, it, expect } from 'vitest';
import { cronToHuman } from './cronToHuman';

describe('cronToHuman', () => {
  it.each([
    ['0 7 * * *',   'en', 'Daily at 07:00'],
    ['0 8 * * 1',   'en', 'Mondays at 08:00'],
    ['0 9 * * *',   'en', 'Daily at 09:00'],
    ['0 9 * * 1-5', 'en', 'Weekdays at 09:00'],
    ['0 17 * * 5',  'en', 'Fridays at 17:00'],
  ])('maps "%s" (locale=%s) to "%s"', (expr, locale, expected) => {
    expect(cronToHuman(expr, locale)).toBe(expected);
  });

  it.each([
    ['0 7 * * *',   'zh-CN', '每天 07:00'],
    ['0 8 * * 1',   'zh-CN', '每周一 08:00'],
    ['0 9 * * *',   'zh-CN', '每天 09:00'],
    ['0 9 * * 1-5', 'zh-CN', '工作日 09:00'],
    ['0 17 * * 5',  'zh-CN', '每周五 17:00'],
  ])('maps "%s" (locale=%s) to "%s"', (expr, locale, expected) => {
    expect(cronToHuman(expr, locale)).toBe(expected);
  });

  it('falls back to raw expression for unknown patterns', () => {
    expect(cronToHuman('*/5 * * * *', 'en')).toBe('*/5 * * * *');
    expect(cronToHuman('*/5 * * * *', 'zh-CN')).toBe('*/5 * * * *');
  });

  it('trims whitespace from expressions', () => {
    expect(cronToHuman('  0 7 * * *  ', 'en')).toBe('Daily at 07:00');
  });

  it('defaults to English locale', () => {
    expect(cronToHuman('0 7 * * *')).toBe('Daily at 07:00');
  });

  it('handles zh locale prefix without region', () => {
    expect(cronToHuman('0 7 * * *', 'zh')).toBe('每天 07:00');
  });
});
