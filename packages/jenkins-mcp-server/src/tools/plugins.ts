import { z } from 'zod';
import type { JenkinsClient } from '../client/jenkins-client.js';
import type { JenkinsConfig } from '../config.js';
import { padRight } from '../utils/formatter.js';

export const listPluginsSchema = z.object({
  filter: z.string().optional().describe('Filter by plugin name'),
  updatesOnly: z.boolean().optional().default(false),
});

export async function handleListPlugins(
  client: JenkinsClient,
  _config: JenkinsConfig,
  params: z.infer<typeof listPluginsSchema>,
): Promise<string> {
  let plugins = await client.listPlugins();

  if (params.filter) {
    const lower = params.filter.toLowerCase();
    plugins = plugins.filter(
      (p) => p.shortName.toLowerCase().includes(lower) || p.longName.toLowerCase().includes(lower),
    );
  }

  if (params.updatesOnly) {
    plugins = plugins.filter((p) => p.hasUpdate);
  }

  if (plugins.length === 0) {
    return 'No plugins found matching criteria.';
  }

  const header = `Jenkins Plugins\n\n${padRight('Name', 35)} ${padRight('Version', 14)} ${padRight('Active', 8)} ${padRight('Update', 8)}\n${'━'.repeat(70)}`;

  const rows = plugins.map((p) => {
    const active = p.active && p.enabled ? '✅' : '⚫';
    const update = p.hasUpdate ? '⬆️' : '–';
    return `${padRight(p.shortName, 35)} ${padRight(p.version, 14)} ${padRight(active, 8)} ${update}`;
  });

  const withUpdates = plugins.filter((p) => p.hasUpdate).length;
  return `${header}\n${rows.join('\n')}\n\nTotal: ${plugins.length} plugins | ${withUpdates} with updates`;
}
