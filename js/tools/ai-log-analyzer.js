QAT.register({
  id: 'ai-log-analyzer',
  group: 'ai',
  icon: '⚑',
  name: { en: 'AI Log & Error Analyzer', vi: 'AI phân tích Log & Lỗi' },
  desc: {
    en: 'Paste a stack trace, server log or failed API response and get a readable diagnosis.',
    vi: 'Dán stack trace, log server hoặc API response lỗi để nhận phân tích dễ hiểu.'
  },
  tags: ['ai', 'log', 'error', 'stack trace', 'root cause', 'triage'],
  ai: true,

  build: function (root) {
    var L = QAT.L;
    root.innerHTML = QAT.ai.notice() +
      QAT.panel({
        title: L('Log / error input', 'Log / lỗi cần phân tích'),
        body:
          '<label class="fld">' + L('Paste the log, stack trace or error response', 'Dán log, stack trace hoặc response lỗi') +
            '<textarea id="laIn" class="tall" spellcheck="false" placeholder="' +
              L('2026-08-22 14:31:02 ERROR [order-service] ...', '2026-08-22 14:31:02 ERROR [order-service] ...') +
            '"></textarea></label>' +
          '<div class="row" style="margin-top:12px">' +
            '<label class="fld" style="max-width:230px">' + L('Source', 'Nguồn') +
              '<select id="laKind">' +
                '<option value="auto">' + L('Auto detect', 'Tự nhận') + '</option>' +
                '<option value="stack">' + L('Application stack trace', 'Stack trace ứng dụng') + '</option>' +
                '<option value="server">' + L('Server / container log', 'Log server / container') + '</option>' +
                '<option value="api">' + L('Failed API response', 'API response lỗi') + '</option>' +
                '<option value="browser">' + L('Browser console', 'Console trình duyệt') + '</option>' +
                '<option value="ci">' + L('CI / automation failure', 'Lỗi CI / automation') + '</option>' +
              '</select></label>' +
            '<label class="fld grow">' + L('What were you doing? (helps a lot)', 'Bạn đang làm gì? (rất hữu ích)') +
              '<input type="text" id="laCtx" placeholder="' +
                L('Applying voucher SALE70 on order 8821 in UAT', 'Áp voucher SALE70 cho đơn 8821 trên UAT') + '"></label>' +
            '<label class="check"><input type="checkbox" id="laQA" checked> ' +
              L('Add QA next steps', 'Thêm việc QA cần làm tiếp') + '</label>' +
          '</div>' +
          '<div class="row" style="margin-top:12px">' +
            '<button class="btn sec sm" id="laSample">' + L('Load example', 'Ví dụ mẫu') + '</button>' +
            '<span class="hint" id="laMeta" style="margin-left:auto;align-self:center"></span>' +
          '</div>'
      }) +
      QAT.panel({
        title: L('Diagnosis', 'Kết quả phân tích'),
        body: QAT.ai.runBar(L('Analyze', 'Phân tích')) +
          '<div style="margin-top:12px">' + QAT.ai.outBlock() + '</div>' +
          '<p class="hint" style="margin-top:10px">' +
            L('Remove real customer data and secrets before sending a log to the AI — the request leaves your machine.',
              'Hãy xóa dữ liệu khách hàng thật và thông tin bí mật trước khi gửi log cho AI — request sẽ rời khỏi máy bạn.') +
          '</p>'
      });

    var $ = function (s) { return root.querySelector(s); };

    function meta() {
      var t = $('#laIn').value;
      if (!t) { $('#laMeta').textContent = ''; return; }
      var lines = t.split('\n').length;
      var errs = (t.match(/\b(ERROR|FATAL|SEVERE|Exception|Caused by)\b/g) || []).length;
      $('#laMeta').textContent = lines + L(' lines · ', ' dòng · ') + QAT.bytes(QAT.byteLen(t)) +
        L(' · error markers: ', ' · dấu hiệu lỗi: ') + errs;
    }
    $('#laIn').addEventListener('input', meta);

    $('#laSample').addEventListener('click', function () {
      $('#laIn').value =
        '2026-08-22 14:31:02.418 ERROR 1 --- [http-nio-8080-exec-7] c.e.order.VoucherService : Failed to apply voucher\n' +
        'java.lang.NullPointerException: Cannot invoke "com.example.order.Discount.getAmount()" because "discount" is null\n' +
        '\tat com.example.order.VoucherService.applyVoucher(VoucherService.java:214)\n' +
        '\tat com.example.order.OrderController.applyVoucher(OrderController.java:88)\n' +
        '\tat java.base/java.lang.reflect.Method.invoke(Method.java:568)\n' +
        'Caused by: com.example.order.VoucherNotFoundException: voucher SALE70 has no active discount rule for channel WEB\n' +
        '\tat com.example.order.VoucherRepository.findActiveRule(VoucherRepository.java:57)\n' +
        '2026-08-22 14:31:02.421 WARN  1 --- [http-nio-8080-exec-7] c.e.common.ApiExceptionHandler : traceId=7f3c2b91 status=500 path=/api/v1/orders/8821/apply-voucher';
      $('#laCtx').value = L('Applying voucher SALE70 to order 8821 on UAT web',
                            'Áp voucher SALE70 cho đơn 8821 trên UAT web');
      meta();
    });

    QAT.ai.wire(root, function () {
      var log = $('#laIn').value.trim();
      if (!log) throw new Error(L('Paste a log or error first.', 'Hãy dán log hoặc lỗi trước.'));
      if (QAT.byteLen(log) > 180000) {
        throw new Error(L('Log is very large — trim it to the relevant part first.',
                          'Log quá lớn — hãy cắt bớt phần liên quan trước.'));
      }

      var system =
        'You are a senior QA engineer triaging a failure before handing it to developers.\n' +
        'Answer in ' + QAT.ai.answerLang() + '.\n' +
        'Structure the answer exactly as:\n' +
        '## 1. What failed\nOne or two sentences in plain language, no jargon.\n' +
        '## 2. Key evidence\nA markdown table: Signal | Value | Why it matters. Pull real values out of the log (exception type, ' +
        'message, file:line, status code, trace id, timestamps, thread, service name).\n' +
        '## 3. Most likely cause\nRanked list, at most 3 items. For each: the hypothesis, the evidence supporting it, and how confident ' +
        'you are (high / medium / low). Say plainly when the log is not sufficient to decide.\n' +
        '## 4. Where it belongs\nWhich layer or component owns this (frontend, backend service, database, config, infra, test data, ' +
        'or the test itself), and whether this looks like a product defect or an environment/data problem.\n' +
        (($('#laQA').checked)
          ? '## 5. QA next steps\nConcrete checks the tester can run right now to narrow it down, and the exact information to attach to the bug report.\n'
          : '') +
        'Rules: never invent log content that is not there. If something important is missing (no trace id, no timestamps, truncated ' +
        'stack), say what to collect next. Redact anything that looks like a real credential or personal data in your quotes.';

      var kind = $('#laKind').value;
      var user =
        'Source type: ' + (kind === 'auto' ? 'unknown — infer it' : kind) + '\n' +
        'What the tester was doing: ' + ($('#laCtx').value.trim() || '(not given)') + '\n\n' +
        'Log / error:\n```\n' + log + '\n```';

      return { system: system, user: user };
    }, { label: L('Analyze', 'Phân tích'), filename: 'log-analysis', maxTokens: 14000 });
  }
});
