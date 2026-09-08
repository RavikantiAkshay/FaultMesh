#!/usr/bin/env node
import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startFaultMesh } from './server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getVersion(): string {
  try {
    const pkgPath = path.resolve(__dirname, '../package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      return pkg.version || '1.0.0';
    }
  } catch {
    // fallback if package.json not found
  }
  return '1.0.0';
}

function printHelp(): void {
  console.log(`
  +-------------------------------------------------------+
  |                   FAULTMESH CLI                       |
  |       Network Resilience & Security Testing Suite     |
  +-------------------------------------------------------+

  Usage:
    faultmesh [options]
    npx faultmesh [options]

  Options:
    -t, --target <url>       Target API URL to proxy and audit (e.g. http://localhost:8000)
                             If omitted, starts the built-in sample mock server on :4000
    -p, --port <number>      Control Dashboard port (default: 3000)
        --proxy-port <num>   Middleman chaos proxy port (default: 3001)
        --mock-port <num>    Port for sample mock server if no target is given (default: 4000)
    -h, --help               Show this help message and exit
    -v, --version            Show version number and exit

  Examples:
    npx faultmesh
    npx faultmesh --target http://localhost:8000
    npx faultmesh -t http://localhost:5000 -p 8080 --proxy-port 8081
`);
}

async function run(): Promise<void> {
  let parsed;
  try {
    parsed = parseArgs({
      options: {
        target: { type: 'string', short: 't' },
        port: { type: 'string', short: 'p', default: '3000' },
        'proxy-port': { type: 'string', default: '3001' },
        'mock-port': { type: 'string', default: '4000' },
        help: { type: 'boolean', short: 'h', default: false },
        version: { type: 'boolean', short: 'v', default: false },
      },
      allowPositionals: true,
    });
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    console.error('Run "faultmesh --help" for usage instructions.');
    process.exit(1);
  }

  const { values } = parsed;

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  if (values.version) {
    console.log(`faultmesh v${getVersion()}`);
    process.exit(0);
  }

  const dashboardPort = parseInt(values.port || '3000', 10);
  const proxyPort = parseInt(values['proxy-port'] || '3001', 10);
  const mockPort = parseInt(values['mock-port'] || '4000', 10);
  const targetUrl = values.target;

  if (isNaN(dashboardPort) || isNaN(proxyPort) || isNaN(mockPort)) {
    console.error('Error: Port options must be valid numbers.');
    process.exit(1);
  }

  try {
    const instance = await startFaultMesh({
      targetUrl,
      dashboardPort,
      proxyPort,
      mockPort,
    });

    const shutdown = async () => {
      console.log('\nShutting down FaultMesh...');
      await instance.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err: any) {
    console.error('Failed to start FaultMesh:', err.message || err);
    process.exit(1);
  }
}

run();
