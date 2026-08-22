/* =============================================================================
   Vietnamese-flavoured TEST DATA generator.
   Everything produced here is synthetic and must only be used for testing.
   A seed can be supplied so a data set is reproducible across runs.
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------- RNG */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashSeed(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  /* ----------------------------------------------------------------- corpus */
  var SURNAME = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng',
    'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý', 'Đinh', 'Trịnh', 'Cao', 'Mai'];
  var MID_M = ['Văn', 'Hữu', 'Đức', 'Minh', 'Quang', 'Thanh', 'Tuấn', 'Bá', 'Công', 'Hoàng'];
  var MID_F = ['Thị', 'Thanh', 'Ngọc', 'Thu', 'Kim', 'Hồng', 'Diệu', 'Khánh', 'Mỹ', 'Phương'];
  var GIVEN_M = ['An', 'Bảo', 'Cường', 'Dũng', 'Đạt', 'Hải', 'Hùng', 'Khang', 'Long', 'Nam',
    'Phong', 'Quân', 'Sơn', 'Thắng', 'Trung', 'Tú', 'Vinh', 'Duy', 'Kiên', 'Lộc'];
  var GIVEN_F = ['Anh', 'Bình', 'Châu', 'Dung', 'Hà', 'Hạnh', 'Hương', 'Lan', 'Linh', 'Mai',
    'Nga', 'Nhung', 'Oanh', 'Quyên', 'Thảo', 'Trang', 'Uyên', 'Vân', 'Yến', 'Ngân'];

  var PROVINCE = [
    { name: 'Hà Nội', code: '001' }, { name: 'TP. Hồ Chí Minh', code: '079' },
    { name: 'Đà Nẵng', code: '048' }, { name: 'Hải Phòng', code: '031' },
    { name: 'Cần Thơ', code: '092' }, { name: 'Bình Dương', code: '074' },
    { name: 'Đồng Nai', code: '075' }, { name: 'Khánh Hòa', code: '056' },
    { name: 'Nghệ An', code: '040' }, { name: 'Thanh Hóa', code: '038' },
    { name: 'Thừa Thiên Huế', code: '046' }, { name: 'Quảng Ninh', code: '022' },
    { name: 'Lâm Đồng', code: '068' }, { name: 'Bắc Ninh', code: '027' },
    { name: 'Long An', code: '080' }
  ];
  var STREET = ['Lê Lợi', 'Nguyễn Huệ', 'Trần Phú', 'Hai Bà Trưng', 'Lý Thường Kiệt',
    'Nguyễn Trãi', 'Điện Biên Phủ', 'Cách Mạng Tháng 8', 'Hoàng Văn Thụ', 'Phan Đình Phùng',
    'Nguyễn Thị Minh Khai', 'Võ Văn Tần', 'Trường Chinh', 'Xô Viết Nghệ Tĩnh'];
  var WARD = ['Phường 1', 'Phường 2', 'Phường 5', 'Phường 7', 'Phường Bến Nghé',
    'Phường Tân Định', 'Phường Dịch Vọng', 'Phường Trung Hòa', 'Xã An Phú', 'Xã Tân Thông Hội'];
  var DISTRICT = ['Quận 1', 'Quận 3', 'Quận 7', 'Quận Bình Thạnh', 'Quận Tân Bình',
    'Quận Cầu Giấy', 'Quận Đống Đa', 'Quận Hai Bà Trưng', 'Huyện Hóc Môn', 'Huyện Gia Lâm'];
  var COMPANY_A = ['Công ty TNHH', 'Công ty Cổ phần', 'Công ty TNHH MTV', 'Tập đoàn'];
  var COMPANY_B = ['Thương mại', 'Dịch vụ', 'Công nghệ', 'Xây dựng', 'Vận tải', 'Sản xuất', 'Giải pháp'];
  var COMPANY_C = ['Minh Phát', 'Hoàng Gia', 'An Khang', 'Thành Đạt', 'Tân Tiến', 'Đại Việt',
    'Phú Cường', 'Bình An', 'Sao Mai', 'Nam Long'];
  var JOB = ['QA Engineer', 'Software Engineer', 'Business Analyst', 'Project Manager',
    'DevOps Engineer', 'UI/UX Designer', 'Data Analyst', 'Test Lead', 'Scrum Master', 'Accountant'];
  var DOMAIN = ['example.com', 'test.local', 'qa-sandbox.dev', 'mailinator.com', 'example.net'];

  var PHONE_PREFIX = ['032', '033', '034', '035', '036', '037', '038', '039',
    '070', '076', '077', '078', '079', '081', '082', '083', '084', '085', '088',
    '090', '091', '092', '093', '094', '096', '097', '098', '086', '089', '056', '058', '059'];

  /* ---------------------------------------------------------------- helpers */
  function makeCtx(seed) {
    var rnd = (seed === undefined || seed === null || seed === '')
      ? Math.random
      : mulberry32(typeof seed === 'number' ? seed : hashSeed(String(seed)));

    function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }
    function int(min, max) { return Math.floor(rnd() * (max - min + 1)) + min; }
    function digits(n) { var s = ''; for (var i = 0; i < n; i++) s += int(0, 9); return s; }
    return { rnd: rnd, pick: pick, int: int, digits: digits };
  }

  var NO_DIACRITIC = { 'à': 'a', 'á': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a', 'ă': 'a', 'ắ': 'a', 'ằ': 'a', 'ẳ': 'a', 'ẵ': 'a', 'ặ': 'a', 'â': 'a', 'ấ': 'a', 'ầ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ậ': 'a', 'đ': 'd', 'è': 'e', 'é': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ẹ': 'e', 'ê': 'e', 'ế': 'e', 'ề': 'e', 'ể': 'e', 'ễ': 'e', 'ệ': 'e', 'ì': 'i', 'í': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i', 'ò': 'o', 'ó': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o', 'ô': 'o', 'ố': 'o', 'ồ': 'o', 'ổ': 'o', 'ỗ': 'o', 'ộ': 'o', 'ơ': 'o', 'ớ': 'o', 'ờ': 'o', 'ở': 'o', 'ỡ': 'o', 'ợ': 'o', 'ù': 'u', 'ú': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u', 'ư': 'u', 'ứ': 'u', 'ừ': 'u', 'ử': 'u', 'ữ': 'u', 'ự': 'u', 'ỳ': 'y', 'ý': 'y', 'ỷ': 'y', 'ỹ': 'y', 'ỵ': 'y' };

  function deaccent(s) {
    return String(s).toLowerCase().replace(/./g, function (c) {
      return NO_DIACRITIC[c] !== undefined ? NO_DIACRITIC[c] : c;
    });
  }

  // Vietnamese 10-digit tax code, including the real check digit
  function taxCode(ctx) {
    var W = [31, 29, 23, 19, 17, 13, 7, 5, 3];
    for (var attempt = 0; attempt < 40; attempt++) {
      var base = String(ctx.int(1, 9)) + ctx.digits(8); // never starts with 0
      var sum = 0;
      for (var i = 0; i < 9; i++) sum += Number(base[i]) * W[i];
      var chk = 10 - (sum % 11);
      if (chk >= 0 && chk <= 9) return base + chk;
    }
    return '0100109106'; // documented fallback, still synthetic
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function iso(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  /* ------------------------------------------------------------ field build */
  // Every generator receives (ctx, rec) so later fields can reuse earlier ones.
  var FIELDS = {
    id: function (ctx, rec, idx) { return idx + 1; },

    gender: function (ctx) { return ctx.rnd() < 0.5 ? 'Nam' : 'Nữ'; },

    fullName: function (ctx, rec) {
      var male = (rec.gender || (ctx.rnd() < 0.5 ? 'Nam' : 'Nữ')) === 'Nam';
      rec.gender = male ? 'Nam' : 'Nữ';
      return ctx.pick(SURNAME) + ' ' + ctx.pick(male ? MID_M : MID_F) + ' ' +
        ctx.pick(male ? GIVEN_M : GIVEN_F);
    },

    email: function (ctx, rec) {
      var base = rec.fullName ? deaccent(rec.fullName).replace(/\s+/g, '.') : 'qa.user';
      return base + '.' + ctx.int(10, 9999) + '@' + ctx.pick(DOMAIN);
    },

    username: function (ctx, rec) {
      var base = rec.fullName ? deaccent(rec.fullName).replace(/\s+/g, '') : 'qauser';
      return base.slice(0, 12) + ctx.int(10, 999);
    },

    password: function (ctx) {
      var U = 'ABCDEFGHJKLMNPQRSTUVWXYZ', l = 'abcdefghijkmnpqrstuvwxyz', d = '23456789', s = '!@#$%&*';
      var out = ctx.pick(U.split('')) + ctx.pick(s.split(''));
      for (var i = 0; i < 6; i++) out += ctx.pick((l + d).split(''));
      return out;
    },

    phone: function (ctx) { return ctx.pick(PHONE_PREFIX) + ctx.digits(7); },

    phoneE164: function (ctx, rec) {
      var p = rec.phone || (ctx.pick(PHONE_PREFIX) + ctx.digits(7));
      return '+84' + p.slice(1);
    },

    province: function (ctx, rec) {
      var p = ctx.pick(PROVINCE);
      rec.__prov = p;
      return p.name;
    },

    address: function (ctx, rec) {
      var p = rec.__prov || ctx.pick(PROVINCE);
      rec.__prov = p;
      return ctx.int(1, 350) + ' ' + ctx.pick(STREET) + ', ' + ctx.pick(WARD) + ', ' +
        ctx.pick(DISTRICT) + ', ' + p.name;
    },

    taxCode: function (ctx) { return taxCode(ctx); },

    personalId: function (ctx, rec) {
      // 12-digit CCCD shape: province(3) + gender/century(1) + birth year(2) + random(6)
      var p = rec.__prov || ctx.pick(PROVINCE);
      rec.__prov = p;
      var year = rec.__birthYear || ctx.int(1970, 2005);
      rec.__birthYear = year;
      var century = year < 2000 ? 0 : 2;
      var g = century + ((rec.gender === 'Nữ') ? 1 : 0);
      return p.code + g + String(year).slice(-2) + ctx.digits(6);
    },

    dob: function (ctx, rec) {
      var year = rec.__birthYear || ctx.int(1970, 2005);
      rec.__birthYear = year;
      return year + '-' + pad2(ctx.int(1, 12)) + '-' + pad2(ctx.int(1, 28));
    },

    company: function (ctx) {
      return ctx.pick(COMPANY_A) + ' ' + ctx.pick(COMPANY_B) + ' ' + ctx.pick(COMPANY_C);
    },

    jobTitle: function (ctx) { return ctx.pick(JOB); },

    bankAccount: function (ctx) { return ctx.digits(ctx.int(9, 14)); },

    amount: function (ctx) { return ctx.int(10, 50000) * 1000; },

    uuid: function (ctx) {
      var hex = '0123456789abcdef', s = '';
      for (var i = 0; i < 36; i++) {
        if (i === 8 || i === 13 || i === 18 || i === 23) { s += '-'; continue; }
        if (i === 14) { s += '4'; continue; }
        if (i === 19) { s += hex[(ctx.int(0, 15) & 0x3) | 0x8]; continue; }
        s += hex[ctx.int(0, 15)];
      }
      return s;
    },

    createdAt: function (ctx) {
      var now = Date.now();
      var d = new Date(now - ctx.int(0, 365) * 86400000 - ctx.int(0, 86399) * 1000);
      return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
    },

    futureDate: function (ctx) {
      return iso(new Date(Date.now() + ctx.int(1, 365) * 86400000));
    },

    pastDate: function (ctx) {
      return iso(new Date(Date.now() - ctx.int(1, 3650) * 86400000));
    },

    status: function (ctx) { return ctx.pick(['ACTIVE', 'INACTIVE', 'PENDING', 'LOCKED', 'DELETED']); },

    note: function (ctx) {
      return ctx.pick(['Dữ liệu kiểm thử', 'Test record - do not use in production',
        'Sample for regression suite', 'Generated for UAT', 'Smoke test data']);
    }
  };

  // presentation metadata used by the UI (label EN / VI)
  var FIELD_META = [
    ['id', 'ID', 'ID'],
    ['fullName', 'Full name', 'Họ và tên'],
    ['gender', 'Gender', 'Giới tính'],
    ['dob', 'Date of birth', 'Ngày sinh'],
    ['email', 'Email', 'Email'],
    ['username', 'Username', 'Tên đăng nhập'],
    ['password', 'Password', 'Mật khẩu'],
    ['phone', 'Phone (VN)', 'Số điện thoại'],
    ['phoneE164', 'Phone (+84)', 'SĐT dạng +84'],
    ['address', 'Address', 'Địa chỉ'],
    ['province', 'Province / City', 'Tỉnh / Thành phố'],
    ['taxCode', 'Tax code (MST)', 'Mã số thuế (MST)'],
    ['personalId', 'Personal ID (CCCD)', 'Số CCCD'],
    ['company', 'Company', 'Công ty'],
    ['jobTitle', 'Job title', 'Chức danh'],
    ['bankAccount', 'Bank account', 'Số tài khoản'],
    ['amount', 'Amount (VND)', 'Số tiền (VND)'],
    ['uuid', 'UUID', 'UUID'],
    ['createdAt', 'Created at (ISO)', 'Ngày tạo (ISO)'],
    ['pastDate', 'Past date', 'Ngày quá khứ'],
    ['futureDate', 'Future date', 'Ngày tương lai'],
    ['status', 'Status', 'Trạng thái'],
    ['note', 'Note', 'Ghi chú']
  ];

  function generate(fields, count, seed) {
    var ctx = makeCtx(seed);
    var rows = [];
    for (var i = 0; i < count; i++) {
      var rec = {};
      // gender/fullName first so dependent fields stay consistent
      var ordered = fields.slice().sort(function (a, b) {
        var pri = { gender: 0, fullName: 1, province: 2, dob: 3 };
        return (pri[a] === undefined ? 9 : pri[a]) - (pri[b] === undefined ? 9 : pri[b]);
      });
      ordered.forEach(function (f) {
        if (FIELDS[f]) rec[f] = FIELDS[f](ctx, rec, i);
      });
      var clean = {};
      fields.forEach(function (f) { if (rec[f] !== undefined) clean[f] = rec[f]; });
      rows.push(clean);
    }
    return rows;
  }

  window.QAT.faker = {
    generate: generate,
    FIELDS: FIELDS,
    FIELD_META: FIELD_META,
    deaccent: deaccent,
    ctx: makeCtx
  };
})();
