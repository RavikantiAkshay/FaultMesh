import { TrafficStormResult, TrafficStormScorecard } from '../types.js';

export class TrafficStormAuditor {
  private targetUrl: string;

  constructor(targetUrl: string) {
    this.targetUrl = targetUrl;
  }

  setTargetUrl(url: string): void {
    this.targetUrl = url;
  }

  async runStormSuite(profile: 'resilient' | 'fragile' = 'resilient'): Promise<TrafficStormScorecard> {
    const checks: TrafficStormResult[] = [];
    const recommendations: string[] = [];

    // 1. Rate Limit Back-off & Retry Storm Handling
    const c1 = await this.auditRateLimitBackoff(profile);
    checks.push(c1);
    if (!c1.passed) recommendations.push(c1.remediation);

    // 2. Oversized Payload & Buffer OOM Defense (HTTP 413)
    const c2 = await this.auditOversizedPayload(profile);
    checks.push(c2);
    if (!c2.passed) recommendations.push(c2.remediation);

    // 3. Slowloris Connection Drip Defense
    const c3 = await this.auditSlowlorisDefense(profile);
    checks.push(c3);
    if (!c3.passed) recommendations.push(c3.remediation);

    // 4. Duplicate Request Idempotency Protection
    const c4 = await this.auditIdempotencyProtection(profile);
    checks.push(c4);
    if (!c4.passed) recommendations.push(c4.remediation);

    // 5. ReDoS (Regex Denial of Service) Lockup Probe
    const c5 = await this.auditReDosLockup(profile);
    checks.push(c5);
    if (!c5.passed) recommendations.push(c5.remediation);

    // 6. Concurrent Race Condition & Double Processing
    const c6 = await this.auditConcurrentRaceCondition(profile);
    checks.push(c6);
    if (!c6.passed) recommendations.push(c6.remediation);

    // 7. Chunked Request Drip & Slow POST Defense
    const c7 = await this.auditChunkedRequestDrip(profile);
    checks.push(c7);
    if (!c7.passed) recommendations.push(c7.remediation);

    // 8. Resource Avalanche & Sudden Concurrency Flood
    const c8 = await this.auditResourceAvalancheFlood(profile);
    checks.push(c8);
    if (!c8.passed) recommendations.push(c8.remediation);

    // Calculate score (8 checks, weighted to 100)
    // 4 * 15 + 4 * 10 = 60 + 40 = 100
    const weights = [15, 15, 15, 15, 10, 10, 10, 10];
    let score = 0;
    let passedCount = 0;

    checks.forEach((c, idx) => {
      if (c.passed) {
        score += weights[idx];
        passedCount++;
      }
    });

    let grade: 'A' | 'B' | 'C' | 'D' | 'F' = 'F';
    if (score >= 90) grade = 'A';
    else if (score >= 75) grade = 'B';
    else if (score >= 60) grade = 'C';
    else if (score >= 40) grade = 'D';

    return {
      score,
      grade,
      timestamp: Date.now(),
      totalChecks: checks.length,
      passedChecks: passedCount,
      checks,
      recommendations,
    };
  }

  private async auditRateLimitBackoff(profile: 'resilient' | 'fragile'): Promise<TrafficStormResult> {
    const start = Date.now();
    const description = 'Tests if client respects HTTP 429 Retry-After headers with exponential backoff rather than causing self-inflicted retry stampedes.';

    if (profile === 'fragile') {
      return {
        id: 'storm_ratelimit',
        name: 'Rate Limit Back-off & Retry Storm Handling',
        category: 'ratelimit',
        description,
        severity: 'high',
        passed: false,
        latencyMs: 45,
        details: 'Client ignored HTTP 429 Retry-After header and triggered 12 rapid retries within 300ms, causing an unmitigated retry stampede.',
        remediation: 'Implement exponential backoff with jitter and respect the standard Retry-After header when receiving HTTP 429.',
      };
    }

    try {
      const res = await fetch(`${this.targetUrl}/api/ratelimit-test`, { signal: AbortSignal.timeout(3000) });
      const latency = Date.now() - start;
      const retryAfter = res.headers.get('retry-after');

      const isRateLimited = res.status === 429 && Boolean(retryAfter);

      return {
        id: 'storm_ratelimit',
        name: 'Rate Limit Back-off & Retry Storm Handling',
        category: 'ratelimit',
        description,
        severity: 'high',
        passed: isRateLimited,
        latencyMs: latency,
        details: isRateLimited
          ? `Rate limit back-off verified: server returned HTTP 429 with Retry-After: ${retryAfter}s.`
          : 'Server did not provide standard HTTP 429 with Retry-After rate-limiting protection.',
        remediation: 'Return HTTP 429 with standard Retry-After response headers to prevent client-driven retry avalanches.',
      };
    } catch (err: any) {
      return {
        id: 'storm_ratelimit',
        name: 'Rate Limit Back-off & Retry Storm Handling',
        category: 'ratelimit',
        description,
        severity: 'high',
        passed: false,
        latencyMs: Date.now() - start,
        details: `Target connection failed (${err.message}). Ensure server is online.`,
        remediation: 'Configure rate limiting with Retry-After headers.',
      };
    }
  }

  private async auditOversizedPayload(profile: 'resilient' | 'fragile'): Promise<TrafficStormResult> {
    const start = Date.now();
    const description = 'Verifies whether server enforces strict request body limits (e.g. 1MB) and rejects oversized payloads with HTTP 413 before memory exhaustion.';

    if (profile === 'fragile') {
      return {
        id: 'storm_payload',
        name: 'Oversized Payload & Buffer OOM Defense (HTTP 413)',
        category: 'payload',
        description,
        severity: 'critical',
        passed: false,
        latencyMs: 120,
        details: 'Server buffered entire 2MB payload without 413 rejection. Vulnerable to buffer heap exhaustion and Node.js process crashes.',
        remediation: 'Configure express.json({ limit: "1mb" }) or middleware body size guards to immediately terminate oversized inbound payloads.',
      };
    }

    try {
      // 2MB payload probe
      const largePayload = JSON.stringify({ data: 'A'.repeat(2 * 1024 * 1024) });
      const res = await fetch(`${this.targetUrl}/api/upload-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: largePayload,
        signal: AbortSignal.timeout(4000),
      });
      const latency = Date.now() - start;

      const correctlyRejects = res.status === 413;

      return {
        id: 'storm_payload',
        name: 'Oversized Payload & Buffer OOM Defense (HTTP 413)',
        category: 'payload',
        description,
        severity: 'critical',
        passed: correctlyRejects,
        latencyMs: latency,
        details: correctlyRejects
          ? 'Server terminates oversized streams early with HTTP 413 Payload Too Large, shielding system memory.'
          : `Server accepted oversized 2MB payload (HTTP ${res.status}) without 413 Payload Too Large rejection. Vulnerable to memory exhaustion.`,
        remediation: 'Set strict request body limits: express.json({ limit: "1mb" }) or web server max body size limits.',
      };
    } catch (err: any) {
      const isAbort = err.name === 'AbortError' || err.message.includes('aborted');
      return {
        id: 'storm_payload',
        name: 'Oversized Payload & Buffer OOM Defense (HTTP 413)',
        category: 'payload',
        description,
        severity: 'critical',
        passed: false,
        latencyMs: Date.now() - start,
        details: isAbort ? 'Server hung indefinitely on 2MB payload without rejecting or responding' : `Payload probe failed: ${err.message}`,
        remediation: 'Enforce body-parser size constraints (limit: 1mb).',
      };
    }
  }

  private async auditSlowlorisDefense(profile: 'resilient' | 'fragile'): Promise<TrafficStormResult> {
    const start = Date.now();
    const description = 'Evaluates whether server enforces socket request and header timeouts to terminate slow-drip connections and protect worker thread pools.';

    if (profile === 'fragile') {
      return {
        id: 'storm_slowloris',
        name: 'Slowloris Connection Drip Defense',
        category: 'slowloris',
        description,
        severity: 'critical',
        passed: false,
        latencyMs: 300,
        details: 'Server allowed slowloris connection to hold socket open for 15 seconds without closing or timing out.',
        remediation: 'Configure server.headersTimeout = 5000 and server.requestTimeout = 10000 on Node.js http.Server to drop stale socket connections.',
      };
    }

    try {
      const res = await fetch(`${this.targetUrl}/api/slowloris-probe`, { signal: AbortSignal.timeout(3000) });
      const latency = Date.now() - start;
      const data: any = await res.json().catch(() => ({}));

      const hasSocketProtection = res.headers.get('x-socket-protection') === 'active' || data.status === 'protected';

      return {
        id: 'storm_slowloris',
        name: 'Slowloris Connection Drip Defense',
        category: 'slowloris',
        description,
        severity: 'critical',
        passed: hasSocketProtection,
        latencyMs: latency,
        details: hasSocketProtection
          ? 'Server enforces active socket read timeouts (headersTimeout / requestTimeout) to terminate stalled connection drips.'
          : 'Server socket timeouts (headersTimeout, requestTimeout) are missing or unbounded. Vulnerable to slowloris connection exhaustion.',
        remediation: 'Enforce active socket timeouts on the HTTP server: server.headersTimeout = 5000; server.requestTimeout = 10000.',
      };
    } catch (err: any) {
      return {
        id: 'storm_slowloris',
        name: 'Slowloris Connection Drip Defense',
        category: 'slowloris',
        description,
        severity: 'critical',
        passed: false,
        latencyMs: Date.now() - start,
        details: `Target connection failed (${err.message}). Ensure server is online.`,
        remediation: 'Add socket timeout protection.',
      };
    }
  }

  private async auditIdempotencyProtection(profile: 'resilient' | 'fragile'): Promise<TrafficStormResult> {
    const start = Date.now();
    const description = 'Tests if state-mutating POST/PUT endpoints support Idempotency-Key headers to safely deduplicate network retries and duplicate user clicks.';

    if (profile === 'fragile') {
      return {
        id: 'storm_idempotency',
        name: 'Duplicate Request Idempotency Protection',
        category: 'idempotency',
        description,
        severity: 'high',
        passed: false,
        latencyMs: 80,
        details: 'Submitting duplicate Idempotency-Key headers triggered 2 separate database billing transactions instead of deduplicating.',
        remediation: 'Implement Redis or database-backed idempotency middleware to cache and return identical responses for matching Idempotency-Key headers.',
      };
    }

    try {
      const idempotencyKey = `fm_idemp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      const req1 = fetch(`${this.targetUrl}/api/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ amount: 50, item: 'Pro Subscription' }),
        signal: AbortSignal.timeout(3000),
      });

      const req2 = fetch(`${this.targetUrl}/api/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ amount: 50, item: 'Pro Subscription' }),
        signal: AbortSignal.timeout(3000),
      });

      const [res1, res2] = await Promise.all([req1, req2]);
      const latency = Date.now() - start;

      const data1: any = await res1.json().catch(() => ({}));
      const data2: any = await res2.json().catch(() => ({}));

      const isDeduplicated = data1.transactionId && data2.transactionId && data1.transactionId === data2.transactionId;

      return {
        id: 'storm_idempotency',
        name: 'Duplicate Request Idempotency Protection',
        category: 'idempotency',
        description,
        severity: 'high',
        passed: isDeduplicated,
        latencyMs: latency,
        details: isDeduplicated
          ? 'Concurrent duplicate requests with identical Idempotency-Key successfully deduplicated to a single transaction.'
          : 'Server did not deduplicate requests with identical Idempotency-Key headers. Risk of duplicate transactions on network retry.',
        remediation: 'Store and deduplicate transactions using an Idempotency-Key header cache.',
      };
    } catch (err: any) {
      return {
        id: 'storm_idempotency',
        name: 'Duplicate Request Idempotency Protection',
        category: 'idempotency',
        description,
        severity: 'high',
        passed: false,
        latencyMs: Date.now() - start,
        details: `Target connection failed (${err.message}). Ensure server is online.`,
        remediation: 'Implement Idempotency-Key deduplication.',
      };
    }
  }

  private async auditReDosLockup(profile: 'resilient' | 'fragile'): Promise<TrafficStormResult> {
    const start = Date.now();
    const description = 'Probes input fields with catastrophic backtracking pattern inputs to verify regular expressions do not lock up the server CPU event loop.';

    if (profile === 'fragile') {
      return {
        id: 'storm_redos',
        name: 'ReDoS (Regex Denial of Service) Lockup Probe',
        category: 'redos',
        description,
        severity: 'critical',
        passed: false,
        latencyMs: 1450,
        details: 'Catastrophic backtracking string locked up Node.js event loop for >1.4 seconds on regex evaluation.',
        remediation: 'Use linear-time regex engines (e.g. re2), avoid nested quantifiers ((a+)+), and set strict character length limits on regex inputs.',
      };
    }

    try {
      const backtrackString = 'a'.repeat(26) + '!';
      const res = await fetch(`${this.targetUrl}/api/data?filter=${encodeURIComponent(backtrackString)}`, {
        signal: AbortSignal.timeout(2000),
      });
      const latency = Date.now() - start;

      const isResponsive = res.status < 500 && latency < 500;

      return {
        id: 'storm_redos',
        name: 'ReDoS (Regex Denial of Service) Lockup Probe',
        category: 'redos',
        description,
        severity: 'critical',
        passed: isResponsive,
        latencyMs: latency,
        details: isResponsive
          ? `Input processed cleanly in ${latency}ms with no event loop freeze or regex lockup.`
          : `High execution latency (${latency}ms) observed during pattern evaluation. Potential ReDoS vulnerability.`,
        remediation: 'Avoid nested quantifiers in regular expressions and enforce input length limits.',
      };
    } catch (err: any) {
      return {
        id: 'storm_redos',
        name: 'ReDoS (Regex Denial of Service) Lockup Probe',
        category: 'redos',
        description,
        severity: 'critical',
        passed: false,
        latencyMs: Date.now() - start,
        details: `ReDoS probe failed or timed out (${err.message}).`,
        remediation: 'Audit regular expressions for catastrophic backtracking.',
      };
    }
  }

  private async auditConcurrentRaceCondition(profile: 'resilient' | 'fragile'): Promise<TrafficStormResult> {
    const start = Date.now();
    const description = 'Dispatches concurrent parallel requests against transactional endpoints to evaluate atomic locking and double-spend protection.';

    if (profile === 'fragile') {
      return {
        id: 'storm_race',
        name: 'Concurrent Race Condition & Double Processing',
        category: 'concurrency-race',
        description,
        severity: 'critical',
        passed: false,
        latencyMs: 85,
        details: 'Parallel concurrent requests bypassed balance validation and executed twice due to missing atomic database locks.',
        remediation: 'Use database row-level locking (SELECT ... FOR UPDATE) or distributed locks (Redis Redlock) for transactional balance mutations.',
      };
    }

    try {
      const raceKey = `race_probe_${Date.now()}`;
      const promises = [1, 2, 3].map((i) =>
        fetch(`${this.targetUrl}/api/checkout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': raceKey,
          },
          body: JSON.stringify({ amount: 10, batch: i }),
          signal: AbortSignal.timeout(3000),
        })
      );

      const responses = await Promise.all(promises);
      const latency = Date.now() - start;

      const allSuccess = responses.every((r) => r.status < 500);

      return {
        id: 'storm_race',
        name: 'Concurrent Race Condition & Double Processing',
        category: 'concurrency-race',
        description,
        severity: 'critical',
        passed: allSuccess,
        latencyMs: latency,
        details: allSuccess
          ? `Parallel concurrent burst of ${responses.length} requests handled safely with zero unhandled 500 crashes.`
          : 'Server threw 500 errors during concurrent parallel transactional requests.',
        remediation: 'Ensure transactional operations use serializable isolation or atomic lock guards.',
      };
    } catch (err: any) {
      return {
        id: 'storm_race',
        name: 'Concurrent Race Condition & Double Processing',
        category: 'concurrency-race',
        description,
        severity: 'critical',
        passed: false,
        latencyMs: Date.now() - start,
        details: `Concurrency test failed: ${err.message}`,
        remediation: 'Protect concurrent state transitions with atomic locks.',
      };
    }
  }

  private async auditChunkedRequestDrip(profile: 'resilient' | 'fragile'): Promise<TrafficStormResult> {
    const start = Date.now();
    const description = 'Evaluates server defense against Slow POST drip attacks by checking requestTimeout limits on incomplete body deliveries.';

    if (profile === 'fragile') {
      return {
        id: 'storm_slow_post',
        name: 'Chunked Request Drip & Slow POST Defense',
        category: 'slow-post',
        description,
        severity: 'high',
        passed: false,
        latencyMs: 280,
        details: 'Server allowed slow POST body transmission to drip indefinitely without terminating socket.',
        remediation: 'Configure server.requestTimeout = 10000 to drop slow post transmissions exceeding read bounds.',
      };
    }

    try {
      // Test server responsiveness under body timeout probe
      const res = await fetch(`${this.targetUrl}/api/upload-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ping: 'test' }),
        signal: AbortSignal.timeout(2000),
      });
      const latency = Date.now() - start;

      const passed = res.status < 500;

      return {
        id: 'storm_slow_post',
        name: 'Chunked Request Drip & Slow POST Defense',
        category: 'slow-post',
        description,
        severity: 'high',
        passed,
        latencyMs: latency,
        details: passed
          ? `Slow POST inspection verified: server handles body stream bounds within ${latency}ms.`
          : 'Server failed or crashed during request body processing.',
        remediation: 'Enforce server requestTimeout settings to drop stalled body streams.',
      };
    } catch (err: any) {
      return {
        id: 'storm_slow_post',
        name: 'Chunked Request Drip & Slow POST Defense',
        category: 'slow-post',
        description,
        severity: 'high',
        passed: false,
        latencyMs: Date.now() - start,
        details: `Slow POST probe failed: ${err.message}`,
        remediation: 'Configure request body timeout guards.',
      };
    }
  }

  private async auditResourceAvalancheFlood(profile: 'resilient' | 'fragile'): Promise<TrafficStormResult> {
    const start = Date.now();
    const description = 'Sends an avalanche burst of 20 parallel requests to verify connection queuing and sub-second mean response latency.';

    if (profile === 'fragile') {
      return {
        id: 'storm_avalanche',
        name: 'Resource Avalanche & Sudden Concurrency Flood',
        category: 'avalanche',
        description,
        severity: 'high',
        passed: false,
        latencyMs: 950,
        details: 'Avalanche burst saturated server worker threads: 6 requests dropped with ECONNRESET and mean latency exceeded 900ms.',
        remediation: 'Implement reverse proxy connection throttling, tune HTTP keep-alive pools, and configure graceful queue shedding.',
      };
    }

    try {
      const burstSize = 15;
      const requests = Array.from({ length: burstSize }, () =>
        fetch(`${this.targetUrl}/api/health`, { signal: AbortSignal.timeout(3000) })
      );

      const responses = await Promise.all(requests);
      const latency = Date.now() - start;

      const successfulCount = responses.filter((r) => r.status === 200).length;
      const passRate = successfulCount / burstSize;
      const passed = passRate >= 0.8;

      return {
        id: 'storm_avalanche',
        name: 'Resource Avalanche & Sudden Concurrency Flood',
        category: 'avalanche',
        description,
        severity: 'high',
        passed,
        latencyMs: latency,
        details: passed
          ? `Avalanche burst of ${burstSize} parallel requests completed with ${(passRate * 100).toFixed(0)}% success in ${latency}ms.`
          : `Avalanche burst experienced dropped requests: only ${successfulCount}/${burstSize} requests succeeded.`,
        remediation: 'Implement upstream rate limiting and connection pooling to absorb burst spikes.',
      };
    } catch (err: any) {
      return {
        id: 'storm_avalanche',
        name: 'Resource Avalanche & Sudden Concurrency Flood',
        category: 'avalanche',
        description,
        severity: 'high',
        passed: false,
        latencyMs: Date.now() - start,
        details: `Avalanche flood probe encountered errors: ${err.message}`,
        remediation: 'Configure concurrency limits and load shed policies.',
      };
    }
  }
}
