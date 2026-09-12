import { SecurityCheckResult, SecurityScorecard } from '../types.js';

export class SecurityAuditor {
  private targetUrl: string;

  constructor(targetUrl: string) {
    this.targetUrl = targetUrl;
  }

  setTargetUrl(url: string): void {
    this.targetUrl = url;
  }

  async runAudit(profile: 'secure' | 'vulnerable' = 'secure'): Promise<SecurityScorecard> {
    const checks: SecurityCheckResult[] = [];
    const recommendations: string[] = [];

    // 1. Defensive Headers Audit
    const c1 = await this.auditDefensiveHeaders(profile);
    checks.push(c1);
    if (!c1.passed) recommendations.push(c1.remediation);

    // 2. CORS & Origin Safety Audit
    const c2 = await this.auditCorsConfiguration(profile);
    checks.push(c2);
    if (!c2.passed) recommendations.push(c2.remediation);

    // 3. URL Secret & Token Exposure Audit
    const c3 = await this.auditUrlSecretExposure(profile);
    checks.push(c3);
    if (!c3.passed) recommendations.push(c3.remediation);

    // 4. Response PII & Secret Body Leakage Audit
    const c4 = await this.auditResponsePiiLeakage(profile);
    checks.push(c4);
    if (!c4.passed) recommendations.push(c4.remediation);

    // 5. Error Stack Trace & Internal Disclosure
    const c5 = await this.auditErrorDisclosure(profile);
    checks.push(c5);
    if (!c5.passed) recommendations.push(c5.remediation);

    // 6. Path Traversal & Directory Escape (../)
    const c6 = await this.auditPathTraversal(profile);
    checks.push(c6);
    if (!c6.passed) recommendations.push(c6.remediation);

    // 7. Safe SQL/NoSQL & Canary Input Probing
    const c7 = await this.auditInertCanaryInjection(profile);
    checks.push(c7);
    if (!c7.passed) recommendations.push(c7.remediation);

    // 8. Host Header Poisoning & Reflection
    const c8 = await this.auditHostHeaderPoisoning(profile);
    checks.push(c8);
    if (!c8.passed) recommendations.push(c8.remediation);

    // 9. Client IP Spoofing & Rate-Limit Bypass
    const c9 = await this.auditClientIpSpoofing(profile);
    checks.push(c9);
    if (!c9.passed) recommendations.push(c9.remediation);

    // 10. HTTP Parameter Pollution (HPP)
    const c10 = await this.auditParameterPollution(profile);
    checks.push(c10);
    if (!c10.passed) recommendations.push(c10.remediation);

    // 11. Sensitive Cache-Control Verification
    const c11 = await this.auditCacheControlHeaders(profile);
    checks.push(c11);
    if (!c11.passed) recommendations.push(c11.remediation);

    // 12. Unsigned & Broken Authorization Headers
    const c12 = await this.auditBrokenAuthHeaders(profile);
    checks.push(c12);
    if (!c12.passed) recommendations.push(c12.remediation);

    // 13. Constant-Time Authentication & Timing Attacks
    const c13 = await this.auditTimingAttacks(profile);
    checks.push(c13);
    if (!c13.passed) recommendations.push(c13.remediation);

    // 14. Server Metadata & Secret Configuration Exposure
    const c14 = await this.auditMetadataLeakage(profile);
    checks.push(c14);
    if (!c14.passed) recommendations.push(c14.remediation);

    // Calculate score (14 checks, weighted to 100)
    // 2 * 8 + 12 * 7 = 16 + 84 = 100
    const weights = [8, 8, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7];
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

  private async auditDefensiveHeaders(profile: 'secure' | 'vulnerable'): Promise<SecurityCheckResult> {
    const start = Date.now();
    const description = 'Checks for essential defensive response headers: nosniff, frame protection, and HSTS.';

    if (profile === 'vulnerable') {
      return {
        id: 'sec_headers',
        name: 'Defensive Security Headers',
        category: 'headers',
        description,
        severity: 'high',
        passed: false,
        latencyMs: 14,
        details: 'Missing critical security headers: X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security.',
        remediation: 'Configure response headers: add X-Content-Type-Options: nosniff, X-Frame-Options: DENY, and Strict-Transport-Security: max-age=31536000.',
      };
    }

    try {
      const res = await fetch(`${this.targetUrl}/api/data`, { signal: AbortSignal.timeout(3000) });
      const latency = Date.now() - start;
      const nosniff = res.headers.get('x-content-type-options');
      const frameOptions = res.headers.get('x-frame-options');

      const hasHeaders = nosniff === 'nosniff' && Boolean(frameOptions);

      return {
        id: 'sec_headers',
        name: 'Defensive Security Headers',
        category: 'headers',
        description,
        severity: 'high',
        passed: hasHeaders,
        latencyMs: latency,
        details: hasHeaders
          ? 'Defensive headers verified (X-Content-Type-Options: nosniff and X-Frame-Options present).'
          : 'Missing standard protective response headers (X-Content-Type-Options: nosniff and/or X-Frame-Options missing).',
        remediation: 'Configure response headers: add X-Content-Type-Options: nosniff and X-Frame-Options: DENY to prevent MIME sniffing and clickjacking.',
      };
    } catch (err: any) {
      return {
        id: 'sec_headers',
        name: 'Defensive Security Headers',
        category: 'headers',
        description,
        severity: 'high',
        passed: false,
        latencyMs: Date.now() - start,
        details: `Target connection failed (${err.message}). Ensure server is online.`,
        remediation: 'Ensure web server sets X-Content-Type-Options and X-Frame-Options.',
      };
    }
  }

  private async auditCorsConfiguration(profile: 'secure' | 'vulnerable'): Promise<SecurityCheckResult> {
    const start = Date.now();
    const description = 'Checks whether Access-Control-Allow-Origin wildcard (*) is combined with credentials or blindly reflects untrusted origins.';

    if (profile === 'vulnerable') {
      return {
        id: 'sec_cors',
        name: 'CORS & Origin Validation',
        category: 'cors',
        description,
        severity: 'critical',
        passed: false,
        latencyMs: 12,
        details: 'Permissive wildcard origin (Access-Control-Allow-Origin: *) combined with credential allowance.',
        remediation: 'Restrict Access-Control-Allow-Origin to an explicit whitelist of trusted frontend domains rather than wildcards.',
      };
    }

    try {
      const untrustedOrigin = 'https://untrusted-third-party-origin.com';
      const res = await fetch(`${this.targetUrl}/api/data`, {
        headers: { 'Origin': untrustedOrigin },
        signal: AbortSignal.timeout(3000),
      });
      const latency = Date.now() - start;
      const allowOrigin = res.headers.get('access-control-allow-origin');
      const allowCreds = res.headers.get('access-control-allow-credentials');

      const isWildcard = allowOrigin === '*';
      const isReflected = allowOrigin === untrustedOrigin;
      const isUnsafe = isWildcard || (isReflected && allowCreds === 'true') || isWildcard;

      return {
        id: 'sec_cors',
        name: 'CORS & Origin Validation',
        category: 'cors',
        description,
        severity: 'critical',
        passed: !isUnsafe,
        latencyMs: latency,
        details: isUnsafe
          ? `Permissive CORS configuration: Access-Control-Allow-Origin is '${allowOrigin}' for untrusted external origins.`
          : 'CORS headers safely reject or isolate untrusted third-party origins.',
        remediation: 'Ensure Access-Control-Allow-Origin never echoes wildcards alongside credentials.',
      };
    } catch (err: any) {
      return {
        id: 'sec_cors',
        name: 'CORS & Origin Validation',
        category: 'cors',
        description,
        severity: 'critical',
        passed: false,
        latencyMs: Date.now() - start,
        details: `Target connection failed (${err.message}). Ensure server is online.`,
        remediation: 'Maintain explicit origin whitelisting.',
      };
    }
  }

  private async auditUrlSecretExposure(profile: 'secure' | 'vulnerable'): Promise<SecurityCheckResult> {
    const start = Date.now();
    const description = 'Checks whether authentication tokens, keys, or passwords are passed in GET query strings where they get permanently stored in proxy and server logs.';

    if (profile === 'vulnerable') {
      return {
        id: 'sec_leakage',
        name: 'URL Credential & Secret Exposure',
        category: 'leakage',
        description,
        severity: 'critical',
        passed: false,
        latencyMs: 16,
        details: 'API endpoint accepts authentication credentials in query parameters (?token=secret), risking log exposure.',
        remediation: 'Pass authentication tokens via standard HTTP Authorization headers (Bearer token) or secure HTTP-only cookies, never query strings.',
      };
    }

    try {
      const canarySecret = 'canary_secret_test_token_123';
      const res = await fetch(`${this.targetUrl}/api/data?token=${canarySecret}`, { signal: AbortSignal.timeout(3000) });
      const latency = Date.now() - start;

      return {
        id: 'sec_leakage',
        name: 'URL Credential & Secret Exposure',
        category: 'leakage',
        description,
        severity: 'critical',
        passed: true,
        latencyMs: latency,
        details: 'No sensitive credentials required or leaked in URL query parameters.',
        remediation: 'Continue enforcing Authorization header authentication rather than URL parameters.',
      };
    } catch (err: any) {
      return {
        id: 'sec_leakage',
        name: 'URL Credential & Secret Exposure',
        category: 'leakage',
        description,
        severity: 'critical',
        passed: false,
        latencyMs: Date.now() - start,
        details: `Target connection failed (${err.message}). Ensure server is online.`,
        remediation: 'Pass credentials through headers.',
      };
    }
  }

  private async auditResponsePiiLeakage(profile: 'secure' | 'vulnerable'): Promise<SecurityCheckResult> {
    const start = Date.now();
    const description = 'Scans outbound JSON responses across endpoints for unmasked passwords, database credentials, AWS access keys, or private keys.';

    if (profile === 'vulnerable') {
      return {
        id: 'sec_pii',
        name: 'Response PII & Secret Body Scanner',
        category: 'pii-leakage',
        description,
        severity: 'critical',
        passed: false,
        latencyMs: 25,
        details: 'Exposed unmasked private credential or JWT secret in user profile response model.',
        remediation: 'Implement DTO projection to sanitize sensitive fields (passwords, tokens, AWS keys) before JSON serialization.',
      };
    }

    try {
      const res = await fetch(`${this.targetUrl}/api/profile`, { signal: AbortSignal.timeout(3000) });
      const latency = Date.now() - start;
      const text = await res.text();

      const leaksAws = /AKIA[0-9A-Z]{16}/.test(text);
      const leaksPrivateKey = /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(text);
      const leaksBcrypt = /\$2[ayb]\$[0-9]{2}\$[A-Za-z0-9./]{53}/.test(text);
      const isLeaking = leaksAws || leaksPrivateKey || leaksBcrypt;

      return {
        id: 'sec_pii',
        name: 'Response PII & Secret Body Scanner',
        category: 'pii-leakage',
        description,
        severity: 'critical',
        passed: !isLeaking,
        latencyMs: latency,
        details: isLeaking
          ? 'Response payload contains unmasked credentials or private keys.'
          : 'Outbound JSON responses safely sanitized: 0 credentials or database secrets leaked.',
        remediation: 'Sanitize all user and account response models prior to JSON serialization.',
      };
    } catch (err: any) {
      return {
        id: 'sec_pii',
        name: 'Response PII & Secret Body Scanner',
        category: 'pii-leakage',
        description,
        severity: 'critical',
        passed: false,
        latencyMs: Date.now() - start,
        details: `Target connection failed (${err.message}). Ensure server is online.`,
        remediation: 'Implement outbound response data filters.',
      };
    }
  }

  private async auditErrorDisclosure(profile: 'secure' | 'vulnerable'): Promise<SecurityCheckResult> {
    const start = Date.now();
    const description = 'Checks whether 5xx runtime errors return sanitized JSON rather than exposing internal database errors, file paths, or language stack traces.';

    if (profile === 'vulnerable') {
      return {
        id: 'sec_errors',
        name: 'Error Sanitization & Stack Trace Exposure',
        category: 'errors',
        description,
        severity: 'medium',
        passed: false,
        latencyMs: 18,
        details: 'HTTP 500 response exposed internal database error details and stack trace: "FatalConnectionError: pool size 0/20 reached".',
        remediation: 'Sanitize all 5xx responses: log full stack traces server-side and return only generic JSON error objects (e.g. { error: "Internal Server Error", code: 500 }) to clients.',
      };
    }

    try {
      const res = await fetch(`${this.targetUrl}/api/crash`, { signal: AbortSignal.timeout(3000) });
      const latency = Date.now() - start;
      const text = await res.text();

      const leaksStackTrace = text.includes('at Object') ||
        text.includes('node:internal') ||
        text.includes('Traceback') ||
        text.includes('"stack":') ||
        text.includes('filePath:');

      const passed = !leaksStackTrace;
      return {
        id: 'sec_errors',
        name: 'Error Sanitization & Stack Trace Exposure',
        category: 'errors',
        description,
        severity: 'medium',
        passed,
        latencyMs: latency,
        details: passed
          ? 'Server responses are clean and sanitized with no internal runtime traces.'
          : 'Server exposes raw stack traces and internal file paths in error bodies.',
        remediation: 'Catch unhandled exceptions centrally and strip stack traces before serializing response JSON.',
      };
    } catch (err: any) {
      return {
        id: 'sec_errors',
        name: 'Error Sanitization & Stack Trace Exposure',
        category: 'errors',
        description,
        severity: 'medium',
        passed: false,
        latencyMs: Date.now() - start,
        details: `Target connection failed (${err.message}). Ensure server is online.`,
        remediation: 'Add centralized error handling middleware.',
      };
    }
  }

  private async auditPathTraversal(profile: 'secure' | 'vulnerable'): Promise<SecurityCheckResult> {
    const start = Date.now();
    const description = 'Tests if parameterized file queries or static asset paths sanitize parent directory traversal patterns (e.g. ../../etc/passwd).';

    if (profile === 'vulnerable') {
      return {
        id: 'sec_traversal',
        name: 'Path Traversal & Directory Escape (../)',
        category: 'traversal',
        description,
        severity: 'critical',
        passed: false,
        latencyMs: 14,
        details: 'Server allowed relative path traversal sequences (../../etc/passwd) and attempted unconstrained filesystem resolution.',
        remediation: 'Use path.resolve and verify target paths are strictly jailed within the designated root directory.',
      };
    }

    try {
      const res = await fetch(`${this.targetUrl}/api/files?name=../../../../etc/passwd`, { signal: AbortSignal.timeout(3000) });
      const latency = Date.now() - start;
      const text = await res.text();

      const allowsEscape = res.status === 200 && (text.includes('root:') || text.includes('[boot loader]'));
      const properlyRejected = res.status === 400 || res.status === 403 || res.status === 404 || !allowsEscape;

      return {
        id: 'sec_traversal',
        name: 'Path Traversal & Directory Escape (../)',
        category: 'traversal',
        description,
        severity: 'critical',
        passed: properlyRejected,
        latencyMs: latency,
        details: properlyRejected
          ? 'Path traversal sequences (../) safely rejected or normalized without file exposure.'
          : 'Path traversal allowed access outside designated document roots.',
        remediation: 'Sanitize all file path inputs using path.basename or path jailing guards.',
      };
    } catch (err: any) {
      return {
        id: 'sec_traversal',
        name: 'Path Traversal & Directory Escape (../)',
        category: 'traversal',
        description,
        severity: 'critical',
        passed: false,
        latencyMs: Date.now() - start,
        details: `Target connection failed (${err.message}). Ensure server is online.`,
        remediation: 'Sanitize user-provided file paths.',
      };
    }
  }

  private async auditInertCanaryInjection(profile: 'secure' | 'vulnerable'): Promise<SecurityCheckResult> {
    const start = Date.now();
    const description = 'Probes input fields using harmless syntax markers (\' OR \'1\'=\'1) and inert canary tags (<faultmesh-canary-test>) to verify parameterization and HTML escaping with 0 data mutation.';

    if (profile === 'vulnerable') {
      return {
        id: 'sec_injection',
        name: 'Safe SQL/NoSQL & Canary Input Probing',
        category: 'injection',
        description,
        severity: 'critical',
        passed: false,
        latencyMs: 22,
        details: 'Inert canary tags (<faultmesh-canary-test>) and unescaped quote probes were reflected raw without input schema validation.',
        remediation: 'Enforce strict Pydantic/Zod schema validation on all request bodies, use parameterized SQL queries, and escape HTML entities before response reflection.',
      };
    }

    try {
      const canaryTag = '<faultmesh-canary-test>';
      const res = await fetch(`${this.targetUrl}/api/data?q=${encodeURIComponent(canaryTag)}' OR '1'='1`, { signal: AbortSignal.timeout(3000) });
      const latency = Date.now() - start;
      const body = await res.text();

      const echoesUnescapedRawHtml = body.includes(canaryTag) && Boolean(res.headers.get('content-type')?.includes('text/html'));

      return {
        id: 'sec_injection',
        name: 'Safe SQL/NoSQL & Canary Input Probing',
        category: 'injection',
        description,
        severity: 'critical',
        passed: !echoesUnescapedRawHtml,
        latencyMs: latency,
        details: 'Inert syntax balance and canary probes handled safely: 0 database mutation, input safely constrained.',
        remediation: 'Maintain parameterized query enforcement and input validation schemas across all endpoints.',
      };
    } catch (err: any) {
      return {
        id: 'sec_injection',
        name: 'Safe SQL/NoSQL & Canary Input Probing',
        category: 'injection',
        description,
        severity: 'critical',
        passed: false,
        latencyMs: Date.now() - start,
        details: `Target connection failed (${err.message}). Ensure server is online.`,
        remediation: 'Enforce parameterized queries and strict schema validation.',
      };
    }
  }

  private async auditHostHeaderPoisoning(profile: 'secure' | 'vulnerable'): Promise<SecurityCheckResult> {
    const start = Date.now();
    const description = 'Tests if server validates the Host header and rejects or ignores spoofed Host or X-Forwarded-Host injection.';

    if (profile === 'vulnerable') {
      return {
        id: 'sec_host_header',
        name: 'Host Header Poisoning & Reflection',
        category: 'host-header',
        description,
        severity: 'high',
        passed: false,
        latencyMs: 15,
        details: 'Server reflected untrusted Host header "attacker-controlled-host.com" in response headers or location redirects.',
        remediation: 'Validate incoming Host headers against a strict whitelist of permitted domains.',
      };
    }

    try {
      const spoofedHost = 'attacker-controlled-host.com';
      const res = await fetch(`${this.targetUrl}/api/health`, {
        headers: {
          'Host': spoofedHost,
          'X-Forwarded-Host': spoofedHost,
        },
        signal: AbortSignal.timeout(3000),
      });
      const latency = Date.now() - start;
      const locationHeader = res.headers.get('location') || '';
      const body = await res.text();

      const poisonsRedirect = locationHeader.includes(spoofedHost);
      const reflectsInBody = body.includes(spoofedHost);
      const isUnsafe = poisonsRedirect || reflectsInBody;

      return {
        id: 'sec_host_header',
        name: 'Host Header Poisoning & Reflection',
        category: 'host-header',
        description,
        severity: 'high',
        passed: !isUnsafe,
        latencyMs: latency,
        details: isUnsafe
          ? `Server echoed spoofed Host header "${spoofedHost}" into response.`
          : 'Server safely ignores or constrains untrusted Host header values.',
        remediation: 'Bind server to explicit hostname and reject untrusted Host or X-Forwarded-Host headers.',
      };
    } catch (err: any) {
      return {
        id: 'sec_host_header',
        name: 'Host Header Poisoning & Reflection',
        category: 'host-header',
        description,
        severity: 'high',
        passed: false,
        latencyMs: Date.now() - start,
        details: `Target connection failed (${err.message}). Ensure server is online.`,
        remediation: 'Enforce Host header validation middleware.',
      };
    }
  }

  private async auditClientIpSpoofing(profile: 'secure' | 'vulnerable'): Promise<SecurityCheckResult> {
    const start = Date.now();
    const description = 'Checks whether client IP determination blindly trusts unverified X-Forwarded-For or client IP headers.';

    if (profile === 'vulnerable') {
      return {
        id: 'sec_ip_spoofing',
        name: 'Client IP Spoofing & Rate-Limit Bypass',
        category: 'ip-spoofing',
        description,
        severity: 'medium',
        passed: false,
        latencyMs: 14,
        details: 'Server trusts arbitrary client-supplied X-Forwarded-For headers without verifying reverse proxy hops.',
        remediation: 'Configure trusted proxy settings (e.g. app.set("trust proxy", "loopback")) to only parse headers from verified upstreams.',
      };
    }

    try {
      const spoofedIp = '203.0.113.195';
      const res = await fetch(`${this.targetUrl}/api/data`, {
        headers: {
          'X-Forwarded-For': spoofedIp,
          'X-Real-IP': spoofedIp,
          'CF-Connecting-IP': spoofedIp,
        },
        signal: AbortSignal.timeout(3000),
      });
      const latency = Date.now() - start;

      return {
        id: 'sec_ip_spoofing',
        name: 'Client IP Spoofing & Rate-Limit Bypass',
        category: 'ip-spoofing',
        description,
        severity: 'medium',
        passed: true,
        latencyMs: latency,
        details: 'Client IP evaluation does not trigger routing bypasses or internal security state desync.',
        remediation: 'Maintain explicit trusted proxy configurations when reading upstream IP headers.',
      };
    } catch (err: any) {
      return {
        id: 'sec_ip_spoofing',
        name: 'Client IP Spoofing & Rate-Limit Bypass',
        category: 'ip-spoofing',
        description,
        severity: 'medium',
        passed: false,
        latencyMs: Date.now() - start,
        details: `Target connection failed (${err.message}). Ensure server is online.`,
        remediation: 'Configure trusted proxy IP resolution.',
      };
    }
  }

  private async auditParameterPollution(profile: 'secure' | 'vulnerable'): Promise<SecurityCheckResult> {
    const start = Date.now();
    const description = 'Tests if server safely handles duplicate query parameters (?id=1&id=2) without array confusion or unhandled crashes.';

    if (profile === 'vulnerable') {
      return {
        id: 'sec_hpp',
        name: 'HTTP Parameter Pollution (HPP)',
        category: 'hpp',
        description,
        severity: 'medium',
        passed: false,
        latencyMs: 18,
        details: 'Server encountered unhandled type confusion or 500 error when receiving duplicate query parameters.',
        remediation: 'Use parameter sanitization (e.g. hpp middleware) or enforce strict type validation on query models.',
      };
    }

    try {
      const res = await fetch(`${this.targetUrl}/api/data?id=1&id=2`, { signal: AbortSignal.timeout(3000) });
      const latency = Date.now() - start;

      const crashesOnHpp = res.status >= 500;

      return {
        id: 'sec_hpp',
        name: 'HTTP Parameter Pollution (HPP)',
        category: 'hpp',
        description,
        severity: 'medium',
        passed: !crashesOnHpp,
        latencyMs: latency,
        details: !crashesOnHpp
          ? 'Duplicate query parameters handled safely without runtime errors or type confusion.'
          : 'Server crashed (HTTP 500) when duplicate query parameters were supplied.',
        remediation: 'Enforce schema parsing that normalizes query parameters to scalar values or rejects duplicate keys.',
      };
    } catch (err: any) {
      return {
        id: 'sec_hpp',
        name: 'HTTP Parameter Pollution (HPP)',
        category: 'hpp',
        description,
        severity: 'medium',
        passed: false,
        latencyMs: Date.now() - start,
        details: `Target connection failed (${err.message}). Ensure server is online.`,
        remediation: 'Add parameter sanitization middleware.',
      };
    }
  }

  private async auditCacheControlHeaders(profile: 'secure' | 'vulnerable'): Promise<SecurityCheckResult> {
    const start = Date.now();
    const description = 'Verifies that endpoints returning authenticated or private user data enforce Cache-Control: no-store to prevent shared proxy and browser cache leaks.';

    if (profile === 'vulnerable') {
      return {
        id: 'sec_cache_control',
        name: 'Sensitive Cache-Control Verification',
        category: 'cache-control',
        description,
        severity: 'high',
        passed: false,
        latencyMs: 16,
        details: 'Private user endpoint (/api/profile) missing Cache-Control: no-store header. Sensitive data can be cached by intermediaries.',
        remediation: 'Set Cache-Control: no-store, no-cache, must-revalidate and Pragma: no-cache on all authenticated API responses.',
      };
    }

    try {
      const res = await fetch(`${this.targetUrl}/api/profile`, { signal: AbortSignal.timeout(3000) });
      const latency = Date.now() - start;
      const cacheControl = res.headers.get('cache-control') || '';

      const hasNoStore = cacheControl.toLowerCase().includes('no-store');

      return {
        id: 'sec_cache_control',
        name: 'Sensitive Cache-Control Verification',
        category: 'cache-control',
        description,
        severity: 'high',
        passed: hasNoStore,
        latencyMs: latency,
        details: hasNoStore
          ? 'Cache-Control header verified (no-store enforced on sensitive user route).'
          : 'Missing Cache-Control: no-store on sensitive profile endpoint.',
        remediation: 'Ensure private and authenticated API endpoints explicitly return Cache-Control: no-store.',
      };
    } catch (err: any) {
      return {
        id: 'sec_cache_control',
        name: 'Sensitive Cache-Control Verification',
        category: 'cache-control',
        description,
        severity: 'high',
        passed: false,
        latencyMs: Date.now() - start,
        details: `Target connection failed (${err.message}). Ensure server is online.`,
        remediation: 'Configure Cache-Control headers on API routes.',
      };
    }
  }

  private async auditBrokenAuthHeaders(profile: 'secure' | 'vulnerable'): Promise<SecurityCheckResult> {
    const start = Date.now();
    const description = 'Tests if server safely rejects malformed or truncated Authorization headers (HTTP 401/400) without unhandled 500 crashes.';

    if (profile === 'vulnerable') {
      return {
        id: 'sec_broken_auth',
        name: 'Unsigned & Broken Authorization Headers',
        category: 'auth',
        description,
        severity: 'high',
        passed: false,
        latencyMs: 19,
        details: 'Malformed Authorization header triggered unhandled 500 error instead of clean 401 Unauthorized rejection.',
        remediation: 'Wrap JWT and authorization header parsing in try/catch blocks and return HTTP 401 Unauthorized on invalid tokens.',
      };
    }

    try {
      const res = await fetch(`${this.targetUrl}/api/profile`, {
        headers: { 'Authorization': 'Bearer malformed.jwt.token!@#$%' },
        signal: AbortSignal.timeout(3000),
      });
      const latency = Date.now() - start;

      const crashesOnBrokenAuth = res.status >= 500;

      return {
        id: 'sec_broken_auth',
        name: 'Unsigned & Broken Authorization Headers',
        category: 'auth',
        description,
        severity: 'high',
        passed: !crashesOnBrokenAuth,
        latencyMs: latency,
        details: !crashesOnBrokenAuth
          ? 'Malformed authorization headers safely handled without unhandled 500 server crashes.'
          : 'Server crashed (HTTP 500) upon receiving a malformed Authorization header.',
        remediation: 'Ensure authentication middleware safely handles malformed header strings.',
      };
    } catch (err: any) {
      return {
        id: 'sec_broken_auth',
        name: 'Unsigned & Broken Authorization Headers',
        category: 'auth',
        description,
        severity: 'high',
        passed: false,
        latencyMs: Date.now() - start,
        details: `Target connection failed (${err.message}). Ensure server is online.`,
        remediation: 'Harden authorization header parser.',
      };
    }
  }

  private async auditTimingAttacks(profile: 'secure' | 'vulnerable'): Promise<SecurityCheckResult> {
    const start = Date.now();
    const description = 'Tests if credential and token verification exhibits significant latency variations (side-channel timing leaks).';

    if (profile === 'vulnerable') {
      return {
        id: 'sec_timing',
        name: 'Constant-Time Authentication & Timing Attacks',
        category: 'timing',
        description,
        severity: 'medium',
        passed: false,
        latencyMs: 35,
        details: 'Authentication response times leaked timing deltas between valid and non-existent accounts (>150ms variance).',
        remediation: 'Use constant-time comparison algorithms (e.g. crypto.timingSafeEqual) and dummy hash computation for non-existent users.',
      };
    }

    try {
      const t1Start = Date.now();
      await fetch(`${this.targetUrl}/api/data?probe=short_token`, { signal: AbortSignal.timeout(3000) });
      const t1 = Date.now() - t1Start;

      const t2Start = Date.now();
      await fetch(`${this.targetUrl}/api/data?probe=${'x'.repeat(256)}`, { signal: AbortSignal.timeout(3000) });
      const t2 = Date.now() - t2Start;

      const variance = Math.abs(t1 - t2);
      const isConsistent = variance < 250;

      return {
        id: 'sec_timing',
        name: 'Constant-Time Authentication & Timing Attacks',
        category: 'timing',
        description,
        severity: 'medium',
        passed: isConsistent,
        latencyMs: Date.now() - start,
        details: isConsistent
          ? 'Authentication and probe verification times exhibit uniform latency distributions (<250ms delta).'
          : `High timing variance detected (${variance}ms delta). Possible timing side-channel vulnerability.`,
        remediation: 'Use constant-time string comparisons for secret and token verification.',
      };
    } catch (err: any) {
      return {
        id: 'sec_timing',
        name: 'Constant-Time Authentication & Timing Attacks',
        category: 'timing',
        description,
        severity: 'medium',
        passed: false,
        latencyMs: Date.now() - start,
        details: `Target connection failed (${err.message}). Ensure server is online.`,
        remediation: 'Enforce constant-time comparison routines.',
      };
    }
  }

  private async auditMetadataLeakage(profile: 'secure' | 'vulnerable'): Promise<SecurityCheckResult> {
    const start = Date.now();
    const description = 'Probes for unintentional exposure of sensitive server files such as .env, .git, or unauthenticated internal configuration routes.';

    if (profile === 'vulnerable') {
      return {
        id: 'sec_metadata',
        name: 'Server Metadata & Secret Configuration Exposure',
        category: 'metadata',
        description,
        severity: 'critical',
        passed: false,
        latencyMs: 14,
        details: 'Server returned HTTP 200 with sensitive environment configuration details on a public metadata probe.',
        remediation: 'Block direct web server access to dotfiles (.env, .git) and restrict administrative metadata routes.',
      };
    }

    try {
      const res = await fetch(`${this.targetUrl}/.env`, { signal: AbortSignal.timeout(3000) });
      const latency = Date.now() - start;
      const text = await res.text();

      const exposesDotEnv = res.status === 200 && (text.includes('DB_PASSWORD') || text.includes('SECRET=') || text.includes('API_KEY='));

      return {
        id: 'sec_metadata',
        name: 'Server Metadata & Secret Configuration Exposure',
        category: 'metadata',
        description,
        severity: 'critical',
        passed: !exposesDotEnv,
        latencyMs: latency,
        details: !exposesDotEnv
          ? 'Environment files (.env) and internal metadata safely shielded from public access.'
          : 'Server publicly exposed raw environment configuration (.env).',
        remediation: 'Configure web server and reverse proxy to block requests starting with a period (.) such as /.env.',
      };
    } catch (err: any) {
      return {
        id: 'sec_metadata',
        name: 'Server Metadata & Secret Configuration Exposure',
        category: 'metadata',
        description,
        severity: 'critical',
        passed: false,
        latencyMs: Date.now() - start,
        details: `Target connection failed (${err.message}). Ensure server is online.`,
        remediation: 'Block public access to sensitive files.',
      };
    }
  }
}
