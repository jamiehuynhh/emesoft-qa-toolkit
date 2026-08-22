/* =============================================================================
   AI QA Toolkit — Node.js server
   -----------------------------------------------------------------------------
   Two jobs:
     1. Serve the static toolkit (index.html, css, js).
     2. Expose POST /api/ai as a proxy to the Claude Messages API, so the API
        key lives in this process and never reaches the browser.

   Zero runtime dependencies — `npm install` is not required.
   Run with:  npm start        (or npm run dev for auto-restart on save)
   ========================================================================== */

import http from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import {
  toOpenAIRequest, createStreamTranslator, openAIResponseToAnthropic,
  resolvePreset, PRESETS
} from './providers.js';
import {
  securityHeaders, checkAuth, guardExposure, createRateLimiter, clientKey, isLoopbackHost,
  createAuditLog, auditEvent
} from './security.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(__filename, '..', '..');

/* ------------------------------------------------------------------ config */

// Minimal .env loader (real env vars always win, so CI/Docker overrides work).
function loadEnvFile(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    let value = m[2];
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}
loadEnvFile(join(ROOT, '.env'));

/* Which model service to call. A preset name fills in the URL and a sensible
   model; any individual field can still be overridden. ANTHROPIC_* names are
   kept working so an existing .env does not break. */
const preset = resolvePreset(process.env.AI_PRESET) || PRESETS.anthropic;

// Refuse to start on a provider that no longer exists, rather than letting every
// request fail with a confusing 4xx from a dead endpoint.
if (preset.retired) {
  console.error('');
  console.error(`  AI_PRESET=${process.env.AI_PRESET} cannot be used.`);
  console.error(`  ${preset.retiredNote}`);
  console.error('  Edit .env and restart.');
  console.error('');
  process.exit(1);
}

const CONFIG = {
  port: Number(process.env.PORT) || 8123,
  // 127.0.0.1 by default: this process holds an API key, so do not put it on
  // the LAN unless you deliberately set HOST=0.0.0.0.
  host: process.env.HOST || '127.0.0.1',

  // Label only. Without AI_PRESET, an explicit provider/url means "custom" —
  // reporting "anthropic" while calling an OpenAI endpoint would be a lie.
  presetName: (process.env.AI_PRESET ||
    ((process.env.AI_PROVIDER || process.env.AI_API_URL) ? 'custom' : 'anthropic')).toLowerCase(),
  provider: process.env.AI_PROVIDER || preset.provider,
  apiUrl: process.env.AI_API_URL || process.env.ANTHROPIC_API_URL || preset.url,
  apiKey: process.env.AI_API_KEY || process.env.ANTHROPIC_API_KEY || '',
  defaultModel: process.env.AI_MODEL || preset.model,
  apiVersion: process.env.ANTHROPIC_VERSION || '2023-06-01',
  // opt-in: not every OpenAI-compatible server accepts stream_options
  streamUsage: /^(1|true|yes)$/i.test(process.env.AI_STREAM_USAGE || ''),

  maxBodyBytes: Number(process.env.MAX_BODY_BYTES) || 2 * 1024 * 1024,
  requestTimeoutMs: Number(process.env.AI_TIMEOUT_MS) || 10 * 60 * 1000,

  // --- protecting the two credential-holding endpoints ---------------------
  authToken: process.env.AUTH_TOKEN || '',
  allowInsecure: /^(1|true|yes)$/i.test(process.env.ALLOW_INSECURE_EXPOSURE || ''),
  trustProxy: /^(1|true|yes)$/i.test(process.env.TRUST_PROXY || ''),
  https: /^(1|true|yes)$/i.test(process.env.BEHIND_HTTPS || ''),
  cspConnectExtra: (process.env.CSP_CONNECT_EXTRA || 'https://api.anthropic.com')
    .split(/[\s,]+/).filter(Boolean),
  ratePerMinute: Number(process.env.RATE_PER_MINUTE) || 20,
  ratePerDay: Number(process.env.RATE_PER_DAY) || 500,
  rateConcurrent: Number(process.env.RATE_CONCURRENT) || 3,
  auditFile: process.env.AUDIT_LOG || join(ROOT, 'logs', 'audit.jsonl'),
  auditEnabled: !/^(0|false|no)$/i.test(process.env.AUDIT_ENABLED || 'true')
};

const SEC_HEADERS = securityHeaders({ https: CONFIG.https, connectExtra: CONFIG.cspConnectExtra });
const limiter = createRateLimiter({
  perMinute: CONFIG.ratePerMinute,
  perDay: CONFIG.ratePerDay,
  maxConcurrent: CONFIG.rateConcurrent
});
const audit = createAuditLog(CONFIG.auditFile, { enabled: CONFIG.auditEnabled });
setInterval(() => limiter.sweep(), 10 * 60 * 1000).unref();

// Never boot into a configuration that hands the credentials to the network.
const exposure = guardExposure({
  host: CONFIG.host, token: CONFIG.authToken, allowInsecure: CONFIG.allowInsecure
});
if (exposure) {
  console.error('');
  console.error('  ' + exposure.split('\n').join('\n  '));
  console.error('');
  process.exit(1);
}

/* Guards every /api/* call that costs money or reads private data. Returns
   null to proceed, or a response already sent. */
function gateApi(req, res, action) {
  const key = clientKey(req, { trustProxy: CONFIG.trustProxy });

  const authFail = checkAuth(req, CONFIG.authToken);
  if (authFail) {
    audit.write(auditEvent(req, { action, key, outcome: 'auth_denied' }));
    sendJson(res, authFail.status, { error: { type: 'unauthorized', message: authFail.message } });
    return null;
  }

  const limited = limiter.check(key);
  if (limited) {
    audit.write(auditEvent(req, { action, key, outcome: 'rate_limited' }));
    res.setHeader('retry-after', String(limited.retryAfter));
    sendJson(res, limited.status, { error: { type: 'rate_limited', message: limited.message } });
    return null;
  }
  return key;
}

// A key is required unless we are talking to something on this machine
// (Ollama and friends have no auth).
const isLocalUrl = (u) => /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\]|0\.0\.0\.0)(:|\/|$)/i.test(u || '');

function isConfigured() {
  if (!CONFIG.apiUrl) return false;
  if (CONFIG.provider === 'anthropic') return Boolean(CONFIG.apiKey);
  return Boolean(CONFIG.apiKey) || isLocalUrl(CONFIG.apiUrl);
}

function notConfiguredMessage() {
  if (CONFIG.provider === 'anthropic') {
    return 'No API key on the server. Copy .env.example to .env, set AI_API_KEY (or ANTHROPIC_API_KEY), ' +
           'and restart (npm start). For a free option set AI_PRESET=ollama or AI_PRESET=gemini instead.';
  }
  return `Provider "${CONFIG.presetName}" needs a key: set AI_API_KEY in .env and restart (npm start). ` +
         'Only a local provider such as Ollama works without one.';
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

/* ----------------------------------------------------------------- helpers */

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    ...SEC_HEADERS
  });
  res.end(body);
}

function readBody(req, limit) {
  return new Promise((ok, fail) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        fail(Object.assign(new Error('Request body too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => ok(Buffer.concat(chunks).toString('utf8')));
    req.on('error', fail);
  });
}

function log(...args) {
  const t = new Date().toISOString().slice(11, 19);
  console.log(`[${t}]`, ...args);
}

/* Node's fetch reports every transport failure as the useless string
   "fetch failed" and hides the real reason in error.cause. Unwrap it, and add
   the hint that actually resolves each code - on a corporate network these are
   almost always DNS, a TLS-inspecting proxy, or a firewall. */
const NET_HINTS = {
  ENOTFOUND: 'host not found - check the organisation name / URL and your DNS',
  EAI_AGAIN: 'DNS lookup failed - check your connection or VPN',
  ECONNREFUSED: 'nothing is listening on that address - is the service running?',
  ECONNRESET: 'the connection was closed mid-request - often a proxy or firewall',
  ETIMEDOUT: 'timed out - a firewall or corporate proxy is likely blocking it',
  UND_ERR_CONNECT_TIMEOUT: 'connect timed out - a firewall or corporate proxy is likely blocking it',
  CERT_HAS_EXPIRED: 'the TLS certificate has expired',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'TLS certificate not trusted - typical behind a TLS-inspecting proxy',
  SELF_SIGNED_CERT_IN_CHAIN: 'self-signed certificate in the chain - typical behind a TLS-inspecting proxy',
  DEPTH_ZERO_SELF_SIGNED_CERT: 'self-signed certificate - typical behind a TLS-inspecting proxy'
};

function describeNetworkError(e) {
  const chain = [];
  let code = null;
  for (let cur = e, guard = 0; cur && guard < 6; cur = cur.cause, guard++) {
    if (cur.code && !code) code = cur.code;
    const bit = cur.code || cur.message;
    if (bit && !chain.includes(bit)) chain.push(bit);
  }
  const useful = chain.filter((c) => c !== 'fetch failed' && c !== 'Failed to fetch');
  let msg = (useful.length ? useful : chain).join(' / ') || 'unknown network error';
  if (code && NET_HINTS[code]) msg += ` - ${NET_HINTS[code]}`;
  return msg;
}

/* --------------------------------------------------------------- /api/ai */
/* Accepts exactly the /v1/messages request body the browser already builds,
   adds the server-side credentials, and streams the response straight back. */

async function handleAi(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: { type: 'method_not_allowed', message: 'Use POST.' } });
  }

  const gateKey = gateApi(req, res, 'ai.generate');
  if (!gateKey) return;                      // response already sent
  limiter.begin(gateKey);
  let released = false;
  const release = (outcome, detail) => {
    if (released) return;
    released = true;
    limiter.end(gateKey);
    audit.write(auditEvent(req, { action: 'ai.generate', key: gateKey, outcome, detail }));
  };
  res.on('close', () => release('client_closed'));

  if (!isConfigured()) {
    release('not_configured');
    return sendJson(res, 503, {
      error: { type: 'not_configured', message: notConfiguredMessage() }
    });
  }

  let payload;
  try {
    payload = JSON.parse(await readBody(req, CONFIG.maxBodyBytes));
  } catch (e) {
    return sendJson(res, e.status || 400, {
      error: { type: 'bad_request', message: e.status === 413 ? e.message : 'Body is not valid JSON.' }
    });
  }

  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.messages)) {
    return sendJson(res, 400, {
      error: { type: 'bad_request', message: 'Expected a JSON object with a "messages" array.' }
    });
  }
  if (!payload.model) payload.model = CONFIG.defaultModel;

  // Cancel the upstream call if the browser goes away mid-stream.
  const ctrl = new AbortController();
  const onClose = () => ctrl.abort();
  req.on('aborted', onClose);
  res.on('close', () => { if (!res.writableEnded) ctrl.abort(); });
  const timer = setTimeout(() => ctrl.abort(), CONFIG.requestTimeoutMs);

  const t0 = Date.now();
  try {
    const openaiMode = CONFIG.provider !== 'anthropic';

    const headers = { 'content-type': 'application/json' };
    let outboundBody;
    if (openaiMode) {
      if (CONFIG.apiKey) headers.authorization = `Bearer ${CONFIG.apiKey}`;
      outboundBody = toOpenAIRequest(payload, {
        model: CONFIG.defaultModel,
        streamUsage: CONFIG.streamUsage
      });
    } else {
      headers['x-api-key'] = CONFIG.apiKey;
      headers['anthropic-version'] = CONFIG.apiVersion;
      outboundBody = payload;
    }

    const upstream = await fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(outboundBody),
      signal: ctrl.signal
    });

    // An error response is JSON in both dialects — forward it as-is so the UI
    // can show the provider's own message.
    if (!upstream.ok) {
      const text = await upstream.text();
      let message = text.slice(0, 800);
      try {
        const j = JSON.parse(text);
        message = (j.error && (j.error.message || j.error)) || j.message || message;
        if (typeof message !== 'string') message = JSON.stringify(message).slice(0, 800);
      } catch { /* keep the raw text */ }
      log(`POST /api/ai -> ${upstream.status} from ${CONFIG.presetName}: ${message.slice(0, 160)}`);
      release("upstream_error", { status: upstream.status, provider: CONFIG.presetName });
      return sendJson(res, upstream.status, {
        error: { type: 'upstream_error', message: `${CONFIG.presetName}: ${message}` }
      });
    }

    if (!openaiMode) {
      // Anthropic: byte-for-byte pass-through, no translation.
      res.writeHead(upstream.status, {
        'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        // keep SSE flowing through any reverse proxy sitting in front of us
        'x-accel-buffering': 'no',
        ...SEC_HEADERS
      });
      if (!upstream.body) { res.end(); return; }
      await new Promise((done, fail) => {
        const stream = Readable.fromWeb(upstream.body);
        stream.on('error', fail);
        stream.on('end', done);
        stream.pipe(res);
      });
      log(`POST /api/ai -> ${upstream.status} ${payload.model} ${Date.now() - t0}ms`);
      release("ok", { model: payload.model, ms: Date.now() - t0, provider: CONFIG.presetName });
      return;
    }

    /* OpenAI-compatible: translate the stream into Claude SSE events so the
       browser code stays provider-agnostic. */
    const ct = upstream.headers.get('content-type') || '';
    if (!/event-stream/i.test(ct)) {
      // gateway ignored stream:true and answered in one shot
      const json = await upstream.json();
      log(`POST /api/ai -> 200 ${CONFIG.defaultModel} (non-stream) ${Date.now() - t0}ms`);
      release("ok", { model: CONFIG.defaultModel, ms: Date.now() - t0, provider: CONFIG.presetName, stream: false });
      return sendJson(res, 200, openAIResponseToAnthropic(json, CONFIG.defaultModel));
    }

    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store',
      'connection': 'keep-alive',
      'x-accel-buffering': 'no',
      ...SEC_HEADERS
    });

    const tr = createStreamTranslator(CONFIG.defaultModel);
    const decoder = new TextDecoder();
    const reader = upstream.body.getReader();
    let buf = '';

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      const frames = buf.split(/\r?\n\r?\n/);
      buf = frames.pop() ?? '';
      for (const frame of frames) {
        for (const line of frame.split(/\r?\n/)) {
          if (!line.startsWith('data:')) continue;
          const out = tr.push(line.slice(5));
          if (out) res.write(out);
        }
      }
    }
    res.write(tr.end());
    res.end();
    log(`POST /api/ai -> 200 ${CONFIG.defaultModel} via ${CONFIG.presetName} ${Date.now() - t0}ms`);
    release("ok", { model: CONFIG.defaultModel, ms: Date.now() - t0, provider: CONFIG.presetName });
    return;
  } catch (e) {
    clearTimeout(timer);
    if (ctrl.signal.aborted && res.writableEnded) return;
    log(`POST /api/ai -> failed: ${e.message}`);
    release("error", { reason: e.name === "AbortError" ? "aborted" : "network" });
    if (!res.headersSent) {
      sendJson(res, 502, {
        error: {
          type: 'upstream_error',
          message: e.name === 'AbortError'
            ? 'Request cancelled or timed out.'
            : `Could not reach ${CONFIG.apiUrl}: ${describeNetworkError(e)}`
        }
      });
    } else {
      res.end();
    }
  } finally {
    clearTimeout(timer);
  }
}

/* --------------------------------------------------------- static serving */

function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath).replace(/^\/+/, '');
  if (rel === '') rel = 'index.html';

  const target = resolve(ROOT, rel);
  // never escape the project root
  if (target !== ROOT && !target.startsWith(ROOT + sep)) {
    return sendJson(res, 403, { error: { type: 'forbidden', message: 'Path outside the site root.' } });
  }
  // do not hand out server secrets or internals over http.
  // `logs` matters: the audit trail must not be readable by the people it audits.
  if (/(^|[\\/])(\.env|\.git|node_modules|server|scripts|logs)([\\/]|$)/i.test(rel)) {
    return sendJson(res, 403, { error: { type: 'forbidden', message: 'Not served.' } });
  }

  let file = target;
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');

  if (!existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`404 Not Found: /${rel}`);
    log(`404 /${rel}`);
    return;
  }

  const type = MIME[extname(file).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, {
    'content-type': type,
    'content-length': statSync(file).size,
    // a dev server should never cache — you are editing these files
    'cache-control': 'no-store',
    ...SEC_HEADERS
  });
  createReadStream(file).pipe(res);
}

/* ------------------------------------------------------------------ server */

const server = http.createServer((req, res) => {
  const urlPath = (req.url || '/').split('?')[0];

  if (urlPath === '/api/health') {
    return sendJson(res, 200, {
      ok: true,
      service: 'ai-qa-toolkit',
      aiConfigured: isConfigured(),
      provider: CONFIG.presetName,
      dialect: CONFIG.provider,
      defaultModel: CONFIG.defaultModel,
      node: process.version
    });
  }
  if (urlPath === '/api/ai') return handleAi(req, res);

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendJson(res, 405, { error: { type: 'method_not_allowed', message: 'Use GET.' } });
  }
  serveStatic(req, res, urlPath);
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n  Port ${CONFIG.port} is already in use.`);
    console.error(`  Stop the other process, or run:  set PORT=8124 && npm start\n`);
    process.exit(1);
  }
  throw e;
});

server.listen(CONFIG.port, CONFIG.host, () => {
  const url = `http://${CONFIG.host === '0.0.0.0' ? 'localhost' : CONFIG.host}:${CONFIG.port}/`;
  const isLoopback = isLoopbackHost(CONFIG.host);
  console.log('');
  console.log('  AI QA Toolkit');
  console.log('  ' + '-'.repeat(52));
  console.log(`  URL        ${url}`);
  console.log(`  Root       ${ROOT}`);
  console.log(`  Node       ${process.version}`);
  console.log(`  Provider   ${CONFIG.presetName} (${CONFIG.provider} dialect)`);
  console.log(`  Model      ${CONFIG.defaultModel}`);
  console.log(`  Endpoint   ${CONFIG.apiUrl}`);
  console.log(`  AI proxy   ${isConfigured()
    ? (CONFIG.apiKey ? 'ready (key loaded from environment)' : 'ready (local provider, no key needed)')
    : 'NOT configured - see .env.example (AI_PRESET / AI_API_KEY)'}`);
  console.log('  ' + '-'.repeat(52));
  console.log(`  Auth       ${CONFIG.authToken
    ? 'token required on /api/* (AUTH_TOKEN set)'
    : (isLoopback ? 'none - safe only because the bind is loopback' : 'NONE - exposed!')}`);
  console.log(`  Limits     ${CONFIG.ratePerMinute}/min, ${CONFIG.ratePerDay}/day, ` +
    `${CONFIG.rateConcurrent} concurrent per client`);
  console.log(`  Audit      ${audit.enabled ? audit.file : 'disabled'}`);
  console.log(`  Headers    CSP, X-Frame-Options, Referrer-Policy, nosniff` +
    (CONFIG.https ? ', HSTS' : ' (HSTS off - set BEHIND_HTTPS=true when behind TLS)'));
  if (CONFIG.host === '0.0.0.0') {
    console.log('  WARNING    bound to 0.0.0.0 - the AI proxy is reachable from the network');
  }
  console.log('  ' + '-'.repeat(52));
  console.log('  Ctrl+C to stop');
  console.log('');
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log('\n  Shutting down...');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500);
  });
}
