import { describe, it, expect, vi } from 'vitest';
import { handleGetBuildLog, handleSearchLogs } from '../src/tools/logs.js';
import type { JenkinsClient } from '../src/client/jenkins-client.js';
import type { JenkinsConfig } from '../src/config.js';

const mockConfig: JenkinsConfig = {
  url: 'https://ci.example.com',
  user: 'admin',
  token: 'token123',
  useCrumb: false,
  maxLogSize: 1_048_576,
  timeoutMs: 30_000,
  allowedJobs: [],
  depth: 1,
};

function createMockClient(
  log = 'line1\nline2 ERROR\nline3\nline4 ERROR found\nline5',
): JenkinsClient {
  return {
    getBuildLog: vi.fn().mockResolvedValue({ text: log, size: log.length }),
  } as unknown as JenkinsClient;
}

describe('handleGetBuildLog', () => {
  it('returns formatted log output', async () => {
    const client = createMockClient();
    const result = await handleGetBuildLog(client, mockConfig, {
      jobName: 'web-api',
      buildNumber: 42,
    });
    expect(result).toContain('Console Output: web-api #42');
    expect(result).toContain('line1');
  });

  it('applies tail parameter', async () => {
    const client = createMockClient();
    const result = await handleGetBuildLog(client, mockConfig, {
      jobName: 'web-api',
      buildNumber: 42,
      tail: 2,
    });
    expect(result).toContain('line4 ERROR found');
    expect(result).toContain('line5');
    expect(result).toContain('truncated');
  });

  it('throws for disallowed job', async () => {
    const client = createMockClient();
    const config = { ...mockConfig, allowedJobs: ['other'] };
    await expect(
      handleGetBuildLog(client, config, { jobName: 'web-api', buildNumber: 42 }),
    ).rejects.toThrow('not in the allowed jobs list');
  });
});

describe('handleSearchLogs', () => {
  it('finds matching lines', async () => {
    const client = createMockClient();
    const result = await handleSearchLogs(client, mockConfig, {
      jobName: 'web-api',
      buildNumber: 42,
      pattern: 'ERROR',
    });
    expect(result).toContain('Matches: 2');
    expect(result).toContain('L2:');
    expect(result).toContain('L4:');
  });

  it('returns no matches message', async () => {
    const client = createMockClient();
    const result = await handleSearchLogs(client, mockConfig, {
      jobName: 'web-api',
      buildNumber: 42,
      pattern: 'NOTFOUND',
    });
    expect(result).toContain('No matches');
  });

  it('supports regex patterns', async () => {
    const client = createMockClient();
    const result = await handleSearchLogs(client, mockConfig, {
      jobName: 'web-api',
      buildNumber: 42,
      pattern: 'ERROR.*found',
    });
    expect(result).toContain('Matches: 1');
    expect(result).toContain('L4:');
  });

  it('throws for invalid regex', async () => {
    const client = createMockClient();
    await expect(
      handleSearchLogs(client, mockConfig, {
        jobName: 'web-api',
        buildNumber: 42,
        pattern: '[invalid',
      }),
    ).rejects.toThrow('Invalid regex pattern');
  });

  it('throws for disallowed job', async () => {
    const client = createMockClient();
    const config = { ...mockConfig, allowedJobs: ['other'] };
    await expect(
      handleSearchLogs(client, config, { jobName: 'web-api', buildNumber: 42, pattern: 'x' }),
    ).rejects.toThrow('not in the allowed jobs list');
  });
});
