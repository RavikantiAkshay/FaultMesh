import http, { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync, spawn } from 'node:child_process';
import { ToxicPipeline } from './ToxicPipeline.js';
import { TelemetryHub } from './TelemetryHub.js';
import { ResilienceScorer } from '../scorer/ResilienceScorer.js';
import { SecurityAuditor } from '../scorer/SecurityAuditor.js';
import { TrafficStormAuditor } from '../scorer/TrafficStormAuditor.js';
import { FaultMeshProxy } from './FaultMeshProxy.js';
import { ToxicRule } from '../types.js';
import { AutoHealer } from '../healer/AutoHealer.js';

export class ControlApi {
  private server: http.Server;
  private port = 0;
  private pipeline: ToxicPipeline;
  private telemetryHub: TelemetryHub;
  private scorer: ResilienceScorer;
  private securityAuditor: SecurityAuditor;
  private trafficStormAuditor: TrafficStormAuditor;
  private dashboardDir: string;
  private proxy?: FaultMeshProxy;
  private isRunning = false;

  constructor(
    port: number,
    pipeline: ToxicPipeline,
    telemetryHub: TelemetryHub,
    scorer: ResilienceScorer,
    securityAuditor?: SecurityAuditor,
    trafficStormAuditor?: TrafficStormAuditor,
    dashboardDir?: string,
    proxy?: FaultMeshProxy
  ) {
    this.port = port;
    this.pipeline = pipeline;
    this.telemetryHub = telemetryHub;
    this.scorer = scorer;
    this.securityAuditor = securityAuditor || new SecurityAuditor('http://127.0.0.1:3001');
    this.trafficStormAuditor = trafficStormAuditor || new TrafficStormAuditor('http://127.0.0.1:3001');
    this.proxy = proxy;

    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    let resolvedDir = dashboardDir || path.resolve(currentDir, '../dashboard');
    if (!fs.existsSync(resolvedDir)) {
      const fallbackDir = path.resolve(currentDir, '../../src/dashboard');
      if (fs.existsSync(fallbackDir)) {
        resolvedDir = fallbackDir;
      }
    }
    this.dashboardDir = resolvedDir;

    this.server = http.createServer((req, res) => this.handleRequest(req, res));
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const rawUrl = req.url || '/';
    if (rawUrl.includes('/..') || rawUrl.includes('..\\') || rawUrl.toLowerCase().includes('%2e%2e') || rawUrl.includes('\0')) {
      this.json(res, 403, { error: 'Access Denied: Path Traversal Prohibited' });
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    // Enable CORS for local dashboards or external runners
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // 1. SSE Stream
    if (pathname === '/_faultmesh/telemetry/stream' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      this.telemetryHub.registerSSEClient(res);
      return;
    }

    // 2. Status & Metrics
    if (pathname === '/_faultmesh/status' && req.method === 'GET') {
      const rules = this.pipeline.getRules();
      this.json(res, 200, {
        status: 'online',
        engine: 'FaultMesh v1.0.0',
        metrics: this.telemetryHub.getMetrics(),
        activeRules: rules,
        activeToxics: rules, // backward compatibility
      });
      return;
    }

    // 3. Rules List
    if ((pathname === '/_faultmesh/rules' || pathname === '/_faultmesh/toxics') && req.method === 'GET') {
      this.json(res, 200, this.pipeline.getRules());
      return;
    }

    // 4. Add / Update Rule
    if ((pathname === '/_faultmesh/rules' || pathname === '/_faultmesh/toxics') && req.method === 'POST') {
      const body = await this.readBody(req);
      try {
        const rule: ToxicRule = JSON.parse(body);
        if (!rule.id || !rule.type || !rule.config) {
          this.json(res, 400, { error: 'Invalid rule definition. Required: id, type, config' });
          return;
        }
        this.pipeline.addRule(rule);
        this.json(res, 201, { success: true, rule });
      } catch (err: any) {
        this.json(res, 400, { error: 'Malformed JSON payload', details: err.message });
      }
      return;
    }

    // 5. Delete Rule
    const isDeleteSpecific = pathname.startsWith('/_faultmesh/rules/') || pathname.startsWith('/_faultmesh/toxics/');
    if (isDeleteSpecific && req.method === 'DELETE') {
      const prefix = pathname.startsWith('/_faultmesh/rules/') ? '/_faultmesh/rules/' : '/_faultmesh/toxics/';
      const id = pathname.substring(prefix.length);
      const removed = this.pipeline.removeRule(id);
      this.json(res, removed ? 200 : 404, { success: removed, id });
      return;
    }

    if ((pathname === '/_faultmesh/rules' || pathname === '/_faultmesh/toxics') && req.method === 'DELETE') {
      this.pipeline.clearRules();
      this.json(res, 200, { success: true, message: 'All simulation rules cleared' });
      return;
    }

    // 6. Run Diagnostics / Health Check
    const isRunTests = pathname === '/_faultmesh/diagnostics/run' || pathname === '/_faultmesh/tests/run' || pathname === '/_faultmesh/gauntlet/run';
    if (isRunTests && req.method === 'POST') {
      try {
        let profile: 'resilient' | 'fragile' = 'resilient';
        const queryProfile = url.searchParams.get('profile');
        if (queryProfile === 'fragile' || queryProfile === 'resilient') {
          profile = queryProfile;
        } else {
          const body = await this.readBody(req);
          if (body) {
            try {
              const parsed = JSON.parse(body);
              if (parsed.profile === 'fragile' || parsed.profile === 'resilient') {
                profile = parsed.profile;
              }
            } catch {}
          }
        }
        const scorecard = await this.scorer.runGauntlet(profile);
        this.json(res, 200, scorecard);
      } catch (err: any) {
        this.json(res, 500, { error: 'Diagnostics execution error', details: err.message });
      }
      return;
    }

    // 7. Run Security & Protocol Audit
    const isRunSecurity = pathname === '/_faultmesh/security/run' || pathname === '/_faultmesh/security/audit';
    if (isRunSecurity && req.method === 'POST') {
      try {
        let profile: 'secure' | 'vulnerable' = 'secure';
        const queryProfile = url.searchParams.get('profile');
        if (queryProfile === 'secure' || queryProfile === 'vulnerable') {
          profile = queryProfile;
        } else {
          const body = await this.readBody(req);
          if (body) {
            try {
              const parsed = JSON.parse(body);
              if (parsed.profile === 'secure' || parsed.profile === 'vulnerable') {
                profile = parsed.profile;
              }
            } catch {}
          }
        }
        const scorecard = await this.securityAuditor.runAudit(profile);
        this.json(res, 200, scorecard);
      } catch (err: any) {
        this.json(res, 500, { error: 'Security audit execution error', details: err.message });
      }
      return;
    }

    // 8. Run Traffic Storm & DoS Resilience Audit
    const isRunStorm = pathname === '/_faultmesh/storm/run' || pathname === '/_faultmesh/storm/audit';
    if (isRunStorm && req.method === 'POST') {
      try {
        let profile: 'resilient' | 'fragile' = 'resilient';
        const queryProfile = url.searchParams.get('profile');
        if (queryProfile === 'fragile' || queryProfile === 'resilient') {
          profile = queryProfile;
        } else {
          const body = await this.readBody(req);
          if (body) {
            try {
              const parsed = JSON.parse(body);
              if (parsed.profile === 'fragile' || parsed.profile === 'resilient') {
                profile = parsed.profile;
              }
            } catch {}
          }
        }
        const scorecard = await this.trafficStormAuditor.runStormSuite(profile);
        this.json(res, 200, scorecard);
      } catch (err: any) {
        this.json(res, 500, { error: 'Traffic storm execution error', details: err.message });
      }
      return;
    }

    // 8.5 Dynamic Target API Configuration
    if (pathname === '/_faultmesh/config/target') {
      if (req.method === 'GET') {
        const currentTarget = this.proxy ? this.proxy.getTargetUrl() : 'http://127.0.0.1:4000';
        this.json(res, 200, { targetUrl: currentTarget });
        return;
      }
      if (req.method === 'POST') {
        const raw = await this.readBody(req);
        try {
          const body = JSON.parse(raw);
          if (!body.targetUrl || typeof body.targetUrl !== 'string') {
            this.json(res, 400, { error: 'targetUrl is required and must be a string' });
            return;
          }
          // Validate URL format
          new URL(body.targetUrl);
          if (this.proxy) {
            this.proxy.setTargetUrl(body.targetUrl);
          }
          if (this.securityAuditor) {
            this.securityAuditor.setTargetUrl(body.targetUrl);
          }
          if (this.trafficStormAuditor) {
            this.trafficStormAuditor.setTargetUrl(body.targetUrl);
          }
          this.json(res, 200, { success: true, targetUrl: body.targetUrl });
        } catch (err: any) {
          this.json(res, 400, { error: 'Invalid target URL format', details: err.message });
        }
        return;
      }
    }

    // 8.6 Auto-Healer Endpoints
    if (pathname === '/_faultmesh/healer/scan' && req.method === 'POST') {
      try {
        const raw = await this.readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const projectDir = body.projectDir || '.';
        const failedChecks = body.failedChecks || [];

        const scanResult = await AutoHealer.scan({ projectDir, failedChecks });
        this.json(res, 200, scanResult);
      } catch (err: any) {
        this.json(res, 500, { error: 'AutoHealer scan error', details: err.message });
      }
      return;
    }

    if (pathname === '/_faultmesh/healer/apply' && req.method === 'POST') {
      try {
        const raw = await this.readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const projectDir = body.projectDir || '.';
        const patchIds = body.patchIds;
        const createBackup = body.createBackup !== false;

        const applyResult = await AutoHealer.apply({ projectDir, patchIds, createBackup });

        // If healing the sample backend, automatically restart it so memory updates immediately
        if (applyResult.success && projectDir.includes('vulnerable-backend')) {
          await this.restartSampleBackend();
        }

        this.json(res, 200, applyResult);
      } catch (err: any) {
        this.json(res, 500, { error: 'AutoHealer apply error', details: err.message });
      }
      return;
    }

    if (pathname === '/_faultmesh/healer/rollback' && req.method === 'POST') {
      try {
        const raw = await this.readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        if (!body.backupDir) {
          this.json(res, 400, { error: 'backupDir is required for rollback' });
          return;
        }
        const projectDir = body.projectDir || '.';
        const rollbackResult = await AutoHealer.rollback({ projectDir, backupDir: body.backupDir });

        if (rollbackResult.success && projectDir.includes('vulnerable-backend')) {
          await this.restartSampleBackend();
        }

        this.json(res, 200, rollbackResult);
      } catch (err: any) {
        this.json(res, 500, { error: 'AutoHealer rollback error', details: err.message });
      }
      return;
    }

    if (pathname === '/_faultmesh/sample/restart' && req.method === 'POST') {
      try {
        await this.restartSampleBackend();
        this.json(res, 200, { success: true, message: 'Sample backend restarted on port 5050' });
      } catch (err: any) {
        this.json(res, 500, { error: 'Failed to restart sample backend', details: err.message });
      }
      return;
    }

    // 9. Static Dashboard Serving
    if (req.method === 'GET') {
      this.serveStatic(pathname, res);
      return;
    }

    this.json(res, 404, { error: 'Route not found' });
  }

  setProxy(proxy: FaultMeshProxy): void {
    this.proxy = proxy;
  }

  private serveStatic(pathname: string, res: ServerResponse): void {
    const normalizedDashboardDir = path.resolve(this.dashboardDir);

    let decodedPath = '';
    try {
      decodedPath = decodeURIComponent(pathname);
    } catch {
      this.json(res, 400, { error: 'Invalid URL encoding' });
      return;
    }

    // Explicit Traversal Guard: reject relative parent indicators or backslashes
    if (decodedPath.includes('..') || decodedPath.includes('\\')) {
      this.json(res, 403, { error: 'Access Denied: Path Traversal Prohibited' });
      return;
    }

    const safePath = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
    const resolvedPath = path.resolve(normalizedDashboardDir, safePath);

    // Strict Path Jailing: prevent directory traversal outside dashboardDir
    const isWithinDashboard = resolvedPath.startsWith(normalizedDashboardDir + path.sep) ||
      resolvedPath === path.join(normalizedDashboardDir, 'index.html');

    if (!isWithinDashboard) {
      this.json(res, 403, { error: 'Access Denied: Path Traversal Prohibited' });
      return;
    }

    const filePath = resolvedPath;

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      const contentTypes: Record<string, string> = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.svg': 'image/svg+xml',
      };
      res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
      fs.createReadStream(filePath).pipe(res);
    } else {
      // Fallback to index.html for SPA only if requesting an extensionless path (e.g. client routes)
      const ext = path.extname(filePath);
      if (!ext) {
        const indexPath = path.join(this.dashboardDir, 'index.html');
        if (fs.existsSync(indexPath)) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          fs.createReadStream(indexPath).pipe(res);
          return;
        }
      }
      this.json(res, 404, { error: 'File not found' });
    }
  }

  private readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => data += chunk);
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });
  }

  private json(res: ServerResponse, status: number, data: any): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  private sampleProcess?: import('node:child_process').ChildProcess;

  private async restartSampleBackend(): Promise<void> {
    if (this.sampleProcess) {
      try {
        this.sampleProcess.kill();
      } catch {}
      this.sampleProcess = undefined;
    }

    this.killPort(5050);
    await new Promise((r) => setTimeout(r, 400));

    const sampleScript = path.resolve(process.cwd(), 'examples/vulnerable-backend/server.js');
    if (!fs.existsSync(sampleScript)) {
      return;
    }

    const child = spawn(process.execPath, [sampleScript], {
      cwd: path.dirname(sampleScript),
      stdio: 'ignore',
      detached: false,
    });
    this.sampleProcess = child;

    const deadline = Date.now() + 6000;
    while (Date.now() < deadline) {
      try {
        const res = await fetch('http://127.0.0.1:5050/api/health', {
          signal: AbortSignal.timeout(500),
        });
        if (res.ok) {
          return;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  private killPort(port: number): void {
    try {
      if (process.platform === 'win32') {
        const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' }).trim();
        if (output) {
          const lines = output.split('\n');
          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && pid !== '0' && pid !== String(process.pid)) {
              try {
                execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
              } catch {}
            }
          }
        }
      } else {
        execSync(`fuser -k ${port}/tcp 2>/dev/null || true`, { stdio: 'ignore' });
      }
    } catch {}
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.port, () => {
        const address = this.server.address();
        if (address && typeof address === 'object') {
          this.port = address.port;
        }
        this.isRunning = true;
        resolve();
      });
      this.server.once('error', reject);
    });
  }

  stop(): Promise<void> {
    if (this.sampleProcess) {
      try {
        this.sampleProcess.kill();
      } catch {}
      this.sampleProcess = undefined;
    }
    this.killPort(5050);
    return new Promise((resolve) => {
      if (!this.isRunning) return resolve();
      this.server.close(() => {
        this.isRunning = false;
        resolve();
      });
    });
  }

  getPort(): number {
    return this.port;
  }
}
