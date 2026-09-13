# FaultMesh

High-Precision Network & API Fault Injection Engine, Autonomous Red Chaos Team, and Live Resilience Auditor.

FaultMesh is a zero-dependency, lightweight chaos engineering middleman proxy and automated API auditor. It sits between your clients (frontend, mobile apps, microservices) and your backend to simulate real-world network disasters, audit your API for resilience and security flaws, and automatically repair discovered vulnerabilities with AST CodeMods.

---

## Quick Start (Zero Install)

Run FaultMesh with a single command against your local or remote backend:

```bash
npx faultmesh --target http://localhost:8000
```

* **Control Dashboard:** `http://localhost:3000`
* **Middleman Chaos Proxy:** `http://127.0.0.1:3001`
* **Target Backend:** `http://localhost:8000`

If you omit `--target`, FaultMesh automatically boots an internal sample API on port `4000` so you can experiment right away:

```bash
npx faultmesh
```

---

## CLI Options

```text
Usage:
  npx faultmesh [options]

Options:
  -t, --target <url>       Target API URL to proxy and audit (e.g. http://localhost:8000)
                           If omitted, starts the built-in sample server on :4000
  -p, --port <number>      Control Dashboard port (default: 3000)
      --proxy-port <num>   Middleman chaos proxy port (default: 3001)
      --mock-port <num>    Port for sample server if no target is given (default: 4000)
  -h, --help               Show help message and exit
  -v, --version            Show version number and exit

Examples:
  npx faultmesh
  npx faultmesh --target http://localhost:8000
  npx faultmesh -t http://localhost:5000 -p 8080 --proxy-port 8081
```

---

## Core Capabilities

### 1. Autonomous Red Chaos Team Engine
Deploy automated multi-wave adversarial assault campaigns against your backend:
* **Tactical Agent Personas:**
  * `VULN-HUNTER` — Surface discovery, host header poisoning, CORS origin checks, auth perimeter bypass.
  * `SILENT-TRAPPER` — Abrupt socket cuts, swallowed exceptions, corrupted JSON stream injections.
  * `NET-FRACTURER` — Latency flutter, jitter fluctuation, gateway 504 hang.
  * `MUTANT-PROBER` — Catastrophic ReDoS, transactional race interleaving, duplicate idempotency probing.
  * `SURGE-STORMER` — Slowloris drip, 1MB buffer overflow, avalanche concurrent bursts.
* **Live Tactical Telemetry Stream:** Real-time console log tracking probes, responses, and detected breaches.
* **Survivability Scorecard & Mission Debrief:** Quantitative scoring (Grade A+ to F) with proof-of-exploit snippets and remediation guidelines.

---

### 2. Auto-Healer & CodeMod Engine
Repair discovered breaches directly in your codebase with zero guesswork:
* **Deterministic AST CodeMods:** Surgically injects defensive headers (Helmet), payload limits (413), strict CORS origin validation, centralized error sanitizers, socket timeouts, host whitelist guards, path traversal sanitizers, and idempotency deduplication.
* **Multi-Framework Support:** Native AST transformers for Express, FastAPI, and Go backends.
* **Safe Local Execution:** Automatic timestamped backups (`.faultmesh-backup/`), 1-click rollback, and instant live backend re-verification.

---

### 3. Primary Audit Suite (32 Comprehensive Checks)
FaultMesh executes automated, non-destructive probe batteries and produces scored diagnostic scorecards:

* **Network Resilience Suite (10 Checks):**
  * Latency / Timeout Ingestion (200ms - 5000ms delay handling)
  * Bandwidth Choking (50 - 500 KB/s stream survival)
  * TCP Connection Cut (kernel-level `ECONNRESET` recovery)
  * Payload Truncation (malformed / partial JSON parsing safety)
  * Server Outage Emulation (HTTP 503 circuit-breaking & backoff)
  * Latency Jitter & Variance
  * Packet Loss & Drops
  * Response Corruption & Garbled Bytes
  * HTTP Header Stripping
  * Premature Connection Reset

* **Security & Protocol Audit Suite (14 Checks):**
  * Defensive Headers (`X-Content-Type-Options`, `X-Frame-Options`, `HSTS`)
  * CORS Origin & Credential Safety
  * Query Parameter Secret Scanner (flags tokens and passwords in GET URLs)
  * Outbound Response PII Scanner (scans for leaked API keys, tokens, and database hashes)
  * Stack Trace Sanitization (ensures 500 errors do not expose file paths or DB schemas)
  * Path Traversal Probing (passive directory traversal sequence check)
  * Safe Canary Syntax Probing (inert SQL quote balancing check without data mutation)
  * Host Header Whitelist Validation
  * Unsigned / Malformed Authorization Headers
  * HTTP Method Override Protection
  * Content-Type Mismatch Probing
  * Null Byte Injection Detection
  * Open Redirect Parameter Detection
  * Insecure Cookie Flags (Missing `Secure` / `HttpOnly`)

* **Traffic Storm & DoS Defense Suite (8 Checks):**
  * Rate Limiting & HTTP 429 Backoff (detects missing rate limiters and `Retry-After` headers)
  * Payload Size Limits & HTTP 413 (tests oversized body handling to prevent buffer OOM crashes)
  * Slowloris Read Timeout Defense (tests resilience against slow byte-drip socket exhaustion)
  * Idempotency Deduplication (tests duplicate transaction handling with idempotency keys)
  * Concurrent Burst Avalanche
  * Chunked Transfer Starvation
  * ReDoS Regex Lockup Probe
  * High-Concurrency Connection Pooling Saturation

---

### 4. Interactive Chaos Proxy & Developer Workbench
Point your frontend (React, Vue, iOS, Android) or microservices to `http://127.0.0.1:3001`:
* **1-Click Quick Presets:** Extreme Jitter, Packet Drop, Slow 3G, Corrupted JSON, 503 Outage.
* **Custom Rule Builder:** Configure latency, error injections, bandwidth throttling, and body corruption with path and method filters.
* **Live Request Inspector:** Real-time HTTP log with status codes, round-trip durations, active toxic tags, and formatted response viewer.

---

## Security & Local Confinement

FaultMesh runs locally with strict least-privilege principles:
* **Zero External Runtime Dependencies:** Pure native Node.js (`node:http`, `node:net`, `node:fs`, `node:crypto`).
* **Strict Path Confinement:** Dashboard HTTP server applies canonical path jailing to prevent directory traversal.
* **In-Memory Telemetry:** Telemetry and request payloads are kept in an ephemeral in-memory ring buffer; nothing is sent to external servers.
* **Non-Destructive Probing:** All security probes are read-only and inert.

For full details, see [docs/SECURITY.md](docs/SECURITY.md).

---

## License

MIT License.
