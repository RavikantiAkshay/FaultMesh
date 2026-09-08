import { TransformCallback } from 'node:stream';
import { BaseToxic } from './BaseToxic.js';
import { LatencyToxicConfig, ToxicType } from '../types.js';

export class LatencyToxic extends BaseToxic {
  readonly type: ToxicType = 'latency';
  private latencyMs: number;
  private jitterMs: number;
  private pendingTimer: NodeJS.Timeout | null = null;

  constructor(config: LatencyToxicConfig) {
    super();
    this.latencyMs = Math.max(0, config.latencyMs);
    this.jitterMs = Math.max(0, config.jitterMs ?? 0);
  }

  private calculateDelay(): number {
    if (this.jitterMs === 0) return this.latencyMs;
    const jitter = (Math.random() * 2 - 1) * this.jitterMs;
    return Math.max(0, Math.round(this.latencyMs + jitter));
  }

  override _transform(chunk: any, encoding: BufferEncoding, callback: TransformCallback): void {
    const delay = this.calculateDelay();
    this.bytesProcessed += chunk.length;

    if (delay === 0) {
      this.push(chunk);
      callback();
      return;
    }

    this.pendingTimer = setTimeout(() => {
      this.pendingTimer = null;
      if (!this.destroyedCleanly) {
        this.push(chunk);
        callback();
      }
    }, delay);
  }

  protected override cleanup(): void {
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
  }
}
