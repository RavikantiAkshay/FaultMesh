import { TransformCallback } from 'node:stream';
import { BaseToxic } from './BaseToxic.js';
import { BandwidthToxicConfig, ToxicType } from '../types.js';

export class BandwidthToxic extends BaseToxic {
  readonly type: ToxicType = 'bandwidth';
  private bytesPerSecond: number;
  private pendingTimer: NodeJS.Timeout | null = null;

  constructor(config: BandwidthToxicConfig) {
    super();
    // 1 kbps = 1000 bits / sec = 125 bytes / sec
    const kbps = Math.max(1, config.rateKbps);
    this.bytesPerSecond = (kbps * 1000) / 8;
  }

  override _transform(chunk: any, encoding: BufferEncoding, callback: TransformCallback): void {
    const chunkBytes = chunk.length;
    this.bytesProcessed += chunkBytes;

    // Time in ms required to transmit this chunk under the rate limit
    const requiredMs = Math.round((chunkBytes / this.bytesPerSecond) * 1000);

    if (requiredMs <= 5) {
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
    }, requiredMs);
  }

  protected override cleanup(): void {
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
  }
}
