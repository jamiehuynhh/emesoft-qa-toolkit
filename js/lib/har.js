/* =============================================================================
   HAR (HTTP Archive) parser + analyser
   -----------------------------------------------------------------------------
   A .har is what DevTools gives you when a tester says "the page was slow" or
   "it failed but only sometimes". Reading it by hand means scrolling raw JSON,
   so the interesting requests stay hidden.

   The findings logic is deliberately the same shape as the API Response
   Analyzer's - same thresholds, same header list - so a single request and a
   whole session get judged by the same rules.

   Pure functions only: no DOM, so scripts/selftest.js can assert all of it.
   ========================================================================== */
(function () {
  'use strict';

  var SLOW_MS = 1000;
  var VERY_SLOW_MS = 3000;
  var BIG_BODY = 500 * 1024;
  var SEC_HEADERS = [
    ['strict-transport-security', 'HSTS'],
    ['x-content-type-options', 'nosniff'],
    ['x-frame-options', 'clickjacking'],
    ['content-security-policy', 'CSP']
  ];
  // query params that should never be in a URL - they end up in logs and history
  var SECRET_PARAM = /^(pass(word)?|pwd|token|secret|api[_-]?key|access[_-]?token|auth|sig|signature|otp)$/i;

  function header(list, name) {
    if (!Array.isArray(list)) return '';
    var lower = name.toLowerCase();
    for (var i = 0; i < list.length; i++) {
      if (list[i] && String(list[i].name).toLowerCase() === lower) return String(list[i].value || '');
    }
    return '';
  }

  function shortUrl(url, max) {
    max = max || 70;
    var s = String(url || '');
    try {
      var u = new URL(s);
      s = u.pathname + (u.search ? u.search : '');
      if (s === '/' || s === '') s = u.host;
    } catch (e) { /* keep raw */ }
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
  }

  function origin(url) {
    try { return new URL(url).origin; } catch (e) { return ''; }
  }

  /* -------------------------------------------------------------- parsing */

  function parse(text) {
    var json;
    try { json = JSON.parse(text); }
    catch (e) { throw new Error('Not valid JSON — a .har file is JSON exported from DevTools.'); }

    var log = json && json.log;
    if (!log || !Array.isArray(log.entries)) {
      throw new Error('No log.entries array — this JSON is not a HAR file.');
    }

    var entries = log.entries.map(function (e, i) {
      var req = e.request || {};
      var res = e.response || {};
      var t = e.timings || {};
      var size = (res.content && res.content.size) || res.bodySize || 0;
      return {
        index: i,
        started: e.startedDateTime || '',
        method: req.method || '',
        url: req.url || '',
        path: shortUrl(req.url),
        origin: origin(req.url),
        status: res.status || 0,
        statusText: res.statusText || '',
        type: e._resourceType || (res.content && res.content.mimeType) || '',
        mime: (res.content && res.content.mimeType) || '',
        // HAR time is in ms and can be -1 when unknown
        time: typeof e.time === 'number' && e.time >= 0 ? e.time : 0,
        wait: typeof t.wait === 'number' && t.wait >= 0 ? t.wait : 0,
        blocked: typeof t.blocked === 'number' && t.blocked >= 0 ? t.blocked : 0,
        size: size > 0 ? size : 0,
        reqBodySize: req.bodySize > 0 ? req.bodySize : 0,
        reqHeaders: req.headers || [],
        resHeaders: res.headers || [],
        cookies: res.cookies || [],
        query: req.queryString || [],
        cacheControl: header(res.headers, 'cache-control'),
        contentType: header(res.headers, 'content-type'),
        server: header(res.headers, 'server') || header(res.headers, 'x-powered-by')
      };
    });

    return {
      creator: (log.creator && log.creator.name) || 'unknown',
      version: log.version || '',
      pages: (log.pages || []).length,
      entries: entries
    };
  }

  /* ------------------------------------------------------------- analysis */

  function summarize(entries) {
    var byClass = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0, other: 0 };
    var totalTime = 0, totalSize = 0, slowest = null;

    entries.forEach(function (e) {
      var c = Math.floor(e.status / 100);
      if (c === 2) byClass['2xx']++;
      else if (c === 3) byClass['3xx']++;
      else if (c === 4) byClass['4xx']++;
      else if (c === 5) byClass['5xx']++;
      else byClass.other++;
      totalTime += e.time;
      totalSize += e.size;
      if (!slowest || e.time > slowest.time) slowest = e;
    });

    var times = entries.map(function (e) { return e.time; }).sort(function (a, b) { return a - b; });
    function pct(p) {
      if (!times.length) return 0;
      return times[Math.min(times.length - 1, Math.floor(times.length * p))];
    }

    // wall clock, not the sum: requests overlap
    var span = 0;
    var stamps = entries.map(function (e) { return Date.parse(e.started); })
      .filter(function (n) { return !isNaN(n); });
    if (stamps.length) {
      var first = Math.min.apply(null, stamps);
      var lastEnd = Math.max.apply(null, entries.map(function (e) {
        var s = Date.parse(e.started);
        return isNaN(s) ? 0 : s + e.time;
      }));
      span = Math.max(0, lastEnd - first);
    }

    return {
      count: entries.length,
      byClass: byClass,
      totalTime: Math.round(totalTime),
      wallClock: Math.round(span),
      totalSize: totalSize,
      slowest: slowest,
      median: Math.round(pct(0.5)),
      p95: Math.round(pct(0.95)),
      origins: Object.keys(entries.reduce(function (acc, e) {
        if (e.origin) acc[e.origin] = 1;
        return acc;
      }, {}))
    };
  }

  /* Findings. Each: { level, title, detail, entries:[index] } */
  function findings(entries, opts) {
    opts = opts || {};
    var slowMs = opts.slowMs || SLOW_MS;
    var out = [];

    function add(level, title, detail, list) {
      out.push({ level: level, title: title, detail: detail, entries: (list || []).map(function (e) { return e.index; }) });
    }

    // --- failures first: they explain most "it broke" reports
    var server = entries.filter(function (e) { return e.status >= 500; });
    if (server.length) {
      add('err', server.length + ' server error(s) (5xx)',
        server.slice(0, 6).map(function (e) { return e.status + ' ' + e.method + ' ' + e.path; }).join('\n'), server);
    }
    var client = entries.filter(function (e) { return e.status >= 400 && e.status < 500; });
    if (client.length) {
      // 401/403/404 on an API path is usually the actual defect
      add('warn', client.length + ' client error(s) (4xx)',
        client.slice(0, 6).map(function (e) { return e.status + ' ' + e.method + ' ' + e.path; }).join('\n'), client);
    }
    var noStatus = entries.filter(function (e) { return e.status === 0; });
    if (noStatus.length) {
      add('err', noStatus.length + ' request(s) never completed',
        'Status 0 means aborted, blocked or a network failure — often CORS or a cancelled navigation.\n' +
        noStatus.slice(0, 6).map(function (e) { return e.method + ' ' + e.path; }).join('\n'), noStatus);
    }

    // --- performance
    var verySlow = entries.filter(function (e) { return e.time >= VERY_SLOW_MS; });
    var slow = entries.filter(function (e) { return e.time >= slowMs && e.time < VERY_SLOW_MS; });
    if (verySlow.length) {
      add('err', verySlow.length + ' request(s) over 3s',
        verySlow.slice(0, 6).map(function (e) { return Math.round(e.time) + 'ms  ' + e.method + ' ' + e.path; }).join('\n'), verySlow);
    }
    if (slow.length) {
      add('warn', slow.length + ' request(s) over ' + slowMs + 'ms',
        slow.slice(0, 6).map(function (e) { return Math.round(e.time) + 'ms  ' + e.method + ' ' + e.path; }).join('\n'), slow);
    }
    // server thinking time vs transfer time tells you where to look
    var waity = entries.filter(function (e) { return e.wait >= slowMs && e.wait > e.time * 0.7; });
    if (waity.length) {
      add('info', waity.length + ' request(s) spent most of the time waiting for the server',
        'High TTFB points at backend or database work, not the network.\n' +
        waity.slice(0, 5).map(function (e) { return Math.round(e.wait) + 'ms wait  ' + e.path; }).join('\n'), waity);
    }

    // --- the N+1 pattern: the same call repeated in one session
    var groups = {};
    entries.forEach(function (e) {
      var k = e.method + ' ' + e.url;
      (groups[k] = groups[k] || []).push(e);
    });
    var repeated = Object.keys(groups)
      .filter(function (k) { return groups[k].length >= 5; })
      .sort(function (a, b) { return groups[b].length - groups[a].length; });
    if (repeated.length) {
      add('warn', 'Repeated identical request(s)',
        repeated.slice(0, 5).map(function (k) {
          return groups[k].length + 'x  ' + k.split(' ')[0] + ' ' + shortUrl(k.split(' ').slice(1).join(' '));
        }).join('\n') + '\nA call repeated many times in one session is usually an N+1 or a missing cache.',
        repeated.reduce(function (acc, k) { return acc.concat(groups[k]); }, []));
    }

    // --- payload size
    var big = entries.filter(function (e) { return e.size >= BIG_BODY; });
    if (big.length) {
      add('warn', big.length + ' response(s) over ' + Math.round(BIG_BODY / 1024) + ' KB',
        big.slice(0, 6).map(function (e) { return Math.round(e.size / 1024) + ' KB  ' + e.path; }).join('\n'), big);
    }

    // --- security: only judged on documents and API responses
    var docs = entries.filter(function (e) {
      return /html/i.test(e.contentType) && e.status >= 200 && e.status < 300;
    });
    if (docs.length) {
      SEC_HEADERS.forEach(function (h) {
        var missing = docs.filter(function (e) { return !header(e.resHeaders, h[0]); });
        if (missing.length === docs.length) {
          add('warn', 'Missing header on every HTML response: ' + h[0],
            h[1] + ' protection is not enabled.', missing);
        }
      });
    }
    var leaky = entries.filter(function (e) { return e.server; });
    if (leaky.length) {
      add('info', leaky.length + ' response(s) advertise the server software',
        'Server / X-Powered-By reveals the stack: ' +
        Array.from(new Set(leaky.map(function (e) { return e.server; }))).slice(0, 4).join(', '), leaky);
    }
    // secrets in the URL end up in proxy logs, browser history and this HAR file
    var secretUrls = entries.filter(function (e) {
      return (e.query || []).some(function (q) { return SECRET_PARAM.test(q.name || ''); });
    });
    if (secretUrls.length) {
      add('err', secretUrls.length + ' request(s) put credentials in the URL',
        'Query strings are logged by proxies and stored in history. Move these to a header or body:\n' +
        secretUrls.slice(0, 5).map(function (e) {
          return e.path + '  [' + (e.query.filter(function (q) { return SECRET_PARAM.test(q.name); })
            .map(function (q) { return q.name; }).join(', ')) + ']';
        }).join('\n'), secretUrls);
    }
    var insecureCookies = entries.filter(function (e) {
      return (e.cookies || []).some(function (c) { return c.secure === false || c.httpOnly === false; });
    });
    if (insecureCookies.length) {
      add('warn', insecureCookies.length + ' response(s) set a cookie without Secure or HttpOnly', '', insecureCookies);
    }
    // mixed content
    var httpsPage = entries.some(function (e) { return /^https:/.test(e.url); });
    var plain = entries.filter(function (e) { return /^http:\/\//i.test(e.url); });
    if (httpsPage && plain.length) {
      add('err', plain.length + ' resource(s) loaded over plain http on an https page',
        'Mixed content: browsers block or downgrade these.',
        plain);
    }

    // --- caching
    var nocache = entries.filter(function (e) {
      return /image|font|css|javascript/i.test(e.contentType) && /no-store|no-cache/i.test(e.cacheControl);
    });
    if (nocache.length >= 3) {
      add('info', nocache.length + ' static asset(s) marked no-cache',
        'Static files re-downloaded on every visit.', nocache);
    }

    if (!out.length) add('ok', 'No problems detected', 'No failures, nothing slow, no obvious security gaps.', []);
    return out;
  }

  function report(parsed, opts) {
    var s = summarize(parsed.entries);
    var f = findings(parsed.entries, opts);
    var lines = [
      'HAR analysis',
      'Exported by: ' + parsed.creator,
      'Requests: ' + s.count + '   wall clock: ' + s.wallClock + 'ms   transferred: ' + s.totalSize + ' bytes',
      'Status: 2xx=' + s.byClass['2xx'] + ' 3xx=' + s.byClass['3xx'] +
        ' 4xx=' + s.byClass['4xx'] + ' 5xx=' + s.byClass['5xx'],
      'Median: ' + s.median + 'ms   p95: ' + s.p95 + 'ms',
      '',
      'Findings:'
    ];
    f.forEach(function (x) {
      lines.push('[' + x.level.toUpperCase() + '] ' + x.title);
      if (x.detail) x.detail.split('\n').forEach(function (d) { lines.push('    ' + d); });
    });
    return lines.join('\n');
  }

  /* -------------------------------------------------------------- cURL I/O */
  /* Devs paste curl commands into chat all day. Turning one into a filled-in
     request (and back) removes a small piece of friction that happens daily.
     Handles the shapes people actually send, not the whole of curl(1). */
  /* Word-splits like a shell, which a regex cannot do: adjacent quoted and
     unquoted runs with no space between them form ONE word. That is what makes
     the standard escape for a literal quote work — 'O'\''Brien' is three
     segments that join into O'Brien. A regex tokeniser splits it into three
     tokens and quietly corrupts the body. */
  function shellSplit(s) {
    var tokens = [], cur = '', inS = false, inD = false, quoted = false;
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (inS) {
        if (c === "'") { inS = false; continue; }
        cur += c; continue;
      }
      if (inD) {
        if (c === '\\' && i + 1 < s.length && /["\\$`]/.test(s[i + 1])) { cur += s[++i]; continue; }
        if (c === '"') { inD = false; continue; }
        cur += c; continue;
      }
      if (c === "'") { inS = true; quoted = true; continue; }
      if (c === '"') { inD = true; quoted = true; continue; }
      if (c === '\\' && i + 1 < s.length) { cur += s[++i]; continue; }
      if (/\s/.test(c)) {
        if (cur !== '' || quoted) { tokens.push(cur); cur = ''; quoted = false; }
        continue;
      }
      cur += c;
    }
    if (cur !== '' || quoted) tokens.push(cur);
    return tokens;
  }

  function parseCurl(text) {
    var s = String(text || '').trim();
    if (!/^curl\b/.test(s)) throw new Error('Does not start with "curl".');

    // join line continuations first
    s = s.replace(/\\\r?\n/g, ' ').replace(/\r?\n/g, ' ');
    var tokens = shellSplit(s);
    tokens.shift(); // "curl"

    // Only these consume the next token. Everything else is treated as a
    // valueless switch — including combined shorts like -sSkL, which both
    // DevTools "Copy as cURL" and humans produce. Guessing the other way round
    // makes an unknown flag swallow the URL.
    var TAKES_VALUE = /^(-X|--request|-H|--header|-d|--data|--data-raw|--data-binary|--data-ascii|--data-urlencode|-u|--user|--url|-b|--cookie|-A|--user-agent|-e|--referer|-o|--output|-m|--max-time|--connect-timeout|-x|--proxy|-F|--form|--retry)$/;

    var out = { method: '', url: '', headers: {}, body: '' };
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];

      if (t === '-X' || t === '--request') { out.method = (tokens[++i] || '').toUpperCase(); continue; }
      if (t === '-H' || t === '--header') {
        var h = tokens[++i] || '';
        var k = h.indexOf(':');
        if (k > 0) out.headers[h.slice(0, k).trim()] = h.slice(k + 1).trim();
        continue;
      }
      if (/^(-d|--data|--data-raw|--data-binary|--data-ascii|--data-urlencode)$/.test(t)) {
        var chunk = tokens[++i] || '';
        out.body = out.body ? out.body + '&' + chunk : chunk;   // curl concatenates repeats
        continue;
      }
      if (t === '-u' || t === '--user') {
        var cred = tokens[++i] || '';
        // never inline someone's password into a field they might screenshot
        out.headers.Authorization = 'Basic <base64 of ' + cred.split(':')[0] + ':password>';
        continue;
      }
      if (t === '--url') { out.url = tokens[++i] || ''; continue; }
      if (t === '-b' || t === '--cookie') { out.headers.Cookie = tokens[++i] || ''; continue; }
      if (t === '-A' || t === '--user-agent') { out.headers['User-Agent'] = tokens[++i] || ''; continue; }
      if (t === '-e' || t === '--referer') { out.headers.Referer = tokens[++i] || ''; continue; }

      if (TAKES_VALUE.test(t)) { i++; continue; }   // known, but we do not need it
      if (/^-/.test(t)) continue;                   // any other switch: no value
      if (!out.url) out.url = t;
    }

    if (!out.url) throw new Error('No URL found in the command.');
    if (!out.method) out.method = out.body ? 'POST' : 'GET';
    return out;
  }

  function toCurl(req) {
    var q = function (v) { return "'" + String(v).replace(/'/g, "'\\''") + "'"; };
    var parts = ['curl -i -X ' + (req.method || 'GET') + ' ' + q(req.url || '')];
    Object.keys(req.headers || {}).forEach(function (k) {
      parts.push('  -H ' + q(k + ': ' + req.headers[k]));
    });
    if (req.body) parts.push('  --data-raw ' + q(req.body));
    return parts.join(' \\\n');
  }

  window.QAT.curl = { parse: parseCurl, build: toCurl };

  window.QAT.har = {
    parse: parse,
    summarize: summarize,
    findings: findings,
    report: report,
    header: header,
    shortUrl: shortUrl,
    SLOW_MS: SLOW_MS,
    BIG_BODY: BIG_BODY
  };
})();
