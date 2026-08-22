QAT.register({
  id: 'json-formatter',
  group: 'data',
  icon: '{}',
  name: { en: 'JSON Formatter & Validator', vi: 'Định dạng & kiểm tra JSON' },
  desc: {
    en: 'Format, validate and minify JSON. Errors point at the exact line and column.',
    vi: 'Định dạng, kiểm tra và thu gọn JSON. Báo lỗi kèm đúng dòng và cột.'
  },
  tags: ['json', 'format', 'validate', 'minify', 'api'],

  build: function (root) {
    var L = QAT.L;
    root.innerHTML = QAT.panel({
      title: L('JSON input', 'JSON đầu vào'),
      actions:
        '<label class="fld" style="max-width:120px;font-size:11px">' + L('Indent', 'Thụt lề') +
          '<select id="jfIndent"><option value="2">2</option><option value="4">4</option>' +
          '<option value="tab">Tab</option></select></label>' +
        '<label class="check"><input type="checkbox" id="jfSort"> ' + L('Sort keys', 'Sắp xếp key') + '</label>',
      body:
        '<textarea id="jfIn" spellcheck="false" placeholder=\'{"id":1,"name":"Nguyen Van A","roles":["qa","admin"]}\'></textarea>' +
        '<div class="row" style="margin-top:12px">' +
          '<button class="btn" id="jfFormat">' + L('Format', 'Định dạng') + '</button>' +
          '<button class="btn sec" id="jfValidate">' + L('Validate', 'Kiểm tra') + '</button>' +
          '<button class="btn sec" id="jfMinify">' + L('Minify', 'Thu gọn') + '</button>' +
          '<button class="btn sec" id="jfEscape">' + L('Escape to string', 'Escape thành chuỗi') + '</button>' +
          '<button class="btn sec" id="jfUnescape">' + L('Unescape', 'Bỏ escape') + '</button>' +
          '<button class="btn sec" id="jfSample">' + L('Sample', 'Mẫu') + '</button>' +
          '<button class="btn sec" id="jfClear">' + L('Clear', 'Xóa') + '</button>' +
        '</div>' +
        '<div class="status hidden" id="jfStatus" style="margin-top:12px"></div>'
    }) + QAT.panel({
      title: L('Output', 'Kết quả'),
      actions:
        '<button class="btn sec sm" id="jfCopy">' + L('Copy', 'Copy') + '</button>' +
        '<button class="btn sec sm" id="jfDl">' + L('Download .json', 'Tải .json') + '</button>',
      body:
        '<div class="stats" id="jfStats" style="margin-bottom:12px"></div>' +
        '<div class="out tall" id="jfOut" data-empty="' + L('Formatted JSON appears here.', 'JSON sau khi định dạng hiện ở đây.') + '"></div>'
    });

    var $ = function (s) { return root.querySelector(s); };
    var st = QAT.status($('#jfStatus'));
    var lastOut = '';

    function indentOpt() {
      var v = $('#jfIndent').value;
      return v === 'tab' ? '\t' : Number(v);
    }

    function locate(text, pos) {
      var upto = text.slice(0, pos);
      var lines = upto.split('\n');
      return { line: lines.length, col: lines[lines.length - 1].length + 1 };
    }

    function parse(text) {
      try {
        return { ok: true, value: JSON.parse(text) };
      } catch (e) {
        var msg = e.message, pos = null;
        var m = /position (\d+)/.exec(msg);
        if (m) pos = Number(m[1]);
        var where = '';
        if (pos !== null) {
          var lc = locate(text, pos);
          where = L(' at line ', ' tại dòng ') + lc.line + L(', column ', ', cột ') + lc.col;
          var lineTxt = text.split('\n')[lc.line - 1] || '';
          where += '\n> ' + lineTxt.slice(0, 120) + '\n> ' + new Array(Math.max(1, lc.col)).join(' ') + '^';
        }
        return { ok: false, error: msg.replace(/\s+in JSON at position \d+.*/, '') + where };
      }
    }

    function sortKeys(v) {
      if (Array.isArray(v)) return v.map(sortKeys);
      if (v && typeof v === 'object') {
        var out = {};
        Object.keys(v).sort().forEach(function (k) { out[k] = sortKeys(v[k]); });
        return out;
      }
      return v;
    }

    function stats(v, text) {
      var keys = 0, arrays = 0, objects = 0, depth = 0, nulls = 0, strings = 0, numbers = 0;
      (function walk(node, d) {
        depth = Math.max(depth, d);
        if (Array.isArray(node)) { arrays++; node.forEach(function (x) { walk(x, d + 1); }); }
        else if (node && typeof node === 'object') {
          objects++;
          Object.keys(node).forEach(function (k) { keys++; walk(node[k], d + 1); });
        }
        else if (node === null) nulls++;
        else if (typeof node === 'string') strings++;
        else if (typeof node === 'number') numbers++;
      })(v, 1);

      $('#jfStats').innerHTML =
        s(objects, L('Objects', 'Object')) + s(arrays, L('Arrays', 'Array')) +
        s(keys, L('Keys', 'Key')) + s(depth, L('Max depth', 'Độ sâu')) +
        s(QAT.bytes(QAT.byteLen(text)), L('Size', 'Kích thước'));
      function s(a, b) { return '<div class="stat"><b>' + a + '</b><span>' + b + '</span></div>'; }
    }

    function render(text) {
      lastOut = text;
      $('#jfOut').innerHTML = QAT.jsonHighlight(text);
    }

    function doFormat(minify) {
      var src = $('#jfIn').value.trim();
      if (!src) { st.warn(L('Input is empty.', 'Chưa có dữ liệu.')); return; }
      var r = parse(src);
      if (!r.ok) { st.err(L('Invalid JSON — ', 'JSON không hợp lệ — ') + r.error); $('#jfOut').textContent = ''; $('#jfStats').innerHTML = ''; return; }
      var value = $('#jfSort').checked ? sortKeys(r.value) : r.value;
      var out = minify ? JSON.stringify(value) : JSON.stringify(value, null, indentOpt());
      render(out);
      stats(value, out);
      var saved = src.length - out.length;
      st.ok(L('Valid JSON. ', 'JSON hợp lệ. ') +
        (minify ? L('Minified — ', 'Đã thu gọn — ') + (saved > 0 ? saved + L(' chars smaller.', ' ký tự nhỏ hơn.') : '') : L('Formatted.', 'Đã định dạng.')));
    }

    $('#jfFormat').addEventListener('click', function () { doFormat(false); });
    $('#jfMinify').addEventListener('click', function () { doFormat(true); });
    $('#jfValidate').addEventListener('click', function () {
      var src = $('#jfIn').value.trim();
      if (!src) { st.warn(L('Input is empty.', 'Chưa có dữ liệu.')); return; }
      var r = parse(src);
      if (r.ok) { st.ok(L('Valid JSON.', 'JSON hợp lệ.')); stats(r.value, src); }
      else st.err(L('Invalid JSON — ', 'JSON không hợp lệ — ') + r.error);
    });
    $('#jfEscape').addEventListener('click', function () {
      var src = $('#jfIn').value;
      if (!src) return;
      render(JSON.stringify(src));
      st.info(L('Converted to a JSON string literal.', 'Đã chuyển thành chuỗi JSON.'));
    });
    $('#jfUnescape').addEventListener('click', function () {
      var src = $('#jfIn').value.trim();
      try {
        var v = JSON.parse(src);
        if (typeof v !== 'string') throw new Error(L('Input is not a JSON string.', 'Dữ liệu không phải chuỗi JSON.'));
        $('#jfIn').value = v;
        st.info(L('Unescaped into the input box.', 'Đã bỏ escape và đưa vào ô nhập.'));
        doFormat(false);
      } catch (e) { st.err(e.message); }
    });
    $('#jfSample').addEventListener('click', function () {
      $('#jfIn').value = '{"traceId":"7f3c2b","status":200,"data":{"user":{"id":1001,"fullName":"Nguyễn Văn A",' +
        '"email":"a@example.com","roles":["QA","LEAD"],"active":true,"quota":null},' +
        '"orders":[{"id":"OD-1","total":250000},{"id":"OD-2","total":99000}]},"took_ms":128}';
      doFormat(false);
    });
    $('#jfClear').addEventListener('click', function () {
      $('#jfIn').value = ''; $('#jfOut').textContent = ''; $('#jfStats').innerHTML = ''; st.hide();
    });
    $('#jfCopy').addEventListener('click', function () { QAT.copy(lastOut); });
    $('#jfDl').addEventListener('click', function () {
      if (!lastOut) { QAT.toast(QAT.t('msg.nothing'), 'err'); return; }
      QAT.download('formatted.json', lastOut, 'application/json');
    });
    $('#jfIndent').addEventListener('change', function () { if (lastOut) doFormat(false); });
    $('#jfSort').addEventListener('change', function () { if (lastOut) doFormat(false); });
  }
});
