import { ServerResponse } from 'node:http';
import { ProxyMetrics, TelemetryEvent } from '../types.js';

export class TelemetryHub {
  private metrics: ProxyMetrics = {
    totalRequests: 0,
    activeConnections: 0,
    bytesProxied: 0,
    faultsInjected: 0,
    avgLatencyMs: 0,
  };

  private recentEvents: TelemetryEvent[] = [];
  private readonly maxRecentEvents = 50;
  private sseClients: Set<ServerResponse> = new Set();
  private latencySum = 0;

  recordRequestStart(): void {
    this.metrics.totalRequests++;
    this.metrics.activeConnections++;
  }

  recordRequestComplete(event: TelemetryEvent): void {
    this.metrics.activeConnections = Math.max(0, this.metrics.activeConnections - 1);
    this.metrics.bytesProxied += event.bytesReceived + event.bytesSent;
    this.metrics.faultsInjected += event.appliedToxics.length;

    this.latencySum += event.durationMs;
    this.metrics.avgLatencyMs = Math.round(this.latencySum / this.metrics.totalRequests);

    // Keep ring buffer
    this.recentEvents.unshift(event);
    if (this.recentEvents.length > this.maxRecentEvents) {
      this.recentEvents.pop();
    }

    // Broadcast to live SSE subscribers
    this.broadcastSSE('telemetry', event);
  }

  getMetrics(): ProxyMetrics {
    return { ...this.metrics };
  }

  getRecentEvents(): TelemetryEvent[] {
    return [...this.recentEvents];
  }

  registerSSEClient(res: ServerResponse): void {
    this.sseClients.add(res);
    // Send initial snapshot
    res.write(`event: snapshot\ndata: ${JSON.stringify({ metrics: this.metrics, events: this.recentEvents })}\n\n`);

    res.on('close', () => {
      this.sseClients.delete(res);
    });
  }

  private broadcastSSE(eventType: string, data: any): void {
    const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.sseClients) {
      try {
        client.write(payload);
      } catch {
        this.sseClients.delete(client);
      }
    }
  }

  clear(): void {
    this.metrics = {
      totalRequests: 0,
      activeConnections: 0,
      bytesProxied: 0,
      faultsInjected: 0,
      avgLatencyMs: 0,
    };
    this.latencySum = 0;
    this.recentEvents = [];
  }
}
