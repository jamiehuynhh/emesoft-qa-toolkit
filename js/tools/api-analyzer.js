QAT.register({
  id: 'api-analyzer',
  group: 'security',
  icon: '⇋',
  name: { en: 'API Response Analyzer', vi: 'Phân tích API Response' },
  desc: {
    en: 'Send a request or paste a response, then get status, timing, headers and body checks.',
    vi: 'Gửi request hoặc dán response, rồi xem đánh giá status, thời gian, header và body.'
  },
  tags: ['api', 'http', 'rest', 'response', 'headers'],

  build: function (root) {
    var L = QAT.L;

    var STATUS = {
      200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content', 206: 'Partial Content',
      301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified', 307: 'Temporary Redirect', 308: 'Permanent Redirect',
      400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed',
      406: 'Not Acceptable', 409: 'Conflict', 410: 'Gone', 415: 'Unsupported Media Type',
      422: 'Unprocessable Entity', 429: 'Too Many Requests',
      500: 'Internal Server Error', 501: 'Not Implemented', 502: 'Bad Gateway',
      503: 'Service Unavailable', 504: 'Gateway Timeout'
    };
    var SEC_HEADERS = [
      ['strict-transport-security', 'HSTS'],
      ['x-content-type-options', 'nosniff'],
      ['x-frame-options', 'clickjacking'],
      ['content-security-policy', 'CSP'],
      ['referrer-policy', 'referrer'],
      ['cache-control', 'caching']
    ];

    root.innerHTML =
      QAT.panel({
        title: L('1. Send a live request (optional)', '1. Gửi request trực tiếp (tùy chọn)'),
        body:
          '<div class="row">' +
            '<label class="fld" style="max-width:130px">' + L('Method', 'Method') +
              '<select id="apMethod">' + ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].map(function (m) {
                return '<option>' + m + '</option>';
              }).join('') + '</select></label>' +
            '<label class="fld grow">URL<input type="text" id="apUrl" class="mono" placeholder="https://jsonplaceholder.typicode.com/todos/1"></label>' +
            '<button class="btn" id="apSend">' + L('Send', 'Gửi') + '</button>' +
          '</div>' +
          '<div class="split" style="margin-top:12px">' +
            '<label class="fld">' + L('Request headers (one per line: Name: value)', 'Header (mỗi dòng: Name: value)') +
              '<textarea id="apHeaders" class="short" spellcheck="false" placeholder="Authorization: Bearer xxx\nContent-Type: application/json"></textarea></label>' +
            '<label class="fld">' + L('Request body', 'Body của request') +
              '<textarea id="apBody" class="short" spellcheck="false" placeholder=\'{"name":"test"}\'></textarea></label>' +
          '</div>' +
          '<div class="row" style="margin-top:12px">' +
            '<label class="fld grow">' + L('Paste a cURL command (from a dev, or DevTools → Copy as cURL)',
                                           'Dán lệnh cURL (dev gửi, hoặc DevTools → Copy as cURL)') +
              '<textarea id="apCurl" class="short" spellcheck="false" placeholder="curl -X POST \'https://api.example.com/orders\' -H \'Content-Type: application/json\' --data-raw \'{&quot;id&quot;:1}\'"></textarea></label>' +
          '</div>' +
          '<div class="row" style="margin-top:8px">' +
            '<button class="btn sec" id="apCurlIn">' + L('← Fill from cURL', '← Điền từ cURL') + '</button>' +
            '<button class="btn sec" id="apCurlOut">' + L('Export as cURL →', 'Xuất thành cURL →') + '</button>' +
            '<span class="hint" style="align-self:center">' +
              L('Handy for attaching a reproducible request to a bug report.',
                'Hữu ích khi cần gắn một request tái hiện được vào bug report.') + '</span>' +
          '</div>' +
          '<p class="hint" style="margin-top:8px">' +
            L('The browser applies CORS: a server that does not allow this origin will fail with "Failed to fetch" even though the API itself is fine. Use paste mode below in that case.',
              'Trình duyệt áp dụng CORS: nếu server không cho phép origin này thì sẽ báo "Failed to fetch" dù API vẫn hoạt động. Khi đó hãy dùng chế độ dán bên dưới.') +
          '</p>'
      }) +
      QAT.panel({
        title: L('2. Or paste a response', '2. Hoặc dán response có sẵn'),
        body:
          '<div class="row">' +
            '<label class="fld" style="max-width:150px">' + L('Status code', 'Status code') +
              '<input type="number" id="apStatus" placeholder="200"></label>' +
            '<label class="fld" style="max-width:180px">' + L('Response time (ms)', 'Thời gian (ms)') +
              '<input type="number" id="apMs" placeholder="240"></label>' +
            '<button class="btn sec" id="apAnalyze">' + L('Analyze', 'Phân tích') + '</button>' +
            '<button class="btn sec" id="apSample">' + L('Sample', 'Mẫu') + '</button>' +
            '<button class="btn sec" id="apClear">' + L('Clear', 'Xóa') + '</button>' +
          '</div>' +
          '<div class="split" style="margin-top:12px">' +
            '<label class="fld">' + L('Response headers', 'Response headers') +
              '<textarea id="apResHeaders" class="short" spellcheck="false" placeholder="Content-Type: application/json\nCache-Control: no-store"></textarea></label>' +
            '<label class="fld">' + L('Response body', 'Response body') +
              '<textarea id="apResBody" class="short" spellcheck="false"></textarea></label>' +
          '</div>' +
          '<div class="status hidden" id="apStatusMsg" style="margin-top:12px"></div>'
      }) +
      QAT.panel({
        title: L('Analysis', 'Kết quả phân tích'),
        actions: '<button class="btn sec sm" id="apCopy">' + L('Copy report', 'Copy báo cáo') + '</button>',
        body:
          '<div class="stats" id="apStats"></div>' +
          '<div id="apChecks" style="margin-top:14px"></div>' +
          '<div id="apBodyOut" style="margin-top:14px"></div>'
      });

    var $ = function (s) { return root.querySelector(s); };
    var st = QAT.status($('#apStatusMsg'));
    var report = '';

    function parseHeaderText(txt) {
      var o = {};
      String(txt).split(/\r?\n/).forEach(function (l) {
        var i = l.indexOf(':');
        if (i > 0) o[l.slice(0, i).trim().toLowerCase()] = l.slice(i + 1).trim();
      });
      return o;
    }

    function send() {
      var url = $('#apUrl').value.trim();
      if (!url) { st.warn(L('Enter a URL.', 'Hãy nhập URL.')); return; }
      var method = $('#apMethod').value;
      var headers = parseHeaderText($('#apHeaders').value);
      var body = $('#apBody').value;

      st.info(L('Sending ', 'Đang gửi ') + method + ' ' + url + ' ...');
      var t0 = performance.now();

      fetch(url, {
        method: method,
        headers: headers,
        body: (method === 'GET' || method === 'HEAD') ? undefined : (body || undefined)
      }).then(function (res) {
        var ms = Math.round(performance.now() - t0);
        return res.text().then(function (txt) {
          var hdr = [];
          res.headers.forEach(function (v, k) { hdr.push(k + ': ' + v); });
          $('#apStatus').value = res.status;
          $('#apMs').value = ms;
          $('#apResHeaders').value = hdr.join('\n');
          $('#apResBody').value = txt;
          st.ok(L('Response received in ', 'Nhận response sau ') + ms + 'ms.');
          analyze();
        });
      }).catch(function (e) {
        st.err(L('Request failed: ', 'Gửi thất bại: ') + e.message +
          L('  (usually CORS or an unreachable host)', '  (thường do CORS hoặc không tới được host)'));
      });
    }

    function analyze() {
      var code = Number($('#apStatus').value) || 0;
      var ms = Number($('#apMs').value) || 0;
      var hdr = parseHeaderText($('#apResHeaders').value);
      var bodyTxt = $('#apResBody').value;

      if (!code && !bodyTxt) { st.warn(L('Nothing to analyze.', 'Chưa có dữ liệu để phân tích.')); return; }

      var cls = code >= 500 ? 'err' : code >= 400 ? 'warn' : code >= 300 ? 'info' : code >= 200 ? 'ok' : 'mut';
      var speed = ms === 0 ? 'mut' : ms < 300 ? 'ok' : ms < 1000 ? 'info' : ms < 3000 ? 'warn' : 'err';
      var size = QAT.byteLen(bodyTxt);

      $('#apStats').innerHTML =
        '<div class="stat"><b><span class="pill ' + cls + '">' + (code || '—') + '</span></b><span>' +
          QAT.esc(STATUS[code] || L('Status', 'Trạng thái')) + '</span></div>' +
        '<div class="stat"><b><span class="pill ' + speed + '">' + (ms ? ms + ' ms' : '—') + '</span></b><span>' +
          L('Response time', 'Thời gian') + '</span></div>' +
        '<div class="stat"><b>' + QAT.bytes(size) + '</b><span>' + L('Body size', 'Kích thước body') + '</span></div>' +
        '<div class="stat"><b>' + Object.keys(hdr).length + '</b><span>' + L('Headers', 'Header') + '</span></div>';

      var checks = [], lines = [];

      // status
      if (code >= 200 && code < 300) checks.push(['ok', L('Status is a success code.', 'Status thuộc nhóm thành công.')]);
      else if (code >= 400 && code < 500) checks.push(['warn', L('Client error — check request payload, auth and permissions.', 'Lỗi phía client — kiểm tra payload, xác thực và quyền.')]);
      else if (code >= 500) checks.push(['err', L('Server error — capture the trace id and log for the bug report.', 'Lỗi phía server — lấy trace id và log để đưa vào bug report.')]);
      else if (code >= 300) checks.push(['info', L('Redirect — confirm the client follows it correctly.', 'Redirect — kiểm tra client có đi theo đúng không.')]);

      if (code === 200 && /^\s*$/.test(bodyTxt)) checks.push(['warn', L('200 with an empty body — should this be 204?', '200 nhưng body rỗng — có nên trả 204?')]);
      if (code === 204 && bodyTxt.trim()) checks.push(['err', L('204 must not carry a body.', '204 không được có body.')]);

      // timing
      if (ms) {
        if (ms < 300) checks.push(['ok', L('Fast response (<300ms).', 'Phản hồi nhanh (<300ms).')]);
        else if (ms < 1000) checks.push(['info', L('Acceptable response time.', 'Thời gian phản hồi chấp nhận được.')]);
        else if (ms < 3000) checks.push(['warn', L('Slow (>1s) — worth raising as a performance observation.', 'Chậm (>1s) — nên ghi nhận là vấn đề hiệu năng.')]);
        else checks.push(['err', L('Very slow (>3s) — likely a defect.', 'Rất chậm (>3s) — có thể là lỗi.')]);
      }

      // headers
      var ct = hdr['content-type'] || '';
      if (!ct) checks.push(['warn', L('No Content-Type header.', 'Thiếu header Content-Type.')]);
      else checks.push(['info', 'Content-Type: ' + ct]);

      SEC_HEADERS.forEach(function (h) {
        if (!hdr[h[0]]) checks.push(['warn', L('Missing header: ', 'Thiếu header: ') + h[0] + ' (' + h[1] + ')']);
      });
      if (hdr['x-powered-by'] || hdr['server']) {
        checks.push(['warn', L('Server implementation leaked via ', 'Rò rỉ thông tin server qua ') +
          (hdr['x-powered-by'] ? 'X-Powered-By' : 'Server') + ': ' + (hdr['x-powered-by'] || hdr['server'])]);
      }
      if (hdr['access-control-allow-origin'] === '*') {
        checks.push(['warn', L('Access-Control-Allow-Origin is * — verify this is intended.', 'Access-Control-Allow-Origin là * — cần xác nhận đúng chủ ý.')]);
      }

      // body
      var bodyHtml = '';
      if (bodyTxt.trim()) {
        var parsed = null;
        try { parsed = JSON.parse(bodyTxt); } catch (e) { parsed = undefined; }
        if (parsed === undefined) {
          if (/json/i.test(ct)) checks.push(['err', L('Content-Type says JSON but the body does not parse as JSON.', 'Content-Type là JSON nhưng body không parse được.')]);
          else checks.push(['info', L('Body is not JSON — treated as text.', 'Body không phải JSON — xử lý như text.')]);
          bodyHtml = '<div class="out">' + QAT.esc(bodyTxt.slice(0, 20000)) + '</div>';
        } else {
          checks.push(['ok', L('Body is valid JSON.', 'Body là JSON hợp lệ.')]);
          bodyHtml = '<div class="out tall">' + QAT.jsonHighlight(JSON.stringify(parsed, null, 2)) + '</div>';

          var flat = [];
          (function walk(v, path) {
            if (Array.isArray(v)) {
              if (!v.length) flat.push(['warn', L('Empty array at ', 'Mảng rỗng tại ') + (path || '$')]);
              v.slice(0, 50).forEach(function (x, i) { walk(x, path + '[' + i + ']'); });
            } else if (v && typeof v === 'object') {
              Object.keys(v).forEach(function (k) { walk(v[k], path ? path + '.' + k : k); });
            } else if (v === null) {
              flat.push(['info', L('null value at ', 'Giá trị null tại ') + path]);
            } else if (v === '') {
              flat.push(['info', L('empty string at ', 'Chuỗi rỗng tại ') + path]);
            }
          })(parsed, '');
          flat.slice(0, 12).forEach(function (f) { checks.push(f); });
          if (flat.length > 12) checks.push(['info', L('... and ', '... và ') + (flat.length - 12) + L(' more empty/null fields.', ' trường rỗng/null khác.')]);

          var errKeys = ['error', 'errors', 'message', 'errorCode', 'error_code', 'detail', 'traceId', 'trace_id'];
          errKeys.forEach(function (k) {
            if (parsed && typeof parsed === 'object' && parsed[k] !== undefined) {
              checks.push([code >= 400 ? 'err' : 'info', k + ': ' + JSON.stringify(parsed[k]).slice(0, 200)]);
            }
          });
        }
      } else {
        checks.push(['info', L('Empty body.', 'Body rỗng.')]);
      }

      $('#apChecks').innerHTML = '<div class="stack">' + checks.map(function (c) {
        lines.push('[' + c[0].toUpperCase() + '] ' + c[1]);
        return '<div class="status ' + c[0] + '">' + QAT.esc(c[1]) + '</div>';
      }).join('') + '</div>';
      $('#apBodyOut').innerHTML = bodyHtml;

      report = 'API Response Analysis\n' +
        'Status: ' + code + ' ' + (STATUS[code] || '') + '\n' +
        'Time: ' + ms + ' ms\nBody size: ' + QAT.bytes(size) + '\n' +
        'Headers: ' + Object.keys(hdr).length + '\n\nFindings:\n' + lines.join('\n');

      var errs = checks.filter(function (c) { return c[0] === 'err'; }).length;
      var warns = checks.filter(function (c) { return c[0] === 'warn'; }).length;
      if (errs) st.err(errs + L(' problem(s) and ', ' vấn đề nghiêm trọng và ') + warns + L(' warning(s) found.', ' cảnh báo.'));
      else if (warns) st.warn(warns + L(' warning(s) found.', ' cảnh báo.'));
      else st.ok(L('No problems detected.', 'Không phát hiện vấn đề.'));
    }

    $('#apCurlIn').addEventListener('click', function () {
      var txt = $('#apCurl').value.trim();
      if (!txt) { st.warn(L('Paste a cURL command first.', 'Hãy dán lệnh cURL trước.')); return; }
      try {
        var r = QAT.curl.parse(txt);
        $('#apMethod').value = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].indexOf(r.method) !== -1 ? r.method : 'GET';
        $('#apUrl').value = r.url;
        $('#apHeaders').value = Object.keys(r.headers).map(function (k) { return k + ': ' + r.headers[k]; }).join('\n');
        $('#apBody').value = r.body || '';
        st.ok(L('Filled from cURL: ', 'Đã điền từ cURL: ') + r.method + ' ' + r.url +
              L(', ', ', ') + Object.keys(r.headers).length + L(' header(s).', ' header.'));
      } catch (e) {
        st.err(L('Could not parse that cURL: ', 'Không đọc được lệnh cURL: ') + e.message);
      }
    });

    $('#apCurlOut').addEventListener('click', function () {
      var url = $('#apUrl').value.trim();
      if (!url) { st.warn(L('Enter a URL first.', 'Hãy nhập URL trước.')); return; }
      var cmd = QAT.curl.build({
        method: $('#apMethod').value,
        url: url,
        headers: parseHeaderText($('#apHeaders').value),
        body: $('#apBody').value
      });
      $('#apCurl').value = cmd;
      QAT.copy(cmd);
    });

    $('#apSend').addEventListener('click', send);
    $('#apAnalyze').addEventListener('click', analyze);
    $('#apCopy').addEventListener('click', function () { QAT.copy(report); });
    $('#apClear').addEventListener('click', function () {
      ['#apUrl', '#apHeaders', '#apBody', '#apStatus', '#apMs', '#apResHeaders', '#apResBody'].forEach(function (s) { $(s).value = ''; });
      $('#apStats').innerHTML = ''; $('#apChecks').innerHTML = ''; $('#apBodyOut').innerHTML = ''; st.hide();
    });
    $('#apSample').addEventListener('click', function () {
      $('#apStatus').value = 500;
      $('#apMs').value = 2450;
      $('#apResHeaders').value = 'Content-Type: application/json; charset=utf-8\nServer: nginx/1.24.0\nX-Powered-By: Express\nAccess-Control-Allow-Origin: *\nDate: Sat, 22 Aug 2026 07:15:00 GMT';
      $('#apResBody').value = JSON.stringify({
        traceId: '7f3c2b91',
        error: 'INTERNAL_ERROR',
        message: 'Cannot read property amount of undefined',
        data: null,
        items: [],
        meta: { page: 1, total: null }
      }, null, 2);
      analyze();
    });
  }
});
