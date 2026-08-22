QAT.register({
  id: 'text-compare',
  group: 'text',
  icon: '⇄',
  name: { en: 'Text Compare', vi: 'So sánh văn bản' },
  desc: {
    en: 'Line-by-line diff of two texts with inline word highlighting.',
    vi: 'So sánh hai đoạn văn bản theo từng dòng, làm nổi bật phần khác nhau.'
  },
  tags: ['diff', 'compare', 'text', 'json'],

  build: function (root) {
    var L = QAT.L;
    root.innerHTML =
      QAT.panel({
        title: L('Input', 'Dữ liệu vào'),
        actions:
          '<label class="check"><input type="checkbox" id="tcTrim" checked> ' + L('Trim lines', 'Bỏ khoảng trắng đầu/cuối') + '</label>' +
          '<label class="check"><input type="checkbox" id="tcCase"> ' + L('Ignore case', 'Bỏ qua hoa/thường') + '</label>' +
          '<label class="check"><input type="checkbox" id="tcBlank"> ' + L('Ignore blank lines', 'Bỏ dòng trống') + '</label>' +
          '<label class="check"><input type="checkbox" id="tcOnlyDiff"> ' + L('Only differences', 'Chỉ hiện khác biệt') + '</label>',
        body:
          '<div class="split">' +
            '<label class="fld">' + L('Original (A)', 'Bản gốc (A)') +
              '<textarea id="tcA" spellcheck="false" placeholder="' + L('Paste the expected text...', 'Dán nội dung mong đợi...') + '"></textarea></label>' +
            '<label class="fld">' + L('Changed (B)', 'Bản mới (B)') +
              '<textarea id="tcB" spellcheck="false" placeholder="' + L('Paste the actual text...', 'Dán nội dung thực tế...') + '"></textarea></label>' +
          '</div>' +
          '<div class="row" style="margin-top:12px">' +
            '<button class="btn" id="tcRun">' + L('Compare', 'So sánh') + '</button>' +
            '<button class="btn sec" id="tcSwap">' + L('Swap A / B', 'Đổi A / B') + '</button>' +
            '<button class="btn sec" id="tcSample">' + L('Load sample', 'Dữ liệu mẫu') + '</button>' +
            '<button class="btn sec" id="tcClear">' + L('Clear', 'Xóa') + '</button>' +
          '</div>'
      }) +
      QAT.panel({
        title: L('Result', 'Kết quả'),
        actions: '<button class="btn sec sm" id="tcCopy">' + L('Copy diff', 'Copy diff') + '</button>',
        body:
          '<div class="stats" id="tcStats" style="margin-bottom:12px"></div>' +
          '<div class="status hidden" id="tcStatus"></div>' +
          '<div id="tcOut"></div>'
      });

    var $ = function (s) { return root.querySelector(s); };
    var st = QAT.status($('#tcStatus'));
    var lastText = '';

    function norm(line) {
      var s = line;
      if ($('#tcTrim').checked) s = s.trim();
      if ($('#tcCase').checked) s = s.toLowerCase();
      return s;
    }

    function run() {
      var a = $('#tcA').value, b = $('#tcB').value;
      if (!a && !b) { st.warn(L('Enter text in both panes.', 'Hãy nhập nội dung ở cả hai bên.')); return; }

      var A = a.replace(/\r\n?/g, '\n').split('\n');
      var B = b.replace(/\r\n?/g, '\n').split('\n');
      if ($('#tcBlank').checked) {
        A = A.filter(function (l) { return l.trim() !== ''; });
        B = B.filter(function (l) { return l.trim() !== ''; });
      }
      var nA = A.map(norm), nB = B.map(norm);
      var res = QAT.diff.seq(nA, nB);

      var add = 0, del = 0, same = 0;
      res.ops.forEach(function (o) {
        if (o.type === 'add') add++; else if (o.type === 'del') del++; else same++;
      });

      $('#tcStats').innerHTML =
        stat(same, L('Unchanged', 'Giống nhau')) +
        stat(del, L('Removed', 'Bị xóa')) +
        stat(add, L('Added', 'Thêm mới')) +
        stat(A.length + ' / ' + B.length, L('Lines A / B', 'Số dòng A / B'));

      var onlyDiff = $('#tcOnlyDiff').checked;
      var html = '<div class="diff">', plain = [];

      // pair a del immediately followed by an add -> inline word highlight
      for (var i = 0; i < res.ops.length; i++) {
        var o = res.ops[i], nx = res.ops[i + 1];
        if (o.type === 'del' && nx && nx.type === 'add') {
          var w = QAT.diff.words(A[o.a], B[nx.b]);
          html += row('del', o.a + 1, '', w.a);
          html += row('add', '', nx.b + 1, w.b);
          plain.push('- ' + A[o.a], '+ ' + B[nx.b]);
          i++; continue;
        }
        if (o.type === 'del') { html += row('del', o.a + 1, '', QAT.esc(A[o.a])); plain.push('- ' + A[o.a]); continue; }
        if (o.type === 'add') { html += row('add', '', o.b + 1, QAT.esc(B[o.b])); plain.push('+ ' + B[o.b]); continue; }
        if (!onlyDiff) { html += row('same', o.a + 1, o.b + 1, QAT.esc(A[o.a])); plain.push('  ' + A[o.a]); }
      }
      html += '</div>';
      $('#tcOut').innerHTML = html;
      lastText = plain.join('\n');

      if (res.truncated) st.warn(L('Input very large — comparison was truncated.', 'Dữ liệu quá lớn — phần so sánh đã bị cắt bớt.'));
      else if (!add && !del) st.ok(L('Identical.', 'Hai bên giống nhau hoàn toàn.'));
      else st.info(del + L(' removed, ', ' dòng bị xóa, ') + add + L(' added.', ' dòng thêm mới.'));
    }

    function row(cls, la, lb, txt) {
      return '<div class="diff-row ' + cls + '"><div class="ln">' + la + '</div><div class="ln">' + lb +
        '</div><div class="tx">' + (txt === '' ? '&nbsp;' : txt) + '</div></div>';
    }
    function stat(v, lbl) {
      return '<div class="stat"><b>' + v + '</b><span>' + lbl + '</span></div>';
    }

    $('#tcRun').addEventListener('click', run);
    $('#tcSwap').addEventListener('click', function () {
      var t = $('#tcA').value; $('#tcA').value = $('#tcB').value; $('#tcB').value = t; run();
    });
    $('#tcClear').addEventListener('click', function () {
      $('#tcA').value = ''; $('#tcB').value = ''; $('#tcOut').innerHTML = '';
      $('#tcStats').innerHTML = ''; st.hide();
    });
    $('#tcCopy').addEventListener('click', function () { QAT.copy(lastText); });
    $('#tcSample').addEventListener('click', function () {
      $('#tcA').value = '{\n  "id": 1001,\n  "name": "Nguyen Van A",\n  "email": "a@example.com",\n  "status": "ACTIVE",\n  "balance": 250000\n}';
      $('#tcB').value = '{\n  "id": 1001,\n  "name": "Nguyen Van An",\n  "email": "a@example.com",\n  "status": "LOCKED",\n  "balance": 250000,\n  "updatedAt": "2026-08-22"\n}';
      run();
    });

    ['#tcTrim', '#tcCase', '#tcBlank', '#tcOnlyDiff'].forEach(function (s) {
      $(s).addEventListener('change', function () { if (lastText) run(); });
    });
  }
});
