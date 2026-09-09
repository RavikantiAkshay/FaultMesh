/**
 * FaultMesh Core Domain Types & Contracts
 */

export type ToxicType = 'latency' | 'bandwidth' | 'cut' | 'corrupt' | 'status';

export type ToxicStreamDirection = 'upstream' | 'downstream';

export interface LatencyToxicConfig {
  latencyMs: number;
  jitterMs?: number;
}

export interface BandwidthToxicConfig {
  rateKbps: number; // Kilobits per second
}

export interface CutToxicConfig {
  cutAfterBytes?: number;
  cutAfterPercent?: number; // 0 to 100
}

export interface CorruptToxicConfig {
  corruptProbability?: number; // 0.0 to 1.0 (default 1.0)
  corruptType?: 'bitflip' | 'truncate' | 'garbage';
}

export interface StatusToxicConfig {
  statusCode: number;
  statusMessage?: string;
  responseBody?: string;
}

export type ToxicConfigMap = {
  latency: LatencyToxicConfig;
  bandwidth: BandwidthToxicConfig;
  cut: CutToxicConfig;
  corrupt: CorruptToxicConfig;
  status: StatusToxicConfig;
};

export interface ToxicRule<T extends ToxicType = ToxicType> {
  id: string;
  name: string;
  type: T;
  direction: ToxicStreamDirection;
  enabled: boolean;
  config: ToxicConfigMap[T];
  pathPattern?: string;
}

export interface ProxyConfig {
  port: number;
  targetUrl: string;
  host?: string;
}

export interface TelemetryEvent {
  id: string;
  timestamp: number;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  bytesReceived: number;
  bytesSent: number;
  appliedToxics: string[];
  error?: string;
}

export interface ProxyMetrics {
  totalRequests: number;
  activeConnections: number;
  bytesProxied: number;
  faultsInjected: number;
  avgLatencyMs: number;
}

export interface ResilienceAttackResult {
  name: string;
  description: string;
  toxicUsed: ToxicType;
  passed: boolean;
  latencyMs: number;
  errorCaught?: string;
  details: string;
}

export interface ResilienceScorecard {
  score: number; // 0 - 100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  timestamp: number;
  totalAttacks: number;
  passedAttacks: number;
  results: ResilienceAttackResult[];
  recommendations: string[];
}

export type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low';

export interface SecurityCheckResult {
  id: string;
  name: string;
  category: 'headers' | 'cors' | 'leakage' | 'injection' | 'errors' | 'pii-leakage' | 'traversal';
  description: string;
  passed: boolean;
  severity: SecuritySeverity;
  latencyMs: number;
  details: string;
  remediation: string;
}

export interface SecurityScorecard {
  score: number; // 0 - 100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  timestamp: number;
  totalChecks: number;
  passedChecks: number;
  checks: SecurityCheckResult[];
  recommendations: string[];
}

export interface TrafficStormResult {
  id: string;
  name: string;
  category: 'ratelimit' | 'payload' | 'slowloris' | 'idempotency';
  description: string;
  passed: boolean;
  severity: SecuritySeverity;
  latencyMs: number;
  details: string;
  remediation: string;
}

export interface TrafficStormScorecard {
  score: number; // 0 - 100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  timestamp: number;
  totalChecks: number;
  passedChecks: number;
  checks: TrafficStormResult[];
  recommendations: string[];
}

