import { TransformCallback } from 'node:stream';
import { BaseToxic } from './BaseToxic.js';
import { CorruptToxicConfig, ToxicType } from '../types.js';

export class CorruptToxic extends BaseToxic {
  readonly type: ToxicType = 'corrupt';
  private probability: number;
  private corruptType: 'bitflip' | 'truncate' | 'garbage';

  constructor(config: CorruptToxicConfig = {}) {
    super();
    this.probability = config.corruptProbability ?? 1.0;
    this.corruptType = config.corruptType ?? 'bitflip';
  }

  private mutateBuffer(buffer: Buffer): Buffer {
    if (buffer.length === 0) return buffer;
    const copy = Buffer.from(buffer);

    switch (this.corruptType) {
      case 'truncate': {
        // Cut the last 20% of the buffer (breaks JSON closing tags)
        const keepLen = Math.max(1, Math.floor(copy.length * 0.75));
        return copy.subarray(0, keepLen);
      }
      case 'garbage': {
        // Overwrite random bytes with ASCII noise
        const count = Math.max(2, Math.floor(copy.length * 0.25));
        for (let i = 0; i < count; i++) {
          const idx = Math.floor(Math.random() * copy.length);
          copy[idx] = 0x21 + Math.floor(Math.random() * 90);
        }
        return copy;
      }
      case 'bitflip':
      default: {
        // Corrupt syntax structure by zeroing critical delimiters or flipping multiple bits
        for (let i = 0; i < Math.min(copy.length, 3); i++) {
          const targetIndex = (i * 7 + 1) % copy.length;
          // Invert byte and ensure non-printable / broken syntax
          copy[targetIndex] = 0x00; // NULL byte breaks standard JSON strings/tokens
        }
        return copy;
      }
    }
  }

  override _transform(chunk: any, encoding: BufferEncoding, callback: TransformCallback): void {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    this.bytesProcessed += buf.length;

    if (Math.random() <= this.probability) {
      this.push(this.mutateBuffer(buf));
    } else {
      this.push(buf);
    }
    callback();
  }
}
