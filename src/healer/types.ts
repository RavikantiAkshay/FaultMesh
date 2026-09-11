export type BackendFramework = 'express' | 'fastify' | 'fastapi' | 'generic-node' | 'generic-python';

export interface HealPatch {
  id: string;
  checkName: string;
  filePath: string;
  relativePath: string;
  originalContent: string;
  remediatedContent: string;
  diff: string;
  description: string;
  framework: BackendFramework;
}

export interface HealScanOptions {
  projectDir: string;
  failedChecks?: string[];
}

export interface HealScanResult {
  success: boolean;
  framework: BackendFramework;
  projectRoot: string;
  entryFile?: string;
  patches: HealPatch[];
  warnings: string[];
}

export interface HealApplyOptions {
  projectDir: string;
  patchIds?: string[];
  createBackup?: boolean;
}

export interface HealApplyResult {
  success: boolean;
  appliedCount: number;
  appliedPatches: string[];
  backupDir?: string;
  errors?: string[];
}

export interface HealRollbackOptions {
  projectDir: string;
  backupDir: string;
}

export interface HealRollbackResult {
  success: boolean;
  restoredFiles: string[];
  errors?: string[];
}
