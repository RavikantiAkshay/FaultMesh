import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { AutoHealer } from '../../src/healer/AutoHealer.js';

describe('FaultMesh AutoHealer Engine (TDD)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faultmesh-healer-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('rejects non-existent directory or OS root directory', async () => {
    const nonExistent = path.join(tempDir, 'does-not-exist');
    const res1 = await AutoHealer.scan({ projectDir: nonExistent });
    expect(res1.success).toBe(false);
    expect(res1.warnings[0]).toContain('does not exist');

    const rootDir = path.parse(process.cwd()).root;
    const res2 = await AutoHealer.scan({ projectDir: rootDir });
    expect(res2.success).toBe(false);
    expect(res2.warnings[0]).toContain('root drive');
  });

  it('scans Express app and generates reviewable unified diffs for missing defenses', async () => {
    // Scaffold sample Express project
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({
      name: 'vulnerable-api',
      dependencies: { express: '^4.18.2' },
    }));

    const sampleServer = `
import express from 'express';

const app = express();
app.use(express.json());

app.get('/api/users', (req, res) => {
  res.json({ users: [] });
});

const server = app.listen(8000, () => {
  console.log('Listening');
});
`;
    fs.writeFileSync(path.join(tempDir, 'server.ts'), sampleServer);

    const scanResult = await AutoHealer.scan({
      projectDir: tempDir,
      failedChecks: [
        'Defensive Security Headers',
        'Oversized Payload & Buffer OOM Defense (HTTP 413)',
        'Error Sanitization & Stack Trace Exposure',
        'Slowloris Connection Drip Defense',
      ],
    });

    expect(scanResult.success).toBe(true);
    expect(scanResult.framework).toBe('express');
    expect(scanResult.entryFile).toBe('server.ts');
    expect(scanResult.patches.length).toBeGreaterThanOrEqual(3);

    // Verify unified diff structure
    const helmetPatch = scanResult.patches.find(p => p.checkName === 'Defensive Security Headers');
    expect(helmetPatch).toBeDefined();
    expect(helmetPatch?.diff).toContain('--- a/server.ts');
    expect(helmetPatch?.diff).toContain('+++ b/server.ts');
    expect(helmetPatch?.diff).toContain('+import helmet from \'helmet\';');
    expect(helmetPatch?.diff).toContain('+app.use(helmet());');

    const payloadPatch = scanResult.patches.find(p => p.checkName.includes('Payload'));
    expect(payloadPatch).toBeDefined();
    expect(payloadPatch?.remediatedContent).toContain("express.json({ limit: '1mb' })");
  });

  it('safely applies patches with automatic backup and supports rollback', async () => {
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({
      name: 'vulnerable-api',
      dependencies: { express: '^4.18.2' },
    }));

    const initialCode = `
import express from 'express';
const app = express();
app.use(express.json());
app.listen(8000);
`;
    const serverPath = path.join(tempDir, 'server.js');
    fs.writeFileSync(serverPath, initialCode);

    // 1. Apply patches
    const applyResult = await AutoHealer.apply({
      projectDir: tempDir,
      createBackup: true,
    });

    expect(applyResult.success).toBe(true);
    expect(applyResult.appliedCount).toBeGreaterThan(0);
    expect(applyResult.backupDir).toBeDefined();
    expect(fs.existsSync(applyResult.backupDir!)).toBe(true);

    // Verify file on disk was remediated
    const updatedContent = fs.readFileSync(serverPath, 'utf8');
    expect(updatedContent).toContain("express.json({ limit: '1mb' })");
    expect(updatedContent).toContain('helmet');

    // 2. Rollback
    const rollbackResult = await AutoHealer.rollback({
      projectDir: tempDir,
      backupDir: applyResult.backupDir!,
    });

    expect(rollbackResult.success).toBe(true);
    expect(rollbackResult.restoredFiles.length).toBeGreaterThan(0);

    // Verify original code restored
    const restoredContent = fs.readFileSync(serverPath, 'utf8');
    expect(restoredContent).toBe(initialCode);
  });

  it('detects and remedies FastAPI applications', async () => {
    fs.writeFileSync(path.join(tempDir, 'requirements.txt'), 'fastapi==0.100.0\nuvicorn==0.22.0\n');

    const pythonCode = `from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "ok"}
`;
    fs.writeFileSync(path.join(tempDir, 'main.py'), pythonCode);

    const scanResult = await AutoHealer.scan({ projectDir: tempDir });
    expect(scanResult.success).toBe(true);
    expect(scanResult.framework).toBe('fastapi');
    expect(scanResult.entryFile).toBe('main.py');
    expect(scanResult.patches.length).toBeGreaterThanOrEqual(2);

    const corsPatch = scanResult.patches.find(p => p.checkName.includes('CORS'));
    expect(corsPatch).toBeDefined();
    expect(corsPatch?.remediatedContent).toContain('allow_origins=["http://localhost:3000"');
  });

  it('detects and remedies Go applications with Gin router', async () => {
    fs.writeFileSync(path.join(tempDir, 'go.mod'), 'module testapi\n\ngo 1.22\n\nrequire github.com/gin-gonic/gin v1.9.1\n');

    const goCode = `package main

import (
\t"github.com/gin-gonic/gin"
)

func main() {
\tr := gin.Default()
\tr.GET("/ping", func(c *gin.Context) {
\t\tc.JSON(200, gin.H{"message": "pong"})
\t})
\tr.Run(":8080")
}
`;
    fs.writeFileSync(path.join(tempDir, 'main.go'), goCode);

    const scanResult = await AutoHealer.scan({
      projectDir: tempDir,
      failedChecks: [
        'Defensive Security Headers',
        'Oversized Payload & Buffer OOM Defense (HTTP 413)',
        'Slowloris Connection Drip Defense',
      ],
    });

    expect(scanResult.success).toBe(true);
    expect(scanResult.framework).toBe('go-gin');
    expect(scanResult.entryFile).toBe('main.go');
    expect(scanResult.patches.length).toBe(3);

    const secPatch = scanResult.patches.find(p => p.checkName.includes('Headers'));
    expect(secPatch).toBeDefined();
    expect(secPatch?.remediatedContent).toContain('X-Content-Type-Options');

    const payloadPatch = scanResult.patches.find(p => p.checkName.includes('Payload'));
    expect(payloadPatch).toBeDefined();
    expect(payloadPatch?.remediatedContent).toContain('http.MaxBytesReader');

    const slowlorisPatch = scanResult.patches.find(p => p.checkName.includes('Slowloris'));
    expect(slowlorisPatch).toBeDefined();
    expect(slowlorisPatch?.remediatedContent).toContain('ReadHeaderTimeout');
  });

  it('detects Rust Cargo projects and reports framework accurately', async () => {
    fs.writeFileSync(path.join(tempDir, 'Cargo.toml'), '[package]\nname = "test-rust"\nversion = "0.1.0"\n\n[dependencies]\nactix-web = "4"\n');
    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'src', 'main.rs'), 'fn main() {}');

    const scanResult = await AutoHealer.scan({ projectDir: tempDir });
    expect(scanResult.success).toBe(true);
    expect(scanResult.framework).toBe('rust-actix');
    expect(scanResult.entryFile).toBe('src/main.rs');
  });
});

