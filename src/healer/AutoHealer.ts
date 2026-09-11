import fs from 'node:fs';
import path from 'node:path';
import { BackendFramework, HealApplyOptions, HealApplyResult, HealPatch, HealRollbackOptions, HealRollbackResult, HealScanOptions, HealScanResult } from './types.js';
import { DiffGenerator } from './DiffGenerator.js';
import { ExpressTransformers } from './transformers/ExpressTransformers.js';
import { FastApiTransformers } from './transformers/FastApiTransformers.js';

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
        warnings: [...warnings, 'Could not locate server entry file (e.g. server.js, index.ts, main.py)'],
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
        ];

    // 3. Apply Transformations
    let workingContent = originalContent;

    for (const check of checksToEvaluate) {
      const lowerCheck = check.toLowerCase();
      let res: { modified: boolean; content: string; description: string } | null = null;

      if (framework === 'express' || framework === 'generic-node') {
        if (lowerCheck.includes('header') || lowerCheck.includes('nosniff') || lowerCheck.includes('defensive')) {
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
      }

      if (res && res.modified) {
        const patchId = `patch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
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
    const scanResult = await this.scan({ projectDir: resolvedDir });
    if (!scanResult.success || scanResult.patches.length === 0) {
      return {
        success: true,
        appliedCount: 0,
        appliedPatches: [],
        errors: scanResult.warnings.length > 0 ? scanResult.warnings : ['No applicable patches found'],
      };
    }

    const patchesToApply = options.patchIds && options.patchIds.length > 0
      ? scanResult.patches.filter(p => options.patchIds!.includes(p.id))
      : scanResult.patches;

    if (patchesToApply.length === 0) {
      return {
        success: true,
        appliedCount: 0,
        appliedPatches: [],
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

        // Check package.json "main"
        if (pkg.main && fs.existsSync(path.join(projectDir, pkg.main))) {
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
      if (fs.existsSync(reqPath)) {
        const reqContent = fs.readFileSync(reqPath, 'utf8');
        if (reqContent.includes('fastapi')) isFastApi = true;
      }
      if (fs.existsSync(pyprojectPath)) {
        const pyContent = fs.readFileSync(pyprojectPath, 'utf8');
        if (pyContent.includes('fastapi')) isFastApi = true;
      }

      framework = isFastApi ? 'fastapi' : 'generic-python';

      const commonPythonEntries = [
        'main.py', 'app.py',
        'src/main.py', 'src/app.py',
        'server.py', 'src/server.py',
      ];

      for (const entry of commonPythonEntries) {
        if (fs.existsSync(path.join(projectDir, entry))) {
          return { framework, entryFile: entry, warnings };
        }
      }
    }

    return { framework, warnings };
  }
}
