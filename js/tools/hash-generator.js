QAT.register({
  id: 'hash-generator',
  group: 'security',
  icon: '#',
  name: { en: 'Hash Generator', vi: 'Tạo mã băm (Hash)' },
  desc: {
    en: 'MD5, SHA-1, SHA-256, SHA-384, SHA-512 of any text, plus a compare box.',
    vi: 'Tạo MD5, SHA-1, SHA-256, SHA-384, SHA-512 từ văn bản, kèm ô đối chiếu.'
  },
  tags: ['hash', 'md5', 'sha256', 'checksum', 'security'],

  build: function (root) {
    var L = QAT.L;
    root.innerHTML = QAT.panel({
      title: L('Input', 'Dữ liệu vào'),
      actions: '<label class="check"><input type="checkbox" id="hgUpper"> ' + L('Uppercase output', 'Kết quả chữ hoa') + '</label>',
      body:
        '<textarea id="hgIn" class="short" spellcheck="false" placeholder="' +
          L('Text to hash...', 'Nội dung cần băm...') + '"></textarea>' +
        '<div class="row" style="margin-top:12px">' +
          '<button class="btn" id="hgRun">' + L('Generate', 'Tạo hash') + '</button>' +
          '<button class="btn sec" id="hgClear">' + L('Clear', 'Xóa') + '</button>' +
          '<label class="fld grow" style="margin-left:auto">' + L('Compare with a known hash', 'Đối chiếu với hash cho trước') +
            '<input type="text" id="hgCmp" class="mono" placeholder="900150983cd24fb0d6963f7d28e17f72"></label>' +
        '</div>' +
        '<div class="status hidden" id="hgStatus" style="margin-top:12px"></div>'
    }) + QAT.panel({
      title: L('Hashes', 'Kết quả'),
      body: '<div id="hgOut"></div>' +
        '<p class="hint" style="margin-top:10px">' +
        L('MD5 and SHA-1 are broken for security purposes — use them only for test fixtures and checksums.',
          'MD5 và SHA-1 đã không còn an toàn — chỉ dùng cho dữ liệu kiểm thử và checksum.') + '</p>'
    });

    var $ = function (s) { return root.querySelector(s); };
    var st = QAT.status($('#hgStatus'));

    function cased(h) { return $('#hgUpper').checked ? h.toUpperCase() : h; }

    function row(name, val, note) {
      return '<div class="k">' + name + '</div><div class="v">' +
        (val ? QAT.esc(cased(val)) + ' <button class="btn sec sm" data-cp="' + QAT.esc(cased(val)) +
          '" style="margin-left:6px;padding:1px 7px">copy</button>' : '<span class="hint">' + QAT.esc(note || '...') + '</span>') +
        '</div>';
    }

    function run() {
      var s = $('#hgIn').value;
      if (!s) { $('#hgOut').innerHTML = ''; st.hide(); return; }

      var md5 = QAT.hash.md5(s), sha1 = QAT.hash.sha1(s), sha256 = QAT.hash.sha256(s);
      var html = '<div class="kv" id="hgKv">' +
        row('MD5', md5) + row('SHA-1', sha1) + row('SHA-256', sha256) +
        '<div class="k">SHA-384</div><div class="v" id="hg384"><span class="hint">...</span></div>' +
        '<div class="k">SHA-512</div><div class="v" id="hg512"><span class="hint">...</span></div>' +
        '<div class="k">' + L('Length / bytes', 'Độ dài / byte') + '</div><div class="v">' +
          Array.from(s).length + ' / ' + QAT.byteLen(s) + '</div>' +
        '</div>';
      $('#hgOut').innerHTML = html;

      QAT.hash.sha384(s).then(function (h) { fill('#hg384', h); }).catch(function (e) { fillErr('#hg384', e.message); });
      QAT.hash.sha512(s).then(function (h) { fill('#hg512', h); }).catch(function (e) { fillErr('#hg512', e.message); });

      var cmp = $('#hgCmp').value.trim().toLowerCase();
      if (cmp) {
        var map = { md5: md5, 'sha-1': sha1, 'sha-256': sha256 };
        var hit = Object.keys(map).find(function (k) { return map[k] === cmp; });
        if (hit) st.ok(L('Match — the given hash equals ', 'Khớp — hash đã cho trùng với ') + hit.toUpperCase() + '.');
        else st.warn(L('No match against MD5 / SHA-1 / SHA-256 (SHA-384/512 are checked visually).',
                       'Không khớp với MD5 / SHA-1 / SHA-256 (SHA-384/512 hãy so bằng mắt).'));
      } else st.hide();
    }

    function fill(sel, h) {
      var n = $(sel);
      if (!n) return;
      n.innerHTML = QAT.esc(cased(h)) + ' <button class="btn sec sm" data-cp="' + QAT.esc(cased(h)) +
        '" style="margin-left:6px;padding:1px 7px">copy</button>';
    }
    function fillErr(sel, m) {
      var n = $(sel);
      if (n) n.innerHTML = '<span class="hint">' + QAT.esc(m) + '</span>';
    }

    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cp]');
      if (b) QAT.copy(b.getAttribute('data-cp'));
    });

    $('#hgRun').addEventListener('click', run);
    $('#hgIn').addEventListener('input', run);
    $('#hgCmp').addEventListener('input', run);
    $('#hgUpper').addEventListener('change', run);
    $('#hgClear').addEventListener('click', function () {
      $('#hgIn').value = ''; $('#hgOut').innerHTML = ''; st.hide();
    });
  }
});
