/* =============================================================================
   Mock AI provider  (npm run mock)
   -----------------------------------------------------------------------------
   A tiny OpenAI-compatible endpoint that streams a canned answer. It exists so
   the four AI tools can be exercised end to end with no account, no API key and
   no cost — useful for UI work, for demos, and for checking that the streaming
   path still works after a change.

   Terminal 1:  npm run mock
   Terminal 2:  set AI_PROVIDER=openai
                set AI_API_URL=http://127.0.0.1:8199/v1/chat/completions
                set AI_MODEL=mock-1
                npm start

   The reply is canned text, NOT a real model. Never use it to judge output
   quality — only to verify plumbing.
   ========================================================================== */

import http from 'node:http';

const PORT = Number(process.env.MOCK_PORT) || 8199;

const CANNED = `## Mock provider response

This text came from \`scripts/mock-provider.js\`, not from a language model.
It exists to prove the streaming path works: server translation, SSE parsing in
the browser, incremental markdown rendering, token/timing readout and the Stop
button.

| ID | Title | Type | Priority | Expected Result |
|----|-------|------|----------|-----------------|
| TC-001 | Valid login | Positive | High | Redirects to dashboard, session cookie set |
| TC-002 | Wrong OTP | Negative | High | Shows "Invalid code", attempt counter increments |
| TC-003 | OTP after 60s | Boundary | High | Rejected as expired |
| TC-004 | 5 wrong attempts | Negative | High | Account locked for 15 minutes |

**Coverage notes**

- Covered: happy path, expiry boundary, lockout threshold.
- Not covered: SMS delivery failure — needs a gateway stub.

> Replace this mock with a real provider (\`AI_PRESET=ollama\` or
> \`AI_PRESET=gemini\`) when you want actual generated content.
`;

function chunk(id, model, delta, finish) {
  return 'data: ' + JSON.stringify({
    id, object: 'chat.completion.chunk', model,
    choices: [{ index: 0, delta, finish_reason: finish || null }]
  }) + '\n\n';
}

const server = http.createServer(async (req, res) => {
  const path = (req.url || '/').split('?')[0];

  if (path === '/health' || path === '/') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'mock-ai-provider', port: PORT }));
    return;
  }

  if (!/\/chat\/completions$/.test(path) || req.method !== 'POST') {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'POST /v1/chat/completions only' } }));
    return;
  }

  // read (and ignore) the request so we can log what the toolkit sent
  let body = '';
  for await (const c of req) body += c;
  let parsed = {};
  try { parsed = JSON.parse(body); } catch { /* ignore */ }
  const model = parsed.model || 'mock-1';
  const roles = (parsed.messages || []).map((m) => m.role).join(',');
  console.log(`  <- ${model}  messages: [${roles}]  chars: ${body.length}`);

  if (parsed.stream === false) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      id: 'mock-1', object: 'chat.completion', model,
      choices: [{ index: 0, message: { role: 'assistant', content: CANNED }, finish_reason: 'stop' }],
      usage: { prompt_tokens: Math.ceil(body.length / 4), completion_tokens: Math.ceil(CANNED.length / 4) }
    }));
    return;
  }

  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-store',
    connection: 'keep-alive'
  });

  const id = 'mock-' + CANNED.length;
  res.write(chunk(id, model, { role: 'assistant' }));

  // stream a few words at a time so the UI visibly fills in
  const words = CANNED.split(/(\s+)/);
  let i = 0;
  const timer = setInterval(() => {
    if (res.writableEnded) { clearInterval(timer); return; }
    const piece = words.slice(i, i + 6).join('');
    i += 6;
    if (piece) res.write(chunk(id, model, { content: piece }));
    if (i >= words.length) {
      clearInterval(timer);
      res.write('data: ' + JSON.stringify({
        id, object: 'chat.completion.chunk', model,
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
        usage: {
          prompt_tokens: Math.ceil(body.length / 4),
          completion_tokens: Math.ceil(CANNED.length / 4)
        }
      }) + '\n\n');
      res.write('data: [DONE]\n\n');
      res.end();
      console.log('  -> streamed ' + CANNED.length + ' chars');
    }
  }, 40);

  req.on('aborted', () => { clearInterval(timer); console.log('  -> client aborted'); });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('  Mock AI provider (OpenAI-compatible)');
  console.log('  ' + '-'.repeat(52));
  console.log(`  Endpoint   http://127.0.0.1:${PORT}/v1/chat/completions`);
  console.log('  Point the toolkit at it with:');
  console.log('    set AI_PROVIDER=openai');
  console.log(`    set AI_API_URL=http://127.0.0.1:${PORT}/v1/chat/completions`);
  console.log('    set AI_MODEL=mock-1');
  console.log('    npm start');
  console.log('  ' + '-'.repeat(52));
  console.log('  Canned text only - not a real model. Ctrl+C to stop.');
  console.log('');
});
