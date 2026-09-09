import { Transform } from 'node:stream';
import { ToxicRule, ToxicStreamDirection } from '../types.js';
import { LatencyToxic } from '../toxics/LatencyToxic.js';
import { BandwidthToxic } from '../toxics/BandwidthToxic.js';
import { CutToxic } from '../toxics/CutToxic.js';
import { CorruptToxic } from '../toxics/CorruptToxic.js';
import { StatusToxic } from '../toxics/StatusToxic.js';

export class ToxicPipeline {
  private rules: Map<string, ToxicRule> = new Map();

  addRule(rule: ToxicRule): void {
    this.rules.set(rule.id, rule);
  }

  removeRule(id: string): boolean {
    return this.rules.delete(id);
  }

  getRules(): ToxicRule[] {
    return Array.from(this.rules.values());
  }

  getRule(id: string): ToxicRule | undefined {
    return this.rules.get(id);
  }

  clearRules(): void {
    this.rules.clear();
  }

  private matchesPath(rule: ToxicRule, requestPath?: string): boolean {
    if (!rule.pathPattern || !rule.pathPattern.trim()) {
      return true;
    }
    if (!requestPath) {
      return true;
    }
    return requestPath.includes(rule.pathPattern.trim());
  }

  /**
   * Check if any active StatusToxic exists for the specified direction and request path
   */
  getActiveStatusToxic(direction: ToxicStreamDirection, requestPath?: string): StatusToxic | null {
    for (const rule of this.rules.values()) {
      if (rule.enabled && rule.type === 'status' && rule.direction === direction) {
        if (!this.matchesPath(rule, requestPath)) continue;
        return new StatusToxic(rule.config as any);
      }
    }
    return null;
  }

  /**
   * Create an array of streaming transformers for the specified stream direction and request path
   */
  createStreamTransformers(direction: ToxicStreamDirection, requestPath?: string): { transformers: Transform[]; appliedNames: string[] } {
    const transformers: Transform[] = [];
    const appliedNames: string[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled || rule.direction !== direction) continue;
      if (!this.matchesPath(rule, requestPath)) continue;

      switch (rule.type) {
        case 'latency':
          transformers.push(new LatencyToxic(rule.config as any));
          appliedNames.push(`Latency (${rule.name})`);
          break;
        case 'bandwidth':
          transformers.push(new BandwidthToxic(rule.config as any));
          appliedNames.push(`Bandwidth (${rule.name})`);
          break;
        case 'cut':
          transformers.push(new CutToxic(rule.config as any));
          appliedNames.push(`Cut (${rule.name})`);
          break;
        case 'corrupt':
          transformers.push(new CorruptToxic(rule.config as any));
          appliedNames.push(`Corrupt (${rule.name})`);
          break;
        case 'status':
          // Status toxics are handled at the HTTP response header layer, not stream byte level
          break;
      }
    }

    return { transformers, appliedNames };
  }
}
