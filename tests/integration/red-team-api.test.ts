import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ControlApi } from '../../src/engine/ControlApi.js';
import { ToxicPipeline } from '../../src/engine/ToxicPipeline.js';
import { TelemetryHub } from '../../src/engine/TelemetryHub.js';
import { ResilienceScorer } from '../../src/scorer/ResilienceScorer.js';

describe('Red Team Control API (Integration Tests)', () => {
  let controlApi: ControlApi;
  let pipeline: ToxicPipeline;
  let telemetryHub: TelemetryHub;
  let scorer: ResilienceScorer;
  let port: number;

  beforeEach(async () => {
    pipeline = new ToxicPipeline();
    telemetryHub = new TelemetryHub();
    scorer = new ResilienceScorer('http://127.0.0.1:3001', pipeline);

    controlApi = new ControlApi(
      0,
      pipeline,
      telemetryHub,
      scorer
    );

    await controlApi.start();
    port = controlApi.getPort();
  });

  afterEach(async () => {
    await controlApi.stop();
  });

  it('GET /_faultmesh/redteam/personas returns loaded agent personas', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/_faultmesh/redteam/personas`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.personas)).toBe(true);
    expect(data.personas.length).toBeGreaterThanOrEqual(5);

    const names = data.personas.map((p: any) => p.name);
    expect(names.some((n: string) => n.toLowerCase().includes('security'))).toBe(true);
  });

  it('GET /_faultmesh/redteam/status returns idle status when no campaign running', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/_faultmesh/redteam/status`);
    expect(res.status).toBe(200);

    const status = await res.json();
    expect(status.active).toBe(false);
    expect(status.phase).toBe('idle');
    expect(status.breachesCount.total).toBe(0);
  });

  it('POST /_faultmesh/redteam/start initiates campaign and POST /abort stops it', async () => {
    // 1. Start campaign
    const startRes = await fetch(`http://127.0.0.1:${port}/_faultmesh/redteam/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetUrl: 'http://127.0.0.1:3001',
        intensity: 'stealth',
      }),
    });

    expect(startRes.status).toBe(202);
    const startData = await startRes.json();
    expect(startData.success).toBe(true);
    expect(startData.status).toBeDefined();

    // 2. Check active status
    const statusRes = await fetch(`http://127.0.0.1:${port}/_faultmesh/redteam/status`);
    expect(statusRes.status).toBe(200);
    const activeStatus = await statusRes.json();
    expect(activeStatus.active).toBe(true);

    // 3. Abort campaign
    const abortRes = await fetch(`http://127.0.0.1:${port}/_faultmesh/redteam/abort`, {
      method: 'POST',
    });
    expect(abortRes.status).toBe(200);
    const abortData = await abortRes.json();
    expect(abortData.success).toBe(true);

    // 4. Check post-abort status
    const postStatusRes = await fetch(`http://127.0.0.1:${port}/_faultmesh/redteam/status`);
    const postStatus = await postStatusRes.json();
    expect(postStatus.active).toBe(false);
    expect(postStatus.phase).toBe('aborted');
  });

  it('GET /_faultmesh/redteam/report returns dossier', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/_faultmesh/redteam/report`);
    expect(res.status).toBe(200);
  });
});
