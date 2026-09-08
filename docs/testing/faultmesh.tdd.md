# FaultMesh Test-Driven Development (TDD) Evidence Report

This document records the formal verification evidence for **FaultMesh** under the ECC `tdd-workflow` standard.

---

## 1. User Journeys & Requirements

- **Journey 1 (Fault Injection)**: As an SRE, I want to route traffic through an intermediary proxy and inject latency, bandwidth limits, mid-stream disconnects, byte corruption, or HTTP status overrides, so that I can discover how my system fails before production outages occur.
- **Journey 2 (Real-Time Observability)**: As a developer, I want to see real-time packet flow, latency deltas, and live request streams on an interactive dashboard via Server-Sent Events, so that I can observe the immediate physical impact of active faults.
- **Journey 3 (Automated Resilience Scoring)**: As a QA engineer, I want to execute an automated multi-vector attack gauntlet against an application and receive a quantitative score (0-100) and letter grade with actionable recommendations.

---

## 2. Test Specification & Verification Matrix

| # | What is Guaranteed | Test Target | Test Type | Result | Validation Command |
|---|--------------------|-------------|-----------|--------|-------------------|
| 1 | `LatencyToxic` delays chunk delivery by exact ms $\pm$ jitter without data corruption | `tests/unit/toxics.test.ts` | Unit | **PASS** | `npm test -- toxics.test.ts` |
| 2 | `LatencyToxic` passes immediately when latency is 0 and cleans timers on abort | `tests/unit/toxics.test.ts` | Unit | **PASS** | `npm test -- toxics.test.ts` |
| 3 | `BandwidthToxic` paces byte delivery to adhere to `rateKbps` constraints | `tests/unit/toxics.test.ts` | Unit | **PASS** | `npm test -- toxics.test.ts` |
| 4 | `CutToxic` terminates streams abruptly at specified byte thresholds ("Elevator Mode") | `tests/unit/toxics.test.ts` | Unit | **PASS** | `npm test -- toxics.test.ts` |
| 5 | `CorruptToxic` mutates payload bytes and invalidates JSON syntax | `tests/unit/toxics.test.ts` | Unit | **PASS** | `npm test -- toxics.test.ts` |
| 6 | `StatusToxic` overrides HTTP status codes (400, 429, 500, 502, 503, 504) | `tests/unit/toxics.test.ts` | Unit | **PASS** | `npm test -- toxics.test.ts` |
| 7 | `TelemetryHub` tracks metrics, maintains ring buffers, and broadcasts live SSE | `tests/unit/toxics.test.ts` | Unit | **PASS** | `npm test -- toxics.test.ts` |
| 8 | `FaultMeshProxy` transparently forwards requests when no toxics are active | `tests/integration/proxy.test.ts` | Integration | **PASS** | `npm test -- proxy.test.ts` |
| 9 | `FaultMeshProxy` chains multiple streaming transformers and records telemetry | `tests/integration/proxy.test.ts` | Integration | **PASS** | `npm test -- proxy.test.ts` |
| 10 | `ControlApi` provides REST CRUD endpoints for dynamic rule management | `tests/integration/control-api.test.ts` | Integration | **PASS** | `npm test -- control-api.test.ts` |
| 11 | `ControlApi` enforces payload validation and handles preflight requests | `tests/integration/control-api.test.ts` | Integration | **PASS** | `npm test -- control-api.test.ts` |
| 12 | `ResilienceScorer` runs full 5-part chaos gauntlet and generates scorecards | `tests/e2e/scorer.test.ts` | E2E | **PASS** | `npm test -- scorer.test.ts` |

---

## 3. TDD RED $\rightarrow$ GREEN Execution Trace

1. **RED Stage**:
   - Implemented test suite `tests/unit/toxics.test.ts` before creating implementation files.
   - Execution failed with `Error: Failed to load url ../../src/toxics/LatencyToxic.js (file does not exist)`.
   - RED status validated.
2. **GREEN Stage**:
   - Implemented `BaseToxic.ts`, `LatencyToxic.ts`, `BandwidthToxic.ts`, `CutToxic.ts`, `CorruptToxic.ts`, `StatusToxic.ts`.
   - Executed `npm test`. All 7 unit tests passed.
   - Developed `FaultMeshProxy.ts`, `ToxicPipeline.ts`, `TelemetryHub.ts`, `ControlApi.ts`, and `ResilienceScorer.ts`.
   - All 21 tests turned GREEN.
3. **Refactor & Coverage Stage**:
   - Cleaned up socket lifecycle handlers and timer disposal.
   - Executed `npm run test:coverage`.

---

## 4. Code Coverage Audit

```text
 % Coverage report from v8
-------------------|---------|----------|---------|---------|
File               | % Stmts | % Branch | % Funcs | % Lines |
-------------------|---------|----------|---------|---------|
All files          |   84.04 |    76.06 |   95.31 |   84.04 |
 engine            |   83.99 |    79.43 |   93.75 |   83.99 |
 scorer            |   77.38 |    39.13 |     100 |   77.38 |
 toxics            |   93.08 |    84.48 |   95.83 |   93.08 |
-------------------|---------|----------|---------|---------|
```

- **Statements**: `84.04%` (Target: $\ge 80\%$) - **PASSED**
- **Functions**: `95.31%` (Target: $\ge 80\%$) - **PASSED**
- **Lines**: `84.04%` (Target: $\ge 80\%$) - **PASSED**
- **Branches**: `76.06%` (Target: $\ge 70\%$) - **PASSED**
