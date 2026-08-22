QAT.register({
  id: 'har-analyzer',
  group: 'security',
  icon: '⏱',
  name: { en: 'HAR / Network Analyzer', vi: 'Phân tích HAR / Network' },
  desc: {
    en: 'Drop a .har from DevTools and see what failed, what was slow, and what leaked.',
    vi: 'Kéo file .har từ DevTools vào để biết cái gì lỗi, cái gì chậm, cái gì rò rỉ.'
  },
  tags: ['har', 'network', 'performance', 'devtools', 'waterfall', 'slow'],

  build: function (root) {
    var L = QAT.L;
    var parsed = null, sum = null, finds = null, filter = 'all';

    root.innerHTML =
      QAT.panel({
        title: L('1. Load a HAR file', '1. Nạp file HAR'),
        body:
          '<div id="harDrop" style="border:2px dashed var(--border-strong);border-radius:var(--r);' +
            'padding:26px;text-align:center;cursor:pointer;background:var(--surface-2)">' +
            '<div style="font-size:26px;line-height:1">⤓</div>' +
            '<p style="margin-top:8px;font-weight:600">' +
              L('Drop a .har file here, or click to choose', 'Kéo file .har vào đây, hoặc bấm để chọn') + '</p>' +
            '<p class="hint" style="margin-top:6px">' +
              L('In Chrome/Edge DevTools: Network tab → right-click → "Save all as HAR with content"',
                'Trong DevTools Chrome/Edge: tab Network → chuột phải → "Save all as HAR with content"') + '</p>' +
          '</div>' +
          '<input type="file" id="harFile" accept=".har,.json,application/json" hidden>' +
          '<div class="row" style="margin-top:12px">' +
            '<label class="fld" style="max-width:200px">' + L('Slow threshold (ms)', 'Ngưỡng chậm (ms)') +
              '<input type="number" id="harSlow" value="1000" min="100" step="100"></label>' +
            '<button class="btn sec" id="harSample" style="align-self:flex-end">' +
              L('Load a sample', 'Dùng dữ liệu mẫu') + '</button>' +
            '<button class="btn sec" id="harClear" style="align-self:flex-end">' + L('Clear', 'Xóa') + '</button>' +
          '</div>' +
          '<div class="status hidden" id="harStatus" style="margin-top:12px"></div>' +
          '<p class="hint" style="margin-top:8px">' +
            L('A HAR often contains cookies, tokens and request bodies. Everything here is parsed in your browser and never uploaded.',
              'File HAR thường chứa cookie, token và body request. Toàn bộ được xử lý trong trình duyệt và không gửi đi đâu.') +
          '</p>'
      }) +
      '<div id="harResult"></div>';

    var $ = function (s) { return root.querySelector(s); };
    var st = QAT.status($('#harStatus'));

    /* ------------------------------------------------------------ loading */
    function load(text, name) {
      try {
        parsed = QAT.har.parse(text);
      } catch (e) {
        parsed = null;
        $('#harResult').innerHTML = '';
        st.err(e.message);
        return;
      }
      if (!parsed.entries.length) { st.warn(L('The HAR has no requests.', 'File HAR không có request nào.')); return; }
      st.ok((name ? name + ' — ' : '') + parsed.entries.length +
        L(' requests, exported by ', ' request, xuất từ ') + parsed.creator);
      render();
    }

    function readFile(file) {
      if (!file) return;
      if (file.size > 60 * 1024 * 1024) {
        st.err(L('File is over 60 MB. Trim the session in DevTools first.',
                 'File lớn hơn 60 MB. Hãy thu gọn phiên ghi trong DevTools trước.'));
        return;
      }
      st.info(L('Reading ', 'Đang đọc ') + file.name + ' (' + QAT.bytes(file.size) + ')...');
      var fr = new FileReader();
      fr.onload = function () { load(String(fr.result), file.name); };
      fr.onerror = function () { st.err(L('Could not read the file.', 'Không đọc được file.')); };
      fr.readAsText(file);
    }

    var drop = $('#harDrop');
    drop.addEventListener('click', function () { $('#harFile').click(); });
    $('#harFile').addEventListener('change', function () { readFile(this.files && this.files[0]); });
    ['dragenter', 'dragover'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) {
        e.preventDefault();
        drop.style.borderColor = 'var(--brand)';
      });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) {
        e.preventDefault();
        drop.style.borderColor = 'var(--border-strong)';
      });
    });
    drop.addEventListener('drop', function (e) {
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      readFile(f);
    });

    $('#harSlow').addEventListener('change', function () { if (parsed) render(); });
    $('#harClear').addEventListener('click', function () {
      parsed = null; $('#harResult').innerHTML = ''; st.hide(); $('#harFile').value = '';
    });

    /* ------------------------------------------------------------ sample */
    $('#harSample').addEventListener('click', function () {
      var t0 = Date.now();
      function entry(method, url, status, ms, size, extra) {
        return Object.assign({
          startedDateTime: new Date(t0 += 40).toISOString(),
          time: ms,
          request: { method: method, url: url, headers: [], queryString: [], bodySize: 0 },
          response: {
            status: status, statusText: '',
            headers: [{ name: 'Content-Type', value: /\.js$/.test(url) ? 'application/javascript' : (/\/api\//.test(url) ? 'application/json' : 'text/html; charset=utf-8') }],
            content: { size: size, mimeType: '' }, cookies: [], bodySize: size
          },
          timings: { wait: Math.round(ms * 0.8), receive: Math.round(ms * 0.2), blocked: 0 }
        }, extra || {});
      }
      var e = [
        entry('GET', 'https://shop.example.com/orders', 200, 420, 24000),
        entry('GET', 'https://shop.example.com/static/app.js', 200, 180, 780000),
        entry('POST', 'https://shop.example.com/api/v1/orders/8821/apply-voucher', 500, 2450, 320),
        entry('GET', 'https://shop.example.com/api/v1/me?access_token=abc123secret', 200, 90, 400,
          { request: { method: 'GET', url: 'https://shop.example.com/api/v1/me?access_token=abc123secret', headers: [], queryString: [{ name: 'access_token', value: 'abc123secret' }], bodySize: 0 } }),
        entry('GET', 'https://shop.example.com/api/v1/report', 200, 4200, 1200),
        entry('GET', 'http://cdn.example.com/img/logo.png', 200, 60, 9000),
        entry('GET', 'https://shop.example.com/api/v1/orders/missing', 404, 70, 120)
      ];
      // an N+1: the same lookup repeated per row
      for (var i = 0; i < 8; i++) e.push(entry('GET', 'https://shop.example.com/api/v1/products/lookup', 200, 55, 300));
      load(JSON.stringify({ log: { version: '1.2', creator: { name: 'sample' }, pages: [], entries: e } }), 'sample.har');
    });

    /* ------------------------------------------------------------ render */
    function render() {
      var slowMs = Number($('#harSlow').value) || 1000;
      sum = QAT.har.summarize(parsed.entries);
      finds = QAT.har.findings(parsed.entries, { slowMs: slowMs });

      var maxTime = Math.max.apply(null, parsed.entries.map(function (e) { return e.time; }).concat([1]));

      var html =
        QAT.panel({
          title: L('2. Session summary', '2. Tổng quan phiên'),
          actions: '<button class="btn sec sm" id="harCopy">' + L('Copy report', 'Copy báo cáo') + '</button>' +
                   '<button class="btn sec sm" id="harCsv">' + L('Export CSV', 'Xuất CSV') + '</button>',
          body:
            '<div class="stats">' +
              stat(sum.count, L('Requests', 'Request')) +
              stat(sum.wallClock + ' ms', L('Wall clock', 'Thời gian thực')) +
              stat(QAT.bytes(sum.totalSize), L('Transferred', 'Dung lượng')) +
              stat(sum.median + ' ms', L('Median', 'Trung vị')) +
              stat(sum.p95 + ' ms', 'p95') +
            '</div>' +
            '<div class="row tight" style="margin-top:12px">' +
              pill('ok', sum.byClass['2xx'] + ' × 2xx') +
              pill('info', sum.byClass['3xx'] + ' × 3xx') +
              pill('warn', sum.byClass['4xx'] + ' × 4xx') +
              pill('err', sum.byClass['5xx'] + ' × 5xx') +
              (sum.byClass.other ? pill('mut', sum.byClass.other + ' × ' + L('no status', 'không status')) : '') +
              '<span style="flex:1"></span>' +
              '<span class="hint" style="align-self:center">' + sum.origins.length +
                L(' origin(s)', ' origin') + '</span>' +
            '</div>'
        }) +
        QAT.panel({
          title: L('3. Findings', '3. Phát hiện'),
          body: '<div class="stack">' + finds.map(function (f) {
            return '<div class="status ' + f.level + '">' +
              '<div><b>' + QAT.esc(f.title) + '</b>' +
              (f.detail ? '<div style="margin-top:5px;white-space:pre-wrap;opacity:.9">' + QAT.esc(f.detail) + '</div>' : '') +
              '</div></div>';
          }).join('') + '</div>'
        }) +
        QAT.panel({
          title: L('4. All requests', '4. Toàn bộ request'),
          actions:
            ['all', 'slow', 'failed'].map(function (f) {
              return '<button class="chip' + (filter === f ? ' active' : '') + '" data-hf="' + f + '">' +
                (f === 'all' ? L('All', 'Tất cả') : f === 'slow' ? L('Slow', 'Chậm') : L('Failed', 'Lỗi')) + '</button>';
            }).join(''),
          body: '<div id="harTable"></div>'
        });

      $('#harResult').innerHTML = html;
      table(slowMs, maxTime);

      $('#harCopy').addEventListener('click', function () {
        QAT.copy(QAT.har.report(parsed, { slowMs: slowMs }));
      });
      $('#harCsv').addEventListener('click', function () {
        var rows = [['#', 'method', 'status', 'time_ms', 'ttfb_ms', 'size_bytes', 'type', 'url']];
        parsed.entries.forEach(function (e) {
          rows.push([e.index + 1, e.method, e.status, Math.round(e.time), Math.round(e.wait), e.size, e.mime, e.url]);
        });
        QAT.download('har-requests.csv', QAT.csv.stringify(rows), 'text/csv');
      });
      QAT.$$('[data-hf]', root).forEach(function (b) {
        b.addEventListener('click', function () {
          filter = this.getAttribute('data-hf');
          render();
        });
      });
    }

    function table(slowMs, maxTime) {
      var list = parsed.entries;
      if (filter === 'slow') list = list.filter(function (e) { return e.time >= slowMs; });
      if (filter === 'failed') list = list.filter(function (e) { return e.status >= 400 || e.status === 0; });

      if (!list.length) {
        $('#harTable').innerHTML = '<p class="hint">' + L('Nothing matches this filter.', 'Không có request nào khớp bộ lọc.') + '</p>';
        return;
      }

      var shown = list.slice(0, 400);
      $('#harTable').innerHTML =
        '<div class="tbl-wrap"><table class="tbl"><thead><tr>' +
        '<th>#</th><th>' + L('Method', 'Method') + '</th><th>' + L('Status', 'Status') + '</th>' +
        '<th>' + L('Time', 'Thời gian') + '</th><th>' + L('Size', 'Dung lượng') + '</th>' +
        '<th>' + L('Path', 'Đường dẫn') + '</th></tr></thead><tbody>' +
        shown.map(function (e) {
          var cls = e.status >= 500 ? 'err' : e.status >= 400 ? 'warn' : e.status === 0 ? 'mut' : e.status >= 300 ? 'info' : 'ok';
          var pctW = Math.max(2, Math.round(e.time / maxTime * 100));
          var bar = '<div style="background:var(--border);border-radius:3px;height:6px;margin-top:4px">' +
            '<div style="width:' + pctW + '%;height:6px;border-radius:3px;background:' +
            (e.time >= 3000 ? 'var(--err)' : e.time >= slowMs ? 'var(--warn)' : 'var(--ok)') + '"></div></div>';
          return '<tr><td>' + (e.index + 1) + '</td>' +
            '<td class="mono">' + QAT.esc(e.method) + '</td>' +
            '<td><span class="pill ' + cls + '">' + (e.status || '—') + '</span></td>' +
            '<td class="mono">' + Math.round(e.time) + ' ms' + bar + '</td>' +
            '<td class="mono">' + (e.size ? QAT.bytes(e.size) : '—') + '</td>' +
            '<td class="mono" title="' + QAT.esc(e.url) + '">' + QAT.esc(e.path) + '</td></tr>';
        }).join('') +
        '</tbody></table></div>' +
        (list.length > 400 ? '<p class="hint" style="margin-top:6px">' +
          L('Showing first 400 of ', 'Hiển thị 400 / ') + list.length + '</p>' : '');
    }

    function stat(v, l) { return '<div class="stat"><b>' + v + '</b><span>' + l + '</span></div>'; }
    function pill(c, t) { return '<span class="pill ' + c + '">' + t + '</span>'; }
  }
});
