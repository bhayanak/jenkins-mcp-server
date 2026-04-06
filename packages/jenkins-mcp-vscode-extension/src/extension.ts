import * as vscode from 'vscode';
import * as path from 'path';
import { ChildProcess, spawn } from 'child_process';

let serverProcess: ChildProcess | null = null;
let outputChannel: vscode.OutputChannel;

function getConfig(): Record<string, string> {
  const config = vscode.workspace.getConfiguration('jenkins-mcp');
  const env: Record<string, string> = {};

  const url = config.get<string>('jenkinsUrl', '');
  const user = config.get<string>('jenkinsUser', '');
  const token = config.get<string>('jenkinsToken', '');

  if (url) env.JENKINS_MCP_URL = url;
  if (user) env.JENKINS_MCP_USER = user;
  if (token) env.JENKINS_MCP_TOKEN = token;

  env.JENKINS_MCP_USE_CRUMB = String(config.get<boolean>('useCrumb', true));
  env.JENKINS_MCP_MAX_LOG_SIZE = String(config.get<number>('maxLogSize', 1048576));
  env.JENKINS_MCP_TIMEOUT_MS = String(config.get<number>('timeoutMs', 30000));
  env.JENKINS_MCP_DEPTH = String(config.get<number>('depth', 1));

  const allowedJobs = config.get<string>('allowedJobs', '');
  if (allowedJobs) env.JENKINS_MCP_ALLOWED_JOBS = allowedJobs;

  return env;
}

function getServerPath(context: vscode.ExtensionContext): string {
  return path.join(context.extensionPath, 'server', 'dist', 'index.js');
}

function validateConfig(): string | null {
  const config = vscode.workspace.getConfiguration('jenkins-mcp');
  const url = config.get<string>('jenkinsUrl', '');
  const user = config.get<string>('jenkinsUser', '');
  const token = config.get<string>('jenkinsToken', '');

  if (!url) return 'Jenkins URL is not configured. Set jenkins-mcp.jenkinsUrl in settings.';
  if (!user) return 'Jenkins user is not configured. Set jenkins-mcp.jenkinsUser in settings.';
  if (!token) return 'Jenkins token is not configured. Set jenkins-mcp.jenkinsToken in settings.';
  return null;
}

function startServer(context: vscode.ExtensionContext): void {
  if (serverProcess) {
    outputChannel.appendLine('[Jenkins MCP] Server is already running.');
    outputChannel.show();
    return;
  }

  const validationError = validateConfig();
  if (validationError) {
    vscode.window.showErrorMessage(validationError, 'Open Settings').then((action) => {
      if (action === 'Open Settings') {
        vscode.commands.executeCommand('workbench.action.openSettings', 'jenkins-mcp');
      }
    });
    return;
  }

  const serverPath = getServerPath(context);
  const env = { ...process.env, ...getConfig() };

  outputChannel.appendLine(`[Jenkins MCP] Starting server: node ${serverPath}`);

  serverProcess = spawn('node', [serverPath], {
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  serverProcess.stderr?.on('data', (data: Buffer) => {
    outputChannel.appendLine(data.toString().trim());
  });

  serverProcess.stdout?.on('data', (data: Buffer) => {
    outputChannel.appendLine(`[stdout] ${data.toString().trim()}`);
  });

  serverProcess.on('exit', (code) => {
    outputChannel.appendLine(`[Jenkins MCP] Server exited with code ${code}`);
    serverProcess = null;
  });

  serverProcess.on('error', (err) => {
    outputChannel.appendLine(`[Jenkins MCP] Server error: ${err.message}`);
    serverProcess = null;
  });

  outputChannel.appendLine('[Jenkins MCP] Server started.');
  outputChannel.show();
}

function stopServer(): void {
  if (!serverProcess) {
    outputChannel.appendLine('[Jenkins MCP] Server is not running.');
    return;
  }

  serverProcess.kill('SIGTERM');
  serverProcess = null;
  outputChannel.appendLine('[Jenkins MCP] Server stopped.');
}

export function activate(context: vscode.ExtensionContext): void {
  outputChannel = vscode.window.createOutputChannel('Jenkins MCP Server');

  context.subscriptions.push(
    vscode.commands.registerCommand('jenkins-mcp.startServer', () => startServer(context)),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('jenkins-mcp.stopServer', () => stopServer()),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('jenkins-mcp.showServerOutput', () => outputChannel.show()),
  );

  // Register MCP server definition programmatically (supplement to contributes.mcpServers)
  try {
    if (typeof vscode.lm?.registerMcpServerDefinitionProvider === 'function') {
      const onDidChange = new vscode.EventEmitter<void>();
      const provider = vscode.lm.registerMcpServerDefinitionProvider('jenkins-mcp', {
        onDidChangeMcpServerDefinitions: onDidChange.event,
        provideMcpServerDefinitions() {
          const serverPath = getServerPath(context);
          const env = getConfig();
          return [
            new vscode.McpStdioServerDefinition(
              'Jenkins MCP Server',
              'node',
              [serverPath],
              env,
            ),
          ];
        },
      });
      context.subscriptions.push(provider);
      context.subscriptions.push(onDidChange);

      // Re-publish server definition when settings change
      context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
          if (e.affectsConfiguration('jenkins-mcp')) {
            onDidChange.fire();
          }
        }),
      );
    }
  } catch (err) {
    outputChannel.appendLine(
      `[Jenkins MCP] MCP definition provider API not available: ${err}`,
    );
  }

  context.subscriptions.push(outputChannel);

  outputChannel.appendLine('[Jenkins MCP] Extension activated. MCP server definition registered.');
}

export function deactivate(): void {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
}
