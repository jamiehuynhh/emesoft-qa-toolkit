QAT.register({
  id: 'case-converter',
  group: 'text',
  icon: 'Aa',
  name: { en: 'Case Converter', vi: 'Chuyển đổi kiểu chữ' },
  desc: {
    en: 'UPPER, lower, Title, camelCase, snake_case, kebab-case, CONSTANT_CASE and slug.',
    vi: 'CHỮ HOA, chữ thường, Title Case, camelCase, snake_case, kebab-case, CONSTANT_CASE và slug.'
  },
  tags: ['case', 'camel', 'snake', 'slug', 'naming'],

  build: function (root) {
    var L = QAT.L;
    var MODES = [
      ['upper', 'UPPER CASE', 'CHỮ HOA'],
      ['lower', 'lower case', 'chữ thường'],
      ['title', 'Title Case', 'Title Case'],
      ['sentence', 'Sentence case', 'Sentence case'],
      ['camel', 'camelCase', 'camelCase'],
      ['pascal', 'PascalCase', 'PascalCase'],
      ['snake', 'snake_case', 'snake_case'],
      ['constant', 'CONSTANT_CASE', 'CONSTANT_CASE'],
      ['kebab', 'kebab-case', 'kebab-case'],
      ['dot', 'dot.case', 'dot.case'],
      ['slug', 'url-slug (no diacritics)', 'url-slug (bỏ dấu)'],
      ['toggle', 'tOGGLE cASE', 'tOGGLE cASE']
    ];

    root.innerHTML = QAT.panel({
      title: L('Input', 'Dữ liệu vào'),
      body:
        '<textarea id="caIn" class="short" spellcheck="false" placeholder="' +
          L('Nguyen Van A — Test Case Name', 'Nguyen Van A — Tên test case') + '"></textarea>' +
        '<div class="row" style="margin-top:12px">' +
          '<label class="fld grow" style="max-width:260px">' + L('Target format', 'Định dạng đích') +
            '<select id="caMode">' + MODES.map(function (m) {
              return '<option value="' + m[0] + '">' + QAT.esc(L(m[1], m[2])) + '</option>';
            }).join('') + '</select></label>' +
          '<button class="btn" id="caRun">' + L('Convert', 'Chuyển đổi') + '</button>' +
          '<button class="btn sec" id="caAll">' + L('Show all formats', 'Xem tất cả định dạng') + '</button>' +
          '<label class="check" style="margin-left:auto"><input type="checkbox" id="caPerLine"> ' +
            L('Convert each line separately', 'Chuyển từng dòng riêng') + '</label>' +
        '</div>'
    }) + QAT.panel({
      title: L('Result', 'Kết quả'),
      actions: '<button class="btn sec sm" id="caCopy">' + L('Copy', 'Copy') + '</button>',
      body: '<div class="out" id="caOut" data-empty="' + L('Result appears here.', 'Kết quả hiện ở đây.') + '"></div>' +
            '<div id="caAllOut" style="margin-top:12px"></div>'
    });

    var $ = function (s) { return root.querySelector(s); };

    function wordsOf(s) {
      return String(s)
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_\-.]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter(Boolean);
    }
    function cap(w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); }

    function convert(s, mode) {
      var w = wordsOf(s);
      switch (mode) {
        case 'upper': return s.toUpperCase();
        case 'lower': return s.toLowerCase();
        case 'title': return w.map(cap).join(' ');
        case 'sentence': return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
        case 'camel': return w.map(function (x, i) { return i ? cap(x) : x.toLowerCase(); }).join('');
        case 'pascal': return w.map(cap).join('');
        case 'snake': return w.map(function (x) { return x.toLowerCase(); }).join('_');
        case 'constant': return w.map(function (x) { return x.toUpperCase(); }).join('_');
        case 'kebab': return w.map(function (x) { return x.toLowerCase(); }).join('-');
        case 'dot': return w.map(function (x) { return x.toLowerCase(); }).join('.');
        case 'slug': return QAT.faker.deaccent(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        case 'toggle': return Array.from(s).map(function (c) {
          return c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase();
        }).join('');
        default: return s;
      }
    }

    function apply(mode) {
      var src = $('#caIn').value;
      if (!src) { $('#caOut').textContent = ''; return; }
      var res = $('#caPerLine').checked
        ? src.replace(/\r\n?/g, '\n').split('\n').map(function (l) { return convert(l, mode); }).join('\n')
        : convert(src, mode);
      $('#caOut').textContent = res;
      $('#caAllOut').innerHTML = '';
    }

    $('#caRun').addEventListener('click', function () { apply($('#caMode').value); });
    $('#caMode').addEventListener('change', function () { apply(this.value); });
    $('#caIn').addEventListener('input', function () { apply($('#caMode').value); });
    $('#caCopy').addEventListener('click', function () { QAT.copy($('#caOut').textContent); });
    $('#caPerLine').addEventListener('change', function () { apply($('#caMode').value); });

    $('#caAll').addEventListener('click', function () {
      var src = $('#caIn').value;
      if (!src) { QAT.toast(L('Enter text first', 'Hãy nhập văn bản'), 'err'); return; }
      $('#caAllOut').innerHTML = '<div class="kv">' + MODES.map(function (m) {
        return '<div class="k">' + QAT.esc(L(m[1], m[2])) + '</div><div class="v">' +
          QAT.esc(convert(src, m[0])) + '</div>';
      }).join('') + '</div>';
    });
  }
});
