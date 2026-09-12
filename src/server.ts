import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ToxicPipeline } from './engine/ToxicPipeline.js';
import { TelemetryHub } from './engine/TelemetryHub.js';
import { FaultMeshProxy } from './engine/FaultMeshProxy.js';
import { ControlApi } from './engine/ControlApi.js';
import { ResilienceScorer } from './scorer/ResilienceScorer.js';
import { SecurityAuditor } from './scorer/SecurityAuditor.js';
import { TrafficStormAuditor } from './scorer/TrafficStormAuditor.js';

export interface FaultMeshOptions {
  targetUrl?: string;
  proxyPort?: number;
  dashboardPort?: number;
  mockPort?: number;
}

export interface FaultMeshInstance {
  upstreamServer?: http.Server;
  proxy: FaultMeshProxy;
  controlApi: ControlApi;
  pipeline: ToxicPipeline;
  telemetryHub: TelemetryHub;
  stop: () => Promise<void>;
}

export function createMockUpstreamServer(port: number): http.Server {
  return http.createServer((req, res) => {
    // Set defensive security headers on upstream API
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', 'no-store, no-cache');

    const url = new URL(req.url || '/', `http://localhost:${port}`);

    if (url.pathname === '/api/health') {
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'healthy', uptime: process.uptime() }));
      return;
    }

    if (url.pathname === '/api/users') {
      res.writeHead(200);
      res.end(JSON.stringify({
        users: [
          { id: 1, name: 'Alice Chen', role: 'Staff SRE' },
          { id: 2, name: 'Bob Vance', role: 'Systems Engineer' },
          { id: 3, name: 'Carlos Diaz', role: 'Chaos Architect' },
        ],
        timestamp: Date.now(),
      }));
      return;
    }

    if (url.pathname === '/api/crash') {
      res.writeHead(500);
      res.end(JSON.stringify({
        error: 'Database connection pool exhausted',
        exception: 'FatalConnectionError: pool size 0/20 reached',
        timestamp: Date.now(),
      }));
      return;
    }

    if (url.pathname === '/api/profile') {
      res.writeHead(200);
      res.end(JSON.stringify({
        id: 101,
        username: 'dev_operator',
        email: 'operator@internal.faultmesh.io',
        role: 'system_admin',
        maskedToken: '****-****-****-9821',
        timestamp: Date.now(),
      }));
      return;
    }

    if (url.pathname === '/api/files') {
      const fileName = url.searchParams.get('name') || '';
      if (fileName.includes('..')) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid path: directory traversal prohibited' }));
        return;
      }
      res.writeHead(200);
      res.end(JSON.stringify({ file: fileName, content: 'Approved static resource payload.' }));
      return;
    }

    if (url.pathname === '/api/checkout') {
      const key = req.headers['idempotency-key'] || 'default_key';
      res.writeHead(200);
      res.end(JSON.stringify({
        status: 'completed',
        transactionId: `tx_${key}`,
        timestamp: Date.now(),
      }));
      return;
    }

    if (url.pathname === '/api/ratelimit-test') {
      res.setHeader('Retry-After', '2');
      res.writeHead(429);
      res.end(JSON.stringify({ error: 'Too Many Requests', retryAfterSeconds: 2 }));
      return;
    }

    if (url.pathname === '/api/upload-check') {
      const len = Number(req.headers['content-length'] || 0);
      if (len > 1 * 1024 * 1024) {
        res.writeHead(413);
        res.end(JSON.stringify({ error: 'Payload Too Large', limitBytes: 1048576 }));
        return;
      }
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'accepted' }));
      return;
    }

    if (url.pathname === '/api/slowloris-probe') {
      res.setHeader('X-Socket-Protection', 'active');
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'protected' }));
      return;
    }

    // Default /api/data endpoint
    res.writeHead(200);
    res.end(JSON.stringify({
      service: 'Upstream Core API',
      version: '1.2.0',
      load: 'nominal',
      timestamp: Date.now(),
      data: Array.from({ length: 5 }, (_, i) => ({ id: i + 1, value: `record_${i + 1}` })),
    }));
  });
}

export async function startFaultMesh(options: FaultMeshOptions = {}): Promise<FaultMeshInstance> {
  const proxyPort = options.proxyPort ?? 3001;
  const dashboardPort = options.dashboardPort ?? 3000;
  const mockPort = options.mockPort ?? 4000;

  console.log('\x1b[36m%s\x1b[0m', `
  +-------------------------------------------------------+
  |                   FAULTMESH RUNTIME                   |
  |       Network Resilience & Security Testing Suite     |
  +-------------------------------------------------------+
  `);

  let upstreamServer: http.Server | undefined;
  let targetUrl: string;

  if (options.targetUrl) {
    targetUrl = options.targetUrl;
    console.log(`  [Target API]     ${targetUrl} (External Target)`);
  } else {
    targetUrl = `http://127.0.0.1:${mockPort}`;
    upstreamServer = createMockUpstreamServer(mockPort);
    await new Promise<void>((resolve) => upstreamServer!.listen(mockPort, resolve));
    console.log(`  [Target API]     http://127.0.0.1:${mockPort} (Built-in Sample API)`);
  }

  // 2. Initialize FaultMesh Engine
  const pipeline = new ToxicPipeline();
  const telemetryHub = new TelemetryHub();

  const proxy = new FaultMeshProxy({
    port: proxyPort,
    targetUrl,
  }, pipeline, telemetryHub);

  await proxy.start();
  console.log(`  [Chaos Proxy]    http://127.0.0.1:${proxyPort} (Route traffic here)`);

  // 3. Initialize Resilience Scorer, Security Auditor, Traffic Storm Auditor & Control API / Dashboard
  const scorer = new ResilienceScorer(`http://127.0.0.1:${proxyPort}`, pipeline);
  const securityAuditor = new SecurityAuditor(targetUrl);
  const trafficStormAuditor = new TrafficStormAuditor(targetUrl);
  const controlApi = new ControlApi(dashboardPort, pipeline, telemetryHub, scorer, securityAuditor, trafficStormAuditor, undefined, proxy);

  await controlApi.start();
  console.log(`  [Dashboard]      http://localhost:${dashboardPort}`);
  console.log('\n  Ready for traffic. Open the dashboard in your browser to inspect or inject faults.');

  return {
    upstreamServer,
    proxy,
    controlApi,
    pipeline,
    telemetryHub,
    stop: async () => {
      await controlApi.stop();
      await proxy.stop();
      if (upstreamServer) {
        await new Promise<void>((resolve) => upstreamServer!.close(() => resolve()));
      }
    },
  };
}

// Auto-run if executed directly via node or tsx
const currentFile = fileURLToPath(import.meta.url);
const isDirectRun = process.argv[1] && (
  path.resolve(process.argv[1]) === path.resolve(currentFile) ||
  process.argv[1].endsWith('server.ts') ||
  process.argv[1].endsWith('server.js')
);

if (isDirectRun && !process.env.FAULTMESH_NO_AUTORUN) {
  startFaultMesh().catch((err) => {
    console.error('Failed to launch FaultMesh:', err);
    process.exit(1);
  });
}
