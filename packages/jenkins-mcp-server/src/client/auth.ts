import type { JenkinsConfig } from '../config.js';

export interface CrumbData {
  crumbRequestField: string;
  crumb: string;
}

export function buildAuthHeader(user: string, token: string): string {
  return 'Basic ' + Buffer.from(`${user}:${token}`).toString('base64');
}

export async function fetchCrumb(config: JenkinsConfig): Promise<CrumbData> {
  const url = `${config.url}/crumbIssuer/api/json`;
  const resp = await fetch(url, {
    headers: {
      Authorization: buildAuthHeader(config.user, config.token),
    },
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  if (!resp.ok) {
    if (resp.status === 404) {
      throw new Error(
        'CSRF crumb issuer not found. Set JENKINS_MCP_USE_CRUMB=false if CSRF is disabled.',
      );
    }
    throw new Error(`Failed to fetch crumb: ${resp.status} ${resp.statusText}`);
  }

  const data = (await resp.json()) as CrumbData;
  return data;
}
