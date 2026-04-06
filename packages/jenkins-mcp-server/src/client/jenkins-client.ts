import type { JenkinsConfig } from '../config.js';
import { buildAuthHeader, fetchCrumb, type CrumbData } from './auth.js';

export interface JobInfo {
  name: string;
  fullName: string;
  url: string;
  color: string;
  buildable: boolean;
  lastBuild: { number: number; result: string | null; timestamp: number } | null;
  healthReport: { score: number; description: string }[];
  inQueue: boolean;
}

export interface BuildInfo {
  number: number;
  result: string | null;
  building: boolean;
  duration: number;
  estimatedDuration: number;
  timestamp: number;
  url: string;
  displayName: string;
  actions: BuildAction[];
  changeSets: ChangeSet[];
}

export interface BuildAction {
  _class: string;
  parameters?: { name: string; value: string }[];
  causes?: { shortDescription: string; userId?: string }[];
}

export interface ChangeSet {
  items: { commitId: string; msg: string; author: { fullName: string } }[];
}

export interface NodeInfo {
  displayName: string;
  offline: boolean;
  temporarilyOffline: boolean;
  numExecutors: number;
  idle: boolean;
  offlineCauseReason: string | null;
  monitorData: Record<string, unknown>;
}

export interface QueueItem {
  id: number;
  task: { name: string; url: string };
  why: string | null;
  inQueueSince: number;
  stuck: boolean;
  blocked: boolean;
}

export interface PluginInfo {
  shortName: string;
  longName: string;
  version: string;
  active: boolean;
  enabled: boolean;
  hasUpdate: boolean;
  url: string;
}

function encodeJobPath(jobName: string): string {
  return jobName
    .split('/')
    .map((segment) => `job/${encodeURIComponent(segment)}`)
    .join('/');
}

function validateJobName(jobName: string): void {
  if (jobName.includes('..') || jobName.startsWith('/')) {
    throw new Error('Invalid job name: path traversal detected');
  }
}

function validateNodeName(nodeName: string): void {
  if (nodeName.includes('..') || nodeName.includes('/')) {
    throw new Error('Invalid node name: path traversal detected');
  }
}

export class JenkinsClient {
  private crumbCache: CrumbData | null = null;
  private crumbExpiry = 0;

  constructor(private config: JenkinsConfig) {}

  private async getHeaders(method: string): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      Authorization: buildAuthHeader(this.config.user, this.config.token),
    };

    if (method !== 'GET' && this.config.useCrumb) {
      if (!this.crumbCache || Date.now() > this.crumbExpiry) {
        this.crumbCache = await fetchCrumb(this.config);
        this.crumbExpiry = Date.now() + 5 * 60 * 1000;
      }
      headers[this.crumbCache.crumbRequestField] = this.crumbCache.crumb;
    }

    return headers;
  }

  private async request(path: string, options: RequestInit = {}): Promise<Response> {
    const method = options.method ?? 'GET';
    const headers = await this.getHeaders(method);

    if (options.headers) {
      Object.assign(headers, options.headers);
    }

    const url = `${this.config.url}${path}`;
    const resp = await fetch(url, {
      ...options,
      method,
      headers,
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });

    return resp;
  }

  private async jsonRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
    const resp = await this.request(path, options);
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw new Error(`Jenkins API error: ${resp.status} ${resp.statusText} - ${body}`);
    }
    return (await resp.json()) as T;
  }

  // Jobs
  async listJobs(folder?: string, depth?: number): Promise<JobInfo[]> {
    const d = depth ?? this.config.depth;
    const basePath = folder ? `/${encodeJobPath(folder)}` : '';
    const data = await this.jsonRequest<{ jobs: JobInfo[] }>(
      `${basePath}/api/json?depth=${d}&tree=jobs[name,fullName,url,color,buildable,lastBuild[number,result,timestamp],healthReport[score,description],inQueue]`,
    );
    return data.jobs ?? [];
  }

  async getJobConfig(jobName: string): Promise<string> {
    validateJobName(jobName);
    const resp = await this.request(`/${encodeJobPath(jobName)}/config.xml`);
    if (!resp.ok) {
      throw new Error(`Failed to get job config: ${resp.status} ${resp.statusText}`);
    }
    return resp.text();
  }

  async createJob(jobName: string, configXml: string, folder?: string): Promise<void> {
    validateJobName(jobName);
    const basePath = folder ? `/${encodeJobPath(folder)}` : '';
    const resp = await this.request(`${basePath}/createItem?name=${encodeURIComponent(jobName)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml' },
      body: configXml,
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw new Error(`Failed to create job: ${resp.status} ${resp.statusText} - ${body}`);
    }
  }

  async enableJob(jobName: string): Promise<void> {
    validateJobName(jobName);
    const resp = await this.request(`/${encodeJobPath(jobName)}/enable`, { method: 'POST' });
    if (!resp.ok) {
      throw new Error(`Failed to enable job: ${resp.status} ${resp.statusText}`);
    }
  }

  async disableJob(jobName: string): Promise<void> {
    validateJobName(jobName);
    const resp = await this.request(`/${encodeJobPath(jobName)}/disable`, { method: 'POST' });
    if (!resp.ok) {
      throw new Error(`Failed to disable job: ${resp.status} ${resp.statusText}`);
    }
  }

  // Builds
  async triggerBuild(
    jobName: string,
    params?: Record<string, string>,
  ): Promise<{ queueUrl: string }> {
    validateJobName(jobName);
    let path: string;
    let body: string | undefined;
    const headers: Record<string, string> = {};

    if (params && Object.keys(params).length > 0) {
      path = `/${encodeJobPath(jobName)}/buildWithParameters`;
      const formData = new URLSearchParams(params).toString();
      body = formData;
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    } else {
      path = `/${encodeJobPath(jobName)}/build`;
    }

    const resp = await this.request(path, { method: 'POST', headers, body });
    if (!resp.ok) {
      throw new Error(`Failed to trigger build: ${resp.status} ${resp.statusText}`);
    }

    const location = resp.headers.get('Location') ?? '';
    return { queueUrl: location };
  }

  async getBuild(jobName: string, buildNumber: number | string): Promise<BuildInfo> {
    validateJobName(jobName);
    return this.jsonRequest<BuildInfo>(
      `/${encodeJobPath(jobName)}/${buildNumber}/api/json?depth=1`,
    );
  }

  async abortBuild(jobName: string, buildNumber: number): Promise<void> {
    validateJobName(jobName);
    const resp = await this.request(`/${encodeJobPath(jobName)}/${buildNumber}/stop`, {
      method: 'POST',
    });
    if (!resp.ok) {
      throw new Error(`Failed to abort build: ${resp.status} ${resp.statusText}`);
    }
  }

  async listBuilds(jobName: string, limit = 10): Promise<BuildInfo[]> {
    validateJobName(jobName);
    const data = await this.jsonRequest<{ builds: BuildInfo[] }>(
      `/${encodeJobPath(jobName)}/api/json?tree=builds[number,result,building,duration,estimatedDuration,timestamp,url,displayName,actions[parameters[name,value],causes[shortDescription,userId]],changeSets[items[commitId,msg,author[fullName]]]]{0,${limit}}`,
    );
    return data.builds ?? [];
  }

  // Logs
  async getBuildLog(
    jobName: string,
    buildNumber: number | string,
    _startByte = 0,
  ): Promise<{ text: string; size: number }> {
    validateJobName(jobName);
    const resp = await this.request(`/${encodeJobPath(jobName)}/${buildNumber}/consoleText`);
    if (!resp.ok) {
      throw new Error(`Failed to get build log: ${resp.status} ${resp.statusText}`);
    }
    const text = await resp.text();
    const truncated =
      text.length > this.config.maxLogSize
        ? text.slice(text.length - this.config.maxLogSize)
        : text;
    return { text: truncated, size: text.length };
  }

  // Nodes
  async listNodes(): Promise<NodeInfo[]> {
    const data = await this.jsonRequest<{ computer: NodeInfo[] }>('/computer/api/json?depth=1');
    return data.computer ?? [];
  }

  async toggleNodeOffline(nodeName: string, offline: boolean, reason?: string): Promise<void> {
    validateNodeName(nodeName);
    const encodedName = nodeName === '(built-in)' ? '(built-in)' : encodeURIComponent(nodeName);
    // toggleOffline endpoint handles both directions
    const params = new URLSearchParams();
    if (reason) params.set('offlineMessage', reason);

    const path = offline
      ? `/computer/${encodedName}/toggleOffline?${params.toString()}`
      : `/computer/${encodedName}/toggleOffline`;

    const resp = await this.request(path, { method: 'POST' });
    if (!resp.ok) {
      throw new Error(`Failed to toggle node: ${resp.status} ${resp.statusText}`);
    }
  }

  // Queue
  async listQueue(): Promise<QueueItem[]> {
    const data = await this.jsonRequest<{ items: QueueItem[] }>('/queue/api/json');
    return data.items ?? [];
  }

  async cancelQueueItem(id: number): Promise<void> {
    const resp = await this.request(`/queue/cancelItem?id=${id}`, { method: 'POST' });
    if (!resp.ok) {
      throw new Error(`Failed to cancel queue item: ${resp.status} ${resp.statusText}`);
    }
  }

  // Plugins
  async listPlugins(): Promise<PluginInfo[]> {
    const data = await this.jsonRequest<{ plugins: PluginInfo[] }>(
      '/pluginManager/api/json?depth=1',
    );
    return data.plugins ?? [];
  }
}
