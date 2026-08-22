/* =============================================================================
   Small SQL pretty-printer. Tokenises first (so keywords inside strings and
   comments are never touched), then re-emits with line breaks + indentation.
   ========================================================================== */
(function () {
  'use strict';

  var TOP = ['SELECT', 'FROM', 'WHERE', 'HAVING', 'LIMIT', 'OFFSET', 'FETCH',
    'VALUES', 'SET', 'RETURNING', 'WINDOW'];
  var TOP2 = ['GROUP BY', 'ORDER BY', 'PARTITION BY', 'INSERT INTO', 'DELETE FROM',
    'UNION ALL', 'CROSS JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'FULL JOIN',
    'OUTER JOIN', 'LEFT OUTER JOIN', 'RIGHT OUTER JOIN', 'FULL OUTER JOIN'];
  var JOINY = ['JOIN', 'UNION', 'EXCEPT', 'INTERSECT'];
  var AND_OR = ['AND', 'OR'];
  var KEYWORDS = ('SELECT FROM WHERE GROUP BY ORDER HAVING LIMIT OFFSET FETCH INSERT INTO ' +
    'UPDATE SET DELETE VALUES JOIN LEFT RIGHT INNER OUTER FULL CROSS ON USING AND OR NOT ' +
    'IN EXISTS BETWEEN LIKE ILIKE IS NULL AS DISTINCT COUNT SUM AVG MIN MAX CASE WHEN THEN ' +
    'ELSE END UNION ALL EXCEPT INTERSECT CREATE TABLE VIEW INDEX ALTER DROP ADD COLUMN ' +
    'PRIMARY KEY FOREIGN REFERENCES UNIQUE DEFAULT CHECK CONSTRAINT WITH RECURSIVE ASC DESC ' +
    'INT INTEGER VARCHAR NVARCHAR CHAR TEXT DATE DATETIME TIMESTAMP DECIMAL NUMERIC FLOAT ' +
    'BOOLEAN BIT TRUE FALSE CAST CONVERT COALESCE NULLIF OVER PARTITION ROW_NUMBER RANK ' +
    'DENSE_RANK LAG LEAD TOP PERCENT INTERSECT BEGIN COMMIT ROLLBACK TRANSACTION IF ELSEIF ' +
    'GRANT REVOKE TRUNCATE MERGE USING MATCHED').split(/\s+/);
  var KW = {};
  KEYWORDS.forEach(function (k) { KW[k] = true; });

  function tokenize(sql) {
    var t = [], i = 0, s = String(sql);
    while (i < s.length) {
      var c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '-' && s[i + 1] === '-') {
        var e = s.indexOf('\n', i); if (e === -1) e = s.length;
        t.push({ k: 'comment', v: s.slice(i, e).trim() }); i = e; continue;
      }
      if (c === '/' && s[i + 1] === '*') {
        var e2 = s.indexOf('*/', i + 2); e2 = e2 === -1 ? s.length : e2 + 2;
        t.push({ k: 'comment', v: s.slice(i, e2) }); i = e2; continue;
      }
      if (c === "'") {
        var j = i + 1, buf = "'";
        while (j < s.length) {
          if (s[j] === "'" && s[j + 1] === "'") { buf += "''"; j += 2; continue; }
          if (s[j] === "'") { buf += "'"; j++; break; }
          buf += s[j]; j++;
        }
        t.push({ k: 'str', v: buf }); i = j; continue;
      }
      if (c === '"' || c === '`' || c === '[') {
        var close = c === '[' ? ']' : c;
        var j2 = s.indexOf(close, i + 1); j2 = j2 === -1 ? s.length : j2;
        t.push({ k: 'ident', v: s.slice(i, j2 + 1) }); i = j2 + 1; continue;
      }
      if (/[0-9]/.test(c)) {
        var m = /^[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?/.exec(s.slice(i));
        t.push({ k: 'num', v: m[0] }); i += m[0].length; continue;
      }
      if (/[A-Za-z_@#$]/.test(c)) {
        var m2 = /^[A-Za-z_@#$][A-Za-z0-9_$]*/.exec(s.slice(i));
        t.push({ k: 'word', v: m2[0] }); i += m2[0].length; continue;
      }
      var ops = ['<=>', '!=', '<>', '<=', '>=', '||', '::', '->>', '->'];
      var hit = null;
      for (var o = 0; o < ops.length; o++) {
        if (s.startsWith(ops[o], i)) { hit = ops[o]; break; }
      }
      if (hit) { t.push({ k: 'op', v: hit }); i += hit.length; continue; }
      t.push({ k: 'punc', v: c }); i++;
    }
    return t;
  }

  function format(sql, opts) {
    opts = opts || {};
    var IND = new Array((opts.indent || 2) + 1).join(' ');
    var kwCase = opts.keywordCase || 'upper';
    var breakComma = opts.commaBreak !== false;

    var toks = tokenize(sql);
    var out = '', depth = 0, lineStart = true, i;

    function nl(extra) {
      out = out.replace(/[ \t]+$/, '');
      out += '\n' + new Array(depth + 1 + (extra || 0)).join(IND);
      lineStart = true;
    }
    function put(v, spaceBefore) {
      if (!lineStart && spaceBefore !== false) out += ' ';
      out += v; lineStart = false;
    }
    function word(v) {
      var up = v.toUpperCase();
      if (!KW[up]) return v;
      if (kwCase === 'upper') return up;
      if (kwCase === 'lower') return v.toLowerCase();
      return v;
    }
    function peekPhrase(idx, n) {
      var parts = [];
      for (var k = 0; k < n; k++) {
        if (!toks[idx + k] || toks[idx + k].k !== 'word') return null;
        parts.push(toks[idx + k].v.toUpperCase());
      }
      return parts.join(' ');
    }

    for (i = 0; i < toks.length; i++) {
      var tk = toks[i], up = tk.v.toUpperCase();

      if (tk.k === 'comment') { if (out) nl(); put(tk.v); nl(); continue; }

      if (tk.k === 'punc') {
        if (tk.v === '(') { put('(', out && !/[\s(]$/.test(out)); depth++; continue; }
        if (tk.v === ')') { depth = Math.max(0, depth - 1); nl(); put(')', false); continue; }
        if (tk.v === ',') {
          out = out.replace(/\s+$/, '');
          out += ',';
          if (breakComma) nl(1); else lineStart = false;
          continue;
        }
        if (tk.v === ';') { out = out.replace(/\s+$/, ''); out += ';'; nl(); continue; }
        if (tk.v === '.') { out = out.replace(/\s+$/, ''); out += '.'; lineStart = false; continue; }
        put(tk.v); continue;
      }

      if (tk.k === 'word') {
        // three / two word phrases first
        var p3 = peekPhrase(i, 3), p2 = peekPhrase(i, 2);
        if (p3 && TOP2.indexOf(p3) !== -1) {
          if (out) nl(); put(kwCase === 'lower' ? p3.toLowerCase() : p3, false); i += 2; continue;
        }
        if (p2 && TOP2.indexOf(p2) !== -1) {
          if (out) nl(); put(kwCase === 'lower' ? p2.toLowerCase() : p2, false); i += 1; continue;
        }
        if (TOP.indexOf(up) !== -1 || JOINY.indexOf(up) !== -1) {
          if (out) nl(); put(word(tk.v), false); continue;
        }
        if (AND_OR.indexOf(up) !== -1) { nl(1); put(word(tk.v), false); continue; }
        if (up === 'ON' || up === 'WHEN' || up === 'ELSE') { nl(1); put(word(tk.v), false); continue; }
        if (up === 'CASE') { put(word(tk.v)); depth++; continue; }
        if (up === 'END') { depth = Math.max(0, depth - 1); nl(); put(word(tk.v), false); continue; }
        if (up === 'UPDATE' || up === 'CREATE' || up === 'ALTER' || up === 'DROP' || up === 'WITH') {
          if (out) nl(); put(word(tk.v), false); continue;
        }
        put(word(tk.v)); continue;
      }

      // operators, strings, numbers, quoted identifiers
      put(tk.v);
    }

    return out.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
  }

  function minify(sql) {
    return tokenize(sql)
      .filter(function (t) { return t.k !== 'comment'; })
      .map(function (t) { return t.v; })
      .join(' ')
      .replace(/\s*([(),.;])\s*/g, '$1')
      .replace(/\(\s+/g, '(')
      .replace(/,(\S)/g, ', $1')
      .trim();
  }

  window.QAT.sql = { format: format, minify: minify, tokenize: tokenize };
})();
