import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import { ToxicPipeline } from '../../src/engine/ToxicPipeline.js';
import { TelemetryHub } from '../../src/engine/TelemetryHub.js';
import { RedTeamEngine } from '../../src/redteam/RedTeamEngine.js';
import { EccAgentBridge } from '../../src/redteam/EccAgentBridge.js';

describe('RedTeamEngine (Unit Tests)', () => {
  let mockServer: http.Server;
  let mockPort: number;
  let pipeline: ToxicPipeline;
  let telemetryHub: TelemetryHub;
  let engine: RedTeamEngine;

  beforeEach(async () => {
    pipeline = new ToxicPipeline();
    telemetryHub = new TelemetryHub();
    engine = new RedTeamEngine(pipeline, telemetryHub, new EccAgentBridge());

    // Create a mock target server
    mockServer = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://localhost:${mockPort}`);

      if (url.pathname === '/api/data') {
        // Missing security headers, accepts all requests
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', records: [1, 2, 3] }));
        return;
      }

      if (url.pathname === '/api/profile') {
        const auth = req.headers['authorization'];
        if (auth && auth.includes('malformed')) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'NullPointer / Unhandled signature parsing exception' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ profile: 'user' }));
        return;
      }

      if (url.pathname === '/api/checkout') {
        // No idempotency protection - accepts duplicate requests
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, processedKey: req.headers['idempotency-key'] }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });

    await new Promise<void>((resolve) => {
      mockServer.listen(0, () => {
        const addr = mockServer.address() as any;
        mockPort = addr.port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => mockServer.close(() => resolve()));
  });

  it('initializes with idle status and clean metrics', () => {
    const status = engine.getStatus();
    expect(status.active).toBe(false);
    expect(status.phase).toBe('idle');
    expect(status.probesSent).toBe(0);
    expect(status.breachesCount.total).toBe(0);
  });

  it('runs a complete red team campaign against target server and discovers breaches', async () => {
    const report = await engine.startCampaign({
      targetUrl: `http://localhost:${mockPort}`,
      intensity: 'stealth',
    });

    expect(report).toBeDefined();
    expect(report.phase).toBe('complete');
    expect(report.totalWaves).toBe(5);
    expect(report.totalProbes).toBeGreaterThan(5);
    expect(report.breachesFound.length).toBeGreaterThanOrEqual(1);

    // Should detect missing defensive security headers and auth crash
    const headerBreach = report.breachesFound.find(b => b.category === 'Security Perimeter');
    expect(headerBreach).toBeDefined();
    expect(headerBreach?.autoHealCheckKey).toBe('Defensive Security Headers');

    const authBreach = report.breachesFound.find(b => b.category === 'Authentication');
    expect(authBreach).toBeDefined();
    expect(authBreach?.severity).toBe('critical');

    // Scorecard calculation
    expect(report.survivabilityScore).toBeGreaterThanOrEqual(0);
    expect(report.survivabilityScore).toBeLessThanOrEqual(100);
    expect(['A', 'B', 'C', 'D', 'F']).toContain(report.survivabilityGrade);

    // Active personas included
    expect(report.activePersonas.length).toBeGreaterThanOrEqual(3);
  }, 15000);

  it('aborts ongoing campaign safely and clears injected toxics', async () => {
    // Start campaign in background
    const runPromise = engine.startCampaign({
      targetUrl: `http://localhost:${mockPort}`,
      intensity: 'sustained',
    });

    // Wait 150ms into recon phase
    await new Promise(r => setTimeout(r, 150));

    // Abort
    const abortResult = engine.abortCampaign();
    expect(abortResult.success).toBe(true);

    const report = await runPromise;
    expect(report.phase).toBe('aborted');

    // Ensure all toxic rules injected during waves were removed
    const activeRules = pipeline.getRules();
    const redTeamRules = activeRules.filter(r => r.id.startsWith('redteam_'));
    expect(redTeamRules.length).toBe(0);
  });
});
