QAT.register({
  id: 'ai-testcase',
  group: 'ai',
  icon: '✓',
  name: { en: 'AI Test Case Designer', vi: 'AI thiết kế Test Case' },
  desc: {
    en: 'Turn a requirement or acceptance criteria into a reviewable test case table.',
    vi: 'Chuyển yêu cầu / AC thành bảng test case có thể review được ngay.'
  },
  tags: ['ai', 'test case', 'requirement', 'acceptance criteria', 'coverage'],
  ai: true,

  build: function (root) {
    var L = QAT.L;
    root.innerHTML = QAT.ai.notice() +
      QAT.panel({
        title: L('Requirement / Acceptance criteria', 'Yêu cầu / Tiêu chí chấp nhận'),
        body:
          '<label class="fld">' + L('Feature or user story', 'Tính năng hoặc user story') +
            '<input type="text" id="tcFeature" placeholder="' +
              L('Login with phone number and OTP', 'Đăng nhập bằng số điện thoại và OTP') + '"></label>' +
          '<label class="fld" style="margin-top:12px">' + L('Acceptance criteria, business rules, field validations', 'AC, quy tắc nghiệp vụ, ràng buộc trường dữ liệu') +
            '<textarea id="tcAC" spellcheck="false" placeholder="' +
              L('- User enters a 10-digit VN phone number\n- System sends a 6-digit OTP valid for 60 seconds\n- 5 wrong attempts lock the account for 15 minutes',
                '- Người dùng nhập SĐT 10 số\n- Hệ thống gửi OTP 6 số, hiệu lực 60 giây\n- Sai 5 lần thì khóa tài khoản 15 phút') +
            '"></textarea></label>' +
          '<div class="row" style="margin-top:12px">' +
            '<label class="fld" style="max-width:200px">' + L('Test level', 'Cấp độ test') +
              '<select id="tcLevel">' +
                '<option value="functional">' + L('Functional / UI', 'Chức năng / UI') + '</option>' +
                '<option value="api">API</option>' +
                '<option value="e2e">End-to-end</option>' +
                '<option value="regression">' + L('Regression', 'Hồi quy') + '</option>' +
              '</select></label>' +
            '<label class="fld" style="max-width:200px">' + L('Depth', 'Mức chi tiết') +
              '<select id="tcDepth">' +
                '<option value="smoke">' + L('Smoke (5-8 cases)', 'Smoke (5-8 case)') + '</option>' +
                '<option value="standard" selected>' + L('Standard (12-20 cases)', 'Chuẩn (12-20 case)') + '</option>' +
                '<option value="deep">' + L('Exhaustive (25+ cases)', 'Đầy đủ (25+ case)') + '</option>' +
              '</select></label>' +
            '<label class="fld" style="max-width:220px">' + L('ID prefix', 'Tiền tố ID') +
              '<input type="text" id="tcPrefix" value="TC"></label>' +
            '<label class="check"><input type="checkbox" id="tcNeg" checked> ' +
              L('Include negative & boundary cases', 'Gồm case âm & giá trị biên') + '</label>' +
            '<label class="check"><input type="checkbox" id="tcSec"> ' +
              L('Include security checks', 'Gồm kiểm tra bảo mật') + '</label>' +
          '</div>' +
          '<div class="row" style="margin-top:12px">' +
            '<button class="btn sec sm" id="tcSample">' + L('Load example', 'Ví dụ mẫu') + '</button>' +
          '</div>'
      }) +
      QAT.panel({
        title: L('Generated test cases', 'Test case được sinh'),
        body: QAT.ai.runBar(L('Generate test cases', 'Sinh test case')) + '<div style="margin-top:12px">' +
          QAT.ai.outBlock() + '</div>' +
          '<div class="row" style="margin-top:12px">' +
            '<button class="btn sec sm" id="tcCsv">' + L('Export table as CSV', 'Xuất bảng ra CSV') + '</button>' +
          '</div>' +
          '<p class="hint" style="margin-top:10px">' +
            L('AI output is a first draft. Review every case against the real requirement before adding it to your suite.',
              'Kết quả AI chỉ là bản nháp đầu tiên. Hãy review từng case với yêu cầu thực tế trước khi đưa vào bộ test.') +
          '</p>'
      });

    var $ = function (s) { return root.querySelector(s); };

    $('#tcSample').addEventListener('click', function () {
      $('#tcFeature').value = L('Transfer money between two internal accounts',
                                'Chuyển tiền giữa hai tài khoản nội bộ');
      $('#tcAC').value = L(
        '- Sender selects a source account and enters a destination account number (9-14 digits)\n' +
        '- Amount must be > 0 and <= available balance; max 500,000,000 VND per transaction\n' +
        '- Description is optional, max 210 characters, no special characters\n' +
        '- An OTP is required for amounts above 10,000,000 VND\n' +
        '- On success the balance updates immediately and a transaction record is created\n' +
        '- Transfers are blocked outside 05:00-23:00',
        '- Người gửi chọn tài khoản nguồn và nhập số tài khoản đích (9-14 số)\n' +
        '- Số tiền phải > 0 và <= số dư khả dụng; tối đa 500.000.000 VND mỗi giao dịch\n' +
        '- Nội dung không bắt buộc, tối đa 210 ký tự, không chứa ký tự đặc biệt\n' +
        '- Giao dịch trên 10.000.000 VND phải xác thực OTP\n' +
        '- Thành công thì số dư cập nhật ngay và tạo bản ghi giao dịch\n' +
        '- Không cho chuyển tiền ngoài khung 05:00-23:00');
    });

    var runner = QAT.ai.wire(root, function () {
      var feature = $('#tcFeature').value.trim();
      var ac = $('#tcAC').value.trim();
      if (!feature && !ac) throw new Error(L('Describe the feature or paste the acceptance criteria first.',
                                             'Hãy mô tả tính năng hoặc dán AC trước.'));

      var depth = { smoke: '5-8', standard: '12-20', deep: '25 or more' }[$('#tcDepth').value];
      var level = $('#tcLevel').value;
      var prefix = $('#tcPrefix').value.trim() || 'TC';

      var system =
        'You are a senior QA engineer writing test cases that a test lead will review and import into a test management tool.\n' +
        'Answer in ' + QAT.ai.answerLang() + '.\n' +
        'Output rules:\n' +
        '1. Start with one short paragraph: your reading of the scope, and any ambiguity in the requirement that a QA should ask about.\n' +
        '2. Then a markdown table with exactly these columns: ID | Title | Type | Priority | Preconditions | Steps | Test Data | Expected Result.\n' +
        '   - ID uses the prefix ' + prefix + '-001, ' + prefix + '-002, ...\n' +
        '   - Type is one of Positive, Negative, Boundary, Permission, Performance, Security.\n' +
        '   - Priority is High, Medium or Low.\n' +
        '   - Steps are numbered inside the cell using "1. ... 2. ..." on one line.\n' +
        '   - Expected Result must be observable and specific (exact message, status code, state change), never "works correctly".\n' +
        '3. After the table, a short "Coverage notes" list: which rules are covered, and what could not be tested from the given information.\n' +
        'Produce ' + depth + ' cases. Do not invent business rules that are not implied by the input; if something is missing, list it as an open question instead.';

      var user =
        'Test level: ' + level + '\n' +
        'Include negative and boundary cases: ' + ($('#tcNeg').checked ? 'yes' : 'no') + '\n' +
        'Include security checks (authz, injection, sensitive data exposure): ' + ($('#tcSec').checked ? 'yes' : 'no') + '\n\n' +
        'Feature / user story:\n' + (feature || '(not given)') + '\n\n' +
        'Acceptance criteria and rules:\n' + (ac || '(not given)');

      return { system: system, user: user };
    }, { label: L('Generate test cases', 'Sinh test case'), filename: 'test-cases', maxTokens: 20000 });

    // pull the first markdown table out of the answer and export it
    $('#tcCsv').addEventListener('click', function () {
      var txt = runner.text;
      if (!txt) { QAT.toast(QAT.t('msg.nothing'), 'err'); return; }
      var rows = QAT.mdTableToRows(txt);
      if (!rows.length) { QAT.toast(L('No table found in the output.', 'Không tìm thấy bảng trong kết quả.'), 'err'); return; }
      QAT.download('test-cases.csv', QAT.csv.stringify(rows), 'text/csv');
    });
  }
});
