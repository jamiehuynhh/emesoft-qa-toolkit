/* =============================================================================
   Provider adapter
   -----------------------------------------------------------------------------
   The browser always speaks one dialect: the Claude Messages API. That keeps
   js/ai.js and all four AI tools provider-agnostic — the translation happens
   here, in the server, where the credentials already live.

   Two provider modes:
     anthropic : pass the body straight through (no translation at all).
     openai    : translate to/from the OpenAI Chat Completions dialect. That one
                 dialect covers every free option worth using — Ollama running
                 locally, Google Gemini, Groq, OpenRouter, GitHub Models,
                 Mistral, Together — because they all expose it.

   Everything here is a pure function so scripts/selftest.js can assert it
   without a network or a server.
   ========================================================================== */

/* ------------------------------------------------------- request direction */

// Claude puts the system prompt in its own top-level field; OpenAI wants it as
// the first message. Content blocks are flattened to text — this toolkit only
// ever sends plain strings, but a malformed caller should not crash the proxy.
function flattenContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((b) => (typeof b === 'string' ? b : b && b.type === 'text' ? b.text : ''))
      .filter(Boolean)
      .join('\n');
  }
  if (content && typeof content === 'object' && content.text) return String(content.text);
  return '';
}

export function toOpenAIRequest(body, opts = {}) {
  const messages = [];

  if (body.system) {
    messages.push({ role: 'system', content: flattenContent(body.system) });
  }
  for (const m of body.messages || []) {
    messages.push({ role: m.role, content: flattenContent(m.content) });
  }

  const out = {
    // The browser sends a claude-* id; the server decides what actually runs.
    model: opts.model || body.model,
    messages,
    stream: true
  };
  if (body.max_tokens) out.max_tokens = body.max_tokens;
  if (typeof body.temperature === 'number') out.temperature = body.temperature;

  // Not every OpenAI-compatible server accepts stream_options, and a rejected
  // request is worse than missing token counts — so this is opt-in.
  if (opts.streamUsage) out.stream_options = { include_usage: true };

  // Claude-only knobs have no OpenAI equivalent and must not be forwarded.
  // (thinking, output_config/effort, top_k, ...)
  return out;
}

/* ------------------------------------------------------ response direction */

const STOP_REASON = {
  stop: 'end_turn',
  length: 'max_tokens',
  tool_calls: 'tool_use',
  content_filter: 'refusal',
  function_call: 'tool_use'
};

function sse(type, payload) {
  return `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
}

/* Turns an OpenAI SSE stream into the Claude SSE events js/ai.js listens for:
   message_start -> content_block_start -> content_block_delta* ->
   content_block_stop -> message_delta -> message_stop                        */
export function createStreamTranslator(model) {
  let started = false;
  let closed = false;
  let stopReason = 'end_turn';
  let usage = null;

  function open() {
    if (started) return '';
    started = true;
    return sse('message_start', {
      type: 'message_start',
      message: {
        id: 'msg_proxy', type: 'message', role: 'assistant',
        model, content: [], stop_reason: null,
        usage: { input_tokens: 0, output_tokens: 0 }
      }
    }) + sse('content_block_start', {
      type: 'content_block_start', index: 0,
      content_block: { type: 'text', text: '' }
    });
  }

  return {
    /* Feed one `data:` payload (already stripped of the "data: " prefix).
       Returns the SSE text to write downstream, possibly empty.             */
    push(raw) {
      if (closed) return '';
      const line = String(raw).trim();
      if (!line) return '';
      if (line === '[DONE]') return this.end();

      let ev;
      try { ev = JSON.parse(line); } catch { return ''; }

      if (ev.error) {
        closed = true;
        return sse('error', {
          type: 'error',
          error: { type: ev.error.type || 'api_error', message: ev.error.message || 'upstream error' }
        });
      }

      if (ev.usage) {
        usage = {
          input_tokens: ev.usage.prompt_tokens ?? 0,
          output_tokens: ev.usage.completion_tokens ?? 0
        };
      }

      const choice = (ev.choices || [])[0];
      if (!choice) return '';

      if (choice.finish_reason) {
        stopReason = STOP_REASON[choice.finish_reason] || 'end_turn';
      }

      // Some servers send reasoning separately; it is not the answer text.
      const text = choice.delta ? choice.delta.content : undefined;
      if (typeof text === 'string' && text !== '') {
        return open() + sse('content_block_delta', {
          type: 'content_block_delta', index: 0,
          delta: { type: 'text_delta', text }
        });
      }
      return '';
    },

    /* Close the stream. Safe to call twice. */
    end() {
      if (closed) return '';
      closed = true;
      return open() +
        sse('content_block_stop', { type: 'content_block_stop', index: 0 }) +
        sse('message_delta', {
          type: 'message_delta',
          delta: { stop_reason: stopReason, stop_sequence: null },
          usage: usage || { input_tokens: 0, output_tokens: 0 }
        }) +
        sse('message_stop', { type: 'message_stop' });
    },

    /* Report an upstream failure mid-stream in a shape the UI understands. */
    fail(message) {
      if (closed) return '';
      closed = true;
      return sse('error', { type: 'error', error: { type: 'upstream_error', message } });
    }
  };
}

/* A non-streaming OpenAI response (some gateways ignore stream:true). */
export function openAIResponseToAnthropic(json, model) {
  const choice = (json.choices || [])[0] || {};
  const text = (choice.message && choice.message.content) || '';
  return {
    id: json.id || 'msg_proxy',
    type: 'message',
    role: 'assistant',
    model: json.model || model,
    content: [{ type: 'text', text }],
    stop_reason: STOP_REASON[choice.finish_reason] || 'end_turn',
    usage: {
      input_tokens: json.usage ? json.usage.prompt_tokens ?? 0 : 0,
      output_tokens: json.usage ? json.usage.completion_tokens ?? 0 : 0
    }
  };
}

/* ------------------------------------------------------------------ presets */
/* Documented so `.env` only needs a name, not four URLs to get wrong. */
export const PRESETS = {
  anthropic: {
    provider: 'anthropic',
    label: 'Anthropic Claude (paid)',
    url: 'https://api.anthropic.com/v1/messages',
    model: 'claude-opus-5',
    needsKey: true
  },
  ollama: {
    provider: 'openai',
    label: 'Ollama (local, free, offline)',
    url: 'http://127.0.0.1:11434/v1/chat/completions',
    model: 'llama3.2:3b',
    needsKey: false
  },
  gemini: {
    provider: 'openai',
    label: 'Google Gemini (free tier)',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    model: 'gemini-2.5-flash',
    needsKey: true
  },
  groq: {
    provider: 'openai',
    label: 'Groq (free tier)',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
    needsKey: true
  },
  openrouter: {
    provider: 'openai',
    label: 'OpenRouter (has free models)',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    needsKey: true
  },
  cerebras: {
    provider: 'openai',
    label: 'Cerebras (free tier)',
    url: 'https://api.cerebras.ai/v1/chat/completions',
    model: 'llama-3.3-70b',
    needsKey: true
  },
  mistral: {
    provider: 'openai',
    label: 'Mistral (free tier)',
    url: 'https://api.mistral.ai/v1/chat/completions',
    model: 'mistral-small-latest',
    needsKey: true
  },
  nvidia: {
    provider: 'openai',
    label: 'NVIDIA NIM (free tier)',
    url: 'https://integrate.api.nvidia.com/v1/chat/completions',
    model: 'meta/llama-3.1-8b-instruct',
    needsKey: true
  },

  // Kept deliberately: an old .env saying AI_PRESET=github must produce a clear
  // explanation, not a silent fallback to a provider the user did not choose.
  github: {
    provider: 'openai',
    label: 'GitHub Models',
    url: 'https://models.github.ai/inference/chat/completions',
    model: 'openai/gpt-4.1-mini',
    needsKey: true,
    retired: '2026-07-30',
    retiredNote: 'GitHub Models was fully retired on 2026-07-30 (playground, catalog, ' +
                 'inference API and BYOK). Pick another provider: groq, gemini, cerebras, ' +
                 'mistral, nvidia, openrouter, ollama or anthropic.'
  }
};

// Model ids drift as providers add and remove models. If a request comes back
// "model not found", take the current id from the provider's model list and set
// AI_MODEL - the endpoint itself rarely changes.

export function resolvePreset(name) {
  if (!name) return null;
  return PRESETS[String(name).trim().toLowerCase()] || null;
}

export function retiredPresets() {
  return Object.keys(PRESETS).filter((k) => PRESETS[k].retired);
}
