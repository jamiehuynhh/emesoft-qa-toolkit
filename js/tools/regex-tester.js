QAT.register({
  id: 'regex-tester',
  group: 'text',
  icon: '.*',
  name: { en: 'Regex Tester', vi: 'Kiểm tra Regex' },
  desc: {
    en: 'Test a regular expression against sample text: matches, groups, replace preview.',
    vi: 'Thử biểu thức chính quy trên dữ liệu mẫu: kết quả khớp, group, xem trước replace.'
  },
  tags: ['regex', 'validation', 'match', 'pattern'],

  build: function (root) {
    var L = QAT.L;
    var PRESETS = [
      ['', L('— Common patterns —', '— Mẫu thường dùng —'), ''],
      ['^[\\w.+-]+@[\\w-]+\\.[\\w.-]+$', 'Email', 'Email'],
      ['^(0|\\+84)(3[2-9]|5[2689]|7[06-9]|8[1-9]|9[0-9])\\d{7}$', 'VN phone number', 'Số điện thoại VN'],
      ['^\\d{10}(-\\d{3})?$', 'VN tax code (MST)', 'Mã số thuế (MST)'],
      ['^\\d{12}$', 'VN personal ID (CCCD)', 'Số CCCD'],
      ['^\\d{4}-\\d{2}-\\d{2}$', 'Date yyyy-MM-dd', 'Ngày yyyy-MM-dd'],
      ['^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$', 'UUID', 'UUID'],
      ['^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?=.*[^\\w\\s]).{8,}$', 'Strong password', 'Mật khẩu mạnh'],
      ['^https?:\\/\\/[^\\s/$.?#].[^\\s]*$', 'URL', 'URL'],
      ['\\b\\d{1,3}(\\.\\d{1,3}){3}\\b', 'IPv4', 'IPv4']
    ];

    root.innerHTML = QAT.panel({
      title: L('Pattern', 'Biểu thức'),
      body:
        '<div class="row">' +
          '<label class="fld grow">' + L('Regular expression', 'Biểu thức chính quy') +
            '<input type="text" id="rxPat" class="mono" placeholder="^[\\w.+-]+@[\\w-]+\\.[\\w.-]+$"></label>' +
          '<label class="fld" style="max-width:150px">' + L('Flags', 'Flags') +
            '<input type="text" id="rxFlags" class="mono" value="gm"></label>' +
          '<label class="fld" style="max-width:230px">' + L('Preset', 'Mẫu có sẵn') +
            '<select id="rxPreset">' + PRESETS.map(function (p, i) {
              return '<option value="' + i + '">' + QAT.esc(p[1]) + '</option>';
            }).join('') + '</select></label>' +
        '</div>' +
        '<div class="row tight" style="margin-top:8px">' +
          ['g', 'i', 'm', 's', 'u', 'y'].map(function (f) {
            return '<label class="check"><input type="checkbox" data-flag="' + f + '"> ' + f + '</label>';
          }).join('') +
        '</div>' +
        '<div class="status hidden" id="rxStatus" style="margin-top:10px"></div>'
    }) + QAT.panel({
      title: L('Test string', 'Dữ liệu kiểm tra'),
      actions: '<label class="check"><input type="checkbox" id="rxPerLine"> ' +
        L('Treat each line as a separate value', 'Coi mỗi dòng là một giá trị') + '</label>',
      body:
        '<textarea id="rxText" spellcheck="false" placeholder="' +
          L('Paste text to test against...', 'Dán dữ liệu cần kiểm tra...') + '"></textarea>' +
        '<div class="row" style="margin-top:10px">' +
          '<label class="fld grow">' + L('Replace with (optional, $1 for groups)', 'Thay thế bằng (tùy chọn, $1 cho group)') +
            '<input type="text" id="rxRepl" class="mono" placeholder="[$&]"></label>' +
        '</div>'
    }) + QAT.panel({
      title: L('Matches', 'Kết quả khớp'),
      actions: '<button class="btn sec sm" id="rxCopy">' + L('Copy matches', 'Copy kết quả') + '</button>',
      body:
        '<div id="rxHi" class="out" data-empty="' + L('Highlighted text appears here.', 'Văn bản được tô sáng hiện ở đây.') + '"></div>' +
        '<div id="rxList" style="margin-top:12px"></div>' +
        '<div id="rxReplOut" style="margin-top:12px"></div>'
    });

    var $ = function (s) { return root.querySelector(s); };
    var st = QAT.status($('#rxStatus'));

    function syncFlagBoxes() {
      var f = $('#rxFlags').value;
      QAT.$$('[data-flag]', root).forEach(function (cb) {
        cb.checked = f.indexOf(cb.getAttribute('data-flag')) !== -1;
      });
    }
    QAT.$$('[data-flag]', root).forEach(function (cb) {
      cb.addEventListener('change', function () {
        var f = $('#rxFlags').value.split('');
        var ch = cb.getAttribute('data-flag');
        if (cb.checked) { if (f.indexOf(ch) === -1) f.push(ch); }
        else f = f.filter(function (x) { return x !== ch; });
        $('#rxFlags').value = f.join('');
        run();
      });
    });

    function run() {
      var pat = $('#rxPat').value;
      var flags = $('#rxFlags').value;
      var text = $('#rxText').value;
      $('#rxList').innerHTML = ''; $('#rxReplOut').innerHTML = '';

      if (!pat) { st.hide(); $('#rxHi').textContent = ''; return; }

      var re;
      try { re = new RegExp(pat, flags); }
      catch (e) { st.err(L('Invalid regex: ', 'Regex không hợp lệ: ') + e.message); $('#rxHi').textContent = ''; return; }

      if ($('#rxPerLine').checked) return perLine(re, text);

      var g = flags.indexOf('g') !== -1;
      var matches = [], m, guard = 0;
      if (g) {
        re.lastIndex = 0;
        while ((m = re.exec(text)) !== null) {
          matches.push(m);
          if (m.index === re.lastIndex) re.lastIndex++;
          if (++guard > 20000) break;
        }
      } else {
        m = re.exec(text);
        if (m) matches.push(m);
      }

      // highlight
      var html = '', pos = 0;
      matches.forEach(function (mm) {
        html += QAT.esc(text.slice(pos, mm.index));
        html += '<span class="mark-add">' + QAT.esc(mm[0] === '' ? '∅' : mm[0]) + '</span>';
        pos = mm.index + (mm[0].length || 0);
      });
      html += QAT.esc(text.slice(pos));
      $('#rxHi').innerHTML = html || '';

      if (!matches.length) { st.warn(L('No match.', 'Không khớp.')); return; }
      st.ok(matches.length + L(' match(es) found.', ' kết quả khớp.'));

      var hasGroups = matches.some(function (mm) { return mm.length > 1 || mm.groups; });
      var rows = matches.slice(0, 300).map(function (mm, i) {
        var groups = '';
        for (var k = 1; k < mm.length; k++) {
          groups += '<div><b>$' + k + '</b> = ' + QAT.esc(mm[k] === undefined ? '(undefined)' : mm[k]) + '</div>';
        }
        if (mm.groups) {
          Object.keys(mm.groups).forEach(function (n) {
            groups += '<div><b>' + QAT.esc(n) + '</b> = ' + QAT.esc(mm.groups[n]) + '</div>';
          });
        }
        return '<tr><td>' + (i + 1) + '</td><td class="mono">' + QAT.esc(mm[0]) + '</td><td>' + mm.index +
          '</td><td class="mono">' + (groups || '—') + '</td></tr>';
      }).join('');

      $('#rxList').innerHTML = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>' +
        L('Match', 'Giá trị khớp') + '</th><th>' + L('Index', 'Vị trí') + '</th><th>' +
        L('Groups', 'Group') + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
        (matches.length > 300 ? '<p class="hint" style="margin-top:6px">' +
          L('Showing first 300 matches.', 'Chỉ hiển thị 300 kết quả đầu.') + '</p>' : '') +
        (hasGroups ? '' : '');

      var repl = $('#rxRepl').value;
      if (repl !== '') {
        var replaced;
        try { replaced = text.replace(re, repl); } catch (e) { replaced = e.message; }
        $('#rxReplOut').innerHTML = '<label class="fld">' + L('Replace preview', 'Xem trước sau khi thay thế') +
          '</label><div class="out" style="margin-top:5px">' + QAT.esc(replaced) + '</div>';
      }
    }

    function perLine(re, text) {
      var lines = text.replace(/\r\n?/g, '\n').split('\n');
      var pass = 0, fail = 0;
      var rows = lines.map(function (l, i) {
        if (l.trim() === '') return '';
        re.lastIndex = 0;
        var ok = re.test(l);
        re.lastIndex = 0;
        if (ok) pass++; else fail++;
        return '<tr><td>' + (i + 1) + '</td><td class="mono">' + QAT.esc(l) + '</td><td><span class="pill ' +
          (ok ? 'ok">PASS' : 'err">FAIL') + '</span></td></tr>';
      }).join('');
      $('#rxHi').textContent = '';
      $('#rxList').innerHTML = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>' +
        L('Value', 'Giá trị') + '</th><th>' + L('Result', 'Kết quả') + '</th></tr></thead><tbody>' +
        rows + '</tbody></table></div>';
      if (fail === 0 && pass > 0) st.ok(pass + L(' value(s) matched, 0 failed.', ' giá trị khớp, 0 lỗi.'));
      else st.info(pass + L(' passed / ', ' khớp / ') + fail + L(' failed.', ' không khớp.'));
    }

    $('#rxPreset').addEventListener('change', function () {
      var p = PRESETS[Number(this.value)];
      if (p && p[0]) { $('#rxPat').value = p[0]; syncFlagBoxes(); run(); }
    });
    ['#rxPat', '#rxFlags', '#rxText', '#rxRepl'].forEach(function (s) {
      $(s).addEventListener('input', function () { if (s === '#rxFlags') syncFlagBoxes(); run(); });
    });
    $('#rxPerLine').addEventListener('change', run);
    $('#rxCopy').addEventListener('click', function () {
      QAT.copy(QAT.$$('#rxList td.mono', root).map(function (t) { return t.textContent; }).join('\n'));
    });

    // sensible starting point
    $('#rxPat').value = PRESETS[1][0];
    $('#rxText').value = 'qa.tester@example.com\ninvalid-email@\nnguyen.van.a@emesoft.net';
    $('#rxPerLine').checked = true;
    syncFlagBoxes();
    run();
  }
});
