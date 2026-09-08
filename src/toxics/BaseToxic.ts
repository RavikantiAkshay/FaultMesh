import { Transform } from 'node:stream';
import { ToxicType } from '../types.js';

export abstract class BaseToxic extends Transform {
  abstract readonly type: ToxicType;
  protected bytesProcessed = 0;
  protected destroyedCleanly = false;

  constructor() {
    super();
  }

  getBytesProcessed(): number {
    return this.bytesProcessed;
  }

  override _destroy(error: Error | null, callback: (error?: Error | null) => void): void {
    this.destroyedCleanly = true;
    this.cleanup();
    super._destroy(error, callback);
  }

  protected cleanup(): void {
    // Subclasses override to clear pending timers or resource handles
  }
}
