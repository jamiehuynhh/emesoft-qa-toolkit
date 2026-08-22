QAT.register({
  id: 'ai-bug-report',
  group: 'ai',
  icon: '!',
  name: { en: 'AI Bug Report Writer', vi: 'AI viết Bug Report' },
  desc: {
    en: 'Turn rough notes into a clean, reproducible bug report a developer can act on.',
    vi: 'Biến ghi chú thô thành bug report rõ ràng, có thể tái hiện để dev xử lý ngay.'
  },
  tags: ['ai', 'bug', 'defect', 'jira', 'report'],
  ai: true,

  build: function (root) {
    var L = QAT.L;
    root.innerHTML = QAT.ai.notice() +
      QAT.panel({
        title: L('What happened', 'Hiện tượng gặp phải'),
        body:
          '<label class="fld">' + L('Rough notes — write it however you like', 'Ghi chú thô — viết tự nhiên, không cần chuẩn') +
            '<textarea id="brNotes" spellcheck="false" placeholder="' +
              L('clicked save on the order screen, spinner forever, console 500, only when discount > 50%',
                'bấm lưu ở màn hình đơn hàng, quay mãi không xong, console báo 500, chỉ xảy ra khi giảm giá > 50%') +
            '"></textarea></label>' +
          '<div class="split" style="margin-top:12px">' +
            '<label class="fld">' + L('Environment', 'Môi trường') +
              '<textarea id="brEnv" class="short" spellcheck="false" placeholder="' +
                L('UAT — web, Chrome 141 / Windows 11, build 2.14.3, account qa01@example.com',
                  'UAT — web, Chrome 141 / Windows 11, build 2.14.3, tài khoản qa01@example.com') +
              '"></textarea></label>' +
            '<label class="fld">' + L('Evidence: error message, log, API response, trace id', 'Bằng chứng: thông báo lỗi, log, API response, trace id') +
              '<textarea id="brEvidence" class="short" spellcheck="false"></textarea></label>' +
          '</div>' +
          '<div class="row" style="margin-top:12px">' +
            '<label class="fld" style="max-width:180px">' + L('Severity', 'Mức độ') +
              '<select id="brSev">' +
                '<option value="auto">' + L('Let AI suggest', 'Để AI đề xuất') + '</option>' +
                '<option>Blocker</option><option>Critical</option><option>Major</option>' +
                '<option>Minor</option><option>Trivial</option>' +
              '</select></label>' +
            '<label class="fld" style="max-width:200px">' + L('Format', 'Định dạng') +
              '<select id="brFmt">' +
                '<option value="standard">' + L('Standard bug report', 'Bug report chuẩn') + '</option>' +
                '<option value="jira">' + L('Jira ticket (with fields)', 'Ticket Jira (kèm field)') + '</option>' +
                '<option value="short">' + L('Short (chat / stand-up)', 'Ngắn (chat / stand-up)') + '</option>' +
              '</select></label>' +
            '<label class="check"><input type="checkbox" id="brCause" checked> ' +
              L('Add likely-cause hypothesis for dev', 'Thêm phán đoán nguyên nhân cho dev') + '</label>' +
            '<button class="btn sec sm" id="brSample" style="margin-left:auto">' + L('Load example', 'Ví dụ mẫu') + '</button>' +
          '</div>'
      }) +
      QAT.panel({
        title: L('Bug report', 'Bug report'),
        body: QAT.ai.runBar(L('Write bug report', 'Viết bug report')) +
          '<div style="margin-top:12px">' + QAT.ai.outBlock() + '</div>' +
          '<p class="hint" style="margin-top:10px">' +
            L('Check the reproduction steps yourself before submitting — the AI only reorganises what you gave it.',
              'Hãy tự kiểm tra lại các bước tái hiện trước khi gửi — AI chỉ sắp xếp lại thông tin bạn cung cấp.') +
          '</p>'
      });

    var $ = function (s) { return root.querySelector(s); };

    $('#brSample').addEventListener('click', function () {
      $('#brNotes').value = L(
        'On the order detail screen, applying a voucher above 50% then pressing Save leaves the spinner running forever. ' +
        'Nothing is saved. Happens every time with voucher SALE70, does not happen with SALE30. ' +
        'Reloading shows the old total. Started after yesterday deploy.',
        'Ở màn hình chi tiết đơn hàng, áp voucher trên 50% rồi bấm Lưu thì spinner quay mãi không dừng. ' +
        'Không lưu được gì. Lặp lại 100% với voucher SALE70, còn SALE30 thì bình thường. ' +
        'Tải lại trang thì vẫn thấy tổng tiền cũ. Xuất hiện sau bản deploy hôm qua.');
      $('#brEnv').value = 'UAT — https://uat.example.com, Chrome 141 / Windows 11, build 2.14.3, user qa01@example.com';
      $('#brEvidence').value = 'POST /api/v1/orders/8821/apply-voucher -> 500\n' +
        '{"traceId":"7f3c2b91","error":"INTERNAL_ERROR","message":"Cannot read property amount of undefined"}\n' +
        'Console: Uncaught (in promise) TypeError: r.discount.amount is undefined at order-total.js:214';
    });

    QAT.ai.wire(root, function () {
      var notes = $('#brNotes').value.trim();
      if (!notes) throw new Error(L('Describe what happened first.', 'Hãy mô tả hiện tượng trước.'));

      var fmt = $('#brFmt').value;
      var shape = fmt === 'jira'
        ? 'Output a Jira-ready ticket: a "Summary" line (max 120 chars, format "[Module] problem — condition"), then fields ' +
          '(Issue Type, Severity, Priority, Affects Version, Environment, Component, Labels), then the sections below.'
        : fmt === 'short'
          ? 'Output a compact report of at most 12 lines suitable for a chat message: one-line summary, steps, expected vs actual, evidence, severity.'
          : 'Output a standard bug report with these sections in order: Summary, Severity & Priority, Environment, Preconditions, ' +
            'Steps to Reproduce (numbered), Expected Result, Actual Result, Evidence, Frequency / Reproducibility, Impact, Workaround.';

      var system =
        'You are a senior QA engineer writing a defect report for developers.\n' +
        'Answer in ' + QAT.ai.answerLang() + '.\n' +
        shape + '\n' +
        'Rules:\n' +
        '- Reproduction steps must be numbered, atomic and start from a known state; anyone should be able to follow them without asking you.\n' +
        '- Expected and Actual must be separate, concrete and observable.\n' +
        '- Use only facts present in the input. Anything you had to assume goes into a final "Missing information / to confirm" list — do not silently invent build numbers, accounts, or data.\n' +
        '- Keep the tone factual. No blame, no speculation presented as fact.\n' +
        ($('#brCause').checked
          ? '- End with "Possible cause (hypothesis for dev)": at most 3 bullets, each clearly marked as a hypothesis, based only on the evidence given.\n'
          : '');

      var sev = $('#brSev').value;
      var user =
        (sev === 'auto'
          ? 'Severity: decide it yourself and justify in one sentence.\n'
          : 'Severity: ' + sev + ' (use this, do not change it).\n') +
        '\nRaw notes from the tester:\n' + notes +
        '\n\nEnvironment:\n' + ($('#brEnv').value.trim() || '(not given)') +
        '\n\nEvidence (logs / API / console):\n' + ($('#brEvidence').value.trim() || '(not given)');

      return { system: system, user: user };
    }, { label: L('Write bug report', 'Viết bug report'), filename: 'bug-report', maxTokens: 12000 });
  }
});
