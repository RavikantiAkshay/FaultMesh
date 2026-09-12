/**
 * FaultMesh — Autonomous Red Chaos Team Engine
 * ECC Agent Bridge: Loads and translates Enterprise Claude Code (ECC) personas into active attack strategies.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RedTeamPersona,
  RedTeamSpecialty,
  CampaignIntensity,
  AssaultWave,
} from './types.js';

interface ParsedFrontmatter {
  name?: string;
  description?: string;
  model?: string;
  tools?: string[];
}

export class EccAgentBridge {
  private agentsDir: string;
  private personas: Map<string, RedTeamPersona> = new Map();
  private initialized = false;

  constructor(customAgentsDir?: string) {
    if (customAgentsDir) {
      this.agentsDir = customAgentsDir;
    } else {
      const currentDir = path.dirname(fileURLToPath(import.meta.url));
      // Try root workspace .agents/agents
      const candidateRoot = path.resolve(currentDir, '../../.agents/agents');
      const candidateLocal = path.resolve(currentDir, '../.agents/agents');
      if (fs.existsSync(candidateRoot)) {
        this.agentsDir = candidateRoot;
      } else if (fs.existsSync(candidateLocal)) {
        this.agentsDir = candidateLocal;
      } else {
        this.agentsDir = path.resolve(process.cwd(), '.agents/agents');
      }
    }
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;

    const corePersonaFiles: Array<{
      filename: string;
      id: string;
      callSign: string;
      specialty: RedTeamSpecialty;
      defaultHuntTargets: string[];
    }> = [
      {
        filename: 'security-reviewer.md',
        id: 'security-reviewer',
        callSign: 'VULN-HUNTER',
        specialty: 'security',
        defaultHuntTargets: [
          'Host Header Poisoning & Reflection',
          'Path Traversal & Relative Directory Escape',
          'CORS Wildcard & Credential Leakage',
          'Unsigned / Broken Auth Header Crashes',
          'URL Credential & Secret Query Exposure',
          'Response PII & Sensitive Body Leakage',
          'SQL / NoSQL Canary Injection Probing',
        ],
      },
      {
        filename: 'silent-failure-hunter.md',
        id: 'silent-failure-hunter',
        callSign: 'SILENT-TRAPPER',
        specialty: 'silent-failure',
        defaultHuntTargets: [
          'Swallowed Exceptions (HTTP 500 returned as 200 OK)',
          'Truncated / Incomplete JSON Parsing Boundaries',
          'Premature Client Abort & Zombie Connection Leaks',
          'Dropped Socket Recovery During Mid-Stream Cut',
          'Missing Downstream Timeout Enforcement',
        ],
      },
      {
        filename: 'performance-optimizer.md',
        id: 'performance-optimizer',
        callSign: 'SURGE-STORMER',
        specialty: 'performance',
        defaultHuntTargets: [
          'Slowloris Request Header Drip Defense',
          'Chunked POST Stream Starvation',
          'Oversized 1MB+ Buffer OOM Protection (HTTP 413)',
          'Resource Avalanche & Queue Saturation Flood',
          'Rate Limit Exponential Back-Off (HTTP 429)',
        ],
      },
      {
        filename: 'gan-generator.md',
        id: 'gan-adversary',
        callSign: 'MUTANT-PROBER',
        specialty: 'adversarial-gan',
        defaultHuntTargets: [
          'Catastrophic ReDoS Backtracking Payloads',
          'Concurrent Race Conditions (Double-Spend Transaction Probing)',
          'HTTP Parameter Pollution (HPP) Array Type Confusion',
          'Client IP Spoofing & Header Smuggling',
        ],
      },
      {
        filename: 'network-troubleshooter.md',
        id: 'network-troubleshooter',
        callSign: 'NET-FRACTURER',
        specialty: 'transport',
        defaultHuntTargets: [
          'High Packet Latency Spike (+400ms)',
          'High Jitter Variance (±250ms)',
          'Throttled Bandwidth Starvation (16 kbps Cap)',
          'Upstream Gateway Timeout Hang (504 Simulation)',
          'Temporary Upstream Outage (503 Service Unavailable)',
        ],
      },
    ];

    for (const spec of corePersonaFiles) {
      const filePath = path.join(this.agentsDir, spec.filename);
      let persona: RedTeamPersona;

      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          persona = this.parseAgentMarkdown(content, spec.id, spec.callSign, spec.specialty, spec.filename, spec.defaultHuntTargets);
        } catch (err) {
          persona = this.createFallbackPersona(spec.id, spec.callSign, spec.specialty, spec.filename, spec.defaultHuntTargets);
        }
      } else {
        persona = this.createFallbackPersona(spec.id, spec.callSign, spec.specialty, spec.filename, spec.defaultHuntTargets);
      }

      this.personas.set(persona.id, persona);
    }

    this.initialized = true;
  }

  public async getPersonas(): Promise<RedTeamPersona[]> {
    await this.initialize();
    return Array.from(this.personas.values());
  }

  public getPersona(id: string): RedTeamPersona | undefined {
    return this.personas.get(id);
  }

  private parseAgentMarkdown(
    raw: string,
    id: string,
    callSign: string,
    specialty: RedTeamSpecialty,
    filename: string,
    defaultHuntTargets: string[]
  ): RedTeamPersona {
    const frontmatterMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const parsedFm: ParsedFrontmatter = {};

    if (frontmatterMatch) {
      const yamlLines = frontmatterMatch[1].split(/\r?\n/);
      let inTools = false;
      const tools: string[] = [];

      for (const line of yamlLines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('name:')) {
          parsedFm.name = trimmed.replace('name:', '').trim();
        } else if (trimmed.startsWith('description:')) {
          parsedFm.description = trimmed.replace('description:', '').trim();
        } else if (trimmed.startsWith('model:')) {
          parsedFm.model = trimmed.replace('model:', '').trim();
        } else if (trimmed.startsWith('tools:')) {
          inTools = true;
        } else if (inTools && trimmed.startsWith('-')) {
          tools.push(trimmed.replace('-', '').trim());
        } else if (trimmed.length > 0 && !trimmed.startsWith('-')) {
          inTools = false;
        }
      }
      if (tools.length > 0) {
        parsedFm.tools = tools;
      }
    }

    // Extract Hunt Targets from markdown headings or bullet points
    const huntTargets: string[] = [...defaultHuntTargets];
    const targetsRegex = /(?:###|##|\*|-)\s+(?:\d+\.\s+)?([A-Z][A-Za-z0-9\s&/()_,-]{4,60})/g;
    let match: RegExpExecArray | null;
    let count = 0;
    while ((match = targetsRegex.exec(raw)) !== null && count < 6) {
      const title = match[1].trim();
      if (!huntTargets.includes(title) && !title.toLowerCase().includes('responsibilities') && !title.toLowerCase().includes('output format') && !title.toLowerCase().includes('prompt defense')) {
        huntTargets.push(title);
        count++;
      }
    }

    // Extract clean excerpt of system prompt
    const bodyWithoutFm = raw.replace(/^---\r?\n[\s\S]*?\r?\n---/, '').trim();
    const firstParagraph = bodyWithoutFm.split(/\r?\n\r?\n/)[0] || '';
    const cleanExcerpt = firstParagraph.replace(/[#*`_]/g, '').trim().slice(0, 200);

    return {
      id,
      name: parsedFm.name || id,
      callSign,
      description: parsedFm.description || `Autonomous ECC Red Team agent specialized in ${specialty}.`,
      model: parsedFm.model || 'claude-3-5-sonnet',
      tools: parsedFm.tools || ['view_file', 'grep_search', 'run_command'],
      specialty,
      huntTargets: huntTargets.slice(0, 8),
      systemPromptExcerpt: cleanExcerpt,
      sourceFile: `.agents/agents/${filename}`,
    };
  }

  private createFallbackPersona(
    id: string,
    callSign: string,
    specialty: RedTeamSpecialty,
    filename: string,
    huntTargets: string[]
  ): RedTeamPersona {
    const titles: Record<string, string> = {
      'security-reviewer': 'Security Vulnerability & Exploitation Reviewer',
      'silent-failure-hunter': 'Silent Failure & Error Swallowing Hunter',
      'performance-optimizer': 'Resource Exhaustion & Traffic Stormer',
      'gan-adversary': 'Adversarial GAN Mutant Probe Generator',
      'network-troubleshooter': 'Network Transport & Fault Injector',
    };

    return {
      id,
      name: titles[id] || id,
      callSign,
      description: `Autonomous ECC Red Team Agent Persona targeting ${specialty} vulnerabilities.`,
      model: 'claude-3-5-sonnet',
      tools: ['view_file', 'grep_search', 'run_command'],
      specialty,
      huntTargets,
      systemPromptExcerpt: `Autonomous Red Team specialist executing adversarial ${specialty} evaluation.`,
      sourceFile: `.agents/agents/${filename}`,
    };
  }

  /**
   * Translates active personas and chosen intensity into calibrated assault waves
   */
  public generateCampaignWaves(intensity: CampaignIntensity = 'sustained'): AssaultWave[] {
    const waves: AssaultWave[] = [];

    // Multipliers based on intensity
    const probeMultiplier = intensity === 'avalanche' ? 3 : intensity === 'stealth' ? 1 : 2;
    const baseConcurrency = intensity === 'avalanche' ? 10 : intensity === 'stealth' ? 1 : 4;

    // Wave 1: Recon & Security Perimeter Breach (Security Reviewer)
    waves.push({
      id: 'wave-1-security-recon',
      waveNumber: 1,
      name: 'Host Poisoning, IP Spoofing & Auth Perimeter Assault',
      personaId: 'security-reviewer',
      personaName: 'Security Reviewer',
      callSign: 'VULN-HUNTER',
      category: 'security',
      targetEndpoint: '/api/data',
      toxicsToInject: [],
      probesCount: 4 * probeMultiplier,
      concurrency: intensity === 'avalanche' ? 6 : intensity === 'stealth' ? 1 : 3,
      description: 'Dispatches Host header poisoning, X-Forwarded-For IP spoofing, path traversal, and malformed auth tokens.',
    });

    // Wave 2: Silent Failures Under Transport Stress (Silent Failure Hunter + Net Troubleshooter)
    waves.push({
      id: 'wave-2-transport-stress',
      waveNumber: 2,
      name: 'Abrupt Socket Cut & Corrupted JSON Stream Injection',
      personaId: 'silent-failure-hunter',
      personaName: 'Silent Failure Hunter',
      callSign: 'SILENT-TRAPPER',
      category: 'resilience',
      targetEndpoint: '/api/data',
      toxicsToInject: [
        { type: 'bandwidth', config: { rateKbps: 32 }, direction: 'downstream' },
        { type: 'cut', config: { cutAfterBytes: 40 }, direction: 'downstream' },
      ],
      probesCount: 3 * probeMultiplier,
      concurrency: Math.min(2, baseConcurrency),
      description: 'Restricts downstream bandwidth and abruptly severs TCP sockets mid-transfer to evaluate error propagation.',
    });

    // Wave 3: Jitter & Gateway Timeout Degradation (Net Troubleshooter)
    waves.push({
      id: 'wave-3-jitter-degrade',
      waveNumber: 3,
      name: 'Latency Flutter & Gateway 504 Timeout Hang',
      personaId: 'network-troubleshooter',
      personaName: 'Network Troubleshooter',
      callSign: 'NET-FRACTURER',
      category: 'resilience',
      targetEndpoint: '/api/users',
      toxicsToInject: [
        { type: 'latency', config: { latencyMs: 450, jitterMs: 250 }, direction: 'downstream' },
      ],
      probesCount: 3 * probeMultiplier,
      concurrency: Math.min(3, baseConcurrency),
      description: 'Injects severe latency flutter (450ms ± 250ms) and checks client request timeout boundaries.',
    });

    // Wave 4: Adversarial Mutants: ReDoS & Race Condition Injections (GAN Adversary)
    waves.push({
      id: 'wave-4-adversarial-mutant',
      waveNumber: 4,
      name: 'Catastrophic ReDoS & Transactional Race Interleaving',
      personaId: 'gan-adversary',
      personaName: 'Adversarial GAN Mutant',
      callSign: 'MUTANT-PROBER',
      category: 'storm',
      targetEndpoint: '/api/checkout',
      toxicsToInject: [],
      probesCount: 4 * probeMultiplier,
      concurrency: Math.max(4, baseConcurrency),
      description: 'Dispatches catastrophic backtracking regex inputs and rapid parallel duplicate idempotency requests.',
    });

    // Wave 5: Resource Exhaustion & Connection Drip (Performance Optimizer)
    waves.push({
      id: 'wave-5-resource-exhaustion',
      waveNumber: 5,
      name: 'Slowloris Drip, 1MB Buffer Overflow & Avalanche Surge',
      personaId: 'performance-optimizer',
      personaName: 'Performance Optimizer',
      callSign: 'SURGE-STORMER',
      category: 'storm',
      targetEndpoint: '/api/data',
      toxicsToInject: [
        { type: 'latency', config: { latencyMs: 200 }, direction: 'downstream' },
      ],
      probesCount: 5 * probeMultiplier,
      concurrency: baseConcurrency,
      description: 'Fires slow header drips, buffer threshold overloads (>1MB), and sudden concurrency bursts to test pool exhaustion.',
    });

    return waves;
  }
}
