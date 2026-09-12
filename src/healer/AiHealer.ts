import http from 'node:http';
import https from 'node:https';
import { AiProviderConfig, BackendFramework } from './types.js';

export interface AiRemediationResult {
  success: boolean;
  content: string;
  description: string;
  error?: string;
}

export class AiHealer {
  /**
   * Checks if an AI provider is reachable or configured
   */
  static async isAvailable(config?: AiProviderConfig): Promise<{ available: boolean; provider?: string }> {
    if (config?.apiKey || config?.endpoint) {
      return { available: true, provider: config.provider };
    }

    if (process.env.ANTHROPIC_API_KEY) return { available: true, provider: 'anthropic' };
    if (process.env.OPENAI_API_KEY) return { available: true, provider: 'openai' };
    if (process.env.GEMINI_API_KEY) return { available: true, provider: 'gemini' };

    // Check if local Ollama instance is active (http://127.0.0.1:11434)
    try {
      const res = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(600) });
      if (res.ok) {
        return { available: true, provider: 'ollama' };
      }
    } catch {}

    return { available: false };
  }

  /**
   * Generates a surgical code remediation using the configured or detected LLM provider
   */
  static async generateRemediation(options: {
    filePath: string;
    originalContent: string;
    framework: BackendFramework;
    failedChecks: string[];
    config?: AiProviderConfig;
  }): Promise<AiRemediationResult> {
    const { filePath, originalContent, framework, failedChecks, config } = options;

    let provider = config?.provider;
    let apiKey = config?.apiKey;
    let endpoint = config?.endpoint;
    let model = config?.model;

    if (!provider) {
      if (process.env.ANTHROPIC_API_KEY) {
        provider = 'anthropic';
        apiKey = process.env.ANTHROPIC_API_KEY;
      } else if (process.env.OPENAI_API_KEY) {
        provider = 'openai';
        apiKey = process.env.OPENAI_API_KEY;
      } else if (process.env.GEMINI_API_KEY) {
        provider = 'gemini';
        apiKey = process.env.GEMINI_API_KEY;
      } else {
        provider = 'ollama';
        endpoint = 'http://127.0.0.1:11434';
      }
    }

    const systemPrompt = `You are FaultMesh Auto-Healer, a specialized automated code remediation agent.
Your objective is to fix network resilience and security vulnerabilities in the provided source code.

Target Framework/Language: ${framework}
File Path: ${filePath}

Identified Vulnerabilities:
${failedChecks.map((c, i) => `${i + 1}. ${c}`).join('\n')}

MANDATORY RULES:
1. Fix all identified vulnerabilities according to standard, safe industry practices for ${framework}.
2. Preserve all existing business routes, endpoints, function signatures, variables, and logic.
3. Do NOT add dummy placeholders, truncation, or comments like "// rest of code remains unchanged". Return the complete, production-ready file.
4. Output ONLY the raw replacement source code inside a single standard markdown code block. Do NOT include any chat or greeting.`;

    const userPrompt = `Here is the current source code of ${filePath}:\n\n\`\`\`\n${originalContent}\n\`\`\`\n\nGenerate the complete, patched source code now.`;

    try {
      let rawText = '';

      if (provider === 'ollama') {
        const ollamaUrl = endpoint || 'http://127.0.0.1:11434';
        const ollamaModel = model || 'deepseek-coder:6.7b';
        const res = await fetch(`${ollamaUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: ollamaModel,
            prompt: `${systemPrompt}\n\n${userPrompt}`,
            stream: false,
          }),
          signal: AbortSignal.timeout(30000),
        });

        if (!res.ok) throw new Error(`Ollama API error (${res.status}): ${await res.text()}`);
        const data: any = await res.json();
        rawText = data.response || '';
      } else if (provider === 'openai' || provider === 'custom') {
        const openAiUrl = endpoint || 'https://api.openai.com/v1/chat/completions';
        const openAiModel = model || 'gpt-4o';
        const res = await fetch(openAiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({
            model: openAiModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.1,
          }),
          signal: AbortSignal.timeout(30000),
        });

        if (!res.ok) throw new Error(`OpenAI API error (${res.status}): ${await res.text()}`);
        const data: any = await res.json();
        rawText = data.choices?.[0]?.message?.content || '';
      } else if (provider === 'anthropic') {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey || '',
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: model || 'claude-3-5-sonnet-20241022',
            max_tokens: 4096,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
            temperature: 0.1,
          }),
          signal: AbortSignal.timeout(30000),
        });

        if (!res.ok) throw new Error(`Anthropic API error (${res.status}): ${await res.text()}`);
        const data: any = await res.json();
        rawText = data.content?.[0]?.text || '';
      } else if (provider === 'gemini') {
        const geminiModel = model || 'gemini-1.5-flash';
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          }),
          signal: AbortSignal.timeout(30000),
        });

        if (!res.ok) throw new Error(`Gemini API error (${res.status}): ${await res.text()}`);
        const data: any = await res.json();
        rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }

      const extracted = this.extractCodeBlock(rawText);
      if (!extracted || extracted.trim().length === 0) {
        return {
          success: false,
          content: originalContent,
          description: 'AI model returned empty or unparseable code',
          error: 'Empty response',
        };
      }

      return {
        success: true,
        content: extracted,
        description: `AI-engineered remediation for ${failedChecks.join(', ')} (${provider})`,
      };
    } catch (err: any) {
      return {
        success: false,
        content: originalContent,
        description: `AI Remediation failed: ${err.message}`,
        error: err.message,
      };
    }
  }

  /**
   * Safely strips enclosing markdown code fences from model outputs
   */
  private static extractCodeBlock(text: string): string {
    const trimmed = text.trim();
    const codeBlockMatch = trimmed.match(/^```(?:[a-zA-Z0-9_-]+)?\r?\n([\s\S]*?)\r?\n```$/);
    if (codeBlockMatch) {
      return codeBlockMatch[1];
    }
    // If multiple blocks or leading text
    const anyBlockMatch = trimmed.match(/```(?:[a-zA-Z0-9_-]+)?\r?\n([\s\S]*?)\r?\n```/);
    if (anyBlockMatch) {
      return anyBlockMatch[1];
    }
    return trimmed;
  }
}
