QAT.register({
  id: 'timestamp-converter',
  group: 'data',
  icon: '◷',
  name: { en: 'Timestamp Converter', vi: 'Chuyển đổi Timestamp' },
  desc: {
    en: 'Unix seconds / milliseconds ⇄ human date, in local time, UTC and Vietnam (UTC+7).',
    vi: 'Unix giây / milli ⇄ ngày giờ, theo giờ máy, UTC và giờ Việt Nam (UTC+7).'
  },
  tags: ['timestamp', 'unix', 'epoch', 'date', 'iso'],

  build: function (root) {
    var L = QAT.L;
    root.innerHTML = QAT.panel({
      title: L('Now', 'Hiện tại'),
      body:
        '<div class="stats" id="tsNow"></div>' +
        '<div class="row" style="margin-top:12px">' +
          '<button class="btn sec sm" id="tsUseNow">' + L('Use current time', 'Dùng thời điểm hiện tại') + '</button>' +
          '<label class="check"><input type="checkbox" id="tsTick" checked> ' + L('Live', 'Cập nhật liên tục') + '</label>' +
        '</div>'
    }) + QAT.panel({
      title: L('Timestamp → Date', 'Timestamp → Ngày giờ'),
      body:
        '<div class="row">' +
          '<label class="fld grow">' + L('Unix timestamp', 'Unix timestamp') +
            '<input type="text" id="tsIn" class="mono" placeholder="1766404800 / 1766404800000"></label>' +
          '<label class="fld" style="max-width:180px">' + L('Unit', 'Đơn vị') +
            '<select id="tsUnit">' +
              '<option value="auto">' + L('Auto', 'Tự nhận') + '</option>' +
              '<option value="s">' + L('Seconds', 'Giây') + '</option>' +
              '<option value="ms">' + L('Milliseconds', 'Milli giây') + '</option>' +
            '</select></label>' +
          '<button class="btn" id="tsRun">' + L('Convert', 'Chuyển đổi') + '</button>' +
        '</div>' +
        '<div class="status hidden" id="tsStatus" style="margin-top:12px"></div>' +
        '<div id="tsOut" style="margin-top:12px"></div>'
    }) + QAT.panel({
      title: L('Date → Timestamp', 'Ngày giờ → Timestamp'),
      body:
        '<div class="row">' +
          '<label class="fld grow">' + L('Date / time text', 'Chuỗi ngày giờ') +
            '<input type="text" id="tsDate" class="mono" placeholder="2026-08-22 14:30:00"></label>' +
          '<label class="fld" style="max-width:200px">' + L('Interpret as', 'Hiểu theo múi giờ') +
            '<select id="tsZone">' +
              '<option value="local">' + L('Local time', 'Giờ máy') + '</option>' +
              '<option value="utc">UTC</option>' +
              '<option value="vn">' + L('Vietnam (UTC+7)', 'Việt Nam (UTC+7)') + '</option>' +
            '</select></label>' +
          '<button class="btn" id="tsRun2">' + L('Convert', 'Chuyển đổi') + '</button>' +
        '</div>' +
        '<div class="status hidden" id="tsStatus2" style="margin-top:12px"></div>' +
        '<div id="tsOut2" style="margin-top:12px"></div>'
    });

    var $ = function (s) { return root.querySelector(s); };
    var st = QAT.status($('#tsStatus'));
    var st2 = QAT.status($('#tsStatus2'));
    var timer = null;

    function p2(n) { return QAT.pad(n, 2); }

    function fmtOffset(d, offsetMinutes) {
      var t = new Date(d.getTime() + offsetMinutes * 60000);
      return t.getUTCFullYear() + '-' + p2(t.getUTCMonth() + 1) + '-' + p2(t.getUTCDate()) + ' ' +
        p2(t.getUTCHours()) + ':' + p2(t.getUTCMinutes()) + ':' + p2(t.getUTCSeconds());
    }
    function fmtLocal(d) {
      return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + ' ' +
        p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds());
    }
    function relative(ms) {
      var diff = Date.now() - ms, past = diff >= 0, s = Math.abs(diff) / 1000;
      var units = [[31536000, L('year', 'năm')], [2592000, L('month', 'tháng')], [86400, L('day', 'ngày')],
        [3600, L('hour', 'giờ')], [60, L('minute', 'phút')], [1, L('second', 'giây')]];
      for (var i = 0; i < units.length; i++) {
        if (s >= units[i][0]) {
          var n = Math.floor(s / units[i][0]);
          return past ? n + ' ' + units[i][1] + L(' ago', ' trước') : L('in ', 'sau ') + n + ' ' + units[i][1];
        }
      }
      return L('just now', 'vừa xong');
    }

    function nowPanel() {
      var d = new Date();
      $('#tsNow').innerHTML =
        s(Math.floor(d.getTime() / 1000), L('Unix (s)', 'Unix (giây)')) +
        s(d.getTime(), L('Unix (ms)', 'Unix (ms)')) +
        s(fmtLocal(d), L('Local', 'Giờ máy')) +
        s(fmtOffset(d, 420), L('Vietnam UTC+7', 'Việt Nam UTC+7'));
      function s(a, b) { return '<div class="stat"><b style="font-size:15px">' + a + '</b><span>' + b + '</span></div>'; }
    }

    function toDate() {
      var raw = $('#tsIn').value.trim().replace(/[,_\s]/g, '');
      if (!raw) { st.warn(L('Enter a timestamp.', 'Hãy nhập timestamp.')); return; }
      if (!/^-?\d+(\.\d+)?$/.test(raw)) { st.err(L('Not a number.', 'Không phải số.')); return; }
      var n = Number(raw), unit = $('#tsUnit').value, ms;
      if (unit === 'auto') {
        // 10 digits -> seconds, 13 -> ms, 16 -> microseconds
        var digits = raw.replace('-', '').split('.')[0].length;
        if (digits >= 16) ms = n / 1000;
        else if (digits >= 12) ms = n;
        else ms = n * 1000;
      } else ms = unit === 's' ? n * 1000 : n;

      var d = new Date(ms);
      if (isNaN(d.getTime())) { st.err(L('Out of range.', 'Giá trị ngoài phạm vi.')); return; }

      $('#tsOut').innerHTML = '<div class="kv">' +
        kv('ISO 8601 (UTC)', d.toISOString()) +
        kv(L('Local time', 'Giờ máy'), fmtLocal(d) + ' (UTC' + offLabel(-d.getTimezoneOffset()) + ')') +
        kv(L('Vietnam (UTC+7)', 'Việt Nam (UTC+7)'), fmtOffset(d, 420)) +
        kv('UTC', fmtOffset(d, 0)) +
        kv(L('Unix seconds', 'Unix giây'), Math.floor(ms / 1000)) +
        kv(L('Unix milliseconds', 'Unix milli giây'), ms) +
        kv(L('Day of week', 'Thứ'), d.toLocaleDateString(QAT.lang === 'vi' ? 'vi-VN' : 'en-GB', { weekday: 'long' })) +
        kv(L('Relative', 'Tương đối'), relative(ms)) +
        kv(L('RFC 2822', 'RFC 2822'), d.toUTCString()) +
        '</div>';
      st.ok(L('Converted (interpreted as ', 'Đã chuyển đổi (hiểu là ') +
        (unit === 'auto' ? L('auto-detected ', 'tự nhận ') + (Math.abs(ms - n) < 1 ? 'ms' : 's') : unit) + ').');
    }

    function offLabel(min) {
      var sign = min >= 0 ? '+' : '-';
      min = Math.abs(min);
      return sign + p2(Math.floor(min / 60)) + ':' + p2(min % 60);
    }

    function toTs() {
      var raw = $('#tsDate').value.trim();
      if (!raw) { st2.warn(L('Enter a date.', 'Hãy nhập ngày giờ.')); return; }
      var zone = $('#tsZone').value;
      var norm = raw.replace(/\//g, '-').replace(' ', 'T');
      var d;

      if (zone === 'local') {
        d = new Date(raw.indexOf('T') === -1 && raw.indexOf(' ') !== -1 ? norm : raw);
      } else {
        // parse the components as if they were in the chosen zone
        var m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(norm);
        if (!m) { st2.err(L('Use yyyy-MM-dd HH:mm:ss', 'Hãy dùng dạng yyyy-MM-dd HH:mm:ss')); return; }
        var utcMs = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
        d = new Date(utcMs - (zone === 'vn' ? 420 : 0) * 60000);
      }
      if (isNaN(d.getTime())) { st2.err(L('Could not parse that date.', 'Không đọc được ngày giờ này.')); return; }

      $('#tsOut2').innerHTML = '<div class="kv">' +
        kv(L('Unix seconds', 'Unix giây'), Math.floor(d.getTime() / 1000)) +
        kv(L('Unix milliseconds', 'Unix milli giây'), d.getTime()) +
        kv('ISO 8601 (UTC)', d.toISOString()) +
        kv(L('Vietnam (UTC+7)', 'Việt Nam (UTC+7)'), fmtOffset(d, 420)) +
        kv(L('Local time', 'Giờ máy'), fmtLocal(d)) +
        '</div>';
      st2.ok(L('Converted.', 'Đã chuyển đổi.'));
    }

    function kv(k, v) {
      return '<div class="k">' + k + '</div><div class="v">' + QAT.esc(v) +
        ' <button class="btn sec sm" data-cp="' + QAT.esc(v) + '" style="margin-left:6px;padding:1px 7px">copy</button></div>';
    }

    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cp]');
      if (b) QAT.copy(b.getAttribute('data-cp'));
    });

    $('#tsRun').addEventListener('click', toDate);
    $('#tsIn').addEventListener('keydown', function (e) { if (e.key === 'Enter') toDate(); });
    $('#tsRun2').addEventListener('click', toTs);
    $('#tsDate').addEventListener('keydown', function (e) { if (e.key === 'Enter') toTs(); });
    $('#tsUseNow').addEventListener('click', function () {
      $('#tsIn').value = String(Date.now());
      $('#tsUnit').value = 'ms';
      $('#tsDate').value = fmtLocal(new Date());
      toDate(); toTs();
    });
    $('#tsTick').addEventListener('change', function () {
      if (this.checked) timer = setInterval(nowPanel, 1000);
      else { clearInterval(timer); timer = null; }
    });

    nowPanel();
    timer = setInterval(nowPanel, 1000);
    // stop ticking when the view is replaced
    var obs = new MutationObserver(function () {
      if (!document.body.contains(root)) { clearInterval(timer); obs.disconnect(); }
    });
    obs.observe(document.getElementById('view'), { childList: true });
  }
});
