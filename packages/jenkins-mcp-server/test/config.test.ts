import { describe, it, expect } from 'vitest';
import { loadConfig, isJobAllowed } from '../src/config.js';

describe('loadConfig', () => {
  const validEnv = {
    JENKINS_MCP_URL: 'https://ci.example.com',
    JENKINS_MCP_USER: 'admin',
    JENKINS_MCP_TOKEN: 'token123',
  };

  it('loads valid config from env vars', () => {
    const config = loadConfig(validEnv);
    expect(config.url).toBe('https://ci.example.com');
    expect(config.user).toBe('admin');
    expect(config.token).toBe('token123');
    expect(config.useCrumb).toBe(true);
    expect(config.maxLogSize).toBe(1_048_576);
    expect(config.timeoutMs).toBe(30_000);
    expect(config.allowedJobs).toEqual([]);
    expect(config.depth).toBe(1);
  });

  it('strips trailing slashes from URL', () => {
    const config = loadConfig({ ...validEnv, JENKINS_MCP_URL: 'https://ci.example.com///' });
    expect(config.url).toBe('https://ci.example.com');
  });

  it('throws for missing URL', () => {
    expect(() => loadConfig({ ...validEnv, JENKINS_MCP_URL: '' })).toThrow(
      'Invalid Jenkins MCP configuration',
    );
  });

  it('throws for missing user', () => {
    expect(() => loadConfig({ ...validEnv, JENKINS_MCP_USER: '' })).toThrow(
      'Invalid Jenkins MCP configuration',
    );
  });

  it('throws for missing token', () => {
    expect(() => loadConfig({ ...validEnv, JENKINS_MCP_TOKEN: '' })).toThrow(
      'Invalid Jenkins MCP configuration',
    );
  });

  it('parses allowed jobs filter', () => {
    const config = loadConfig({
      ...validEnv,
      JENKINS_MCP_ALLOWED_JOBS: 'web-api, data-pipeline, ',
    });
    expect(config.allowedJobs).toEqual(['web-api', 'data-pipeline']);
  });

  it('parses numeric settings', () => {
    const config = loadConfig({
      ...validEnv,
      JENKINS_MCP_MAX_LOG_SIZE: '2097152',
      JENKINS_MCP_TIMEOUT_MS: '60000',
      JENKINS_MCP_DEPTH: '2',
    });
    expect(config.maxLogSize).toBe(2_097_152);
    expect(config.timeoutMs).toBe(60_000);
    expect(config.depth).toBe(2);
  });

  it('parses useCrumb=false', () => {
    const config = loadConfig({ ...validEnv, JENKINS_MCP_USE_CRUMB: 'false' });
    expect(config.useCrumb).toBe(false);
  });

  it('warns on HTTP URL', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    loadConfig({ ...validEnv, JENKINS_MCP_URL: 'http://ci.example.com' });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('HTTP instead of HTTPS'));
    warn.mockRestore();
  });
});

describe('isJobAllowed', () => {
  it('allows all when allowedJobs is empty', () => {
    expect(isJobAllowed('any-job', [])).toBe(true);
  });

  it('allows exact match', () => {
    expect(isJobAllowed('web-api', ['web-api'])).toBe(true);
  });

  it('allows subfolder match', () => {
    expect(isJobAllowed('web-api/main', ['web-api'])).toBe(true);
  });

  it('denies non-matching job', () => {
    expect(isJobAllowed('data-pipeline', ['web-api'])).toBe(false);
  });

  it('denies partial name match', () => {
    expect(isJobAllowed('web-api-v2', ['web-api'])).toBe(false);
  });
});
