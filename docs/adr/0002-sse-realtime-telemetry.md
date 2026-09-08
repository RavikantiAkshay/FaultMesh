# ADR-0002: Server-Sent Events (SSE) for Real-Time Telemetry Broadcasting

**Date**: 2026-09-08  
**Status**: accepted  
**Deciders**: FaultMesh Architecture Council

## Context
The FaultMesh Dashboard requires live visualization of intercepted requests, latency distributions, active toxic triggers, and byte throughput without refreshing the page. We must select a real-time push mechanism that remains lightweight and self-contained.

## Decision
We use HTTP/1.1 **Server-Sent Events (SSE)** (`text/event-stream`) for unidirectional real-time telemetry streaming from the proxy to the dashboard, and standard REST API calls (`POST /_faultmesh/toxics`) for bidirectional control actions.

## Alternatives Considered

### Alternative 1: WebSockets (`ws`)
- **Pros**: Full-duplex bidirectional communication.
- **Cons**: Requires external binary or protocol wrapper dependencies; unnecessary overhead for unidirectional metrics streaming.
- **Why not**: Over-engineered for what is essentially a telemetry feed.

### Alternative 2: HTTP Polling (e.g., every 500ms)
- **Pros**: Simplest to implement.
- **Cons**: High request overhead, delayed visualization of fast events, jittery chart rendering.
- **Why not**: Inferior user experience for live packet streams.

## Consequences

### Positive
- Built entirely on native Node.js HTTP response streaming (`res.writeHead(200, { 'Content-Type': 'text/event-stream' })`). Zero external packages needed.
- Browsers handle auto-reconnect natively via the built-in `EventSource` API.
- Minimal CPU and memory overhead.

### Negative / Risks
- HTTP/1.1 browsers limit concurrent SSE connections per domain to 6.
- **Mitigation**: The dashboard maintains a single multiplexed SSE channel.
