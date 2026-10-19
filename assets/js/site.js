/* Progressive enhancement only. The site works fully without JavaScript.
 * 1) Compact header menu (disclosure button on small screens).
 * 2) Document search: U.S. Constitution page filter, California Constitution search,
 *    and the combined search on /documents/ (loads small JSON indexes on first use).
 * 3) Contents / jump menus: open on wide screens, collapsed on phones.
 * 4) The Method checklist and the home-page progress card (localStorage only). */
(function () {
  'use strict';
  var root = document.documentElement;
  var narrow = window.matchMedia ? window.matchMedia('(max-width: 63.99rem)') : { matches: false, addEventListener: function () {} };
  var ES = root.lang === 'es';

  // ---------- 1) header menu ----------
  var btn = document.querySelector('.menu-btn'), menu = document.getElementById('site-menu');
  if (btn && menu) {
    btn.hidden = false;
    var setOpen = function (open) {
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      root.classList.toggle('menu-open', open);
    };
    btn.addEventListener('click', function () { setOpen(btn.getAttribute('aria-expanded') !== 'true'); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') { setOpen(false); btn.focus(); }
    });
    document.addEventListener('click', function (e) {
      if (btn.getAttribute('aria-expanded') === 'true' && !e.target.closest('.site-nav')) setOpen(false);
    });
    var onChange = function () { if (!narrow.matches) setOpen(false); };
    if (narrow.addEventListener) narrow.addEventListener('change', onChange);
  }

  // ---------- 3) contents / jump menus ----------
  Array.prototype.forEach.call(document.querySelectorAll('details.toc-jump'), function (d) {
    if (d.closest('.doc-aside')) { d.open = !narrow.matches; }
    d.addEventListener('click', function (e) {
      if (e.target.closest('a') && (narrow.matches || !d.closest('.doc-aside'))) d.open = false;
    });
  });

  // ---------- 2) search ----------
  function norm(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function debounce(fn, ms) { var t; return function () { var a = arguments; clearTimeout(t); t = setTimeout(function () { fn.apply(null, a); }, ms); }; }
  function esc(s) { return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // U.S. Constitution: filter [data-searchable] parts on this page
  var us = document.querySelector('.doc-search[data-scope="us"]');
  if (us) {
    us.hidden = false;
    var input = us.querySelector('input'), status = us.querySelector('[role="status"]');
    var parts = Array.prototype.slice.call(document.querySelectorAll('[data-searchable]'));
    var run = debounce(function () {
      var q = norm(input.value.trim()); var n = 0;
      parts.forEach(function (p) {
        var hit = !q || norm(p.textContent).indexOf(q) !== -1;
        p.classList.toggle('is-hidden', !hit); if (hit && q) n++;
      });
      status.textContent = q ? (n + (n === 1 ? ' part matches' : ' parts match') + ' “' + input.value.trim() + '”. Clear the box to show everything.') : '';
    }, 200);
    input.addEventListener('input', run);
  }

  // Index-based search (California Constitution, and both constitutions on /documents/)
  var meta = document.querySelector('meta[name="ca-search-index"]');
  Array.prototype.forEach.call(document.querySelectorAll('.doc-search[data-scope="ca"], .doc-search[data-scope="all"]'), function (box) {
    var urls = (box.getAttribute('data-index') || (meta && meta.content) || '').split(/\s+/).filter(Boolean);
    if (!urls.length || !window.fetch) return;
    box.hidden = false;
    var es = box.getAttribute('data-lang') === 'es';
    var M = es ? { loading: 'Cargando el índice de búsqueda…', fail: 'No se pudo cargar la búsqueda. Use la lista de abajo.', min: 'Escriba al menos 3 letras.', one: ' sección coincide', many: ' secciones coinciden', first: ' (se muestran las primeras 50).' }
               : { loading: 'Loading search index…', fail: 'Search could not load. Use the list below.', min: 'Type at least 3 letters.', one: ' section matches', many: ' sections match', first: ' (showing first 50).' };
    var cin = box.querySelector('input'), cstat = box.querySelector('[role="status"]'), out = box.querySelector('ol');
    var base = urls[0].replace(/assets\/data\/.*$/, '');
    var index = null, loading = false, pending = null;
    function ensure(cb) {
      if (index) return cb();
      pending = cb;
      if (loading) return; loading = true; cstat.textContent = M.loading;
      Promise.all(urls.map(function (u) { return fetch(u).then(function (r) { return r.json(); }); })).then(function (lists) {
        index = [].concat.apply([], lists);
        index.forEach(function (x) { x.n = norm(x.l + ' ' + x.c + ' ' + x.t); });
        if (pending) pending();
      }).catch(function () { cstat.textContent = M.fail; });
    }
    function label(x) {
      if (x.d === 'us') return 'U.S. Constitution, ' + esc(x.a) + (x.l ? ', ' + esc(x.l) : '');
      return 'Art. ' + esc(x.a) + ', ' + esc(x.l) + (x.c ? ': ' + esc(x.c) : '');
    }
    var crun = debounce(function () {
      var raw = cin.value.trim(), q = norm(raw);
      out.innerHTML = '';
      if (q.length < 3) { cstat.textContent = q ? M.min : ''; return; }
      ensure(function () {
        var q2 = norm(cin.value.trim()); if (q2.length < 3) return;
        out.innerHTML = '';
        var hits = index.filter(function (x) { return x.n.indexOf(q2) !== -1; });
        cstat.textContent = hits.length + (hits.length === 1 ? M.one : M.many) + (hits.length > 50 ? M.first : '.');
        hits.slice(0, 50).forEach(function (x) {
          var i = norm(x.t).indexOf(q2), snip = i >= 0 ? x.t.slice(Math.max(0, i - 60), i + q2.length + 80) : x.t.slice(0, 140);
          var li = document.createElement('li');
          li.innerHTML = '<a href="' + base + x.p + '">' + (x.d === 'us' ? '' : (urls.length > 1 ? 'California Constitution, ' : '')) + label(x) + '</a><span class="snip" lang="en">…' + esc(snip) + '…</span>';
          out.appendChild(li);
        });
      });
    }, 250);
    cin.addEventListener('input', crun);
  });
})();

/* 4) The Method checklist: saves ticks and notes in localStorage only (this browser, this device).
 *    No network requests, no cookies, no analytics. Works as plain checkboxes without JavaScript. */
(function () {
  'use strict';
  function getStore() { try { var t = '__wcg_test__'; window.localStorage.setItem(t, t); window.localStorage.removeItem(t); return window.localStorage; } catch (e) { return null; } }

  // Home page: progress card for The Method
  Array.prototype.forEach.call(document.querySelectorAll('[data-progress-key]'), function (el) {
    var store = getStore(); if (!store) return;
    var data = {}; try { data = JSON.parse(store.getItem(el.getAttribute('data-progress-key')) || '{}') || {}; } catch (e) { data = {}; }
    var total = +el.getAttribute('data-total'), es = el.getAttribute('data-lang') === 'es';
    var n = Object.keys(data).filter(function (k) { return data[k] === true; }).length;
    var pct = total ? Math.round(n / total * 100) : 0;
    el.querySelector('[data-meter]').style.width = pct + '%';
    el.querySelector('[data-progress-text]').textContent = n === 0
      ? (es ? 'Aún no ha empezado. Su avance aparecerá aquí.' : 'Not started yet. Your progress will show here.')
      : (es ? ('Su avance: ' + n + ' de ' + total + ' puntos marcados (' + pct + ' %).') : ('Your progress: ' + n + ' of ' + total + ' items ticked (' + pct + '%).'));
    el.hidden = false;
  });

  var box = document.querySelector('[data-checklist]');
  if (!box) return;
  var key = box.getAttribute('data-checklist');
  var es = box.getAttribute('data-lang') === 'es';
  var fields = Array.prototype.slice.call(box.querySelectorAll('[data-save]'));
  var checks = fields.filter(function (f) { return f.type === 'checkbox'; });
  var progress = box.querySelector('#m-progress');
  var meter = box.querySelector('[data-meter]');
  var saveStatus = box.querySelector('#m-save-status');
  var steps = Array.prototype.slice.call(box.querySelectorAll('[data-step]'));
  var store = getStore();

  function load() { if (!store) return {}; try { return JSON.parse(store.getItem(key) || '{}') || {}; } catch (e) { return {}; } }
  function save() {
    if (!store) return;
    var data = {};
    fields.forEach(function (f) { var id = f.getAttribute('data-save'); if (f.type === 'checkbox') { if (f.checked) data[id] = true; } else if (f.value) { data[id] = f.value; } });
    try { store.setItem(key, JSON.stringify(data)); if (saveStatus) saveStatus.textContent = ''; }
    catch (e) { if (saveStatus) saveStatus.textContent = es ? 'No se pudo guardar en este navegador.' : 'Could not save in this browser.'; }
  }
  function count() {
    var n = checks.filter(function (c) { return c.checked; }).length, total = checks.length;
    progress.textContent = es ? (n + ' de ' + total + ' puntos marcados.') : (n + ' of ' + total + ' items ticked.');
    if (meter) meter.style.width = (total ? Math.round(n / total * 100) : 0) + '%';
    steps.forEach(function (s) {
      var id = s.getAttribute('data-step');
      var cb = s.querySelectorAll('input[type=checkbox]'), k = 0;
      for (var i = 0; i < cb.length; i++) if (cb[i].checked) k++;
      var done = k === cb.length && cb.length > 0;
      s.classList.toggle('is-done', done);
      Array.prototype.forEach.call(box.querySelectorAll('[data-step-count="' + id + '"]'), function (c) {
        c.innerHTML = '<span aria-hidden="true">' + k + '/' + cb.length + (done ? ' ✓' : '') + '</span><span class="visually-hidden">' + (es ? (k + ' de ' + cb.length + ' marcados') : (k + ' of ' + cb.length + ' ticked')) + '</span>';
      });
      var link = box.querySelector('[data-step-link="' + id + '"]');
      if (link) link.classList.toggle('is-done', done);
    });
  }

  var data = load();
  fields.forEach(function (f) { var v = data[f.getAttribute('data-save')]; if (v === undefined) return; if (f.type === 'checkbox') f.checked = !!v; else f.value = String(v); });
  count();

  var nojs = box.querySelector('.cl-nojs'), jsn = box.querySelector('.cl-js'), actions = box.querySelector('.cl-actions');
  if (store) {
    if (nojs) nojs.hidden = true;
    if (jsn) jsn.hidden = false;
    if (actions) actions.hidden = false;
  } else if (nojs) {
    nojs.textContent = es ? 'Este navegador no permite guardar datos locales (por ejemplo, en modo privado). Puede marcar las casillas, pero no se guardarán.' : 'This browser does not allow local storage (for example, in private mode). You can tick the boxes, but they will not be saved.';
  }

  var timer;
  box.addEventListener('change', function (e) { if (e.target.hasAttribute('data-save')) { save(); count(); } });
  box.addEventListener('input', function (e) { if (e.target.hasAttribute('data-save') && e.target.type !== 'checkbox') { clearTimeout(timer); timer = setTimeout(save, 300); } });

  var clear = box.querySelector('[data-clear]');
  if (clear) clear.addEventListener('click', function () {
    var ok = window.confirm(es ? '¿Borrar todas sus marcas y notas de este navegador?' : 'Clear all your ticks and notes from this browser?');
    if (!ok) return;
    fields.forEach(function (f) { if (f.type === 'checkbox') f.checked = false; else f.value = ''; });
    if (store) { try { store.removeItem(key); } catch (e) { /* ignore */ } }
    count();
    if (saveStatus) saveStatus.textContent = es ? 'Lista borrada.' : 'Checklist cleared.';
    var first = checks[0]; if (first) first.focus();
  });
})();
