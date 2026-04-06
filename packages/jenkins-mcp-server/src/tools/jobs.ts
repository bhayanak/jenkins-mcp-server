import { z } from 'zod';
import type { JenkinsClient } from '../client/jenkins-client.js';
import { isJobAllowed, type JenkinsConfig } from '../config.js';
import { statusEmoji, healthEmoji, relativeTime, padRight } from '../utils/formatter.js';
import { summarizeJobConfig } from '../utils/xml.js';

export const listJobsSchema = z.object({
  folder: z.string().optional().describe("Folder path (e.g., 'team-alpha/services')"),
  view: z.string().optional().describe('View name filter'),
  depth: z.number().optional().default(1),
});

export const getJobConfigSchema = z.object({
  jobName: z.string().min(1).describe('Full job name (including folder path)'),
});

export const createJobSchema = z.object({
  jobName: z.string().min(1).describe('New job name'),
  folder: z.string().optional().describe('Target folder'),
  configXml: z.string().min(1).describe('Jenkins job config.xml content'),
});

export const toggleJobSchema = z.object({
  jobName: z.string().min(1).describe('Job name'),
  action: z.enum(['enable', 'disable']).describe('Enable or disable'),
});

export async function handleListJobs(
  client: JenkinsClient,
  config: JenkinsConfig,
  params: z.infer<typeof listJobsSchema>,
): Promise<string> {
  const jobs = await client.listJobs(params.folder, params.depth);
  const filtered = jobs.filter((j) => isJobAllowed(j.fullName ?? j.name, config.allowedJobs));

  if (filtered.length === 0) {
    return 'No jobs found.';
  }

  const header = `Jenkins Jobs\n\n${padRight('Job Name', 30)} ${padRight('Status', 10)} ${padRight('Last Build', 16)} ${padRight('Health', 8)}\n${'━'.repeat(70)}`;

  const rows = filtered.map((j) => {
    const emoji = statusEmoji(j.color);
    const lastBuild = j.lastBuild
      ? `#${j.lastBuild.number}  ${relativeTime(j.lastBuild.timestamp)}`
      : 'none';
    const health =
      j.healthReport.length > 0
        ? `${healthEmoji(j.healthReport[0].score)} ${j.healthReport[0].score}%`
        : '–';
    return `${padRight(j.fullName ?? j.name, 30)} ${padRight(emoji, 10)} ${padRight(lastBuild, 16)} ${health}`;
  });

  const running = filtered.filter((j) => j.color?.endsWith('_anime')).length;
  const failed = filtered.filter((j) => j.color?.startsWith('red')).length;

  return `${header}\n${rows.join('\n')}\n\nTotal: ${filtered.length} jobs | ${running} running | ${failed} failed`;
}

export async function handleGetJobConfig(
  client: JenkinsClient,
  config: JenkinsConfig,
  params: z.infer<typeof getJobConfigSchema>,
): Promise<string> {
  if (!isJobAllowed(params.jobName, config.allowedJobs)) {
    throw new Error(`Job '${params.jobName}' is not in the allowed jobs list.`);
  }
  const xml = await client.getJobConfig(params.jobName);
  const summary = summarizeJobConfig(xml);
  return `Job Config: ${params.jobName}\n\n${summary}\n\n--- Raw XML ---\n${xml}`;
}

export async function handleCreateJob(
  client: JenkinsClient,
  _config: JenkinsConfig,
  params: z.infer<typeof createJobSchema>,
): Promise<string> {
  await client.createJob(params.jobName, params.configXml, params.folder);
  const location = params.folder ? `${params.folder}/${params.jobName}` : params.jobName;
  return `Job '${location}' created successfully.`;
}

export async function handleToggleJob(
  client: JenkinsClient,
  config: JenkinsConfig,
  params: z.infer<typeof toggleJobSchema>,
): Promise<string> {
  if (!isJobAllowed(params.jobName, config.allowedJobs)) {
    throw new Error(`Job '${params.jobName}' is not in the allowed jobs list.`);
  }
  if (params.action === 'enable') {
    await client.enableJob(params.jobName);
  } else {
    await client.disableJob(params.jobName);
  }
  return `Job '${params.jobName}' ${params.action}d successfully.`;
}
