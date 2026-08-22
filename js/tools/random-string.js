QAT.register({
  id: 'random-string',
  group: 'generator',
  icon: '⚁',
  name: { en: 'Random String & Boundary Values', vi: 'Chuỗi ngẫu nhiên & giá trị biên' },
  desc: {
    en: 'Random strings, passwords, and ready-made boundary / injection strings for negative tests.',
    vi: 'Tạo chuỗi ngẫu nhiên, mật khẩu và các giá trị biên / chuỗi tấn công cho test âm.'
  },
  tags: ['random', 'password', 'boundary', 'negative test', 'edge case'],

  build: function (root) {
    var L = QAT.L;

    var EDGE = [
      ['', L('Empty string', 'Chuỗi rỗng')],
      [' ', L('Single space', 'Một khoảng trắng')],
      ['   ', L('Only spaces', 'Toàn khoảng trắng')],
      ['0', L('Zero', 'Số 0')],
      ['-1', L('Negative number', 'Số âm')],
      ['999999999999999999999', L('Very large number', 'Số rất lớn')],
      ['1.7976931348623157e+308', L('Max double', 'Double lớn nhất')],
      ['null', L('Literal "null" text', 'Chuỗi "null"')],
      ['NaN', L('Literal NaN', 'Chuỗi NaN')],
      ['2026-02-30', L('Invalid date', 'Ngày không tồn tại')],
      ['2024-02-29', L('Leap day', 'Ngày nhuận')],
      ['Nguyễn Văn Ả Ệ Ữ', L('Vietnamese diacritics', 'Tiếng Việt có dấu')],
      ['😀🇻🇳👨‍👩‍👧‍👦', L('Emoji / surrogate pairs', 'Emoji / ký tự đặc biệt')],
      ['ＡＢＣ１２３', L('Full-width characters', 'Ký tự full-width')],
      ['a\tb\nc', L('Tab and newline inside value', 'Tab và xuống dòng trong giá trị')],
      ["O'Brien", L('Single quote (SQL)', 'Dấu nháy đơn (SQL)')],
      ['"quoted"', L('Double quotes (CSV/JSON)', 'Dấu nháy kép (CSV/JSON)')],
      ['a,b;c|d', L('Delimiters (CSV break)', 'Ký tự phân cách (làm hỏng CSV)')],
      ['<script>alert(1)</script>', L('XSS probe', 'Chuỗi thử XSS')],
      ["' OR '1'='1", L('SQL injection probe', 'Chuỗi thử SQL injection')],
      ['../../etc/passwd', L('Path traversal probe', 'Chuỗi thử path traversal')],
      ['{{7*7}}', L('Template injection probe', 'Chuỗi thử template injection')],
      ['%00', L('Null byte', 'Null byte')],
      ['​zero​width', L('Zero-width characters', 'Ký tự rộng bằng 0')],
      ['‮gnirts-idr', L('RTL override', 'Ký tự đảo chiều RTL')]
    ];

    root.innerHTML = QAT.panel({
      title: L('Random string', 'Chuỗi ngẫu nhiên'),
      body:
        '<div class="row">' +
          '<label class="fld" style="max-width:140px">' + L('Length', 'Độ dài') +
            '<input type="number" id="rsLen" value="16" min="1" max="4096"></label>' +
          '<label class="fld" style="max-width:140px">' + L('How many', 'Số lượng') +
            '<input type="number" id="rsCount" value="5" min="1" max="2000"></label>' +
          '<div class="row tight" style="align-items:center">' +
            '<label class="check"><input type="checkbox" id="rsUp" checked> A-Z</label>' +
            '<label class="check"><input type="checkbox" id="rsLow" checked> a-z</label>' +
            '<label class="check"><input type="checkbox" id="rsNum" checked> 0-9</label>' +
            '<label class="check"><input type="checkbox" id="rsSym"> !@#$</label>' +
            '<label class="check"><input type="checkbox" id="rsAmb"> ' + L('Avoid look-alikes (O0Il1)', 'Tránh ký tự dễ nhầm (O0Il1)') + '</label>' +
          '</div>' +
          '<button class="btn" id="rsRun">' + L('Generate', 'Tạo') + '</button>' +
        '</div>' +
        '<div class="row" style="margin-top:10px">' +
          '<button class="btn sec sm" data-preset="pwd">' + L('Strong password x10', 'Mật khẩu mạnh x10') + '</button>' +
          '<button class="btn sec sm" data-preset="otp">' + L('6-digit OTP x10', 'OTP 6 số x10') + '</button>' +
          '<button class="btn sec sm" data-preset="token">' + L('API token x5', 'API token x5') + '</button>' +
          '<button class="btn sec sm" data-preset="long">' + L('255-char string', 'Chuỗi 255 ký tự') + '</button>' +
          '<button class="btn sec sm" data-preset="over">' + L('1000-char string', 'Chuỗi 1000 ký tự') + '</button>' +
        '</div>' +
        '<div class="status hidden" id="rsStatus" style="margin-top:12px"></div>'
    }) + QAT.panel({
      title: L('Result', 'Kết quả'),
      actions:
        '<button class="btn sec sm" id="rsCopy">' + L('Copy', 'Copy') + '</button>' +
        '<button class="btn sec sm" id="rsDl">' + L('Download .txt', 'Tải .txt') + '</button>',
      body: '<div class="out" id="rsOut" data-empty="' + L('Generated values appear here.', 'Giá trị được tạo hiện ở đây.') + '"></div>'
    }) + QAT.panel({
      title: L('Boundary & malicious values (copy into your negative tests)', 'Giá trị biên & chuỗi tấn công (dùng cho test âm)'),
      actions: '<button class="btn sec sm" id="rsEdgeCsv">' + L('Download all as CSV', 'Tải tất cả dạng CSV') + '</button>',
      body:
        '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>' + L('Value', 'Giá trị') +
          '</th><th>' + L('What it tests', 'Mục đích') + '</th><th></th></tr></thead><tbody>' +
          EDGE.map(function (e, i) {
            var shown = e[0] === '' ? '(empty)' : e[0].replace(/\t/g, '\\t').replace(/\n/g, '\\n');
            return '<tr><td>' + (i + 1) + '</td><td class="mono">' + QAT.esc(shown) + '</td><td>' +
              QAT.esc(e[1]) + '</td><td><button class="btn sec sm" data-edge="' + i + '">copy</button></td></tr>';
          }).join('') +
        '</tbody></table></div>' +
        '<p class="hint" style="margin-top:10px">' +
          L('The injection strings are probes for your own application during authorised testing — they check whether input is escaped, nothing more.',
            'Các chuỗi tấn công dùng để kiểm tra chính ứng dụng của bạn khi được phép — chỉ nhằm xác minh dữ liệu vào có được escape hay không.') +
        '</p>'
    });

    var $ = function (s) { return root.querySelector(s); };
    var st = QAT.status($('#rsStatus'));

    function pool() {
      var p = '';
      if ($('#rsUp').checked) p += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      if ($('#rsLow').checked) p += 'abcdefghijklmnopqrstuvwxyz';
      if ($('#rsNum').checked) p += '0123456789';
      if ($('#rsSym').checked) p += '!@#$%^&*()-_=+[]{}';
      if ($('#rsAmb').checked) p = p.replace(/[O0Il1]/g, '');
      return p;
    }

    function make(len, chars) {
      var out = '', arr;
      if (window.crypto && window.crypto.getRandomValues) {
        arr = new Uint32Array(len);
        window.crypto.getRandomValues(arr);
        for (var i = 0; i < len; i++) out += chars[arr[i] % chars.length];
      } else {
        for (var j = 0; j < len; j++) out += chars[Math.floor(Math.random() * chars.length)];
      }
      return out;
    }

    function run() {
      var chars = pool();
      if (!chars) { st.err(L('Select at least one character set.', 'Hãy chọn ít nhất một bộ ký tự.')); return; }
      var len = Math.min(4096, Math.max(1, Number($('#rsLen').value) || 1));
      var n = Math.min(2000, Math.max(1, Number($('#rsCount').value) || 1));
      var list = [];
      for (var i = 0; i < n; i++) list.push(make(len, chars));
      $('#rsOut').textContent = list.join('\n');
      st.ok(n + L(' string(s) of length ', ' chuỗi, độ dài ') + len + '.');
    }

    QAT.$$('[data-preset]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        var p = this.getAttribute('data-preset');
        if (p === 'pwd') {
          var list = [];
          for (var i = 0; i < 10; i++) {
            list.push(make(1, 'ABCDEFGHJKLMNPQRSTUVWXYZ') + make(1, '!@#$%&*') +
              make(1, '23456789') + make(9, 'abcdefghijkmnpqrstuvwxyz23456789'));
          }
          $('#rsOut').textContent = list.join('\n');
          st.ok(L('10 strong passwords (12 chars, mixed classes).', '10 mật khẩu mạnh (12 ký tự, đủ loại).'));
        } else if (p === 'otp') {
          var o = [];
          for (var j = 0; j < 10; j++) o.push(make(6, '0123456789'));
          $('#rsOut').textContent = o.join('\n');
          st.ok(L('10 six-digit OTP codes.', '10 mã OTP 6 số.'));
        } else if (p === 'token') {
          var t = [];
          for (var k = 0; k < 5; k++) t.push('tst_' + make(40, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'));
          $('#rsOut').textContent = t.join('\n');
          st.ok(L('5 API-token shaped strings.', '5 chuỗi dạng API token.'));
        } else if (p === 'long' || p === 'over') {
          var n2 = p === 'long' ? 255 : 1000;
          $('#rsOut').textContent = make(n2, 'abcdefghijklmnopqrstuvwxyz');
          st.ok(n2 + L('-character string — use it against maxlength validation.', ' ký tự — dùng để kiểm tra giới hạn độ dài.'));
        }
      });
    });

    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-edge]');
      if (b) QAT.copy(EDGE[Number(b.getAttribute('data-edge'))][0]);
    });

    $('#rsRun').addEventListener('click', run);
    $('#rsCopy').addEventListener('click', function () { QAT.copy($('#rsOut').textContent); });
    $('#rsDl').addEventListener('click', function () { QAT.download('random.txt', $('#rsOut').textContent); });
    $('#rsEdgeCsv').addEventListener('click', function () {
      var rows = [[L('value', 'gia_tri'), L('purpose', 'muc_dich')]].concat(EDGE.map(function (e) { return [e[0], e[1]]; }));
      QAT.download('boundary-values.csv', QAT.csv.stringify(rows), 'text/csv');
    });
    run();
  }
});
