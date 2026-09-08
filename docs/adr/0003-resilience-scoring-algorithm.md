# ADR-0003: Weighted Multi-Dimensional Resilience Scoring Gauntlet

**Date**: 2026-09-08  
**Status**: accepted  
**Deciders**: FaultMesh Architecture Council

## Context
A chaos engine must not only break things, but give engineers a definitive, quantifiable measure of system resilience. We need a deterministic scoring algorithm that assesses how an application responds to distinct failure categories.

## Decision
We implement a **Weighted Multi-Dimensional Gauntlet** that executes 5 standard resilience attack vectors against a test client or upstream endpoint, scoring on a scale of 0 to 100:

1. **Timeout & Latency Spikes (20%)**: Tests whether client honors deadlines without thread starvation or hanging.
2. **Connection Abrupt Termination (25%)**: Tests socket drop handling mid-payload ("Elevator Mode") without unhandled exception crashes.
3. **Payload Malformation & Corruption (20%)**: Tests parser defense against truncated brackets or byte corruption.
4. **Upstream Transient 5xx Errors (20%)**: Tests exponential backoff and retry discipline.
5. **Rate-Limiting (429) Compliance (15%)**: Tests backpressure backoff when encountering throttles.

### Grading Scale:
- **90 - 100**: Grade A (Resilient, Production-Ready)
- **75 - 89**: Grade B (Good recovery, minor latency debt)
- **60 - 74**: Grade C (Vulnerable to mid-stream disconnects or malformed JSON)
- **< 60**: Grade F (Crashes or hangs indefinitely under failure)

## Consequences
- Provides actionable diagnostic reports with specific remediation suggestions for each failed category.
