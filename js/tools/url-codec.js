QAT.register({
  id: 'url-codec',
  group: 'data',
  icon: '%',
  name: { en: 'URL Encoder / Decoder', vi: 'Mã hóa / Giải mã URL' },
  desc: {
    en: 'Percent-encode or decode URLs and inspect every query parameter separately.',
    vi: 'Mã hóa / giải mã URL và xem chi tiết từng tham số query.'
  },
  tags: ['url', 'encode', 'decode', 'query', 'params'],

  build: function (root) {
    var L = QAT.L;
    root.innerHTML = QAT.panel({
      title: L('Input', 'Dữ liệu vào'),
      actions:
        '<label class="check"><input type="checkbox" id="ucComp" checked> ' +
          L('encodeURIComponent (strict)', 'encodeURIComponent (chặt)') + '</label>',
      body:
        '<label class="fld">' + L('Text or URL', 'Văn bản hoặc URL') +
          '<textarea id="ucIn" class="short" spellcheck="false" placeholder="https://api.example.com/search?q=đơn hàng&page=2"></textarea></label>' +
        '<div class="row" style="margin-top:12px">' +
          '<button class="btn" id="ucE">' + L('Encode', 'Mã hóa') + '</button>' +
          '<button class="btn" id="ucD">' + L('Decode', 'Giải mã') + '</button>' +
          '<button class="btn sec" id="ucParse">' + L('Parse URL', 'Phân tích URL') + '</button>' +
          '<button class="btn sec" id="ucSample">' + L('Sample', 'Mẫu') + '</button>' +
          '<button class="btn sec" id="ucClear">' + L('Clear', 'Xóa') + '</button>' +
        '</div>' +
        '<div class="status hidden" id="ucStatus" style="margin-top:12px"></div>'
    }) + QAT.panel({
      title: L('Output', 'Kết quả'),
      actions: '<button class="btn sec sm" id="ucCopy">' + L('Copy', 'Copy') + '</button>',
      body: '<div class="out" id="ucOut" data-empty="' + L('Result appears here.', 'Kết quả hiện ở đây.') + '"></div>'
    }) + QAT.panel({
      title: L('URL breakdown', 'Chi tiết URL'),
      body: '<div id="ucParts"><p class="hint">' + L('Use "Parse URL" to split a full URL into parts and parameters.',
        'Dùng "Phân tích URL" để tách URL thành từng phần và tham số.') + '</p></div>'
    });

    var $ = function (s) { return root.querySelector(s); };
    var st = QAT.status($('#ucStatus'));

    function encode() {
      var s = $('#ucIn').value;
      if (!s) return;
      try {
        $('#ucOut').textContent = $('#ucComp').checked ? encodeURIComponent(s) : encodeURI(s);
        st.ok(L('Encoded.', 'Đã mã hóa.'));
      } catch (e) { st.err(e.message); }
    }
    function decode() {
      var s = $('#ucIn').value;
      if (!s) return;
      try {
        $('#ucOut').textContent = decodeURIComponent(s.replace(/\+/g, ' '));
        st.ok(L('Decoded (+ treated as space).', 'Đã giải mã (dấu + hiểu là khoảng trắng).'));
      } catch (e) {
        st.err(L('Malformed percent-encoding: ', 'Chuỗi phần trăm không hợp lệ: ') + e.message);
      }
    }
    function parse() {
      var raw = $('#ucIn').value.trim();
      if (!raw) return;
      var u;
      try { u = new URL(raw); }
      catch (e) {
        try { u = new URL('https://' + raw); }
        catch (e2) { st.err(L('Not a valid URL.', 'Không phải URL hợp lệ.')); return; }
      }
      var rows =
        kv(L('Protocol', 'Protocol'), u.protocol) +
        kv(L('Host', 'Host'), u.host) +
        kv(L('Hostname', 'Hostname'), u.hostname) +
        kv(L('Port', 'Port'), u.port || '(default)') +
        kv(L('Path', 'Đường dẫn'), u.pathname) +
        kv(L('Hash', 'Hash'), u.hash || '—');

      var params = [];
      u.searchParams.forEach(function (v, k) { params.push([k, v]); });
      var tbl = params.length
        ? '<div class="tbl-wrap" style="margin-top:12px"><table class="tbl"><thead><tr><th>#</th><th>' +
          L('Parameter', 'Tham số') + '</th><th>' + L('Raw value', 'Giá trị thô') + '</th><th>' +
          L('Decoded', 'Đã giải mã') + '</th></tr></thead><tbody>' +
          params.map(function (p, i) {
            return '<tr><td>' + (i + 1) + '</td><td class="mono">' + QAT.esc(p[0]) +
              '</td><td class="mono">' + QAT.esc(encodeURIComponent(p[1])) +
              '</td><td class="mono">' + QAT.esc(p[1]) + '</td></tr>';
          }).join('') + '</tbody></table></div>'
        : '<p class="hint" style="margin-top:10px">' + L('No query parameters.', 'Không có tham số query.') + '</p>';

      $('#ucParts').innerHTML = '<div class="kv">' + rows + '</div>' + tbl;
      $('#ucOut').textContent = u.href;
      st.ok(L('Parsed — ', 'Đã phân tích — ') + params.length + L(' parameter(s).', ' tham số.'));
    }
    function kv(k, v) { return '<div class="k">' + k + '</div><div class="v">' + QAT.esc(v) + '</div>'; }

    $('#ucE').addEventListener('click', encode);
    $('#ucD').addEventListener('click', decode);
    $('#ucParse').addEventListener('click', parse);
    $('#ucSample').addEventListener('click', function () {
      $('#ucIn').value = 'https://api.example.com/v1/orders?keyword=đơn%20hàng&status=ACTIVE&page=2&sort=created_at,desc';
      parse();
    });
    $('#ucClear').addEventListener('click', function () {
      $('#ucIn').value = ''; $('#ucOut').textContent = ''; $('#ucParts').innerHTML = ''; st.hide();
    });
    $('#ucCopy').addEventListener('click', function () { QAT.copy($('#ucOut').textContent); });
  }
});
