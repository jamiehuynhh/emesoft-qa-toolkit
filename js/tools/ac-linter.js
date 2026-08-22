QAT.register({
  id: 'ac-linter',
  group: 'text',
  icon: 'AC',
  name: { en: 'Acceptance Criteria Linter', vi: 'Kiểm tra Acceptance Criteria' },
  desc: {
    en: 'Find untestable wording in AC and turn it into questions for the author — no AI, instant.',
    vi: 'Phát hiện AC không thể kiểm thử và biến thành câu hỏi gửi lại người viết — không cần AI, tức thì.'
  },
  tags: ['ac', 'acceptance criteria', 'requirement', 'review', 'ambiguity', 'ba'],

  build: function (root) {
    var L = QAT.L;
    var result = null;

    root.innerHTML =
      QAT.panel({
        title: L('Acceptance criteria', 'Acceptance criteria'),
        actions: '<label class="check"><input type="checkbox" id="acLive" checked> ' +
                 L('Check as I type', 'Kiểm tra khi đang gõ') + '</label>',
        body:
          '<textarea id="acIn" class="tall" spellcheck="false" placeholder="' +
            L('Paste the AC from the ticket...', 'Dán AC từ ticket vào đây...') + '"></textarea>' +
          '<div class="row" style="margin-top:12px">' +
            '<button class="btn" id="acRun">' + L('Check', 'Kiểm tra') + '</button>' +
            '<button class="btn sec" id="acSampleBad">' + L('Example: weak AC', 'Ví dụ: AC yếu') + '</button>' +
            '<button class="btn sec" id="acSampleGood">' + L('Example: good AC', 'Ví dụ: AC tốt') + '</button>' +
            '<button class="btn sec" id="acClear">' + L('Clear', 'Xóa') + '</button>' +
          '</div>' +
          '<p class="hint" style="margin-top:8px">' +
            L('Runs entirely in your browser. Use this before generating test cases — there is no point asking a model to infer a rule nobody wrote down.',
              'Chạy hoàn toàn trong trình duyệt. Nên dùng trước khi sinh test case — không thể bắt AI đoán một quy tắc chưa ai viết ra.') +
          '</p>'
      }) +
      '<div id="acOut"></div>';

    var $ = function (s) { return root.querySelector(s); };

    var VERDICT = {
      blocked: ['err', L('Not ready to test', 'Chưa thể kiểm thử'),
        L('There are blocking gaps. Ask the author before writing test cases.',
          'Có lỗ hổng chặn việc test. Hãy hỏi người viết trước khi viết test case.')],
      risky: ['warn', L('Testable, but you will be guessing', 'Test được, nhưng phải phỏng đoán'),
        L('Several rules are unmeasurable. Expect rework after review.',
          'Nhiều quy tắc không đo được. Khả năng cao phải làm lại sau review.')],
      minor: ['info', L('Mostly fine', 'Tạm ổn'),
        L('One or two things to confirm.', 'Còn một hai điểm cần xác nhận.')],
      ready: ['ok', L('Looks testable', 'Có thể kiểm thử'),
        L('No untestable wording found. That is not a guarantee of completeness.',
          'Không thấy diễn đạt khó kiểm thử. Điều này không đảm bảo AC đã đủ.')]
    };

    function run() {
      var text = $('#acIn').value;
      if (!text.trim()) { $('#acOut').innerHTML = ''; result = null; return; }

      result = QAT.aclint.lint(text, { lang: QAT.lang });
      var qs = QAT.aclint.questions(result);
      var v = VERDICT[result.verdict];

      var html =
        QAT.panel({
          title: L('Verdict', 'Kết luận'),
          body:
            '<div class="status ' + v[0] + '"><div><b>' + v[1] + '</b>' +
              '<div style="margin-top:4px;opacity:.9">' + v[2] + '</div></div></div>' +
            '<div class="stats" style="margin-top:12px">' +
              stat(result.counts.err || 0, L('Blocking', 'Chặn')) +
              stat(result.counts.warn || 0, L('Should fix', 'Nên sửa')) +
              stat(result.counts.info || 0, L('Worth asking', 'Nên hỏi thêm')) +
              stat(result.lines, L('AC lines', 'Dòng AC')) +
              stat(result.words, L('Words', 'Số từ')) +
            '</div>'
        });

      if (qs.length) {
        html += QAT.panel({
          title: L('Questions for the author (' + qs.length + ')', 'Câu hỏi gửi người viết (' + qs.length + ')'),
          actions:
            '<button class="btn sec sm" id="acCopyQ">' + L('Copy questions', 'Copy câu hỏi') + '</button>' +
            '<button class="btn sec sm" id="acCsvQ">' + L('Export CSV', 'Xuất CSV') + '</button>',
          body: '<div class="stack">' + qs.map(function (q) {
            return '<div class="status ' + q.level + '"><div>' +
              '<b>' + QAT.esc(q.ask) + '</b>' +
              '<div style="margin-top:5px;opacity:.85;font-size:11.5px">' +
                QAT.esc(q.about) + (q.line ? L(' — line ', ' — dòng ') + q.line : '') + '</div>' +
              (q.quote ? '<div class="mono" style="margin-top:5px;opacity:.75;font-size:11.5px">“' +
                QAT.esc(q.quote) + '”</div>' : '') +
              '</div></div>';
          }).join('') + '</div>'
        });
      }

      if (result.findings.length) {
        html += QAT.panel({
          title: L('Every match (' + result.findings.length + ')', 'Tất cả điểm phát hiện (' + result.findings.length + ')'),
          body: '<div class="tbl-wrap"><table class="tbl"><thead><tr>' +
            '<th>' + L('Line', 'Dòng') + '</th><th>' + L('Level', 'Mức') + '</th>' +
            '<th>' + L('Issue', 'Vấn đề') + '</th><th>' + L('Text', 'Nội dung') + '</th>' +
            '</tr></thead><tbody>' +
            result.findings.map(function (f) {
              return '<tr><td>' + (f.line || '—') + '</td>' +
                '<td><span class="pill ' + f.level + '">' +
                  (f.level === 'err' ? L('block', 'chặn') : f.level === 'warn' ? L('fix', 'sửa') : L('ask', 'hỏi')) +
                '</span></td>' +
                '<td>' + QAT.esc(f.label) + (f.match ? ' <span class="tag">' + QAT.esc(f.match) + '</span>' : '') + '</td>' +
                '<td class="mono">' + QAT.esc(f.text || '—') + '</td></tr>';
            }).join('') + '</tbody></table></div>'
        });
      }

      $('#acOut').innerHTML = html;

      var cq = $('#acCopyQ');
      if (cq) cq.addEventListener('click', function () {
        QAT.copy(qs.map(function (q, i) {
          return (i + 1) + '. ' + q.ask + (q.quote ? '\n   (' + q.about + ': "' + q.quote + '")' : '\n   (' + q.about + ')');
        }).join('\n'));
      });
      var cs = $('#acCsvQ');
      if (cs) cs.addEventListener('click', function () {
        var rows = [[L('level', 'muc'), L('line', 'dong'), L('issue', 'van_de'), L('question', 'cau_hoi'), L('quote', 'trich_dan')]];
        qs.forEach(function (q) { rows.push([q.level, q.line || '', q.about, q.ask, q.quote]); });
        QAT.download('ac-questions.csv', QAT.csv.stringify(rows), 'text/csv');
      });
    }

    function stat(v, l) { return '<div class="stat"><b>' + v + '</b><span>' + l + '</span></div>'; }

    $('#acRun').addEventListener('click', run);
    $('#acIn').addEventListener('input', function () { if ($('#acLive').checked) run(); });
    $('#acClear').addEventListener('click', function () { $('#acIn').value = ''; $('#acOut').innerHTML = ''; });

    $('#acSampleBad').addEventListener('click', function () {
      $('#acIn').value = L(
        'The transfer screen should load fast and be user-friendly.\n' +
        'Amount is validated properly.\n' +
        'Description max 210 characters.\n' +
        'The order is cancelled and the balance is updated.\n' +
        'Support VND, USD, etc.\n' +
        'Fee calculation: TBD',
        'Màn hình chuyển tiền phải tải nhanh và thân thiện với người dùng.\n' +
        'Số tiền được kiểm tra chính xác.\n' +
        'Nội dung tối đa 210 ký tự.\n' +
        'Đơn được huỷ và số dư được cập nhật.\n' +
        'Hỗ trợ VND, USD, v.v.\n' +
        'Cách tính phí: chưa rõ');
      run();
    });

    $('#acSampleGood').addEventListener('click', function () {
      $('#acIn').value = L(
        '- The transfer form must render within 800 ms on a 4G connection.\n' +
        '- Amount: greater than 0 and not more than the available balance; maximum 500,000,000 VND per transaction. ' +
        'If it exceeds either limit the system rejects it and shows "Amount exceeds the limit".\n' +
        '- Description: optional, up to 210 characters. Input beyond 210 is truncated and a warning is shown.\n' +
        '- The user cancels the order; the system updates the balance within 2 seconds and writes a transaction record.\n' +
        '- Transfers outside 05:00-23:00 (UTC+7) are rejected with "Outside service hours".\n' +
        '- If the OTP is wrong 5 times, the system locks the account for 15 minutes and emails the user.',
        '- Form chuyển tiền phải hiển thị trong 800 ms trên mạng 4G.\n' +
        '- Số tiền: lớn hơn 0 và không vượt số dư khả dụng; tối đa 500.000.000 VND mỗi giao dịch. ' +
        'Nếu vượt một trong hai giới hạn, hệ thống từ chối và hiển thị "Số tiền vượt giới hạn".\n' +
        '- Nội dung: không bắt buộc, tối đa 210 ký tự. Nhập quá 210 thì bị cắt và hiện cảnh báo.\n' +
        '- Người dùng huỷ đơn; hệ thống cập nhật số dư trong 2 giây và ghi một bản ghi giao dịch.\n' +
        '- Giao dịch ngoài khung 05:00-23:00 (UTC+7) bị từ chối kèm thông báo "Ngoài giờ phục vụ".\n' +
        '- Nếu sai OTP 5 lần, hệ thống khoá tài khoản 15 phút và gửi email cho người dùng.');
      run();
    });
  }
});
