import { describe, it, expect, vi } from 'vitest';
import { handleListPlugins } from '../src/tools/plugins.js';
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

const mockPlugins = [
  {
    shortName: 'git',
    longName: 'Git plugin',
    version: '5.0.0',
    active: true,
    enabled: true,
    hasUpdate: false,
    url: '',
  },
  {
    shortName: 'pipeline',
    longName: 'Pipeline',
    version: '2.0',
    active: true,
    enabled: true,
    hasUpdate: true,
    url: '',
  },
  {
    shortName: 'ldap',
    longName: 'LDAP',
    version: '1.0',
    active: false,
    enabled: false,
    hasUpdate: false,
    url: '',
  },
];

function createMockClient(plugins = mockPlugins): JenkinsClient {
  return {
    listPlugins: vi.fn().mockResolvedValue(plugins),
  } as unknown as JenkinsClient;
}

describe('handleListPlugins', () => {
  it('returns formatted plugin list', async () => {
    const client = createMockClient();
    const result = await handleListPlugins(client, mockConfig, {});
    expect(result).toContain('Jenkins Plugins');
    expect(result).toContain('git');
    expect(result).toContain('pipeline');
    expect(result).toContain('ldap');
    expect(result).toContain('3 plugins');
    expect(result).toContain('1 with updates');
  });

  it('filters by name', async () => {
    const client = createMockClient();
    const result = await handleListPlugins(client, mockConfig, { filter: 'git' });
    expect(result).toContain('git');
    expect(result).not.toContain('pipeline');
    expect(result).toContain('1 plugins');
  });

  it('filters by long name', async () => {
    const client = createMockClient();
    const result = await handleListPlugins(client, mockConfig, { filter: 'Pipeline' });
    expect(result).toContain('pipeline');
  });

  it('shows updates only', async () => {
    const client = createMockClient();
    const result = await handleListPlugins(client, mockConfig, { updatesOnly: true });
    expect(result).toContain('pipeline');
    expect(result).not.toContain('git');
    expect(result).toContain('1 plugins');
  });

  it('returns no plugins message', async () => {
    const client = createMockClient([]);
    const result = await handleListPlugins(client, mockConfig, {});
    expect(result).toBe('No plugins found matching criteria.');
  });

  it('shows active status correctly', async () => {
    const client = createMockClient();
    const result = await handleListPlugins(client, mockConfig, {});
    expect(result).toContain('✅');
    expect(result).toContain('⚫');
  });
});
