QAT.register({
  id: 'vn-validator',
  group: 'data',
  icon: '✓VN',
  name: { en: 'VN Data Validator', vi: 'Kiểm tra dữ liệu Việt Nam' },
  desc: {
    en: 'Paste a column of MST, CCCD, phones or emails and see which rows are wrong, and why.',
    vi: 'Dán một cột MST, CCCD, SĐT hoặc email để biết dòng nào sai và sai vì sao.'
  },
  tags: ['validate', 'mst', 'cccd', 'phone', 'email', 'import', 'excel', 'checksum'],

  build: function (root) {
    var L = QAT.L;
    var last = null, lastType = null;

    var opts = Object.keys(QAT.vnvalid.TYPES).map(function (k) {
      var t = QAT.vnvalid.TYPES[k];
      return '<option value="' + k + '">' + QAT.esc(L(t.en, t.vi)) + '</option>';
    }).join('');

    root.innerHTML =
      QAT.panel({
        title: L('Values (one per line — paste a column straight from Excel)',
                 'Danh sách giá trị (mỗi dòng một giá trị — dán trực tiếp cột từ Excel)'),
        body:
          '<textarea id="vvIn" spellcheck="false" placeholder="0100109106\n0912345678\n001201207225"></textarea>' +
          '<div class="row" style="margin-top:12px">' +
            '<label class="fld" style="max-width:250px">' + L('Type', 'Loại dữ liệu') +
              '<select id="vvType"><option value="auto">' + L('Auto detect', 'Tự nhận') + '</option>' + opts + '</select></label>' +
            '<button class="btn" id="vvRun">' + L('Validate', 'Kiểm tra') + '</button>' +
            '<button class="btn sec" id="vvSample">' + L('Sample', 'Mẫu') + '</button>' +
            '<button class="btn sec" id="vvClear">' + L('Clear', 'Xóa') + '</button>' +
            '<label class="check" style="margin-left:auto"><input type="checkbox" id="vvOnlyBad"> ' +
              L('Show only problems', 'Chỉ hiện dòng có vấn đề') + '</label>' +
          '</div>' +
          '<div class="status hidden" id="vvStatus" style="margin-top:12px"></div>'
      }) +
      '<div id="vvOut"></div>';

    var $ = function (s) { return root.querySelector(s); };
    var st = QAT.status($('#vvStatus'));

    function run() {
      var lines = $('#vvIn').value.replace(/\r\n?/g, '\n').split('\n')
        .map(function (l) { return l.trim(); });
      // drop trailing blanks that Excel always adds
      while (lines.length && lines[lines.length - 1] === '') lines.pop();
      if (!lines.length) { st.warn(L('Paste some values first.', 'Hãy dán dữ liệu vào trước.')); return; }

      var type = $('#vvType').value;
      var detected = false;
      if (type === 'auto') { type = QAT.vnvalid.detect(lines); detected = true; }
      lastType = type;
      last = QAT.vnvalid.validateList(lines, type);

      var meta = QAT.vnvalid.TYPES[type];
      var name = L(meta.en, meta.vi);
      if (last.invalid === 0) {
        st.ok((detected ? L('Detected as ', 'Nhận dạng là ') + name + '. ' : '') +
          L('All ', 'Tất cả ') + last.total + L(' values valid.', ' giá trị đều hợp lệ.'));
      } else {
        st.err((detected ? L('Detected as ', 'Nhận dạng là ') + name + '. ' : '') +
          last.invalid + '/' + last.total + L(' values invalid.', ' giá trị không hợp lệ.'));
      }
      render(name);
    }

    function render(name) {
      var rows = last.rows;
      if ($('#vvOnlyBad').checked) {
        rows = rows.filter(function (r) { return !r.valid || r.duplicate; });
      }

      // group the reasons: one repeated mistake is one fix, not fifty
      var reasons = {};
      last.rows.filter(function (r) { return !r.valid; })
        .forEach(function (r) { reasons[r.reason] = (reasons[r.reason] || 0) + 1; });
      var reasonList = Object.keys(reasons).sort(function (a, b) { return reasons[b] - reasons[a]; });

      $('#vvOut').innerHTML =
        QAT.panel({
          title: L('Summary', 'Tổng hợp') + ' — ' + QAT.esc(name),
          actions: '<button class="btn sec sm" id="vvCsv">' + L('Export result CSV', 'Xuất CSV kết quả') + '</button>' +
                   '<button class="btn sec sm" id="vvCopyBad">' + L('Copy invalid values', 'Copy giá trị sai') + '</button>',
          body:
            '<div class="stats">' +
              stat(last.total, L('Total', 'Tổng')) +
              stat(last.valid, L('Valid', 'Hợp lệ')) +
              stat(last.invalid, L('Invalid', 'Không hợp lệ')) +
              stat(last.duplicates, L('Duplicated values', 'Giá trị bị trùng')) +
              stat(last.total ? Math.round(last.valid / last.total * 100) + '%' : '—', L('Pass rate', 'Tỷ lệ hợp lệ')) +
            '</div>' +
            (reasonList.length
              ? '<div style="margin-top:14px"><label class="fld">' +
                  L('Grouped reasons', 'Nhóm theo nguyên nhân') + '</label><div class="stack" style="margin-top:6px">' +
                reasonList.map(function (r) {
                  return '<div class="status warn"><b>' + reasons[r] + '×</b> ' + QAT.esc(r) + '</div>';
                }).join('') + '</div></div>'
              : '')
        }) +
        QAT.panel({
          title: L('Rows', 'Chi tiết từng dòng') + ' (' + rows.length + ')',
          body: rows.length
            ? '<div class="tbl-wrap"><table class="tbl"><thead><tr>' +
              '<th>' + L('Line', 'Dòng') + '</th><th>' + L('Value', 'Giá trị') + '</th>' +
              '<th>' + L('Result', 'Kết quả') + '</th><th>' + L('Reason', 'Lý do') + '</th>' +
              '</tr></thead><tbody>' +
              rows.map(function (r) {
                return '<tr><td>' + r.line + '</td>' +
                  '<td class="mono">' + QAT.esc(r.value || '(empty)') + '</td>' +
                  '<td><span class="pill ' + (r.valid ? 'ok">PASS' : 'err">FAIL') + '</span>' +
                  (r.duplicate ? ' <span class="pill warn">x' + r.duplicate + '</span>' : '') + '</td>' +
                  '<td>' + QAT.esc(r.reason) + '</td></tr>';
              }).join('') + '</tbody></table></div>'
            : '<p class="hint">' + L('Nothing to show with this filter.', 'Không có dòng nào khớp bộ lọc.') + '</p>'
        });

      $('#vvCsv').addEventListener('click', function () {
        var out = [[L('line', 'dong'), L('value', 'gia_tri'), L('valid', 'hop_le'), L('reason', 'ly_do'), L('duplicate_count', 'so_lan_trung')]];
        last.rows.forEach(function (r) {
          out.push([r.line, r.value, r.valid ? 'PASS' : 'FAIL', r.reason, r.duplicate || '']);
        });
        QAT.download('validation-' + lastType + '.csv', QAT.csv.stringify(out), 'text/csv');
      });
      $('#vvCopyBad').addEventListener('click', function () {
        var bad = last.rows.filter(function (r) { return !r.valid; }).map(function (r) { return r.value; });
        if (!bad.length) { QAT.toast(L('No invalid values', 'Không có giá trị sai'), 'ok'); return; }
        QAT.copy(bad.join('\n'));
      });
    }

    function stat(v, l) { return '<div class="stat"><b>' + v + '</b><span>' + l + '</span></div>'; }

    $('#vvRun').addEventListener('click', run);
    $('#vvType').addEventListener('change', function () { if (last) run(); });
    $('#vvOnlyBad').addEventListener('change', function () { if (last) render(L(QAT.vnvalid.TYPES[lastType].en, QAT.vnvalid.TYPES[lastType].vi)); });
    $('#vvClear').addEventListener('click', function () {
      $('#vvIn').value = ''; $('#vvOut').innerHTML = ''; st.hide(); last = null;
    });

    $('#vvSample').addEventListener('click', function () {
      // a realistic messy import: valid rows, wrong check digits, old formats, duplicates
      $('#vvIn').value = [
        '0100109106',
        '0100109107',
        '3567940508',
        '123456789',
        '0100109106',
        '01001091',
        '4524621523',
        'MST: 8715508999'
      ].join('\n');
      $('#vvType').value = 'taxCode';
      run();
    });
  }
});
