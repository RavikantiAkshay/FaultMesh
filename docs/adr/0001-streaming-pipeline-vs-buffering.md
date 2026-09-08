# ADR-0001: Chunked Stream Transformations over Full-Payload Buffering

**Date**: 2026-09-08  
**Status**: accepted  
**Deciders**: FaultMesh Architecture Council (Architect, Skeptic, Pragmatist, Critic)

## Context
When an HTTP reverse proxy intercepts client requests and upstream responses to inject faults (e.g., latency, bandwidth throttling, connection cuts, corruption), it can either:
1. Buffer the entire payload in memory before transmitting it.
2. Pipe data continuously through a chain of streaming transformers.

Full-memory buffering causes significant memory spikes under high throughput and makes it impossible to simulate real-world transport phenomena like mid-stream connection slicing ("Elevator Drop") or progressive token-bucket pacing (e.g., 2G/3G throttled bandwidth).

## Decision
We implement all fault injections as composable Node.js `stream.Transform` pipelines with automatic socket abort cleanup.

## Alternatives Considered

### Alternative 1: Full-Payload Memory Buffering
- **Pros**: Trivial string and JSON manipulation; easy header calculations.
- **Cons**: Cannot simulate progressive byte streaming, throttled delivery over seconds, or mid-stream socket termination; $O(N)$ memory growth.
- **Why not**: Fails to reproduce authentic network physics.

### Alternative 2: Direct Raw TCP Sockets Only
- **Pros**: Highest potential raw throughput.
- **Cons**: Loses HTTP protocol awareness (headers, status codes, chunked transfer encoding), requiring custom HTTP parser re-implementation.
- **Why not**: Unnecessary complexity when Node's native `http` module already exposes chunk streams.

## Consequences

### Positive
- Memory consumption remains $O(1)$ constant regardless of payload size.
- Real-time fault effects (pacing, truncation, byte flipping) operate on live chunks.
- Composable architecture: multiple toxics (e.g. 500ms latency + 10KB/s bandwidth limit + 1% bit flip) can be chained cleanly.

### Negative / Risks
- Unhandled errors on stream aborts can crash the Node event loop if error listeners are omitted.
- **Mitigation**: BaseToxic provides guaranteed error propagation and `destroy()` hooks to clean up timers immediately if the downstream client disconnects.
