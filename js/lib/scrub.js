/* =============================================================================
   Sensitive-data scrubber
   -----------------------------------------------------------------------------
   Runs in the browser, before the prompt is sent or copied, so the tester can
   see what was masked and decide. Until now the toolkit only *warned* people to
   remove customer data from logs by hand — a note nobody reads at 6pm.

   Deliberately conservative. Over-masking destroys the very context the model
   needs: if every 10-digit number became [REDACTED], an acceptance criterion
   like "tax code must be 10 digits" would stop making sense. So this targets
   things that are almost never load-bearing for test design (credentials,
   contact details, card numbers) and leaves ordinary numbers alone.

   Order matters: credentials are matched before generic patterns, otherwise a
   token containing an email-shaped substring gets half-masked.
   ========================================================================== */
(function () {
  'use strict';

  var RULES = [
    // ---- credentials first: these must never leave, and never be partly masked
    {
      id: 'privateKey',
      en: 'Private key blocks', vi: 'Khối private key',
      re: /-----BEGIN[ A-Z]*PRIVATE KEY-----[\s\S]*?-----END[ A-Z]*PRIVATE KEY-----/g,
      mask: '[PRIVATE_KEY_REMOVED]'
    },
    {
      id: 'jwt',
      en: 'JWTs', vi: 'JWT',
      re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
      mask: '[JWT]'
    },
    {
      id: 'apiKey',
      en: 'API keys / tokens', vi: 'API key / token',
      // known prefixes from the providers this toolkit talks to, plus GitHub/Slack
      re: /\b(sk-ant-[A-Za-z0-9_-]{10,}|sk-[A-Za-z0-9]{20,}|gsk_[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|csk-[A-Za-z0-9]{20,})\b/g,
      mask: '[API_KEY]'
    },
    {
      id: 'authHeader',
      en: 'Authorization headers', vi: 'Header Authorization',
      re: /\b(Authorization|X-Api-Key|x-api-token|Proxy-Authorization)\s*[:=]\s*\S+/gi,
      mask: function (m) { return m.split(/[:=]/)[0] + ': [REDACTED]'; }
    },
    {
      id: 'secretAssign',
      en: 'password / secret assignments', vi: 'Gán password / secret',
      re: /\b(pass(word)?|pwd|secret|token|api[_-]?key|client[_-]?secret|connectionstring)\s*[:=]\s*("[^"]*"|'[^']*'|\S+)/gi,
      mask: function (m) { return m.split(/[:=]/)[0] + '=[REDACTED]'; }
    },

    // ---- contact details
    {
      id: 'email',
      en: 'Email addresses', vi: 'Địa chỉ email',
      re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
      mask: '[EMAIL]'
    },
    {
      id: 'phoneVN',
      en: 'Vietnamese phone numbers', vi: 'Số điện thoại VN',
      // 0xx or +84xx with a real mobile prefix - avoids eating arbitrary 10-digit ids
      re: /(?:\+84|0)(?:3[2-9]|5[2689]|7[06-9]|8[1-9]|9[0-9])\d{7}\b/g,
      mask: '[PHONE]'
    },

    // ---- financial
    {
      id: 'card',
      en: 'Payment card numbers', vi: 'Số thẻ thanh toán',
      re: /\b(?:\d[ -]?){12,18}\d\b/g,
      // only mask if it passes Luhn, so ids and timestamps survive
      test: luhn,
      mask: '[CARD]'
    }
  ];

  // Optional rules: useful data as often as sensitive data, so off by default.
  var OPTIONAL = [
    {
      id: 'ipv4',
      en: 'IPv4 addresses', vi: 'Địa chỉ IPv4',
      re: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
      mask: '[IP]'
    },
    {
      id: 'personalId',
      en: 'ID numbers (9 or 12 digits)', vi: 'Số CCCD / CMND (9 hoặc 12 số)',
      re: /\b(\d{12}|\d{9})\b/g,
      mask: '[ID]'
    },
    {
      id: 'guid',
      en: 'GUIDs', vi: 'GUID',
      re: /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g,
      mask: '[GUID]'
    }
  ];

  function luhn(s) {
    var digits = String(s).replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) return false;
    var sum = 0, dbl = false;
    for (var i = digits.length - 1; i >= 0; i--) {
      var d = Number(digits[i]);
      if (dbl) { d *= 2; if (d > 9) d -= 9; }
      sum += d;
      dbl = !dbl;
    }
    return sum % 10 === 0;
  }

  /* scrub(text, { extra: ['ipv4', ...] })
     -> { text, found: [{ id, label, count }], total } */
  function scrub(text, opts) {
    opts = opts || {};
    var out = String(text == null ? '' : text);
    var found = [];
    var rules = RULES.concat((opts.extra || []).map(function (id) {
      return OPTIONAL.filter(function (r) { return r.id === id; })[0];
    }).filter(Boolean));

    rules.forEach(function (rule) {
      var count = 0;
      out = out.replace(rule.re, function (m) {
        if (rule.test && !rule.test(m)) return m;      // left as-is on purpose
        count++;
        return typeof rule.mask === 'function' ? rule.mask(m) : rule.mask;
      });
      if (count) {
        found.push({
          id: rule.id,
          label: (window.QAT && QAT.lang === 'vi') ? rule.vi : rule.en,
          count: count
        });
      }
    });

    return {
      text: out,
      found: found,
      total: found.reduce(function (n, f) { return n + f.count; }, 0)
    };
  }

  function summary(result) {
    if (!result.total) return '';
    return result.found.map(function (f) { return f.label + ' x' + f.count; }).join(', ');
  }

  window.QAT.scrub = scrub;
  window.QAT.scrub.rules = RULES;
  window.QAT.scrub.optional = OPTIONAL;
  window.QAT.scrub.summary = summary;
  window.QAT.scrub.luhn = luhn;
})();
