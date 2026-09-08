import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { FaultMeshProxy } from '../../src/engine/FaultMeshProxy.js';
import { ToxicPipeline } from '../../src/engine/ToxicPipeline.js';
import { TelemetryHub } from '../../src/engine/TelemetryHub.js';

describe('FaultMesh Proxy & Control API Integration (TDD)', () => {
  let mockUpstreamServer: http.Server;
  let upstreamPort: number;
  let proxy: FaultMeshProxy;
  let proxyPort: number;
  let telemetryHub: TelemetryHub;
  let pipeline: ToxicPipeline;

  beforeAll(async () => {
    // 1. Start Mock Upstream Server
    mockUpstreamServer = http.createServer((req, res) => {
      if (req.url === '/echo') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ echo: body, time: Date.now() }));
        });
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', service: 'upstream' }));
      }
    });

    await new Promise<void>(resolve => {
      mockUpstreamServer.listen(0, () => {
        upstreamPort = (mockUpstreamServer.address() as any).port;
        resolve();
      });
    });

    // 2. Start FaultMesh Proxy
    telemetryHub = new TelemetryHub();
    pipeline = new ToxicPipeline();
    proxy = new FaultMeshProxy({
      port: 0,
      targetUrl: `http://127.0.0.1:${upstreamPort}`,
    }, pipeline, telemetryHub);

    await proxy.start();
    proxyPort = proxy.getPort();
  });

  afterAll(async () => {
    await proxy.stop();
    await new Promise<void>(resolve => mockUpstreamServer.close(() => resolve()));
  });

  it('transparently proxies normal requests when no toxics are active', async () => {
    const res = await fetch(`http://127.0.0.1:${proxyPort}/api/test`);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.service).toBe('upstream');
  });

  it('injects latency when a LatencyToxic rule is enabled via pipeline', async () => {
    pipeline.addRule({
      id: 'lat-1',
      name: 'Simulate 3G Delay',
      type: 'latency',
      direction: 'downstream',
      enabled: true,
      config: { latencyMs: 80, jitterMs: 0 },
    });

    const start = Date.now();
    const res = await fetch(`http://127.0.0.1:${proxyPort}/api/test`);
    const elapsed = Date.now() - start;
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(elapsed).toBeGreaterThanOrEqual(70);

    pipeline.removeRule('lat-1');
  });

  it('overrides HTTP status code when StatusToxic is active', async () => {
    pipeline.addRule({
      id: 'stat-503',
      name: 'Outage Simulation',
      type: 'status',
      direction: 'downstream',
      enabled: true,
      config: { statusCode: 503, statusMessage: 'Custom Service Down' },
    });

    const res = await fetch(`http://127.0.0.1:${proxyPort}/api/test`);
    expect(res.status).toBe(503);

    pipeline.removeRule('stat-503');
  });

  it('records metrics in TelemetryHub for intercepted requests', async () => {
    await fetch(`http://127.0.0.1:${proxyPort}/api/metric-test`);
    const metrics = telemetryHub.getMetrics();

    expect(metrics.totalRequests).toBeGreaterThanOrEqual(3);
    expect(metrics.bytesProxied).toBeGreaterThan(0);
  });
});
