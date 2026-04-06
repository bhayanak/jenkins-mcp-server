const esbuild = require('esbuild');
const { cpSync, mkdirSync, existsSync } = require('fs');
const path = require('path');

async function build() {
  // Build the extension
  await esbuild.build({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    outfile: 'dist/extension.js',
    external: ['vscode'],
    format: 'cjs',
    platform: 'node',
    target: 'node20',
    sourcemap: true,
    minify: false,
  });

  // Copy server dist into extension for packaging
  const serverDist = path.join(__dirname, '..', 'jenkins-mcp-server', 'dist');
  const targetDir = path.join(__dirname, 'server', 'dist');

  if (existsSync(serverDist)) {
    mkdirSync(targetDir, { recursive: true });
    cpSync(serverDist, targetDir, { recursive: true });
    console.log('Copied server dist into extension/server/dist');

    // The server bundle is ESM. Node needs a nearby package.json with
    // "type": "module" so it treats .js files as ES modules.
    const { writeFileSync } = require('fs');
    writeFileSync(
      path.join(__dirname, 'server', 'package.json'),
      JSON.stringify({ type: 'module' }) + '\n',
    );
    console.log('Created server/package.json with "type": "module"');
  } else {
    console.warn('Warning: Server dist not found. Build the server first.');
  }
}

build().catch(() => process.exit(1));
