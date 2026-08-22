/* =============================================================================
   CSV parse / stringify (RFC 4180 style: quoted fields, escaped quotes, CRLF)
   ========================================================================== */
(function () {
  'use strict';

  function detectDelimiter(text) {
    var first = String(text).split(/\r?\n/).find(function (l) { return l.trim() !== ''; }) || '';
    var cands = [',', ';', '\t', '|'], best = ',', bestN = -1;
    cands.forEach(function (d) {
      // count only delimiters outside quotes
      var n = 0, q = false;
      for (var i = 0; i < first.length; i++) {
        var ch = first[i];
        if (ch === '"') q = !q;
        else if (ch === d && !q) n++;
      }
      if (n > bestN) { bestN = n; best = d; }
    });
    return best;
  }

  // -> array of arrays
  function parse(text, delim) {
    text = String(text).replace(/^﻿/, '');
    delim = delim || detectDelimiter(text);
    var rows = [], row = [], field = '', i = 0, inQ = false;

    while (i < text.length) {
      var ch = text[i];
      if (inQ) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQ = false; i++; continue;
        }
        field += ch; i++; continue;
      }
      if (ch === '"') { inQ = true; i++; continue; }
      if (ch === delim) { row.push(field); field = ''; i++; continue; }
      if (ch === '\r') { i++; continue; }
      if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
      field += ch; i++;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    // drop trailing fully-empty row
    while (rows.length && rows[rows.length - 1].every(function (c) { return c === ''; })) rows.pop();
    return { rows: rows, delimiter: delim };
  }

  function needsQuote(v, delim) {
    return v.indexOf(delim) !== -1 || v.indexOf('"') !== -1 ||
           v.indexOf('\n') !== -1 || v.indexOf('\r') !== -1 ||
           /^\s|\s$/.test(v);
  }

  function cell(v, delim) {
    v = v == null ? '' : String(v);
    return needsQuote(v, delim) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }

  function stringify(rows, delim, eol) {
    delim = delim || ',';
    eol = eol || '\r\n';
    return rows.map(function (r) {
      return r.map(function (c) { return cell(c, delim); }).join(delim);
    }).join(eol);
  }

  // objects -> csv (union of keys, stable order of first appearance)
  function fromObjects(list, delim, eol) {
    var keys = [], seen = {};
    list.forEach(function (o) {
      Object.keys(o || {}).forEach(function (k) { if (!seen[k]) { seen[k] = 1; keys.push(k); } });
    });
    var rows = [keys];
    list.forEach(function (o) {
      rows.push(keys.map(function (k) {
        var v = o ? o[k] : '';
        if (v === null || v === undefined) return '';
        return (typeof v === 'object') ? JSON.stringify(v) : String(v);
      }));
    });
    return stringify(rows, delim, eol);
  }

  // Phone numbers, tax codes and long IDs must stay text: a leading zero or
  // more than 15 significant digits means Number() would corrupt the value.
  function looksNumeric(v) {
    if (!/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(v)) return false;
    if (/^-?0\d/.test(v)) return false;
    if (v.replace(/[-.]/g, '').length > 15) return false;
    return true;
  }

  // rows -> objects using first row as header
  function toObjects(rows, opts) {
    opts = opts || {};
    if (!rows.length) return [];
    var header = rows[0].map(function (h, idx) { return (h || '').trim() || ('column' + (idx + 1)); });
    return rows.slice(1).map(function (r) {
      var o = {};
      header.forEach(function (h, k) {
        var v = r[k] === undefined ? '' : r[k];
        if (opts.typed) {
          if (v === '') o[h] = opts.emptyNull ? null : '';
          else if (looksNumeric(v)) o[h] = Number(v);
          else if (/^(true|false)$/i.test(v)) o[h] = /^true$/i.test(v);
          else if (/^null$/i.test(v)) o[h] = null;
          else o[h] = v;
        } else {
          o[h] = v;
        }
      });
      return o;
    });
  }

  window.QAT.csv = {
    parse: parse, stringify: stringify,
    fromObjects: fromObjects, toObjects: toObjects,
    detectDelimiter: detectDelimiter
  };
})();
