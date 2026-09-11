/**
 * FastAPI / Python Remediation Transformers
 * Injects defensive security and timeout middleware into FastAPI applications.
 */

import { TransformerResult } from './ExpressTransformers.js';

export class FastApiTransformers {
  /**
   * 1. Defensive Headers & Trusted Host Middleware
   */
  static applyDefensiveHeaders(content: string): TransformerResult {
    if (content.includes('TrustedHostMiddleware') || content.includes('X-Content-Type-Options')) {
      return { modified: false, content, description: 'FastAPI security headers already configured' };
    }

    let modifiedContent = content;
    const importStatement = `from starlette.middleware.trustedhost import TrustedHostMiddleware\nfrom starlette.middleware.base import BaseHTTPMiddleware\nfrom starlette.requests import Request\nfrom starlette.responses import Response\n`;
    
    const middlewareClass = `
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response
`;

    // Add imports at top
    modifiedContent = `${importStatement}\n${modifiedContent}`;

    // Find app = FastAPI()
    const appMatch = modifiedContent.match(/([a-zA-Z0-9_$]+)\s*=\s*FastAPI\s*\(/);
    if (appMatch) {
      const appVar = appMatch[1];
      const injection = `\n${middlewareClass}\n${appVar}.add_middleware(SecurityHeadersMiddleware)\n`;
      const appIndex = modifiedContent.indexOf(appMatch[0]);
      const lineEnd = modifiedContent.indexOf('\n', appIndex);
      modifiedContent = modifiedContent.slice(0, lineEnd + 1) + injection + modifiedContent.slice(lineEnd + 1);

      return {
        modified: true,
        content: modifiedContent,
        description: `Injected SecurityHeadersMiddleware into FastAPI app (${appVar})`,
      };
    }

    return { modified: false, content, description: 'Could not find FastAPI app instance' };
  }

  /**
   * 2. Payload Size Limit Middleware (HTTP 413)
   */
  static applyPayloadLimit(content: string): TransformerResult {
    if (content.includes('Payload Too Large') || content.includes('MAX_CONTENT_LENGTH')) {
      return { modified: false, content, description: 'Payload limit already present' };
    }

    let modifiedContent = content;
    const middlewareClass = `
# Enforce 1MB payload size limit
@app.middleware("http")
async def limit_payload_size(request, call_next):
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > 1024 * 1024:
        from starlette.responses import JSONResponse
        return JSONResponse(status_code=413, content={"error": "Payload Too Large", "limitBytes": 1048576})
    return await call_next(request)
`;

    const appMatch = modifiedContent.match(/app\s*=\s*FastAPI\s*\(/);
    if (appMatch) {
      const appIndex = modifiedContent.indexOf(appMatch[0]);
      const lineEnd = modifiedContent.indexOf('\n', appIndex);
      modifiedContent = modifiedContent.slice(0, lineEnd + 1) + middlewareClass + modifiedContent.slice(lineEnd + 1);

      return {
        modified: true,
        content: modifiedContent,
        description: 'Injected request payload size limiter (HTTP 413 on >1MB)',
      };
    }

    return { modified: false, content, description: 'Could not locate app = FastAPI() instance' };
  }

  /**
   * 3. CORS Lock-down
   */
  static applyCorsLockdown(content: string): TransformerResult {
    if (!content.includes('CORSMiddleware')) {
      return { modified: false, content, description: 'CORSMiddleware not in use' };
    }

    let modifiedContent = content;
    let modified = false;

    // Replace allow_origins=["*"] with explicit whitelist
    if (modifiedContent.includes('allow_origins=["*"]') || modifiedContent.includes("allow_origins=['*']")) {
      modifiedContent = modifiedContent.replace(
        /allow_origins=\[['"][*]['"]\]/g,
        'allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"]'
      );
      modified = true;
    }

    return {
      modified,
      content: modifiedContent,
      description: modified ? 'Replaced wildcard CORS with explicit origin whitelist' : 'CORS configuration already restricted',
    };
  }
}
