import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ControlApi } from '../../src/engine/ControlApi.js';
import { ToxicPipeline } from '../../src/engine/ToxicPipeline.js';
import { TelemetryHub } from '../../src/engine/TelemetryHub.js';
import { ResilienceScorer } from '../../src/scorer/ResilienceScorer.js';

describe('FaultMesh Control API (TDD)', () => {
  let api: ControlApi;
  let port: number;
  let pipeline: ToxicPipeline;
  let hub: TelemetryHub;
  let scorer: ResilienceScorer;

  beforeAll(async () => {
    pipeline = new ToxicPipeline();
    hub = new TelemetryHub();
    scorer = new ResilienceScorer('http://127.0.0.1:9999', pipeline);
    api = new ControlApi(0, pipeline, hub, scorer);
    await api.start();
    port = api.getPort();
  });

  afterAll(async () => {
    await api.stop();
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
});
