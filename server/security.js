/* =============================================================================
   Security middleware — headers, auth gate, rate limits, audit log
   -----------------------------------------------------------------------------
   Everything here exists because /api/ai holds a credential and spends money
   with it. Until now the only thing protecting it was binding to 127.0.0.1,
   which stops being true the moment anyone sets HOST=0.0.0.0.

   Zero dependencies. State is in-process, which is the right trade for a single
   instance; behind a load balancer you would move the counters to Redis.
   ========================================================================== */

import { timingSafeEqual } from 'node:crypto';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

/* --------------------------------------------------------------- headers */

/* The toolkit's own API Response Analyzer flags every header missing below —
   it used to fail its own check. connect-src has to stay configurable: the
   browser's "Direct" mode calls api.anthropic.com straight from the page, and
   "Custom" mode calls whatever endpoint the user names, so a hardcoded list
   would silently break those modes. */
export function securityHeaders(opts = {}) {
  const connect = ["'self'", ...(opts.connectExtra || ['https://api.anthropic.com'])].join(' ');

  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    // the markup uses style="..." attributes; no inline <script> anywhere
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src ${connect}`,
    "form-action 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'"
  ].join('; ');

  const headers = {
    'content-security-policy': csp,
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'permissions-policy': 'geolocation=(), camera=(), microphone=(), payment=()',
    'cross-origin-opener-policy': 'same-origin'
  };

  // Only meaningful over TLS, and harmful to send over plain http on localhost.
  if (opts.https) headers['strict-transport-security'] = 'max-age=31536000; includeSubDomains';

  return headers;
}

/* ------------------------------------------------------------------ auth */

export function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;      // length is not a secret here
  return timingSafeEqual(ab, bb);
}

export function extractToken(req) {
  const h = req.headers || {};
  const auth = h.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  if (m) return m[1].trim();
  if (h['x-api-token']) return String(h['x-api-token']).trim();
  return '';
}

/* Returns null when the request may proceed, or { status, message }. */
export function checkAuth(req, token) {
  if (!token) return null;                        // auth not enabled
  const given = extractToken(req);
  if (!given) {
    return { status: 401, message: 'This deployment requires a token. Send it as "Authorization: Bearer <token>".' };
  }
  if (!safeEqual(given, token)) {
    return { status: 403, message: 'Invalid token.' };
  }
  return null;
}

/* A loopback bind is the only thing that makes an unauthenticated proxy safe.
   Refuse the combination that quietly exposes credentials to the network. */
export function isLoopbackHost(host) {
  return host === '127.0.0.1' || host === 'localhost' || host === '::1';
}

export function guardExposure({ host, token, allowInsecure }) {
  if (isLoopbackHost(host) || token || allowInsecure) return null;
  return 'Refusing to start: HOST=' + host + ' exposes /api/ai to the network with no ' +
         'authentication, so anyone who can reach this port can spend your AI quota.\n' +
         'Fix one of these in .env:\n' +
         '  AUTH_TOKEN=<a long random string>   (then send Authorization: Bearer <token>)\n' +
         '  HOST=127.0.0.1                      (keep it local, put a reverse proxy in front)\n' +
         '  ALLOW_INSECURE_EXPOSURE=true        (only if something else already authenticates)';
}

/* ------------------------------------------------------------ rate limits */

/* Sliding window per client, plus a live concurrency count and a daily total.
   The daily total is the one that actually protects the bill: a runaway loop
   trips it long before the provider invoice does. */
export function createRateLimiter(opts = {}) {
  const perMinute = opts.perMinute ?? 20;
  const perDay = opts.perDay ?? 500;
  const maxConcurrent = opts.maxConcurrent ?? 3;
  const windowMs = opts.windowMs ?? 60_000;
  const now = opts.now || (() => Date.now());

  const clients = new Map();   // key -> { hits: number[], day: string, dayCount, live }

  function dayKey(t) { return new Date(t).toISOString().slice(0, 10); }

  function entry(key, t) {
    let e = clients.get(key);
    if (!e) { e = { hits: [], day: dayKey(t), dayCount: 0, live: 0 }; clients.set(key, e); }
    if (e.day !== dayKey(t)) { e.day = dayKey(t); e.dayCount = 0; }
    return e;
  }

  return {
    /* Returns null to allow, or { status, message, retryAfter }. */
    check(key) {
      const t = now();
      const e = entry(key, t);
      e.hits = e.hits.filter((x) => t - x < windowMs);

      if (e.live >= maxConcurrent) {
        return {
          status: 429, retryAfter: 5,
          message: `Too many requests in flight (${e.live}/${maxConcurrent}). Wait for one to finish.`
        };
      }
      if (e.hits.length >= perMinute) {
        const wait = Math.ceil((windowMs - (t - e.hits[0])) / 1000);
        return {
          status: 429, retryAfter: Math.max(1, wait),
          message: `Rate limit: ${perMinute} requests per minute. Try again in ${Math.max(1, wait)}s.`
        };
      }
      if (e.dayCount >= perDay) {
        return {
          status: 429, retryAfter: 3600,
          message: `Daily cap reached (${perDay} requests). This protects the shared quota; it resets at UTC midnight.`
        };
      }
      e.hits.push(t);
      e.dayCount++;
      return null;
    },

    begin(key) { entry(key, now()).live++; },
    end(key) {
      const e = clients.get(key);
      if (e && e.live > 0) e.live--;
    },
    stats(key) {
      const e = clients.get(key);
      return e ? { live: e.live, today: e.dayCount, lastMinute: e.hits.length } : { live: 0, today: 0, lastMinute: 0 };
    },
    // stop unbounded growth from one-off clients
    sweep() {
      const t = now();
      for (const [k, e] of clients) {
        if (e.live === 0 && !e.hits.length && e.day !== dayKey(t)) clients.delete(k);
      }
      return clients.size;
    },
    get size() { return clients.size; }
  };
}

/* The client key. X-Forwarded-For is only trusted when told to, because behind
   no proxy it is attacker-controlled and would let anyone reset their own
   limit by sending a new value. */
export function clientKey(req, { trustProxy = false } = {}) {
  if (trustProxy) {
    const xff = req.headers && req.headers['x-forwarded-for'];
    if (xff) return String(xff).split(',')[0].trim();
  }
  const s = req.socket || {};
  return s.remoteAddress || 'unknown';
}

/* ------------------------------------------------------------- audit log */

/* Append-only JSONL. On a shared deployment "who called what, and how often" is
   usually a requirement rather than a nice-to-have. Deliberately does NOT record
   prompt text - only metadata, so the log itself does not become a second copy
   of the data it is auditing. */
export function createAuditLog(file, { enabled = true } = {}) {
  let ready = null;

  async function ensure() {
    if (!ready) ready = mkdir(dirname(file), { recursive: true }).catch(() => {});
    return ready;
  }

  return {
    file,
    enabled,
    async write(event) {
      if (!enabled) return;
      const line = JSON.stringify({ ts: new Date().toISOString(), ...event }) + '\n';
      try {
        await ensure();
        await appendFile(file, line, 'utf8');
      } catch (e) {
        // never let auditing break the request it is auditing
        console.error('  audit write failed:', e.message);
      }
    }
  };
}

export function auditEvent(req, { action, key, outcome, detail }) {
  return {
    action,
    client: key,
    outcome,
    ua: (req.headers && req.headers['user-agent'] || '').slice(0, 120),
    ...(detail || {})
  };
}
