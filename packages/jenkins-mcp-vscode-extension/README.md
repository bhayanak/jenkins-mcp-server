<p align="center">
  <img src="logo.png" alt="Jenkins MCP Server" width="120" />
</p>

# Jenkins MCP Server — VS Code Extension

VS Code extension that registers the Jenkins MCP Server for use with GitHub Copilot and other AI chat providers.

## Configuration

Open **Settings** and search for `jenkins-mcp`:

| Setting | Description |
|---------|-------------|
| `jenkins-mcp.jenkinsUrl` | Jenkins controller URL (e.g., `https://ci.example.com`) |
| `jenkins-mcp.jenkinsUser` | Jenkins username |
| `jenkins-mcp.jenkinsToken` | Jenkins API token |
| `jenkins-mcp.useCrumb` | Enable CSRF crumb fetching (default: `true`) |
| `jenkins-mcp.maxLogSize` | Max log output bytes (default: `1048576`) |
| `jenkins-mcp.timeoutMs` | Request timeout ms (default: `30000`) |
| `jenkins-mcp.allowedJobs` | Comma-separated job filter (empty = all) |
| `jenkins-mcp.depth` | Jenkins API depth (default: `1`) |

### Getting a Jenkins API Token

1. Log into Jenkins
2. Click your username → **Configure**
3. Under **API Token**, click **Add new Token**
4. Copy the generated token into `jenkins-mcp.jenkinsToken`

## MCP Server Visibility

After installation, the Jenkins MCP Server appears automatically in:

- **MCP Servers** list (VS Code sidebar)
- **Configure Tools** in Copilot Chat

## Commands

| Command | Description |
|---------|-------------|
| **Jenkins MCP: Start Server** | Start the MCP server process |
| **Jenkins MCP: Stop Server** | Stop the running server |
| **Jenkins MCP: Show Server Output** | Open the server output channel |

Access these from the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`).

## Logo Attribution

The Jenkins India logo used in this project is derived from the [Jenkins project](https://jenkins.io/) artwork, licensed under the [Creative Commons Attribution-ShareAlike 3.0 Unported License](https://creativecommons.org/licenses/by-sa/3.0/).
