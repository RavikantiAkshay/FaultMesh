/**
 * Go / Gin & net/http Remediation Transformers
 * Injects defensive middleware and timeout configurations into Go applications.
 */

import { TransformerResult } from './ExpressTransformers.js';

export class GoTransformers {
  /**
   * 1. Defensive Headers (nosniff, frame-options)
   */
  static applyDefensiveHeaders(content: string): TransformerResult {
    if (content.includes('X-Content-Type-Options') || content.includes('nosniff')) {
      return { modified: false, content, description: 'Security headers already present in Go code' };
    }

    let modifiedContent = content;

    // Detect Gin router (e.g. r := gin.Default() or router := gin.New())
    const ginMatch = modifiedContent.match(/([a-zA-Z0-9_]+)\s*:=\s*gin\.(Default|New)\(\)/);
    if (ginMatch) {
      const routerVar = ginMatch[1];
      const middleware = `
\t// Defensive Security Headers Middleware
\t${routerVar}.Use(func(c *gin.Context) {
\t\tc.Header("X-Content-Type-Options", "nosniff")
\t\tc.Header("X-Frame-Options", "DENY")
\t\tc.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
\t\tc.Next()
\t})
`;
      modifiedContent = modifiedContent.replace(ginMatch[0], `${ginMatch[0]}${middleware}`);
      return {
        modified: true,
        content: modifiedContent,
        description: `Injected security headers middleware into Gin router (${routerVar})`,
      };
    }

    return { modified: false, content, description: 'Could not find Gin router instance' };
  }

  /**
   * 2. Request Body Limit (HTTP 413)
   */
  static applyPayloadLimit(content: string): TransformerResult {
    if (content.includes('MaxBytesReader')) {
      return { modified: false, content, description: 'MaxBytesReader payload limit already in use' };
    }

    let modifiedContent = content;
    const ginMatch = modifiedContent.match(/([a-zA-Z0-9_]+)\s*:=\s*gin\.(Default|New)\(\)/);
    if (ginMatch) {
      const routerVar = ginMatch[1];
      const middleware = `
\t// Enforce 1MB payload size limit (HTTP 413 on buffer overflow)
\t${routerVar}.Use(func(c *gin.Context) {
\t\tc.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 1048576)
\t\tc.Next()
\t})
`;
      // Ensure "net/http" is imported
      if (!modifiedContent.includes('"net/http"')) {
        modifiedContent = modifiedContent.replace(/import\s*\(/, 'import (\n\t"net/http"');
      }

      modifiedContent = modifiedContent.replace(ginMatch[0], `${ginMatch[0]}${middleware}`);
      return {
        modified: true,
        content: modifiedContent,
        description: `Configured 1MB request body limit using http.MaxBytesReader on ${routerVar}`,
      };
    }

    return { modified: false, content, description: 'Could not locate Go router instance' };
  }

  /**
   * 3. Slowloris Server Timeouts
   */
  static applyServerTimeouts(content: string): TransformerResult {
    if (content.includes('ReadHeaderTimeout') || content.includes('ReadTimeout')) {
      return { modified: false, content, description: 'Go HTTP server timeouts already configured' };
    }

    let modifiedContent = content;

    // If using r.Run(":8080") or http.ListenAndServe
    const runMatch = modifiedContent.match(/([a-zA-Z0-9_]+)\.Run\(([^)]*)\)/);
    if (runMatch) {
      const routerVar = runMatch[1];
      const addr = runMatch[2] || '":8080"';
      const replacement = `
\tsrv := &http.Server{
\t\tAddr:              ${addr},
\t\tHandler:           ${routerVar},
\t\tReadHeaderTimeout: 5 * time.Second,
\t\tReadTimeout:       10 * time.Second,
\t\tWriteTimeout:      15 * time.Second,
\t}
\tsrv.ListenAndServe()
`;
      // Ensure time and net/http are imported
      if (!modifiedContent.includes('"time"')) {
        modifiedContent = modifiedContent.replace(/import\s*\(/, 'import (\n\t"time"');
      }
      if (!modifiedContent.includes('"net/http"')) {
        modifiedContent = modifiedContent.replace(/import\s*\(/, 'import (\n\t"net/http"');
      }

      modifiedContent = modifiedContent.replace(runMatch[0], replacement.trim());
      return {
        modified: true,
        content: modifiedContent,
        description: 'Replaced unbounded Run() with hardened http.Server enforcing ReadHeaderTimeout and ReadTimeout',
      };
    }

    return { modified: false, content, description: 'Could not locate router.Run() call to configure server timeouts' };
  }
}
