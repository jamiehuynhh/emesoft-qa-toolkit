/* =============================================================================
   Provider reachability probe  (npm run probe)
   -----------------------------------------------------------------------------
   Sends one tiny request to every supported provider endpoint and reports what
   comes back. It deliberately does NOT need API keys — the point is to separate
   three failure modes that look identical from inside the toolkit:

     401 / 403  endpoint is correct and reachable; it just wants a valid key
                -> get a key, you are good to go
     404        the URL in the preset is wrong for this provider
                -> the preset needs fixing, a key will not help
     ENOTFOUND / ETIMEDOUT / TLS error
                -> this network cannot reach the provider at all (corporate
                   proxy, firewall, DNS). A key will not help either.

   Run it before spending time signing up anywhere, and run it again from the
   machine you deploy to — the answer is often different there.

   Optional: put a real key in the matching env var and the probe will do a
   real 1-token call so you can see the provider actually answer.
       set GROQ_KEY=gsk_...   &&   npm run probe
   ========================================================================== */

import { PRESETS } from '../server/providers.js';

const TIMEOUT_MS = Number(process.env.PROBE_TIMEOUT_MS) || 15000;

// endpoint + the env var that would hold a real key for a live check
const TARGETS = [
  { name: 'ollama (local)', url: PRESETS.ollama.url, model: 'llama3.2:3b', keyEnv: null, local: true },
  { name: 'groq', url: PRESETS.groq.url, model: PRESETS.groq.model, keyEnv: 'GROQ_KEY' },
  { name: 'gemini', url: PRESETS.gemini.url, model: PRESETS.gemini.model, keyEnv: 'GEMINI_KEY' },
  { name: 'openrouter', url: PRESETS.openrouter.url, model: PRESETS.openrouter.model, keyEnv: 'OPENROUTER_KEY' },
  { name: 'cerebras', url: PRESETS.cerebras.url, model: PRESETS.cerebras.model, keyEnv: 'CEREBRAS_KEY' },
  { name: 'mistral', url: PRESETS.mistral.url, model: PRESETS.mistral.model, keyEnv: 'MISTRAL_KEY' },
  { name: 'nvidia nim', url: PRESETS.nvidia.url, model: PRESETS.nvidia.model, keyEnv: 'NVIDIA_KEY' },
  { name: 'anthropic', url: PRESETS.anthropic.url, model: PRESETS.anthropic.model, keyEnv: 'ANTHROPIC_API_KEY', anthropic: true },
  // probed on purpose, so the retirement stays visible instead of being folklore
  { name: 'github models', url: PRESETS.github.url, model: PRESETS.github.model, keyEnv: null, retired: PRESETS.github.retired }
];

function netReason(e) {
  const seen = [];
  for (let cur = e, i = 0; cur && i < 6; cur = cur.cause, i++) {
    const bit = cur.code || cur.message;
    if (bit && !seen.includes(bit)) seen.push(bit);
  }
  const useful = seen.filter((s) => s !== 'fetch failed');
  return (useful.length ? useful : seen).join(' / ') || 'unknown';
}

async function probe(t) {
  const key = t.keyEnv ? (process.env[t.keyEnv] || '') : '';
  const headers = { 'content-type': 'application/json' };
  let body;

  if (t.anthropic) {
    if (key) headers['x-api-key'] = key;
    headers['anthropic-version'] = '2023-06-01';
    body = { model: t.model, max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] };
  } else {
    if (key) headers.authorization = `Bearer ${key}`;
    body = { model: t.model, max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const t0 = Date.now();

  try {
    const res = await fetch(t.url, {
      method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal
    });
    const ms = Date.now() - t0;
    const text = (await res.text()).slice(0, 300);
    let msg = text.replace(/\s+/g, ' ').trim();
    try {
      const j = JSON.parse(text);
      msg = (j.error && (j.error.message || j.error)) || j.message || j.detail || msg;
      if (typeof msg !== 'string') msg = JSON.stringify(msg);
    } catch { /* keep raw */ }
    return { status: res.status, ms, msg: msg.slice(0, 160), keyUsed: Boolean(key) };
  } catch (e) {
    clearTimeout(timer);
    return {
      status: null, ms: Date.now() - t0,
      msg: e.name === 'AbortError' ? `no answer within ${TIMEOUT_MS}ms` : netReason(e),
      keyUsed: Boolean(key)
    };
  } finally {
    clearTimeout(timer);
  }
}

function verdict(r, t) {
  if (t.retired) return ['RETIRED', `service shut down ${t.retired} - do not use`];
  if (r.status === null) {
    return t.local
      ? ['DOWN', 'not running on this machine - start Ollama']
      : ['BLOCKED', 'this network cannot reach it - a key will not help'];
  }
  if (r.status === 200) return ['OK', r.keyUsed ? 'answered a real request' : 'answered without a key'];
  if (r.status === 401 || r.status === 403) return ['NEEDS KEY', 'endpoint correct + reachable'];
  if (r.status === 404) return ['BAD URL', 'endpoint path is wrong for this provider'];
  // 410 Gone: the endpoint used to exist. Treat as retired even if the preset
  // does not say so yet - that is exactly how we found out about GitHub Models.
  if (r.status === 410) return ['RETIRED', 'endpoint returns 410 Gone'];
  if (r.status === 400) {
    // several providers answer a keyless request with 400, not 401
    return /auth|api[- ]?key|credential|token/i.test(r.msg)
      ? ['NEEDS KEY', 'endpoint correct + reachable (answers 400 when unauthenticated)']
      : ['REACHED', 'endpoint reachable; request rejected (often the model id)'];
  }
  if (r.status === 429) return ['RATE LIMITED', 'reachable, over the limit'];
  if (r.status >= 500) return ['PROVIDER DOWN', 'their side'];
  return ['?', `unexpected status ${r.status}`];
}

console.log('');
console.log('  Provider reachability probe');
console.log('  ' + '-'.repeat(76));
console.log('  ' + 'provider'.padEnd(16) + 'status'.padEnd(9) + 'verdict'.padEnd(16) + 'detail');
console.log('  ' + '-'.repeat(76));

const rows = [];
for (const t of TARGETS) {
  const r = await probe(t);
  const [v, why] = verdict(r, t);
  rows.push({ provider: t.name, status: r.status, verdict: v, ms: r.ms, why, msg: r.msg });
  console.log('  ' +
    t.name.padEnd(16) +
    String(r.status ?? '-').padEnd(9) +
    v.padEnd(16) +
    `${r.ms}ms  ${why}`);
  if (r.msg && v !== 'OK') console.log('  ' + ' '.repeat(25) + r.msg.slice(0, 90));
}

console.log('  ' + '-'.repeat(76));
const usable = rows.filter((r) => r.verdict === 'NEEDS KEY' || r.verdict === 'OK');
const blocked = rows.filter((r) => r.verdict === 'BLOCKED');
const badUrl = rows.filter((r) => r.verdict === 'BAD URL');

console.log(`  reachable: ${usable.length}/${rows.length}` +
  (blocked.length ? `   blocked by this network: ${blocked.map((r) => r.provider).join(', ')}` : '') +
  (badUrl.length ? `   wrong url: ${badUrl.map((r) => r.provider).join(', ')}` : ''));
console.log('');
console.log('  NEEDS KEY = ready to use as soon as you paste a free key into .env.');
console.log('  Run this again on the deployment host: the network there decides too.');
console.log('');
