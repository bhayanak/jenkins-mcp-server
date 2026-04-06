import { describe, it, expect, vi } from 'vitest';
import {
  handleTriggerBuild,
  handleGetBuild,
  handleAbortBuild,
  handleListBuilds,
} from '../src/tools/builds.js';
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

function createMockClient(overrides: Partial<JenkinsClient> = {}): JenkinsClient {
  return {
    triggerBuild: vi.fn().mockResolvedValue({ queueUrl: 'https://ci.example.com/queue/item/1/' }),
    getBuild: vi.fn().mockResolvedValue({
      number: 42,
      result: 'SUCCESS',
      building: false,
      duration: 192000,
      timestamp: Date.now() - 3600000,
      url: 'https://ci.example.com/job/web-api/42/',
      actions: [
        { _class: 'causes', causes: [{ shortDescription: 'Started by user' }] },
        { _class: 'params', parameters: [{ name: 'branch', value: 'main' }] },
      ],
      changeSets: [],
    }),
    abortBuild: vi.fn().mockResolvedValue(undefined),
    listBuilds: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as JenkinsClient;
}

describe('handleTriggerBuild', () => {
  it('triggers and returns status', async () => {
    const client = createMockClient();
    const result = await handleTriggerBuild(client, mockConfig, {
      jobName: 'web-api',
      wait: false,
    });
    expect(result).toContain('Build Triggered');
    expect(result).toContain('web-api');
  });

  it('includes parameters', async () => {
    const client = createMockClient();
    const result = await handleTriggerBuild(client, mockConfig, {
      jobName: 'web-api',
      parameters: { branch: 'main' },
      wait: false,
    });
    expect(result).toContain('branch');
  });

  it('throws for disallowed job', async () => {
    const client = createMockClient();
    const config = { ...mockConfig, allowedJobs: ['other'] };
    await expect(
      handleTriggerBuild(client, config, { jobName: 'web-api', wait: false }),
    ).rejects.toThrow('not in the allowed jobs list');
  });
});

describe('handleGetBuild', () => {
  it('returns formatted build info', async () => {
    const client = createMockClient();
    const result = await handleGetBuild(client, mockConfig, {
      jobName: 'web-api',
      buildNumber: 42,
    });
    expect(result).toContain('Build #42');
    expect(result).toContain('✅ SUCCESS');
    expect(result).toContain('3m 12s');
  });

  it('shows running status', async () => {
    const client = createMockClient({
      getBuild: vi.fn().mockResolvedValue({
        number: 43,
        result: null,
        building: true,
        duration: 0,
        timestamp: Date.now(),
        url: '',
        actions: [],
        changeSets: [],
      }),
    });
    const result = await handleGetBuild(client, mockConfig, {
      jobName: 'web-api',
      buildNumber: 43,
    });
    expect(result).toContain('RUNNING');
    expect(result).toContain('🔵');
  });

  it('throws for disallowed job', async () => {
    const client = createMockClient();
    const config = { ...mockConfig, allowedJobs: ['other'] };
    await expect(
      handleGetBuild(client, config, { jobName: 'web-api', buildNumber: 42 }),
    ).rejects.toThrow('not in the allowed jobs list');
  });
});

describe('handleAbortBuild', () => {
  it('aborts and confirms', async () => {
    const client = createMockClient();
    const result = await handleAbortBuild(client, mockConfig, {
      jobName: 'web-api',
      buildNumber: 42,
    });
    expect(result).toContain('aborted');
    expect(client.abortBuild).toHaveBeenCalledWith('web-api', 42);
  });

  it('throws for disallowed job', async () => {
    const client = createMockClient();
    const config = { ...mockConfig, allowedJobs: ['other'] };
    await expect(
      handleAbortBuild(client, config, { jobName: 'web-api', buildNumber: 42 }),
    ).rejects.toThrow('not in the allowed jobs list');
  });
});

describe('handleListBuilds', () => {
  it('returns formatted build list', async () => {
    const client = createMockClient({
      listBuilds: vi.fn().mockResolvedValue([
        {
          number: 42,
          result: 'SUCCESS',
          building: false,
          duration: 192000,
          timestamp: Date.now() - 3600000,
          url: '',
        },
        {
          number: 41,
          result: 'FAILURE',
          building: false,
          duration: 60000,
          timestamp: Date.now() - 7200000,
          url: '',
        },
      ]),
    });
    const result = await handleListBuilds(client, mockConfig, {
      jobName: 'web-api',
      limit: 10,
    });
    expect(result).toContain('Builds: web-api');
    expect(result).toContain('#42');
    expect(result).toContain('#41');
  });

  it('filters by status', async () => {
    const client = createMockClient({
      listBuilds: vi.fn().mockResolvedValue([
        {
          number: 42,
          result: 'SUCCESS',
          building: false,
          duration: 1000,
          timestamp: Date.now(),
          url: '',
        },
        {
          number: 41,
          result: 'FAILURE',
          building: false,
          duration: 1000,
          timestamp: Date.now(),
          url: '',
        },
      ]),
    });
    const result = await handleListBuilds(client, mockConfig, {
      jobName: 'web-api',
      limit: 10,
      status: 'failure',
    });
    expect(result).toContain('#41');
    expect(result).not.toContain('#42');
  });

  it('returns no builds message', async () => {
    const client = createMockClient();
    const result = await handleListBuilds(client, mockConfig, {
      jobName: 'web-api',
      limit: 10,
    });
    expect(result).toContain('No builds found');
  });

  it('throws for disallowed job', async () => {
    const client = createMockClient();
    const config = { ...mockConfig, allowedJobs: ['other'] };
    await expect(
      handleListBuilds(client, config, { jobName: 'web-api', limit: 10 }),
    ).rejects.toThrow('not in the allowed jobs list');
  });
});
