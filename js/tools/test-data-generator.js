QAT.register({
  id: 'test-data-generator',
  group: 'generator',
  icon: '⊞',
  name: { en: 'Test Data Generator (VN)', vi: 'Tạo Test Data (Việt Nam)' },
  desc: {
    en: 'Synthetic Vietnamese names, emails, phones, addresses, MST and CCCD — export CSV, JSON or SQL.',
    vi: 'Sinh dữ liệu giả: họ tên, email, SĐT, địa chỉ, MST, CCCD — xuất CSV, JSON hoặc SQL.'
  },
  tags: ['test data', 'faker', 'csv', 'vietnam', 'mst', 'cccd'],

  build: function (root) {
    var L = QAT.L;
    var META = QAT.faker.FIELD_META;
    var DEFAULT_ON = ['id', 'fullName', 'gender', 'dob', 'email', 'phone', 'address', 'taxCode'];

    root.innerHTML =
      '<div class="status warn" style="margin-bottom:14px">' +
        L('Everything generated here is synthetic test data. Names, tax codes and ID numbers are random — never treat them as real personal data.',
          'Toàn bộ dữ liệu ở đây là dữ liệu giả dùng cho kiểm thử. Họ tên, MST và số CCCD được sinh ngẫu nhiên — không phải dữ liệu cá nhân thật.') +
      '</div>' +
      QAT.panel({
        title: L('1. Choose fields', '1. Chọn các trường'),
        actions:
          '<button class="btn sec sm" id="tdAll">' + L('Select all', 'Chọn tất cả') + '</button>' +
          '<button class="btn sec sm" id="tdNone">' + L('Clear', 'Bỏ chọn') + '</button>' +
          '<button class="btn sec sm" id="tdDef">' + L('Default set', 'Bộ mặc định') + '</button>',
        body: '<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:7px">' +
          META.map(function (m) {
            return '<label class="check"><input type="checkbox" data-f="' + m[0] + '"' +
              (DEFAULT_ON.indexOf(m[0]) !== -1 ? ' checked' : '') + '> ' + QAT.esc(L(m[1], m[2])) + '</label>';
          }).join('') + '</div>'
      }) +
      QAT.panel({
        title: L('2. Generate', '2. Sinh dữ liệu'),
        body:
          '<div class="row">' +
            '<label class="fld" style="max-width:150px">' + L('Rows', 'Số bản ghi') +
              '<input type="number" id="tdCount" value="10" min="1" max="5000"></label>' +
            '<label class="fld" style="max-width:200px">' + L('Seed (optional)', 'Seed (tùy chọn)') +
              '<input type="text" id="tdSeed" placeholder="' + L('same seed = same data', 'cùng seed = cùng dữ liệu') + '"></label>' +
            '<label class="fld" style="max-width:180px">' + L('Output format', 'Định dạng') +
              '<select id="tdFmt">' +
                '<option value="table">' + L('Table', 'Bảng') + '</option>' +
                '<option value="csv">CSV</option>' +
                '<option value="json">JSON</option>' +
                '<option value="sql">SQL INSERT</option>' +
              '</select></label>' +
            '<label class="fld" style="max-width:200px">' + L('SQL table name', 'Tên bảng SQL') +
              '<input type="text" id="tdTable" value="test_users"></label>' +
            '<button class="btn" id="tdRun">' + L('Generate data', 'Sinh dữ liệu') + '</button>' +
          '</div>' +
          '<div class="status hidden" id="tdStatus" style="margin-top:12px"></div>'
      }) +
      QAT.panel({
        title: L('3. Result', '3. Kết quả'),
        actions:
          '<button class="btn sec sm" id="tdCopy">' + L('Copy', 'Copy') + '</button>' +
          '<button class="btn sec sm" id="tdCsv">' + L('Download CSV', 'Tải CSV') + '</button>' +
          '<button class="btn sec sm" id="tdJson">' + L('Download JSON', 'Tải JSON') + '</button>',
        body: '<div id="tdOut"><p class="hint">' + L('Pick fields and press Generate data.', 'Chọn trường rồi bấm Sinh dữ liệu.') + '</p></div>'
      });

    var $ = function (s) { return root.querySelector(s); };
    var st = QAT.status($('#tdStatus'));
    var rows = [], fields = [];

    function selected() {
      return QAT.$$('[data-f]', root).filter(function (c) { return c.checked; })
        .map(function (c) { return c.getAttribute('data-f'); });
    }
    function label(f) {
      var m = META.find(function (x) { return x[0] === f; });
      return m ? L(m[1], m[2]) : f;
    }

    function run() {
      fields = selected();
      if (!fields.length) { st.err(L('Select at least one field.', 'Hãy chọn ít nhất một trường.')); return; }
      var n = Math.min(5000, Math.max(1, Number($('#tdCount').value) || 1));
      var seed = $('#tdSeed').value.trim();
      var t0 = performance.now();
      rows = QAT.faker.generate(fields, n, seed === '' ? null : seed);
      render();
      st.ok(n + L(' rows generated in ', ' bản ghi, mất ') + Math.round(performance.now() - t0) + 'ms' +
        (seed ? L(' (seed: ', ' (seed: ') + seed + ')' : ''));
    }

    function csv() { return QAT.csv.fromObjects(rows, ',', '\r\n'); }
    function json() { return JSON.stringify(rows, null, 2); }
    function sql() {
      var t = ($('#tdTable').value || 'test_users').replace(/[^\w.]/g, '');
      var cols = fields.join(', ');
      return rows.map(function (r) {
        var vals = fields.map(function (f) {
          var v = r[f];
          if (v === null || v === undefined) return 'NULL';
          if (typeof v === 'number') return String(v);
          return "'" + String(v).replace(/'/g, "''") + "'";
        }).join(', ');
        return 'INSERT INTO ' + t + ' (' + cols + ') VALUES (' + vals + ');';
      }).join('\n');
    }

    function render() {
      var fmt = $('#tdFmt').value;
      if (fmt === 'table') {
        var shown = rows.slice(0, 200);
        $('#tdOut').innerHTML = '<div class="tbl-wrap"><table class="tbl"><thead><tr>' +
          fields.map(function (f) { return '<th>' + QAT.esc(label(f)) + '</th>'; }).join('') +
          '</tr></thead><tbody>' + shown.map(function (r) {
            return '<tr>' + fields.map(function (f) {
              return '<td class="mono">' + QAT.esc(r[f] === undefined ? '' : r[f]) + '</td>';
            }).join('') + '</tr>';
          }).join('') + '</tbody></table></div>' +
          (rows.length > 200 ? '<p class="hint" style="margin-top:6px">' +
            L('Showing 200 of ', 'Hiển thị 200 / ') + rows.length + L(' rows — export to see all.', ' bản ghi — hãy xuất file để xem hết.') + '</p>' : '');
      } else {
        var text = fmt === 'csv' ? csv() : fmt === 'json' ? json() : sql();
        $('#tdOut').innerHTML = '<div class="out tall">' +
          (fmt === 'json' ? QAT.jsonHighlight(text) : QAT.esc(text)) + '</div>';
      }
    }

    $('#tdRun').addEventListener('click', run);
    $('#tdFmt').addEventListener('change', function () { if (rows.length) render(); });
    $('#tdTable').addEventListener('input', function () { if (rows.length && $('#tdFmt').value === 'sql') render(); });
    $('#tdAll').addEventListener('click', function () {
      QAT.$$('[data-f]', root).forEach(function (c) { c.checked = true; });
    });
    $('#tdNone').addEventListener('click', function () {
      QAT.$$('[data-f]', root).forEach(function (c) { c.checked = false; });
    });
    $('#tdDef').addEventListener('click', function () {
      QAT.$$('[data-f]', root).forEach(function (c) {
        c.checked = DEFAULT_ON.indexOf(c.getAttribute('data-f')) !== -1;
      });
    });
    $('#tdCopy').addEventListener('click', function () {
      if (!rows.length) { QAT.toast(QAT.t('msg.nothing'), 'err'); return; }
      var fmt = $('#tdFmt').value;
      QAT.copy(fmt === 'json' ? json() : fmt === 'sql' ? sql() : csv());
    });
    $('#tdCsv').addEventListener('click', function () {
      if (!rows.length) { QAT.toast(QAT.t('msg.nothing'), 'err'); return; }
      QAT.download('test-data.csv', csv(), 'text/csv');
    });
    $('#tdJson').addEventListener('click', function () {
      if (!rows.length) { QAT.toast(QAT.t('msg.nothing'), 'err'); return; }
      QAT.download('test-data.json', json(), 'application/json');
    });

    run();
  }
});
