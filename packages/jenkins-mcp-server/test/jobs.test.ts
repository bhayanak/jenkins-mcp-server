import { describe, it, expect, vi } from 'vitest';
import {
  handleListJobs,
  handleGetJobConfig,
  handleCreateJob,
  handleToggleJob,
} from '../src/tools/jobs.js';
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
    listJobs: vi.fn().mockResolvedValue([]),
    getJobConfig: vi.fn().mockResolvedValue('<project></project>'),
    createJob: vi.fn().mockResolvedValue(undefined),
    enableJob: vi.fn().mockResolvedValue(undefined),
    disableJob: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as JenkinsClient;
}

describe('handleListJobs', () => {
  it('returns formatted job list', async () => {
    const client = createMockClient({
      listJobs: vi.fn().mockResolvedValue([
        {
          name: 'web-api',
          fullName: 'web-api',
          color: 'blue',
          lastBuild: { number: 42, result: 'SUCCESS', timestamp: Date.now() - 3600000 },
          healthReport: [{ score: 90, description: 'ok' }],
        },
      ]),
    });
    const result = await handleListJobs(client, mockConfig, { depth: 1 });
    expect(result).toContain('web-api');
    expect(result).toContain('✅');
    expect(result).toContain('Total: 1 jobs');
  });

  it('returns no jobs message', async () => {
    const client = createMockClient();
    const result = await handleListJobs(client, mockConfig, { depth: 1 });
    expect(result).toBe('No jobs found.');
  });

  it('filters by allowed jobs', async () => {
    const client = createMockClient({
      listJobs: vi.fn().mockResolvedValue([
        { name: 'web-api', fullName: 'web-api', color: 'blue', lastBuild: null, healthReport: [] },
        { name: 'secret', fullName: 'secret', color: 'blue', lastBuild: null, healthReport: [] },
      ]),
    });
    const config = { ...mockConfig, allowedJobs: ['web-api'] };
    const result = await handleListJobs(client, config, { depth: 1 });
    expect(result).toContain('web-api');
    expect(result).not.toContain('secret');
  });

  it('counts running and failed', async () => {
    const client = createMockClient({
      listJobs: vi.fn().mockResolvedValue([
        { name: 'a', fullName: 'a', color: 'blue_anime', lastBuild: null, healthReport: [] },
        { name: 'b', fullName: 'b', color: 'red', lastBuild: null, healthReport: [] },
      ]),
    });
    const result = await handleListJobs(client, mockConfig, { depth: 1 });
    expect(result).toContain('1 running');
    expect(result).toContain('1 failed');
  });
});

describe('handleGetJobConfig', () => {
  it('returns config with summary', async () => {
    const client = createMockClient({
      getJobConfig: vi
        .fn()
        .mockResolvedValue(
          '<project><description>test</description><disabled>false</disabled></project>',
        ),
    });
    const result = await handleGetJobConfig(client, mockConfig, { jobName: 'web-api' });
    expect(result).toContain('Job Config: web-api');
    expect(result).toContain('Description: test');
  });

  it('throws for disallowed job', async () => {
    const client = createMockClient();
    const config = { ...mockConfig, allowedJobs: ['other'] };
    await expect(handleGetJobConfig(client, config, { jobName: 'web-api' })).rejects.toThrow(
      'not in the allowed jobs list',
    );
  });
});

describe('handleCreateJob', () => {
  it('creates job and returns message', async () => {
    const client = createMockClient();
    const result = await handleCreateJob(client, mockConfig, {
      jobName: 'new-job',
      configXml: '<project/>',
    });
    expect(result).toContain("Job 'new-job' created successfully");
  });

  it('includes folder in location', async () => {
    const client = createMockClient();
    const result = await handleCreateJob(client, mockConfig, {
      jobName: 'new-job',
      folder: 'team',
      configXml: '<project/>',
    });
    expect(result).toContain('team/new-job');
  });
});

describe('handleToggleJob', () => {
  it('enables a job', async () => {
    const client = createMockClient();
    const result = await handleToggleJob(client, mockConfig, {
      jobName: 'web-api',
      action: 'enable',
    });
    expect(result).toContain('enabled successfully');
    expect(client.enableJob).toHaveBeenCalledWith('web-api');
  });

  it('disables a job', async () => {
    const client = createMockClient();
    const result = await handleToggleJob(client, mockConfig, {
      jobName: 'web-api',
      action: 'disable',
    });
    expect(result).toContain('disabled successfully');
    expect(client.disableJob).toHaveBeenCalledWith('web-api');
  });

  it('throws for disallowed job', async () => {
    const client = createMockClient();
    const config = { ...mockConfig, allowedJobs: ['other'] };
    await expect(
      handleToggleJob(client, config, { jobName: 'web-api', action: 'enable' }),
    ).rejects.toThrow('not in the allowed jobs list');
  });
});
