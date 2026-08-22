/* =============================================================================
   AI layer — sends the Messages API request either through this project's own
   Node server, straight to api.anthropic.com, or to any endpoint you name.
   Settings live in localStorage only.

   Three modes:
     server    : POST /api/ai — the bundled Node server (npm start) forwards the
                 request using ANTHROPIC_API_KEY from its own environment, so no
                 key ever exists in the browser. This is the default whenever
                 the server reports a key is loaded.
     anthropic : POST https://api.anthropic.com/v1/messages with a key typed
                 into the browser. Requires the
                 anthropic-dangerous-direct-browser-access header. Fine on a
                 personal machine, not for anything shared.
     custom    : POST <your endpoint> with the same body — an existing gateway
                 or a mock server.
   ========================================================================== */
(function () {
  'use strict';

  var SERVER_PATH = '/api/ai';

  var DEFAULTS = {
    provider: 'anthropic',
    apiKey: '',
    model: 'claude-opus-5',
    endpoint: '',
    effort: 'high',
    maxTokens: 16000,
    lang: 'auto'          // language the AI should answer in: auto | en | vi
  };

  // Models that accept adaptive thinking + output_config.effort
  var MODERN = /^claude-(fable-5|opus-5|sonnet-5|opus-4-(6|7|8)|sonnet-4-6)$/;

  var MODELS = [
    { id: 'claude-opus-5', label: 'Claude Opus 5 — best quality (default)' },
    { id: 'claude-sonnet-5', label: 'Claude Sonnet 5 — balanced' },
    { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 — fastest / cheapest' }
  ];

  var ai = window.QAT.ai = {};

  ai.cfg = function () {
    var saved = QAT.store.get('ai', {}) || {};
    var c = {};
    Object.keys(DEFAULTS).forEach(function (k) {
      c[k] = saved[k] !== undefined && saved[k] !== '' ? saved[k] : DEFAULTS[k];
    });
    if (saved.apiKey !== undefined) c.apiKey = saved.apiKey;
    if (saved.endpoint !== undefined) c.endpoint = saved.endpoint;
    return c;
  };

  ai.save = function (patch) {
    var c = ai.cfg();
    Object.keys(patch).forEach(function (k) { c[k] = patch[k]; });
    QAT.store.set('ai', c);
    return c;
  };

  ai.ready = function () {
    var c = ai.cfg();
    if (c.provider === 'server') return true;      // the server holds the key
    if (c.provider === 'custom') return !!c.endpoint;
    return !!c.apiKey;
  };

  /* ------------------------------------------------- bundled Node server */
  // Filled in by ai.probe(); until then we assume there is no server.
  ai.server = { checked: false, available: false, aiConfigured: false, defaultModel: '', node: '' };

  // "No Node server" has more than one cause, so name the one that actually
  // applies. Saying "you opened index.html directly" to someone running
  // serve.ps1 or Live Server over http is simply wrong.
  // Arguments exist so this is testable without a browser.
  ai.noServerReason = function (protocol, origin) {
    protocol = protocol || location.protocol;
    origin = origin || location.origin;

    if (protocol === 'file:') {
      return QAT.L(
        'No Node server: this page was opened as a local file (' + protocol + '), so there is nothing to ' +
        'call. Run "npm start" and open http://localhost:8123/ to use Server mode.',
        'Không có Node server: trang này đang mở dạng file cục bộ (' + protocol + ') nên không có gì để gọi. ' +
        'Hãy chạy "npm start" rồi mở http://localhost:8123/ để dùng chế độ Server.');
    }
    return QAT.L(
      'No Node server at ' + origin + '. This address serves the files but has no /api/ai endpoint — ' +
      'serve.ps1, Live Server and static hosts do not. Stop it and run "npm start" if you want Server ' +
      'mode; Direct and Custom mode work from here as they are.',
      'Không có Node server ở ' + origin + '. Địa chỉ này serve được file nhưng không có endpoint /api/ai — ' +
      'serve.ps1, Live Server hay static host đều vậy. Hãy tắt nó và chạy "npm start" nếu muốn dùng chế độ ' +
      'Server; còn Direct và Custom thì vẫn dùng được ngay ở đây.');
  };

  ai.probe = function () {
    return fetch('/api/health', { method: 'GET' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        ai.server = {
          checked: true,
          available: !!(j && j.service === 'ai-qa-toolkit'),
          aiConfigured: !!(j && j.aiConfigured),
          defaultModel: (j && j.defaultModel) || '',
          node: (j && j.node) || ''
        };
        return ai.server;
      })
      .catch(function () {
        ai.server = { checked: true, available: false, aiConfigured: false, defaultModel: '', node: '' };
        return ai.server;
      });
  };

  // Called once at boot: pick server mode automatically the first time the
  // toolkit is opened from a server that already has a key.
  ai.autoSelect = function () {
    if (QAT.store.get('ai', null)) return false;          // user already chose
    if (!ai.server.available || !ai.server.aiConfigured) return false;
    ai.save({ provider: 'server', model: ai.server.defaultModel || DEFAULTS.model });
    return true;
  };

  ai.answerLang = function () {
    var c = ai.cfg();
    if (c.lang === 'en') return 'English';
    if (c.lang === 'vi') return 'Vietnamese';
    return QAT.lang === 'vi' ? 'Vietnamese' : 'English';
  };

  /* ------------------------------------------------------------ the request */
  // opts: { system, user, maxTokens, onDelta(text), signal }
  ai.send = function (opts) {
    var c = ai.cfg();
    var body = {
      model: c.model,
      max_tokens: opts.maxTokens || Number(c.maxTokens) || 16000,
      stream: true,
      system: opts.system,
      messages: [{ role: 'user', content: opts.user }]
    };
    if (MODERN.test(c.model)) {
      body.thinking = { type: 'adaptive' };
      body.output_config = { effort: c.effort || 'high' };
    }

    var url, headers = { 'content-type': 'application/json' };
    if (c.provider === 'server') {
      url = SERVER_PATH;
    } else if (c.provider === 'custom') {
      if (!c.endpoint) return Promise.reject(new Error('No proxy endpoint configured.'));
      url = c.endpoint;
    } else {
      if (!c.apiKey) return Promise.reject(new Error('No API key configured.'));
      url = 'https://api.anthropic.com/v1/messages';
      headers['x-api-key'] = c.apiKey;
      headers['anthropic-version'] = '2023-06-01';
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
    }

    return fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body),
      signal: opts.signal
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          var msg = t;
          try { var j = JSON.parse(t); msg = (j.error && j.error.message) || t; } catch (e) {}
          throw new Error('HTTP ' + res.status + ' — ' + msg);
        });
      }
      if (!res.body || !res.body.getReader) {           // proxy returned plain JSON
        return res.json().then(function (j) { return extractText(j, opts.onDelta); });
      }
      return readSSE(res, opts.onDelta);
    });
  };

  function extractText(json, onDelta) {
    var txt = '';
    if (json && Array.isArray(json.content)) {
      json.content.forEach(function (b) { if (b.type === 'text') txt += b.text; });
    } else if (typeof json === 'string') { txt = json; }
    else if (json && json.text) { txt = json.text; }
    if (onDelta && txt) onDelta(txt);
    return { text: txt, usage: json && json.usage, stopReason: json && json.stop_reason };
  }

  function readSSE(res, onDelta) {
    var reader = res.body.getReader();
    var dec = new TextDecoder();
    var buf = '', text = '', usage = null, stopReason = null, apiErr = null;

    function pump() {
      return reader.read().then(function (r) {
        if (r.done) {
          if (apiErr) throw new Error(apiErr);
          return { text: text, usage: usage, stopReason: stopReason };
        }
        buf += dec.decode(r.value, { stream: true });
        var parts = buf.split('\n\n');
        buf = parts.pop();
        parts.forEach(function (chunk) {
          chunk.split('\n').forEach(function (line) {
            if (line.indexOf('data:') !== 0) return;
            var raw = line.slice(5).trim();
            if (!raw || raw === '[DONE]') return;
            var ev;
            try { ev = JSON.parse(raw); } catch (e) { return; }

            if (ev.type === 'content_block_delta' && ev.delta) {
              if (ev.delta.type === 'text_delta' && ev.delta.text) {
                text += ev.delta.text;
                if (onDelta) onDelta(ev.delta.text);
              }
            } else if (ev.type === 'message_delta') {
              if (ev.delta && ev.delta.stop_reason) stopReason = ev.delta.stop_reason;
              if (ev.usage) usage = ev.usage;
            } else if (ev.type === 'message_start' && ev.message && ev.message.usage) {
              usage = ev.message.usage;
            } else if (ev.type === 'error') {
              apiErr = (ev.error && ev.error.message) || 'stream error';
            }
          });
        });
        return pump();
      });
    }
    return pump();
  }

  /* ------------------------------------------------------ reusable tool UI */
  // Markup a tool drops in; wire() below makes it work.
  ai.runBar = function (labelEn, labelVi) {
    return '<div class="row" style="margin-top:2px">' +
      '<button class="btn" data-ai-run>' + QAT.esc(QAT.L(labelEn || 'Generate with AI', labelVi || 'Tạo bằng AI')) + '</button>' +
      '<button class="btn sec" data-ai-stop hidden>' + QAT.L('Stop', 'Dừng') + '</button>' +
      // Works with no provider configured at all: the toolkit does the reading
      // and the prompt engineering, you paste the result into whichever
      // assistant you already pay for.
      '<button class="btn sec" data-ai-prompt title="' +
        QAT.esc(QAT.L('Build the full prompt and copy it, to paste into Claude or any chat assistant. No API key needed.',
                      'Dựng prompt đầy đủ và copy, để dán vào Claude hay trợ lý chat nào bạn đang dùng. Không cần API key.')) +
        '">' + QAT.L('Copy prompt', 'Copy prompt') + '</button>' +
      '<label class="check" title="' +
        QAT.esc(QAT.L('Mask emails, phone numbers, card numbers, tokens and passwords before the text leaves this page.',
                      'Che email, số điện thoại, số thẻ, token và mật khẩu trước khi nội dung rời khỏi trang này.')) +
        '"><input type="checkbox" data-ai-scrub checked> ' +
        QAT.L('Mask sensitive data', 'Che dữ liệu nhạy cảm') + '</label>' +
      '<span class="spacer" style="flex:1"></span>' +
      '<button class="btn sec sm" data-ai-copy>' + QAT.L('Copy result', 'Copy kết quả') + '</button>' +
      '<button class="btn sec sm" data-ai-dl>' + QAT.L('Download .md', 'Tải .md') + '</button>' +
      '</div>' +
      '<div class="status hidden" data-ai-scrub-report style="margin-top:8px"></div>';
  };

  ai.outBlock = function () {
    return '<div class="status hidden" data-ai-status></div>' +
      '<div class="out md tall" data-ai-out data-empty="' +
      QAT.esc(QAT.L('AI output will appear here.', 'Kết quả AI sẽ hiện ở đây.')) + '"></div>';
  };

  // system + user merged into one pasteable block. Exported so it is testable
  // and so tools can reuse it.
  ai.flattenPrompt = function (p) {
    var sys = (p && p.system) ? String(p.system).trim() : '';
    var usr = (p && p.user) ? String(p.user).trim() : '';
    if (!sys) return usr;
    if (!usr) return sys;
    return sys + '\n\n---\n\n' + usr;
  };

  ai.notice = function () {
    var c = ai.cfg();
    if (c.provider === 'server' && ai.server.checked && !ai.server.aiConfigured) {
      return '<div class="status warn" style="margin-bottom:12px">' +
        QAT.L('Server mode is selected but the server has no provider configured. Pick one in .env ' +
              '(AI_PRESET=ollama needs no key; groq / gemini / cerebras / mistral / nvidia / openrouter ' +
              'take a free key) and restart with npm start. Or press "Copy prompt" below and paste into ' +
              'Claude or any chat assistant instead — that needs nothing at all.',
              'Đang dùng chế độ Server nhưng server chưa cấu hình provider. Chọn một cái trong .env ' +
              '(AI_PRESET=ollama không cần key; groq / gemini / cerebras / mistral / nvidia / openrouter ' +
              'dùng key miễn phí) rồi chạy lại npm start. Hoặc bấm "Copy prompt" bên dưới và dán vào ' +
              'Claude hay trợ lý chat bất kỳ — cách này không cần gì cả.') +
        '</div>';
    }
    if (ai.ready()) return '';
    return '<div class="status warn" style="margin-bottom:12px">' +
      QAT.L('No AI provider configured — open AI Settings (bottom-left) to add one. ' +
            'Or skip it entirely: press "Copy prompt" below and paste into Claude or any chat assistant you already use. ' +
            'The toolkit still does the reading and the prompt writing.',
            'Chưa cấu hình provider AI — mở AI Settings (góc dưới bên trái) để thêm. ' +
            'Hoặc bỏ qua hẳn: bấm "Copy prompt" bên dưới rồi dán vào Claude hay trợ lý chat bạn đang dùng. ' +
            'Toolkit vẫn lo phần đọc dữ liệu và viết prompt.') +
      '</div>';
  };

  // buildPrompt() -> { system, user } or throws Error(message)
  ai.wire = function (root, buildPrompt, opts) {
    opts = opts || {};
    var btn = root.querySelector('[data-ai-run]');
    var stopBtn = root.querySelector('[data-ai-stop]');
    var out = root.querySelector('[data-ai-out]');
    var st = QAT.status(root.querySelector('[data-ai-status]'));
    var raw = '', ctrl = null;

    /* Masking is applied to the user content only — the system prompt is our own
       text and contains nothing of the tester's. Returns the prompt to send and
       reports what was masked, so it is visible rather than silent. */
    function prepare() {
      var p = buildPrompt();
      if (!p) return null;
      var box = root.querySelector('[data-ai-scrub]');
      var report = root.querySelector('[data-ai-scrub-report]');
      if (!box || !box.checked || !QAT.scrub) {
        if (report) { report.className = 'status hidden'; report.textContent = ''; }
        return p;
      }
      var r = QAT.scrub(p.user);
      if (report) {
        if (r.total) {
          report.className = 'status info';
          report.textContent = QAT.L('Masked before sending: ', 'Đã che trước khi gửi: ') +
            QAT.scrub.summary(r);
        } else {
          report.className = 'status ok';
          report.textContent = QAT.L('Nothing sensitive detected.', 'Không phát hiện dữ liệu nhạy cảm.');
        }
      }
      return { system: p.system, user: r.text };
    }

    function setBusy(b) {
      btn.disabled = b;
      btn.innerHTML = b
        ? '<span class="spin"></span> ' + QAT.L('Working...', 'Đang xử lý...')
        : QAT.esc(opts.label || QAT.L('Generate with AI', 'Tạo bằng AI'));
      if (stopBtn) stopBtn.hidden = !b;
    }

    btn.addEventListener('click', function () {
      var p;
      try { p = prepare(); } catch (e) { st.err(e.message); return; }
      if (!p) return;
      if (!ai.ready()) { st.err(QAT.L('Configure AI first (AI Settings).', 'Hãy cấu hình AI trước (AI Settings).')); return; }

      raw = ''; out.innerHTML = '';
      st.info(QAT.L('Contacting ', 'Đang gọi ') + ai.cfg().model + '...');
      setBusy(true);
      ctrl = new AbortController();
      var t0 = Date.now();

      ai.send({
        system: p.system, user: p.user, maxTokens: opts.maxTokens, signal: ctrl.signal,
        onDelta: function (d) { raw += d; out.innerHTML = QAT.md(raw); }
      }).then(function (r) {
        setBusy(false);
        raw = r.text || raw;
        out.innerHTML = QAT.md(raw);
        var secs = ((Date.now() - t0) / 1000).toFixed(1);
        var u = r.usage || {};
        st.ok(QAT.L('Done in ', 'Xong sau ') + secs + 's' +
          (u.input_tokens ? ' — in ' + u.input_tokens + ' / out ' + (u.output_tokens || '?') + ' tokens' : '') +
          (r.stopReason === 'max_tokens' ? QAT.L(' (hit max_tokens — output may be cut off)', ' (đạt max_tokens — kết quả có thể bị cắt)') : ''));
      }).catch(function (e) {
        setBusy(false);
        if (e.name === 'AbortError') { st.warn(QAT.L('Stopped.', 'Đã dừng.')); return; }
        st.err(e.message + hintFor(e.message));
      });
    });

    if (stopBtn) stopBtn.addEventListener('click', function () { if (ctrl) ctrl.abort(); });

    // "Copy prompt" — the no-key path. Merges system + user into one block,
    // because chat UIs have no separate system field.
    var pb = root.querySelector('[data-ai-prompt]');
    if (pb) pb.addEventListener('click', function () {
      var p;
      try { p = prepare(); } catch (e) { st.err(e.message); return; }
      if (!p) return;
      var text = ai.flattenPrompt(p);
      QAT.copy(text);
      st.info(QAT.L('Prompt copied (' + text.length + ' chars). Paste it into Claude or any chat assistant — no API key needed.',
                    'Đã copy prompt (' + text.length + ' ký tự). Dán vào Claude hoặc trợ lý chat bất kỳ — không cần API key.'));
    });

    var cp = root.querySelector('[data-ai-copy]');
    if (cp) cp.addEventListener('click', function () { QAT.copy(raw); });
    var dl = root.querySelector('[data-ai-dl]');
    if (dl) dl.addEventListener('click', function () {
      if (!raw) { QAT.toast(QAT.t('msg.nothing'), 'err'); return; }
      QAT.download((opts.filename || 'ai-output') + '.md', raw, 'text/markdown');
    });

    return { get text() { return raw; } };
  };

  function hintFor(msg) {
    if (/not_configured|ANTHROPIC_API_KEY is not set/i.test(msg)) {
      return QAT.L('\n\nHint: copy .env.example to .env, set ANTHROPIC_API_KEY, then restart the server (npm start).',
                   '\n\nGợi ý: copy .env.example thành .env, đặt ANTHROPIC_API_KEY rồi chạy lại server (npm start).');
    }
    if (/Failed to fetch|NetworkError|CORS/i.test(msg)) {
      if (ai.cfg().provider === 'server') {
        return QAT.L('\n\nHint: the Node server is not answering. Start it with "npm start" and open http://localhost:8123/.',
                     '\n\nGợi ý: Node server không phản hồi. Hãy chạy "npm start" rồi mở http://localhost:8123/.');
      }
      if (location.protocol === 'file:') {
        return QAT.L('\n\nHint: browsers block cross-origin calls from file://. Run "npm start" and open http://localhost:8123/ instead.',
                     '\n\nGợi ý: trình duyệt chặn gọi cross-origin từ file://. Hãy chạy "npm start" rồi mở http://localhost:8123/.');
      }
      return QAT.L('\n\nHint: the endpoint refused the call — check the URL, and that it returns CORS headers for ' + location.origin + '.',
                   '\n\nGợi ý: endpoint từ chối kết nối — kiểm tra URL và xem nó có trả CORS header cho ' + location.origin + ' hay không.');
    }
    if (/401|authentication/i.test(msg)) {
      return QAT.L('\n\nHint: check the API key in AI Settings.', '\n\nGợi ý: kiểm tra lại API key trong AI Settings.');
    }
    if (/429/.test(msg)) {
      return QAT.L('\n\nHint: rate limited — wait a moment and retry.', '\n\nGợi ý: bị giới hạn tần suất — chờ chút rồi thử lại.');
    }
    return '';
  }

  /* -------------------------------------------------------- settings modal */
  // Opening the dialog re-checks the server, so the usual sequence — add the
  // key to .env, restart npm start, come back here — reports the truth instead
  // of whatever we learned when the page first loaded.
  ai.openSettings = function () {
    var wrap = document.getElementById('aiModal');
    wrap.hidden = false;
    var before = JSON.stringify(ai.server);
    ai.renderSettings();
    ai.probe().then(function () {
      // only redraw if something actually changed, so a value being typed at
      // that exact moment is not wiped
      if (JSON.stringify(ai.server) !== before && !document.getElementById('aiModal').hidden) {
        ai.renderSettings();
      }
    });
  };

  ai.renderSettings = function () {
    var c = ai.cfg();
    var body = document.getElementById('aiModalBody');

    var srv = ai.server;
    var srvLine = !srv.checked || !srv.available
      ? '<div class="status warn" style="margin-bottom:4px">' + ai.noServerReason() + '</div>'
      : srv.aiConfigured
        ? '<div class="status ok" style="margin-bottom:4px">' +
            QAT.L('Node server detected (', 'Đã thấy Node server (') + srv.node +
            QAT.L(') and it has an API key. Server mode needs no key here.',
                  ') và server đã có API key. Chế độ Server không cần nhập key ở đây.') + '</div>'
        : '<div class="status warn" style="margin-bottom:4px">' +
            QAT.L('Node server detected (', 'Đã thấy Node server (') + srv.node +
            QAT.L(') but ANTHROPIC_API_KEY is not set in its .env file.',
                  ') nhưng chưa đặt ANTHROPIC_API_KEY trong file .env.') + '</div>';

    body.innerHTML =
      '<div class="stack">' +
        srvLine +
        '<label class="fld">' + QAT.L('Mode', 'Chế độ') +
          '<select id="aiProvider">' +
            '<option value="server"' + (c.provider === 'server' ? ' selected' : '') + '>' +
              QAT.L('Server — via this Node server (key stays server-side)',
                    'Server — qua Node server của project (key nằm ở server)') + '</option>' +
            '<option value="anthropic"' + (c.provider === 'anthropic' ? ' selected' : '') + '>' +
              QAT.L('Direct — Claude API from this browser', 'Trực tiếp — gọi Claude API từ trình duyệt') + '</option>' +
            '<option value="custom"' + (c.provider === 'custom' ? ' selected' : '') + '>' +
              QAT.L('Custom — another endpoint of mine', 'Tùy chỉnh — endpoint khác của tôi') + '</option>' +
          '</select>' +
        '</label>' +

        '<div id="aiServer">' +
          '<p class="hint">' +
            QAT.L('Requests go to POST /api/ai. The key is read from the server environment, never sent to the browser — use this mode for any shared deployment.',
                  'Request đi tới POST /api/ai. Key đọc từ môi trường của server, không bao giờ gửi xuống trình duyệt — hãy dùng chế độ này khi triển khai dùng chung.') +
          '</p>' +
        '</div>' +

        '<div id="aiDirect">' +
          '<label class="fld">' + QAT.L('API key', 'API key') +
            '<input type="password" id="aiKey" placeholder="sk-ant-..." value="' + QAT.esc(c.apiKey) + '">' +
          '</label>' +
          '<p class="hint" style="margin-top:6px">' +
            QAT.L('Stored in this browser only (localStorage). Anyone with access to this machine can read it — for shared or public deployments use Proxy mode instead.',
                  'Chỉ lưu trong trình duyệt này (localStorage). Ai dùng được máy này đều có thể đọc — với bản dùng chung hoặc public hãy dùng chế độ Proxy.') +
          '</p>' +
        '</div>' +

        '<div id="aiProxy">' +
          '<label class="fld">' + QAT.L('Endpoint URL', 'Endpoint URL') +
            '<input type="text" id="aiEndpoint" placeholder="https://qa-tools.internal/api/claude" value="' + QAT.esc(c.endpoint) + '">' +
          '</label>' +
          '<p class="hint" style="margin-top:6px">' +
            QAT.L('Receives the same JSON body as /v1/messages and forwards it with your server-side key.',
                  'Nhận đúng JSON body như /v1/messages và chuyển tiếp bằng key phía server.') +
          '</p>' +
        '</div>' +

        '<label class="fld">' + QAT.L('Model', 'Model') +
          '<select id="aiModel">' + MODELS.map(function (m) {
            return '<option value="' + m.id + '"' + (c.model === m.id ? ' selected' : '') + '>' + m.label + '</option>';
          }).join('') + '</select>' +
        '</label>' +

        '<div class="row">' +
          '<label class="fld grow">' + QAT.L('Effort', 'Mức xử lý') +
            '<select id="aiEffort">' + ['low', 'medium', 'high', 'xhigh', 'max'].map(function (e) {
              return '<option value="' + e + '"' + (c.effort === e ? ' selected' : '') + '>' + e + '</option>';
            }).join('') + '</select>' +
          '</label>' +
          '<label class="fld grow">' + QAT.L('Max output tokens', 'Token tối đa') +
            '<input type="number" id="aiMax" min="1000" max="64000" step="1000" value="' + Number(c.maxTokens) + '">' +
          '</label>' +
          '<label class="fld grow">' + QAT.L('Answer language', 'Ngôn ngữ trả lời') +
            '<select id="aiLang">' +
              '<option value="auto"' + (c.lang === 'auto' ? ' selected' : '') + '>' + QAT.L('Follow UI', 'Theo giao diện') + '</option>' +
              '<option value="en"' + (c.lang === 'en' ? ' selected' : '') + '>English</option>' +
              '<option value="vi"' + (c.lang === 'vi' ? ' selected' : '') + '>Tiếng Việt</option>' +
            '</select>' +
          '</label>' +
        '</div>' +

        '<div class="row" style="margin-top:4px">' +
          '<button class="btn" id="aiSave">' + QAT.L('Save', 'Lưu') + '</button>' +
          '<button class="btn sec" id="aiTest">' + QAT.L('Test connection', 'Kiểm tra kết nối') + '</button>' +
          '<span style="flex:1"></span>' +
          '<button class="btn danger" id="aiClear">' + QAT.L('Clear key', 'Xóa key') + '</button>' +
        '</div>' +
        '<div class="status hidden" id="aiCfgStatus"></div>' +
      '</div>';

    var st = QAT.status(body.querySelector('#aiCfgStatus'));

    function toggleMode() {
      var v = body.querySelector('#aiProvider').value;
      body.querySelector('#aiServer').style.display = v === 'server' ? '' : 'none';
      body.querySelector('#aiDirect').style.display = v === 'anthropic' ? '' : 'none';
      body.querySelector('#aiProxy').style.display = v === 'custom' ? '' : 'none';
    }
    body.querySelector('#aiProvider').addEventListener('change', toggleMode);
    toggleMode();

    function collect() {
      return {
        provider: body.querySelector('#aiProvider').value,
        apiKey: body.querySelector('#aiKey').value.trim(),
        endpoint: body.querySelector('#aiEndpoint').value.trim(),
        model: body.querySelector('#aiModel').value,
        effort: body.querySelector('#aiEffort').value,
        maxTokens: Number(body.querySelector('#aiMax').value) || 16000,
        lang: body.querySelector('#aiLang').value
      };
    }

    body.querySelector('#aiSave').addEventListener('click', function () {
      ai.save(collect());
      st.ok(QAT.L('Saved.', 'Đã lưu.'));
      QAT.toast(QAT.L('AI settings saved', 'Đã lưu cấu hình AI'), 'ok');
    });

    body.querySelector('#aiClear').addEventListener('click', function () {
      QAT.store.del('ai');
      st.warn(QAT.L('Cleared. Reopen to re-enter.', 'Đã xóa. Mở lại để nhập mới.'));
      body.querySelector('#aiKey').value = '';
    });

    body.querySelector('#aiTest').addEventListener('click', function () {
      ai.save(collect());
      st.info(QAT.L('Testing...', 'Đang kiểm tra...'));
      ai.send({
        system: 'Reply with exactly: OK',
        user: 'ping',
        maxTokens: 1024
      }).then(function (r) {
        st.ok(QAT.L('Connection OK — model replied: ', 'Kết nối OK — model trả về: ') + (r.text || '').trim().slice(0, 40));
      }).catch(function (e) {
        st.err(e.message + hintFor(e.message));
      });
    });

  };

  ai.MODELS = MODELS;
})();
