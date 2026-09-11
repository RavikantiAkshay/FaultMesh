import { execSync } from 'node:child_process';
import process from 'node:process';

// Cleanly free port 5050 if already occupied by a previous run
try {
  if (process.platform === 'win32') {
    const output = execSync('netstat -ano | findstr :5050', { encoding: 'utf8' }).trim();
    if (output) {
      const lines = output.split('\n');
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0' && pid !== String(process.pid)) {
          try {
            execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
          } catch {}
        }
      }
    }
  } else {
    execSync('fuser -k 5050/tcp 2>/dev/null || true', { stdio: 'ignore' });
  }
} catch {
  // Port was not in use
}

// Allow OS socket to fully release before listening
await new Promise((r) => setTimeout(r, 400));

// Run server directly in process
await import('../examples/vulnerable-backend/server.js');
