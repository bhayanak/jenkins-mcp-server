import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JenkinsClient } from '../src/client/jenkins-client.js';
import type { JenkinsConfig } from '../src/config.js';
import jobListFixture from './fixtures/job-list.json';
import buildInfoFixture from './fixtures/build-info.json';
import nodeListFixture from './fixtures/node-list.json';

const baseConfig: JenkinsConfig = {
  url: 'https://ci.example.com',
  user: 'admin',
  token: 'token123',
  useCrumb: false,
  maxLogSize: 1_048_576,
  timeoutMs: 30_000,
  allowedJobs: [],
  depth: 1,
};

function mockFetch(response: Partial<Response> & { ok: boolean }) {
  const fn = vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 500),
    statusText: response.statusText ?? (response.ok ? 'OK' : 'Error'),
    json: response.json ?? (async () => ({})),
    text: response.text ?? (async () => ''),
    headers: response.headers ?? new Headers(),
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('JenkinsClient', () => {
  let client: JenkinsClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    client = new JenkinsClient(baseConfig);
  });

  describe('listJobs', () => {
    it('returns job list', async () => {
      mockFetch({ ok: true, json: async () => jobListFixture });
      const jobs = await client.listJobs();
      expect(jobs).toHaveLength(3);
      expect(jobs[0].name).toBe('web-api');
    });

    it('handles folder path', async () => {
      const fn = mockFetch({ ok: true, json: async () => ({ jobs: [] }) });
      await client.listJobs('team/services');
      expect(fn).toHaveBeenCalledWith(
        expect.stringContaining('/job/team/job/services/api/json'),
        expect.anything(),
      );
    });

    it('returns empty array when no jobs', async () => {
      mockFetch({ ok: true, json: async () => ({}) });
      const jobs = await client.listJobs();
      expect(jobs).toEqual([]);
    });
  });

  describe('getJobConfig', () => {
    it('returns XML config', async () => {
      mockFetch({ ok: true, text: async () => '<project></project>' });
      const xml = await client.getJobConfig('web-api');
      expect(xml).toBe('<project></project>');
    });

    it('throws on error', async () => {
      mockFetch({ ok: false, status: 404, statusText: 'Not Found' });
      await expect(client.getJobConfig('missing')).rejects.toThrow('Failed to get job config');
    });

    it('rejects path traversal', async () => {
      await expect(client.getJobConfig('../etc/passwd')).rejects.toThrow('path traversal');
    });

    it('rejects absolute paths', async () => {
      await expect(client.getJobConfig('/etc/passwd')).rejects.toThrow('path traversal');
    });
  });

  describe('createJob', () => {
    it('creates job successfully', async () => {
      const fn = mockFetch({ ok: true });
      await client.createJob('new-job', '<project></project>');
      expect(fn).toHaveBeenCalledWith(
        expect.stringContaining('/createItem?name=new-job'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('creates job in folder', async () => {
      const fn = mockFetch({ ok: true });
      await client.createJob('new-job', '<project></project>', 'team');
      expect(fn).toHaveBeenCalledWith(
        expect.stringContaining('/job/team/createItem?name=new-job'),
        expect.anything(),
      );
    });

    it('throws on failure', async () => {
      mockFetch({ ok: false, status: 400, statusText: 'Bad Request', text: async () => 'exists' });
      await expect(client.createJob('dup', '<p/>')).rejects.toThrow('Failed to create job');
    });
  });

  describe('enableJob / disableJob', () => {
    it('enables a job', async () => {
      const fn = mockFetch({ ok: true });
      await client.enableJob('web-api');
      expect(fn).toHaveBeenCalledWith(
        expect.stringContaining('/job/web-api/enable'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('disables a job', async () => {
      const fn = mockFetch({ ok: true });
      await client.disableJob('web-api');
      expect(fn).toHaveBeenCalledWith(
        expect.stringContaining('/job/web-api/disable'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('throws on enable failure', async () => {
      mockFetch({ ok: false, status: 500, statusText: 'Error' });
      await expect(client.enableJob('x')).rejects.toThrow('Failed to enable job');
    });

    it('throws on disable failure', async () => {
      mockFetch({ ok: false, status: 500, statusText: 'Error' });
      await expect(client.disableJob('x')).rejects.toThrow('Failed to disable job');
    });
  });

  describe('triggerBuild', () => {
    it('triggers without params', async () => {
      const fn = mockFetch({
        ok: true,
        headers: new Headers({ Location: 'https://ci.example.com/queue/item/123/' }),
      });
      const result = await client.triggerBuild('web-api');
      expect(result.queueUrl).toContain('queue/item/123');
      expect(fn).toHaveBeenCalledWith(
        expect.stringContaining('/job/web-api/build'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('triggers with params', async () => {
      const fn = mockFetch({
        ok: true,
        headers: new Headers({ Location: '' }),
      });
      await client.triggerBuild('web-api', { branch: 'main' });
      expect(fn).toHaveBeenCalledWith(
        expect.stringContaining('/job/web-api/buildWithParameters'),
        expect.objectContaining({ method: 'POST', body: 'branch=main' }),
      );
    });

    it('throws on failure', async () => {
      mockFetch({ ok: false, status: 403, statusText: 'Forbidden' });
      await expect(client.triggerBuild('web-api')).rejects.toThrow('Failed to trigger build');
    });
  });

  describe('getBuild', () => {
    it('returns build info', async () => {
      mockFetch({ ok: true, json: async () => buildInfoFixture });
      const build = await client.getBuild('web-api', 342);
      expect(build.number).toBe(342);
      expect(build.result).toBe('SUCCESS');
    });

    it('supports aliases like lastBuild', async () => {
      const fn = mockFetch({ ok: true, json: async () => buildInfoFixture });
      await client.getBuild('web-api', 'lastBuild');
      expect(fn).toHaveBeenCalledWith(
        expect.stringContaining('/job/web-api/lastBuild/api/json'),
        expect.anything(),
      );
    });
  });

  describe('abortBuild', () => {
    it('aborts a build', async () => {
      const fn = mockFetch({ ok: true });
      await client.abortBuild('web-api', 342);
      expect(fn).toHaveBeenCalledWith(
        expect.stringContaining('/job/web-api/342/stop'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('throws on failure', async () => {
      mockFetch({ ok: false, status: 404, statusText: 'Not Found' });
      await expect(client.abortBuild('web-api', 999)).rejects.toThrow('Failed to abort build');
    });
  });

  describe('listBuilds', () => {
    it('returns build list', async () => {
      mockFetch({
        ok: true,
        json: async () => ({ builds: [buildInfoFixture] }),
      });
      const builds = await client.listBuilds('web-api', 5);
      expect(builds).toHaveLength(1);
    });

    it('returns empty array when no builds', async () => {
      mockFetch({ ok: true, json: async () => ({}) });
      const builds = await client.listBuilds('web-api');
      expect(builds).toEqual([]);
    });
  });

  describe('getBuildLog', () => {
    it('returns log text', async () => {
      mockFetch({ ok: true, text: async () => 'line1\nline2\nline3' });
      const { text, size } = await client.getBuildLog('web-api', 342);
      expect(text).toBe('line1\nline2\nline3');
      expect(size).toBe(17);
    });

    it('truncates large logs', async () => {
      const largeLog = 'x'.repeat(2_000_000);
      const smallConfig = { ...baseConfig, maxLogSize: 100 };
      const smallClient = new JenkinsClient(smallConfig);
      mockFetch({ ok: true, text: async () => largeLog });
      const { text, size } = await smallClient.getBuildLog('web-api', 1);
      expect(text.length).toBe(100);
      expect(size).toBe(2_000_000);
    });

    it('throws on failure', async () => {
      mockFetch({ ok: false, status: 404, statusText: 'Not Found' });
      await expect(client.getBuildLog('web-api', 999)).rejects.toThrow('Failed to get build log');
    });
  });

  describe('listNodes', () => {
    it('returns node list', async () => {
      mockFetch({ ok: true, json: async () => nodeListFixture });
      const nodes = await client.listNodes();
      expect(nodes).toHaveLength(4);
      expect(nodes[0].displayName).toBe('built-in');
    });

    it('returns empty array when no nodes', async () => {
      mockFetch({ ok: true, json: async () => ({}) });
      const nodes = await client.listNodes();
      expect(nodes).toEqual([]);
    });
  });

  describe('toggleNodeOffline', () => {
    it('takes node offline', async () => {
      const fn = mockFetch({ ok: true });
      await client.toggleNodeOffline('agent-linux-01', true, 'maintenance');
      expect(fn).toHaveBeenCalledWith(
        expect.stringContaining('/computer/agent-linux-01/toggleOffline'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('brings node online', async () => {
      mockFetch({ ok: true });
      await client.toggleNodeOffline('agent-linux-01', false);
    });

    it('throws on failure', async () => {
      mockFetch({ ok: false, status: 500, statusText: 'Error' });
      await expect(client.toggleNodeOffline('x', true)).rejects.toThrow('Failed to toggle node');
    });

    it('rejects path traversal in node name', async () => {
      await expect(client.toggleNodeOffline('../hack', true)).rejects.toThrow('path traversal');
    });

    it('rejects slash in node name', async () => {
      await expect(client.toggleNodeOffline('a/b', true)).rejects.toThrow('path traversal');
    });
  });

  describe('listQueue', () => {
    it('returns queue items', async () => {
      mockFetch({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 1,
              task: { name: 'web-api', url: '' },
              why: 'Waiting for executor',
              inQueueSince: Date.now(),
              stuck: false,
              blocked: false,
            },
          ],
        }),
      });
      const items = await client.listQueue();
      expect(items).toHaveLength(1);
    });

    it('returns empty array', async () => {
      mockFetch({ ok: true, json: async () => ({}) });
      const items = await client.listQueue();
      expect(items).toEqual([]);
    });
  });

  describe('cancelQueueItem', () => {
    it('cancels a queue item', async () => {
      const fn = mockFetch({ ok: true });
      await client.cancelQueueItem(123);
      expect(fn).toHaveBeenCalledWith(
        expect.stringContaining('/queue/cancelItem?id=123'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('throws on failure', async () => {
      mockFetch({ ok: false, status: 404, statusText: 'Not Found' });
      await expect(client.cancelQueueItem(999)).rejects.toThrow('Failed to cancel queue item');
    });
  });

  describe('listPlugins', () => {
    it('returns plugin list', async () => {
      mockFetch({
        ok: true,
        json: async () => ({
          plugins: [
            {
              shortName: 'git',
              longName: 'Git plugin',
              version: '5.0.0',
              active: true,
              enabled: true,
              hasUpdate: false,
              url: '',
            },
          ],
        }),
      });
      const plugins = await client.listPlugins();
      expect(plugins).toHaveLength(1);
      expect(plugins[0].shortName).toBe('git');
    });

    it('returns empty array', async () => {
      mockFetch({ ok: true, json: async () => ({}) });
      const plugins = await client.listPlugins();
      expect(plugins).toEqual([]);
    });
  });

  describe('CSRF crumb handling', () => {
    it('fetches crumb for POST when useCrumb is true', async () => {
      const crumbClient = new JenkinsClient({ ...baseConfig, useCrumb: true });
      const fn = vi.fn();

      // First call: crumb fetch
      fn.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ crumbRequestField: 'Jenkins-Crumb', crumb: 'xyz' }),
      });
      // Second call: actual POST
      fn.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
      });

      vi.stubGlobal('fetch', fn);
      await crumbClient.triggerBuild('web-api');

      expect(fn).toHaveBeenCalledTimes(2);
      // The POST call should include the crumb header
      const postCall = fn.mock.calls[1];
      expect(postCall[1].headers['Jenkins-Crumb']).toBe('xyz');
    });
  });
});
