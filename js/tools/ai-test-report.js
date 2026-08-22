QAT.register({
  id: 'ai-test-report',
  group: 'ai',
  icon: '▤',
  name: { en: 'AI Test Report Builder', vi: 'AI tổng hợp Test Report' },
  desc: {
    en: 'Turn execution results into a summary report for the sprint review or release sign-off.',
    vi: 'Tổng hợp kết quả kiểm thử thành báo cáo cho sprint review hoặc nghiệm thu bản phát hành.'
  },
  tags: ['ai', 'report', 'summary', 'release', 'sprint'],
  ai: true,

  build: function (root) {
    var L = QAT.L;
    root.innerHTML = QAT.ai.notice() +
      QAT.panel({
        title: L('1. Scope', '1. Phạm vi'),
        body:
          '<div class="row">' +
            '<label class="fld grow">' + L('Project / release', 'Dự án / bản phát hành') +
              '<input type="text" id="trProject" placeholder="Order Management — Sprint 24 / build 2.14.3"></label>' +
            '<label class="fld" style="max-width:200px">' + L('Test cycle', 'Chu kỳ kiểm thử') +
              '<select id="trCycle">' +
                '<option>' + L('Sprint testing', 'Kiểm thử theo sprint') + '</option>' +
                '<option>' + L('Regression', 'Kiểm thử hồi quy') + '</option>' +
                '<option>UAT</option>' +
                '<option>' + L('Smoke / build verification', 'Smoke / kiểm tra bản build') + '</option>' +
                '<option>' + L('Release sign-off', 'Nghiệm thu phát hành') + '</option>' +
              '</select></label>' +
            '<label class="fld" style="max-width:200px">' + L('Period', 'Thời gian') +
              '<input type="text" id="trPeriod" placeholder="12/08/2026 - 22/08/2026"></label>' +
          '</div>' +
          '<label class="fld" style="margin-top:12px">' + L('Modules / features covered', 'Các module / tính năng đã test') +
            '<textarea id="trScope" class="short" spellcheck="false" placeholder="' +
              L('Login, Order creation, Voucher, Payment, Order history export',
                'Đăng nhập, Tạo đơn, Voucher, Thanh toán, Xuất lịch sử đơn') + '"></textarea></label>'
      }) +
      QAT.panel({
        title: L('2. Numbers', '2. Số liệu'),
        body:
          '<div class="row">' +
            num('trTotal', L('Total cases', 'Tổng test case')) +
            num('trPass', L('Passed', 'Pass')) +
            num('trFail', L('Failed', 'Fail')) +
            num('trBlocked', L('Blocked', 'Blocked')) +
            num('trSkip', L('Not run', 'Chưa chạy')) +
          '</div>' +
          '<div class="row" style="margin-top:10px">' +
            num('trBlocker', L('Open Blocker', 'Blocker còn mở')) +
            num('trCritical', L('Open Critical', 'Critical còn mở')) +
            num('trMajor', L('Open Major', 'Major còn mở')) +
            num('trMinor', L('Open Minor', 'Minor còn mở')) +
            num('trFixed', L('Fixed & verified', 'Đã fix & verify')) +
          '</div>' +
          '<div class="stats" id="trCalc" style="margin-top:12px"></div>'
      }) +
      QAT.panel({
        title: L('3. Notes', '3. Ghi chú'),
        body:
          '<div class="split">' +
            '<label class="fld">' + L('Key defects / risks', 'Lỗi quan trọng / rủi ro') +
              '<textarea id="trDefects" class="short" spellcheck="false" placeholder="' +
                L('BUG-812 voucher >50% returns 500 (open, Critical)\nBUG-799 export truncates Vietnamese names (fixed, verified)',
                  'BUG-812 voucher >50% trả về 500 (đang mở, Critical)\nBUG-799 xuất file cắt tên tiếng Việt (đã fix, đã verify)') +
              '"></textarea></label>' +
            '<label class="fld">' + L('Blockers, environment issues, out of scope', 'Vướng mắc, vấn đề môi trường, ngoài phạm vi') +
              '<textarea id="trIssues" class="short" spellcheck="false" placeholder="' +
                L('Payment gateway sandbox down 2 days; performance testing not in scope',
                  'Sandbox cổng thanh toán chết 2 ngày; chưa test hiệu năng') +
              '"></textarea></label>' +
          '</div>' +
          '<div class="row" style="margin-top:12px">' +
            '<label class="fld" style="max-width:230px">' + L('Audience', 'Người đọc') +
              '<select id="trAud">' +
                '<option value="manager">' + L('Manager / PM (concise)', 'Quản lý / PM (ngắn gọn)') + '</option>' +
                '<option value="team">' + L('Dev team (detailed)', 'Đội dev (chi tiết)') + '</option>' +
                '<option value="client">' + L('Client / stakeholder (formal)', 'Khách hàng (trang trọng)') + '</option>' +
              '</select></label>' +
            '<label class="check"><input type="checkbox" id="trRec" checked> ' +
              L('Include go / no-go recommendation', 'Kèm khuyến nghị go / no-go') + '</label>' +
            '<button class="btn sec sm" id="trSample" style="margin-left:auto">' + L('Load example', 'Ví dụ mẫu') + '</button>' +
          '</div>'
      }) +
      QAT.panel({
        title: L('Test report', 'Báo cáo kiểm thử'),
        body: QAT.ai.runBar(L('Build report', 'Tạo báo cáo')) +
          '<div style="margin-top:12px">' + QAT.ai.outBlock() + '</div>'
      });

    function num(id, label) {
      return '<label class="fld" style="max-width:150px">' + label +
        '<input type="number" id="' + id + '" min="0" placeholder="0"></label>';
    }

    var $ = function (s) { return root.querySelector(s); };
    var NUMS = ['trTotal', 'trPass', 'trFail', 'trBlocked', 'trSkip',
      'trBlocker', 'trCritical', 'trMajor', 'trMinor', 'trFixed'];

    function v(id) { return Number($('#' + id).value) || 0; }

    function calc() {
      var total = v('trTotal'), pass = v('trPass'), fail = v('trFail'),
          blocked = v('trBlocked'), skip = v('trSkip');
      var executed = pass + fail + blocked;
      var passRate = executed ? (pass / executed * 100) : 0;
      var exRate = total ? (executed / total * 100) : 0;
      var sum = pass + fail + blocked + skip;
      var mismatch = total && sum !== total;

      $('#trCalc').innerHTML =
        s(executed, L('Executed', 'Đã thực thi')) +
        s(passRate.toFixed(1) + '%', L('Pass rate', 'Tỷ lệ pass')) +
        s(exRate.toFixed(1) + '%', L('Execution rate', 'Tỷ lệ thực thi')) +
        s(v('trBlocker') + v('trCritical'), L('Blocker + Critical', 'Blocker + Critical')) +
        (mismatch ? '<div class="stat" style="border-color:var(--err)"><b style="color:var(--err);font-size:14px">' +
          L('check', 'lệch') + '</b><span>' + L('pass+fail+blocked+not run = ', 'pass+fail+blocked+chưa chạy = ') + sum +
          L(', not ', ', khác ') + total + '</span></div>' : '');

      function s(a, b) { return '<div class="stat"><b>' + a + '</b><span>' + b + '</span></div>'; }
      return { total: total, pass: pass, fail: fail, blocked: blocked, skip: skip, executed: executed, passRate: passRate };
    }

    NUMS.forEach(function (id) { $('#' + id).addEventListener('input', calc); });

    $('#trSample').addEventListener('click', function () {
      $('#trProject').value = 'Order Management — Sprint 24 / build 2.14.3';
      $('#trPeriod').value = '12/08/2026 - 22/08/2026';
      $('#trScope').value = L('Login & OTP, Order creation, Voucher, Payment, Order history export, Notification email',
                              'Đăng nhập & OTP, Tạo đơn, Voucher, Thanh toán, Xuất lịch sử đơn, Email thông báo');
      var vals = { trTotal: 186, trPass: 158, trFail: 12, trBlocked: 6, trSkip: 10,
        trBlocker: 0, trCritical: 2, trMajor: 5, trMinor: 9, trFixed: 23 };
      Object.keys(vals).forEach(function (k) { $('#' + k).value = vals[k]; });
      $('#trDefects').value = L(
        'BUG-812 voucher above 50% returns HTTP 500 on save (open, Critical, blocks the promo campaign)\n' +
        'BUG-818 OTP accepted after expiry within a 3s window (open, Critical)\n' +
        'BUG-799 CSV export truncates Vietnamese names (fixed, verified in 2.14.3)',
        'BUG-812 voucher trên 50% trả HTTP 500 khi lưu (đang mở, Critical, ảnh hưởng chiến dịch khuyến mãi)\n' +
        'BUG-818 OTP vẫn được chấp nhận sau khi hết hạn trong khoảng 3 giây (đang mở, Critical)\n' +
        'BUG-799 Xuất CSV bị cắt tên tiếng Việt (đã fix, đã verify ở 2.14.3)');
      $('#trIssues').value = L(
        'Payment sandbox unavailable 14-15/08 — 6 cases blocked\nPerformance and load testing out of scope this sprint',
        'Sandbox thanh toán không hoạt động ngày 14-15/08 — 6 case bị block\nKiểm thử hiệu năng và tải không nằm trong phạm vi sprint này');
      calc();
    });

    QAT.ai.wire(root, function () {
      var c = calc();
      if (!c.total && !$('#trScope').value.trim()) {
        throw new Error(L('Enter at least the scope and the case counts.', 'Hãy nhập ít nhất phạm vi và số liệu test case.'));
      }

      var aud = $('#trAud').value;
      var tone = aud === 'manager'
        ? 'Audience: engineering manager / PM. Lead with the decision-relevant facts, keep it under one page, no tool-level detail.'
        : aud === 'team'
          ? 'Audience: the development team. Keep defect detail, module-level breakdown and concrete follow-up owners.'
          : 'Audience: client / external stakeholder. Formal tone, no internal blame, no internal tooling names, explain impact in business terms.';

      var system =
        'You are a QA lead writing a test summary report.\n' +
        'Answer in ' + QAT.ai.answerLang() + '.\n' + tone + '\n' +
        'Sections, in order:\n' +
        '1. Executive summary — 3 to 5 sentences a manager can read alone.\n' +
        '2. Scope — what was tested and what was explicitly not tested.\n' +
        '3. Execution results — a markdown table of the counts plus pass rate and execution rate; state the numbers exactly as given, ' +
        'and if the counts are internally inconsistent, say so instead of silently fixing them.\n' +
        '4. Defect summary — table by severity (open vs fixed), then the notable defects with their impact.\n' +
        '5. Risks & blockers — what is still risky and why, including coverage gaps caused by blocked cases.\n' +
        '6. Quality assessment — is the build stable, improving or regressing, based only on the data given.\n' +
        ($('#trRec').checked ? '7. Recommendation — a clear GO / GO WITH CONDITIONS / NO-GO with the conditions listed.\n' : '') +
        'Rules: never invent numbers, defect ids, dates or module names that are not in the input. Where data is missing, write ' +
        '"not provided" rather than estimating. Do not pad with generic QA advice.';

      var user =
        'Project / release: ' + ($('#trProject').value.trim() || '(not given)') + '\n' +
        'Test cycle: ' + $('#trCycle').value + '\n' +
        'Period: ' + ($('#trPeriod').value.trim() || '(not given)') + '\n\n' +
        'Modules covered:\n' + ($('#trScope').value.trim() || '(not given)') + '\n\n' +
        'Execution counts:\n' +
        '- Total cases: ' + c.total + '\n- Passed: ' + c.pass + '\n- Failed: ' + c.fail +
        '\n- Blocked: ' + c.blocked + '\n- Not run: ' + c.skip +
        '\n- Executed: ' + c.executed + '\n- Pass rate (of executed): ' + c.passRate.toFixed(1) + '%\n\n' +
        'Open defects by severity:\n' +
        '- Blocker: ' + v('trBlocker') + '\n- Critical: ' + v('trCritical') +
        '\n- Major: ' + v('trMajor') + '\n- Minor: ' + v('trMinor') +
        '\n- Fixed and verified: ' + v('trFixed') + '\n\n' +
        'Key defects / risks:\n' + ($('#trDefects').value.trim() || '(not given)') + '\n\n' +
        'Blockers / environment / out of scope:\n' + ($('#trIssues').value.trim() || '(not given)');

      return { system: system, user: user };
    }, { label: L('Build report', 'Tạo báo cáo'), filename: 'test-report', maxTokens: 16000 });

    calc();
  }
});
