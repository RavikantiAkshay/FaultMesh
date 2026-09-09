import { describe, it, expect, vi } from 'vitest';
import { Readable } from 'node:stream';
import { LatencyToxic } from '../../src/toxics/LatencyToxic.js';
import { BandwidthToxic } from '../../src/toxics/BandwidthToxic.js';
import { CutToxic } from '../../src/toxics/CutToxic.js';
import { CorruptToxic } from '../../src/toxics/CorruptToxic.js';
import { StatusToxic } from '../../src/toxics/StatusToxic.js';
import { TelemetryHub } from '../../src/engine/TelemetryHub.js';
import { ToxicPipeline } from '../../src/engine/ToxicPipeline.js';

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

describe('FaultMesh Toxic Stream Transformers (TDD)', () => {
  describe('LatencyToxic', () => {
    it('delays chunk delivery by specified latencyMs without corrupting data', async () => {
      const toxic = new LatencyToxic({ latencyMs: 50, jitterMs: 0 });
      const source = Readable.from([Buffer.from('hello '), Buffer.from('world')]);

      const start = Date.now();
      const piped = source.pipe(toxic);
      const result = await streamToBuffer(piped);
      const elapsed = Date.now() - start;

      expect(result.toString()).toBe('hello world');
      expect(elapsed).toBeGreaterThanOrEqual(40);
    });

    it('passes chunks immediately when latencyMs is 0', async () => {
      const toxic = new LatencyToxic({ latencyMs: 0 });
      const source = Readable.from([Buffer.from('fast')]);

      const result = await streamToBuffer(source.pipe(toxic));
      expect(result.toString()).toBe('fast');
    });

    it('cleans up timers when stream is destroyed early', () => {
      const toxic = new LatencyToxic({ latencyMs: 1000 });
      expect(() => toxic.destroy()).not.toThrow();
    });
  });

  describe('BandwidthToxic', () => {
    it('paces chunk delivery to adhere to rateKbps limit', async () => {
      const toxic = new BandwidthToxic({ rateKbps: 8 });
      const payload = Buffer.alloc(200, 'x');
      const source = Readable.from([payload]);

      const start = Date.now();
      const piped = source.pipe(toxic);
      const result = await streamToBuffer(piped);
      const elapsed = Date.now() - start;

      expect(result.length).toBe(200);
      expect(elapsed).toBeGreaterThanOrEqual(150);
    });

    it('passes tiny chunks immediately if requiredMs <= 5', async () => {
      const toxic = new BandwidthToxic({ rateKbps: 10000 }); // High bandwidth
      const source = Readable.from([Buffer.from('x')]);

      const result = await streamToBuffer(source.pipe(toxic));
      expect(result.toString()).toBe('x');
    });
  });

  describe('CutToxic', () => {
    it('terminates the stream abruptly after specified byte threshold', async () => {
      const toxic = new CutToxic({ cutAfterBytes: 5 });
      const source = Readable.from([Buffer.from('1234567890')]);

      try {
        const piped = source.pipe(toxic);
        const result = await streamToBuffer(piped);
        expect(result.length).toBeLessThanOrEqual(5);
      } catch (err: any) {
        expect(err.message).toContain('severed');
      }
    });

    it('cuts immediately when threshold is 0', async () => {
      const toxic = new CutToxic({ cutAfterBytes: 0 });
      const source = Readable.from([Buffer.from('data')]);

      try {
        await streamToBuffer(source.pipe(toxic));
      } catch (err: any) {
        expect(err.message).toContain('severed');
      }
    });
  });

  describe('CorruptToxic', () => {
    it('mutates bytes in the stream to corrupt structured payloads', async () => {
      const toxic = new CorruptToxic({ corruptProbability: 1.0, corruptType: 'bitflip' });
      const original = '{"user": "alice", "balance": 1000}';
      const source = Readable.from([Buffer.from(original)]);

      const piped = source.pipe(toxic);
      const result = await streamToBuffer(piped);

      expect(result.toString()).not.toBe(original);
      expect(() => JSON.parse(result.toString())).toThrow();
    });

    it('truncates JSON brackets when corruptType is truncate', async () => {
      const toxic = new CorruptToxic({ corruptProbability: 1.0, corruptType: 'truncate' });
      const original = '{"key":"value"}';
      const source = Readable.from([Buffer.from(original)]);

      const piped = source.pipe(toxic);
      const result = await streamToBuffer(piped);

      expect(result.length).toBeLessThan(original.length);
    });

    it('injects random ASCII noise when corruptType is garbage', async () => {
      const toxic = new CorruptToxic({ corruptProbability: 1.0, corruptType: 'garbage' });
      const original = 'some long text that will have noise injected into it';
      const source = Readable.from([Buffer.from(original)]);

      const piped = source.pipe(toxic);
      const result = await streamToBuffer(piped);

      expect(result.toString()).not.toBe(original);
    });
  });

  describe('StatusToxic', () => {
    it('provides status code override metadata and optional body replacement', () => {
      const codes = [400, 429, 500, 502, 503, 504, 599];
      codes.forEach(code => {
        const toxic = new StatusToxic({ statusCode: code });
        expect(toxic.statusCode).toBe(code);
        expect(toxic.statusMessage.length).toBeGreaterThan(0);
      });
    });
  });

  describe('TelemetryHub Unit Tests', () => {
    it('manages metrics, ring buffer, SSE broadcasting, and reset', () => {
      const hub = new TelemetryHub();

      hub.recordRequestStart();
      hub.recordRequestComplete({
        id: 'req-1',
        timestamp: Date.now(),
        method: 'GET',
        path: '/test',
        statusCode: 200,
        durationMs: 40,
        bytesReceived: 10,
        bytesSent: 50,
        appliedToxics: ['Latency'],
      });

      const metrics = hub.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.bytesProxied).toBe(60);
      expect(metrics.faultsInjected).toBe(1);
      expect(metrics.avgLatencyMs).toBe(40);

      const events = hub.getRecentEvents();
      expect(events.length).toBe(1);

      // Mock SSE Client
      const mockRes: any = {
        write: vi.fn(),
        on: vi.fn(),
      };
      hub.registerSSEClient(mockRes);
      expect(mockRes.write).toHaveBeenCalled();

      // Clear
      hub.clear();
      expect(hub.getMetrics().totalRequests).toBe(0);
      expect(hub.getRecentEvents().length).toBe(0);
    });
  });

  describe('Route-Specific Toxic Filtering (pathPattern)', () => {
    it('applies status toxic only when request path matches pathPattern', () => {
      const pipeline = new ToxicPipeline();

      pipeline.addRule({
        id: 'checkout-500',
        name: 'Checkout Failure',
        type: 'status',
        direction: 'downstream',
        enabled: true,
        pathPattern: '/api/checkout',
        config: { statusCode: 503 },
      });

      // Matching paths
      const match1 = pipeline.getActiveStatusToxic('downstream', '/api/checkout');
      expect(match1).not.toBeNull();
      expect(match1?.statusCode).toBe(503);

      const match2 = pipeline.getActiveStatusToxic('downstream', '/api/checkout/pay?token=xyz');
      expect(match2).not.toBeNull();

      // Non-matching paths
      const nonMatch = pipeline.getActiveStatusToxic('downstream', '/api/users/profile');
      expect(nonMatch).toBeNull();
    });

    it('applies stream transformers only when request path matches pathPattern', () => {
      const pipeline = new ToxicPipeline();

      pipeline.addRule({
        id: 'selective-latency',
        name: 'Targeted Delay',
        type: 'latency',
        direction: 'downstream',
        enabled: true,
        pathPattern: '/heavy-query',
        config: { latencyMs: 200 },
      });

      const matched = pipeline.createStreamTransformers('downstream', '/heavy-query?limit=100');
      expect(matched.transformers.length).toBe(1);
      expect(matched.appliedNames[0]).toContain('Targeted Delay');

      const skipped = pipeline.createStreamTransformers('downstream', '/light-query');
      expect(skipped.transformers.length).toBe(0);
      expect(skipped.appliedNames.length).toBe(0);
    });

    it('applies everywhere when pathPattern is empty or omitted', () => {
      const pipeline = new ToxicPipeline();

      pipeline.addRule({
        id: 'global-cut',
        name: 'Global Sever',
        type: 'cut',
        direction: 'downstream',
        enabled: true,
        config: { cutAfterBytes: 10 },
      });

      const result = pipeline.createStreamTransformers('downstream', '/any-path-here');
      expect(result.transformers.length).toBe(1);
    });
  });
});

