import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { JenkinsClient } from './client/jenkins-client.js';
import type { JenkinsConfig } from './config.js';

import {
  listJobsSchema,
  getJobConfigSchema,
  createJobSchema,
  toggleJobSchema,
  handleListJobs,
  handleGetJobConfig,
  handleCreateJob,
  handleToggleJob,
} from './tools/jobs.js';

import {
  triggerBuildSchema,
  getBuildSchema,
  abortBuildSchema,
  listBuildsSchema,
  handleTriggerBuild,
  handleGetBuild,
  handleAbortBuild,
  handleListBuilds,
} from './tools/builds.js';

import {
  getBuildLogSchema,
  searchLogsSchema,
  handleGetBuildLog,
  handleSearchLogs,
} from './tools/logs.js';

import {
  listNodesSchema,
  toggleNodeSchema,
  handleListNodes,
  handleToggleNode,
} from './tools/nodes.js';

import { listQueueSchema, handleListQueue } from './tools/queue.js';

import { listPluginsSchema, handleListPlugins } from './tools/plugins.js';

export function createServer(client: JenkinsClient, config: JenkinsConfig): McpServer {
  const server = new McpServer({
    name: 'Jenkins MCP Server',
    version: '0.1.0',
  });

  // Job tools
  server.tool(
    'jenkins_list_jobs',
    'List all Jenkins jobs with status, last build, and health info',
    listJobsSchema.shape,
    async (params) => {
      const text = await handleListJobs(client, config, listJobsSchema.parse(params));
      return { content: [{ type: 'text', text }] };
    },
  );

  server.tool(
    'jenkins_get_job_config',
    'Get Jenkins job configuration XML with summary',
    getJobConfigSchema.shape,
    async (params) => {
      const text = await handleGetJobConfig(client, config, getJobConfigSchema.parse(params));
      return { content: [{ type: 'text', text }] };
    },
  );

  server.tool(
    'jenkins_create_job',
    'Create a new Jenkins job from XML config',
    createJobSchema.shape,
    async (params) => {
      const text = await handleCreateJob(client, config, createJobSchema.parse(params));
      return { content: [{ type: 'text', text }] };
    },
  );

  server.tool(
    'jenkins_toggle_job',
    'Enable or disable a Jenkins job',
    toggleJobSchema.shape,
    async (params) => {
      const text = await handleToggleJob(client, config, toggleJobSchema.parse(params));
      return { content: [{ type: 'text', text }] };
    },
  );

  // Build tools
  server.tool(
    'jenkins_trigger_build',
    'Trigger a Jenkins build with optional parameters',
    triggerBuildSchema.shape,
    async (params) => {
      const text = await handleTriggerBuild(client, config, triggerBuildSchema.parse(params));
      return { content: [{ type: 'text', text }] };
    },
  );

  server.tool(
    'jenkins_get_build',
    'Get detailed build information including status, duration, and changes',
    getBuildSchema.shape,
    async (params) => {
      const text = await handleGetBuild(client, config, getBuildSchema.parse(params));
      return { content: [{ type: 'text', text }] };
    },
  );

  server.tool(
    'jenkins_abort_build',
    'Abort a running Jenkins build',
    abortBuildSchema.shape,
    async (params) => {
      const text = await handleAbortBuild(client, config, abortBuildSchema.parse(params));
      return { content: [{ type: 'text', text }] };
    },
  );

  server.tool(
    'jenkins_list_builds',
    'List recent builds for a job with optional status filter',
    listBuildsSchema.shape,
    async (params) => {
      const text = await handleListBuilds(client, config, listBuildsSchema.parse(params));
      return { content: [{ type: 'text', text }] };
    },
  );

  // Log tools
  server.tool(
    'jenkins_get_build_log',
    'Get console output for a Jenkins build',
    getBuildLogSchema.shape,
    async (params) => {
      const text = await handleGetBuildLog(client, config, getBuildLogSchema.parse(params));
      return { content: [{ type: 'text', text }] };
    },
  );

  server.tool(
    'jenkins_search_logs',
    'Search build logs for patterns using regex',
    searchLogsSchema.shape,
    async (params) => {
      const text = await handleSearchLogs(client, config, searchLogsSchema.parse(params));
      return { content: [{ type: 'text', text }] };
    },
  );

  // Node tools
  server.tool(
    'jenkins_list_nodes',
    'List all Jenkins agents/nodes with status and executor info',
    listNodesSchema.shape,
    async () => {
      const text = await handleListNodes(client, config);
      return { content: [{ type: 'text', text }] };
    },
  );

  server.tool(
    'jenkins_toggle_node',
    'Take a Jenkins node online or offline',
    toggleNodeSchema.shape,
    async (params) => {
      const text = await handleToggleNode(client, config, toggleNodeSchema.parse(params));
      return { content: [{ type: 'text', text }] };
    },
  );

  // Queue tools
  server.tool(
    'jenkins_list_queue',
    'View the Jenkins build queue',
    listQueueSchema.shape,
    async () => {
      const text = await handleListQueue(client, config);
      return { content: [{ type: 'text', text }] };
    },
  );

  // Plugin tools
  server.tool(
    'jenkins_list_plugins',
    'List installed Jenkins plugins with update info',
    listPluginsSchema.shape,
    async (params) => {
      const text = await handleListPlugins(client, config, listPluginsSchema.parse(params));
      return { content: [{ type: 'text', text }] };
    },
  );

  return server;
}
