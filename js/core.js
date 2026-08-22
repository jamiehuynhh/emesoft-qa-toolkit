/* =============================================================================
   AI QA Toolkit — core runtime
   Registry + router + i18n + theme + DOM/format helpers.
   No dependencies, no build step. Everything runs in the browser.
   ========================================================================== */
(function () {
  'use strict';

  var QAT = window.QAT = {
    version: '1.0.0',
    tools: [],
    byId: {},
    lang: 'en',
    theme: 'light',
    GROUPS: [
      { id: 'text',      en: 'Text',            vi: 'Văn bản',      icon: 'T' },
      { id: 'data',      en: 'Data',            vi: 'Dữ liệu',      icon: '{}' },
      { id: 'security',  en: 'API & Security',  vi: 'API & Bảo mật', icon: '@' },
      { id: 'generator', en: 'Test Data',       vi: 'Tạo dữ liệu',  icon: '#' },
      { id: 'ai',        en: 'AI Assistant',    vi: 'Trợ lý AI',    icon: '*' }
    ]
  };

  /* ---------------------------------------------------------------- storage */
  var LS_PREFIX = 'qat.';
  QAT.store = {
    get: function (k, dflt) {
      try {
        var v = localStorage.getItem(LS_PREFIX + k);
        return v === null ? dflt : JSON.parse(v);
      } catch (e) { return dflt; }
    },
    set: function (k, v) {
      try { localStorage.setItem(LS_PREFIX + k, JSON.stringify(v)); } catch (e) {}
    },
    del: function (k) {
      try { localStorage.removeItem(LS_PREFIX + k); } catch (e) {}
    }
  };

  /* ------------------------------------------------------------- i18n basic */
  // Pick a string by current language. Used everywhere inside tools.
  QAT.L = function (en, vi) { return QAT.lang === 'vi' && vi != null ? vi : en; };

  QAT.t = function (key) {
    var dict = (window.QAT_I18N || {})[QAT.lang] || {};
    var fb = (window.QAT_I18N || {}).en || {};
    return dict[key] != null ? dict[key] : (fb[key] != null ? fb[key] : key);
  };

  QAT.applyStaticI18n = function () {
    document.querySelectorAll('[data-i18n]').forEach(function (n) {
      n.textContent = QAT.t(n.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (n) {
      n.setAttribute('placeholder', QAT.t(n.getAttribute('data-i18n-ph')));
    });
    document.documentElement.lang = QAT.lang;
  };

  /* ------------------------------------------------------------- registry */
  QAT.register = function (tool) {
    if (!tool || !tool.id) { console.warn('QAT.register: missing id', tool); return; }
    if (QAT.byId[tool.id]) { console.warn('QAT.register: duplicate id ' + tool.id); return; }
    tool.tags = tool.tags || [];
    QAT.tools.push(tool);
    QAT.byId[tool.id] = tool;
  };

  QAT.name = function (t) { return QAT.L(t.name.en, t.name.vi); };
  QAT.desc = function (t) { return QAT.L(t.desc.en, t.desc.vi); };
  QAT.groupMeta = function (id) {
    for (var i = 0; i < QAT.GROUPS.length; i++) if (QAT.GROUPS[i].id === id) return QAT.GROUPS[i];
    return { id: id, en: id, vi: id, icon: '-' };
  };
  QAT.groupName = function (id) { var g = QAT.groupMeta(id); return QAT.L(g.en, g.vi); };

  QAT.search = function (q) {
    q = (q || '').trim().toLowerCase();
    if (!q) return QAT.tools.slice();
    var terms = q.split(/\s+/);
    return QAT.tools.filter(function (t) {
      var hay = [t.id, t.name.en, t.name.vi, t.desc.en, t.desc.vi, t.tags.join(' '), t.group]
        .join(' ').toLowerCase();
      return terms.every(function (w) { return hay.indexOf(w) !== -1; });
    });
  };

  /* -------------------------------------------------------------- DOM utils */
  QAT.esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  QAT.$ = function (sel, root) { return (root || document).querySelector(sel); };
  QAT.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  QAT.on = function (root, sel, evt, fn) {
    QAT.$$(sel, root).forEach(function (n) { n.addEventListener(evt, fn); });
  };

  QAT.toast = function (msg, kind) {
    var host = document.getElementById('toastHost');
    if (!host) return;
    var d = document.createElement('div');
    d.className = 'toast' + (kind ? ' ' + kind : '');
    d.textContent = msg;
    host.appendChild(d);
    setTimeout(function () {
      d.style.transition = 'opacity .25s'; d.style.opacity = '0';
      setTimeout(function () { d.remove(); }, 260);
    }, 2200);
  };

  QAT.copy = function (text) {
    var done = function () { QAT.toast(QAT.t('msg.copied'), 'ok'); };
    if (!text) { QAT.toast(QAT.t('msg.nothing'), 'err'); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    } else { fallback(); }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { QAT.toast('Copy failed', 'err'); }
      ta.remove();
    }
  };

  QAT.download = function (filename, content, mime) {
    var bom = /\.csv$/i.test(filename) ? '﻿' : '';
    var blob = new Blob([bom + content], { type: (mime || 'text/plain') + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    QAT.toast(QAT.t('msg.downloaded') + ' ' + filename, 'ok');
  };

  /* ------------------------------------------------------- shared fragments */
  // Standard tool page header
  QAT.head = function (t) {
    return '<div class="tool-head">' +
      '<div class="card-ico">' + QAT.esc(t.icon) + '</div>' +
      '<div class="tool-head-txt"><h1>' + QAT.esc(QAT.name(t)) + '</h1>' +
      '<p>' + QAT.esc(QAT.desc(t)) + '</p></div>' +
      (t.ai ? '<span class="pill info">AI</span>' : '<span class="pill mut">' + QAT.t('badge.local') + '</span>') +
      '</div>';
  };

  QAT.panel = function (opts) {
    var head = '';
    if (opts.title || opts.actions) {
      head = '<div class="panel-head">' +
        (opts.title ? '<h4>' + opts.title + '</h4>' : '') +
        '<span class="spacer"></span>' + (opts.actions || '') + '</div>';
    }
    return '<div class="panel' + (opts.cls ? ' ' + opts.cls : '') + '"' +
      (opts.id ? ' id="' + opts.id + '"' : '') + '>' + head +
      '<div class="panel-body' + (opts.bodyCls ? ' ' + opts.bodyCls : '') + '">' + (opts.body || '') + '</div></div>';
  };

  // status line element helper: QAT.status(el).ok('...')
  QAT.status = function (node) {
    function set(cls, msg) {
      node.className = 'status ' + cls;
      node.textContent = msg;
    }
    return {
      ok: function (m) { set('ok', m); }, err: function (m) { set('err', m); },
      warn: function (m) { set('warn', m); }, info: function (m) { set('info', m); },
      hide: function () { node.className = 'status hidden'; node.textContent = ''; }
    };
  };

  /* --------------------------------------------------------- format helpers */
  QAT.bytes = function (n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(2) + ' KB';
    return (n / 1048576).toFixed(2) + ' MB';
  };

  QAT.byteLen = function (s) {
    try { return new TextEncoder().encode(s).length; } catch (e) { return s.length; }
  };

  QAT.pad = function (n, w) { n = String(n); while (n.length < (w || 2)) n = '0' + n; return n; };

  // Colorised JSON (input must already be valid JSON text)
  QAT.jsonHighlight = function (txt) {
    return QAT.esc(txt).replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
      function (m) {
        var cls = 'j-num';
        if (/^"/.test(m)) cls = /:$/.test(m) ? 'j-key' : 'j-str';
        else if (/true|false/.test(m)) cls = 'j-bool';
        else if (/null/.test(m)) cls = 'j-null';
        return '<span class="' + cls + '">' + m + '</span>';
      });
  };

  // Pull the first markdown table out of a block of text -> array of rows.
  // Used to turn an AI answer into a CSV the test management tool can import.
  QAT.mdTableToRows = function (text) {
    var lines = String(text || '').split('\n');
    var block = [], started = false;
    for (var i = 0; i < lines.length; i++) {
      var isRow = /^\s*\|/.test(lines[i]);
      if (isRow) { block.push(lines[i]); started = true; }
      else if (started) break;               // first table only
    }
    if (block.length < 2) return [];
    return block
      .filter(function (l) { return !/^\s*\|[\s:|-]+\|\s*$/.test(l); })
      .map(function (l) {
        return l.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|')
          .map(function (c) { return c.trim().replace(/<br\s*\/?>/gi, '\n'); });
      });
  };

  /* -------------------------------------------------- tiny markdown renderer */
  // Enough for AI output: headings, bold/italic, code, lists, tables, quotes.
  QAT.md = function (src) {
    var lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
    var out = [], i = 0;

    function inline(s) {
      s = QAT.esc(s);
      s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
      s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
      s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
      return s;
    }

    while (i < lines.length) {
      var ln = lines[i];

      if (/^```/.test(ln)) {                                    // fenced code
        var buf = [], lang = ln.replace(/^```/, '').trim();
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
        i++;
        out.push('<pre><code data-lang="' + QAT.esc(lang) + '">' + QAT.esc(buf.join('\n')) + '</code></pre>');
        continue;
      }
      if (/^\s*$/.test(ln)) { i++; continue; }                  // blank
      if (/^#{1,6}\s/.test(ln)) {                               // heading
        var lvl = ln.match(/^#+/)[0].length;
        out.push('<h' + Math.min(lvl, 3) + '>' + inline(ln.replace(/^#+\s*/, '')) + '</h' + Math.min(lvl, 3) + '>');
        i++; continue;
      }
      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(ln)) { out.push('<hr>'); i++; continue; }

      if (/^\s*\|/.test(ln) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|/.test(lines[i + 1])) {
        var rows = [];                                          // table
        while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(lines[i]); i++; }
        var cells = function (r) {
          return r.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(function (c) { return c.trim(); });
        };
        var head = cells(rows[0]), body = rows.slice(2).map(cells);
        var html = '<table><thead><tr>' + head.map(function (h) { return '<th>' + inline(h) + '</th>'; }).join('') +
          '</tr></thead><tbody>';
        body.forEach(function (r) {
          html += '<tr>' + head.map(function (_, k) { return '<td>' + inline(r[k] || '') + '</td>'; }).join('') + '</tr>';
        });
        out.push(html + '</tbody></table>');
        continue;
      }
      if (/^\s*>/.test(ln)) {                                   // blockquote
        var q = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) { q.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
        out.push('<blockquote>' + inline(q.join(' ')) + '</blockquote>');
        continue;
      }
      if (/^\s*([-*+]|\d+\.)\s/.test(ln)) {                     // list
        var ordered = /^\s*\d+\./.test(ln), items = [];
        while (i < lines.length && /^\s*([-*+]|\d+\.)\s/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, '')); i++;
        }
        out.push('<' + (ordered ? 'ol' : 'ul') + '>' +
          items.map(function (t) { return '<li>' + inline(t) + '</li>'; }).join('') +
          '</' + (ordered ? 'ol' : 'ul') + '>');
        continue;
      }
      var para = [];                                            // paragraph
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,6}\s|```|\s*\||\s*>|\s*([-*+]|\d+\.)\s)/.test(lines[i])) {
        para.push(lines[i]); i++;
      }
      out.push('<p>' + inline(para.join(' ')) + '</p>');
    }
    return out.join('\n');
  };

  /* ------------------------------------------------------------------ theme */
  QAT.setTheme = function (theme) {
    QAT.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    var ico = document.getElementById('themeIcon');
    if (ico) ico.innerHTML = theme === 'dark' ? '&#9788;' : '&#9789;';
    QAT.store.set('theme', theme);
  };

  QAT.setLang = function (lang) {
    QAT.lang = lang;
    QAT.store.set('lang', lang);
    var sel = document.getElementById('langSelect');
    if (sel) sel.value = lang;
    QAT.applyStaticI18n();
    QAT.renderSidebar();
    QAT.route(true);
  };

  /* ---------------------------------------------------------------- sidebar */
  QAT.renderSidebar = function (filter) {
    var nav = document.getElementById('sideNav');
    if (!nav) return;
    var list = QAT.search(filter || '');
    var cur = QAT.currentId();
    var html = '';
    QAT.GROUPS.forEach(function (g) {
      var items = list.filter(function (t) { return t.group === g.id; });
      if (!items.length) return;
      html += '<div class="nav-group"><span>' + QAT.esc(QAT.L(g.en, g.vi)) +
        '</span><span class="cnt">' + items.length + '</span></div>';
      items.forEach(function (t) {
        html += '<a class="nav-item' + (t.id === cur ? ' active' : '') + '" href="#/t/' + t.id + '">' +
          '<span class="ico">' + QAT.esc(t.icon) + '</span>' +
          '<span class="lbl">' + QAT.esc(QAT.name(t)) + '</span>' +
          (t.ai ? '<span class="ai-dot">AI</span>' : '') + '</a>';
      });
    });
    if (!html) html = '<div class="nav-empty">' + QAT.t('msg.noTool') + '</div>';
    nav.innerHTML = html;
  };

  /* ----------------------------------------------------------------- router */
  QAT.currentId = function () {
    var m = (location.hash || '').match(/^#\/t\/([\w-]+)/);
    return m ? m[1] : null;
  };

  // #/ is the landing page; the working dashboard lives at #/tools. A first
  // visitor needs to know what this is before being dropped into 24 tools.
  QAT.isLanding = function () {
    var h = location.hash || '';
    return h === '' || h === '#' || h === '#/' ;
  };

  function crumbs(t) {
    var c = document.getElementById('crumbs');
    if (!c) return;
    if (!t) {
      c.innerHTML = '<a href="#/">' + QAT.t('nav.home') + '</a>' +
        '<span class="sep">/</span><b>' + QAT.t('nav.dashboard') + '</b>';
    } else {
      c.innerHTML = '<a href="#/tools">' + QAT.t('nav.dashboard') + '</a>' +
        '<span class="sep">/</span><span>' + QAT.esc(QAT.groupName(t.group)) + '</span>' +
        '<span class="sep">/</span><b>' + QAT.esc(QAT.name(t)) + '</b>';
    }
  }

  QAT.route = function (keepScroll) {
    var view = document.getElementById('view');
    if (!view) return;
    var id = QAT.currentId();
    var tool = id ? QAT.byId[id] : null;
    var landing = QAT.isLanding();

    document.body.classList.toggle('is-landing', landing);

    if (landing) {
      document.title = 'EmeSoft QA Toolkit — ' + QAT.t('landing.metaTag');
      QAT.renderLanding(view);
      QAT.renderSidebar();
      if (!keepScroll) window.scrollTo(0, 0);
      closeSidebar();
      return;
    }

    if (id && !tool) {
      view.innerHTML = '<div class="no-result"><h3>404</h3><p>' + QAT.t('msg.noTool') +
        '</p><p style="margin-top:12px"><a href="#/tools">' + QAT.t('nav.dashboard') + '</a></p></div>';
      crumbs(null);
      return;
    }

    document.title = (tool ? QAT.name(tool) + ' — ' : '') + 'EmeSoft QA Toolkit';
    crumbs(tool);

    if (!tool) {
      QAT.renderDashboard(view);
    } else {
      view.innerHTML = QAT.head(tool);
      var host = document.createElement('div');
      view.appendChild(host);
      try {
        tool.build(host);
      } catch (e) {
        host.innerHTML = '<div class="status err">Tool error: ' + QAT.esc(e.message) + '</div>';
        console.error(e);
      }
    }
    QAT.renderSidebar(document.getElementById('sideSearch') ? document.getElementById('sideSearch').value : '');
    if (!keepScroll) window.scrollTo(0, 0);
    closeSidebar();
  };

  /* ---------------------------------------------------------------- landing */
  QAT.renderLanding = function (view) {
    var T = QAT.t;
    var aiCount = QAT.tools.filter(function (t) { return t.ai; }).length;
    var offline = QAT.tools.length - aiCount;

    function cats() {
      return QAT.GROUPS.map(function (g) {
        var n = QAT.tools.filter(function (t) { return t.group === g.id; }).length;
        if (!n) return '';
        return '<a class="lp-cat" href="#/tools"><b>' + QAT.esc(QAT.L(g.en, g.vi)) + '</b>' +
          '<span>' + QAT.esc(T('landing.cat.' + g.id)) + '</span>' +
          '<span class="n">' + n + ' ' + T('landing.toolsWord') + '</span></a>';
      }).join('');
    }

    function card(icon, titleKey, bodyKey) {
      return '<div class="lp-card"><div class="ico">' + icon + '</div>' +
        '<h3>' + T(titleKey) + '</h3><p>' + T(bodyKey) + '</p></div>';
    }

    function tick(label, body) {
      return '<li><span class="tick">&#10003;</span><span><b>' + label + '</b> — ' + body + '</span></li>';
    }

    view.innerHTML =
      '<nav class="lp-nav"><div class="lp-nav-in">' +
        '<img src="assets/img/emesoft-logo.png" alt="EmeSoft" width="164" height="34">' +
        '<span class="lp-nav-sep"></span>' +
        '<span class="lp-nav-name">QA Toolkit</span>' +
        '<span class="lp-nav-links">' +
          '<a href="#/tools">' + T('landing.nav.tools') + '</a>' +
          '<a href="#landing-how">' + T('landing.nav.how') + '</a>' +
          '<a href="https://www.emesoft.net/" target="_blank" rel="noopener noreferrer">emesoft.net</a>' +
        '</span>' +
      '</div></nav>' +

      '<header class="lp-hero"><div class="lp-hero-in">' +
        '<span class="lp-eyebrow">' + T('landing.eyebrow') + '</span>' +
        '<h1>' + T('landing.h1a') + ' <em>' + T('landing.h1b') + '</em></h1>' +
        '<p class="lp-sub">' + T('landing.sub') + '</p>' +
        '<div class="lp-cta">' +
          '<a class="lp-btn primary" href="#/tools">' + T('landing.ctaPrimary') + ' &rarr;</a>' +
          '<a class="lp-btn ghost" href="#landing-how">' + T('landing.ctaSecondary') + '</a>' +
        '</div>' +
        '<p class="lp-hero-note">' + T('landing.heroNote') + '</p>' +
      '</div></header>' +

      '<div class="lp-metrics">' +
        '<div class="lp-metric"><b>' + QAT.tools.length + '</b><span>' + T('hero.tools') + '</span></div>' +
        '<div class="lp-metric"><b>' + offline + '</b><span>' + T('landing.metric.offline') + '</span></div>' +
        '<div class="lp-metric"><b>' + aiCount + '</b><span>' + T('hero.ai') + '</span></div>' +
        '<div class="lp-metric"><b>0</b><span>' + T('landing.metric.deps') + '</span></div>' +
      '</div>' +

      '<section class="lp-section"><div class="lp-head">' +
        '<div class="kicker">' + T('landing.why.kicker') + '</div>' +
        '<h2>' + T('landing.why.title') + '</h2>' +
        '<p>' + T('landing.why.body') + '</p>' +
      '</div><div class="lp-grid">' +
        card('&#9737;', 'landing.f1.t', 'landing.f1.b') +
        card('&#8987;', 'landing.f2.t', 'landing.f2.b') +
        card('AC', 'landing.f3.t', 'landing.f3.b') +
        card('&#9635;', 'landing.f4.t', 'landing.f4.b') +
      '</div></section>' +

      '<div class="lp-band"><section class="lp-section" id="landing-how">' +
        '<div class="lp-split">' +
          '<div><div class="lp-head" style="margin-bottom:22px">' +
            '<div class="kicker">' + T('landing.how.kicker') + '</div>' +
            '<h2>' + T('landing.how.title') + '</h2>' +
            '<p>' + T('landing.how.body') + '</p>' +
          '</div></div>' +
          '<ul class="lp-list">' +
            tick(T('landing.h1.t'), T('landing.h1.b')) +
            tick(T('landing.h2.t'), T('landing.h2.b')) +
            tick(T('landing.h3.t'), T('landing.h3.b')) +
            tick(T('landing.h4.t'), T('landing.h4.b')) +
          '</ul>' +
        '</div>' +
      '</section></div>' +

      '<section class="lp-section"><div class="lp-head">' +
        '<div class="kicker">' + T('landing.cats.kicker') + '</div>' +
        '<h2>' + T('landing.cats.title') + '</h2>' +
      '</div><div class="lp-cats">' + cats() + '</div></section>' +

      '<section class="lp-final">' +
        '<h2>' + T('landing.final.title') + '</h2>' +
        '<p>' + T('landing.final.body') + '</p>' +
        '<div class="lp-cta"><a class="lp-btn primary" href="#/tools">' +
          T('landing.ctaPrimary') + ' &rarr;</a></div>' +
      '</section>' +

      '<footer class="lp-foot"><div class="lp-foot-in">' +
        '<img src="assets/img/emesoft-logo-white.png" alt="EmeSoft">' +
        '<span>' + T('landing.foot') + '</span>' +
        '<span class="spacer"></span>' +
        '<a href="https://www.emesoft.net/" target="_blank" rel="noopener noreferrer">emesoft.net</a>' +
      '</div></footer>';

    // in-page anchor without fighting the hash router
    QAT.$$('a[href^="#landing-"]', view).forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var el = document.getElementById(this.getAttribute('href').slice(1));
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  };

  /* -------------------------------------------------------------- dashboard */
  var dashFilter = 'all';

  QAT.renderDashboard = function (view) {
    var q = (document.getElementById('globalSearch') || {}).value || '';
    var list = QAT.search(q);
    var aiCount = QAT.tools.filter(function (t) { return t.ai; }).length;

    // The landing page carries the pitch now, so the working view gets a compact
    // header instead of a second hero the user has to scroll past every time.
    var html = '<div class="dash-head">' +
      '<div><h1>' + QAT.t('nav.dashboard') + '</h1>' +
      '<p>' + QAT.t('dash.sub') + '</p></div>' +
      '<div class="dash-counts">' +
        '<span><b>' + QAT.tools.length + '</b> ' + QAT.t('hero.tools') + '</span>' +
        '<span><b>' + (QAT.tools.length - aiCount) + '</b> ' + QAT.t('landing.metric.offline') + '</span>' +
        '<span><b>' + aiCount + '</b> ' + QAT.t('hero.ai') + '</span>' +
      '</div></div>';

    html += '<div class="filters">' +
      '<button class="chip' + (dashFilter === 'all' ? ' active' : '') + '" data-f="all">' +
      QAT.t('filter.all') + ' <span class="n">' + QAT.tools.length + '</span></button>';
    QAT.GROUPS.forEach(function (g) {
      var n = QAT.tools.filter(function (t) { return t.group === g.id; }).length;
      if (!n) return;
      html += '<button class="chip' + (dashFilter === g.id ? ' active' : '') + '" data-f="' + g.id + '">' +
        QAT.esc(QAT.L(g.en, g.vi)) + ' <span class="n">' + n + '</span></button>';
    });
    html += '</div><div id="dashBody"></div>';

    view.innerHTML = html;

    QAT.on(view, '.chip', 'click', function () {
      dashFilter = this.getAttribute('data-f');
      QAT.renderDashboard(view);
    });

    renderCards(view.querySelector('#dashBody'), list);
  };

  function card(t) {
    return '<a class="card" href="#/t/' + t.id + '">' +
      (t.ai ? '<span class="badge-ai">AI</span>' : '') +
      '<div class="card-top"><div class="card-ico">' + QAT.esc(t.icon) + '</div>' +
      '<h3>' + QAT.esc(QAT.name(t)) + '</h3></div>' +
      '<p>' + QAT.esc(QAT.desc(t)) + '</p>' +
      '<div class="card-tags">' + t.tags.slice(0, 4).map(function (x) {
        return '<span class="tag">' + QAT.esc(x) + '</span>';
      }).join('') + '</div></a>';
  }

  function renderCards(host, list) {
    if (!host) return;
    if (dashFilter !== 'all') list = list.filter(function (t) { return t.group === dashFilter; });
    if (!list.length) {
      host.innerHTML = '<div class="no-result"><h3>' + QAT.t('msg.noToolTitle') + '</h3><p>' +
        QAT.t('msg.noTool') + '</p></div>';
      return;
    }
    var html = '';
    if (dashFilter === 'all') {
      QAT.GROUPS.forEach(function (g) {
        var items = list.filter(function (t) { return t.group === g.id; });
        if (!items.length) return;
        html += '<div class="section-title">' + QAT.esc(QAT.L(g.en, g.vi)) + '</div>' +
          '<div class="grid">' + items.map(card).join('') + '</div>';
      });
    } else {
      html = '<div class="grid">' + list.map(card).join('') + '</div>';
    }
    host.innerHTML = html;
  }

  /* ------------------------------------------------------------- sidebar UI */
  function openSidebar() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('backdrop').classList.add('on');
  }
  function closeSidebar() {
    var s = document.getElementById('sidebar'), b = document.getElementById('backdrop');
    if (s) s.classList.remove('open');
    if (b) b.classList.remove('on');
  }
  QAT.openSidebar = openSidebar;
  QAT.closeSidebar = closeSidebar;

})();
