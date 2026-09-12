import fs from 'node:fs';
import path from 'node:path';
import { BackendFramework, HealApplyOptions, HealApplyResult, HealPatch, HealRollbackOptions, HealRollbackResult, HealScanOptions, HealScanResult } from './types.js';
import { DiffGenerator } from './DiffGenerator.js';
import { ExpressTransformers } from './transformers/ExpressTransformers.js';
import { FastApiTransformers } from './transformers/FastApiTransformers.js';
import { GoTransformers } from './transformers/GoTransformers.js';
import { AiHealer } from './AiHealer.js';

export class AutoHealer {
  private static BLACKLISTED_NAMES = [
    '.git',
    'node_modules',
    'venv',
    '.env',
    '.env.local',
    '.env.production',
    '.env.development',
    '.DS_Store',
  ];

  /**
   * Scan a target project directory and generate reviewable remediation patches
   */
  static async scan(options: HealScanOptions): Promise<HealScanResult> {
    const rawDir = options.projectDir || '.';
    const resolvedDir = path.resolve(rawDir);

    // 1. Path Safety & Confinement Validation
    const rootValidation = this.validateProjectDir(resolvedDir);
    if (!rootValidation.valid) {
      return {
        success: false,
        framework: 'generic-node',
        projectRoot: resolvedDir,
        patches: [],
        warnings: [rootValidation.error || 'Invalid directory path'],
      };
    }

    // 2. Framework Detection
    const { framework, entryFile, warnings } = this.detectFrameworkAndEntry(resolvedDir);

    if (!entryFile) {
      return {
        success: false,
        framework,
        projectRoot: resolvedDir,
        patches: [],
        warnings: [...warnings, 'Could not locate server entry file (e.g. server.js, index.ts, main.py, main.go, main.rs)'],
      };
    }

    const fullEntryPath = path.resolve(resolvedDir, entryFile);
    if (!fs.existsSync(fullEntryPath)) {
      return {
        success: false,
        framework,
        projectRoot: resolvedDir,
        entryFile,
        patches: [],
        warnings: [...warnings, `Entry file does not exist: ${entryFile}`],
      };
    }

    const originalContent = fs.readFileSync(fullEntryPath, 'utf8');
    const patches: HealPatch[] = [];

    const checksToEvaluate = options.failedChecks && options.failedChecks.length > 0
      ? options.failedChecks
      : [
          'Defensive Security Headers',
          'Oversized Payload & Buffer OOM Defense (HTTP 413)',
          'CORS & Origin Validation',
          'Error Sanitization & Stack Trace Exposure',
          'Slowloris Connection Drip Defense',
          'Host Header Poisoning & Reflection',
          'Path Traversal & Directory Escape (../)',
          'Duplicate Request Idempotency Protection',
        ];

    // Check AI availability for universal multi-language and arbitrary error remediation
    const aiAvailable = await AiHealer.isAvailable(options.aiConfig);
    let engineUsed: 'codemod' | 'ai-agent' | 'hybrid' = 'codemod';

    // 3. Apply Transformations
    let workingContent = originalContent;

    for (const check of checksToEvaluate) {
      const lowerCheck = check.toLowerCase();
      let res: { modified: boolean; content: string; description: string } | null = null;
      let usedAiForPatch = false;

      // Tier 1: Deterministic CodeMod Transformers
      if (options.engineMode !== 'ai') {
        if (framework === 'express' || framework === 'generic-node') {
          if (lowerCheck.includes('host')) {
            res = ExpressTransformers.applyHostHeaderValidation(workingContent);
          } else if (lowerCheck.includes('traversal') || lowerCheck.includes('directory escape') || lowerCheck.includes('path')) {
            res = ExpressTransformers.applyPathTraversalGuard(workingContent);
          } else if (lowerCheck.includes('idempotency') || lowerCheck.includes('concurrency') || lowerCheck.includes('race condition') || lowerCheck.includes('race-condition') || lowerCheck.includes('duplicate request') || lowerCheck.includes('state mutation')) {
            res = ExpressTransformers.applyIdempotencyProtection(workingContent);
          } else if (lowerCheck.includes('header') || lowerCheck.includes('nosniff') || lowerCheck.includes('defensive')) {
            res = ExpressTransformers.applyDefensiveHeaders(workingContent);
          } else if (lowerCheck.includes('payload') || lowerCheck.includes('413') || lowerCheck.includes('oom')) {
            res = ExpressTransformers.applyPayloadLimit(workingContent);
          } else if (lowerCheck.includes('cors') || lowerCheck.includes('origin')) {
            res = ExpressTransformers.applyCorsLockdown(workingContent);
          } else if (lowerCheck.includes('error') || lowerCheck.includes('stack') || lowerCheck.includes('sanitization')) {
            res = ExpressTransformers.applyErrorSanitization(workingContent);
          } else if (lowerCheck.includes('slowloris') || lowerCheck.includes('drip') || lowerCheck.includes('timeout')) {
            res = ExpressTransformers.applySocketTimeouts(workingContent);
          }
        } else if (framework === 'fastapi' || framework === 'generic-python') {
          if (lowerCheck.includes('header') || lowerCheck.includes('nosniff') || lowerCheck.includes('defensive')) {
            res = FastApiTransformers.applyDefensiveHeaders(workingContent);
          } else if (lowerCheck.includes('payload') || lowerCheck.includes('413') || lowerCheck.includes('oom')) {
            res = FastApiTransformers.applyPayloadLimit(workingContent);
          } else if (lowerCheck.includes('cors') || lowerCheck.includes('origin')) {
            res = FastApiTransformers.applyCorsLockdown(workingContent);
          }
        } else if (framework === 'go-gin' || framework === 'go-nethttp' || framework === 'generic-go') {
          if (lowerCheck.includes('header') || lowerCheck.includes('nosniff') || lowerCheck.includes('defensive')) {
            res = GoTransformers.applyDefensiveHeaders(workingContent);
          } else if (lowerCheck.includes('payload') || lowerCheck.includes('413') || lowerCheck.includes('oom')) {
            res = GoTransformers.applyPayloadLimit(workingContent);
          } else if (lowerCheck.includes('slowloris') || lowerCheck.includes('drip') || lowerCheck.includes('timeout')) {
            res = GoTransformers.applyServerTimeouts(workingContent);
          }
        }
      }

      // Tier 2: AI Healer Agent (Universal Multi-Language & Arbitrary Error Remediation)
      if ((!res || !res.modified) && (options.engineMode === 'ai' || options.engineMode === 'hybrid' || aiAvailable.available)) {
        const aiResult = await AiHealer.generateRemediation({
          filePath: entryFile,
          originalContent: workingContent,
          framework,
          failedChecks: [check],
          config: options.aiConfig,
        });

        if (aiResult.success && aiResult.content !== workingContent) {
          res = {
            modified: true,
            content: aiResult.content,
            description: aiResult.description,
          };
          usedAiForPatch = true;
          engineUsed = engineUsed === 'codemod' ? 'ai-agent' : 'hybrid';
        }
      }

      if (res && res.modified) {
        const cleanKey = check.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        const patchId = `patch_${cleanKey}`;
        const diff = DiffGenerator.generateDiff(entryFile, workingContent, res.content);

        patches.push({
          id: patchId,
          checkName: check,
          filePath: fullEntryPath,
          relativePath: entryFile,
          originalContent: workingContent,
          remediatedContent: res.content,
          diff,
          description: res.description,
          framework,
          engine: usedAiForPatch ? 'ai-agent' : 'codemod',
        });

        // Update workingContent for sequential compounding remediations
        workingContent = res.content;
      }
    }

    return {
      success: true,
      framework,
      projectRoot: resolvedDir,
      entryFile,
      patches,
      warnings,
      engineUsed,
    };
  }

  /**
   * Safely applies generated remediation patches to disk with automatic backup
   */
  static async apply(options: HealApplyOptions): Promise<HealApplyResult> {
    const rawDir = options.projectDir || '.';
    const resolvedDir = path.resolve(rawDir);

    const rootValidation = this.validateProjectDir(resolvedDir);
    if (!rootValidation.valid) {
      return {
        success: false,
        appliedCount: 0,
        appliedPatches: [],
        errors: [rootValidation.error || 'Invalid project directory'],
      };
    }

    // Run a fresh scan to generate latest patches
    const scanResult = await this.scan({
      projectDir: resolvedDir,
      failedChecks: options.failedChecks,
      aiConfig: options.aiConfig,
      engineMode: options.engineMode,
    });
    if (!scanResult.success || scanResult.patches.length === 0) {
      return {
        success: true,
        appliedCount: 0,
        appliedPatches: [],
        errors: scanResult.warnings.length > 0 ? scanResult.warnings : ['No applicable patches found'],
      };
    }

    let patchesToApply = scanResult.patches;
    if (options.patchIds && options.patchIds.length > 0) {
      const filtered = scanResult.patches.filter(p =>
        options.patchIds!.includes(p.id) ||
        options.patchIds!.some(id =>
          id.toLowerCase().includes(p.checkName.toLowerCase()) ||
          p.id.toLowerCase().includes(id.toLowerCase())
        )
      );
      if (filtered.length > 0) {
        patchesToApply = filtered;
      }
    }

    if (patchesToApply.length === 0) {
      return {
        success: true,
        appliedCount: 0,
        appliedPatches: [],
        errors: ['No patches matched criteria'],
      };
    }

    // Prepare backup directory
    let backupDir: string | undefined;
    if (options.createBackup !== false) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      backupDir = path.join(resolvedDir, '.faultmesh-backup', timestamp);
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const appliedPatches: string[] = [];
    const errors: string[] = [];

    // Group patches by file so we write final aggregated content
    const filesMap = new Map<string, string>();
    for (const patch of patchesToApply) {
      filesMap.set(patch.filePath, patch.remediatedContent);
      appliedPatches.push(patch.id);
    }

    for (const [filePath, content] of filesMap.entries()) {
      try {
        if (backupDir && fs.existsSync(filePath)) {
          const rel = path.relative(resolvedDir, filePath);
          const backupFilePath = path.join(backupDir, rel);
          fs.mkdirSync(path.dirname(backupFilePath), { recursive: true });
          fs.copyFileSync(filePath, backupFilePath);
        }

        fs.writeFileSync(filePath, content, 'utf8');
      } catch (err: any) {
        errors.push(`Failed to write patch to ${filePath}: ${err.message}`);
      }
    }

    return {
      success: errors.length === 0,
      appliedCount: appliedPatches.length,
      appliedPatches,
      backupDir,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Restores files from a previously created .faultmesh-backup directory
   */
  static async rollback(options: HealRollbackOptions): Promise<HealRollbackResult> {
    const projectDir = path.resolve(options.projectDir);
    const backupDir = path.resolve(options.backupDir);

    if (!fs.existsSync(backupDir)) {
      return { success: false, restoredFiles: [], errors: ['Backup directory does not exist'] };
    }

    const restoredFiles: string[] = [];
    const errors: string[] = [];

    const restoreRecursive = (currentDir: string) => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullSource = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          restoreRecursive(fullSource);
        } else if (entry.isFile()) {
          const rel = path.relative(backupDir, fullSource);
          const destPath = path.join(projectDir, rel);
          try {
            fs.mkdirSync(path.dirname(destPath), { recursive: true });
            fs.copyFileSync(fullSource, destPath);
            restoredFiles.push(rel);
          } catch (err: any) {
            errors.push(`Failed restoring ${rel}: ${err.message}`);
          }
        }
      }
    };

    restoreRecursive(backupDir);

    return {
      success: errors.length === 0,
      restoredFiles,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Validates target directory exists and prevents targeting system root or parent escapes
   */
  private static validateProjectDir(targetDir: string): { valid: boolean; error?: string } {
    if (!fs.existsSync(targetDir)) {
      return { valid: false, error: `Target project directory does not exist: ${targetDir}` };
    }

    const stat = fs.statSync(targetDir);
    if (!stat.isDirectory()) {
      return { valid: false, error: `Target path is not a directory: ${targetDir}` };
    }

    // Block root directories (e.g. C:\, C:\Windows, /)
    const parsed = path.parse(targetDir);
    if (parsed.root === targetDir) {
      return { valid: false, error: 'Cannot target the operating system root drive' };
    }

    const lower = targetDir.toLowerCase();
    if (lower.includes('\\windows') || lower.includes('/system') || lower.includes('/etc')) {
      return { valid: false, error: 'Access to system directories is strictly prohibited' };
    }

    return { valid: true };
  }

  /**
   * Detects project backend framework and primary entry file
   */
  private static detectFrameworkAndEntry(projectDir: string): {
    framework: BackendFramework;
    entryFile?: string;
    warnings: string[];
  } {
    const warnings: string[] = [];
    const pkgPath = path.join(projectDir, 'package.json');
    const reqPath = path.join(projectDir, 'requirements.txt');
    const pyprojectPath = path.join(projectDir, 'pyproject.toml');

    let framework: BackendFramework = 'generic-node';

    // 1. Node.js detection
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

        if (allDeps.express) {
          framework = 'express';
        } else if (allDeps.fastify) {
          framework = 'fastify';
        } else {
          framework = 'generic-node';
        }

        // If scanning FaultMesh workspace root itself, prioritize targeting the sample backend and prevent targeting FaultMesh runtime
        if (pkg.name === 'faultmesh' || fs.existsSync(path.join(projectDir, 'examples', 'vulnerable-backend', 'server.js'))) {
          if (fs.existsSync(path.join(projectDir, 'examples', 'vulnerable-backend', 'server.js'))) {
            return { framework: 'express', entryFile: 'examples/vulnerable-backend/server.js', warnings };
          }
        }

        // Check package.json "main" (excluding compiled build outputs like dist/)
        const isBuildOutput = typeof pkg.main === 'string' && (
          pkg.main.startsWith('dist/') || pkg.main.startsWith('build/') || pkg.main.startsWith('out/')
        );

        if (pkg.main && !isBuildOutput && fs.existsSync(path.join(projectDir, pkg.main))) {
          return { framework, entryFile: pkg.main, warnings };
        }
      } catch (err: any) {
        warnings.push(`Warning: Unable to parse package.json: ${err.message}`);
      }

      // Check common node entry points
      const commonNodeEntries = [
        'server.ts', 'server.js',
        'src/server.ts', 'src/server.js',
        'index.ts', 'index.js',
        'src/index.ts', 'src/index.js',
        'app.ts', 'app.js',
        'src/app.ts', 'src/app.js',
      ];

      for (const entry of commonNodeEntries) {
        if (fs.existsSync(path.join(projectDir, entry))) {
          return { framework, entryFile: entry, warnings };
        }
      }
    }

    // 2. Python detection
    if (fs.existsSync(reqPath) || fs.existsSync(pyprojectPath)) {
      let isFastApi = false;
      let isFlask = false;
      let isDjango = false;

      const checkPyManifest = (content: string) => {
        if (content.includes('fastapi')) isFastApi = true;
        if (content.includes('flask')) isFlask = true;
        if (content.includes('django')) isDjango = true;
      };

      if (fs.existsSync(reqPath)) checkPyManifest(fs.readFileSync(reqPath, 'utf8'));
      if (fs.existsSync(pyprojectPath)) checkPyManifest(fs.readFileSync(pyprojectPath, 'utf8'));

      if (isFastApi) framework = 'fastapi';
      else if (isFlask) framework = 'flask';
      else if (isDjango) framework = 'django';
      else framework = 'generic-python';

      const commonPythonEntries = [
        'main.py', 'app.py',
        'src/main.py', 'src/app.py',
        'server.py', 'src/server.py',
        'wsgi.py', 'asgi.py',
      ];

      for (const entry of commonPythonEntries) {
        if (fs.existsSync(path.join(projectDir, entry))) {
          return { framework, entryFile: entry, warnings };
        }
      }
    }

    // 3. Go detection
    const goModPath = path.join(projectDir, 'go.mod');
    if (fs.existsSync(goModPath)) {
      try {
        const goMod = fs.readFileSync(goModPath, 'utf8');
        if (goMod.includes('gin-gonic/gin')) {
          framework = 'go-gin';
        } else if (goMod.includes('go-chi/chi')) {
          framework = 'go-chi';
        } else {
          framework = 'generic-go';
        }
      } catch {
        framework = 'generic-go';
      }

      const commonGoEntries = [
        'main.go', 'server.go',
        'cmd/server/main.go', 'cmd/main.go',
        'src/main.go',
      ];

      for (const entry of commonGoEntries) {
        if (fs.existsSync(path.join(projectDir, entry))) {
          return { framework, entryFile: entry, warnings };
        }
      }
    }

    // 4. Rust detection
    const cargoPath = path.join(projectDir, 'Cargo.toml');
    if (fs.existsSync(cargoPath)) {
      try {
        const cargo = fs.readFileSync(cargoPath, 'utf8');
        if (cargo.includes('actix-web')) framework = 'rust-actix';
        else if (cargo.includes('axum')) framework = 'rust-axum';
        else framework = 'generic-rust';
      } catch {
        framework = 'generic-rust';
      }

      const commonRustEntries = ['src/main.rs', 'main.rs', 'src/bin/server.rs'];
      for (const entry of commonRustEntries) {
        if (fs.existsSync(path.join(projectDir, entry))) {
          return { framework, entryFile: entry, warnings };
        }
      }
    }

    // 5. Java / Spring Boot detection
    const pomPath = path.join(projectDir, 'pom.xml');
    const gradlePath = path.join(projectDir, 'build.gradle');
    if (fs.existsSync(pomPath) || fs.existsSync(gradlePath)) {
      framework = 'java-spring';
      const commonJavaEntries = [
        'src/main/java/com/example/Application.java',
        'src/main/java/Application.java',
        'src/main/java/Main.java',
      ];
      for (const entry of commonJavaEntries) {
        if (fs.existsSync(path.join(projectDir, entry))) {
          return { framework, entryFile: entry, warnings };
        }
      }
    }

    // 6. Generic File Fallback (works even without package manifest)
    const genericFallbacks: [string, BackendFramework][] = [
      ['main.go', 'generic-go'],
      ['server.go', 'generic-go'],
      ['src/main.rs', 'generic-rust'],
      ['main.py', 'generic-python'],
      ['app.py', 'generic-python'],
      ['server.js', 'generic-node'],
      ['index.js', 'generic-node'],
      ['server.ts', 'generic-node'],
      ['index.ts', 'generic-node'],
      ['Program.cs', 'csharp-dotnet'],
    ];

    for (const [entry, fw] of genericFallbacks) {
      if (fs.existsSync(path.join(projectDir, entry))) {
        return { framework: fw, entryFile: entry, warnings };
      }
    }

    return { framework, warnings };
  }
}
