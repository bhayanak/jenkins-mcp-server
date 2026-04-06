import { describe, it, expect, vi } from 'vitest';
import { handleListNodes, handleToggleNode } from '../src/tools/nodes.js';
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
    listNodes: vi.fn().mockResolvedValue([
      { displayName: 'built-in', offline: false, temporarilyOffline: false, numExecutors: 4 },
      { displayName: 'agent-01', offline: false, temporarilyOffline: false, numExecutors: 8 },
      { displayName: 'agent-02', offline: true, temporarilyOffline: false, numExecutors: 8 },
      { displayName: 'agent-03', offline: true, temporarilyOffline: true, numExecutors: 2 },
    ]),
    toggleNodeOffline: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as JenkinsClient;
}

describe('handleListNodes', () => {
  it('returns formatted node list', async () => {
    const client = createMockClient();
    const result = await handleListNodes(client, mockConfig);
    expect(result).toContain('Jenkins Nodes');
    expect(result).toContain('built-in');
    expect(result).toContain('🟢 Online');
    expect(result).toContain('🔴 Offline');
    expect(result).toContain('🟡 Temp Off');
    expect(result).toContain('2 online');
    expect(result).toContain('1 offline');
    expect(result).toContain('1 temporarily offline');
  });

  it('returns no nodes message', async () => {
    const client = createMockClient({ listNodes: vi.fn().mockResolvedValue([]) });
    const result = await handleListNodes(client, mockConfig);
    expect(result).toBe('No nodes found.');
  });
});

describe('handleToggleNode', () => {
  it('sets node offline with reason', async () => {
    const client = createMockClient();
    const result = await handleToggleNode(client, mockConfig, {
      nodeName: 'agent-01',
      action: 'offline',
      reason: 'maintenance',
    });
    expect(result).toContain('offline');
    expect(result).toContain('maintenance');
    expect(client.toggleNodeOffline).toHaveBeenCalledWith('agent-01', true, 'maintenance');
  });

  it('sets node online', async () => {
    const client = createMockClient();
    const result = await handleToggleNode(client, mockConfig, {
      nodeName: 'agent-01',
      action: 'online',
    });
    expect(result).toContain('online');
    expect(client.toggleNodeOffline).toHaveBeenCalledWith('agent-01', false, undefined);
  });
});
