import { describe, it, expect, vi } from 'vitest';
import { handleListQueue } from '../src/tools/queue.js';
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

describe('handleListQueue', () => {
  it('returns formatted queue', async () => {
    const client = {
      listQueue: vi.fn().mockResolvedValue([
        {
          id: 1,
          task: { name: 'web-api', url: '' },
          why: 'Waiting for executor',
          inQueueSince: Date.now() - 300000,
          stuck: false,
          blocked: false,
        },
        {
          id: 2,
          task: { name: 'data-pipeline', url: '' },
          why: null,
          inQueueSince: Date.now() - 600000,
          stuck: true,
          blocked: false,
        },
      ]),
    } as unknown as JenkinsClient;

    const result = await handleListQueue(client, mockConfig);
    expect(result).toContain('Build Queue');
    expect(result).toContain('web-api');
    expect(result).toContain('data-pipeline');
    expect(result).toContain('Stuck');
    expect(result).toContain('2 queued');
    expect(result).toContain('1 stuck');
  });

  it('returns empty queue message', async () => {
    const client = {
      listQueue: vi.fn().mockResolvedValue([]),
    } as unknown as JenkinsClient;
    const result = await handleListQueue(client, mockConfig);
    expect(result).toBe('Build queue is empty.');
  });

  it('shows blocked items', async () => {
    const client = {
      listQueue: vi.fn().mockResolvedValue([
        {
          id: 3,
          task: { name: 'blocked-job', url: '' },
          why: null,
          inQueueSince: Date.now(),
          stuck: false,
          blocked: true,
        },
      ]),
    } as unknown as JenkinsClient;
    const result = await handleListQueue(client, mockConfig);
    expect(result).toContain('Blocked');
    expect(result).toContain('1 blocked');
  });
});
