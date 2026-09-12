import { describe, it, expect } from 'vitest';
import { EccAgentBridge } from '../../src/redteam/EccAgentBridge.js';

describe('EccAgentBridge (Unit Tests)', () => {
  it('discovers and loads core agent personas', async () => {
    const bridge = new EccAgentBridge();
    const personas = await bridge.getPersonas();

    expect(personas.length).toBeGreaterThanOrEqual(5);

    const sec = personas.find(p => p.id === 'security-reviewer');
    expect(sec).toBeDefined();
    expect(sec?.callSign).toBe('VULN-HUNTER');
    expect(sec?.specialty).toBe('security');
    expect(sec?.huntTargets.length).toBeGreaterThanOrEqual(5);

    const silent = personas.find(p => p.id === 'silent-failure-hunter');
    expect(silent).toBeDefined();
    expect(silent?.callSign).toBe('SILENT-TRAPPER');
    expect(silent?.specialty).toBe('silent-failure');

    const perf = personas.find(p => p.id === 'performance-optimizer');
    expect(perf).toBeDefined();
    expect(perf?.callSign).toBe('SURGE-STORMER');

    const gan = personas.find(p => p.id === 'gan-adversary');
    expect(gan).toBeDefined();
    expect(gan?.callSign).toBe('MUTANT-PROBER');

    const net = personas.find(p => p.id === 'network-troubleshooter');
    expect(net).toBeDefined();
    expect(net?.callSign).toBe('NET-FRACTURER');
  });

  it('retrieves individual persona by ID', async () => {
    const bridge = new EccAgentBridge();
    await bridge.initialize();

    const p = bridge.getPersona('security-reviewer');
    expect(p).toBeDefined();
    expect(p?.id).toBe('security-reviewer');
    expect(p?.tools).toContain('view_file');
  });

  it('generates calibrated assault waves across different intensities', () => {
    const bridge = new EccAgentBridge();

    const stealthWaves = bridge.generateCampaignWaves('stealth');
    expect(stealthWaves.length).toBe(5);
    expect(stealthWaves[0].concurrency).toBe(1);

    const sustainedWaves = bridge.generateCampaignWaves('sustained');
    expect(sustainedWaves.length).toBe(5);
    expect(sustainedWaves[0].probesCount).toBeGreaterThan(stealthWaves[0].probesCount);

    const avalancheWaves = bridge.generateCampaignWaves('avalanche');
    expect(avalancheWaves.length).toBe(5);
    expect(avalancheWaves[0].concurrency).toBeGreaterThan(sustainedWaves[0].concurrency);

    // Verify wave mappings
    expect(sustainedWaves.map(w => w.callSign)).toEqual([
      'VULN-HUNTER',
      'SILENT-TRAPPER',
      'NET-FRACTURER',
      'MUTANT-PROBER',
      'SURGE-STORMER',
    ]);
  });
});
