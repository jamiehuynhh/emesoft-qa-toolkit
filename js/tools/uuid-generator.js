QAT.register({
  id: 'uuid-generator',
  group: 'generator',
  icon: 'ID',
  name: { en: 'UUID / ID Generator', vi: 'Tạo UUID / ID' },
  desc: {
    en: 'Bulk UUID v4, nil UUID, ULID-style and numeric IDs for test fixtures.',
    vi: 'Tạo hàng loạt UUID v4, nil UUID, ULID và ID số cho dữ liệu kiểm thử.'
  },
  tags: ['uuid', 'guid', 'id', 'generator', 'ulid'],

  build: function (root) {
    var L = QAT.L;
    root.innerHTML = QAT.panel({
      title: L('Options', 'Tùy chọn'),
      body:
        '<div class="row">' +
          '<label class="fld" style="max-width:200px">' + L('Type', 'Loại') +
            '<select id="uuType">' +
              '<option value="v4">UUID v4 (random)</option>' +
              '<option value="v4nd">UUID v4 ' + L('without dashes', 'không dấu gạch') + '</option>' +
              '<option value="upper">UUID v4 UPPERCASE</option>' +
              '<option value="brace">UUID v4 {braced}</option>' +
              '<option value="ulid">ULID (' + L('time-sortable', 'sắp xếp theo thời gian') + ')</option>' +
              '<option value="num">' + L('Numeric ID', 'ID dạng số') + '</option>' +
              '<option value="nil">Nil UUID</option>' +
            '</select></label>' +
          '<label class="fld" style="max-width:150px">' + L('How many', 'Số lượng') +
            '<input type="number" id="uuCount" value="10" min="1" max="5000"></label>' +
          '<label class="fld" style="max-width:170px">' + L('Prefix', 'Tiền tố') +
            '<input type="text" id="uuPrefix" placeholder="TC-"></label>' +
          '<button class="btn" id="uuRun">' + L('Generate', 'Tạo') + '</button>' +
        '</div>' +
        '<div class="row" style="margin-top:10px">' +
          '<label class="check"><input type="checkbox" id="uuQuote"> ' + L('Wrap in quotes', 'Bọc dấu ngoặc kép') + '</label>' +
          '<label class="check"><input type="checkbox" id="uuComma"> ' + L('Comma separated', 'Ngăn cách bằng dấu phẩy') + '</label>' +
          '<label class="check"><input type="checkbox" id="uuSecure" checked> ' +
            L('Use crypto RNG when available', 'Dùng crypto RNG nếu có') + '</label>' +
        '</div>' +
        '<div class="status hidden" id="uuStatus" style="margin-top:12px"></div>'
    }) + QAT.panel({
      title: L('Result', 'Kết quả'),
      actions:
        '<button class="btn sec sm" id="uuCopy">' + L('Copy all', 'Copy tất cả') + '</button>' +
        '<button class="btn sec sm" id="uuDl">' + L('Download .txt', 'Tải .txt') + '</button>',
      body: '<div class="out tall" id="uuOut" data-empty="' + L('Generated IDs appear here.', 'ID được tạo sẽ hiện ở đây.') + '"></div>'
    });

    var $ = function (s) { return root.querySelector(s); };
    var st = QAT.status($('#uuStatus'));

    function rand16() {
      if ($('#uuSecure').checked && window.crypto && window.crypto.getRandomValues) {
        var a = new Uint8Array(16);
        window.crypto.getRandomValues(a);
        return a;
      }
      var b = new Uint8Array(16);
      for (var i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
      return b;
    }

    function uuidv4() {
      if ($('#uuSecure').checked && window.crypto && window.crypto.randomUUID) {
        return window.crypto.randomUUID();
      }
      var b = rand16();
      b[6] = (b[6] & 0x0f) | 0x40;
      b[8] = (b[8] & 0x3f) | 0x80;
      var h = Array.prototype.map.call(b, function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join('');
      return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
    }

    var B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    function ulid() {
      var t = Date.now(), time = '';
      for (var i = 0; i < 10; i++) { time = B32[t % 32] + time; t = Math.floor(t / 32); }
      var b = rand16(), rnd = '';
      for (var j = 0; j < 16; j++) rnd += B32[b[j] % 32];
      return time + rnd;
    }

    function one(type, i) {
      switch (type) {
        case 'v4': return uuidv4();
        case 'v4nd': return uuidv4().replace(/-/g, '');
        case 'upper': return uuidv4().toUpperCase();
        case 'brace': return '{' + uuidv4() + '}';
        case 'ulid': return ulid();
        case 'nil': return '00000000-0000-0000-0000-000000000000';
        case 'num': return String(Date.now()).slice(-6) + QAT.pad(i + 1, 4);
        default: return uuidv4();
      }
    }

    function run() {
      var n = Math.min(5000, Math.max(1, Number($('#uuCount').value) || 1));
      var type = $('#uuType').value, pre = $('#uuPrefix').value;
      var list = [];
      for (var i = 0; i < n; i++) {
        var v = pre + one(type, i);
        if ($('#uuQuote').checked) v = '"' + v + '"';
        list.push(v);
      }
      var text = $('#uuComma').checked ? list.join(', ') : list.join('\n');
      $('#uuOut').textContent = text;
      var unique = new Set(list).size;
      st.ok(n + L(' generated — unique: ', ' giá trị — không trùng: ') + unique + '/' + n);
    }

    $('#uuRun').addEventListener('click', run);
    QAT.$$('#uuType,#uuCount,#uuPrefix,#uuQuote,#uuComma', root).forEach(function (n) {
      n.addEventListener('change', run);
    });
    $('#uuCopy').addEventListener('click', function () { QAT.copy($('#uuOut').textContent); });
    $('#uuDl').addEventListener('click', function () {
      if (!$('#uuOut').textContent) { QAT.toast(QAT.t('msg.nothing'), 'err'); return; }
      QAT.download('ids.txt', $('#uuOut').textContent);
    });
    run();
  }
});
