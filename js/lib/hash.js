/* =============================================================================
   Pure-JS hashing (MD5 / SHA-1 / SHA-256) + optional SHA-512 via Web Crypto.
   Pure JS is used so the page also works from file:// where crypto.subtle
   may be unavailable. Round constants are derived, not typed, to avoid typos.
   ========================================================================== */
(function () {
  'use strict';

  /* --------------------------------------------------------------- encoding */
  function utf8Bytes(str) {
    if (typeof TextEncoder !== 'undefined') {
      return Array.prototype.slice.call(new TextEncoder().encode(str));
    }
    var out = [], i, c;
    for (i = 0; i < str.length; i++) {
      c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }

  function hex8be(n) { var s = (n >>> 0).toString(16); while (s.length < 8) s = '0' + s; return s; }
  function hex8le(n) {
    var s = '';
    for (var i = 0; i < 4; i++) {
      var b = ((n >>> (i * 8)) & 255).toString(16);
      s += (b.length < 2 ? '0' : '') + b;
    }
    return s;
  }

  // pad to 64-byte blocks; `little` selects the length-field endianness (MD5)
  function pad(bytes, little) {
    var msg = bytes.slice(), bits = bytes.length * 8;
    msg.push(0x80);
    while (msg.length % 64 !== 56) msg.push(0);
    var hi = Math.floor(bits / 4294967296), lo = bits >>> 0;
    if (little) {
      msg.push(lo & 255, (lo >>> 8) & 255, (lo >>> 16) & 255, (lo >>> 24) & 255,
               hi & 255, (hi >>> 8) & 255, (hi >>> 16) & 255, (hi >>> 24) & 255);
    } else {
      msg.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255,
               (lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);
    }
    return msg;
  }

  /* -------------------------------------------------------------------- MD5 */
  var MD5_S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
               5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
               4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
               6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  var MD5_K = (function () {
    var k = [];
    for (var i = 0; i < 64; i++) k[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0;
    return k;
  })();

  function md5(str) {
    var msg = pad(utf8Bytes(str), true);
    var a0 = 0x67452301, b0 = 0xefcdab89 | 0, c0 = 0x98badcfe | 0, d0 = 0x10325476;

    for (var off = 0; off < msg.length; off += 64) {
      var M = [];
      for (var j = 0; j < 16; j++) {
        M[j] = msg[off + j * 4] | (msg[off + j * 4 + 1] << 8) |
               (msg[off + j * 4 + 2] << 16) | (msg[off + j * 4 + 3] << 24);
      }
      var A = a0, B = b0, C = c0, D = d0;
      for (var i = 0; i < 64; i++) {
        var F, g;
        if (i < 16) { F = (B & C) | (~B & D); g = i; }
        else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
        else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
        else { F = C ^ (B | ~D); g = (7 * i) % 16; }
        F = (F + A + MD5_K[i] + M[g]) | 0;
        A = D; D = C; C = B;
        B = (B + ((F << MD5_S[i]) | (F >>> (32 - MD5_S[i])))) | 0;
      }
      a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
    }
    return hex8le(a0) + hex8le(b0) + hex8le(c0) + hex8le(d0);
  }

  /* ------------------------------------------------------------------ SHA-1 */
  function sha1(str) {
    var msg = pad(utf8Bytes(str), false);
    var h = [0x67452301, 0xEFCDAB89 | 0, 0x98BADCFE | 0, 0x10325476, 0xC3D2E1F0 | 0];

    for (var off = 0; off < msg.length; off += 64) {
      var w = [], i;
      for (i = 0; i < 16; i++) {
        w[i] = (msg[off + i * 4] << 24) | (msg[off + i * 4 + 1] << 16) |
               (msg[off + i * 4 + 2] << 8) | msg[off + i * 4 + 3];
      }
      for (i = 16; i < 80; i++) {
        var v = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
        w[i] = (v << 1) | (v >>> 31);
      }
      var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4];
      for (i = 0; i < 80; i++) {
        var f, k;
        if (i < 20) { f = (b & c) | (~b & d); k = 0x5A827999; }
        else if (i < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1; }
        else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC | 0; }
        else { f = b ^ c ^ d; k = 0xCA62C1D6 | 0; }
        var t = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) | 0;
        e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = t;
      }
      h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0;
      h[3] = (h[3] + d) | 0; h[4] = (h[4] + e) | 0;
    }
    return h.map(hex8be).join('');
  }

  /* ---------------------------------------------------------------- SHA-256 */
  // K = frac(cbrt(prime_n)) * 2^32 ; H = frac(sqrt(prime_n)) * 2^32
  var SHA_PRIMES = (function () {
    var p = [];
    for (var n = 2; p.length < 64; n++) {
      var ok = true;
      for (var d = 2; d * d <= n; d++) if (n % d === 0) { ok = false; break; }
      if (ok) p.push(n);
    }
    return p;
  })();
  function frac32(x) { return Math.floor((x - Math.floor(x)) * 4294967296) | 0; }
  var SHA256_K = SHA_PRIMES.map(function (p) { return frac32(Math.pow(p, 1 / 3)); });
  var SHA256_H = SHA_PRIMES.slice(0, 8).map(function (p) { return frac32(Math.sqrt(p)); });

  function sha256(str) {
    var msg = pad(utf8Bytes(str), false);
    var H = SHA256_H.slice();

    for (var off = 0; off < msg.length; off += 64) {
      var w = [], i;
      for (i = 0; i < 16; i++) {
        w[i] = (msg[off + i * 4] << 24) | (msg[off + i * 4 + 1] << 16) |
               (msg[off + i * 4 + 2] << 8) | msg[off + i * 4 + 3];
      }
      for (i = 16; i < 64; i++) {
        var x = w[i - 15], y = w[i - 2];
        var s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
        var s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], hh = H[7];
      for (i = 0; i < 64; i++) {
        var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        var ch = (e & f) ^ (~e & g);
        var t1 = (hh + S1 + ch + SHA256_K[i] + w[i]) | 0;
        var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        var mj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + mj) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0;
        d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + hh) | 0;
    }
    return H.map(hex8be).join('');
  }

  /* --------------------------------------------- SHA-384 / 512 (Web Crypto) */
  function subtleHash(algo, str) {
    if (!(window.crypto && window.crypto.subtle)) {
      return Promise.reject(new Error('Web Crypto not available in this context (try http://localhost).'));
    }
    var data = new Uint8Array(utf8Bytes(str));
    return window.crypto.subtle.digest(algo, data).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) {
        return (b < 16 ? '0' : '') + b.toString(16);
      }).join('');
    });
  }

  /* ---------------------------------------------------------------- base64 */
  function b64encode(str) {
    var bytes = utf8Bytes(str), bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function b64decode(b64) {
    var bin = atob(String(b64).replace(/\s+/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(bytes);
    return decodeURIComponent(escape(bin));
  }
  // JWT / URL-safe base64
  function b64urlDecode(s) {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
    while (s.length % 4) s += '=';
    return b64decode(s);
  }
  function b64urlEncode(s) {
    return b64encode(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  window.QAT.hash = {
    md5: md5, sha1: sha1, sha256: sha256,
    sha384: function (s) { return subtleHash('SHA-384', s); },
    sha512: function (s) { return subtleHash('SHA-512', s); },
    b64encode: b64encode, b64decode: b64decode,
    b64urlEncode: b64urlEncode, b64urlDecode: b64urlDecode,
    utf8Bytes: utf8Bytes
  };
})();
