import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildAuthHeader, fetchCrumb } from '../src/client/auth.js';
import type { JenkinsConfig } from '../src/config.js';

describe('buildAuthHeader', () => {
  it('returns a valid Basic auth header', () => {
    const header = buildAuthHeader('admin', 'token123');
    expect(header).toBe('Basic ' + Buffer.from('admin:token123').toString('base64'));
  });

  it('handles special characters', () => {
    const header = buildAuthHeader('user@domain', 'p@ss:word');
    const decoded = Buffer.from(header.replace('Basic ', ''), 'base64').toString();
    expect(decoded).toBe('user@domain:p@ss:word');
  });
});

describe('fetchCrumb', () => {
  const mockConfig: JenkinsConfig = {
    url: 'https://ci.example.com',
    user: 'admin',
    token: 'token123',
    useCrumb: true,
    maxLogSize: 1_048_576,
    timeoutMs: 30_000,
    allowedJobs: [],
    depth: 1,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns crumb data on success', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({ crumbRequestField: 'Jenkins-Crumb', crumb: 'abc123' }),
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

    const crumb = await fetchCrumb(mockConfig);
    expect(crumb.crumbRequestField).toBe('Jenkins-Crumb');
    expect(crumb.crumb).toBe('abc123');
  });

  it('throws on 404 with helpful message', async () => {
    const mockResponse = { ok: false, status: 404, statusText: 'Not Found' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

    await expect(fetchCrumb(mockConfig)).rejects.toThrow('CSRF crumb issuer not found');
  });

  it('throws on other errors', async () => {
    const mockResponse = { ok: false, status: 500, statusText: 'Server Error' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

    await expect(fetchCrumb(mockConfig)).rejects.toThrow('Failed to fetch crumb: 500');
  });
});
