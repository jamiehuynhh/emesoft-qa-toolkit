/* =============================================================================
   Boot: restore preferences, wire the chrome, start the router.
   ========================================================================== */
(function () {
  'use strict';

  // ---- preferences -----------------------------------------------------
  var savedTheme = QAT.store.get('theme', null);
  if (!savedTheme && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    savedTheme = 'dark';
  }
  QAT.setTheme(savedTheme || 'light');

  QAT.lang = QAT.store.get('lang', 'en');
  var langSel = document.getElementById('langSelect');
  if (langSel) langSel.value = QAT.lang;
  QAT.applyStaticI18n();

  // The static footer has the team name in the markup as a fallback; take it
  // from QAT.TEAM so it can never drift from the one the landing footer renders.
  var footTeam = document.getElementById('footTeam');
  if (footTeam) footTeam.textContent = QAT.TEAM;

  // ---- chrome ----------------------------------------------------------
  document.getElementById('btnTheme').addEventListener('click', function () {
    QAT.setTheme(QAT.theme === 'dark' ? 'light' : 'dark');
  });

  langSel.addEventListener('change', function () { QAT.setLang(this.value); });

  document.getElementById('btnMenu').addEventListener('click', QAT.openSidebar);
  document.getElementById('sidebarClose').addEventListener('click', QAT.closeSidebar);
  document.getElementById('backdrop').addEventListener('click', QAT.closeSidebar);

  var sideSearch = document.getElementById('sideSearch');
  sideSearch.addEventListener('input', function () { QAT.renderSidebar(this.value); });

  var globalSearch = document.getElementById('globalSearch');
  globalSearch.addEventListener('input', function () {
    if (QAT.currentId() || QAT.isLanding()) { location.hash = '#/tools'; return; }
    QAT.renderDashboard(document.getElementById('view'));
  });
  globalSearch.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { this.value = ''; if (!QAT.isLanding()) QAT.renderDashboard(document.getElementById('view')); }
    if (e.key === 'Enter') {
      var hits = QAT.search(this.value);
      if (hits.length) location.hash = '#/t/' + hits[0].id;
    }
  });

  // ---- AI settings modal ----------------------------------------------
  var modal = document.getElementById('aiModal');
  var lastFocus = null;

  document.getElementById('btnAiSettings').addEventListener('click', function () {
    lastFocus = document.activeElement;
    QAT.ai.openSettings();
    // move focus into the dialog so keyboard and screen-reader users land there
    setTimeout(function () {
      var first = modal.querySelector('select, input, button');
      if (first) first.focus();
    }, 0);
  });
  document.getElementById('aiModalClose').addEventListener('click', closeModal);
  modal.addEventListener('click', function (e) {
    if (e.target === this) closeModal();
  });

  // Keep Tab inside the dialog while it is open — without this, tabbing walks
  // out into the page behind it, which is disorienting and fails WCAG 2.4.3.
  modal.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab' || modal.hidden) return;
    var focusable = QAT.$$('a[href], button:not([disabled]), input:not([disabled]), select, textarea', modal)
      .filter(function (n) { return n.offsetParent !== null; });
    if (!focusable.length) return;
    var first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  function closeModal() {
    modal.hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();   // return focus where it was
    lastFocus = null;
    // an AI tool page shows a "not configured" banner — refresh it after saving
    var id = QAT.currentId();
    if (id && QAT.byId[id] && QAT.byId[id].ai) QAT.route(true);
  }

  // ---- shortcuts -------------------------------------------------------
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      var box = window.innerWidth > 520 ? globalSearch : sideSearch;
      if (window.innerWidth <= 900) QAT.openSidebar();
      box.focus(); box.select();
    }
    if (e.key === 'Escape') {
      if (!document.getElementById('aiModal').hidden) closeModal();
      else QAT.closeSidebar();
    }
  });

  // ---- router ----------------------------------------------------------
  window.addEventListener('hashchange', function () { QAT.route(); });
  QAT.renderSidebar();
  QAT.route();

  // ---- is the bundled Node server there? -------------------------------
  // If it is and it already holds an API key, use it instead of asking the
  // user to paste one into the browser.
  QAT.ai.probe().then(function (srv) {
    var switched = QAT.ai.autoSelect();
    if (srv.available) {
      console.log('%cEmeSoft QA Toolkit', 'color:#D3222A;font-weight:bold',
        'Node server ' + srv.node + ' — AI proxy ' + (srv.aiConfigured ? 'ready' : 'no key set'));
    }
    // repaint an AI tool page so its banner reflects what we just learned
    var id = QAT.currentId();
    if ((switched || srv.available) && id && QAT.byId[id] && QAT.byId[id].ai) QAT.route(true);
  });

  console.log('%cEmeSoft QA Toolkit', 'color:#D3222A;font-weight:bold', 'v' + QAT.version +
    ' — ' + QAT.tools.length + ' tools loaded');
})();
