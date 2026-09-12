import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { FaultMeshProxy } from '../../src/engine/FaultMeshProxy.js';
import { ToxicPipeline } from '../../src/engine/ToxicPipeline.js';
import { TelemetryHub } from '../../src/engine/TelemetryHub.js';
import { ResilienceScorer } from '../../src/scorer/ResilienceScorer.js';

describe('FaultMesh Resilience Scorer Gauntlet (TDD)', () => {
  let mockServer: http.Server;
  let serverPort: number;
  let proxy: FaultMeshProxy;
  let proxyPort: number;
  let pipeline: ToxicPipeline;
  let telemetryHub: TelemetryHub;
  let scorer: ResilienceScorer;

  beforeAll(async () => {
    mockServer = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Hello from resilient target service', timestamp: Date.now() }));
    });

    await new Promise<void>(resolve => {
      mockServer.listen(0, () => {
        serverPort = (mockServer.address() as any).port;
        resolve();
      });
    });

    telemetryHub = new TelemetryHub();
    pipeline = new ToxicPipeline();
    proxy = new FaultMeshProxy({
      port: 0,
      targetUrl: `http://127.0.0.1:${serverPort}`,
    }, pipeline, telemetryHub);

    await proxy.start();
    proxyPort = proxy.getPort();
    scorer = new ResilienceScorer(`http://127.0.0.1:${proxyPort}`, pipeline);
  });

  afterAll(async () => {
    await proxy.stop();
    await new Promise<void>(resolve => mockServer.close(() => resolve()));
  });

  it('runs the full 10-part chaos gauntlet and produces a weighted scorecard', async () => {
    const scorecard = await scorer.runGauntlet();

    expect(scorecard.totalAttacks).toBe(10);
    expect(scorecard.results.length).toBe(10);
    expect(scorecard.score).toBeGreaterThanOrEqual(0);
    expect(scorecard.score).toBeLessThanOrEqual(100);
    expect(['A', 'B', 'C', 'D', 'F']).toContain(scorecard.grade);
    expect(scorecard.recommendations.length).toBeGreaterThanOrEqual(1);
  });
});
