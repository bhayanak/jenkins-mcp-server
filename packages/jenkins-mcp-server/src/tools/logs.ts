import { z } from 'zod';
import type { JenkinsClient } from '../client/jenkins-client.js';
import { isJobAllowed, type JenkinsConfig } from '../config.js';
import { truncateLog } from '../utils/formatter.js';

export const getBuildLogSchema = z.object({
  jobName: z.string().min(1).describe('Job name'),
  buildNumber: z
    .union([z.number(), z.literal('lastBuild')])
    .describe('Build number or "lastBuild"'),
  tail: z.number().optional().describe('Only return last N lines'),
});

export const searchLogsSchema = z.object({
  jobName: z.string().min(1).describe('Job name'),
  buildNumber: z
    .union([z.number(), z.literal('lastBuild')])
    .describe('Build number or "lastBuild"'),
  pattern: z.string().min(1).describe('Search pattern (regex supported)'),
});

export async function handleGetBuildLog(
  client: JenkinsClient,
  config: JenkinsConfig,
  params: z.infer<typeof getBuildLogSchema>,
): Promise<string> {
  if (!isJobAllowed(params.jobName, config.allowedJobs)) {
    throw new Error(`Job '${params.jobName}' is not in the allowed jobs list.`);
  }
  const { text, size } = await client.getBuildLog(params.jobName, params.buildNumber);
  const output = truncateLog(text, params.tail);
  return `Console Output: ${params.jobName} #${params.buildNumber}\nSize: ${size} bytes\n${'─'.repeat(50)}\n${output}`;
}

export async function handleSearchLogs(
  client: JenkinsClient,
  config: JenkinsConfig,
  params: z.infer<typeof searchLogsSchema>,
): Promise<string> {
  if (!isJobAllowed(params.jobName, config.allowedJobs)) {
    throw new Error(`Job '${params.jobName}' is not in the allowed jobs list.`);
  }
  const { text } = await client.getBuildLog(params.jobName, params.buildNumber);

  let regex: RegExp;
  try {
    regex = new RegExp(params.pattern, 'gi');
  } catch {
    throw new Error(`Invalid regex pattern: ${params.pattern}`);
  }

  const lines = text.split('\n');
  const matches: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (regex.test(lines[i])) {
      matches.push(`L${i + 1}: ${lines[i]}`);
    }
    regex.lastIndex = 0;
  }

  if (matches.length === 0) {
    return `No matches for /${params.pattern}/ in ${params.jobName} #${params.buildNumber}`;
  }

  return `Search: /${params.pattern}/ in ${params.jobName} #${params.buildNumber}\nMatches: ${matches.length}\n${'─'.repeat(50)}\n${matches.join('\n')}`;
}
