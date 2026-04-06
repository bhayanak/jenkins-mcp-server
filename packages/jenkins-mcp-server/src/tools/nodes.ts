import { z } from 'zod';
import type { JenkinsClient } from '../client/jenkins-client.js';
import type { JenkinsConfig } from '../config.js';
import { padRight } from '../utils/formatter.js';

export const listNodesSchema = z.object({});

export const toggleNodeSchema = z.object({
  nodeName: z.string().min(1).describe('Node name'),
  action: z.enum(['online', 'offline']).describe('Online or offline'),
  reason: z.string().optional().describe('Reason for taking offline'),
});

export async function handleListNodes(
  client: JenkinsClient,
  _config: JenkinsConfig,
): Promise<string> {
  const nodes = await client.listNodes();

  if (nodes.length === 0) {
    return 'No nodes found.';
  }

  const header = `Jenkins Nodes\n\n${padRight('Node Name', 25)} ${padRight('Status', 14)} ${padRight('Executors', 12)}\n${'━'.repeat(55)}`;

  const rows = nodes.map((n) => {
    let status: string;
    if (n.temporarilyOffline) {
      status = '🟡 Temp Off';
    } else if (n.offline) {
      status = '🔴 Offline';
    } else {
      status = '🟢 Online';
    }
    return `${padRight(n.displayName, 25)} ${padRight(status, 14)} ${n.numExecutors}`;
  });

  const online = nodes.filter((n) => !n.offline).length;
  const offline = nodes.filter((n) => n.offline && !n.temporarilyOffline).length;
  const tempOff = nodes.filter((n) => n.temporarilyOffline).length;

  return `${header}\n${rows.join('\n')}\n\nTotal: ${nodes.length} nodes | ${online} online | ${offline} offline | ${tempOff} temporarily offline`;
}

export async function handleToggleNode(
  client: JenkinsClient,
  _config: JenkinsConfig,
  params: z.infer<typeof toggleNodeSchema>,
): Promise<string> {
  const offline = params.action === 'offline';
  await client.toggleNodeOffline(params.nodeName, offline, params.reason);
  const reasonStr = params.reason ? ` (reason: ${params.reason})` : '';
  return `Node '${params.nodeName}' set to ${params.action}${reasonStr}.`;
}
