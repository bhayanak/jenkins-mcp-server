import { describe, it, expect } from 'vitest';
import {
  statusEmoji,
  resultEmoji,
  healthEmoji,
  formatDuration,
  relativeTime,
  truncateLog,
  padRight,
} from '../src/utils/formatter.js';

describe('statusEmoji', () => {
  it('returns correct emoji for blue', () => expect(statusEmoji('blue')).toBe('✅'));
  it('returns correct emoji for red', () => expect(statusEmoji('red')).toBe('🔴'));
  it('returns correct emoji for blue_anime', () => expect(statusEmoji('blue_anime')).toBe('🔵'));
  it('returns correct emoji for yellow', () => expect(statusEmoji('yellow')).toBe('🟡'));
  it('returns correct emoji for grey', () => expect(statusEmoji('grey')).toBe('⚪'));
  it('returns correct emoji for disabled', () => expect(statusEmoji('disabled')).toBe('⚫'));
  it('returns ❓ for unknown', () => expect(statusEmoji('unknown')).toBe('❓'));
});

describe('resultEmoji', () => {
  it('returns 🔵 when building', () => expect(resultEmoji(null, true)).toBe('🔵'));
  it('returns ✅ for SUCCESS', () => expect(resultEmoji('SUCCESS', false)).toBe('✅'));
  it('returns 🔴 for FAILURE', () => expect(resultEmoji('FAILURE', false)).toBe('🔴'));
  it('returns 🟡 for UNSTABLE', () => expect(resultEmoji('UNSTABLE', false)).toBe('🟡'));
  it('returns ⚪ for ABORTED', () => expect(resultEmoji('ABORTED', false)).toBe('⚪'));
  it('returns ❓ for null', () => expect(resultEmoji(null, false)).toBe('❓'));
});

describe('healthEmoji', () => {
  it('returns ☀️ for 80+', () => expect(healthEmoji(90)).toBe('☀️'));
  it('returns 🌤 for 60-79', () => expect(healthEmoji(70)).toBe('🌤'));
  it('returns ⛅ for 40-59', () => expect(healthEmoji(50)).toBe('⛅'));
  it('returns 🌧 for 20-39', () => expect(healthEmoji(30)).toBe('🌧'));
  it('returns ⛈ for 0-19', () => expect(healthEmoji(10)).toBe('⛈'));
  it('returns ⛈ for 0', () => expect(healthEmoji(0)).toBe('⛈'));
});

describe('formatDuration', () => {
  it('formats seconds', () => expect(formatDuration(5000)).toBe('5s'));
  it('formats minutes and seconds', () => expect(formatDuration(192000)).toBe('3m 12s'));
  it('formats hours and minutes', () => expect(formatDuration(3900000)).toBe('1h 5m'));
  it('handles zero', () => expect(formatDuration(0)).toBe('0s'));
  it('handles negative', () => expect(formatDuration(-1)).toBe('–'));
});

describe('relativeTime', () => {
  it('returns just now for recent', () => {
    expect(relativeTime(Date.now() - 10000)).toBe('just now');
  });
  it('returns minutes ago', () => {
    expect(relativeTime(Date.now() - 5 * 60 * 1000)).toBe('5m ago');
  });
  it('returns hours ago', () => {
    expect(relativeTime(Date.now() - 3 * 60 * 60 * 1000)).toBe('3h ago');
  });
  it('returns days ago', () => {
    expect(relativeTime(Date.now() - 2 * 24 * 60 * 60 * 1000)).toBe('2d ago');
  });
  it('handles future timestamp', () => {
    expect(relativeTime(Date.now() + 60000)).toBe('just now');
  });
});

describe('truncateLog', () => {
  it('returns full log when no tail', () => {
    expect(truncateLog('line1\nline2\nline3')).toBe('line1\nline2\nline3');
  });
  it('returns full log when lines <= tail', () => {
    expect(truncateLog('line1\nline2', 5)).toBe('line1\nline2');
  });
  it('truncates to tail lines', () => {
    const log = 'line1\nline2\nline3\nline4\nline5';
    const result = truncateLog(log, 2);
    expect(result).toContain('line4\nline5');
    expect(result).toContain('3 lines truncated');
  });
});

describe('padRight', () => {
  it('pads shorter strings', () => expect(padRight('hi', 5)).toBe('hi   '));
  it('does not truncate longer strings', () =>
    expect(padRight('hello world', 5)).toBe('hello world'));
  it('handles exact length', () => expect(padRight('hello', 5)).toBe('hello'));
});
