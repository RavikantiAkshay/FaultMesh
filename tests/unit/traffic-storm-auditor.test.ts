import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { TrafficStormAuditor } from '../../src/scorer/TrafficStormAuditor.js';

describe('TrafficStormAuditor — DoS, Rate Limit & Idempotency Testing Suite', () => {
  let mockServer: http.Server;
  let serverPort: number;
  let auditor: TrafficStormAuditor;

  beforeAll(async () => {
    mockServer = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');

      const url = new URL(req.url || '/', `http://localhost:${serverPort}`);

      if (url.pathname === '/api/ratelimit-test') {
        res.setHeader('Retry-After', '2');
        res.writeHead(429);
        res.end(JSON.stringify({ error: 'Too Many Requests' }));
        return;
      }

      if (url.pathname === '/api/upload-check') {
        res.writeHead(413);
        res.end(JSON.stringify({ error: 'Payload Too Large' }));
        return;
      }

      if (url.pathname === '/api/checkout') {
        const key = req.headers['idempotency-key'] || 'default';
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'completed', transactionId: `tx_${key}` }));
        return;
      }

      res.writeHead(200);
      res.end(JSON.stringify({ status: 'ok' }));
    });

    await new Promise<void>((resolve) => {
      mockServer.listen(0, () => {
        serverPort = (mockServer.address() as any).port;
        resolve();
      });
    });

    auditor = new TrafficStormAuditor(`http://127.0.0.1:${serverPort}`);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => mockServer.close(() => resolve()));
  });

  it('evaluates resilient profile and awards Grade A with 100/100 score across 4 checks', async () => {
    const report = await auditor.runStormSuite('resilient');

    expect(report.totalChecks).toBe(4);
    expect(report.passedChecks).toBe(4);
    expect(report.score).toBe(100);
    expect(report.grade).toBe('A');
    expect(report.checks.every((c) => c.passed)).toBe(true);

    const checkIds = report.checks.map((c) => c.id);
    expect(checkIds).toContain('storm_ratelimit');
    expect(checkIds).toContain('storm_payload');
    expect(checkIds).toContain('storm_slowloris');
    expect(checkIds).toContain('storm_idempotency');
  });

  it('evaluates fragile profile, assigns Grade F (0/100), and generates 4 actionable remediations', async () => {
    const report = await auditor.runStormSuite('fragile');

    expect(report.totalChecks).toBe(4);
    expect(report.passedChecks).toBe(0);
    expect(report.score).toBe(0);
    expect(report.grade).toBe('F');
    expect(report.checks.every((c) => !c.passed)).toBe(true);
    expect(report.recommendations.length).toBe(4);
  });

  it('validates each traffic storm check has complete metadata and valid categories', async () => {
    const report = await auditor.runStormSuite('resilient');

    for (const check of report.checks) {
      expect(check.id).toBeDefined();
      expect(check.name.length).toBeGreaterThan(0);
      expect(['ratelimit', 'payload', 'slowloris', 'idempotency']).toContain(check.category);
      expect(['critical', 'high', 'medium', 'low']).toContain(check.severity);
      expect(check.details.length).toBeGreaterThan(0);
      expect(check.remediation.length).toBeGreaterThan(0);
      expect(check.latencyMs).toBeGreaterThanOrEqual(0);
    }
  });
});
