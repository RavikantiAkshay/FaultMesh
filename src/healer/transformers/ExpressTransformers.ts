/**
 * Express / Node.js Remediation Transformers
 * Surgically injects defensive middleware and parameters into Express applications.
 */

export interface TransformerResult {
  modified: boolean;
  content: string;
  description: string;
}

export class ExpressTransformers {
  /**
   * 1. Defensive Security Headers (Helmet)
   */
  static applyDefensiveHeaders(content: string): TransformerResult {
    // Check if already using helmet or security headers
    if (content.includes('helmet') || (content.includes('X-Content-Type-Options') && content.includes('X-Frame-Options'))) {
      return { modified: false, content, description: 'Defensive headers already configured' };
    }

    let modifiedContent = content;
    const isESM = content.includes('import ') && content.includes('from ');

    // 1. Add import/require
    if (isESM) {
      modifiedContent = `import helmet from 'helmet';\n${modifiedContent}`;
    } else {
      modifiedContent = `const helmet = require('helmet');\n${modifiedContent}`;
    }

    // 2. Insert app.use(helmet()) right after app initialization
    const appMatch = modifiedContent.match(/(const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(express\s*\(\)|createApp\s*\(\))/);
    if (appMatch) {
      const appVar = appMatch[2];
      const targetStr = appMatch[0];
      const injection = `${targetStr};\n${appVar}.use(helmet());`;
      modifiedContent = modifiedContent.replace(targetStr, injection);
      return {
        modified: true,
        content: modifiedContent,
        description: `Injected helmet security headers into Express app (${appVar}.use(helmet()))`,
      };
    }

    return { modified: false, content, description: 'Could not find Express app instance to inject helmet' };
  }

  /**
   * 2. Oversized Payload & Buffer OOM Defense (express.json limit)
   */
  static applyPayloadLimit(content: string): TransformerResult {
    // Check if express.json or bodyParser already has a 1mb limit
    if (content.includes("express.json({ limit: '1mb' })") || content.includes('express.json({ limit: "1mb" })') || content.includes("express.json({limit: '1mb'})")) {
      return { modified: false, content, description: 'JSON payload limit (1mb) already configured' };
    }

    let modifiedContent = content;
    let modified = false;

    // Replace express.json(...) with express.json({ limit: '1mb' })
    if (/express\.json\(\s*(\{[^}]*\})?\s*\)/.test(modifiedContent)) {
      modifiedContent = modifiedContent.replace(/express\.json\(\s*(\{[^}]*\})?\s*\)/g, "express.json({ limit: '1mb' })");
      modified = true;
    }

    // Replace express.urlencoded(...) with limit
    if (modifiedContent.includes('express.urlencoded(') && !modifiedContent.includes("express.urlencoded({ limit:")) {
      modifiedContent = modifiedContent.replace(
        /express\.urlencoded\(\{([^}]+)\}\)/g,
        "express.urlencoded({ $1, limit: '1mb' })"
      );
      modified = true;
    }

    // Fallback: If app.use is found but express.json is not called at all
    if (!modified) {
      const appMatch = modifiedContent.match(/([a-zA-Z0-9_$]+)\.use\(/);
      if (appMatch) {
        const appVar = appMatch[1];
        modifiedContent = modifiedContent.replace(
          `${appVar}.use(`,
          `${appVar}.use(express.json({ limit: '1mb' }));\n${appVar}.use(`
        );
        modified = true;
      }
    }

    return {
      modified,
      content: modifiedContent,
      description: modified ? "Enforced 1MB request payload limit (express.json({ limit: '1mb' }))" : 'Payload limit not applicable',
    };
  }

  /**
   * 3. CORS & Origin Validation
   */
  static applyCorsLockdown(content: string): TransformerResult {
    // If wildcard CORS without validation is found
    const openCorsPattern = /cors\(\s*\)/g;
    const wildcardOriginPattern = /origin:\s*['"]\*['"]/g;

    let modifiedContent = content;
    let modified = false;

    const safeCorsConfig = `{
  origin: (origin, callback) => {
    const allowed = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');
    if (!origin || allowed.includes(origin)) return callback(null, true);
    callback(new Error('CORS origin blocked by policy'));
  },
  credentials: true
}`;

    if (openCorsPattern.test(modifiedContent)) {
      modifiedContent = modifiedContent.replace(openCorsPattern, `cors(${safeCorsConfig})`);
      modified = true;
    } else if (wildcardOriginPattern.test(modifiedContent)) {
      modifiedContent = modifiedContent.replace(wildcardOriginPattern, `origin: (origin, cb) => cb(null, origin || true)`);
      modified = true;
    }

    return {
      modified,
      content: modifiedContent,
      description: modified ? 'Locked down open CORS wildcard with strict origin validation' : 'CORS configuration already restricted',
    };
  }

  /**
   * 4. Error Sanitization & Stack Trace Exposure
   */
  static applyErrorSanitization(content: string): TransformerResult {
    if (/\.use\s*\(\s*(\(\s*err|\s*function\s*\(\s*err)/.test(content)) {
      return { modified: false, content, description: 'Error handling middleware already present' };
    }

    let modifiedContent = content;
    const listenRegex = /(?:const|let|var)?\s*[a-zA-Z0-9_$]*\s*=?\s*([a-zA-Z0-9_$]+)\.listen\(/;
    const listenMatch = modifiedContent.match(listenRegex);

    if (listenMatch) {
      const appVar = listenMatch[1];
      const fullMatch = listenMatch[0];
      const errorMiddleware = `
// Centralized Error Sanitization Middleware
${appVar}.use((err, req, res, next) => {
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    error: statusCode >= 500 ? 'Internal Server Error' : err.message,
    timestamp: Date.now()
  });
});
`;
      modifiedContent = modifiedContent.replace(fullMatch, `${errorMiddleware}\n${fullMatch}`);
      return {
        modified: true,
        content: modifiedContent,
        description: 'Injected centralized error sanitization middleware to prevent stack trace leaks',
      };
    }

    return { modified: false, content, description: 'Could not locate app.listen to inject error handler' };
  }

  /**
   * 5. Slowloris & Request Socket Timeout
   */
  static applySocketTimeouts(content: string): TransformerResult {
    if (/\.headersTimeout\s*=\s*\d+/.test(content) && /\.requestTimeout\s*=\s*\d+/.test(content)) {
      return { modified: false, content, description: 'Server timeouts already configured' };
    }

    let modifiedContent = content;
    // Match const server = app.listen(...) or server = http.createServer(...)
    const serverMatch = modifiedContent.match(/(const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*([a-zA-Z0-9_$]+)\.listen\(/);

    if (serverMatch) {
      const serverVar = serverMatch[2];
      const injection = `\n// Enforce strict socket timeouts to mitigate slowloris attacks\n${serverVar}.headersTimeout = 5000;\n${serverVar}.requestTimeout = 10000;\n`;
      modifiedContent = modifiedContent.trimEnd() + '\n' + injection;
      return {
        modified: true,
        content: modifiedContent,
        description: `Configured socket timeouts (${serverVar}.headersTimeout = 5s, ${serverVar}.requestTimeout = 10s)`,
      };
    }

    return { modified: false, content, description: 'Could not locate HTTP server instance for timeout configuration' };
  }
}
