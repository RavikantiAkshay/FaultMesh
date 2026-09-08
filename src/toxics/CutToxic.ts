import { TransformCallback } from 'node:stream';
import { BaseToxic } from './BaseToxic.js';
import { CutToxicConfig, ToxicType } from '../types.js';

export class CutToxic extends BaseToxic {
  readonly type: ToxicType = 'cut';
  private cutAfterBytes: number;

  constructor(config: CutToxicConfig) {
    super();
    this.cutAfterBytes = Math.max(0, config.cutAfterBytes ?? 1024);
  }

  override _transform(chunk: any, encoding: BufferEncoding, callback: TransformCallback): void {
    const remainingAllowed = this.cutAfterBytes - this.bytesProcessed;

    if (remainingAllowed <= 0) {
      // Threshold already hit, cut immediately
      this.destroy(new Error('FaultMesh: Connection abruptly severed by CutToxic'));
      callback();
      return;
    }

    if (chunk.length <= remainingAllowed) {
      this.bytesProcessed += chunk.length;
      this.push(chunk);
      callback();
    } else {
      // Partially send up to threshold then sever connection
      const partial = chunk.subarray(0, remainingAllowed);
      this.bytesProcessed += partial.length;
      this.push(partial);
      this.destroy(new Error('FaultMesh: Connection abruptly severed by CutToxic'));
      callback();
    }
  }
}
