<p align="center">
  <img src="../../assets/logo.png" alt="Jenkins MCP Server" width="120" />
</p>

# Jenkins MCP Server

MCP server for Jenkins CI/CD — 14 tools for job management, build operations, console logs, node health, queue monitoring, and plugin info.

## Configuration

Set these environment variables:

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `JENKINS_MCP_URL` | Yes | Jenkins controller URL | — |
| `JENKINS_MCP_USER` | Yes | Jenkins username | — |
| `JENKINS_MCP_TOKEN` | Yes | Jenkins API token | — |
| `JENKINS_MCP_USE_CRUMB` | No | CSRF crumb support | `true` |
| `JENKINS_MCP_MAX_LOG_SIZE` | No | Max log bytes | `1048576` |
| `JENKINS_MCP_TIMEOUT_MS` | No | Request timeout (ms) | `30000` |
| `JENKINS_MCP_ALLOWED_JOBS` | No | Comma-separated allow-list | all |
| `JENKINS_MCP_DEPTH` | No | Jenkins API depth | `1` |

## Tools

### Job Management

#### `jenkins_list_jobs`
List all jobs with status, last build, and health information.
```json
{ "folder": "team-alpha/services", "depth": 1 }
```

#### `jenkins_get_job_config`
Get job configuration XML with a summary of key fields.
```json
{ "jobName": "web-api" }
```

#### `jenkins_create_job`
Create a new job from XML configuration.
```json
{ "jobName": "new-job", "folder": "team", "configXml": "<project>...</project>" }
```

#### `jenkins_toggle_job`
Enable or disable a job.
```json
{ "jobName": "web-api", "action": "disable" }
```

### Build Operations

#### `jenkins_trigger_build`
Trigger a build with optional parameters.
```json
{ "jobName": "web-api", "parameters": { "branch": "main" } }
```

#### `jenkins_get_build`
Get detailed build information.
```json
{ "jobName": "web-api", "buildNumber": 342 }
```
Supports aliases: `lastBuild`, `lastSuccessfulBuild`, `lastFailedBuild`.

#### `jenkins_abort_build`
Abort a running build.
```json
{ "jobName": "web-api", "buildNumber": 343 }
```

#### `jenkins_list_builds`
List recent builds with optional status filter.
```json
{ "jobName": "web-api", "limit": 10, "status": "failure" }
```

### Build Logs

#### `jenkins_get_build_log`
Get console output with optional tail.
```json
{ "jobName": "web-api", "buildNumber": "lastBuild", "tail": 100 }
```

#### `jenkins_search_logs`
Search build logs using regex patterns.
```json
{ "jobName": "web-api", "buildNumber": 342, "pattern": "ERROR|FATAL" }
```

### Node Management

#### `jenkins_list_nodes`
List all agents/nodes with status and executor count.

#### `jenkins_toggle_node`
Take a node online or offline.
```json
{ "nodeName": "agent-linux-01", "action": "offline", "reason": "maintenance" }
```

### Queue & Plugins

#### `jenkins_list_queue`
View the current build queue.

#### `jenkins_list_plugins`
List installed plugins with optional filters.
```json
{ "filter": "git", "updatesOnly": true }
```

## Security

- Credentials are read from environment variables only and never logged
- HTTPS is required by default; HTTP shows a warning
- CSRF crumb is automatically fetched for mutating operations
- Job allow-list restricts which jobs can be accessed
- Log output is capped to prevent memory exhaustion
- No Jenkins Script Console execution is supported
- All inputs validated via Zod schemas
- Path traversal is blocked in job and node names

## Logo Attribution

The Jenkins India logo used in this project is derived from the [Jenkins project](https://jenkins.io/) artwork, licensed under the [Creative Commons Attribution-ShareAlike 3.0 Unported License](https://creativecommons.org/licenses/by-sa/3.0/).

