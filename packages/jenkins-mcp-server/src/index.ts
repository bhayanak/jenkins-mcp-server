#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { JenkinsClient } from './client/jenkins-client.js';
import { createServer } from './server.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const client = new JenkinsClient(config);
  const server = createServer(client, config);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[Jenkins MCP Server] Started on stdio transport');
}

main().catch((err) => {
  console.error('[Jenkins MCP Server] Fatal error:', err);
  process.exit(1);
});
