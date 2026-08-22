/* =============================================================================
   Line diff (LCS) + inline word diff. Common prefix/suffix is trimmed first so
   the DP table stays small on real-world inputs.
   ========================================================================== */
(function () {
  'use strict';

  var MAX_DP = 4000; // per side, after trimming — guards memory

  function lcsOps(a, b) {
    var n = a.length, m = b.length;
    var dp = new Uint32Array((n + 1) * (m + 1));
    var W = m + 1;
    for (var i = n - 1; i >= 0; i--) {
      for (var j = m - 1; j >= 0; j--) {
        dp[i * W + j] = a[i] === b[j]
          ? dp[(i + 1) * W + (j + 1)] + 1
          : Math.max(dp[(i + 1) * W + j], dp[i * W + (j + 1)]);
      }
    }
    var ops = [], x = 0, y = 0;
    while (x < n && y < m) {
      if (a[x] === b[y]) { ops.push({ type: 'same', a: x, b: y }); x++; y++; }
      else if (dp[(x + 1) * W + y] >= dp[x * W + (y + 1)]) { ops.push({ type: 'del', a: x, b: null }); x++; }
      else { ops.push({ type: 'add', a: null, b: y }); y++; }
    }
    while (x < n) { ops.push({ type: 'del', a: x, b: null }); x++; }
    while (y < m) { ops.push({ type: 'add', a: null, b: y }); y++; }
    return ops;
  }

  // returns { ops:[{type,a,b}], truncated:bool }
  function diffSeq(a, b) {
    var pre = 0, sufA, sufB;
    while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
    sufA = a.length; sufB = b.length;
    while (sufA > pre && sufB > pre && a[sufA - 1] === b[sufB - 1]) { sufA--; sufB--; }

    var midA = a.slice(pre, sufA), midB = b.slice(pre, sufB), truncated = false;
    if (midA.length > MAX_DP || midB.length > MAX_DP) {
      truncated = true;
      midA = midA.slice(0, MAX_DP);
      midB = midB.slice(0, MAX_DP);
    }

    var ops = [], k;
    for (k = 0; k < pre; k++) ops.push({ type: 'same', a: k, b: k });
    lcsOps(midA, midB).forEach(function (o) {
      ops.push({
        type: o.type,
        a: o.a === null ? null : o.a + pre,
        b: o.b === null ? null : o.b + pre
      });
    });
    for (k = 0; k < a.length - sufA; k++) ops.push({ type: 'same', a: sufA + k, b: sufB + k });
    return { ops: ops, truncated: truncated };
  }

  function splitWords(s) {
    return String(s).split(/(\s+|[.,;:!?()[\]{}"'<>/\\=]+)/).filter(function (x) { return x !== ''; });
  }

  // Inline highlight of two strings -> { a:html, b:html }
  function words(sa, sb) {
    var A = splitWords(sa), B = splitWords(sb);
    var res = diffSeq(A, B);
    var ha = '', hb = '';
    res.ops.forEach(function (o) {
      if (o.type === 'same') { ha += QAT.esc(A[o.a]); hb += QAT.esc(B[o.b]); }
      else if (o.type === 'del') { ha += '<span class="mark-del">' + QAT.esc(A[o.a]) + '</span>'; }
      else { hb += '<span class="mark-add">' + QAT.esc(B[o.b]) + '</span>'; }
    });
    return { a: ha, b: hb };
  }

  window.QAT.diff = { seq: diffSeq, words: words };
})();
