import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { SecurityAuditor } from '../../src/scorer/SecurityAuditor.js';

describe('SecurityAuditor — Zero-Damage Security & Protocol Audit', () => {
  let mockServer: http.Server;
  let serverPort: number;
  let auditor: SecurityAuditor;

  beforeAll(async () => {
    mockServer = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');

      const url = new URL(req.url || '/', `http://localhost:${serverPort}`);

      if (url.pathname === '/api/health') {
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'ok' }));
        return;
      }

      if (url.pathname === '/api/profile') {
        res.writeHead(200);
        res.end(JSON.stringify({ user: 'operator', tokenMasked: '****' }));
        return;
      }

      if (url.pathname === '/api/files') {
        const name = url.searchParams.get('name') || '';
        if (name.includes('..')) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Directory traversal forbidden' }));
          return;
        }
        res.writeHead(200);
        res.end(JSON.stringify({ file: name, content: 'clean' }));
        return;
      }

      res.writeHead(200);
      res.end(JSON.stringify({ status: 'ok', data: [1, 2, 3] }));
    });

    await new Promise<void>((resolve) => {
      mockServer.listen(0, () => {
        serverPort = (mockServer.address() as any).port;
        resolve();
      });
    });

    auditor = new SecurityAuditor(`http://127.0.0.1:${serverPort}`);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => mockServer.close(() => resolve()));
  });

  it('evaluates secure profile and awards Grade A with 100/100 score across 7 checks', async () => {
    const report = await auditor.runAudit('secure');

    expect(report.totalChecks).toBe(7);
    expect(report.passedChecks).toBe(7);
    expect(report.score).toBe(100);
    expect(report.grade).toBe('A');
    expect(report.checks.every((c) => c.passed)).toBe(true);

    const checkIds = report.checks.map((c) => c.id);
    expect(checkIds).toContain('sec_headers');
    expect(checkIds).toContain('sec_cors');
    expect(checkIds).toContain('sec_leakage');
    expect(checkIds).toContain('sec_pii');
    expect(checkIds).toContain('sec_errors');
    expect(checkIds).toContain('sec_traversal');
    expect(checkIds).toContain('sec_injection');
  });

  it('evaluates vulnerable profile, assigns Grade F (0/100), and generates 7 actionable remediations', async () => {
    const report = await auditor.runAudit('vulnerable');

    expect(report.totalChecks).toBe(7);
    expect(report.passedChecks).toBe(0);
    expect(report.score).toBe(0);
    expect(report.grade).toBe('F');
    expect(report.checks.every((c) => !c.passed)).toBe(true);
    expect(report.recommendations.length).toBe(7);

    // Verify critical severity checks exist
    const criticalChecks = report.checks.filter((c) => c.severity === 'critical');
    expect(criticalChecks.length).toBeGreaterThanOrEqual(4);
  });

  it('validates each security check has complete metadata and non-destructive details', async () => {
    const report = await auditor.runAudit('secure');

    for (const check of report.checks) {
      expect(check.id).toBeDefined();
      expect(check.name.length).toBeGreaterThan(0);
      expect(['headers', 'cors', 'leakage', 'injection', 'errors', 'pii-leakage', 'traversal']).toContain(check.category);
      expect(['critical', 'high', 'medium', 'low']).toContain(check.severity);
      expect(check.details.length).toBeGreaterThan(0);
      expect(check.remediation.length).toBeGreaterThan(0);
      expect(check.latencyMs).toBeGreaterThanOrEqual(0);
    }
  });
});
