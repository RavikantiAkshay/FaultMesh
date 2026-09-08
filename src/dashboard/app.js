/**
 * FaultMesh — Minimalist Dashboard Client
 * Plain English, Simple Interactions, Full Response Inspector
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const themeToggle = document.getElementById('themeToggle');
  const testEndpointSelect = document.getElementById('testEndpointSelect');
  const btnSendTestRequest = document.getElementById('btnSendTestRequest');
  const testFeedback = document.getElementById('testFeedback');
  const activeRulesIndicator = document.getElementById('activeRulesIndicator');

  // Response Inspector Elements
  const responseInspector = document.getElementById('responseInspector');
  const respStatusBadge = document.getElementById('respStatusBadge');
  const respDuration = document.getElementById('respDuration');
  const respAppliedRule = document.getElementById('respAppliedRule');
  const responseBodyViewer = document.getElementById('responseBodyViewer');
  const btnCloseResponse = document.getElementById('btnCloseResponse');

  const btnPresetSlowMobile = document.getElementById('btnPresetSlowMobile');
  const btnPresetDisconnect = document.getElementById('btnPresetDisconnect');
  const btnPresetOutage = document.getElementById('btnPresetOutage');
  const btnPresetCorrupt = document.getElementById('btnPresetCorrupt');
  const btnClearAllRules = document.getElementById('btnClearAllRules');

  const activeRulesList = document.getElementById('activeRulesList');
  const activeRulesCount = document.getElementById('activeRulesCount');

  const ruleTypeSelect = document.getElementById('ruleTypeSelect');
  const ruleDirectionSelect = document.getElementById('ruleDirectionSelect');
  const dynamicRuleInputs = document.getElementById('dynamicRuleInputs');
  const customRuleForm = document.getElementById('customRuleForm');

  const tabResilience = document.getElementById('tabResilience');
  const tabSecurity = document.getElementById('tabSecurity');
  const tabStorm = document.getElementById('tabStorm');
  const diagHeaderTitle = document.getElementById('diagHeaderTitle');
  const diagHeaderSubtitle = document.getElementById('diagHeaderSubtitle');
  const testTargetProfile = document.getElementById('testTargetProfile');
  const btnRunDiagnostics = document.getElementById('btnRunDiagnostics');
  const scoreValue = document.getElementById('scoreValue');
  const scoreGrade = document.getElementById('scoreGrade');
  const scoreTitle = document.getElementById('scoreTitle');
  const scoreSubtitle = document.getElementById('scoreSubtitle');
  const diagnosticsResults = document.getElementById('diagnosticsResults');

  const activityFeed = document.getElementById('activityFeed');
  const btnClearLog = document.getElementById('btnClearLog');

  let activeRules = [];
  let isRunningDiagnostics = false;
  let currentDiagMode = 'resilience';

  // 1. Theme Management (Clean Light / Neutral Dark)
  function initTheme() {
    const saved = localStorage.getItem('faultmesh_theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
  }

  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('faultmesh_theme', next);
  });
  initTheme();

  // 2. Response Inspector Panel
  if (btnCloseResponse) {
    btnCloseResponse.addEventListener('click', () => {
      if (respStatusBadge) {
        respStatusBadge.textContent = 'Ready';
        respStatusBadge.className = 'status-pill';
      }
      if (respDuration) respDuration.textContent = '-- ms';
      if (respAppliedRule) respAppliedRule.textContent = 'Rule: None';
      if (testFeedback) {
        testFeedback.textContent = 'Click "Send Test Request" or enable any scenario on the left to inspect responses.';
        testFeedback.style.color = 'var(--text-muted)';
      }
      if (responseBodyViewer) {
        responseBodyViewer.textContent = '(No response received yet. Select an endpoint above or click "Enable & Test" on any scenario on the left.)';
      }
    });
  }

  function displayResponse(status, statusText, durationMs, appliedRules, bodyText, isError = false) {
    if (!responseInspector) return;

    respStatusBadge.textContent = status ? `HTTP ${status} ${statusText || ''}` : 'Connection Severed';
    respStatusBadge.className = 'status-pill ' + (isError || status >= 500 ? 'code-5xx' : (status >= 400 ? 'code-4xx' : 'code-2xx'));
    respDuration.textContent = `${durationMs}ms`;

    const ruleNames = appliedRules && appliedRules.length > 0 ? appliedRules.join(', ') : 'None (Normal Traffic)';
    respAppliedRule.textContent = `Applied: ${ruleNames}`;

    // Format body as formatted JSON if possible
    try {
      const parsed = JSON.parse(bodyText);
      responseBodyViewer.textContent = JSON.stringify(parsed, null, 2);
    } catch {
      responseBodyViewer.textContent = bodyText || '(Empty Response Body)';
    }
  }

  // 3. Dynamic Input Fields for Custom Rules
  function renderDynamicInputs() {
    const type = ruleTypeSelect.value;
    let html = '';

    switch (type) {
      case 'latency':
        html = `
          <div class="form-row">
            <div class="form-field">
              <label>Delay (ms)</label>
              <input type="number" id="inputDelayMs" class="form-input" value="300" min="0" max="60000" step="10" required>
            </div>
            <div class="form-field">
              <label>Random Variation (&plusmn; ms)</label>
              <input type="number" id="inputVarianceMs" class="form-input" value="50" min="0" max="10000" step="10">
            </div>
          </div>
        `;
        break;
      case 'bandwidth':
        html = `
          <div class="form-field">
            <label>Speed Limit (kbps) — 16 kbps is ~2 KB/s</label>
            <input type="number" id="inputSpeedKbps" class="form-input" value="16" min="1" max="50000" step="1" required>
          </div>
        `;
        break;
      case 'cut':
        html = `
          <div class="form-field">
            <label>Drop Connection After (Bytes)</label>
            <input type="number" id="inputCutBytes" class="form-input" value="30" min="1" max="100000" step="1" required>
          </div>
        `;
        break;
      case 'corrupt':
        html = `
          <div class="form-row">
            <div class="form-field">
              <label>Corruption Type</label>
              <select id="inputCorruptMethod" class="form-input">
                <option value="truncate">Cut Ending (Truncated JSON)</option>
                <option value="bitflip">Null-Byte Replacement</option>
                <option value="garbage">Inject Noise Characters</option>
              </select>
            </div>
            <div class="form-field">
              <label>Chance</label>
              <select id="inputCorruptFrequency" class="form-input">
                <option value="1.0">100% of responses</option>
                <option value="0.5">50% of responses</option>
              </select>
            </div>
          </div>
        `;
        break;
      case 'status':
        html = `
          <div class="form-row">
            <div class="form-field">
              <label>HTTP Status Code</label>
              <select id="inputStatusCode" class="form-input">
                <option value="503">503 Service Unavailable</option>
                <option value="500">500 Internal Server Error</option>
                <option value="502">502 Bad Gateway</option>
                <option value="429">429 Too Many Requests</option>
                <option value="504">504 Gateway Timeout</option>
              </select>
            </div>
            <div class="form-field">
              <label>Status Message (Optional)</label>
              <input type="text" id="inputStatusText" class="form-input" placeholder="e.g. Service Unavailable">
            </div>
          </div>
        `;
        break;
    }
    dynamicRuleInputs.innerHTML = html;
  }

  ruleTypeSelect.addEventListener('change', renderDynamicInputs);
  renderDynamicInputs();

  // 4. Status Polling & Active Rules Rendering
  async function refreshStatus() {
    try {
      const res = await fetch('/_faultmesh/status');
      const data = await res.json();
      renderActiveRules(data.activeRules || data.activeToxics || []);
    } catch (err) {
      console.warn('Status fetch error:', err);
    }
  }

  function renderActiveRules(rules) {
    activeRules = rules || [];
    activeRulesCount.textContent = `${activeRules.length} active`;

    if (activeRulesIndicator) {
      if (activeRules.length === 0) {
        activeRulesIndicator.textContent = 'Traffic: Normal';
        activeRulesIndicator.className = 'active-rules-pill';
      } else {
        const names = activeRules.map(r => r.name).join(', ');
        activeRulesIndicator.textContent = `Simulating: ${names}`;
        activeRulesIndicator.className = 'active-rules-pill active';
      }
    }

    if (activeRules.length === 0) {
      activeRulesList.innerHTML = '<div class="empty-state">No rules active. All traffic passes through normally.</div>';
      return;
    }

    activeRulesList.innerHTML = activeRules.map(r => `
      <div class="rule-item">
        <div>
          <div class="rule-title">${escapeHtml(r.name)}</div>
          <div class="rule-subtitle">${formatRuleDetail(r)}</div>
        </div>
        <div style="display: flex; gap: 6px; align-items: center;">
          <button class="btn-secondary btn-sm" onclick="testActiveRule()" title="Send test request through proxy">Test Rule</button>
          <button class="btn-remove btn-sm" onclick="deleteRule('${r.id}')">Remove</button>
        </div>
      </div>
    `).join('');
  }

  function formatRuleDetail(r) {
    const c = r.config || {};
    const dir = r.direction === 'downstream' ? 'Responses' : 'Requests';
    switch (r.type) {
      case 'latency': return `${dir} delayed +${c.latencyMs}ms (${c.jitterMs ? `±${c.jitterMs}ms` : 'fixed'})`;
      case 'bandwidth': return `${dir} capped at ${c.rateKbps} kbps`;
      case 'cut': return `Socket dropped after ${c.cutAfterBytes} bytes`;
      case 'corrupt': return `Corrupted response (${c.corruptType || 'truncate'})`;
      case 'status': return `Returning HTTP ${c.statusCode}`;
      default: return JSON.stringify(c);
    }
  }

  window.deleteRule = async function(id) {
    try {
      await fetch(`/_faultmesh/rules/${id}`, { method: 'DELETE' });
      refreshStatus();
    } catch (err) {
      console.error('Delete rule error:', err);
    }
  };

  btnClearAllRules.addEventListener('click', async () => {
    try {
      await fetch('/_faultmesh/rules', { method: 'DELETE' });
      await refreshStatus();
      executeTestRequest();
    } catch (err) {
      console.error('Clear rules error:', err);
    }
  });

  // 5. Custom Rule Form Submit
  customRuleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = ruleTypeSelect.value;
    const direction = ruleDirectionSelect.value;
    const id = `rule_${type}_${Date.now()}`;
    let name = '';
    let config = {};

    switch (type) {
      case 'latency':
        const latencyMs = Number(document.getElementById('inputDelayMs').value);
        const jitterMs = Number(document.getElementById('inputVarianceMs').value || 0);
        name = `Delay (+${latencyMs}ms)`;
        config = { latencyMs, jitterMs };
        break;
      case 'bandwidth':
        const rateKbps = Number(document.getElementById('inputSpeedKbps').value);
        name = `Speed Cap (${rateKbps} kbps)`;
        config = { rateKbps };
        break;
      case 'cut':
        const cutAfterBytes = Number(document.getElementById('inputCutBytes').value);
        name = `Drop Socket (@ ${cutAfterBytes}B)`;
        config = { cutAfterBytes };
        break;
      case 'corrupt':
        const corruptType = document.getElementById('inputCorruptMethod').value;
        const corruptProbability = Number(document.getElementById('inputCorruptFrequency').value);
        name = `Corrupt Data (${corruptType})`;
        config = { corruptType, corruptProbability };
        break;
      case 'status':
        const statusCode = Number(document.getElementById('inputStatusCode').value);
        const statusMessage = document.getElementById('inputStatusText').value || undefined;
        name = `HTTP ${statusCode}`;
        config = { statusCode, statusMessage };
        break;
    }

    try {
      await fetch('/_faultmesh/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, type, direction, enabled: true, config }),
      });
      await refreshStatus();
      executeTestRequest();
    } catch (err) {
      console.error('Add rule error:', err);
    }
  });

  // 6. Direct Test Request Execution
  async function executeTestRequest(endpointOverride) {
    btnSendTestRequest.disabled = true;
    const endpoint = endpointOverride || (testEndpointSelect ? testEndpointSelect.value : '/api/data');
    testFeedback.textContent = `Sending ${endpoint} through http://localhost:3001...`;
    testFeedback.style.color = 'var(--text-muted)';

    const start = Date.now();
    try {
      const res = await fetch(`http://localhost:3001${endpoint}`);
      const duration = Date.now() - start;
      const text = await res.text();

      const activeNames = activeRules.map(r => r.name);

      if (res.ok) {
        testFeedback.textContent = `HTTP ${res.status} OK (${duration}ms)`;
        testFeedback.style.color = 'var(--tag-green-fg)';
        displayResponse(res.status, res.statusText, duration, activeNames, text, false);
      } else {
        testFeedback.textContent = `HTTP ${res.status} Error (${duration}ms)`;
        testFeedback.style.color = 'var(--tag-red-fg)';
        displayResponse(res.status, res.statusText, duration, activeNames, text, true);
      }
    } catch (err) {
      const duration = Date.now() - start;
      testFeedback.textContent = `Connection dropped or failed (${duration}ms): ${err.message}`;
      testFeedback.style.color = 'var(--tag-red-fg)';
      displayResponse(0, 'Socket Dropped', duration, activeRules.map(r => r.name), `Network Error: ${err.message}\n\nConnection was abruptly severed or timed out by the FaultMesh proxy rule.`, true);
    } finally {
      btnSendTestRequest.disabled = false;
      refreshStatus();
    }
  }

  btnSendTestRequest.addEventListener('click', () => executeTestRequest());
  window.testActiveRule = function() {
    executeTestRequest();
  };

  // 7. Presets (Enable & Immediately Test)
  btnPresetSlowMobile.addEventListener('click', async () => {
    await fetch('/_faultmesh/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: `preset_bw_${Date.now()}`,
        name: 'Slow Mobile Internet (16 kbps limit)',
        type: 'bandwidth',
        direction: 'downstream',
        enabled: true,
        config: { rateKbps: 16 },
      }),
    });
    await fetch('/_faultmesh/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: `preset_lat_${Date.now()}`,
        name: 'Mobile Delay (350ms)',
        type: 'latency',
        direction: 'downstream',
        enabled: true,
        config: { latencyMs: 350, jitterMs: 50 },
      }),
    });
    await refreshStatus();
    executeTestRequest();
  });

  btnPresetDisconnect.addEventListener('click', async () => {
    await fetch('/_faultmesh/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: `preset_cut_${Date.now()}`,
        name: 'Connection Drop (after 30 bytes)',
        type: 'cut',
        direction: 'downstream',
        enabled: true,
        config: { cutAfterBytes: 30 },
      }),
    });
    await refreshStatus();
    executeTestRequest();
  });

  btnPresetOutage.addEventListener('click', async () => {
    await fetch('/_faultmesh/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: `preset_503_${Date.now()}`,
        name: 'Server Outage (HTTP 503)',
        type: 'status',
        direction: 'downstream',
        enabled: true,
        config: { statusCode: 503, statusMessage: 'Service Unavailable' },
      }),
    });
    await refreshStatus();
    executeTestRequest();
  });

  btnPresetCorrupt.addEventListener('click', async () => {
    await fetch('/_faultmesh/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: `preset_corrupt_${Date.now()}`,
        name: 'Corrupted Response (Truncated JSON)',
        type: 'corrupt',
        direction: 'downstream',
        enabled: true,
        config: { corruptType: 'truncate', corruptProbability: 1.0 },
      }),
    });
    await refreshStatus();
    executeTestRequest();
  });

  // 8. Diagnostics & Security Audit Suite Definitions
  const RESILIENCE_CHECKS = [
    {
      num: '01',
      name: 'Response Delay Handling (300ms)',
      category: 'Latency',
      description: 'Checks whether the client handles delayed network responses without freezing UI threads or aborting prematurely.',
      probe: 'Injects 250ms latency + 50ms jitter into downstream HTTP traffic.'
    },
    {
      num: '02',
      name: 'Slow Connection Throughput (16 kbps)',
      category: 'Bandwidth',
      description: 'Simulates low-speed mobile connections (~2 KB/s) to evaluate streaming chunk buffering and prevent payload buffer overflows.',
      probe: 'Downstream token-bucket rate limiting at 16 kbps.'
    },
    {
      num: '03',
      name: 'Abrupt Disconnection Mid-Transfer',
      category: 'Connection',
      description: 'Tests if connection drops while receiving data are caught cleanly without unhandled socket reset exceptions (ECONNRESET).',
      probe: 'Abruptly severs downstream TCP socket after 15 bytes transferred.'
    },
    {
      num: '04',
      name: 'Malformed JSON Handling',
      category: 'Integrity',
      description: 'Checks whether the application safely detects broken, truncated, or malformed JSON payloads without uncaught parser crashes.',
      probe: 'Simulates mid-string payload truncation of response bodies.'
    },
    {
      num: '05',
      name: 'HTTP 503 Service Outage Recovery',
      category: 'Availability',
      description: 'Tests if the application properly receives, traps, and gracefully responds to temporary upstream server downtime.',
      probe: 'Forces proxy to return HTTP 503 Service Unavailable.'
    }
  ];

  const SECURITY_CHECKS = [
    {
      num: '01',
      name: 'Defensive Security Headers',
      category: 'Protocol',
      severity: 'high',
      description: 'Checks for essential defensive response headers: nosniff (MIME sniffing defense), X-Frame-Options (clickjacking defense), and HSTS.',
      probe: 'Passive HTTP response header inspection against API endpoints.'
    },
    {
      num: '02',
      name: 'CORS & Origin Validation',
      category: 'Access Control',
      severity: 'critical',
      description: 'Checks whether Access-Control-Allow-Origin wildcard (*) is combined with credentials or blindly reflects untrusted third-party origins.',
      probe: 'Probes preflight headers with untrusted third-party Origin header.'
    },
    {
      num: '03',
      name: 'URL Credential & Secret Exposure',
      category: 'Data Leakage',
      severity: 'critical',
      description: 'Checks whether authentication tokens, keys, or passwords are passed in GET query strings (?token=...) where they get permanently stored in proxy and server access logs.',
      probe: 'Inspects query parameter ingestion and log isolation.'
    },
    {
      num: '04',
      name: 'Outbound Response PII & Secret Scanner',
      category: 'Data Leakage',
      severity: 'critical',
      description: 'Scans outbound JSON response bodies for leaked internal credentials, private keys, AWS tokens, or bcrypt password hashes.',
      probe: 'Outbound response payload entropy and secret regex scanner.'
    },
    {
      num: '05',
      name: 'Error Sanitization & Stack Trace Exposure',
      category: 'Info Disclosure',
      severity: 'medium',
      description: 'Checks whether 5xx runtime errors return sanitized JSON rather than exposing internal database errors, file paths, or language stack traces.',
      probe: 'Inspects error response bodies for unhandled exception traces.'
    },
    {
      num: '06',
      name: 'Path Traversal & Directory Escape (../)',
      category: 'File Security',
      severity: 'critical',
      description: 'Probes file and path parameters with directory escape sequences (../../etc/passwd) to verify strict path isolation and sanitization.',
      probe: 'Path traversal canary probe verifying clean rejection with HTTP 400.'
    },
    {
      num: '07',
      name: 'Safe SQL/NoSQL & Canary Input Probing',
      category: 'Injection Defense',
      severity: 'critical',
      description: 'Probes input fields using harmless syntax markers (\' OR \'1\'=\'1) and non-executable canary tags (<faultmesh-canary-test>) to verify parameterization with 0 database mutation.',
      probe: 'Zero-damage canary probe verifying parameter escaping and schema validation.'
    }
  ];

  const TRAFFIC_STORM_CHECKS = [
    {
      num: '01',
      name: 'Rate Limit Back-off & Retry Storm Handling',
      category: 'Rate Limit',
      severity: 'high',
      description: 'Tests if client respects HTTP 429 Retry-After headers with exponential backoff rather than causing self-inflicted retry stampedes.',
      probe: 'Simulates HTTP 429 response with Retry-After: 2 and observes client retry cadence.'
    },
    {
      num: '02',
      name: 'Oversized Payload & Buffer OOM Defense (HTTP 413)',
      category: 'DoS Defense',
      severity: 'critical',
      description: 'Evaluates if the server rejects oversized request payloads early (HTTP 413) without buffering entire streams into RAM to avoid out-of-memory crashes.',
      probe: 'Streams a chunked payload exceeding the max limit to verify early termination.'
    },
    {
      num: '03',
      name: 'Slowloris Connection Drip Defense',
      category: 'Connection Timeout',
      severity: 'critical',
      description: 'Tests if the server enforces socket read timeouts when requests drip bytes at a very slow rate, preventing socket descriptor exhaustion.',
      probe: 'Drips request bytes at a controlled slow interval to verify read timeout enforcement.'
    },
    {
      num: '04',
      name: 'Duplicate Request Idempotency Protection',
      category: 'Idempotency',
      severity: 'critical',
      description: 'Verifies that concurrent duplicate POST requests sharing an Idempotency-Key are deduplicated to prevent double-billing and duplicate records.',
      probe: 'Dispatches concurrent POST requests with duplicate Idempotency-Key headers.'
    }
  ];

  function renderPreflightChecklist(mode) {
    let list = RESILIENCE_CHECKS;
    if (mode === 'security') list = SECURITY_CHECKS;
    else if (mode === 'storm') list = TRAFFIC_STORM_CHECKS;

    const countTag = document.getElementById('checklistCountTag');
    if (countTag) {
      countTag.textContent = `${list.length} checks ready`;
    }

    diagnosticsResults.innerHTML = list.map(c => `
      <div class="test-row">
        <div class="test-row-main">
          <span class="test-num">${c.num}</span>
          <div class="test-content-col">
            <div class="test-name-group">
              <span class="test-name">${escapeHtml(c.name)}</span>
              <span class="category-pill">${escapeHtml(c.category)}</span>
              ${c.severity ? `<span class="severity-pill severity-${c.severity}">${c.severity}</span>` : ''}
            </div>
            <div class="test-desc">${escapeHtml(c.description)}</div>
            <div class="test-probe-method">Probe Method: ${escapeHtml(c.probe)}</div>
          </div>
        </div>
        <div class="test-row-aside">
          <span class="status-ready">READY</span>
        </div>
      </div>
    `).join('');
  }

  function setDiagMode(mode) {
    currentDiagMode = mode;
    if (tabResilience) tabResilience.classList.remove('active');
    if (tabSecurity) tabSecurity.classList.remove('active');
    if (tabStorm) tabStorm.classList.remove('active');

    if (mode === 'storm') {
      if (tabStorm) tabStorm.classList.add('active');
      if (diagHeaderTitle) diagHeaderTitle.textContent = 'Traffic Storms & DoS Defense Suite';
      if (diagHeaderSubtitle) diagHeaderSubtitle.textContent = 'Evaluates rate limit backoff (429), oversized payload protection (413), slowloris drips, and idempotency deduplication.';
      if (testTargetProfile) {
        testTargetProfile.innerHTML = `
          <option value="resilient">Target: Resilient System (Grade A)</option>
          <option value="fragile">Target: Fragile System (Grade F)</option>
        `;
      }
      if (btnRunDiagnostics) btnRunDiagnostics.textContent = 'Run Traffic Storm Benchmark';
      scoreTitle.textContent = 'Ready for Traffic Storms & DoS evaluation';
      scoreSubtitle.textContent = 'Click "Run Traffic Storm Benchmark" to test rate limit backoff, slowloris defense, and idempotency.';
    } else if (mode === 'security') {
      if (tabSecurity) tabSecurity.classList.add('active');
      if (diagHeaderTitle) diagHeaderTitle.textContent = 'Security & Protocol Audit';
      if (diagHeaderSubtitle) diagHeaderSubtitle.textContent = 'Non-destructive 7-point audit evaluating defensive headers, CORS, URL tokens, response PII, path traversal, and canary injection.';
      if (testTargetProfile) {
        testTargetProfile.innerHTML = `
          <option value="secure">Target: Secure API (Grade A)</option>
          <option value="vulnerable">Target: Vulnerable API (Grade F)</option>
        `;
      }
      if (btnRunDiagnostics) btnRunDiagnostics.textContent = 'Run Security Audit';
      scoreTitle.textContent = 'Ready to audit security';
      scoreSubtitle.textContent = 'Click "Run Security Audit" to evaluate all 7 defensive security, CORS, PII, and injection probes.';
    } else {
      if (tabResilience) tabResilience.classList.add('active');
      if (diagHeaderTitle) diagHeaderTitle.textContent = 'Automated API Resilience Benchmark';
      if (diagHeaderSubtitle) diagHeaderSubtitle.textContent = 'Automated 5-point test suite evaluating client resilience against network delay, throttling, cuts, corruptions, and 503 outages.';
      if (testTargetProfile) {
        testTargetProfile.innerHTML = `
          <option value="resilient">Target: Resilient App (Grade A)</option>
          <option value="fragile">Target: Fragile App (Grade F)</option>
        `;
      }
      if (btnRunDiagnostics) btnRunDiagnostics.textContent = 'Run 5-Point Benchmark';
      scoreTitle.textContent = 'Ready to evaluate resilience';
      scoreSubtitle.textContent = 'Click "Run 5-Point Benchmark" to evaluate client resilience against 5 real failure cases.';
    }
    scoreValue.textContent = '--';
    scoreGrade.textContent = 'UNTESTED';
    renderPreflightChecklist(mode);
  }

  if (tabResilience) tabResilience.addEventListener('click', () => setDiagMode('resilience'));
  if (tabSecurity) tabSecurity.addEventListener('click', () => setDiagMode('security'));
  if (tabStorm) tabStorm.addEventListener('click', () => setDiagMode('storm'));

  if (testTargetProfile) {
    testTargetProfile.addEventListener('change', () => {
      scoreValue.textContent = '--';
      scoreGrade.textContent = 'UNTESTED';
      const label = testTargetProfile.options[testTargetProfile.selectedIndex]?.text || '';
      scoreTitle.textContent = 'Target Profile Updated';
      scoreSubtitle.textContent = `Selected: ${label}. Click run to execute benchmark.`;
      renderPreflightChecklist(currentDiagMode);
    });
  }

  btnRunDiagnostics.addEventListener('click', async () => {
    if (isRunningDiagnostics) return;
    isRunningDiagnostics = true;
    btnRunDiagnostics.disabled = true;

    if (currentDiagMode === 'storm') {
      btnRunDiagnostics.textContent = 'Auditing...';
      scoreTitle.textContent = 'Running Traffic Storm Benchmark...';
      scoreSubtitle.textContent = 'Auditing HTTP 429 rate limit backoff, oversized payloads (413), slowloris drips, and duplicate POST idempotency.';

      const profile = testTargetProfile ? testTargetProfile.value : 'resilient';

      try {
        const res = await fetch(`/_faultmesh/storm/run?profile=${encodeURIComponent(profile)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile }),
        });
        const report = await res.json();
        renderTrafficStormReport(report);
        refreshStatus();
      } catch (err) {
        console.error('Traffic storm error:', err);
        scoreTitle.textContent = 'Traffic Storm Audit Failed';
        scoreSubtitle.textContent = err.message;
      } finally {
        isRunningDiagnostics = false;
        btnRunDiagnostics.disabled = false;
        btnRunDiagnostics.textContent = 'Run Traffic Storm Benchmark';
      }
    } else if (currentDiagMode === 'security') {
      btnRunDiagnostics.textContent = 'Auditing...';
      scoreTitle.textContent = 'Running Security Audit...';
      scoreSubtitle.textContent = 'Auditing defensive headers, CORS safety, query secret leakage, response PII, and inert canary probes.';

      const profile = testTargetProfile ? testTargetProfile.value : 'secure';

      try {
        const res = await fetch(`/_faultmesh/security/run?profile=${encodeURIComponent(profile)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile }),
        });
        const report = await res.json();
        renderSecurityReport(report);
        refreshStatus();
      } catch (err) {
        console.error('Security audit error:', err);
        scoreTitle.textContent = 'Security Audit Failed';
        scoreSubtitle.textContent = err.message;
      } finally {
        isRunningDiagnostics = false;
        btnRunDiagnostics.disabled = false;
        btnRunDiagnostics.textContent = 'Run Security Audit';
      }
    } else {
      btnRunDiagnostics.textContent = 'Running...';
      scoreTitle.textContent = 'Running 5-Point Benchmark...';
      scoreSubtitle.textContent = 'Evaluating delay, slow speed, connection drops, corrupted JSON, and 503 errors.';

      const profile = testTargetProfile ? testTargetProfile.value : 'resilient';

      try {
        const res = await fetch(`/_faultmesh/diagnostics/run?profile=${encodeURIComponent(profile)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile }),
        });
        const report = await res.json();
        renderDiagnosticsReport(report);
        refreshStatus();
      } catch (err) {
        console.error('Diagnostics error:', err);
        scoreTitle.textContent = 'Diagnostics Failed';
        scoreSubtitle.textContent = err.message;
      } finally {
        isRunningDiagnostics = false;
        btnRunDiagnostics.disabled = false;
        btnRunDiagnostics.textContent = 'Run 5-Point Benchmark';
      }
    }
  });

  function renderDiagnosticsReport(report) {
    scoreValue.textContent = `${report.score}/100`;
    scoreGrade.textContent = `GRADE ${report.grade}`;

    if (report.grade === 'A') {
      scoreTitle.textContent = 'All 5 Resilience Checks Passed (Grade A)';
    } else if (report.grade === 'B') {
      scoreTitle.textContent = 'Passed with Minor Issues (Grade B)';
    } else {
      scoreTitle.textContent = 'Resilience Failures Detected (Grade ' + report.grade + ')';
    }

    scoreSubtitle.textContent = `Passed ${report.passedAttacks} of ${report.totalAttacks} failure checks.`;

    const countTag = document.getElementById('checklistCountTag');
    if (countTag) {
      countTag.textContent = `${report.passedAttacks}/${report.totalAttacks} passed`;
    }

    diagnosticsResults.innerHTML = report.results.map((r, idx) => {
      const checkMeta = RESILIENCE_CHECKS[idx] || {};
      const num = String(idx + 1).padStart(2, '0');
      const rowClass = r.passed ? 'row-passed' : 'row-failed';
      const findingClass = r.passed ? 'finding-pass' : 'finding-fail';

      return `
        <div class="test-row ${rowClass}">
          <div class="test-row-main">
            <span class="test-num">${num}</span>
            <div class="test-content-col">
              <div class="test-name-group">
                <span class="test-name">${escapeHtml(r.name)}</span>
                ${checkMeta.category ? `<span class="category-pill">${escapeHtml(checkMeta.category)}</span>` : ''}
              </div>
              <div class="test-desc">${escapeHtml(r.description)}</div>
              <div class="test-finding-box ${findingClass}">
                Finding: ${escapeHtml(r.details)}
              </div>
            </div>
          </div>
          <div class="test-row-aside">
            <span class="test-tag ${r.passed ? 'tag-pass' : 'tag-fail'}">
              ${r.passed ? 'PASSED' : 'FAILED'}
            </span>
            <span style="font-family:var(--font-mono); font-size:11px; color:var(--text-muted);">${r.latencyMs}ms</span>
          </div>
        </div>
      `;
    }).join('') + `
      <div class="advice-list">
        <strong>Resilience Recommendations:</strong>
        <ul>
          ${report.recommendations.map(rec => `<li>${escapeHtml(rec)}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  function renderSecurityReport(report) {
    scoreValue.textContent = `${report.score}/100`;
    scoreGrade.textContent = `GRADE ${report.grade}`;

    if (report.grade === 'A') {
      scoreTitle.textContent = 'All 7 Security Checks Passed (Grade A)';
    } else if (report.grade === 'B') {
      scoreTitle.textContent = 'Minor Security Issues Detected (Grade B)';
    } else {
      scoreTitle.textContent = 'Security Vulnerabilities Detected (Grade ' + report.grade + ')';
    }

    scoreSubtitle.textContent = `Passed ${report.passedChecks} of ${report.totalChecks} security checks.`;

    const countTag = document.getElementById('checklistCountTag');
    if (countTag) {
      countTag.textContent = `${report.passedChecks}/${report.totalChecks} passed`;
    }

    diagnosticsResults.innerHTML = report.checks.map((c, idx) => {
      const num = String(idx + 1).padStart(2, '0');
      const rowClass = c.passed ? 'row-passed' : 'row-failed';
      const findingClass = c.passed ? 'finding-pass' : 'finding-fail';

      return `
        <div class="test-row ${rowClass}">
          <div class="test-row-main">
            <span class="test-num">${num}</span>
            <div class="test-content-col">
              <div class="test-name-group">
                <span class="test-name">${escapeHtml(c.name)}</span>
                <span class="category-pill">${escapeHtml(c.category)}</span>
                <span class="severity-pill severity-${c.severity}">${c.severity}</span>
              </div>
              <div class="test-desc">${escapeHtml(c.description)}</div>
              <div class="test-finding-box ${findingClass}">
                Finding: ${escapeHtml(c.details)}
              </div>
            </div>
          </div>
          <div class="test-row-aside">
            <span class="test-tag ${c.passed ? 'tag-pass' : 'tag-fail'}">
              ${c.passed ? 'PASSED' : 'FAILED'}
            </span>
            <span style="font-family:var(--font-mono); font-size:11px; color:var(--text-muted);">${c.latencyMs}ms</span>
          </div>
        </div>
      `;
    }).join('') + `
      <div class="advice-list">
        <strong>Remediation Recommendations:</strong>
        <ul>
          ${report.recommendations.map(rec => `<li>${escapeHtml(rec)}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  function renderTrafficStormReport(report) {
    scoreValue.textContent = `${report.score}/100`;
    scoreGrade.textContent = `GRADE ${report.grade}`;

    if (report.grade === 'A') {
      scoreTitle.textContent = 'All 4 Traffic Storm Checks Passed (Grade A)';
    } else if (report.grade === 'B') {
      scoreTitle.textContent = 'Passed with Minor Issues (Grade B)';
    } else {
      scoreTitle.textContent = 'Traffic Storm & DoS Failures Detected (Grade ' + report.grade + ')';
    }

    scoreSubtitle.textContent = `Passed ${report.passedChecks} of ${report.totalChecks} storm and DoS defense checks.`;

    const countTag = document.getElementById('checklistCountTag');
    if (countTag) {
      countTag.textContent = `${report.passedChecks}/${report.totalChecks} passed`;
    }

    diagnosticsResults.innerHTML = report.checks.map((c, idx) => {
      const num = String(idx + 1).padStart(2, '0');
      const rowClass = c.passed ? 'row-passed' : 'row-failed';
      const findingClass = c.passed ? 'finding-pass' : 'finding-fail';

      return `
        <div class="test-row ${rowClass}">
          <div class="test-row-main">
            <span class="test-num">${num}</span>
            <div class="test-content-col">
              <div class="test-name-group">
                <span class="test-name">${escapeHtml(c.name)}</span>
                <span class="category-pill">${escapeHtml(c.category)}</span>
                <span class="severity-pill severity-${c.severity}">${c.severity}</span>
              </div>
              <div class="test-desc">${escapeHtml(c.description)}</div>
              <div class="test-finding-box ${findingClass}">
                Finding: ${escapeHtml(c.details)}
              </div>
            </div>
          </div>
          <div class="test-row-aside">
            <span class="test-tag ${c.passed ? 'tag-pass' : 'tag-fail'}">
              ${c.passed ? 'PASSED' : 'FAILED'}
            </span>
            <span style="font-family:var(--font-mono); font-size:11px; color:var(--text-muted);">${c.latencyMs}ms</span>
          </div>
        </div>
      `;
    }).join('') + `
      <div class="advice-list">
        <strong>Traffic Storm & DoS Recommendations:</strong>
        <ul>
          ${report.recommendations.map(rec => `<li>${escapeHtml(rec)}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  // 9. Live Request SSE Stream
  function setupSSE() {
    const eventSource = new EventSource('/_faultmesh/telemetry/stream');

    eventSource.addEventListener('snapshot', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.events && data.events.length > 0) {
          activityFeed.innerHTML = '';
          data.events.forEach(addLogRow);
        }
      } catch (err) {
        console.warn('Snapshot parse error', err);
      }
    });

    eventSource.addEventListener('telemetry', (e) => {
      try {
        const event = JSON.parse(e.data);
        addLogRow(event);
        refreshStatus();
      } catch (err) {
        console.warn('Telemetry parse error', err);
      }
    });
  }

  function addLogRow(ev) {
    if (activityFeed.querySelector('.table-empty')) {
      activityFeed.innerHTML = '';
    }

    const tr = document.createElement('tr');
    let codeClass = 'code-2xx';
    if (ev.statusCode >= 500) codeClass = 'code-5xx';
    else if (ev.statusCode >= 400) codeClass = 'code-4xx';

    const ruleText = ev.appliedToxics && ev.appliedToxics.length > 0
      ? ev.appliedToxics.join(', ')
      : 'None';

    tr.innerHTML = `
      <td style="font-weight:600;">${ev.method}</td>
      <td>${escapeHtml(ev.path)}</td>
      <td class="${codeClass}">${ev.statusCode}</td>
      <td style="color:var(--text-muted);">${escapeHtml(ruleText)}</td>
      <td style="text-align:right; color:var(--text-muted); font-variant-numeric:tabular-nums;">${ev.durationMs}ms</td>
    `;

    activityFeed.prepend(tr);
    while (activityFeed.children.length > 30) {
      activityFeed.removeChild(activityFeed.lastChild);
    }
  }

  btnClearLog.addEventListener('click', () => {
    activityFeed.innerHTML = '<tr><td colspan="5" class="table-empty">Log cleared. Listening for requests...</td></tr>';
  });

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
  }

  setDiagMode('resilience');
  refreshStatus();
  setupSSE();
});
