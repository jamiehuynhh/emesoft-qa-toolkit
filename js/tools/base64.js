QAT.register({
  id: 'base64',
  group: 'data',
  icon: 'B64',
  name: { en: 'Base64 Encoder / Decoder', vi: 'Mã hóa / Giải mã Base64' },
  desc: {
    en: 'Encode and decode Base64 (UTF-8 safe), including URL-safe variant and data URIs.',
    vi: 'Mã hóa và giải mã Base64 (hỗ trợ UTF-8), gồm cả biến thể URL-safe và data URI.'
  },
  tags: ['base64', 'encode', 'decode', 'utf-8'],

  build: function (root) {
    var L = QAT.L;
    root.innerHTML = QAT.panel({
      title: L('Text / Base64', 'Văn bản / Base64'),
      actions:
        '<label class="check"><input type="checkbox" id="b64Url"> ' + L('URL-safe (-_ , no padding)', 'URL-safe (-_ , không padding)') + '</label>' +
        '<label class="check"><input type="checkbox" id="b64Wrap"> ' + L('Wrap at 76 chars', 'Ngắt dòng 76 ký tự') + '</label>',
      body:
        '<div class="split">' +
          '<label class="fld">' + L('Plain text', 'Văn bản gốc') +
            '<textarea id="b64Plain" spellcheck="false" placeholder="Xin chào QA"></textarea></label>' +
          '<label class="fld">Base64' +
            '<textarea id="b64Enc" spellcheck="false" placeholder="WGluIGNow6BvIFFB"></textarea></label>' +
        '</div>' +
        '<div class="row" style="margin-top:12px">' +
          '<button class="btn" id="b64E">' + L('Encode →', 'Mã hóa →') + '</button>' +
          '<button class="btn" id="b64D">' + L('← Decode', '← Giải mã') + '</button>' +
          '<button class="btn sec" id="b64Swap">' + L('Swap', 'Đổi chỗ') + '</button>' +
          '<button class="btn sec" id="b64Clear">' + L('Clear', 'Xóa') + '</button>' +
          '<span style="flex:1"></span>' +
          '<button class="btn sec sm" id="b64File">' + L('Encode a file...', 'Mã hóa file...') + '</button>' +
          '<input type="file" id="b64FileIn" hidden>' +
        '</div>' +
        '<div class="status hidden" id="b64Status" style="margin-top:12px"></div>' +
        '<div class="stats" id="b64Stats" style="margin-top:12px"></div>'
    });

    var $ = function (s) { return root.querySelector(s); };
    var st = QAT.status($('#b64Status'));

    function wrap(s) {
      if (!$('#b64Wrap').checked) return s;
      return s.replace(/.{76}/g, '$&\n');
    }

    function encode() {
      var src = $('#b64Plain').value;
      if (!src) { st.warn(L('Nothing to encode.', 'Không có dữ liệu để mã hóa.')); return; }
      try {
        var out = $('#b64Url').checked ? QAT.hash.b64urlEncode(src) : QAT.hash.b64encode(src);
        $('#b64Enc').value = wrap(out);
        stats(src, out);
        st.ok(L('Encoded.', 'Đã mã hóa.'));
      } catch (e) { st.err(e.message); }
    }

    function decode() {
      var src = $('#b64Enc').value.replace(/\s+/g, '');
      if (!src) { st.warn(L('Nothing to decode.', 'Không có dữ liệu để giải mã.')); return; }
      try {
        var out = /[-_]/.test(src) || $('#b64Url').checked
          ? QAT.hash.b64urlDecode(src)
          : QAT.hash.b64decode(src);
        $('#b64Plain').value = out;
        stats(out, src);
        st.ok(L('Decoded.', 'Đã giải mã.'));
      } catch (e) {
        st.err(L('Not valid Base64: ', 'Base64 không hợp lệ: ') + e.message);
      }
    }

    function stats(plain, enc) {
      $('#b64Stats').innerHTML =
        s(QAT.byteLen(plain), L('Plain bytes', 'Byte gốc')) +
        s(enc.replace(/\s/g, '').length, L('Base64 chars', 'Ký tự Base64')) +
        s('+' + Math.round((enc.replace(/\s/g, '').length / Math.max(1, QAT.byteLen(plain)) - 1) * 100) + '%',
          L('Size overhead', 'Phình thêm'));
      function s(a, b) { return '<div class="stat"><b>' + a + '</b><span>' + b + '</span></div>'; }
    }

    $('#b64E').addEventListener('click', encode);
    $('#b64D').addEventListener('click', decode);
    $('#b64Swap').addEventListener('click', function () {
      var t = $('#b64Plain').value; $('#b64Plain').value = $('#b64Enc').value; $('#b64Enc').value = t;
    });
    $('#b64Clear').addEventListener('click', function () {
      $('#b64Plain').value = ''; $('#b64Enc').value = ''; $('#b64Stats').innerHTML = ''; st.hide();
    });
    $('#b64File').addEventListener('click', function () { $('#b64FileIn').click(); });
    $('#b64FileIn').addEventListener('change', function () {
      var f = this.files && this.files[0];
      if (!f) return;
      if (f.size > 4 * 1024 * 1024) { st.err(L('File too large (max 4 MB).', 'File quá lớn (tối đa 4 MB).')); return; }
      var fr = new FileReader();
      fr.onload = function () {
        var dataUri = String(fr.result);
        $('#b64Enc').value = wrap(dataUri.split(',')[1] || '');
        $('#b64Plain').value = dataUri;
        st.ok(L('File encoded as data URI (kept in the left pane). ', 'Đã mã hóa file thành data URI (ở ô bên trái). ') +
          f.name + ' — ' + QAT.bytes(f.size));
      };
      fr.readAsDataURL(f);
    });
    $('#b64Plain').addEventListener('input', function () { if (this.value) encode(); });
  }
});
