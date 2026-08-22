QAT.register({
  id: 'csv-json',
  group: 'data',
  icon: '⇅',
  name: { en: 'CSV ⇄ JSON', vi: 'Chuyển đổi CSV ⇄ JSON' },
  desc: {
    en: 'Convert CSV to JSON and back, with delimiter detection and a table preview.',
    vi: 'Chuyển CSV sang JSON và ngược lại, tự nhận dấu phân cách và xem trước dạng bảng.'
  },
  tags: ['csv', 'json', 'convert', 'excel', 'import'],

  build: function (root) {
    var L = QAT.L;
    root.innerHTML = QAT.panel({
      title: L('Direction & options', 'Hướng chuyển đổi & tùy chọn'),
      body:
        '<div class="row">' +
          '<label class="fld" style="max-width:210px">' + L('Direction', 'Hướng') +
            '<select id="cjDir">' +
              '<option value="c2j">CSV → JSON</option>' +
              '<option value="j2c">JSON → CSV</option>' +
            '</select></label>' +
          '<label class="fld" style="max-width:170px">' + L('Delimiter', 'Dấu phân cách') +
            '<select id="cjDelim">' +
              '<option value="auto">' + L('Auto detect', 'Tự nhận') + '</option>' +
              '<option value=",">, (comma)</option>' +
              '<option value=";">; (semicolon)</option>' +
              '<option value="\t">Tab</option>' +
              '<option value="|">| (pipe)</option>' +
            '</select></label>' +
          '<label class="check"><input type="checkbox" id="cjTyped" checked> ' +
            L('Detect numbers / booleans', 'Nhận số / boolean') + '</label>' +
          '<label class="check"><input type="checkbox" id="cjEmptyNull"> ' +
            L('Empty cell → null', 'Ô trống → null') + '</label>' +
        '</div>' +
        '<label class="fld" style="margin-top:12px">' + L('Input', 'Dữ liệu vào') +
          '<textarea id="cjIn" spellcheck="false"></textarea></label>' +
        '<div class="row" style="margin-top:12px">' +
          '<button class="btn" id="cjRun">' + L('Convert', 'Chuyển đổi') + '</button>' +
          '<button class="btn sec" id="cjSample">' + L('Sample', 'Mẫu') + '</button>' +
          '<button class="btn sec" id="cjSwap">' + L('Use output as input', 'Dùng kết quả làm đầu vào') + '</button>' +
          '<button class="btn sec" id="cjClear">' + L('Clear', 'Xóa') + '</button>' +
        '</div>' +
        '<div class="status hidden" id="cjStatus" style="margin-top:12px"></div>'
    }) + QAT.panel({
      title: L('Output', 'Kết quả'),
      actions:
        '<button class="btn sec sm" id="cjCopy">' + L('Copy', 'Copy') + '</button>' +
        '<button class="btn sec sm" id="cjDl">' + L('Download', 'Tải file') + '</button>',
      body: '<div class="out tall" id="cjOut" data-empty="' + L('Converted data appears here.', 'Dữ liệu sau chuyển đổi hiện ở đây.') + '"></div>'
    }) + QAT.panel({
      title: L('Table preview', 'Xem trước dạng bảng'),
      body: '<div id="cjTable"><p class="hint">' + L('Run a conversion to see the table.', 'Chạy chuyển đổi để xem bảng.') + '</p></div>'
    });

    var $ = function (s) { return root.querySelector(s); };
    var st = QAT.status($('#cjStatus'));
    var lastOut = '', lastKind = 'json';

    function delim() {
      var v = $('#cjDelim').value;
      return v === 'auto' ? null : v;
    }

    function csvToJson() {
      var src = $('#cjIn').value;
      if (!src.trim()) { st.warn(L('Input is empty.', 'Chưa có dữ liệu.')); return; }
      var p = QAT.csv.parse(src, delim());
      if (!p.rows.length) { st.err(L('No rows found.', 'Không tìm thấy dòng dữ liệu.')); return; }
      var objs = QAT.csv.toObjects(p.rows, {
        typed: $('#cjTyped').checked,
        emptyNull: $('#cjEmptyNull').checked
      });
      lastOut = JSON.stringify(objs, null, 2);
      lastKind = 'json';
      $('#cjOut').innerHTML = QAT.jsonHighlight(lastOut);
      table(p.rows[0], p.rows.slice(1));
      st.ok(objs.length + L(' record(s) converted. Delimiter: ', ' bản ghi. Dấu phân cách: ') +
        (p.delimiter === '\t' ? 'Tab' : p.delimiter));
    }

    function jsonToCsv() {
      var src = $('#cjIn').value.trim();
      if (!src) { st.warn(L('Input is empty.', 'Chưa có dữ liệu.')); return; }
      var data;
      try { data = JSON.parse(src); }
      catch (e) { st.err(L('Invalid JSON: ', 'JSON không hợp lệ: ') + e.message); return; }

      if (!Array.isArray(data)) {
        // allow a wrapper like {data:[...]} or {items:[...]}
        var arrKey = Object.keys(data || {}).find(function (k) { return Array.isArray(data[k]); });
        if (arrKey) { data = data[arrKey]; st.info(L('Used array property: ', 'Dùng mảng ở thuộc tính: ') + arrKey); }
        else data = [data];
      }
      var d = delim() || ',';
      lastOut = QAT.csv.fromObjects(data, d, '\n');
      lastKind = 'csv';
      $('#cjOut').textContent = lastOut;
      var rows = QAT.csv.parse(lastOut, d).rows;
      table(rows[0], rows.slice(1));
      st.ok(data.length + L(' record(s) converted to CSV.', ' bản ghi đã chuyển sang CSV.'));
    }

    function table(header, rows) {
      if (!header) { $('#cjTable').innerHTML = ''; return; }
      var shown = rows.slice(0, 200);
      $('#cjTable').innerHTML = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th>' +
        header.map(function (h) { return '<th>' + QAT.esc(h) + '</th>'; }).join('') +
        '</tr></thead><tbody>' + shown.map(function (r, i) {
          return '<tr><td>' + (i + 1) + '</td>' + header.map(function (_, k) {
            return '<td class="mono">' + QAT.esc(r[k] === undefined ? '' : r[k]) + '</td>';
          }).join('') + '</tr>';
        }).join('') + '</tbody></table></div>' +
        (rows.length > 200 ? '<p class="hint" style="margin-top:6px">' +
          L('Showing first 200 of ', 'Hiển thị 200 / ') + rows.length + L(' rows.', ' dòng.') + '</p>' : '');
    }

    function run() {
      $('#cjDir').value === 'c2j' ? csvToJson() : jsonToCsv();
    }

    $('#cjRun').addEventListener('click', run);
    $('#cjDir').addEventListener('change', function () { $('#cjOut').textContent = ''; st.hide(); });
    $('#cjSwap').addEventListener('click', function () {
      if (!lastOut) return;
      $('#cjIn').value = lastOut;
      $('#cjDir').value = lastKind === 'json' ? 'j2c' : 'c2j';
      run();
    });
    $('#cjSample').addEventListener('click', function () {
      if ($('#cjDir').value === 'c2j') {
        $('#cjIn').value = 'id,fullName,email,phone,active,balance\n' +
          '1,"Nguyễn Văn A",a@example.com,0912345678,true,250000\n' +
          '2,"Trần Thị B",b@example.com,0987654321,false,0\n' +
          '3,"Lê Minh C, Jr.",c@example.com,0900111222,true,1250000';
      } else {
        $('#cjIn').value = JSON.stringify([
          { id: 1, fullName: 'Nguyễn Văn A', email: 'a@example.com', active: true },
          { id: 2, fullName: 'Trần Thị B', email: 'b@example.com', active: false }
        ], null, 2);
      }
      run();
    });
    $('#cjClear').addEventListener('click', function () {
      $('#cjIn').value = ''; $('#cjOut').textContent = ''; $('#cjTable').innerHTML = ''; st.hide();
    });
    $('#cjCopy').addEventListener('click', function () { QAT.copy(lastOut); });
    $('#cjDl').addEventListener('click', function () {
      if (!lastOut) { QAT.toast(QAT.t('msg.nothing'), 'err'); return; }
      lastKind === 'json'
        ? QAT.download('data.json', lastOut, 'application/json')
        : QAT.download('data.csv', lastOut, 'text/csv');
    });
  }
});
