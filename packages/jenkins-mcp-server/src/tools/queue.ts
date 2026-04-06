import { z } from 'zod';
import type { JenkinsClient } from '../client/jenkins-client.js';
import type { JenkinsConfig } from '../config.js';
import { relativeTime, padRight } from '../utils/formatter.js';

export const listQueueSchema = z.object({});

export async function handleListQueue(
  client: JenkinsClient,
  _config: JenkinsConfig,
): Promise<string> {
  const items = await client.listQueue();

  if (items.length === 0) {
    return 'Build queue is empty.';
  }

  const header = `Build Queue\n\n${padRight('ID', 8)} ${padRight('Job', 30)} ${padRight('Waiting', 12)} ${padRight('Reason', 30)}\n${'━'.repeat(85)}`;

  const rows = items.map((item) => {
    const waiting = relativeTime(item.inQueueSince);
    const reason = item.why ?? (item.stuck ? 'Stuck' : item.blocked ? 'Blocked' : '–');
    return `${padRight(String(item.id), 8)} ${padRight(item.task.name, 30)} ${padRight(waiting, 12)} ${reason}`;
  });

  const stuck = items.filter((i) => i.stuck).length;
  const blocked = items.filter((i) => i.blocked).length;

  return `${header}\n${rows.join('\n')}\n\nTotal: ${items.length} queued | ${stuck} stuck | ${blocked} blocked`;
}
