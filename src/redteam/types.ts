/**
 * FaultMesh — Autonomous Red Chaos Team Engine
 * Type definitions for multi-wave adversarial campaigns and agent personas.
 */

export type RedTeamSpecialty =
  | 'security'
  | 'silent-failure'
  | 'performance'
  | 'adversarial-gan'
  | 'transport';

export interface RedTeamPersona {
  id: string;
  name: string;
  callSign: string;
  description: string;
  model: string;
  tools: string[];
  specialty: RedTeamSpecialty;
  huntTargets: string[];
  systemPromptExcerpt: string;
  sourceFile: string;
}

export type CampaignPhase =
  | 'idle'
  | 'recon'
  | 'weaponize'
  | 'assault'
  | 'debrief'
  | 'complete'
  | 'aborted';

export type CampaignIntensity = 'stealth' | 'sustained' | 'avalanche';

export interface AssaultWaveToxic {
  type: string;
  config: Record<string, any>;
  direction?: 'upstream' | 'downstream';
  pathPattern?: string;
}

export interface AssaultWave {
  id: string;
  waveNumber: number;
  name: string;
  personaId: string;
  personaName: string;
  callSign: string;
  category: 'security' | 'resilience' | 'storm';
  targetEndpoint: string;
  toxicsToInject: AssaultWaveToxic[];
  probesCount: number;
  concurrency: number;
  description: string;
}

export interface BreachProof {
  method: string;
  url: string;
  requestHeaders?: Record<string, string>;
  requestBody?: any;
  responseStatus: number;
  responseDurationMs: number;
  snippet: string;
  activeToxics?: string[];
}

export interface BreachFinding {
  id: string;
  personaId: string;
  personaName: string;
  callSign: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  impact: string;
  endpoint: string;
  proofOfBreach: BreachProof;
  remediation: string;
  autoHealCheckKey: string;
}

export interface CampaignLog {
  timestamp: number;
  waveNumber: number;
  persona: string;
  message: string;
  type: 'info' | 'warn' | 'breach' | 'pass';
}

export interface CampaignReport {
  campaignId: string;
  targetUrl: string;
  intensity: CampaignIntensity;
  phase: CampaignPhase;
  startTime: number;
  endTime: number;
  durationMs: number;
  totalWaves: number;
  completedWaves: number;
  totalProbes: number;
  breachesFound: BreachFinding[];
  survivabilityScore: number;
  survivabilityGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  activePersonas: string[];
  logs: CampaignLog[];
}

export interface CampaignStatus {
  active: boolean;
  campaignId: string | null;
  phase: CampaignPhase;
  progressPercent: number;
  currentWave: number;
  totalWaves: number;
  currentWaveName: string;
  activePersona: string;
  probesSent: number;
  breachesCount: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  latestLog?: CampaignLog;
}

export interface CampaignOptions {
  targetUrl?: string;
  intensity?: CampaignIntensity;
  personaIds?: string[];
  aiConfig?: {
    provider: string;
    endpoint?: string;
    apiKey?: string;
    model?: string;
  };
}
