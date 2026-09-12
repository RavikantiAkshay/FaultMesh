import http, { IncomingMessage, ServerResponse } from 'node:http';
import { pipeline } from 'node:stream/promises';
import { ProxyConfig, TelemetryEvent } from '../types.js';
import { ToxicPipeline } from './ToxicPipeline.js';
import { TelemetryHub } from './TelemetryHub.js';

export class FaultMeshProxy {
  private server: http.Server;
  private port = 0;
  private config: ProxyConfig;
  private toxicPipeline: ToxicPipeline;
  private telemetryHub: TelemetryHub;
  private isRunning = false;

  constructor(config: ProxyConfig, toxicPipeline: ToxicPipeline, telemetryHub: TelemetryHub) {
    this.config = config;
    this.toxicPipeline = toxicPipeline;
    this.telemetryHub = telemetryHub;

    this.server = http.createServer((req, res) => this.handleRequest(req, res));
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const startTime = Date.now();
    const requestId = `req_${Math.random().toString(36).substring(2, 9)}`;
    this.telemetryHub.recordRequestStart();

    const appliedToxics: string[] = [];
    let bytesReceived = 0;
    let bytesSent = 0;

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      });
      res.end();
      return;
    }

    const requestPath = req.url || '/';

    // 1. Check for immediate downstream Status override toxic
    const statusToxic = this.toxicPipeline.getActiveStatusToxic('downstream', requestPath);
    if (statusToxic) {
      appliedToxics.push(`Status (${statusToxic.statusCode})`);
      const body = statusToxic.responseBody || JSON.stringify({
        error: statusToxic.statusMessage,
        code: statusToxic.statusCode,
        faultMesh: true,
      });

      // Check if there is also an active downstream latency toxic
      const latencyRule = this.toxicPipeline.getRules().find(r =>
        r.enabled &&
        r.type === 'latency' &&
        r.direction === 'downstream' &&
        (!r.pathPattern || !r.pathPattern.trim() || requestPath.includes(r.pathPattern.trim()))
      );

      if (latencyRule && latencyRule.config) {
        const lCfg = latencyRule.config as any;
        let delay = Math.max(0, lCfg.latencyMs || 0);
        if (lCfg.jitterMs) {
          const jitter = (Math.random() * 2 - 1) * lCfg.jitterMs;
          delay = Math.max(0, Math.round(delay + jitter));
        }
        if (delay > 0) {
          appliedToxics.push(`Latency (${delay}ms)`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-FaultMesh-Injected': 'status',
        'Access-Control-Allow-Origin': '*',
      };
      if (statusToxic.statusCode === 429) {
        headers['Retry-After'] = '15';
      }

      res.writeHead(statusToxic.statusCode, headers);
      res.end(body);

      this.telemetryHub.recordRequestComplete({
        id: requestId,
        timestamp: startTime,
        method: req.method || 'GET',
        path: req.url || '/',
        statusCode: statusToxic.statusCode,
        durationMs: Date.now() - startTime,
        bytesReceived: 0,
        bytesSent: Buffer.byteLength(body),
        appliedToxics,
      });
      return;
    }

    // 2. Prepare Upstream forwarding
    const targetUrl = new URL(req.url || '/', this.config.targetUrl);
    const options: http.RequestOptions = {
      protocol: targetUrl.protocol,
      hostname: targetUrl.hostname,
      port: targetUrl.port,
      path: targetUrl.pathname + targetUrl.search,
      method: req.method,
      headers: { ...req.headers, host: targetUrl.host },
    };

    const upstreamReq = http.request(options, async (upstreamRes) => {
      // 3. Prepare Downstream transformers
      const { transformers: downstreamTransformers, appliedNames } =
        this.toxicPipeline.createStreamTransformers('downstream', requestPath);
      appliedToxics.push(...appliedNames);

      const headers = { ...upstreamRes.headers };
      delete headers['content-length']; // Length changes if chunks are compressed, cut, or padded
      headers['x-faultmesh-proxy'] = 'active';
      headers['access-control-allow-origin'] = '*';

      res.writeHead(upstreamRes.statusCode || 200, headers);

      try {
        if (downstreamTransformers.length > 0) {
          // Chain transformers between upstreamRes and client res
          let currentStream: any = upstreamRes;
          for (const t of downstreamTransformers) {
            currentStream = currentStream.pipe(t);
          }
          currentStream.on('data', (chunk: Buffer) => {
            bytesSent += chunk.length;
            res.write(chunk);
          });
          currentStream.on('end', () => {
            res.end();
            finishTelemetry(upstreamRes.statusCode || 200);
          });
          currentStream.on('error', (err: any) => {
            res.destroy(err);
            finishTelemetry(upstreamRes.statusCode || 200, err.message);
          });
        } else {
          upstreamRes.on('data', (chunk: Buffer) => {
            bytesSent += chunk.length;
            res.write(chunk);
          });
          upstreamRes.on('end', () => {
            res.end();
            finishTelemetry(upstreamRes.statusCode || 200);
          });
        }
      } catch (err: any) {
        res.destroy(err);
        finishTelemetry(502, err.message);
      }
    });

    const finishTelemetry = (statusCode: number, error?: string) => {
      this.telemetryHub.recordRequestComplete({
        id: requestId,
        timestamp: startTime,
        method: req.method || 'GET',
        path: req.url || '/',
        statusCode,
        durationMs: Date.now() - startTime,
        bytesReceived,
        bytesSent,
        appliedToxics,
        error,
      });
    };

    upstreamReq.on('error', (err) => {
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Upstream connection failed', details: err.message }));
      }
      finishTelemetry(502, err.message);
    });

    req.on('data', (chunk) => {
      bytesReceived += chunk.length;
    });

    // Forward request body to upstream
    req.pipe(upstreamReq);
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.config.port, () => {
        const address = this.server.address();
        if (address && typeof address === 'object') {
          this.port = address.port;
        }
        this.isRunning = true;
        resolve();
      });
      this.server.once('error', reject);
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.isRunning) return resolve();
      this.server.close(() => {
        this.isRunning = false;
        resolve();
      });
    });
  }

  getPort(): number {
    return this.port;
  }

  setTargetUrl(url: string): void {
    this.config.targetUrl = url;
  }

  getTargetUrl(): string {
    return this.config.targetUrl;
  }
}
