# FaultMesh Security Policy & Local Confinement Architecture

This document describes the security model, permission boundaries, and runtime confinement guarantees implemented by FaultMesh.

---

## 1. Local Process & Permission Footprint

When executed via `npx faultmesh` or `node dist/cli.js`:
* **User-Level Execution:** FaultMesh runs strictly as the invoking user. It does not require, request, or escalate to root or administrator privileges.
* **No Child Process Execution:** FaultMesh does not spawn subprocesses, invoke system shells (`sh`, `bash`, `cmd`, `powershell`), or call `child_process.exec`. All networking, traffic interception, and telemetry are handled natively in pure Node.js runtime streams.
* **No Background Daemons:** FaultMesh terminates completely when you press `Ctrl+C` or send `SIGINT`/`SIGTERM`. It does not install standing system services, background watchers, or scheduled tasks.

---

## 2. File System Confinement & Path Jailing

* **Read-Only Dashboard Assets:** FaultMesh reads only its own bundled web interface assets located inside `dist/dashboard`.
* **Path Traversal Protection:** The dashboard HTTP server on port 3000 applies strict canonical path resolution. Any request attempting directory traversal (e.g. `GET /../../../../etc/passwd` or accessing system files) is verified against the canonical dashboard directory boundary and rejected with `403 Forbidden: Path Traversal Prohibited`.
* **Zero Disk Persistence:** Request bodies, query parameters, authorization headers, and telemetry logs processed by the middleman proxy are kept strictly in ephemeral in-memory ring buffers (`TelemetryHub`). Nothing is persisted to the local disk.

---

## 3. Network Boundaries & Loopback Safety

* **Default Loopback Binding:** The proxy (`3001`) and control dashboard (`3000`) bind to the local loopback interface (`127.0.0.1` / `localhost`).
* **Non-Destructive Probing:** All automated audit checks (SQL injection canary probes, traversal probes, payload size tests) are inert and read-only. FaultMesh never executes destructive queries, schema drops, or writes to external databases.
* **Telemetry Privacy:** Zero telemetry, metrics, or usage logs are ever sent to external cloud servers, analytics providers, or third-party endpoints.

---

## 4. Reporting Security Vulnerabilities

If you discover a security vulnerability in FaultMesh, please report it via GitHub Issues or contact the maintainer directly. Security issues will be addressed and patched promptly.
