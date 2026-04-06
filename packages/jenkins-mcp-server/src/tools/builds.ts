import { z } from 'zod';
import type { JenkinsClient } from '../client/jenkins-client.js';
import { isJobAllowed, type JenkinsConfig } from '../config.js';
import { resultEmoji, formatDuration, relativeTime, padRight } from '../utils/formatter.js';

export const triggerBuildSchema = z.object({
  jobName: z.string().min(1).describe('Job name'),
  parameters: z.record(z.string()).optional().describe('Build parameters key-value pairs'),
  wait: z.boolean().optional().default(false).describe('Wait for build to complete'),
});

export const getBuildSchema = z.object({
  jobName: z.string().min(1).describe('Job name'),
  buildNumber: z
    .union([z.number(), z.enum(['lastBuild', 'lastSuccessfulBuild', 'lastFailedBuild'])])
    .describe('Build number or alias'),
});

export const abortBuildSchema = z.object({
  jobName: z.string().min(1).describe('Job name'),
  buildNumber: z.number().describe('Build number to abort'),
});

export const listBuildsSchema = z.object({
  jobName: z.string().min(1).describe('Job name'),
  limit: z.number().optional().default(10),
  status: z.enum(['all', 'success', 'failure', 'unstable', 'aborted']).optional(),
});

export async function handleTriggerBuild(
  client: JenkinsClient,
  config: JenkinsConfig,
  params: z.infer<typeof triggerBuildSchema>,
): Promise<string> {
  if (!isJobAllowed(params.jobName, config.allowedJobs)) {
    throw new Error(`Job '${params.jobName}' is not in the allowed jobs list.`);
  }
  const result = await client.triggerBuild(params.jobName, params.parameters);
  const paramStr = params.parameters ? '\nParameters: ' + JSON.stringify(params.parameters) : '';
  return `Build Triggered\n\nJob: ${params.jobName}\nQueue Location: ${result.queueUrl}${paramStr}`;
}

export async function handleGetBuild(
  client: JenkinsClient,
  config: JenkinsConfig,
  params: z.infer<typeof getBuildSchema>,
): Promise<string> {
  if (!isJobAllowed(params.jobName, config.allowedJobs)) {
    throw new Error(`Job '${params.jobName}' is not in the allowed jobs list.`);
  }
  const build = await client.getBuild(params.jobName, params.buildNumber);
  const emoji = resultEmoji(build.result, build.building);
  const status = build.building ? 'RUNNING' : (build.result ?? 'UNKNOWN');

  const lines = [
    `Build #${build.number} — ${emoji} ${status}`,
    `Job: ${params.jobName}`,
    `Duration: ${formatDuration(build.duration)}`,
    `Started: ${relativeTime(build.timestamp)}`,
    `URL: ${build.url}`,
  ];

  const causes = build.actions?.flatMap((a) => a.causes ?? []).map((c) => c.shortDescription);
  if (causes && causes.length > 0) {
    lines.push(`Cause: ${causes.join(', ')}`);
  }

  const buildParams = build.actions
    ?.flatMap((a) => a.parameters ?? [])
    .map((p) => `  ${p.name} = ${p.value}`);
  if (buildParams && buildParams.length > 0) {
    lines.push(`Parameters:\n${buildParams.join('\n')}`);
  }

  return lines.join('\n');
}

export async function handleAbortBuild(
  client: JenkinsClient,
  config: JenkinsConfig,
  params: z.infer<typeof abortBuildSchema>,
): Promise<string> {
  if (!isJobAllowed(params.jobName, config.allowedJobs)) {
    throw new Error(`Job '${params.jobName}' is not in the allowed jobs list.`);
  }
  await client.abortBuild(params.jobName, params.buildNumber);
  return `Build #${params.buildNumber} of '${params.jobName}' aborted.`;
}

export async function handleListBuilds(
  client: JenkinsClient,
  config: JenkinsConfig,
  params: z.infer<typeof listBuildsSchema>,
): Promise<string> {
  if (!isJobAllowed(params.jobName, config.allowedJobs)) {
    throw new Error(`Job '${params.jobName}' is not in the allowed jobs list.`);
  }
  let builds = await client.listBuilds(params.jobName, params.limit);

  if (params.status && params.status !== 'all') {
    const statusMap: Record<string, string> = {
      success: 'SUCCESS',
      failure: 'FAILURE',
      unstable: 'UNSTABLE',
      aborted: 'ABORTED',
    };
    const target = statusMap[params.status];
    builds = builds.filter((b) => b.result === target);
  }

  if (builds.length === 0) {
    return `No builds found for '${params.jobName}'.`;
  }

  const header = `Builds: ${params.jobName}\n\n${padRight('#', 8)} ${padRight('Status', 12)} ${padRight('Duration', 12)} ${padRight('When', 12)}\n${'━'.repeat(50)}`;

  const rows = builds.map((b) => {
    const emoji = resultEmoji(b.result, b.building);
    const status = b.building ? 'RUNNING' : (b.result ?? 'UNKNOWN');
    return `${padRight(`#${b.number}`, 8)} ${padRight(`${emoji} ${status}`, 12)} ${padRight(formatDuration(b.duration), 12)} ${relativeTime(b.timestamp)}`;
  });

  return `${header}\n${rows.join('\n')}`;
}
