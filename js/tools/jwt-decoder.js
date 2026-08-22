QAT.register({
  id: 'jwt-decoder',
  group: 'security',
  icon: 'JWT',
  name: { en: 'JWT Decoder', vi: 'Giải mã JWT' },
  desc: {
    en: 'Decode header and payload, check expiry, and optionally verify an HS256 signature.',
    vi: 'Đọc header và payload, kiểm tra hạn dùng, có thể xác minh chữ ký HS256.'
  },
  tags: ['jwt', 'token', 'auth', 'bearer', 'claims'],

  build: function (root) {
    var L = QAT.L;
    root.innerHTML = QAT.panel({
      title: L('Token', 'Token'),
      body:
        '<label class="fld">' + L('Paste a JWT (the "Bearer " prefix is ignored)', 'Dán JWT (tiền tố "Bearer " sẽ được bỏ qua)') +
          '<textarea id="jwIn" class="short" spellcheck="false" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMDAxIn0.xxx"></textarea></label>' +
        '<div class="row" style="margin-top:12px">' +
          '<button class="btn" id="jwRun">' + L('Decode', 'Giải mã') + '</button>' +
          '<button class="btn sec" id="jwSample">' + L('Sample token', 'Token mẫu') + '</button>' +
          '<button class="btn sec" id="jwClear">' + L('Clear', 'Xóa') + '</button>' +
        '</div>' +
        '<div class="status hidden" id="jwStatus" style="margin-top:12px"></div>'
    }) + QAT.panel({
      title: L('Claims summary', 'Tóm tắt claim'),
      body: '<div id="jwSummary"><p class="hint">' + L('Decode a token to see its claims.', 'Giải mã token để xem các claim.') + '</p></div>'
    }) + QAT.panel({
      title: L('Header / Payload', 'Header / Payload'),
      actions:
        '<button class="btn sec sm" id="jwCopyH">' + L('Copy header', 'Copy header') + '</button>' +
        '<button class="btn sec sm" id="jwCopyP">' + L('Copy payload', 'Copy payload') + '</button>',
      body:
        '<div class="split">' +
          '<div><label class="fld">Header</label><div class="out" id="jwHead" style="margin-top:5px"></div></div>' +
          '<div><label class="fld">Payload</label><div class="out" id="jwPay" style="margin-top:5px"></div></div>' +
        '</div>' +
        '<div style="margin-top:12px"><label class="fld">' + L('Signature (raw)', 'Chữ ký (thô)') +
          '</label><div class="out" id="jwSig" style="margin-top:5px;min-height:auto"></div></div>'
    }) + QAT.panel({
      title: L('Verify HS256 signature (optional)', 'Xác minh chữ ký HS256 (tùy chọn)'),
      body:
        '<div class="row">' +
          '<label class="fld grow">' + L('Shared secret', 'Secret dùng chung') +
            '<input type="text" id="jwSecret" class="mono" placeholder="your-256-bit-secret"></label>' +
          '<button class="btn sec" id="jwVerify">' + L('Verify', 'Xác minh') + '</button>' +
        '</div>' +
        '<div class="status hidden" id="jwVStatus" style="margin-top:12px"></div>' +
        '<p class="hint" style="margin-top:8px">' +
          L('Only HS256 (HMAC-SHA256) is supported here, and only when the page runs over http/https. RS256 needs the public key and is out of scope for a browser tool.',
            'Chỉ hỗ trợ HS256 (HMAC-SHA256) và chỉ khi trang chạy qua http/https. RS256 cần public key nên không nằm trong phạm vi công cụ này.') +
        '</p>'
    });

    var $ = function (s) { return root.querySelector(s); };
    var st = QAT.status($('#jwStatus'));
    var stv = QAT.status($('#jwVStatus'));
    var head = '', pay = '';

    function fmtTime(sec) {
      var d = new Date(sec * 1000);
      if (isNaN(d.getTime())) return String(sec);
      return d.toISOString().replace('T', ' ').replace(/\.\d+Z/, ' UTC');
    }

    function run() {
      var raw = $('#jwIn').value.trim().replace(/^Bearer\s+/i, '');
      stv.hide();
      if (!raw) { st.warn(L('Paste a token first.', 'Hãy dán token.')); return; }
      var parts = raw.split('.');
      if (parts.length < 2) { st.err(L('A JWT needs at least header.payload', 'JWT phải có ít nhất header.payload')); return; }

      var h, p;
      try { h = JSON.parse(QAT.hash.b64urlDecode(parts[0])); }
      catch (e) { st.err(L('Header is not valid Base64URL JSON.', 'Header không phải JSON Base64URL hợp lệ.')); return; }
      try { p = JSON.parse(QAT.hash.b64urlDecode(parts[1])); }
      catch (e) { st.err(L('Payload is not valid Base64URL JSON.', 'Payload không phải JSON Base64URL hợp lệ.')); return; }

      head = JSON.stringify(h, null, 2);
      pay = JSON.stringify(p, null, 2);
      $('#jwHead').innerHTML = QAT.jsonHighlight(head);
      $('#jwPay').innerHTML = QAT.jsonHighlight(pay);
      $('#jwSig').textContent = parts[2] || L('(none — unsigned token)', '(không có — token không chữ ký)');

      var now = Math.floor(Date.now() / 1000);
      var rows = '';
      var LABEL = {
        iss: L('Issuer', 'Đơn vị phát hành'), sub: L('Subject', 'Chủ thể'),
        aud: L('Audience', 'Đối tượng'), jti: 'JWT ID',
        scope: 'Scope', roles: L('Roles', 'Quyền'), email: 'Email',
        name: L('Name', 'Tên'), preferred_username: 'Username'
      };
      ['iss', 'sub', 'aud', 'jti', 'scope', 'roles', 'email', 'name', 'preferred_username'].forEach(function (k) {
        if (p[k] !== undefined) rows += kv(LABEL[k] + ' (' + k + ')', typeof p[k] === 'object' ? JSON.stringify(p[k]) : p[k]);
      });

      rows += kv(L('Algorithm', 'Thuật toán') + ' (alg)', h.alg || '—');
      if (h.kid) rows += kv('Key ID (kid)', h.kid);
      if (p.iat !== undefined) rows += kv(L('Issued at', 'Thời điểm phát hành') + ' (iat)', fmtTime(p.iat));
      if (p.nbf !== undefined) rows += kv(L('Not before', 'Chưa hiệu lực trước') + ' (nbf)', fmtTime(p.nbf));

      var expNote = '';
      if (p.exp !== undefined) {
        var left = p.exp - now;
        expNote = left > 0
          ? '<span class="pill ok">' + L('valid, ', 'còn hiệu lực, ') + human(left) + L(' left', ' nữa') + '</span>'
          : '<span class="pill err">' + L('EXPIRED ', 'ĐÃ HẾT HẠN ') + human(-left) + L(' ago', ' trước') + '</span>';
        rows += kv(L('Expires at', 'Hết hạn') + ' (exp)', fmtTime(p.exp) + ' &nbsp; ' + expNote, true);
      }

      var others = Object.keys(p).filter(function (k) {
        return ['iss', 'sub', 'aud', 'jti', 'scope', 'roles', 'email', 'name',
          'preferred_username', 'iat', 'nbf', 'exp'].indexOf(k) === -1;
      });
      if (others.length) {
        rows += kv(L('Other claims', 'Claim khác'), others.join(', '));
      }

      $('#jwSummary').innerHTML = '<div class="kv">' + rows + '</div>';

      if (h.alg === 'none') st.warn(L('alg = none — this token is unsigned. Flag it as a finding.', 'alg = none — token không được ký. Nên ghi nhận đây là một lỗi bảo mật.'));
      else if (p.exp !== undefined && p.exp < now) st.err(L('Token decoded, but it is expired.', 'Đã giải mã, nhưng token đã hết hạn.'));
      else st.ok(L('Token decoded. Signature is NOT verified unless you check it below.', 'Đã giải mã. Chữ ký chưa được xác minh trừ khi bạn kiểm tra bên dưới.'));
    }

    function human(sec) {
      sec = Math.abs(sec);
      if (sec < 60) return Math.round(sec) + 's';
      if (sec < 3600) return Math.round(sec / 60) + 'm';
      if (sec < 86400) return Math.round(sec / 3600) + 'h';
      return Math.round(sec / 86400) + 'd';
    }
    function kv(k, v, isHtml) {
      return '<div class="k">' + k + '</div><div class="v">' + (isHtml ? v : QAT.esc(v)) + '</div>';
    }

    function verify() {
      var raw = $('#jwIn').value.trim().replace(/^Bearer\s+/i, '');
      var secret = $('#jwSecret').value;
      var parts = raw.split('.');
      if (parts.length !== 3) { stv.err(L('Need a full header.payload.signature token.', 'Cần token đủ 3 phần header.payload.signature.')); return; }
      if (!secret) { stv.warn(L('Enter the shared secret.', 'Hãy nhập secret.')); return; }
      if (!(window.crypto && window.crypto.subtle)) {
        stv.err(L('Web Crypto unavailable — open the site over http://localhost instead of file://.',
                  'Web Crypto không khả dụng — hãy mở site qua http://localhost thay vì file://.'));
        return;
      }
      var enc = new TextEncoder();
      stv.info(L('Verifying...', 'Đang xác minh...'));
      window.crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
        .then(function (key) {
          return window.crypto.subtle.sign('HMAC', key, enc.encode(parts[0] + '.' + parts[1]));
        })
        .then(function (sig) {
          var bytes = new Uint8Array(sig), bin = '';
          for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
          var b64 = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
          if (b64 === parts[2]) stv.ok(L('Signature VALID for this secret (HS256).', 'Chữ ký HỢP LỆ với secret này (HS256).'));
          else stv.err(L('Signature does NOT match this secret.', 'Chữ ký KHÔNG khớp với secret này.'));
        })
        .catch(function (e) { stv.err(e.message); });
    }

    $('#jwRun').addEventListener('click', run);
    $('#jwVerify').addEventListener('click', verify);
    $('#jwIn').addEventListener('input', function () { if (this.value.split('.').length >= 2) run(); });
    $('#jwClear').addEventListener('click', function () {
      $('#jwIn').value = ''; $('#jwHead').textContent = ''; $('#jwPay').textContent = '';
      $('#jwSig').textContent = ''; $('#jwSummary').innerHTML = ''; st.hide(); stv.hide();
    });
    $('#jwCopyH').addEventListener('click', function () { QAT.copy(head); });
    $('#jwCopyP').addEventListener('click', function () { QAT.copy(pay); });
    $('#jwSample').addEventListener('click', function () {
      // built locally so the sample is always internally consistent
      var h = QAT.hash.b64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      var now = Math.floor(Date.now() / 1000);
      var p = QAT.hash.b64urlEncode(JSON.stringify({
        sub: '1001', name: 'Nguyễn Văn A', email: 'a@example.com',
        roles: ['QA', 'LEAD'], scope: 'orders:read orders:write',
        iat: now - 600, exp: now + 3000, iss: 'https://auth.example.com', aud: 'qa-toolkit'
      }));
      $('#jwIn').value = h + '.' + p + '.demo_signature_not_verified';
      $('#jwSecret').value = '';
      run();
    });
  }
});
