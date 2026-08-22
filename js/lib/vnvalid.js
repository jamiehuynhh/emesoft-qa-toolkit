/* =============================================================================
   Vietnamese data validators
   -----------------------------------------------------------------------------
   The generator already produces MST and CCCD with correct check digits. The
   opposite direction gets used more often: QA verifies a customer-supplied
   Excel import and needs to know which rows are wrong, and why.

   Every validator returns { valid, reason } - the reason matters more than the
   boolean, because "invalid" alone does not tell anyone what to fix.

   Pure functions, no DOM.
   ========================================================================== */
(function () {
  'use strict';

  function clean(v) { return String(v == null ? '' : v).trim(); }

  /* ---------------------------------------------------------- tax code (MST) */
  /* 10 digits, weighted checksum on the first 9. A branch code adds -NNN. */
  var MST_W = [31, 29, 23, 19, 17, 13, 7, 5, 3];

  function taxCode(value) {
    var s = clean(value).replace(/[\s.]/g, '');
    var m = /^(\d{10})(?:-(\d{3}))?$/.exec(s);
    if (!m) {
      return { valid: false, reason: /^\d+$/.test(s)
        ? 'must be 10 digits (optionally -NNN for a branch), got ' + s.length
        : 'must contain only digits (and an optional -NNN branch suffix)' };
    }
    var base = m[1];
    if (base[0] === '0' && base.slice(0, 2) !== '01') {
      // 01xxxxxxxx is a real prefix in Hanoi; other leading zeros are not
      return { valid: false, reason: 'a 10-digit tax code does not start with 0 (except 01...)' };
    }
    var sum = 0;
    for (var i = 0; i < 9; i++) sum += Number(base[i]) * MST_W[i];
    var expect = 10 - (sum % 11);
    if (expect > 9) return { valid: false, reason: 'checksum position is unusable for this prefix' };
    if (Number(base[9]) !== expect) {
      return { valid: false, reason: 'check digit is ' + base[9] + ', expected ' + expect };
    }
    return { valid: true, reason: m[2] ? 'valid, branch ' + m[2] : 'valid' };
  }

  /* --------------------------------------------------------------- CCCD / CMND */
  /* 12-digit CCCD: province(3) + gender/century(1) + birth year(2) + serial(6).
     9-digit CMND is the old format and has no check digit to verify. */
  function personalId(value) {
    var s = clean(value).replace(/[\s.-]/g, '');
    if (!/^\d+$/.test(s)) return { valid: false, reason: 'must contain only digits' };
    if (s.length === 9) return { valid: true, reason: 'old 9-digit CMND format - no checksum to verify' };
    if (s.length !== 12) return { valid: false, reason: 'must be 12 digits (or 9 for old CMND), got ' + s.length };

    var province = s.slice(0, 3);
    var g = Number(s[3]);
    var yy = s.slice(4, 6);

    if (Number(province) < 1 || Number(province) > 96) {
      return { valid: false, reason: 'province code ' + province + ' is outside the 001-096 range' };
    }
    if (g > 5) return { valid: false, reason: 'gender/century digit ' + g + ' is not 0-5' };

    var century = 1900 + Math.floor(g / 2) * 100;
    var year = century + Number(yy);
    var nowYear = new Date().getFullYear();
    if (year > nowYear) {
      return { valid: false, reason: 'implied birth year ' + year + ' is in the future' };
    }
    return {
      valid: true,
      reason: 'valid shape - province ' + province + ', ' +
              (g % 2 === 0 ? 'male' : 'female') + ', born ' + year
    };
  }

  /* ------------------------------------------------------------------- phone */
  var VN_PREFIX = ['032', '033', '034', '035', '036', '037', '038', '039',
    '070', '076', '077', '078', '079', '081', '082', '083', '084', '085', '088',
    '090', '091', '092', '093', '094', '096', '097', '098', '086', '089',
    '056', '058', '059'];

  function phone(value) {
    var raw = clean(value);
    var s = raw.replace(/[\s.()-]/g, '');
    if (/^\+?84/.test(s)) s = '0' + s.replace(/^\+?84/, '');
    if (!/^\d+$/.test(s)) return { valid: false, reason: 'contains characters that are not digits' };
    if (s.length !== 10) {
      return { valid: false, reason: s.length === 11
        ? '11 digits - this is the pre-2018 format, needs converting'
        : 'must be 10 digits after normalising, got ' + s.length };
    }
    var p = s.slice(0, 3);
    if (VN_PREFIX.indexOf(p) === -1) {
      return { valid: false, reason: 'prefix ' + p + ' is not an active Vietnamese mobile prefix' };
    }
    return { valid: true, reason: 'valid, normalised ' + s };
  }

  /* ------------------------------------------------------------------- email */
  function email(value) {
    var s = clean(value);
    if (!s) return { valid: false, reason: 'empty' };
    if (/\s/.test(s)) return { valid: false, reason: 'contains a space' };
    var m = /^[^@]+@([^@]+)$/.exec(s);
    if (!m) return { valid: false, reason: s.indexOf('@') === -1 ? 'no @' : 'more than one @' };
    var domain = m[1];
    if (domain.indexOf('.') === -1) return { valid: false, reason: 'domain has no dot' };
    if (/^[.-]|[.-]$|\.\./.test(domain)) return { valid: false, reason: 'malformed domain: ' + domain };
    if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(s)) {
      return { valid: false, reason: 'illegal characters for an email address' };
    }
    return { valid: true, reason: 'valid' };
  }

  /* ------------------------------------------------------------ bank account */
  function bankAccount(value) {
    var s = clean(value).replace(/[\s.-]/g, '');
    if (!/^\d+$/.test(s)) return { valid: false, reason: 'must contain only digits' };
    if (s.length < 6 || s.length > 20) {
      return { valid: false, reason: 'length ' + s.length + ' is outside the usual 6-20 digits' };
    }
    // no national checksum exists; shape is all that can be checked
    return { valid: true, reason: 'plausible shape (no national checksum exists to verify)' };
  }

  /* -------------------------------------------------------------------- card */
  function luhn(value) {
    var s = clean(value).replace(/[\s-]/g, '');
    if (!/^\d+$/.test(s)) return { valid: false, reason: 'must contain only digits' };
    if (s.length < 13 || s.length > 19) return { valid: false, reason: 'length ' + s.length + ' is outside 13-19' };
    var sum = 0, dbl = false;
    for (var i = s.length - 1; i >= 0; i--) {
      var d = Number(s[i]);
      if (dbl) { d *= 2; if (d > 9) d -= 9; }
      sum += d; dbl = !dbl;
    }
    return sum % 10 === 0
      ? { valid: true, reason: 'passes the Luhn check' }
      : { valid: false, reason: 'fails the Luhn check' };
  }

  var TYPES = {
    taxCode: { en: 'Tax code (MST)', vi: 'Mã số thuế (MST)', fn: taxCode },
    personalId: { en: 'Personal ID (CCCD/CMND)', vi: 'CCCD / CMND', fn: personalId },
    phone: { en: 'Phone number (VN)', vi: 'Số điện thoại VN', fn: phone },
    email: { en: 'Email', vi: 'Email', fn: email },
    bankAccount: { en: 'Bank account', vi: 'Số tài khoản', fn: bankAccount },
    card: { en: 'Card number (Luhn)', vi: 'Số thẻ (Luhn)', fn: luhn }
  };

  /* Guess the type from a sample, so pasting a column just works. */
  function detect(values) {
    var vals = values.filter(function (v) { return clean(v); }).slice(0, 40);
    if (!vals.length) return 'taxCode';
    var score = {};
    Object.keys(TYPES).forEach(function (k) {
      score[k] = vals.filter(function (v) { return TYPES[k].fn(v).valid; }).length;
    });
    // an email is unmistakable, so check it first
    if (vals.filter(function (v) { return String(v).indexOf('@') !== -1; }).length > vals.length / 2) return 'email';
    var best = 'taxCode', bestN = -1;
    // deterministic order so a tie always resolves the same way
    ['taxCode', 'personalId', 'phone', 'card', 'bankAccount', 'email'].forEach(function (k) {
      if (score[k] > bestN) { bestN = score[k]; best = k; }
    });
    return best;
  }

  function validateList(values, type) {
    var fn = (TYPES[type] || TYPES.taxCode).fn;
    var rows = values.map(function (v, i) {
      var raw = clean(v);
      if (!raw) return { line: i + 1, value: '', valid: false, reason: 'empty' };
      var r = fn(raw);
      return { line: i + 1, value: raw, valid: r.valid, reason: r.reason };
    });
    var dup = {};
    rows.forEach(function (r) { if (r.value) dup[r.value] = (dup[r.value] || 0) + 1; });
    rows.forEach(function (r) {
      if (r.value && dup[r.value] > 1) r.duplicate = dup[r.value];
    });
    return {
      rows: rows,
      total: rows.length,
      valid: rows.filter(function (r) { return r.valid; }).length,
      invalid: rows.filter(function (r) { return !r.valid; }).length,
      duplicates: Object.keys(dup).filter(function (k) { return dup[k] > 1; }).length
    };
  }

  window.QAT.vnvalid = {
    taxCode: taxCode, personalId: personalId, phone: phone,
    email: email, bankAccount: bankAccount, card: luhn,
    TYPES: TYPES, detect: detect, validateList: validateList
  };
})();
