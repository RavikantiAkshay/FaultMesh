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
  const btnPresetJitter = document.getElementById('btnPresetJitter');
  const btnPresetDisconnect = document.getElementById('btnPresetDisconnect');
  const btnPresetRateLimit = document.getElementById('btnPresetRateLimit');
  const btnPresetOutage = document.getElementById('btnPresetOutage');
  const btnPresetGatewayTimeout = document.getElementById('btnPresetGatewayTimeout');
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

  const targetUrlInput = document.getElementById('targetUrlInput');
  const btnSetTargetUrl = document.getElementById('btnSetTargetUrl');
  const exportGroup = document.getElementById('exportGroup');
  const btnExportMd = document.getElementById('btnExportMd');
  const btnExportJson = document.getElementById('btnExportJson');
  const rulePathPattern = document.getElementById('rulePathPattern');

  // Auto-Healer Modal Elements
  const btnOpenHealer = document.getElementById('btnOpenHealer');
  const healerModal = document.getElementById('healerModal');
  const btnCloseHealer = document.getElementById('btnCloseHealer');
  const healerProjectDir = document.getElementById('healerProjectDir');
  const btnHealerScan = document.getElementById('btnHealerScan');
  const healerScanStatus = document.getElementById('healerScanStatus');
  const healerDiffContainer = document.getElementById('healerDiffContainer');
  const healerActionsBar = document.getElementById('healerActionsBar');
  const healerBackupCheck = document.getElementById('healerBackupCheck');
  const btnHealerApply = document.getElementById('btnHealerApply');
  const btnHealerRollback = document.getElementById('btnHealerRollback');
  const btnToggleAiSettings = document.getElementById('btnToggleAiSettings');
  const healerAiSettingsPanel = document.getElementById('healerAiSettingsPanel');
  const healerEngineBadge = document.getElementById('healerEngineBadge');
  const healerEngineMode = document.getElementById('healerEngineMode');
  const healerAiProvider = document.getElementById('healerAiProvider');
  const healerAiKey = document.getElementById('healerAiKey');
  const healerAiEndpoint = document.getElementById('healerAiEndpoint');
  const aiKeyGroup = document.getElementById('aiKeyGroup');
  const aiEndpointGroup = document.getElementById('aiEndpointGroup');

  const activityFeed = document.getElementById('activityFeed');
  const btnClearLog = document.getElementById('btnClearLog');

  let lastHealerScanResult = null;
  let lastBackupDir = null;

  let activeRules = [];
  let isRunningDiagnostics = false;
  let currentDiagMode = 'resilience';
  let lastScorecardData = null;

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

  // Target URL Management
  async function loadTargetUrl() {
    try {
      const res = await fetch('/_faultmesh/config/target');
      const data = await res.json();
      if (data.targetUrl && targetUrlInput) {
        targetUrlInput.value = data.targetUrl;
      }
    } catch (err) {
      console.warn('Failed to load target URL:', err);
    }
  }

  async function syncTargetUrl() {
    if (!targetUrlInput) return;
    const targetUrl = targetUrlInput.value.trim();
    if (!targetUrl) return;
    try {
      await fetch('/_faultmesh/config/target', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl }),
      });
    } catch (err) {
      console.warn('Failed to auto-sync target URL:', err);
    }
  }

  if (btnSetTargetUrl && targetUrlInput) {
    targetUrlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        btnSetTargetUrl.click();
      }
    });

    btnSetTargetUrl.addEventListener('click', async () => {
      const targetUrl = targetUrlInput.value.trim();
      if (!targetUrl) return;
      btnSetTargetUrl.disabled = true;
      btnSetTargetUrl.textContent = 'Updating...';
      try {
        const res = await fetch('/_faultmesh/config/target', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetUrl }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          btnSetTargetUrl.textContent = 'Updated!';
          setTimeout(() => {
            btnSetTargetUrl.textContent = 'Set Target';
            btnSetTargetUrl.disabled = false;
          }, 1500);
        } else {
          alert('Error: ' + (data.details || data.error || 'Failed to update target URL'));
          btnSetTargetUrl.textContent = 'Set Target';
          btnSetTargetUrl.disabled = false;
        }
      } catch (err) {
        alert('Network error: ' + err.message);
        btnSetTargetUrl.textContent = 'Set Target';
        btnSetTargetUrl.disabled = false;
      }
    });
  }

  // 2. Response Inspector Panel
  if (btnCloseResponse) {
    btnCloseResponse.addEventListener('click', () => {
      if (respStatusBadge) {
        respStatusBadge.textContent = 'Ready';
        respStatusBadge.className = 'status-pill';
      }
      if (respDuration) respDuration.textContent = '-- ms';
      if (respAppliedRule) respAppliedRule.textContent = 'None';
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

    if (!appliedRules || appliedRules.length === 0) {
      respAppliedRule.textContent = 'None';
      respAppliedRule.removeAttribute('title');
    } else if (appliedRules.length === 1) {
      respAppliedRule.textContent = appliedRules[0];
      respAppliedRule.title = `Injected: ${appliedRules[0]}`;
    } else {
      respAppliedRule.textContent = `${appliedRules[0]} (+${appliedRules.length - 1} more)`;
      respAppliedRule.title = `Injected Faults:\n${appliedRules.map((r, i) => `${i + 1}. ${r}`).join('\n')}`;
    }

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
        activeRulesIndicator.removeAttribute('title');
      } else if (activeRules.length === 1) {
        activeRulesIndicator.textContent = `Simulating: ${activeRules[0].name}`;
        activeRulesIndicator.className = 'active-rules-pill active';
        activeRulesIndicator.title = `Simulating: ${activeRules[0].name}`;
      } else {
        activeRulesIndicator.textContent = `Simulating: ${activeRules[0].name} (+${activeRules.length - 1} more)`;
        activeRulesIndicator.className = 'active-rules-pill active';
        activeRulesIndicator.title = `Active Simulation Rules:\n${activeRules.map((r, i) => `${i + 1}. ${r.name}`).join('\n')}`;
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
    let detail = '';
    switch (r.type) {
      case 'latency': detail = `${dir} delayed +${c.latencyMs}ms (${c.jitterMs ? `±${c.jitterMs}ms` : 'fixed'})`; break;
      case 'bandwidth': detail = `${dir} capped at ${c.rateKbps} kbps`; break;
      case 'cut': detail = `Socket dropped after ${c.cutAfterBytes} bytes`; break;
      case 'corrupt': detail = `Corrupted response (${c.corruptType || 'truncate'})`; break;
      case 'status': detail = `Returning HTTP ${c.statusCode}`; break;
      default: detail = JSON.stringify(c);
    }
    if (r.pathPattern) {
      detail += ` | Path: ${r.pathPattern}`;
    }
    return detail;
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

    const pathPattern = rulePathPattern ? (rulePathPattern.value.trim() || undefined) : undefined;
    if (pathPattern) {
      name += ` (${pathPattern})`;
    }

    try {
      await fetch('/_faultmesh/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, type, direction, enabled: true, config, pathPattern }),
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
        id: 'preset_slow_mobile_bw',
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
        id: 'preset_slow_mobile_lat',
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

  if (btnPresetJitter) {
    btnPresetJitter.addEventListener('click', async () => {
      await fetch('/_faultmesh/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'preset_jitter_lat',
          name: 'Packet Jitter Spike (400ms ±250ms)',
          type: 'latency',
          direction: 'downstream',
          enabled: true,
          config: { latencyMs: 400, jitterMs: 250 },
        }),
      });
      await refreshStatus();
      executeTestRequest();
    });
  }

  btnPresetDisconnect.addEventListener('click', async () => {
    await fetch('/_faultmesh/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'preset_disconnect_cut',
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

  if (btnPresetRateLimit) {
    btnPresetRateLimit.addEventListener('click', async () => {
      await fetch('/_faultmesh/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'preset_ratelimit_status',
          name: 'Rate Limit Surge (HTTP 429)',
          type: 'status',
          direction: 'downstream',
          enabled: true,
          config: { statusCode: 429, statusMessage: 'Too Many Requests (Rate Limited - Retry After 15s)' },
        }),
      });
      await refreshStatus();
      executeTestRequest();
    });
  }

  btnPresetOutage.addEventListener('click', async () => {
    await fetch('/_faultmesh/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'preset_outage_status',
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

  if (btnPresetGatewayTimeout) {
    btnPresetGatewayTimeout.addEventListener('click', async () => {
      await fetch('/_faultmesh/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'preset_gateway_lat',
          name: 'Upstream Delay (2000ms)',
          type: 'latency',
          direction: 'downstream',
          enabled: true,
          config: { latencyMs: 2000, jitterMs: 0 },
        }),
      });
      await fetch('/_faultmesh/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'preset_gateway_status',
          name: 'Gateway Timeout (HTTP 504)',
          type: 'status',
          direction: 'downstream',
          enabled: true,
          config: { statusCode: 504, statusMessage: 'Gateway Timeout (Upstream Deadlock)' },
        }),
      });
      await refreshStatus();
      executeTestRequest();
    });
  }

  btnPresetCorrupt.addEventListener('click', async () => {
    await fetch('/_faultmesh/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'preset_corrupt_data',
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

  // 8. Diagnostics & Security Audit Suite Definitions (32 Checks Total)
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
    },
    {
      num: '06',
      name: 'Packet Jitter & Latency Variance',
      category: 'Jitter',
      description: 'Injects fluctuating network latency variance (100ms-350ms) to evaluate client jitter buffering and prevent timeout crashes.',
      probe: 'Applies latency with dynamic 70ms jitter variance.'
    },
    {
      num: '07',
      name: 'Half-Open Circuit Breaker Recovery',
      category: 'Resilience',
      description: 'Tests if client circuit breaker automatically recovers after a transient outage lifts without staying permanently latched in failure state.',
      probe: 'Injects a transient 503 outage followed by immediate recovery probe.'
    },
    {
      num: '08',
      name: 'Downstream Socket Starvation & Slow Read',
      category: 'Concurrency',
      description: 'Evaluates if slow downstream readers starve the server worker pool or block concurrent health probe requests.',
      probe: 'Holds slow stream at 8 kbps while concurrently probing /api/health.'
    },
    {
      num: '09',
      name: 'Zombie Connection Leak Probe',
      category: 'Resources',
      description: 'Verifies backend closes downstream descriptors and frees resources cleanly when client connections abort prematurely.',
      probe: 'Dispatches aborted client socket and measures server recovery latency.'
    },
    {
      num: '10',
      name: 'Payload Truncation & Partial Transfer',
      category: 'Integrity',
      description: 'Tests whether clients safely identify incomplete HTTP body streams rather than treating truncated responses as valid.',
      probe: 'Truncates TCP stream after 30 bytes to test stream termination validation.'
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
    },
    {
      num: '08',
      name: 'Host Header Poisoning & Reflection',
      category: 'Headers',
      severity: 'high',
      description: 'Tests if server validates incoming Host and X-Forwarded-Host headers or echoes untrusted attacker domains into redirect URLs.',
      probe: 'Inspects location redirects and response headers under spoofed Host headers.'
    },
    {
      num: '09',
      name: 'Client IP Spoofing & Rate-Limit Bypass',
      category: 'Identity',
      severity: 'medium',
      description: 'Checks whether client IP determination blindly trusts unverified X-Forwarded-For headers to bypass rate limiters or security filters.',
      probe: 'Dispatches forged upstream IP headers to evaluate trusted proxy configuration.'
    },
    {
      num: '10',
      name: 'HTTP Parameter Pollution (HPP)',
      category: 'Parameters',
      severity: 'medium',
      description: 'Tests if server safely handles duplicate query parameters (?id=1&id=2) without array type confusion or unhandled 500 crashes.',
      probe: 'Probes duplicate query parameters across API endpoints.'
    },
    {
      num: '11',
      name: 'Sensitive Cache-Control Verification',
      category: 'Caching',
      severity: 'high',
      description: 'Verifies that endpoints returning authenticated or private user data enforce Cache-Control: no-store to prevent shared proxy and browser cache leaks.',
      probe: 'Inspects Cache-Control and Pragma response directives on user routes.'
    },
    {
      num: '12',
      name: 'Unsigned & Broken Authorization Headers',
      category: 'Auth Safety',
      severity: 'high',
      description: 'Tests if server safely rejects malformed or truncated Authorization headers (HTTP 401/400) without unhandled 500 crashes.',
      probe: 'Submits malformed Bearer tokens to verify graceful rejection.'
    },
    {
      num: '13',
      name: 'Constant-Time Authentication & Timing Attacks',
      category: 'Cryptography',
      severity: 'medium',
      description: 'Tests if credential and token verification exhibits significant latency variations (side-channel timing leaks).',
      probe: 'Measures delta latency across varying token lengths to verify constant-time evaluation.'
    },
    {
      num: '14',
      name: 'Server Metadata & Secret Configuration Exposure',
      category: 'Config Exposure',
      severity: 'critical',
      description: 'Probes for unintentional exposure of sensitive server files such as .env, .git, or unauthenticated internal configuration routes.',
      probe: 'Probes /.env and dotfiles to confirm web server blocks configuration exposure.'
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
    },
    {
      num: '05',
      name: 'ReDoS (Regex Denial of Service) Lockup Probe',
      category: 'Regex Safety',
      severity: 'critical',
      description: 'Probes input fields with catastrophic backtracking pattern inputs to verify regular expressions do not lock up the server CPU event loop.',
      probe: 'Sends nested quantifier string to test regex evaluation bounds.'
    },
    {
      num: '06',
      name: 'Concurrent Race Condition & Double Processing',
      category: 'Concurrency',
      severity: 'critical',
      description: 'Dispatches concurrent parallel requests against transactional endpoints to evaluate atomic locking and double-spend protection.',
      probe: 'Executes parallel burst with identical transaction keys to test lock safety.'
    },
    {
      num: '07',
      name: 'Chunked Request Drip & Slow POST Defense',
      category: 'Body Timeouts',
      severity: 'high',
      description: 'Evaluates server defense against Slow POST drip attacks by checking requestTimeout limits on incomplete body deliveries.',
      probe: 'Probes request body reception bounds with delayed chunk transfer.'
    },
    {
      num: '08',
      name: 'Resource Avalanche & Sudden Concurrency Flood',
      category: 'Queue Saturation',
      severity: 'high',
      description: 'Sends an avalanche burst of parallel requests within a 50ms window to verify connection queuing and sub-second mean response latency.',
      probe: 'Dispatches burst concurrency flood to test queue shedding and keep-alive stability.'
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
    if (exportGroup) exportGroup.style.display = 'none';

    if (mode === 'storm') {
      if (tabStorm) tabStorm.classList.add('active');
      if (diagHeaderTitle) diagHeaderTitle.textContent = 'Traffic Storms & DoS Defense Suite (8 Checks)';
      if (diagHeaderSubtitle) diagHeaderSubtitle.textContent = 'Evaluates rate limit backoff (429), oversized payloads (413), slowloris drips, idempotency, ReDoS lockup, race conditions, and avalanche floods.';
      if (testTargetProfile) {
        testTargetProfile.innerHTML = `
          <option value="resilient">Target: Resilient System (Grade A)</option>
          <option value="fragile">Target: Fragile System (Grade F)</option>
        `;
      }
      if (btnRunDiagnostics) btnRunDiagnostics.textContent = 'Run 8-Point Storm Benchmark';
      scoreTitle.textContent = 'Ready for Traffic Storms & DoS evaluation';
      scoreSubtitle.textContent = 'Click "Run 8-Point Storm Benchmark" to test rate limit backoff, slowloris defense, ReDoS, and concurrency floods.';
    } else if (mode === 'security') {
      if (tabSecurity) tabSecurity.classList.add('active');
      if (diagHeaderTitle) diagHeaderTitle.textContent = 'Security & Protocol Audit (14 Checks)';
      if (diagHeaderSubtitle) diagHeaderSubtitle.textContent = 'Non-destructive 14-point audit evaluating headers, CORS, secrets, PII, path traversal, canary injection, host headers, IP spoofing, HPP, cache-control, and metadata.';
      if (testTargetProfile) {
        testTargetProfile.innerHTML = `
          <option value="secure">Target: Secure API (Grade A)</option>
          <option value="vulnerable">Target: Vulnerable API (Grade F)</option>
        `;
      }
      if (btnRunDiagnostics) btnRunDiagnostics.textContent = 'Run 14-Point Security Audit';
      scoreTitle.textContent = 'Ready to audit security';
      scoreSubtitle.textContent = 'Click "Run 14-Point Security Audit" to evaluate all 14 defensive security, CORS, PII, injection, and auth probes.';
    } else {
      if (tabResilience) tabResilience.classList.add('active');
      if (diagHeaderTitle) diagHeaderTitle.textContent = 'Automated API Resilience Benchmark (10 Checks)';
      if (diagHeaderSubtitle) diagHeaderSubtitle.textContent = 'Automated 10-point test suite evaluating client resilience against network delay, throttling, cuts, corruptions, 503 outages, jitter, circuit breakers, and starvation.';
      if (testTargetProfile) {
        testTargetProfile.innerHTML = `
          <option value="resilient">Target: Resilient App (Grade A)</option>
          <option value="fragile">Target: Fragile App (Grade F)</option>
        `;
      }
      if (btnRunDiagnostics) btnRunDiagnostics.textContent = 'Run 10-Point Resilience Benchmark';
      scoreTitle.textContent = 'Ready to evaluate resilience';
      scoreSubtitle.textContent = 'Click "Run 10-Point Resilience Benchmark" to evaluate client resilience against 10 real network failure cases.';
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

  if (btnRunDiagnostics) {
    btnRunDiagnostics.addEventListener('click', async () => {
      if (isRunningDiagnostics) return;
      await syncTargetUrl();
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
          btnRunDiagnostics.textContent = 'Run 8-Point Storm Benchmark';
        }
      } else if (currentDiagMode === 'security') {
        btnRunDiagnostics.textContent = 'Auditing...';
        scoreTitle.textContent = 'Running 14-Point Security Audit...';
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
          btnRunDiagnostics.textContent = 'Run 14-Point Security Audit';
        }
      } else {
        btnRunDiagnostics.textContent = 'Running...';
        scoreTitle.textContent = 'Running 10-Point Resilience Benchmark...';
        scoreSubtitle.textContent = 'Evaluating delay, slow speed, cuts, corruption, 503 errors, jitter, circuit breakers, and starvation.';

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
          btnRunDiagnostics.textContent = 'Run 10-Point Resilience Benchmark';
        }
      }
    });
  }

  // Remediation Code Snippets Catalog
  const REMEDIATION_SNIPPETS = {
    'Response Delay Handling (300ms)': {
      express: `// Express / Node HTTP Client Timeout Handling
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 3000); // 3s SLA timeout

try {
  const res = await fetch('http://api.backend.internal/data', { signal: controller.signal });
  return await res.json();
} catch (err) {
  if (err.name === 'AbortError') {
    return { status: 'degraded', data: [] }; // Graceful degradation fallback
  }
  throw err;
} finally {
  clearTimeout(timeout);
}`,
      fastapi: `# Python / httpx Client SLA Timeout
import httpx

try:
    async with httpx.AsyncClient(timeout=3.0) as client:
        response = await client.get("http://api.backend.internal/data")
        return response.json()
except httpx.TimeoutException:
    return {"status": "degraded", "data": []}  # Graceful fallback`
    },

    'Bandwidth Throttling (Speed Cap)': {
      express: `// Streaming chunk processor with backpressure handling
const res = await fetch(url);
const reader = res.body.getReader();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  processChunkProgressively(value);
}`,
      fastapi: `# Streaming response chunk processor
import httpx

async with httpx.AsyncClient() as client:
    async with client.stream("GET", url) as response:
        async for chunk in response.aiter_bytes():
            process_chunk_incrementally(chunk)`
    },

    'Connection Cut (Abrupt Socket Drop)': {
      express: `// Retry with Exponential Backoff on Socket Drop / ECONNRESET
async function fetchWithRetry(url, retries = 3, delay = 500) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(url);
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, delay * Math.pow(2, i)));
    }
  }
}`,
      fastapi: `# Tenacity retry on connection errors
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
import httpx

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=0.5), retry=retry_if_exception_type(httpx.NetworkError))
async def safe_fetch(url: str):
    async with httpx.AsyncClient() as client:
        return await client.get(url)`
    },

    'Corrupted / Truncated JSON Payload': {
      express: `// Safe JSON Parser with Fallback Boundary
let parsedData;
try {
  parsedData = JSON.parse(responseText);
} catch (err) {
  console.warn("Payload corrupted or truncated mid-stream. Triggering safe fallback.");
  parsedData = { fallback: true, error: "Malformed payload received" };
}`,
      fastapi: `# Pydantic validation error boundary
import json
from pydantic import ValidationError

try:
    data = json.loads(response_text)
    validated = MyResponseModel.model_validate(data)
except (json.JSONDecodeError, ValidationError):
    validated = MyResponseModel(fallback=True, items=[])`
    },

    'Server Outage (503 Service Unavailable)': {
      express: `// 503 Circuit Breaker & Status Fallback
if (res.status === 503) {
  const retryAfter = res.headers.get('Retry-After') || '5';
  console.info(\`Upstream busy. Backing off for \${retryAfter} seconds.\`);
  return { degraded: true, message: "Service busy, please retry shortly" };
}`,
      fastapi: `# 503 Status Handler with Retry-After respect
if response.status_code == 503:
    retry_after = int(response.headers.get("Retry-After", 5))
    logger.warning(f"Upstream service unavailable. Backing off for {retry_after}s.")
    return {"degraded": True, "message": "Service unavailable"}`
    },

    'Defensive Security Headers': {
      express: `// Add Helmet.js to automatically inject defensive headers
import helmet from 'helmet';
app.use(helmet());

// Or configure manually in Express:
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});`,
      fastapi: `# Custom Security Headers Middleware in FastAPI
from starlette.middleware.base import BaseHTTPMiddleware

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

app.add_middleware(SecurityHeadersMiddleware)`
    },

    'CORS Origin & Credential Safety': {
      express: `// Strict Whitelist CORS (Never use origin: '*' with credentials)
import cors from 'cors';

const allowedOrigins = ['https://app.yourdomain.com'];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error('Blocked by CORS'));
  },
  credentials: true
}));`,
      fastapi: `# Strict CORS Middleware in FastAPI
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://app.yourdomain.com"], # Explicit origin required
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)`
    },

    'URL Credential & Secret Exposure': {
      express: `// Consume tokens via Authorization header, reject query tokens
app.use((req, res, next) => {
  if (req.query.token || req.query.apiKey) {
    return res.status(400).json({ error: "Pass credentials in Authorization header, not in query string." });
  }
  next();
});`,
      fastapi: `# OAuth2 / Bearer Token Header Authentication
from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)):
    token = credentials.credentials
    return verify_token(token)`
    },

    'Outbound Response PII & Secret Scanner': {
      express: `// Exclude passwords and internal keys before serialization
function sanitizeUser(user) {
  const { passwordHash, internalSecret, ...safeUser } = user;
  return safeUser;
}

res.json(sanitizeUser(userRecord));`,
      fastapi: `# Use Pydantic response_model to prevent leaking private fields
class UserPublic(BaseModel):
    id: int
    username: str
    email: EmailStr
    # password_hash and internal_token are excluded

@app.get("/users/me", response_model=UserPublic)
async def read_current_user():
    return user_record`
    },

    'Error Sanitization & Stack Trace Exposure': {
      express: `// Global Production Error Sanitizer (Hide stack traces from clients)
app.use((err, req, res, next) => {
  console.error(err); // Log internally to server stdout
  res.status(500).json({
    error: "Internal Server Error",
    requestId: req.id
  });
});`,
      fastapi: `# Production Exception Handler
from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal Server Error", "requestId": request.state.request_id}
    )`
    },

    'Path Traversal & Directory Escape (../)': {
      express: `// Safe Path Resolution with Boundary Jailing
import path from 'node:path';

function getSafeFile(userPath) {
  const baseDir = path.resolve('/var/www/uploads');
  const safePath = path.resolve(baseDir, userPath);
  if (!safePath.startsWith(baseDir + path.sep)) {
    throw new Error('Access Denied: Path Traversal Detected');
  }
  return safePath;
}`,
      fastapi: `# Safe Path Resolution in Python
from pathlib import Path

def get_safe_filepath(user_filename: str) -> Path:
    base_dir = Path("/var/www/uploads").resolve()
    target_path = (base_dir / user_filename).resolve()
    if not target_path.is_relative_to(base_dir):
        raise HTTPException(status_code=400, detail="Invalid path")
    return target_path`
    },

    'Safe SQL/NoSQL & Canary Input Probing': {
      express: `// Use Parameterized Queries (e.g. pg, mysql2, or Prisma ORM)
// NEVER do: db.query(\`SELECT * FROM users WHERE id = '\${userId}'\`)

// ALWAYS do:
const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);`,
      fastapi: `# Use SQLAlchemy / SQLModel Parameterized Statements
from sqlalchemy import select

# Safe parameterized query:
stmt = select(User).where(User.username == username_input)
result = await session.execute(stmt)`
    },

    'Rate Limit Back-off & Retry Storm Handling': {
      express: `// Express Rate Limit Middleware
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 requests per minute
  standardHeaders: true, // Return RateLimit-* headers
  legacyHeaders: false,
});

app.use('/api/', limiter);`,
      fastapi: `# SlowAPI Rate Limiting for FastAPI
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.get("/api/data")
@limiter.limit("60/minute")
async def get_data(request: Request):
    return {"status": "ok"}`
    },

    'Oversized Payload & Buffer OOM Defense (HTTP 413)': {
      express: `// Restrict JSON Body Parsing Limit
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));`,
      fastapi: `# Request Body Size Limiter Middleware in FastAPI
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

class ContentLengthLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > 5 * 1024 * 1024: # 5 MB
            return JSONResponse({"error": "Payload Too Large"}, status_code=413)
        return await call_next(request)

app.add_middleware(ContentLengthLimitMiddleware)`
    },

    'Slowloris Connection Drip Defense': {
      express: `// Node HTTP Server Timeout Protection
const server = app.listen(port);

server.headersTimeout = 20000; // 20s
server.requestTimeout = 30000; // 30s
server.keepAliveTimeout = 5000; // 5s`,
      fastapi: `# Uvicorn Timeout Configuration
# Run uvicorn with strict timeout flags:
# uvicorn main:app --timeout-keep-alive 5 --timeout-graceful-shutdown 30`
    },

    'Duplicate Request Idempotency Protection': {
      express: `// Idempotency Middleware using Redis / In-Memory Cache
app.post('/api/checkout', async (req, res) => {
  const key = req.headers['idempotency-key'];
  if (!key) return res.status(400).json({ error: "Missing Idempotency-Key" });

  const cached = await redis.get(\`idemp:\${key}\`);
  if (cached) return res.json(JSON.parse(cached));

  const result = await processTransaction(req.body);
  await redis.set(\`idemp:\${key}\`, JSON.stringify(result), 'EX', 86400);
  res.json(result);
});`,
      fastapi: `# Idempotency Key Middleware
from fastapi import Header, HTTPException

@app.post("/api/checkout")
async def checkout(idempotency_key: str = Header(None)):
    if not idempotency_key:
        raise HTTPException(status_code=400, detail="Missing Idempotency-Key")
    
    cached = await redis_client.get(f"idemp:{idempotency_key}")
    if cached:
        return json.loads(cached)
        
    result = await process_order()
    await redis_client.set(f"idemp:{idempotency_key}", json.dumps(result), ex=86400)
    return result`
    }
  };

  function renderSnippetBlock(checkName, uniqueId) {
    const snippet = REMEDIATION_SNIPPETS[checkName];
    if (!snippet) return '';

    return `
      <button class="btn-toggle-snippet" type="button" onclick="window.toggleSnippet('${uniqueId}')">
        View Remediation Snippet
      </button>
      <div id="${uniqueId}" class="snippet-container" style="display: none;">
        <div class="snippet-header">
          <div class="snippet-tabs">
            <button class="snippet-tab-btn active" type="button" onclick="window.switchSnippetTab('${uniqueId}', 'express')">Express / Node</button>
            <button class="snippet-tab-btn" type="button" onclick="window.switchSnippetTab('${uniqueId}', 'fastapi')">FastAPI / Python</button>
          </div>
          <button class="btn-copy-snippet" type="button" onclick="window.copySnippetCode('${uniqueId}', this)">Copy Code</button>
        </div>
        <pre class="snippet-code-content" data-express="${escapeHtml(snippet.express)}" data-fastapi="${escapeHtml(snippet.fastapi)}">${escapeHtml(snippet.express)}</pre>
      </div>
    `;
  }

  window.toggleSnippet = function(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
  };

  window.switchSnippetTab = function(containerId, lang) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const pre = container.querySelector('.snippet-code-content');
    const tabs = container.querySelectorAll('.snippet-tab-btn');
    tabs.forEach(t => t.classList.remove('active'));
    
    const clicked = Array.from(tabs).find(t => t.textContent.toLowerCase().includes(lang === 'express' ? 'express' : 'fastapi'));
    if (clicked) clicked.classList.add('active');

    if (pre) {
      pre.textContent = pre.getAttribute(`data-${lang}`) || '';
    }
  };

  window.copySnippetCode = function(containerId, btnEl) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const pre = container.querySelector('.snippet-code-content');
    if (!pre) return;
    navigator.clipboard.writeText(pre.textContent).then(() => {
      if (btnEl) {
        const orig = btnEl.textContent;
        btnEl.textContent = 'Copied!';
        setTimeout(() => { btnEl.textContent = orig; }, 1500);
      }
    });
  };

  function renderDiagnosticsReport(report) {
    lastScorecardData = { mode: 'resilience', report, timestamp: new Date().toISOString() };
    if (exportGroup) exportGroup.style.display = 'flex';

    scoreValue.textContent = `${report.score}/100`;
    scoreGrade.textContent = `GRADE ${report.grade}`;

    if (report.grade === 'A') {
      scoreTitle.textContent = 'All 10 Resilience Checks Passed (Grade A)';
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
      const snippetHtml = !r.passed ? renderSnippetBlock(r.name, `snip_res_${idx}`) : '';

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
              ${snippetHtml}
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
    lastScorecardData = { mode: 'security', report, timestamp: new Date().toISOString() };
    if (exportGroup) exportGroup.style.display = 'flex';

    scoreValue.textContent = `${report.score}/100`;
    scoreGrade.textContent = `GRADE ${report.grade}`;

    if (report.grade === 'A') {
      scoreTitle.textContent = 'All 14 Security Checks Passed (Grade A)';
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
      const snippetHtml = !c.passed ? renderSnippetBlock(c.name, `snip_sec_${idx}`) : '';

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
              ${snippetHtml}
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
    lastScorecardData = { mode: 'storm', report, timestamp: new Date().toISOString() };
    if (exportGroup) exportGroup.style.display = 'flex';

    scoreValue.textContent = `${report.score}/100`;
    scoreGrade.textContent = `GRADE ${report.grade}`;

    if (report.grade === 'A') {
      scoreTitle.textContent = 'All 8 Traffic Storm Checks Passed (Grade A)';
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
      const snippetHtml = !c.passed ? renderSnippetBlock(c.name, `snip_storm_${idx}`) : '';

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
              ${snippetHtml}
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

  // Export functions
  function exportMarkdownReport() {
    if (!lastScorecardData || !lastScorecardData.report) {
      alert('No audit report available to export. Run a benchmark first.');
      return;
    }
    const { mode, report, timestamp } = lastScorecardData;
    const checks = report.checks || report.results || [];

    let md = `# FaultMesh Audit Report — ${mode.toUpperCase()}\n\n`;
    md += `* **Timestamp:** ${new Date(timestamp).toUTCString()}\n`;
    md += `* **Overall Score:** ${report.score} / 100 (Grade ${report.grade})\n`;
    md += `* **Checks Passed:** ${report.passedChecks ?? report.passedAttacks} / ${report.totalChecks ?? report.totalAttacks}\n\n`;

    md += `## Findings & Verification Summary\n\n`;
    md += `| # | Check Name | Severity | Result | Finding Details |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- |\n`;
    checks.forEach((c, idx) => {
      const num = String(idx + 1).padStart(2, '0');
      const sev = c.severity ? c.severity.toUpperCase() : 'STANDARD';
      const res = c.passed ? 'PASSED' : 'FAILED';
      const detail = (c.details || '').replace(/\|/g, '\\|');
      md += `| ${num} | ${c.name} | ${sev} | ${res} | ${detail} |\n`;
    });

    if (report.recommendations && report.recommendations.length > 0) {
      md += `\n## Remediation Recommendations\n\n`;
      report.recommendations.forEach(rec => {
        md += `* ${rec}\n`;
      });
    }

    md += `\n---\n*Report generated by FaultMesh Runtime Engine*\n`;

    downloadFile(`faultmesh-${mode}-audit-${Date.now()}.md`, 'text/markdown', md);
  }

  function exportJsonReport() {
    if (!lastScorecardData || !lastScorecardData.report) {
      alert('No audit report available to export. Run a benchmark first.');
      return;
    }
    const jsonStr = JSON.stringify(lastScorecardData, null, 2);
    downloadFile(`faultmesh-${lastScorecardData.mode}-audit-${Date.now()}.json`, 'application/json', jsonStr);
  }

  function downloadFile(filename, mimeType, content) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (btnExportMd) {
    btnExportMd.addEventListener('click', exportMarkdownReport);
  }
  if (btnExportJson) {
    btnExportJson.addEventListener('click', exportJsonReport);
  }

  // 8.9 Auto-Healer Interactions
  if (btnOpenHealer && healerModal) {
    btnOpenHealer.addEventListener('click', () => {
      healerModal.style.display = 'flex';
      if (healerScanStatus && healerScanStatus.style.display === 'none') {
        healerScanStatus.style.display = 'block';
        healerScanStatus.textContent = 'Enter your backend project directory above and click "Scan Codebase".';
      }
    });
  }

  if (btnCloseHealer && healerModal) {
    btnCloseHealer.addEventListener('click', () => {
      healerModal.style.display = 'none';
    });
  }

  // Close modal on backdrop click
  if (healerModal) {
    healerModal.addEventListener('click', (e) => {
      if (e.target === healerModal) {
        healerModal.style.display = 'none';
      }
    });
  }

  if (btnToggleAiSettings && healerAiSettingsPanel) {
    btnToggleAiSettings.addEventListener('click', () => {
      const isHidden = healerAiSettingsPanel.style.display === 'none';
      healerAiSettingsPanel.style.display = isHidden ? 'block' : 'none';
      btnToggleAiSettings.textContent = isHidden
        ? 'Hide AI Healer Configuration'
        : 'Configure AI Healer (Ollama / Claude / OpenAI / Gemini)';
    });
  }

  if (healerAiProvider) {
    healerAiProvider.addEventListener('change', () => {
      const prov = healerAiProvider.value;
      if (prov === 'ollama') {
        if (aiKeyGroup) aiKeyGroup.style.display = 'none';
        if (aiEndpointGroup) {
          aiEndpointGroup.style.display = 'flex';
          if (healerAiEndpoint) healerAiEndpoint.value = 'http://127.0.0.1:11434';
        }
      } else if (prov === 'custom') {
        if (aiKeyGroup) aiKeyGroup.style.display = 'flex';
        if (aiEndpointGroup) {
          aiEndpointGroup.style.display = 'flex';
          if (healerAiEndpoint) healerAiEndpoint.value = 'http://127.0.0.1:1234/v1';
        }
      } else {
        if (aiKeyGroup) aiKeyGroup.style.display = 'flex';
        if (aiEndpointGroup) aiEndpointGroup.style.display = 'none';
      }
    });
  }

  if (healerEngineMode && healerEngineBadge) {
    healerEngineMode.addEventListener('change', () => {
      const mode = healerEngineMode.value;
      if (mode === 'ai') {
        healerEngineBadge.textContent = 'Engine: AI Healer Agent (Universal)';
        healerEngineBadge.className = 'engine-badge ai-agent';
      } else if (mode === 'codemod') {
        healerEngineBadge.textContent = 'Engine: Deterministic CodeMod';
        healerEngineBadge.className = 'engine-badge codemod';
      } else {
        healerEngineBadge.textContent = 'Engine: CodeMod + AI Hybrid';
        healerEngineBadge.className = 'engine-badge codemod';
      }
    });
  }

  function getAiConfigPayload() {
    const engineMode = healerEngineMode ? healerEngineMode.value : 'hybrid';
    const provider = healerAiProvider ? healerAiProvider.value : 'ollama';
    const apiKey = healerAiKey ? healerAiKey.value.trim() : undefined;
    const endpoint = healerAiEndpoint ? healerAiEndpoint.value.trim() : undefined;
    return { engineMode, aiConfig: { provider, apiKey, endpoint } };
  }

  if (btnHealerScan) {
    btnHealerScan.addEventListener('click', async () => {
      const projectDir = (healerProjectDir ? healerProjectDir.value.trim() : '') || '.';
      const { engineMode, aiConfig } = getAiConfigPayload();

      btnHealerScan.disabled = true;
      btnHealerScan.textContent = 'Scanning...';
      if (healerScanStatus) {
        healerScanStatus.style.display = 'block';
        healerScanStatus.textContent = `Scanning project at "${projectDir}" using ${engineMode.toUpperCase()} engine...`;
      }
      if (healerDiffContainer) healerDiffContainer.style.display = 'none';
      if (healerActionsBar) healerActionsBar.style.display = 'none';

      let failedChecks = [];
      if (lastScorecardData && lastScorecardData.report) {
        const checks = lastScorecardData.report.checks || lastScorecardData.report.results || [];
        failedChecks = checks.filter(c => !c.passed).map(c => c.name);
      }

      try {
        const res = await fetch('/_faultmesh/healer/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectDir, failedChecks, engineMode, aiConfig }),
        });
        const result = await res.json();
        lastHealerScanResult = result;

        if (!result.success) {
          if (healerScanStatus) {
            healerScanStatus.textContent = `Scan Notice: ${result.warnings.join('; ') || 'Could not locate server entry file'}`;
            healerScanStatus.style.borderColor = 'var(--tag-red-fg)';
          }
          return;
        }

        if (result.patches.length === 0) {
          if (healerScanStatus) {
            healerScanStatus.textContent = `Framework: ${result.framework.toUpperCase()} (Entry: ${result.entryFile}). All target defenses are already in place! Zero patches required.`;
            healerScanStatus.style.borderColor = 'var(--tag-green-fg)';
          }
          return;
        }

        if (healerScanStatus) {
          const engineLabel = result.engineUsed === 'ai-agent' ? 'AI Agent' : (result.engineUsed === 'hybrid' ? 'Hybrid (CodeMod + AI)' : 'Deterministic CodeMod');
          healerScanStatus.textContent = `Detected ${result.framework.toUpperCase()} in "${result.entryFile}". Found ${result.patches.length} applicable remediations (Engine: ${engineLabel}):`;
          healerScanStatus.style.borderColor = 'var(--border-default)';
        }

        if (healerDiffContainer) {
          healerDiffContainer.innerHTML = result.patches.map((p) => {
            const diffLines = p.diff.split(/\r?\n/).map(line => {
              if (line.startsWith('+') && !line.startsWith('+++')) {
                return `<span class="diff-line add">${escapeHtml(line)}</span>`;
              } else if (line.startsWith('-') && !line.startsWith('---')) {
                return `<span class="diff-line del">${escapeHtml(line)}</span>`;
              } else if (line.startsWith('@@')) {
                return `<span class="diff-line info">${escapeHtml(line)}</span>`;
              } else if (line.startsWith('---') || line.startsWith('+++')) {
                return `<span class="diff-line file-header">${escapeHtml(line)}</span>`;
              }
              return `<span class="diff-line context">${escapeHtml(line)}</span>`;
            }).join('');

            const engineTagClass = p.engine === 'ai-agent' ? 'ai-agent' : 'codemod';
            const engineTagLabel = p.engine === 'ai-agent' ? 'AI Agent' : 'CodeMod';

            return `
              <div class="diff-card">
                <div class="diff-card-header">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="diff-card-title">${escapeHtml(p.checkName)}</span>
                    <span class="engine-badge ${engineTagClass}">${engineTagLabel}</span>
                  </div>
                  <span class="diff-card-file">${escapeHtml(p.relativePath)}</span>
                </div>
                <pre class="diff-pre"><code>${diffLines}</code></pre>
              </div>
            `;
          }).join('');

          healerDiffContainer.style.display = 'flex';
        }

        if (healerActionsBar) {
          healerActionsBar.style.display = 'flex';
        }
      } catch (err) {
        if (healerScanStatus) {
          healerScanStatus.textContent = `Scan Error: ${err.message}`;
          healerScanStatus.style.borderColor = 'var(--tag-red-fg)';
        }
      } finally {
        btnHealerScan.disabled = false;
        btnHealerScan.textContent = 'Scan Codebase';
      }
    });
  }

  if (btnHealerApply) {
    btnHealerApply.addEventListener('click', async () => {
      if (!lastHealerScanResult || !lastHealerScanResult.patches) return;
      const projectDir = (healerProjectDir ? healerProjectDir.value.trim() : '') || '.';
      const createBackup = healerBackupCheck ? healerBackupCheck.checked : true;
      const { engineMode, aiConfig } = getAiConfigPayload();

      btnHealerApply.disabled = true;
      btnHealerApply.textContent = 'Applying Remedies...';

      try {
        const res = await fetch('/_faultmesh/healer/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectDir, createBackup, engineMode, aiConfig }),
        });
        const result = await res.json();

        if (result.success) {
          lastBackupDir = result.backupDir;
          if (healerScanStatus) {
            healerScanStatus.textContent = `Successfully applied ${result.appliedCount} remedies! Backend restarted on port 5050. Re-running live tests...`;
            healerScanStatus.style.borderColor = 'var(--tag-green-fg)';
          }
          if (healerDiffContainer) healerDiffContainer.style.display = 'none';
          btnHealerApply.style.display = 'none';

          if (btnHealerRollback && lastBackupDir) {
            btnHealerRollback.style.display = 'inline-block';
          }

          // Trigger live re-test automatically
          setTimeout(() => {
            if (btnRunDiagnostics) {
              btnRunDiagnostics.click();
            }
          }, 600);
        } else {
          if (healerScanStatus) {
            healerScanStatus.textContent = `Apply Error: ${(result.errors || []).join('; ')}`;
            healerScanStatus.style.borderColor = 'var(--tag-red-fg)';
          }
        }
      } catch (err) {
        if (healerScanStatus) {
          healerScanStatus.textContent = `Network Error: ${err.message}`;
          healerScanStatus.style.borderColor = 'var(--tag-red-fg)';
        }
      } finally {
        btnHealerApply.disabled = false;
        btnHealerApply.textContent = 'Apply Remedies to Codebase';
      }
    });
  }

  if (btnHealerRollback) {
    btnHealerRollback.addEventListener('click', async () => {
      if (!lastBackupDir) return;
      const projectDir = (healerProjectDir ? healerProjectDir.value.trim() : '') || '.';
      btnHealerRollback.disabled = true;
      btnHealerRollback.textContent = 'Rolling back...';

      try {
        const res = await fetch('/_faultmesh/healer/rollback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectDir, backupDir: lastBackupDir }),
        });
        const result = await res.json();
        if (result.success) {
          if (healerScanStatus) {
            healerScanStatus.textContent = `Rollback complete. Restored original files. Backend restarted on port 5050. Re-running live tests...`;
            healerScanStatus.style.borderColor = 'var(--border-default)';
          }
          btnHealerRollback.style.display = 'none';
          if (btnHealerApply) btnHealerApply.style.display = 'inline-block';

          // Trigger live re-test automatically to reflect rolled-back state
          setTimeout(() => {
            if (btnRunDiagnostics) {
              btnRunDiagnostics.click();
            }
          }, 600);
        } else {
          if (healerScanStatus) {
            healerScanStatus.textContent = `Rollback error: ${(result.errors || []).join('; ')}`;
          }
        }
      } catch (err) {
        if (healerScanStatus) {
          healerScanStatus.textContent = `Rollback failed: ${err.message}`;
        }
      } finally {
        btnHealerRollback.disabled = false;
        btnHealerRollback.textContent = 'Rollback Last Patch';
      }
    });
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

  // Synchronize Workbench Heights: Right column matches Left column perfectly
  function syncWorkbenchHeights() {
    const presetsCard = document.querySelector('.presets-card');
    const customRuleCard = document.querySelector('.custom-rule-card');
    const activeRulesCard = document.querySelector('.active-rules-card');
    const responseInspector = document.getElementById('responseInspector');
    const liveLogCard = document.querySelector('.live-log-card');
    const leftWorkbenchCol = document.getElementById('leftWorkbenchCol');

    if (!presetsCard || !customRuleCard || !activeRulesCard || !responseInspector || !liveLogCard) {
      return;
    }

    if (window.innerWidth <= 1024) {
      responseInspector.style.height = 'auto';
      liveLogCard.style.height = 'auto';
      return;
    }

    const presetsHeight = presetsCard.offsetHeight;
    const customHeight = customRuleCard.offsetHeight;
    const activeHeight = activeRulesCard.offsetHeight;

    // Detect gap between cards in left column (default 16px)
    let gap = 16;
    if (leftWorkbenchCol) {
      const colStyle = window.getComputedStyle(leftWorkbenchCol);
      const parsedGap = parseFloat(colStyle.rowGap || colStyle.gap);
      if (!isNaN(parsedGap) && parsedGap > 0) {
        gap = parsedGap;
      }
    }

    // 1. Response Inspector height matches the 1-Click Quick Presets card exactly
    responseInspector.style.height = `${presetsHeight}px`;

    // 2. Live Traffic Log starts at Custom Rule card and ends at Active Simulation Rules card
    const targetLogHeight = customHeight + gap + activeHeight;
    liveLogCard.style.height = `${targetLogHeight}px`;
  }

  if (typeof ResizeObserver !== 'undefined') {
    const workbenchResizeObserver = new ResizeObserver(() => {
      syncWorkbenchHeights();
    });
    const presetsEl = document.querySelector('.presets-card');
    const customEl = document.querySelector('.custom-rule-card');
    const activeEl = document.querySelector('.active-rules-card');
    if (presetsEl) workbenchResizeObserver.observe(presetsEl);
    if (customEl) workbenchResizeObserver.observe(customEl);
    if (activeEl) workbenchResizeObserver.observe(activeEl);
  }

  window.addEventListener('resize', syncWorkbenchHeights);

  setDiagMode('resilience');
  loadTargetUrl();
  refreshStatus();
  setupSSE();
  // Initial height synchronization after DOM render
  setTimeout(syncWorkbenchHeights, 50);
});
