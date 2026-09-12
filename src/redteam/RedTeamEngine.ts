/**
 * FaultMesh — Autonomous Red Chaos Team Engine
 * RedTeamEngine: Coordinates adversarial multi-wave assault campaigns using ECC personas.
 */

import http from 'node:http';
import { ToxicPipeline } from '../engine/ToxicPipeline.js';
import { TelemetryHub } from '../engine/TelemetryHub.js';
import { EccAgentBridge } from './EccAgentBridge.js';
import {
  CampaignOptions,
  CampaignPhase,
  CampaignReport,
  CampaignStatus,
  CampaignLog,
  AssaultWave,
  BreachFinding,
  BreachProof,
} from './types.js';

export class RedTeamEngine {
  private pipeline: ToxicPipeline;
  private telemetryHub: TelemetryHub;
  private bridge: EccAgentBridge;

  private currentPhase: CampaignPhase = 'idle';
  private activeCampaignId: string | null = null;
  private aborted = false;
  private active = false;

  private currentWaveIndex = 0;
  private totalWaves = 0;
  private currentWaveName = '';
  private activePersonaName = '';
  private probesSent = 0;
  private breaches: BreachFinding[] = [];
  private logs: CampaignLog[] = [];
  private startTime = 0;
  private endTime = 0;
  private targetUrl = 'http://127.0.0.1:3001';
  private intensity: 'stealth' | 'sustained' | 'avalanche' = 'sustained';
  private lastReport: CampaignReport | null = null;

  constructor(
    pipeline: ToxicPipeline,
    telemetryHub: TelemetryHub,
    bridge?: EccAgentBridge
  ) {
    this.pipeline = pipeline;
    this.telemetryHub = telemetryHub;
    this.bridge = bridge || new EccAgentBridge();
  }

  public getStatus(): CampaignStatus {
    const critical = this.breaches.filter(b => b.severity === 'critical').length;
    const high = this.breaches.filter(b => b.severity === 'high').length;
    const medium = this.breaches.filter(b => b.severity === 'medium').length;
    const low = this.breaches.filter(b => b.severity === 'low').length;

    const progressPercent = this.totalWaves > 0
      ? Math.min(100, Math.round(((this.currentWaveIndex + (this.active ? 0.5 : 0)) / this.totalWaves) * 100))
      : 0;

    return {
      active: this.active,
      campaignId: this.activeCampaignId,
      phase: this.currentPhase,
      progressPercent,
      currentWave: this.currentWaveIndex,
      totalWaves: this.totalWaves,
      currentWaveName: this.currentWaveName,
      activePersona: this.activePersonaName,
      probesSent: this.probesSent,
      breachesCount: {
        critical,
        high,
        medium,
        low,
        total: this.breaches.length,
      },
      latestLog: this.logs.length > 0 ? this.logs[this.logs.length - 1] : undefined,
    };
  }

  public getReport(): CampaignReport | null {
    return this.lastReport;
  }

  public async startCampaign(options: CampaignOptions = {}): Promise<CampaignReport> {
    if (this.active) {
      throw new Error('A Red Team campaign is already in progress');
    }

    this.active = true;
    this.aborted = false;
    this.activeCampaignId = `camp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.targetUrl = options.targetUrl || 'http://127.0.0.1:3001';
    this.intensity = options.intensity || 'sustained';
    this.startTime = Date.now();
    this.endTime = 0;
    this.probesSent = 0;
    this.breaches = [];
    this.logs = [];

    await this.bridge.initialize();
    const personas = await this.bridge.getPersonas();
    const waves = this.bridge.generateCampaignWaves(this.intensity);
    this.totalWaves = waves.length;

    this.addLog(0, 'RED-COMMAND', `Campaign initialized [${this.activeCampaignId}]. Target: ${this.targetUrl}. Intensity: ${this.intensity.toUpperCase()}`, 'info');

    try {
      // Phase 1: Recon & Target Fingerprinting
      this.currentPhase = 'recon';
      this.activePersonaName = 'Security Reviewer';
      this.currentWaveName = 'Target Fingerprinting & Recon';
      this.emitProgress();
      await this.executeReconPhase();

      if (this.aborted) return this.finalizeAbortedCampaign();

      // Phase 2: Weaponization
      this.currentPhase = 'weaponize';
      this.currentWaveName = 'ECC Weaponization & Strategy Formulation';
      this.addLog(0, 'ECC-SYNTHESIZER', `Formulating ${waves.length} assault waves mapped to ${personas.length} active ECC personas`, 'info');
      this.emitProgress();
      await this.sleep(400);

      if (this.aborted) return this.finalizeAbortedCampaign();

      // Phase 3: Multi-Wave Assault
      this.currentPhase = 'assault';
      for (let i = 0; i < waves.length; i++) {
        if (this.aborted) break;
        this.currentWaveIndex = i + 1;
        const wave = waves[i];
        this.currentWaveName = wave.name;
        this.activePersonaName = wave.personaName;

        this.addLog(wave.waveNumber, wave.callSign, `Launching Wave ${wave.waveNumber}/${waves.length}: ${wave.name}`, 'info');
        this.emitWaveStart(wave);

        await this.executeAssaultWave(wave);
        await this.sleep(300);
      }

      if (this.aborted) return this.finalizeAbortedCampaign();

      // Phase 4 & 5: Blast Radius Calculation & Debrief
      this.currentPhase = 'debrief';
      this.currentWaveName = 'Blast Radius Analysis & Debrief Compilation';
      this.addLog(0, 'BLAST-ANALYST', 'Quantifying system blast radius and survivability scorecard', 'info');
      this.emitProgress();
      await this.sleep(300);

      return this.finalizeSuccessfulCampaign(waves);
    } catch (err: any) {
      this.addLog(0, 'COMMAND-FAIL', `Campaign execution failure: ${err.message}`, 'warn');
      return this.finalizeAbortedCampaign();
    } finally {
      this.cleanupToxics();
      this.active = false;
    }
  }

  public abortCampaign(): { success: boolean; message: string } {
    if (!this.active) {
      return { success: false, message: 'No active campaign to abort' };
    }

    this.aborted = true;
    this.currentPhase = 'aborted';
    this.addLog(this.currentWaveIndex, 'COMMAND-ABORT', 'Emergency abort signal received. Neutralizing assault waves and flushing toxic pipeline.', 'warn');
    this.cleanupToxics();
    this.active = false;
    this.emitProgress();

    return { success: true, message: 'Red Team campaign safely aborted' };
  }

  private async executeReconPhase(): Promise<void> {
    this.addLog(0, 'VULN-HUNTER', `Initiating surface discovery on ${this.targetUrl}`, 'info');

    try {
      const pingRes = await this.dispatchProbe('GET', '/api/data', {}, undefined, 2000);
      this.probesSent++;

      const headers = pingRes.headers || {};
      const serverBanner = headers['server'] || headers['x-powered-by'] || 'Generic / Obfuscated';
      const corsOrigin = headers['access-control-allow-origin'] || 'Restricted / None';

      this.addLog(0, 'VULN-HUNTER', `Target reachable. Server signature: [${serverBanner}], CORS: [${corsOrigin}], Response time: ${pingRes.durationMs}ms`, 'pass');

      // Check defensive headers upfront
      if (!headers['x-content-type-options'] || !headers['x-frame-options']) {
        const breach: BreachFinding = {
          id: `br_recon_headers_${Date.now()}`,
          personaId: 'security-reviewer',
          personaName: 'Security Reviewer',
          callSign: 'VULN-HUNTER',
          severity: 'high',
          category: 'Security Perimeter',
          title: 'Missing Baseline Defensive Security Headers',
          impact: 'Exposes target to MIME-sniffing, clickjacking, and origin reflection vulnerabilities.',
          endpoint: '/api/data',
          proofOfBreach: {
            method: 'GET',
            url: `${this.targetUrl}/api/data`,
            responseStatus: pingRes.status,
            responseDurationMs: pingRes.durationMs,
            snippet: `Headers: ${JSON.stringify({ 'x-content-type-options': headers['x-content-type-options'], 'x-frame-options': headers['x-frame-options'] })}`,
          },
          remediation: 'Attach nosniff and DENY frame-options headers to all HTTP responses.',
          autoHealCheckKey: 'Defensive Security Headers',
        };
        this.breaches.push(breach);
        this.emitBreach(breach);
        this.addLog(0, 'VULN-HUNTER', `Breach discovered: ${breach.title} [HIGH]`, 'breach');
      }
    } catch (err: any) {
      this.addLog(0, 'VULN-HUNTER', `Recon warning: Target response irregular (${err.message})`, 'warn');
    }
  }

  private async executeAssaultWave(wave: AssaultWave): Promise<void> {
    // 1. Inject wave-specific toxics into the middleman proxy
    this.installWaveToxics(wave);

    try {
      switch (wave.id) {
        case 'wave-1-security-recon':
          await this.runSecurityWave(wave);
          break;
        case 'wave-2-transport-stress':
          await this.runTransportStressWave(wave);
          break;
        case 'wave-3-jitter-degrade':
          await this.runJitterDegradeWave(wave);
          break;
        case 'wave-4-adversarial-mutant':
          await this.runAdversarialMutantWave(wave);
          break;
        case 'wave-5-resource-exhaustion':
          await this.runResourceExhaustionWave(wave);
          break;
        default:
          await this.runGenericWave(wave);
      }
    } finally {
      this.cleanupToxics();
    }
  }

  private async runSecurityWave(wave: AssaultWave): Promise<void> {
    // Probe 1: Host Header Poisoning
    const hostRes = await this.dispatchProbe('GET', '/api/data', {
      'Host': 'attacker-controlled.net',
      'X-Forwarded-Host': 'attacker-controlled.net',
    });
    this.probesSent++;

    if (hostRes.status === 200) {
      const breach: BreachFinding = {
        id: `br_sec_host_${Date.now()}`,
        personaId: wave.personaId,
        personaName: wave.personaName,
        callSign: wave.callSign,
        severity: 'high',
        category: 'Host Validation',
        title: 'Unrestricted Host Header Acceptance',
        impact: 'Server accepted spoofed Host header attacker-controlled.net without validation.',
        endpoint: '/api/data',
        proofOfBreach: {
          method: 'GET',
          url: `${this.targetUrl}/api/data`,
          requestHeaders: { 'Host': 'attacker-controlled.net' },
          responseStatus: hostRes.status,
          responseDurationMs: hostRes.durationMs,
          snippet: hostRes.body.slice(0, 140),
        },
        remediation: 'Enforce strict host whitelist validation in reverse proxy and backend server.',
        autoHealCheckKey: 'Host Header Poisoning & Reflection',
      };
      this.breaches.push(breach);
      this.emitBreach(breach);
      this.addLog(wave.waveNumber, wave.callSign, `Host Header Poisoning probe breached! [HIGH]`, 'breach');
    }

    // Probe 2: Directory Path Traversal
    const travRes = await this.dispatchProbe('GET', '/api/data?file=../../../../etc/passwd', {});
    this.probesSent++;

    if (travRes.status === 200 && !travRes.body.toLowerCase().includes('error')) {
      const breach: BreachFinding = {
        id: `br_sec_traversal_${Date.now()}`,
        personaId: wave.personaId,
        personaName: wave.personaName,
        callSign: wave.callSign,
        severity: 'critical',
        category: 'Input Sanitization',
        title: 'Potential Path Traversal & Unsanitized Parameter Acceptance',
        impact: 'Relative path traversal sequences passed without rejection.',
        endpoint: '/api/data?file=../../../../etc/passwd',
        proofOfBreach: {
          method: 'GET',
          url: `${this.targetUrl}/api/data?file=../../../../etc/passwd`,
          responseStatus: travRes.status,
          responseDurationMs: travRes.durationMs,
          snippet: travRes.body.slice(0, 140),
        },
        remediation: 'Sanitize query inputs, strip relative traversal characters, and reject unauthorized path lookups.',
        autoHealCheckKey: 'Path Traversal & Directory Escape (../)',
      };
      this.breaches.push(breach);
      this.emitBreach(breach);
      this.addLog(wave.waveNumber, wave.callSign, `Path Traversal probe accepted! [CRITICAL]`, 'breach');
    }

    // Probe 3: Broken Auth Header / Unhandled Crash
    const authRes = await this.dispatchProbe('GET', '/api/profile', {
      'Authorization': 'Bearer malformed.invalid.token.signature',
    });
    this.probesSent++;

    if (authRes.status >= 500) {
      const breach: BreachFinding = {
        id: `br_sec_authcrash_${Date.now()}`,
        personaId: wave.personaId,
        personaName: wave.personaName,
        callSign: wave.callSign,
        severity: 'critical',
        category: 'Authentication',
        title: 'Server Crash (HTTP 500) on Malformed Authorization Header',
        impact: 'Unsigned or malformed authentication tokens cause internal server unhandled exceptions.',
        endpoint: '/api/profile',
        proofOfBreach: {
          method: 'GET',
          url: `${this.targetUrl}/api/profile`,
          requestHeaders: { 'Authorization': 'Bearer malformed.invalid.token' },
          responseStatus: authRes.status,
          responseDurationMs: authRes.durationMs,
          snippet: authRes.body.slice(0, 140),
        },
        remediation: 'Catch token decoding errors cleanly and return HTTP 401 Unauthorized.',
        autoHealCheckKey: 'Unsigned & Broken Authorization Headers',
      };
      this.breaches.push(breach);
      this.emitBreach(breach);
      this.addLog(wave.waveNumber, wave.callSign, `Server 500 crash on malformed token! [CRITICAL]`, 'breach');
    }
  }

  private async runTransportStressWave(wave: AssaultWave): Promise<void> {
    // Tests behavior when connection is dropped or cut
    for (let i = 0; i < wave.probesCount; i++) {
      if (this.aborted) break;
      const res = await this.dispatchProbe('GET', '/api/data', {}, undefined, 3000);
      this.probesSent++;

      if (res.status === 0 || res.status >= 500) {
        this.addLog(wave.waveNumber, wave.callSign, `Socket dropped mid-download as injected (${res.status || 'ECONNRESET'})`, 'info');
      } else if (res.status === 200 && res.body.length < 50) {
        const breach: BreachFinding = {
          id: `br_silent_trunc_${Date.now()}`,
          personaId: wave.personaId,
          personaName: wave.personaName,
          callSign: wave.callSign,
          severity: 'high',
          category: 'Stream Resilience',
          title: 'Silent Stream Truncation Accepted as Complete 200 OK',
          impact: 'Server or proxy returned partial body without Content-Length mismatch detection.',
          endpoint: '/api/data',
          proofOfBreach: {
            method: 'GET',
            url: `${this.targetUrl}/api/data`,
            responseStatus: res.status,
            responseDurationMs: res.durationMs,
            snippet: `Truncated response body (${res.body.length} bytes): ${res.body}`,
          },
          remediation: 'Ensure clients and proxy verify complete stream transmission or raise stream error.',
          autoHealCheckKey: 'Payload Truncation & Partial Transfer',
        };
        this.breaches.push(breach);
        this.emitBreach(breach);
        this.addLog(wave.waveNumber, wave.callSign, `Silent truncation breach found! [HIGH]`, 'breach');
        break;
      }
      await this.sleep(100);
    }
  }

  private async runJitterDegradeWave(wave: AssaultWave): Promise<void> {
    const latencies: number[] = [];
    for (let i = 0; i < wave.probesCount; i++) {
      if (this.aborted) break;
      const res = await this.dispatchProbe('GET', '/api/users', {}, undefined, 4000);
      this.probesSent++;
      latencies.push(res.durationMs);
      await this.sleep(80);
    }

    const maxLatency = Math.max(...latencies, 0);
    const minLatency = Math.min(...latencies, 0);
    const variance = maxLatency - minLatency;

    this.addLog(wave.waveNumber, wave.callSign, `Jitter analysis: min ${minLatency}ms, max ${maxLatency}ms, spread ${variance}ms`, 'info');

    if (variance > 300) {
      this.addLog(wave.waveNumber, wave.callSign, `Significant jitter fluctuation confirmed (+${variance}ms variance)`, 'warn');
    }
  }

  private async runAdversarialMutantWave(wave: AssaultWave): Promise<void> {
    // Probe 1: ReDoS Catastrophic Backtracking input
    const redosPayload = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!';
    const redosStart = Date.now();
    const redosRes = await this.dispatchProbe('GET', `/api/data?search=${encodeURIComponent(redosPayload)}`, {}, undefined, 3000);
    this.probesSent++;
    const redosDuration = Date.now() - redosStart;

    if (redosDuration > 1200) {
      const breach: BreachFinding = {
        id: `br_gan_redos_${Date.now()}`,
        personaId: wave.personaId,
        personaName: wave.personaName,
        callSign: wave.callSign,
        severity: 'critical',
        category: 'Denial of Service',
        title: 'Suspected Catastrophic Regex Backtracking (ReDoS)',
        impact: `Probe with repetitive pattern required ${redosDuration}ms to evaluate, indicating vulnerable non-linear regex complexity.`,
        endpoint: `/api/data?search=...`,
        proofOfBreach: {
          method: 'GET',
          url: `${this.targetUrl}/api/data?search=${redosPayload}`,
          responseStatus: redosRes.status,
          responseDurationMs: redosDuration,
          snippet: `Execution hung for ${redosDuration}ms`,
        },
        remediation: 'Refactor regex patterns to avoid nested quantifiers or set an atomic timeout guard.',
        autoHealCheckKey: 'ReDoS (Regex Denial of Service) Lockup Probe',
      };
      this.breaches.push(breach);
      this.emitBreach(breach);
      this.addLog(wave.waveNumber, wave.callSign, `ReDoS execution hang detected (${redosDuration}ms)! [CRITICAL]`, 'breach');
    }

    // Probe 2: Concurrency Race Condition (Double-processing test)
    const idempotencyKey = `redteam-idem-${Date.now()}`;
    const racePromises = Array.from({ length: 4 }).map(() =>
      this.dispatchProbe('POST', '/api/checkout', {
        'Idempotency-Key': idempotencyKey,
        'Content-Type': 'application/json',
      }, JSON.stringify({ action: 'checkout', amount: 99.95, key: idempotencyKey }), 3000)
    );

    const raceResults = await Promise.all(racePromises);
    this.probesSent += 4;

    const successfulCodes = raceResults.filter(r => r.status === 200 || r.status === 201).length;
    if (successfulCodes > 1) {
      const breach: BreachFinding = {
        id: `br_gan_race_${Date.now()}`,
        personaId: wave.personaId,
        personaName: wave.personaName,
        callSign: wave.callSign,
        severity: 'critical',
        category: 'Concurrency Control',
        title: 'Race Condition: Multiple Duplicate State Mutations Processed',
        impact: `${successfulCodes} concurrent requests with identical Idempotency-Key succeeded without deduplication.`,
        endpoint: '/api/checkout',
        proofOfBreach: {
          method: 'POST',
          url: `${this.targetUrl}/api/checkout`,
          requestHeaders: { 'Idempotency-Key': idempotencyKey },
          responseStatus: raceResults[0].status,
          responseDurationMs: raceResults[0].durationMs,
          snippet: `Identical keys accepted ${successfulCodes} times concurrently`,
        },
        remediation: 'Implement atomic distributed locking or transactional database uniqueness constraints.',
        autoHealCheckKey: 'Duplicate Request Idempotency Protection',
      };
      this.breaches.push(breach);
      this.emitBreach(breach);
      this.addLog(wave.waveNumber, wave.callSign, `Idempotency race condition breached (${successfulCodes} duplicate mutations)! [CRITICAL]`, 'breach');
    }
  }

  private async runResourceExhaustionWave(wave: AssaultWave): Promise<void> {
    // Probe 1: Oversized 1.5MB Body (Checking for HTTP 413)
    const oversizedBody = 'X'.repeat(1.5 * 1024 * 1024);
    const overRes = await this.dispatchProbe('POST', '/api/data', {
      'Content-Type': 'application/json',
    }, oversizedBody, 4000);
    this.probesSent++;

    if (overRes.status === 200) {
      const breach: BreachFinding = {
        id: `br_perf_oversize_${Date.now()}`,
        personaId: wave.personaId,
        personaName: wave.personaName,
        callSign: wave.callSign,
        severity: 'high',
        category: 'Resource Exhaustion',
        title: 'Missing Request Body Size Limit (OOM Vulnerability)',
        impact: 'Server processed 1.5MB payload without enforcing HTTP 413 Payload Too Large.',
        endpoint: '/api/data',
        proofOfBreach: {
          method: 'POST',
          url: `${this.targetUrl}/api/data`,
          responseStatus: overRes.status,
          responseDurationMs: overRes.durationMs,
          snippet: `Allowed payload size: ${oversizedBody.length} bytes`,
        },
        remediation: 'Configure express.json({ limit: "1mb" }) or reverse proxy client_max_body_size.',
        autoHealCheckKey: 'Oversized Payload & Buffer OOM Defense (HTTP 413)',
      };
      this.breaches.push(breach);
      this.emitBreach(breach);
      this.addLog(wave.waveNumber, wave.callSign, `Oversized payload accepted without 413! [HIGH]`, 'breach');
    }

    // Probe 2: Avalanche Concurrency Burst
    const burstCount = this.intensity === 'avalanche' ? 12 : 6;
    const burstPromises = Array.from({ length: burstCount }).map((_, idx) =>
      this.dispatchProbe('GET', `/api/data?burst=${idx}`, {}, undefined, 3000)
    );
    const burstResults = await Promise.all(burstPromises);
    this.probesSent += burstCount;

    const failedBurst = burstResults.filter(r => r.status >= 500 || r.status === 0).length;
    this.addLog(wave.waveNumber, wave.callSign, `Avalanche burst of ${burstCount} concurrent queries completed (${failedBurst} drops)`, 'info');
  }

  private async runGenericWave(wave: AssaultWave): Promise<void> {
    for (let i = 0; i < wave.probesCount; i++) {
      if (this.aborted) break;
      await this.dispatchProbe('GET', wave.targetEndpoint, {}, undefined, 3000);
      this.probesSent++;
      await this.sleep(100);
    }
  }

  private installWaveToxics(wave: AssaultWave): void {
    if (!wave.toxicsToInject || wave.toxicsToInject.length === 0) return;

    for (let i = 0; i < wave.toxicsToInject.length; i++) {
      const t = wave.toxicsToInject[i];
      this.pipeline.addRule({
        id: `redteam_wave_${wave.waveNumber}_${t.type}_${i}`,
        name: `RedTeam [${wave.callSign}] ${t.type}`,
        type: t.type as any,
        direction: t.direction || 'downstream',
        enabled: true,
        pathPattern: t.pathPattern,
        config: t.config as any,
      });
    }
  }

  private cleanupToxics(): void {
    const rules = this.pipeline.getRules();
    for (const r of rules) {
      if (r.id.startsWith('redteam_')) {
        this.pipeline.removeRule(r.id);
      }
    }
  }

  private finalizeSuccessfulCampaign(waves: AssaultWave[]): CampaignReport {
    this.endTime = Date.now();
    this.currentPhase = 'complete';

    // Calculate survivability score (0 - 100)
    let score = 100;
    for (const b of this.breaches) {
      if (b.severity === 'critical') score -= 22;
      else if (b.severity === 'high') score -= 14;
      else if (b.severity === 'medium') score -= 7;
      else score -= 3;
    }
    score = Math.max(0, Math.min(100, score));

    let grade: 'A' | 'B' | 'C' | 'D' | 'F' = 'F';
    if (score >= 90) grade = 'A';
    else if (score >= 80) grade = 'B';
    else if (score >= 68) grade = 'C';
    else if (score >= 50) grade = 'D';

    const activePersonas = Array.from(new Set(waves.map(w => w.personaName)));

    const report: CampaignReport = {
      campaignId: this.activeCampaignId || `camp_${Date.now()}`,
      targetUrl: this.targetUrl,
      intensity: this.intensity,
      phase: 'complete',
      startTime: this.startTime,
      endTime: this.endTime,
      durationMs: this.endTime - this.startTime,
      totalWaves: waves.length,
      completedWaves: waves.length,
      totalProbes: this.probesSent,
      breachesFound: [...this.breaches],
      survivabilityScore: score,
      survivabilityGrade: grade,
      activePersonas,
      logs: [...this.logs],
    };

    this.lastReport = report;
    this.addLog(0, 'COMMAND-SUCCESS', `Campaign concluded with score ${score}/100 [Grade ${grade}]. Found ${this.breaches.length} breaches.`, 'pass');
    this.emitComplete(report);

    return report;
  }

  private finalizeAbortedCampaign(): CampaignReport {
    this.endTime = Date.now();
    this.currentPhase = 'aborted';

    const report: CampaignReport = {
      campaignId: this.activeCampaignId || `camp_${Date.now()}`,
      targetUrl: this.targetUrl,
      intensity: this.intensity,
      phase: 'aborted',
      startTime: this.startTime,
      endTime: this.endTime,
      durationMs: this.endTime - this.startTime,
      totalWaves: this.totalWaves,
      completedWaves: this.currentWaveIndex,
      totalProbes: this.probesSent,
      breachesFound: [...this.breaches],
      survivabilityScore: 0,
      survivabilityGrade: 'F',
      activePersonas: [],
      logs: [...this.logs],
    };

    this.lastReport = report;
    return report;
  }

  private async dispatchProbe(
    method: string,
    endpoint: string,
    headers: Record<string, string>,
    body?: any,
    timeoutMs = 3000
  ): Promise<{ status: number; durationMs: number; headers: Record<string, string>; body: string }> {
    const fullUrl = new URL(endpoint, this.targetUrl);
    const start = Date.now();

    return new Promise((resolve) => {
      let isSettled = false;
      const parsedPort = fullUrl.port ? parseInt(fullUrl.port, 10) : (fullUrl.protocol === 'https:' ? 443 : 80);

      const safeResolve = (result: { status: number; durationMs: number; headers: Record<string, string>; body: string }) => {
        if (isSettled) return;
        isSettled = true;
        clearTimeout(hardDeadlineTimer);
        resolve(result);
      };

      // Hard safety timer to prevent any probe from hanging under unhandled socket drops or TCP starvation
      const hardDeadlineTimer = setTimeout(() => {
        try { req.destroy(); } catch {}
        safeResolve({
          status: 504,
          durationMs: Date.now() - start,
          headers: {},
          body: 'Gateway Timeout (Probe hard deadline exceeded)',
        });
      }, timeoutMs + 100);

      const req = http.request({
        hostname: fullUrl.hostname,
        port: parsedPort,
        path: fullUrl.pathname + fullUrl.search,
        method,
        headers: {
          'User-Agent': 'FaultMesh-RedTeam-Engine/1.0',
          'Accept': 'application/json, text/plain, */*',
          ...headers,
        },
        timeout: timeoutMs,
      }, (res) => {
        let resBody = '';
        res.setEncoding('utf-8');
        res.on('data', chunk => { resBody += chunk; });
        res.on('end', () => {
          const flatHeaders: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            if (v) flatHeaders[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : v;
          }
          safeResolve({
            status: res.statusCode || 0,
            durationMs: Date.now() - start,
            headers: flatHeaders,
            body: resBody,
          });
        });

        // Handle socket severance mid-stream (e.g. CutToxic / ECONNRESET)
        res.on('error', (err) => {
          safeResolve({
            status: 0,
            durationMs: Date.now() - start,
            headers: {},
            body: `Socket error mid-stream: ${err.message}`,
          });
        });

        res.on('close', () => {
          if (!res.complete) {
            safeResolve({
              status: 0,
              durationMs: Date.now() - start,
              headers: {},
              body: 'Connection severed abruptly mid-transfer (ECONNRESET)',
            });
          }
        });
      });

      req.on('timeout', () => {
        try { req.destroy(); } catch {}
        safeResolve({
          status: 504,
          durationMs: Date.now() - start,
          headers: {},
          body: 'Gateway Timeout (Probe deadline exceeded)',
        });
      });

      req.on('error', (err) => {
        safeResolve({
          status: 0,
          durationMs: Date.now() - start,
          headers: {},
          body: `Socket error: ${err.message}`,
        });
      });

      if (body) {
        req.write(body);
      }
      req.end();
    });
  }

  private addLog(waveNumber: number, persona: string, message: string, type: 'info' | 'warn' | 'breach' | 'pass'): void {
    const entry: CampaignLog = {
      timestamp: Date.now(),
      waveNumber,
      persona,
      message,
      type,
    };
    this.logs.push(entry);
    this.telemetryHub.broadcastCustomEvent('redteam-log', entry);
  }

  private emitProgress(): void {
    this.telemetryHub.broadcastCustomEvent('redteam-progress', this.getStatus());
  }

  private emitWaveStart(wave: AssaultWave): void {
    this.telemetryHub.broadcastCustomEvent('redteam-wave-start', {
      wave,
      status: this.getStatus(),
    });
  }

  private emitBreach(breach: BreachFinding): void {
    this.telemetryHub.broadcastCustomEvent('redteam-breach', {
      breach,
      status: this.getStatus(),
    });
  }

  private emitComplete(report: CampaignReport): void {
    this.telemetryHub.broadcastCustomEvent('redteam-complete', {
      report,
      status: this.getStatus(),
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }
}
