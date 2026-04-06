import { z } from 'zod';

const configSchema = z.object({
  url: z
    .string()
    .url()
    .refine((u) => u.startsWith('https://') || u.startsWith('http://'), {
      message: 'Must be a valid HTTP(S) URL',
    }),
  user: z.string().min(1, 'JENKINS_MCP_USER is required'),
  token: z.string().min(1, 'JENKINS_MCP_TOKEN is required'),
  useCrumb: z.boolean().default(true),
  maxLogSize: z.number().positive().default(1_048_576),
  timeoutMs: z.number().positive().default(30_000),
  allowedJobs: z.array(z.string()).default([]),
  depth: z.number().int().min(0).default(1),
});

export type JenkinsConfig = z.infer<typeof configSchema>;

export function loadConfig(env: Record<string, string | undefined> = process.env): JenkinsConfig {
  const url = (env.JENKINS_MCP_URL ?? '').replace(/\/+$/, '');
  const raw = {
    url,
    user: env.JENKINS_MCP_USER ?? '',
    token: env.JENKINS_MCP_TOKEN ?? '',
    useCrumb: env.JENKINS_MCP_USE_CRUMB !== 'false',
    maxLogSize: env.JENKINS_MCP_MAX_LOG_SIZE ? Number(env.JENKINS_MCP_MAX_LOG_SIZE) : 1_048_576,
    timeoutMs: env.JENKINS_MCP_TIMEOUT_MS ? Number(env.JENKINS_MCP_TIMEOUT_MS) : 30_000,
    allowedJobs: env.JENKINS_MCP_ALLOWED_JOBS
      ? env.JENKINS_MCP_ALLOWED_JOBS.split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
    depth: env.JENKINS_MCP_DEPTH ? Number(env.JENKINS_MCP_DEPTH) : 1,
  };

  const result = configSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid Jenkins MCP configuration: ${issues}`);
  }

  if (result.data.url.startsWith('http://')) {
    console.warn(
      '[Jenkins MCP Server] WARNING: Using HTTP instead of HTTPS. Credentials will be sent in plaintext.',
    );
  }

  return result.data;
}

export function isJobAllowed(jobName: string, allowedJobs: string[]): boolean {
  if (allowedJobs.length === 0) return true;
  return allowedJobs.some((allowed) => jobName === allowed || jobName.startsWith(allowed + '/'));
}
