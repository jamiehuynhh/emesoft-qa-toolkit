QAT.register({
  id: 'sql-formatter',
  group: 'data',
  icon: 'SQL',
  name: { en: 'SQL Formatter', vi: 'Định dạng SQL' },
  desc: {
    en: 'Pretty-print long SQL so you can read the query you are about to verify.',
    vi: 'Định dạng câu SQL dài để dễ đọc và dễ đối chiếu khi kiểm thử.'
  },
  tags: ['sql', 'format', 'database', 'query'],

  build: function (root) {
    var L = QAT.L;
    root.innerHTML = QAT.panel({
      title: L('SQL input', 'Câu SQL'),
      actions:
        '<label class="fld" style="max-width:130px;font-size:11px">' + L('Keywords', 'Từ khóa') +
          '<select id="sqCase"><option value="upper">UPPER</option><option value="lower">lower</option>' +
          '<option value="keep">' + L('Keep', 'Giữ nguyên') + '</option></select></label>' +
        '<label class="fld" style="max-width:110px;font-size:11px">' + L('Indent', 'Thụt lề') +
          '<select id="sqInd"><option value="2">2</option><option value="4">4</option></select></label>' +
        '<label class="check"><input type="checkbox" id="sqComma" checked> ' +
          L('Break on commas', 'Ngắt dòng ở dấu phẩy') + '</label>',
      body:
        '<textarea id="sqIn" spellcheck="false" placeholder="select * from users u join orders o on o.user_id = u.id where u.status = \'ACTIVE\' and o.total > 100000 order by o.created_at desc"></textarea>' +
        '<div class="row" style="margin-top:12px">' +
          '<button class="btn" id="sqRun">' + L('Format', 'Định dạng') + '</button>' +
          '<button class="btn sec" id="sqMin">' + L('Minify', 'Thu gọn') + '</button>' +
          '<button class="btn sec" id="sqSample">' + L('Sample', 'Mẫu') + '</button>' +
          '<button class="btn sec" id="sqClear">' + L('Clear', 'Xóa') + '</button>' +
        '</div>' +
        '<div class="status hidden" id="sqStatus" style="margin-top:12px"></div>'
    }) + QAT.panel({
      title: L('Formatted SQL', 'SQL sau khi định dạng'),
      actions:
        '<button class="btn sec sm" id="sqCopy">' + L('Copy', 'Copy') + '</button>' +
        '<button class="btn sec sm" id="sqDl">' + L('Download .sql', 'Tải .sql') + '</button>',
      body: '<div class="out tall" id="sqOut" data-empty="' + L('Formatted SQL appears here.', 'SQL sau khi định dạng hiện ở đây.') + '"></div>'
    });

    var $ = function (s) { return root.querySelector(s); };
    var st = QAT.status($('#sqStatus'));

    function run(min) {
      var src = $('#sqIn').value;
      if (!src.trim()) { st.warn(L('Input is empty.', 'Chưa có dữ liệu.')); return; }
      try {
        var out = min ? QAT.sql.minify(src) : QAT.sql.format(src, {
          keywordCase: $('#sqCase').value,
          indent: Number($('#sqInd').value),
          commaBreak: $('#sqComma').checked
        });
        $('#sqOut').textContent = out;
        var stm = (src.match(/;/g) || []).length || 1;
        st.ok(L('Formatted. Statements: ', 'Đã định dạng. Số câu lệnh: ') + stm +
          L(' — lines: ', ' — số dòng: ') + out.split('\n').length);
      } catch (e) {
        st.err(e.message);
      }
    }

    $('#sqRun').addEventListener('click', function () { run(false); });
    $('#sqMin').addEventListener('click', function () { run(true); });
    QAT.$$('#sqCase,#sqInd,#sqComma', root).forEach(function (n) {
      n.addEventListener('change', function () { if ($('#sqOut').textContent) run(false); });
    });
    $('#sqSample').addEventListener('click', function () {
      $('#sqIn').value =
        "select u.id, u.full_name, count(o.id) as order_count, sum(o.total) as revenue " +
        "from users u left join orders o on o.user_id = u.id and o.status <> 'CANCELLED' " +
        "where u.created_at >= '2026-01-01' and (u.status = 'ACTIVE' or u.status = 'TRIAL') " +
        "group by u.id, u.full_name having sum(o.total) > 1000000 order by revenue desc limit 50;";
      run(false);
    });
    $('#sqClear').addEventListener('click', function () {
      $('#sqIn').value = ''; $('#sqOut').textContent = ''; st.hide();
    });
    $('#sqCopy').addEventListener('click', function () { QAT.copy($('#sqOut').textContent); });
    $('#sqDl').addEventListener('click', function () {
      if (!$('#sqOut').textContent) { QAT.toast(QAT.t('msg.nothing'), 'err'); return; }
      QAT.download('query.sql', $('#sqOut').textContent, 'application/sql');
    });
  }
});
