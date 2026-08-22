QAT.register({
  id: 'dedupe-lines',
  group: 'text',
  icon: '≡',
  name: { en: 'Line Tools (Dedupe / Sort)', vi: 'Xử lý dòng (Lọc trùng / Sắp xếp)' },
  desc: {
    en: 'Remove duplicate lines, sort, reverse, trim, number lines or add prefix/suffix.',
    vi: 'Xóa dòng trùng, sắp xếp, đảo thứ tự, cắt khoảng trắng, đánh số dòng, thêm tiền tố/hậu tố.'
  },
  tags: ['duplicate', 'sort', 'lines', 'cleanup'],

  build: function (root) {
    var L = QAT.L;
    root.innerHTML = QAT.panel({
      title: L('Input', 'Dữ liệu vào'),
      body:
        '<textarea id="dlIn" spellcheck="false" placeholder="TC-001\nTC-002\nTC-001\nTC-003"></textarea>' +
        '<div class="row" style="margin-top:12px">' +
          '<label class="check"><input type="checkbox" id="dlDedupe" checked> ' + L('Remove duplicates', 'Xóa dòng trùng') + '</label>' +
          '<label class="check"><input type="checkbox" id="dlTrim" checked> ' + L('Trim each line', 'Cắt khoảng trắng') + '</label>' +
          '<label class="check"><input type="checkbox" id="dlBlank" checked> ' + L('Drop blank lines', 'Bỏ dòng trống') + '</label>' +
          '<label class="check"><input type="checkbox" id="dlCase"> ' + L('Case-insensitive', 'Không phân biệt hoa/thường') + '</label>' +
          '<label class="check"><input type="checkbox" id="dlNumber"> ' + L('Number lines', 'Đánh số dòng') + '</label>' +
        '</div>' +
        '<div class="row" style="margin-top:10px">' +
          '<label class="fld" style="max-width:190px">' + L('Sort', 'Sắp xếp') +
            '<select id="dlSort">' +
              '<option value="none">' + L('Keep order', 'Giữ nguyên') + '</option>' +
              '<option value="asc">A → Z</option>' +
              '<option value="desc">Z → A</option>' +
              '<option value="len">' + L('By length', 'Theo độ dài') + '</option>' +
              '<option value="rev">' + L('Reverse', 'Đảo ngược') + '</option>' +
            '</select></label>' +
          '<label class="fld" style="max-width:170px">' + L('Prefix', 'Tiền tố') + '<input type="text" id="dlPre" placeholder="&quot;"></label>' +
          '<label class="fld" style="max-width:170px">' + L('Suffix', 'Hậu tố') + '<input type="text" id="dlSuf" placeholder="&quot;,"></label>' +
          '<button class="btn" id="dlRun">' + L('Process', 'Xử lý') + '</button>' +
          '<button class="btn sec" id="dlClear">' + L('Clear', 'Xóa') + '</button>' +
        '</div>'
    }) + QAT.panel({
      title: L('Result', 'Kết quả'),
      actions:
        '<button class="btn sec sm" id="dlCopy">' + L('Copy', 'Copy') + '</button>' +
        '<button class="btn sec sm" id="dlDl">' + L('Download .txt', 'Tải .txt') + '</button>',
      body:
        '<div class="stats" id="dlStats" style="margin-bottom:12px"></div>' +
        '<div class="out tall" id="dlOut" data-empty="' + L('Result appears here.', 'Kết quả hiện ở đây.') + '"></div>' +
        '<div id="dlDupes" style="margin-top:12px"></div>'
    });

    var $ = function (s) { return root.querySelector(s); };

    function run() {
      var src = $('#dlIn').value;
      var lines = src.replace(/\r\n?/g, '\n').split('\n');
      var before = lines.length;

      if ($('#dlTrim').checked) lines = lines.map(function (l) { return l.trim(); });
      if ($('#dlBlank').checked) lines = lines.filter(function (l) { return l !== ''; });

      var dupCount = {}, removed = 0;
      if ($('#dlDedupe').checked) {
        var seen = {}, out = [];
        lines.forEach(function (l) {
          var key = $('#dlCase').checked ? l.toLowerCase() : l;
          if (seen[key]) { dupCount[l] = (dupCount[l] || 1) + 1; removed++; return; }
          seen[key] = true; out.push(l);
        });
        lines = out;
      }

      var mode = $('#dlSort').value;
      if (mode === 'asc') lines.sort(function (a, b) { return a.localeCompare(b, 'vi'); });
      else if (mode === 'desc') lines.sort(function (a, b) { return b.localeCompare(a, 'vi'); });
      else if (mode === 'len') lines.sort(function (a, b) { return a.length - b.length; });
      else if (mode === 'rev') lines.reverse();

      var pre = $('#dlPre').value, suf = $('#dlSuf').value, num = $('#dlNumber').checked;
      var final = lines.map(function (l, i) {
        return (num ? (i + 1) + '. ' : '') + pre + l + suf;
      });

      $('#dlOut').textContent = final.join('\n');
      $('#dlStats').innerHTML =
        '<div class="stat"><b>' + before + '</b><span>' + L('Input lines', 'Dòng đầu vào') + '</span></div>' +
        '<div class="stat"><b>' + lines.length + '</b><span>' + L('Output lines', 'Dòng kết quả') + '</span></div>' +
        '<div class="stat"><b>' + removed + '</b><span>' + L('Duplicates removed', 'Dòng trùng đã xóa') + '</span></div>';

      var keys = Object.keys(dupCount);
      $('#dlDupes').innerHTML = keys.length
        ? '<div class="status info">' + L('Duplicate values: ', 'Giá trị bị trùng: ') +
          keys.slice(0, 25).map(function (k) { return k + ' (x' + dupCount[k] + ')'; }).join(', ') +
          (keys.length > 25 ? ' ...' : '') + '</div>'
        : '';
    }

    $('#dlRun').addEventListener('click', run);
    $('#dlIn').addEventListener('input', run);
    QAT.$$('#dlDedupe,#dlTrim,#dlBlank,#dlCase,#dlNumber,#dlSort,#dlPre,#dlSuf', root)
      .forEach(function (n) { n.addEventListener('change', run); n.addEventListener('input', run); });
    $('#dlClear').addEventListener('click', function () {
      $('#dlIn').value = ''; $('#dlOut').textContent = ''; $('#dlStats').innerHTML = ''; $('#dlDupes').innerHTML = '';
    });
    $('#dlCopy').addEventListener('click', function () { QAT.copy($('#dlOut').textContent); });
    $('#dlDl').addEventListener('click', function () {
      QAT.download('lines.txt', $('#dlOut').textContent);
    });
  }
});
