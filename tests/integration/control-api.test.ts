import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { ControlApi } from '../../src/engine/ControlApi.js';
import { ToxicPipeline } from '../../src/engine/ToxicPipeline.js';
import { TelemetryHub } from '../../src/engine/TelemetryHub.js';
import { ResilienceScorer } from '../../src/scorer/ResilienceScorer.js';
import { SecurityAuditor } from '../../src/scorer/SecurityAuditor.js';
import { TrafficStormAuditor } from '../../src/scorer/TrafficStormAuditor.js';
import { createMockUpstreamServer } from '../../src/server.js';

function rawHttpGet(port: number, path: string): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method: 'GET',
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode || 0, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode || 0, data: body });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

describe('FaultMesh Control API (TDD)', () => {
  let api: ControlApi;
  let port: number;
  let pipeline: ToxicPipeline;
  let hub: TelemetryHub;
  let scorer: ResilienceScorer;
  let mockServer: http.Server;
  let mockPort: number;

  beforeAll(async () => {
    mockServer = createMockUpstreamServer(0);
    await new Promise<void>((resolve) => {
      mockServer.listen(0, () => {
        mockPort = (mockServer.address() as any).port;
        resolve();
      });
    });

    pipeline = new ToxicPipeline();
    hub = new TelemetryHub();
    scorer = new ResilienceScorer(`http://127.0.0.1:${mockPort}`, pipeline);
    const securityAuditor = new SecurityAuditor(`http://127.0.0.1:${mockPort}`);
    const trafficStormAuditor = new TrafficStormAuditor(`http://127.0.0.1:${mockPort}`);

    api = new ControlApi(0, pipeline, hub, scorer, securityAuditor, trafficStormAuditor);
    await api.start();
    port = api.getPort();
  });

  afterAll(async () => {
    await api.stop();
    await new Promise<void>((resolve) => mockServer.close(() => resolve()));
  });

  it('GET /_faultmesh/status returns online state and metrics', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/_faultmesh/status`);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe('online');
    expect(data.engine).toContain('FaultMesh');
  });

  it('POST, GET, and DELETE /_faultmesh/toxics manages rules dynamically', async () => {
    // 1. Add toxic
    const addRes = await fetch(`http://127.0.0.1:${port}/_faultmesh/toxics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'test-latency-1',
        name: 'Test Delay',
        type: 'latency',
        direction: 'downstream',
        enabled: true,
        config: { latencyMs: 150 },
      }),
    });
    expect(addRes.status).toBe(201);

    // 2. Verify in list
    const listRes = await fetch(`http://127.0.0.1:${port}/_faultmesh/toxics`);
    const list = await listRes.json();
    expect(list.length).toBe(1);
    expect(list[0].id).toBe('test-latency-1');

    // 3. Delete toxic by ID
    const delRes = await fetch(`http://127.0.0.1:${port}/_faultmesh/toxics/test-latency-1`, {
      method: 'DELETE',
    });
    expect(delRes.status).toBe(200);

    // 4. Delete 404 for non-existent toxic
    const delRes404 = await fetch(`http://127.0.0.1:${port}/_faultmesh/toxics/does-not-exist`, {
      method: 'DELETE',
    });
    expect(delRes404.status).toBe(404);

    // 5. Add another toxic and DELETE all
    await fetch(`http://127.0.0.1:${port}/_faultmesh/toxics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'test-cut-2',
        name: 'Test Cut',
        type: 'cut',
        direction: 'downstream',
        enabled: true,
        config: { cutAfterBytes: 50 },
      }),
    });
    const clearRes = await fetch(`http://127.0.0.1:${port}/_faultmesh/toxics`, {
      method: 'DELETE',
    });
    expect(clearRes.status).toBe(200);

    const listEmpty = await (await fetch(`http://127.0.0.1:${port}/_faultmesh/toxics`)).json();
    expect(listEmpty.length).toBe(0);
  });

  it('rejects invalid or malformed POST /_faultmesh/toxics payloads', async () => {
    // Missing required fields
    const res1 = await fetch(`http://127.0.0.1:${port}/_faultmesh/toxics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'bad-rule' }),
    });
    expect(res1.status).toBe(400);

    // Malformed JSON syntax
    const res2 = await fetch(`http://127.0.0.1:${port}/_faultmesh/toxics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not a json',
    });
    expect(res2.status).toBe(400);
  });

  it('returns 204 on OPTIONS preflight', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/_faultmesh/status`, {
      method: 'OPTIONS',
    });
    expect(res.status).toBe(204);
  });

  it('POST /_faultmesh/security/run executes security audit and returns scorecard', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/_faultmesh/security/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: 'secure' }),
    });
    expect(res.status).toBe(200);
    const scorecard = await res.json();
    expect(scorecard.totalChecks).toBe(7);
    expect(scorecard.score).toBe(100);
    expect(scorecard.grade).toBe('A');
  });

  it('POST /_faultmesh/storm/run executes traffic storm audit and returns scorecard', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/_faultmesh/storm/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: 'resilient' }),
    });
    expect(res.status).toBe(200);
    const scorecard = await res.json();
    expect(scorecard.totalChecks).toBe(4);
    expect(scorecard.score).toBe(100);
    expect(scorecard.grade).toBe('A');
  });

  describe('Dynamic Target API Configuration', () => {
    it('GET and POST /_faultmesh/config/target dynamically updates proxy backend', async () => {
      let targetState = 'http://127.0.0.1:4000';
      const mockProxy: any = {
        getTargetUrl: () => targetState,
        setTargetUrl: (url: string) => { targetState = url; },
      };
      api.setProxy(mockProxy);

      // Initial GET
      const getRes1 = await fetch(`http://127.0.0.1:${port}/_faultmesh/config/target`);
      expect(getRes1.status).toBe(200);
      const data1 = await getRes1.json();
      expect(data1.targetUrl).toBe('http://127.0.0.1:4000');

      // POST valid new target URL
      const postRes = await fetch(`http://127.0.0.1:${port}/_faultmesh/config/target`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl: 'http://localhost:8080' }),
      });
      expect(postRes.status).toBe(200);
      expect(targetState).toBe('http://localhost:8080');

      // Verify GET returns new target
      const getRes2 = await fetch(`http://127.0.0.1:${port}/_faultmesh/config/target`);
      const data2 = await getRes2.json();
      expect(data2.targetUrl).toBe('http://localhost:8080');

      // Rejects invalid URL
      const badRes = await fetch(`http://127.0.0.1:${port}/_faultmesh/config/target`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl: 'invalid-url' }),
      });
      expect(badRes.status).toBe(400);
    });
  });

  describe('Path Traversal & Static Asset Confinement', () => {
    it('serves index.html for root path', async () => {
      const res = await fetch(`http://127.0.0.1:${port}/`);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain('FaultMesh');
    });

    it('blocks directory traversal attempts with 403 Forbidden', async () => {
      // Direct raw socket escape
      const res1 = await rawHttpGet(port, '/../../package.json');
      expect(res1.status).toBe(403);
      expect(res1.data.error).toContain('Path Traversal Prohibited');

      // URL encoded escape
      const res2 = await rawHttpGet(port, '/%2e%2e/%2e%2e/package.json');
      expect(res2.status).toBe(403);
      expect(res2.data.error).toContain('Path Traversal Prohibited');
    });
  });

  describe('AutoHealer API Endpoints', () => {
    it('POST /_faultmesh/healer/scan returns scan result for target directory', async () => {
      const res = await fetch(`http://127.0.0.1:${port}/_faultmesh/healer/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectDir: '.' }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.projectRoot).toBeDefined();
    });
  });
});


