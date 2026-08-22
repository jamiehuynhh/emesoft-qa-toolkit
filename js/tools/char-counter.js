QAT.register({
  id: 'char-counter',
  group: 'text',
  icon: '№',
  name: { en: 'Character & Word Counter', vi: 'Đếm ký tự & từ' },
  desc: {
    en: 'Count characters, words, lines and bytes — handy for field length validation.',
    vi: 'Đếm ký tự, từ, dòng và byte — hữu ích khi kiểm tra giới hạn độ dài trường.'
  },
  tags: ['count', 'length', 'validation', 'bytes'],

  build: function (root) {
    var L = QAT.L;
    root.innerHTML = QAT.panel({
      title: L('Text', 'Văn bản'),
      actions: '<label class="check"><input type="checkbox" id="ccLive" checked> ' + L('Live count', 'Đếm tức thời') + '</label>',
      body:
        '<textarea id="ccIn" spellcheck="false" placeholder="' + L('Type or paste text...', 'Nhập hoặc dán văn bản...') + '"></textarea>' +
        '<div class="row" style="margin-top:12px">' +
          '<button class="btn" id="ccRun">' + L('Count', 'Đếm') + '</button>' +
          '<button class="btn sec" id="ccClear">' + L('Clear', 'Xóa') + '</button>' +
          '<label class="fld" style="margin-left:auto">' + L('Max length check', 'Kiểm tra độ dài tối đa') +
            '<input type="number" id="ccMax" min="0" step="1" placeholder="255" style="width:120px"></label>' +
        '</div>'
    }) + QAT.panel({
      title: L('Statistics', 'Thống kê'),
      body: '<div class="stats" id="ccStats"></div>' +
            '<div class="status hidden" id="ccStatus" style="margin-top:12px"></div>' +
            '<div style="margin-top:14px" id="ccExtra"></div>'
    });

    var $ = function (s) { return root.querySelector(s); };
    var st = QAT.status($('#ccStatus'));

    function run() {
      var s = $('#ccIn').value;
      var chars = Array.from(s).length;                    // code points, not UTF-16 units
      var noSpace = Array.from(s.replace(/\s/g, '')).length;
      var words = s.trim() ? s.trim().split(/\s+/).length : 0;
      var lines = s === '' ? 0 : s.replace(/\r\n?/g, '\n').split('\n').length;
      var nonEmptyLines = s.replace(/\r\n?/g, '\n').split('\n').filter(function (l) { return l.trim() !== ''; }).length;
      var bytes = QAT.byteLen(s);
      var sentences = (s.match(/[^.!?…]+[.!?…]+/g) || []).length + (/[^.!?…\s][\s]*$/.test(s) && s.trim() ? 1 : 0);
      var paragraphs = s.trim() ? s.trim().split(/\n\s*\n/).length : 0;

      $('#ccStats').innerHTML =
        stat(chars, L('Characters', 'Ký tự')) +
        stat(noSpace, L('No spaces', 'Không tính khoảng trắng')) +
        stat(words, L('Words', 'Từ')) +
        stat(lines, L('Lines', 'Dòng')) +
        stat(bytes, L('Bytes (UTF-8)', 'Byte (UTF-8)'));

      $('#ccExtra').innerHTML =
        '<div class="kv">' +
          kv(L('Non-empty lines', 'Dòng không trống'), nonEmptyLines) +
          kv(L('Sentences (approx.)', 'Số câu (xấp xỉ)'), sentences) +
          kv(L('Paragraphs', 'Đoạn'), paragraphs) +
          kv(L('Longest line', 'Dòng dài nhất'), Math.max.apply(null, [0].concat(
            s.replace(/\r\n?/g, '\n').split('\n').map(function (l) { return Array.from(l).length; })))) +
          kv(L('UTF-16 length (JS .length)', 'Độ dài UTF-16 (JS .length)'), s.length) +
          kv(L('Size', 'Kích thước'), QAT.bytes(bytes)) +
        '</div>';

      var max = Number($('#ccMax').value);
      if (max > 0) {
        if (chars > max) st.err(L('Too long: ', 'Vượt giới hạn: ') + chars + ' / ' + max + L(' characters (over by ', ' ký tự (thừa ') + (chars - max) + ')');
        else st.ok(L('Within limit: ', 'Trong giới hạn: ') + chars + ' / ' + max + L(' characters (', ' ký tự (còn ') + (max - chars) + L(' left)', ')'));
      } else st.hide();
    }

    function stat(v, l) { return '<div class="stat"><b>' + v + '</b><span>' + l + '</span></div>'; }
    function kv(k, v) { return '<div class="k">' + k + '</div><div class="v">' + QAT.esc(v) + '</div>'; }

    $('#ccRun').addEventListener('click', run);
    $('#ccMax').addEventListener('input', run);
    $('#ccIn').addEventListener('input', function () { if ($('#ccLive').checked) run(); });
    $('#ccClear').addEventListener('click', function () {
      $('#ccIn').value = ''; run();
    });
    run();
  }
});
