import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 5050;

// Flaw 1: Open Wildcard CORS without origin validation
app.use(cors());

// Flaw 2: Unbounded JSON body parser without strict 1mb limit (Vulnerable to buffer OOM)
app.use(express.json({ limit: '50mb' }));

// Standard API Endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.get('/api/data', (req, res) => {
  res.json({
    service: 'Vulnerable Test Backend',
    version: '1.0.0',
    data: [
      { id: 1, name: 'Item A', active: true },
      { id: 2, name: 'Item B', active: false },
    ],
  });
});

app.get('/api/users', (req, res) => {
  res.json({
    users: [
      { id: 101, username: 'alice', role: 'admin' },
      { id: 102, username: 'bob', role: 'developer' },
    ],
  });
});

app.get('/api/profile', (req, res) => {
  res.json({
    id: 101,
    username: 'demo_user',
    email: 'user@example.com',
    maskedToken: '****-****-****-9821',
  });
});

// Flaw 3: Error handler exposing internal server stack traces
app.get('/api/crash', (req, res, next) => {
  const err = new Error('Database connection pool exhausted: connection failed at postgresql://user:pass@10.0.0.1:5432/prod_db');
  // If centralized error sanitization middleware is registered, forward to it
  if (app._router && app._router.stack && app._router.stack.some(layer => layer.handle && layer.handle.length === 4)) {
    return next(err);
  }
  // Otherwise leaks internal stack traces and server file paths
  res.status(500).json({
    error: err.message,
    stack: err.stack,
    filePath: import.meta.url,
  });
});

// File download probe endpoint
app.get('/api/files', (req, res) => {
  const fileName = req.query.name || 'document.pdf';
  if (fileName.includes('..')) {
    res.status(400).json({ error: 'Directory traversal prohibited' });
    return;
  }
  res.json({ file: fileName, content: 'Sample document payload' });
});

// Idempotent checkout route
app.post('/api/checkout', (req, res) => {
  const key = req.headers['idempotency-key'] || 'default_key';
  res.json({
    status: 'completed',
    transactionId: `tx_${key}`,
    timestamp: Date.now(),
  });
});

// Rate limit test route
app.get('/api/ratelimit-test', (req, res) => {
  res.setHeader('Retry-After', '2');
  res.status(429).json({ error: 'Too Many Requests', retryAfterSeconds: 2 });
});

// Payload check endpoint
app.post('/api/upload-check', (req, res) => {
  res.json({ status: 'accepted', bytesReceived: JSON.stringify(req.body).length });
});

// Flaw 4: Slowloris probe endpoint to evaluate socket timeouts
app.get('/api/slowloris-probe', (req, res) => {
  const isProtected = Boolean(server.headersTimeout && server.headersTimeout <= 10000 && server.requestTimeout && server.requestTimeout <= 15000);
  if (isProtected) {
    res.setHeader('X-Socket-Protection', 'active');
    res.json({ status: 'protected', headersTimeout: server.headersTimeout, requestTimeout: server.requestTimeout });
  } else {
    res.json({ status: 'vulnerable', headersTimeout: server.headersTimeout, requestTimeout: server.requestTimeout });
  }
});

// Launch server without socket timeouts (Vulnerable to slowloris drip until healed)
const server = app.listen(PORT, () => {
  console.log(`[Vulnerable Backend] Running on http://127.0.0.1:${PORT}`);
  console.log(`[Vulnerable Backend] Test in FaultMesh by setting Target API to http://127.0.0.1:${PORT}`);
});
