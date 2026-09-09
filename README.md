# FaultMesh

High-Precision Network & API Fault Injection Engine and Live Resilience Auditor.

FaultMesh is a zero-dependency, lightweight chaos engineering middleman proxy and automated API auditor. It sits between your clients (frontend, mobile apps, microservices) and your backend to simulate real-world network disasters and audit your API for resilience, security headers, data leakage, and DoS defense.

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

### 1. Automated 16-Point Audit Suite
FaultMesh executes automated, non-destructive probe batteries against your API and produces a scored diagnostic report card (Grade A+ to F, vulnerability descriptions, and concrete remediation steps).

* **Network Resilience Suite (5 Checks):**
  * Latency / Timeout Ingestion (200ms - 5000ms delay handling)
  * Bandwidth Choking (50 - 500 KB/s stream survival)
  * TCP Connection Cut (kernel-level `ECONNRESET` recovery)
  * Payload Truncation (malformed / partial JSON parsing safety)
  * Server Outage Emulation (HTTP 503 circuit-breaking & backoff)

* **Security & Protocol Audit Suite (7 Checks):**
  * Defensive Headers (`X-Content-Type-Options`, `X-Frame-Options`, `HSTS`)
  * CORS Origin & Credential Safety (flags `Access-Control-Allow-Origin: *` with credentials)
  * Query Parameter Secret Scanner (flags tokens and passwords in GET URLs)
  * Outbound Response PII Scanner (scans for leaked API keys, tokens, and database hashes)
  * Stack Trace Sanitization (ensures 500 errors do not expose file paths or DB schemas)
  * Path Traversal Probing (passive `../../etc/passwd` path handling check)
  * Safe Canary Syntax Probing (inert SQL quote balancing check without data mutation)

* **Traffic Storm & DoS Defense Suite (4 Checks):**
  * Rate Limiting & HTTP 429 Backoff (detects missing rate limiters and `Retry-After` headers)
  * Payload Size Limits & HTTP 413 (tests oversized body handling to prevent buffer OOM crashes)
  * Slowloris Read Timeout Defense (tests resilience against slow byte-drip socket exhaustion)
  * Idempotency Deduplication (tests duplicate transaction handling with idempotency keys)

---

### 2. Interactive Chaos Proxy (Port 3001)
Point your frontend (React, Vue, iOS, Android) or HTTP client to `http://127.0.0.1:3001`. 
Configure fault profiles on the dashboard to test how your frontend handles:
* Simulated 503 outages
* Artificial 2G/3G network latency
* Bandwidth throttling
* Broken connections and truncated responses

---

### 3. Live Traffic Inspector
Inspect every HTTP request passing through the proxy in real time with status pills, measured latency, client IP, and active fault annotations.

---

## Security & Local Permissions

FaultMesh runs locally with strict least-privilege principles:
* **Zero Child Processes:** FaultMesh does not spawn shells or execute external binaries (`child_process.exec` is not used).
* **Strict Path Confinement:** The dashboard web server applies canonical path jailing to prevent directory traversal outside `dist/dashboard`.
* **In-Memory Telemetry:** Telemetry and request payloads are kept in an ephemeral in-memory ring buffer; nothing is logged to disk.
* **Non-Destructive Probing:** All security probes (canaries, traversal, storm bursts) are read-only and inert.

For full architectural details, see [docs/SECURITY.md](docs/SECURITY.md).

---

## License

MIT License.

