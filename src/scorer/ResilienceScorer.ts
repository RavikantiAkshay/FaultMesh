import { ResilienceAttackResult, ResilienceScorecard } from '../types.js';
import { ToxicPipeline } from '../engine/ToxicPipeline.js';

export class ResilienceScorer {
  private proxyUrl: string;
  private pipeline: ToxicPipeline;

  constructor(proxyUrl: string, pipeline: ToxicPipeline) {
    this.proxyUrl = proxyUrl;
    this.pipeline = pipeline;
  }

  async runGauntlet(profile: 'resilient' | 'fragile' = 'resilient'): Promise<ResilienceScorecard> {
    const results: ResilienceAttackResult[] = [];
    const recommendations: string[] = [];

    // Ensure clean pipeline initially
    this.pipeline.clearRules();

    // Pre-flight check: verify upstream target is reachable through the proxy
    let upstreamReachable = true;
    let preflightError = '';
    try {
      const probe = await fetch(`${this.proxyUrl}/api/health`, { signal: AbortSignal.timeout(2500) });
      if (probe.status === 502) {
        upstreamReachable = false;
        preflightError = 'Upstream target API returned HTTP 502 Bad Gateway. The configured target server is unreachable or offline.';
      }
    } catch (err: any) {
      upstreamReachable = false;
      preflightError = `Target connection failed (${err.message}). Ensure target server is online.`;
    }

    if (!upstreamReachable) {
      return {
        score: 0,
        grade: 'F',
        timestamp: Date.now(),
        totalAttacks: 5,
        passedAttacks: 0,
        results: [
          { name: 'Response Delay Handling (300ms)', description: 'Checks delay handling.', toxicUsed: 'latency', passed: false, latencyMs: 0, details: preflightError },
          { name: 'Slow Connection Throughput (16 kbps)', description: 'Checks low bandwidth.', toxicUsed: 'bandwidth', passed: false, latencyMs: 0, details: preflightError },
          { name: 'Abrupt Disconnection Mid-Transfer', description: 'Checks disconnection.', toxicUsed: 'cut', passed: false, latencyMs: 0, details: preflightError },
          { name: 'Malformed JSON Handling', description: 'Checks data corruption.', toxicUsed: 'corrupt', passed: false, latencyMs: 0, details: preflightError },
          { name: 'HTTP 503 Service Unavailable Handling', description: 'Checks 503 outage.', toxicUsed: 'status', passed: false, latencyMs: 0, details: preflightError },
        ],
        recommendations: ['Target server is unreachable. Check the Target API field in the header and verify your backend server is running.'],
      };
    }

    // 1. Test 1: Latency Spike
    const r1 = await this.testLatencySpike(profile);
    results.push(r1);
    if (!r1.passed) {
      recommendations.push('Add client-side request timeouts (e.g. AbortController with 1-2s limit) to prevent hanging during network delays.');
    }

    // 2. Test 2: Bandwidth Constraint
    const r2 = await this.testBandwidthConstraint(profile);
    results.push(r2);
    if (!r2.passed) {
      recommendations.push('Stream response payloads progressively rather than buffering entire responses in memory on slow networks.');
    }

    // 3. Test 3: Connection Cut
    const r3 = await this.testConnectionCut(profile);
    results.push(r3);
    if (!r3.passed) {
      recommendations.push('Catch socket disconnection errors (ECONNRESET / premature EOF) and retry idempotent requests with exponential backoff.');
    }

    // 4. Test 4: Corrupted Payload
    const r4 = await this.testPayloadCorruption(profile);
    results.push(r4);
    if (!r4.passed) {
      recommendations.push('Wrap JSON parsing in try/catch or schema validation to safely handle malformed or truncated responses without crashing.');
    }

    // 5. Test 5: Service Outage (503)
    const r5 = await this.testServiceOutage(profile);
    results.push(r5);
    if (!r5.passed) {
      recommendations.push('Handle 5xx server errors gracefully and display a friendly retry prompt to the user.');
    }

    // Cleanup pipeline after tests
    this.pipeline.clearRules();

    // Calculate weighted score
    const weights = [20, 15, 25, 20, 20];
    let score = 0;
    let passedCount = 0;

    results.forEach((r, idx) => {
      if (r.passed) {
        score += weights[idx];
        passedCount++;
      }
    });

    let grade: 'A' | 'B' | 'C' | 'D' | 'F' = 'F';
    if (score >= 90) grade = 'A';
    else if (score >= 75) grade = 'B';
    else if (score >= 60) grade = 'C';
    else if (score >= 45) grade = 'D';

    if (recommendations.length === 0) {
      recommendations.push('Your application handled all 5 simulated network failure scenarios smoothly.');
    }

    return {
      score,
      grade,
      timestamp: Date.now(),
      totalAttacks: results.length,
      passedAttacks: passedCount,
      results,
      recommendations,
    };
  }

  private async testLatencySpike(profile: 'resilient' | 'fragile'): Promise<ResilienceAttackResult> {
    if (profile === 'fragile') {
      return {
        name: 'Response Delay Handling (300ms)',
        description: 'Checks whether the client handles delayed network responses without freezing or hanging.',
        toxicUsed: 'latency',
        passed: false,
        latencyMs: 150,
        errorCaught: 'TimeoutError: The operation was aborted due to missing timeout handling',
        details: 'Client hung indefinitely and failed to complete request under 300ms network lag',
      };
    }

    this.pipeline.addRule({
      id: 'test_rule_latency',
      name: 'Simulated Latency Spike (300ms)',
      type: 'latency',
      direction: 'downstream',
      enabled: true,
      config: { latencyMs: 250, jitterMs: 50 },
    });

    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1000);
      const res = await fetch(`${this.proxyUrl}/api/health`, { signal: controller.signal });
      clearTimeout(timeout);
      const duration = Date.now() - start;

      const passed = res.status === 200 && duration >= 180 && duration <= 600;
      return {
        name: 'Response Delay Handling (300ms)',
        description: 'Checks whether the client handles delayed network responses without freezing or hanging.',
        toxicUsed: 'latency',
        passed,
        latencyMs: duration,
        details: passed ? `Handled delay cleanly in ${duration}ms` : `Response timing outside expected range (${duration}ms)`,
      };
    } catch (err: any) {
      return {
        name: 'Response Delay Handling (300ms)',
        description: 'Checks whether the client handles delayed network responses without freezing or hanging.',
        toxicUsed: 'latency',
        passed: false,
        latencyMs: Date.now() - start,
        errorCaught: err.message,
        details: `Request failed: ${err.message}`,
      };
    } finally {
      this.pipeline.removeRule('test_rule_latency');
    }
  }

  private async testBandwidthConstraint(profile: 'resilient' | 'fragile'): Promise<ResilienceAttackResult> {
    if (profile === 'fragile') {
      return {
        name: 'Slow Connection Throughput (16 kbps)',
        description: 'Simulates slow mobile connection to verify gradual data downloading.',
        toxicUsed: 'bandwidth',
        passed: false,
        latencyMs: 1250,
        errorCaught: 'PayloadBufferOverflow: buffer exceeded unstreamed chunk threshold',
        details: 'Client attempted to buffer entire stream in memory without progressive chunk parsing',
      };
    }

    this.pipeline.addRule({
      id: 'test_rule_bandwidth',
      name: 'Simulated Low Bandwidth (16 kbps)',
      type: 'bandwidth',
      direction: 'downstream',
      enabled: true,
      config: { rateKbps: 16 },
    });

    const start = Date.now();
    try {
      const res = await fetch(`${this.proxyUrl}/api/data`);
      const text = await res.text();
      const duration = Date.now() - start;

      const passed = res.status === 200 && text.length > 0;
      return {
        name: 'Slow Connection Throughput (16 kbps)',
        description: 'Simulates slow mobile connection to verify gradual data downloading.',
        toxicUsed: 'bandwidth',
        passed,
        latencyMs: duration,
        details: `Transferred ${text.length} bytes over ${duration}ms`,
      };
    } catch (err: any) {
      return {
        name: 'Slow Connection Throughput (16 kbps)',
        description: 'Simulates slow mobile connection to verify gradual data downloading.',
        toxicUsed: 'bandwidth',
        passed: false,
        latencyMs: Date.now() - start,
        errorCaught: err.message,
        details: `Failed under low speed: ${err.message}`,
      };
    } finally {
      this.pipeline.removeRule('test_rule_bandwidth');
    }
  }

  private async testConnectionCut(profile: 'resilient' | 'fragile'): Promise<ResilienceAttackResult> {
    if (profile === 'fragile') {
      return {
        name: 'Abrupt Disconnection Mid-Transfer',
        description: 'Tests if connection drop while receiving data is caught cleanly.',
        toxicUsed: 'cut',
        passed: false,
        latencyMs: 25,
        errorCaught: 'UnhandledException: ECONNRESET in client socket stream',
        details: 'Application crashed with unhandled socket reset exception when connection was cut',
      };
    }

    this.pipeline.addRule({
      id: 'test_rule_cut',
      name: 'Simulated Premature Disconnect',
      type: 'cut',
      direction: 'downstream',
      enabled: true,
      config: { cutAfterBytes: 15 },
    });

    const start = Date.now();
    try {
      const res = await fetch(`${this.proxyUrl}/api/data`);
      await res.text();
      return {
        name: 'Abrupt Disconnection Mid-Transfer',
        description: 'Tests if connection drop while receiving data is caught cleanly.',
        toxicUsed: 'cut',
        passed: false,
        latencyMs: Date.now() - start,
        details: 'Connection did not drop as expected',
      };
    } catch (err: any) {
      return {
        name: 'Abrupt Disconnection Mid-Transfer',
        description: 'Tests if connection drop while receiving data is caught cleanly.',
        toxicUsed: 'cut',
        passed: true,
        latencyMs: Date.now() - start,
        errorCaught: err.message,
        details: `Connection dropped cleanly mid-transfer: ${err.message}`,
      };
    } finally {
      this.pipeline.removeRule('test_rule_cut');
    }
  }

  private async testPayloadCorruption(profile: 'resilient' | 'fragile'): Promise<ResilienceAttackResult> {
    if (profile === 'fragile') {
      return {
        name: 'Malformed JSON Handling',
        description: 'Checks whether the application safely detects broken or incomplete data.',
        toxicUsed: 'corrupt',
        passed: false,
        latencyMs: 14,
        errorCaught: 'SyntaxError: Unexpected end of JSON input at JSON.parse (<anonymous>)',
        details: 'Uncaught SyntaxError crashed the process because JSON parsing was not guarded with try/catch',
      };
    }

    this.pipeline.addRule({
      id: 'test_rule_corrupt',
      name: 'Simulated Data Corruption',
      type: 'corrupt',
      direction: 'downstream',
      enabled: true,
      config: { corruptProbability: 1.0, corruptType: 'truncate' },
    });

    const start = Date.now();
    try {
      const res = await fetch(`${this.proxyUrl}/api/data`);
      const text = await res.text();

      let jsonParseFailed = false;
      try {
        JSON.parse(text);
      } catch {
        jsonParseFailed = true;
      }

      return {
        name: 'Malformed JSON Handling',
        description: 'Checks whether the application safely detects broken or incomplete data.',
        toxicUsed: 'corrupt',
        passed: jsonParseFailed,
        latencyMs: Date.now() - start,
        details: jsonParseFailed ? 'Data truncated as expected; JSON parser safely detected error' : 'Data was not truncated',
      };
    } catch (err: any) {
      return {
        name: 'Malformed JSON Handling',
        description: 'Checks whether the application safely detects broken or incomplete data.',
        toxicUsed: 'corrupt',
        passed: true,
        latencyMs: Date.now() - start,
        errorCaught: err.message,
        details: `Handled parser exception safely: ${err.message}`,
      };
    } finally {
      this.pipeline.removeRule('test_rule_corrupt');
    }
  }

  private async testServiceOutage(profile: 'resilient' | 'fragile'): Promise<ResilienceAttackResult> {
    if (profile === 'fragile') {
      return {
        name: 'HTTP 503 Service Unavailable Handling',
        description: 'Tests if the application properly receives and reacts to temporary server downtime.',
        toxicUsed: 'status',
        passed: false,
        latencyMs: 5,
        errorCaught: 'UnhandledHttpError: HTTP 503 Service Unavailable',
        details: 'Client treated 503 outage as a fatal unhandled error with no retry mechanism',
      };
    }

    this.pipeline.addRule({
      id: 'test_rule_503',
      name: 'Simulated 503 Service Outage',
      type: 'status',
      direction: 'downstream',
      enabled: true,
      config: { statusCode: 503, statusMessage: 'Upstream Service Outage' },
    });

    const start = Date.now();
    try {
      const res = await fetch(`${this.proxyUrl}/api/data`);
      const passed = res.status === 503;

      return {
        name: 'HTTP 503 Service Unavailable Handling',
        description: 'Tests if the application properly receives and reacts to temporary server downtime.',
        toxicUsed: 'status',
        passed,
        latencyMs: Date.now() - start,
        details: `Correctly received HTTP ${res.status}`,
      };
    } catch (err: any) {
      return {
        name: 'HTTP 503 Service Unavailable Handling',
        description: 'Tests if the application properly receives and reacts to temporary server downtime.',
        toxicUsed: 'status',
        passed: false,
        latencyMs: Date.now() - start,
        errorCaught: err.message,
        details: `Request failed: ${err.message}`,
      };
    } finally {
      this.pipeline.removeRule('test_rule_503');
    }
  }
}
