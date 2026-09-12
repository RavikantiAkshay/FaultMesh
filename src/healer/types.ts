export type BackendFramework =
  | 'express'
  | 'fastify'
  | 'koa'
  | 'nestjs'
  | 'fastapi'
  | 'flask'
  | 'django'
  | 'go-gin'
  | 'go-chi'
  | 'go-nethttp'
  | 'rust-actix'
  | 'rust-axum'
  | 'java-spring'
  | 'csharp-dotnet'
  | 'generic-node'
  | 'generic-python'
  | 'generic-go'
  | 'generic-rust'
  | 'generic-java'
  | 'generic-csharp'
  | 'generic-backend';

export type AiProviderType = 'ollama' | 'openai' | 'anthropic' | 'gemini' | 'custom';

export interface AiProviderConfig {
  provider: AiProviderType;
  endpoint?: string;
  apiKey?: string;
  model?: string;
}

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
  engine?: 'codemod' | 'ai-agent';
}

export interface HealScanOptions {
  projectDir: string;
  failedChecks?: string[];
  aiConfig?: AiProviderConfig;
  engineMode?: 'codemod' | 'ai' | 'hybrid';
}

export interface HealScanResult {
  success: boolean;
  framework: BackendFramework;
  projectRoot: string;
  entryFile?: string;
  patches: HealPatch[];
  warnings: string[];
  engineUsed?: 'codemod' | 'ai-agent' | 'hybrid';
}

export interface HealApplyOptions {
  projectDir: string;
  patchIds?: string[];
  failedChecks?: string[];
  createBackup?: boolean;
  aiConfig?: AiProviderConfig;
  engineMode?: 'codemod' | 'ai' | 'hybrid';
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
