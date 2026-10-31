/* 0) Navigation layer (UX rebuild, Oct 23, 2026). Progressive enhancement; every feature degrades to plain links.
 *  - Sticky header that slides away while you scroll down and comes back when you scroll up.
 *  - Lesson pages: lesson-list drawer on phones, reading bar, "On this page" highlighting,
 *    and course progress saved in localStorage (this browser only; nothing is sent anywhere).
 *  - Site search: a dialog (header button or "/") and the /search/ page, both reading a JSON index built at build time.
 *  - Back-to-top button. */
(function () {
  'use strict';
  var root = document.documentElement, doc = document;
  var ES = root.lang === 'es';
  var mq = function (q) { return window.matchMedia ? window.matchMedia(q) : { matches: false, addEventListener: null }; };
  var narrow = mq('(max-width: 63.99rem)');
  var reduce = mq('(prefers-reduced-motion: reduce)');
  var $ = function (s, el) { return (el || doc).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || doc).querySelectorAll(s)); };
  function store() { try { var t = '__wcg__'; localStorage.setItem(t, t); localStorage.removeItem(t); return localStorage; } catch (e) { return null; } }
  var LS = store();

  // ---------- sticky header ----------
  var header = $('.site-header'), bar = $('.lesson-bar'), toTop = $('.to-top');
  function measure() {
    if (header) root.style.setProperty('--hdr-h', header.offsetHeight + 'px');
    root.style.setProperty('--bar-h', (bar && bar.offsetParent !== null && getComputedStyle(bar).position === 'sticky') ? bar.offsetHeight + 'px' : '0px');
  }
  measure();
  window.addEventListener('resize', measure);
  if (window.ResizeObserver && header) new ResizeObserver(measure).observe(header);
  var lastY = window.pageYOffset, ticking = false;
  function onScroll() {
    var y = window.pageYOffset, h = header ? header.offsetHeight : 0;
    var busy = root.classList.contains('menu-open') || (header && header.contains(doc.activeElement) && doc.activeElement !== doc.body);
    if (y < h * 2 || busy) root.classList.remove('hdr-hidden');
    else if (y > lastY + 8) root.classList.add('hdr-hidden');
    else if (y < lastY - 8) root.classList.remove('hdr-hidden');
    if (Math.abs(y - lastY) > 8) lastY = y;
    if (toTop) toTop.classList.toggle('is-shown', y > window.innerHeight * 1.5);
    readBar(); spy();
    ticking = false;
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  if (header) header.addEventListener('focusin', function () { root.classList.remove('hdr-hidden'); });
  if (toTop) {
    toTop.hidden = false;
    toTop.addEventListener('click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: reduce.matches ? 'auto' : 'smooth' });
      var m = doc.getElementById('main'); if (m) m.focus({ preventScroll: true });
    });
  }

  // ---------- reading bar + "On this page" highlighting ----------
  var readFill = $('.lb-read span'), prose = $('.lesson-body .prose') || $('.prose');
  function readBar() {
    if (!readFill || !prose) return;
    var r = prose.getBoundingClientRect(), total = r.height - window.innerHeight * 0.6;
    var pct = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 1;
    readFill.style.width = Math.round(pct * 100) + '%';
  }
  var spyLinks = $$('.onpage-rail a[href^="#"], .onpage a[href^="#"]').filter(function (a) { return a.getAttribute('href').length > 1 && a.getAttribute('href') !== '#main'; });
  var spyTargets = [];
  spyLinks.forEach(function (a) { var t = doc.getElementById(decodeURIComponent(a.getAttribute('href').slice(1))); if (t && spyTargets.indexOf(t) < 0) spyTargets.push(t); });
  var activeId = null;
  function spy() {
    if (!spyTargets.length) return;
    var line = (header ? header.offsetHeight : 0) + (bar ? bar.offsetHeight : 0) + 40, cur = null;
    for (var i = 0; i < spyTargets.length; i++) { if (spyTargets[i].getBoundingClientRect().top <= line) cur = spyTargets[i]; else break; }
    var id = cur ? cur.id : null;
    if (id === activeId) return; activeId = id;
    spyLinks.forEach(function (a) {
      var on = id && a.getAttribute('href') === '#' + id;
      a.classList.toggle('is-active', !!on);
      if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
    });
  }
  $$('details.onpage').forEach(function (d) { d.addEventListener('click', function (e) { if (e.target.closest('a')) d.open = false; }); });
  onScroll();

  // ---------- lesson drawer (phones) ----------
  var side = $('#lesson-side'), tog = $('.lb-toggle'), closeBtn = $('.ls-close'), backdrop = null;
  function setInert(on) {
    $$('.banner, .site-header, .lesson-body, .site-footer, .to-top, .skip-link').forEach(function (el) {
      if (on) { el.setAttribute('inert', ''); el.setAttribute('aria-hidden', 'true'); } else { el.removeAttribute('inert'); el.removeAttribute('aria-hidden'); }
    });
  }
  function drawer(open, restore) {
    if (!side || !tog) return;
    root.classList.toggle('lesson-open', open);
    tog.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      backdrop = doc.createElement('div'); backdrop.className = 'drawer-backdrop';
      backdrop.addEventListener('click', function () { drawer(false, true); });
      doc.body.appendChild(backdrop);
      side.setAttribute('role', 'dialog'); side.setAttribute('aria-modal', 'true');
      setInert(true);
      var cur = $('a[aria-current="page"]', side);
      if (cur) cur.scrollIntoView({ block: 'center' });
      (closeBtn || cur || side).focus();
    } else {
      if (backdrop) { backdrop.remove(); backdrop = null; }
      side.removeAttribute('role'); side.removeAttribute('aria-modal');
      setInert(false);
      if (restore) tog.focus();
    }
  }
  if (side && tog) {
    var syncDrawer = function () {
      tog.hidden = !narrow.matches;
      if (closeBtn) closeBtn.hidden = !narrow.matches;
      if (!narrow.matches && root.classList.contains('lesson-open')) drawer(false, false);
      measure();
    };
    syncDrawer();
    if (narrow.addEventListener) narrow.addEventListener('change', syncDrawer);
    tog.addEventListener('click', function () { drawer(tog.getAttribute('aria-expanded') !== 'true', true); });
    if (closeBtn) closeBtn.addEventListener('click', function () { drawer(false, true); });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root.classList.contains('lesson-open')) { e.preventDefault(); drawer(false, true); }
      if (e.key === 'Tab' && root.classList.contains('lesson-open')) { // keep focus inside the drawer
        var f = $$('a[href], button:not([hidden])', side).filter(function (x) { return x.offsetParent !== null; });
        if (!f.length) return;
        if (e.shiftKey && doc.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && doc.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
  }

  // ---------- course progress (localStorage) ----------
  var courseEls = $$('[data-course]');
  var course = courseEls.length ? courseEls[0].getAttribute('data-course') : null;
  if (course && LS) {
    var KEY = 'wcg-course-' + course + (ES ? '-es' : '');
    var load = function () { try { var d = JSON.parse(LS.getItem(KEY) || '{}') || {}; d.v = d.v || {}; d.d = d.d || {}; return d; } catch (e) { return { v: {}, d: {} }; } };
    var saveP = function (d) { try { LS.setItem(KEY, JSON.stringify(d)); } catch (e) { /* storage full or blocked */ } };
    var P = load();
    var doneBtn = $('[data-done]');
    if (doneBtn) { P.v[doneBtn.getAttribute('data-done')] = 1; saveP(P); }
    var paint = function () {
      $$('[data-state-for]').forEach(function (s) {
        var p = s.getAttribute('data-state-for'), a = s.closest('a'), d = !!P.d[p], v = !!P.v[p];
        if (a) { a.classList.toggle('is-done', d); a.classList.toggle('is-visited', v); }
        s.innerHTML = d ? '<span class="visually-hidden">' + (ES ? '(terminada)' : '(done)') + '</span>' : (v ? '<span class="visually-hidden">' + (ES ? '(abierta)' : '(opened)') + '</span>' : '');
      });
      $$('[data-course-progress]').forEach(function (m) {
        var total = +m.getAttribute('data-total') || 0;
        var paths = $$('[data-lesson]', m.closest('[data-course]') || doc).map(function (a) { return a.getAttribute('data-lesson'); });
        var n = paths.filter(function (p, i) { return paths.indexOf(p) === i && P.d[p]; }).length;
        if (n > total) n = total;
        var pct = total ? Math.round(n / total * 100) : 0;
        var fill = $('[data-meter]', m); if (fill) fill.style.width = pct + '%';
        var t = $('[data-progress-text]', m);
        if (t) t.textContent = ES ? (n + ' de ' + total + ' lecciones terminadas') : (n + ' of ' + total + ' lessons done');
        m.hidden = false;
      });
      if (doneBtn) doneBtn.setAttribute('aria-pressed', P.d[doneBtn.getAttribute('data-done')] ? 'true' : 'false');
    };
    if (doneBtn) {
      doneBtn.hidden = false;
      doneBtn.addEventListener('click', function () {
        var p = doneBtn.getAttribute('data-done');
        if (P.d[p]) delete P.d[p]; else P.d[p] = 1;
        saveP(P); paint();
      });
    }
    paint();
  }

  // ---------- site search ----------
  var M = ES
    ? { ph: 'Buscar en el sitio', loading: 'Cargando…', fail: 'No se pudo cargar la búsqueda.', none: 'Sin resultados para', one: '1 resultado', many: ' resultados', type: 'Escriba al menos 2 letras.', close: 'Cerrar', all: 'Ver todos los resultados', label: 'Buscar en todo el sitio', kinds: { course: 'Lección', text: 'Texto', agenda: 'Agenda', term: 'Glosario', page: 'Página' } }
    : { ph: 'Search the site', loading: 'Loading…', fail: 'Search could not load.', none: 'No results for', one: '1 result', many: ' results', type: 'Type at least 2 letters.', close: 'Close', all: 'See all results', label: 'Search the whole site', kinds: { course: 'Lesson', text: 'Full text', agenda: 'Agenda', term: 'Glossary', page: 'Page' } };
  function norm(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function escH(s) { return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var base = root.getAttribute('data-base') || '/', idxURL = root.getAttribute('data-search'), searchPage = root.getAttribute('data-search-page');
  var INDEX = null, loadingP = null;
  function getIndex() {
    if (INDEX) return Promise.resolve(INDEX);
    if (!loadingP) loadingP = fetch(idxURL).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (list) {
      list.forEach(function (e) { e.nt = norm(e.t); e.ns = norm(e.s); e.nx = norm(e.x); });
      return (INDEX = list);
    });
    return loadingP;
  }
  var KW = { course: 3, term: 2, page: 1, agenda: 0, text: 0 };
  function search(q) {
    var nq = norm(q.trim()), toks = nq.split(/[^a-z0-9ñ$%.'-]+/).filter(function (t) { return t.length > 1 || /\d/.test(t); });
    if (!toks.length) return [];
    var out = [];
    INDEX.forEach(function (e) {
      var sc = 0;
      for (var i = 0; i < toks.length; i++) {
        var t = toks[i], a = e.nt.indexOf(t) >= 0, b = e.ns.indexOf(t) >= 0, c = e.nx.indexOf(t) >= 0;
        if (!a && !b && !c) return;
        sc += (a ? 8 : 0) + (b ? 6 : 0) + (c ? 1 : 0) + (new RegExp('(^|[^a-z0-9])' + t.replace(/[.$'-]/g, '\\$&')).test(e.ns + ' ' + e.nx) ? 1 : 0);
      }
      if (toks.length > 1 && (e.ns + ' ' + e.nx + ' ' + e.nt).indexOf(nq) >= 0) sc += 6;
      if (!e.s) sc += 1;
      out.push({ e: e, sc: sc + (KW[e.k] || 0) });
    });
    out.sort(function (a, b) { return b.sc - a.sc; });
    return out.map(function (o) { return o.e; });
  }
  function hl(str, toks) {
    var n = norm(str);
    if (n.length !== str.length) return escH(str);
    var r = [];
    toks.forEach(function (t) { var i = 0; while ((i = n.indexOf(t, i)) >= 0) { r.push([i, i + t.length]); i += t.length; } });
    if (!r.length) return escH(str);
    r.sort(function (a, b) { return a[0] - b[0]; });
    var html = '', pos = 0;
    r.forEach(function (x) { if (x[0] < pos) return; html += escH(str.slice(pos, x[0])) + '<mark>' + escH(str.slice(x[0], x[1])) + '</mark>'; pos = x[1]; });
    return html + escH(str.slice(pos));
  }
  function snippet(e, toks) {
    var x = e.x || '', i = -1;
    for (var k = 0; k < toks.length && i < 0; k++) i = e.nx.indexOf(toks[k]);
    if (i < 0) return hl(x.slice(0, 150), toks) + (x.length > 150 ? '…' : '');
    var s = Math.max(0, i - 60), en = Math.min(x.length, i + 110);
    return (s > 0 ? '…' : '') + hl(x.slice(s, en), toks) + (en < x.length ? '…' : '');
  }
  function render(list, q, ol, status, limit) {
    var toks = norm(q.trim()).split(/[^a-z0-9ñ$%.'-]+/).filter(function (t) { return t.length > 1 || /\d/.test(t); });
    ol.innerHTML = '';
    if (!toks.length) { status.textContent = q.trim() ? M.type : ''; return; }
    var seen = {}, hits = search(q).filter(function (e) { var pg = e.p.split('#')[0]; seen[pg] = (seen[pg] || 0) + 1; return seen[pg] <= (limit > 20 ? 4 : 2); });
    status.textContent = hits.length ? (hits.length === 1 ? M.one : hits.length + M.many) : (M.none + ' “' + q.trim() + '”.');
    hits.slice(0, limit).forEach(function (e) {
      var li = doc.createElement('li');
      li.innerHTML = '<a href="' + escH(base + e.p) + '"><span class="sr-k">' + (M.kinds[e.k] || '') + '</span><span class="sr-t">' + hl(e.t, toks) + '</span>' +
        (e.s ? '<span class="sr-s">' + hl(e.s, toks) + '</span>' : '') + '<span class="sr-x">' + snippet(e, toks) + '</span></a>';
      ol.appendChild(li);
    });
    return hits.length;
  }
  function wire(input, ol, status, limit, onRun) {
    var t;
    var run = function () {
      var q = input.value;
      getIndex().then(function () { var n = render(INDEX, q, ol, status, limit); if (onRun) onRun(q, n); })
        .catch(function () { status.textContent = M.fail; });
    };
    input.addEventListener('input', function () { clearTimeout(t); t = setTimeout(run, 120); });
    input.addEventListener('keydown', function (e) {
      var first = $('a', ol);
      if (e.key === 'ArrowDown' && first) { e.preventDefault(); first.focus(); }
      if (e.key === 'Enter' && first && input.value.trim()) { e.preventDefault(); clearTimeout(t); first.click(); }
    });
    ol.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      var links = $$('a', ol), i = links.indexOf(doc.activeElement); if (i < 0) return;
      e.preventDefault();
      if (e.key === 'ArrowDown' && links[i + 1]) links[i + 1].focus();
      else if (e.key === 'ArrowUp') (i > 0 ? links[i - 1] : input).focus();
    });
    return run;
  }
  // search page
  var sp = $('[data-site-search]');
  if (sp && idxURL && window.fetch) {
    var spOl = $('#sp-results'), spSt = $('#sp-status');
    var runSP = wire(sp, spOl, spSt, 100, function (q) {
      try { history.replaceState(null, '', location.pathname + (q.trim() ? '?q=' + encodeURIComponent(q.trim()) : '')); } catch (e) { /* ignore */ }
    });
    sp.closest('form').addEventListener('submit', function (e) { e.preventDefault(); runSP(); });
    var q0 = new URLSearchParams(location.search).get('q');
    if (q0) { sp.value = q0; runSP(); }
    sp.focus();
  }
  // documents page: ?q= prefills the combined constitution search
  var qa = doc.getElementById('q-all'), qp = window.URLSearchParams ? new URLSearchParams(location.search).get('q') : null;
  if (qa && qp) { qa.value = qp; setTimeout(function () { qa.dispatchEvent(new Event('input', { bubbles: true })); }, 0); }
  // dialog
  var sBtn = $('.search-btn');
  if (sBtn && idxURL && window.fetch && window.HTMLDialogElement && !sp) {
    var dlg = doc.createElement('dialog');
    dlg.className = 'search-dialog';
    dlg.setAttribute('aria-label', M.label);
    dlg.innerHTML = '<div class="sd-head"><form role="search" method="dialog"><label for="sd-q" class="visually-hidden">' + M.label + '</label><div class="search-field">' + (sBtn.querySelector('svg') ? sBtn.querySelector('svg').outerHTML : '') +
      '<input id="sd-q" type="search" autocomplete="off" enterkeyhint="search" placeholder="' + M.ph + '"></div></form><button type="button" class="sd-close">' + M.close + '</button></div>' +
      '<div class="sd-body"><p class="sd-status small" role="status" aria-live="polite"></p><ol class="sr-list" id="sd-results"></ol><p class="sr-more" hidden><a href="#">' + M.all + ' →</a></p></div>';
    doc.body.appendChild(dlg);
    var dIn = $('#sd-q', dlg), dOl = $('#sd-results', dlg), dSt = $('.sd-status', dlg), more = $('.sr-more', dlg);
    wire(dIn, dOl, dSt, 12, function (q, n) {
      more.hidden = !(n > 12);
      $('a', more).href = searchPage + '?q=' + encodeURIComponent(q.trim());
    });
    $('form', dlg).addEventListener('submit', function (e) { e.preventDefault(); });
    var openDlg = function () {
      if (dlg.open) return;
      if (root.classList.contains('menu-open')) { var mb = $('.menu-btn'); if (mb) mb.click(); }
      dlg.showModal(); dIn.focus(); dIn.select(); getIndex().catch(function () {});
    };
    sBtn.addEventListener('click', function (e) { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); openDlg(); });
    $('.sd-close', dlg).addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', function () { sBtn.focus(); });
    doc.addEventListener('keydown', function (e) {
      var tag = (e.target.tagName || '').toLowerCase();
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && tag !== 'input' && tag !== 'textarea' && tag !== 'select' && !e.target.isContentEditable) { e.preventDefault(); openDlg(); }
    });
  }
})();

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
      if (btn.getAttribute('aria-expanded') === 'true' && !e.target.closest('.site-nav, .menu-btn')) setOpen(false);
    });
    menu.addEventListener('click', function (e) { if (e.target.closest('a') && narrow.matches) setOpen(false); });
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
  // Collapsed "Go deeper" panel: open it for returning visitors with saved ticks, or when a link points inside it.
  var deeper = box.closest ? box.closest('[data-deeper]') : null;
  function openFor(hash) {
    if (!deeper || deeper.open || !hash || hash.length < 2) return;
    var t = null; try { t = document.getElementById(decodeURIComponent(hash.slice(1))); } catch (e) { t = null; }
    if (t && deeper.contains(t)) { deeper.open = true; t.scrollIntoView(); }
  }
  if (deeper && Object.keys(data).length) deeper.open = true;
  openFor(location.hash);
  window.addEventListener('hashchange', function () { openFor(location.hash); });
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

// ---------- "Continue learning" card (home, hidden until there is progress) and "Your progress" (Learn tab) ----------
// Reads the same browser-only stores as the lessons (wcg-course-constitutions[-es]) and the Method checklist
// (wcg-method-v1). Nothing leaves the browser. See UPDATING.md §17.
(function () {
  var cards = document.querySelectorAll('[data-continue]');
  if (!cards.length) return;
  var store = null; try { store = window.localStorage; store.getItem('x'); } catch (e) { store = null; }
  var read = function (k) { if (!store) return {}; try { return JSON.parse(store.getItem(k) || '{}') || {}; } catch (e) { return {}; } };
  var a = read('wcg-course-constitutions'), b = read('wcg-course-constitutions-es');
  var D = {}, V = {};
  [a, b].forEach(function (p) { var k; for (k in (p.d || {})) D[k] = 1; for (k in (p.v || {})) V[k] = 1; });
  var M = read('wcg-method-v1'), ticks = Object.keys(M).filter(function (k) { return M[k] === true; }).length;
  var base = document.documentElement.getAttribute('data-base') || '/';
  Array.prototype.forEach.call(cards, function (el) {
    var es = el.getAttribute('data-lang') === 'es', home = el.getAttribute('data-continue') === 'home', strip = el.getAttribute('data-continue') === 'strip';
    var L = []; try { L = JSON.parse(el.querySelector('[data-cl-lessons]').textContent) || []; } catch (e) { L = []; }
    var total = L.length || +el.getAttribute('data-total') || 0, mt = +el.getAttribute('data-method-total') || 0;
    var done = 0, last = -1, seen = 0;
    L.forEach(function (l, i) { if (D[l.p]) { done++; last = Math.max(last, i); } if (V[l.p]) { seen++; last = Math.max(last, i); } });
    if (home && !done && !seen && !ticks) return; // nothing to continue: the card stays hidden
    var next = null, i;
    for (i = last + 1; i < L.length; i++) if (!D[L[i].p]) { next = L[i]; break; }
    if (!next) for (i = 0; i < L.length; i++) if (!D[L[i].p]) { next = L[i]; break; }
    var pct = total ? Math.round(done / total * 100) : 0;
    var fill = el.querySelector('[data-meter]'); if (fill) fill.style.width = pct + '%';
    var t = el.querySelector('[data-cl-text]');
    if (t && (done || seen)) t.textContent = es ? (done + ' de ' + total + ' lecciones terminadas') : (done + ' of ' + total + ' lessons done');
    var nx = el.querySelector('[data-cl-next]'), lab = el.querySelector('[data-cl-label]'), row = el.querySelector('.cl-next');
    if (strip) { // home Constitution Course strip (v5): always shown; the button reads Start or Continue
      var mtr = el.querySelector('[data-cs-meter]'); if (mtr && (done || seen)) mtr.hidden = false;
      var what = el.querySelector('[data-cs-what]');
      if (next && nx) {
        nx.href = base + next.p;
        if (done || seen) {
          if (lab) lab.textContent = es ? 'Continuar' : 'Continue';
          if (t) t.textContent = (es ? (done + ' de ' + total + ' lecciones terminadas. Sigue: lección ') : (done + ' of ' + total + ' lessons done. Next: lesson ')) + next.n + ', ' + next.t + '.';
        }
        if (what) what.textContent = ': ' + (es ? 'Lección ' : 'Lesson ') + next.n + ', ' + next.t; // the visible .en-tag says (en inglés)
      } else if (nx) {
        if (lab) lab.textContent = es ? 'Repasar' : 'Review';
        if (t) t.textContent = es ? 'Terminó todas las lecciones.' : 'You have finished every lesson.';
        nx.href = base + (L[0] ? L[0].p : '');
      }
    } else if (next && nx) {
      nx.href = base + next.p;
      nx.textContent = (es ? 'Lección ' : 'Lesson ') + next.n + ': ' + next.t;
      if (lab && (done || seen)) lab.textContent = es ? 'Siga con' : 'Continue with';
    } else if (row) {
      row.textContent = es ? 'Terminó todas las lecciones.' : 'You have finished every lesson.';
    }
    var m = el.querySelector('[data-cl-method]');
    if (m && ticks) {
      m.innerHTML = '';
      var link = document.createElement('a'); link.href = el.getAttribute('data-method-href'); link.textContent = es ? 'El Método' : 'The Method';
      m.appendChild(link);
      m.appendChild(document.createTextNode(es ? (': ' + ticks + ' de ' + mt + ' puntos marcados') : (': ' + ticks + ' of ' + mt + ' items ticked')));
      m.hidden = false;
    }
    el.hidden = false;
  });
})();

// Folded "details.more" sections: open the one a link or URL hash points at (e.g. #phones).
(function () {
  function openFor(hash) {
    if (!hash || hash.length < 2) return;
    var t = null; try { t = document.getElementById(decodeURIComponent(hash.slice(1))); } catch (e) { t = null; }
    if (!t) return;
    var d = t.closest ? t.closest('details.more') : null;
    if (d && !d.open) { d.open = true; t.scrollIntoView(); }
  }
  openFor(location.hash);
  window.addEventListener('hashchange', function () { openFor(location.hash); });
})();

// Pick-an-answer quizzes (Oct 30, 2026): a tap shows right or wrong, then the existing explanation.
// Without JavaScript the radios still work and "Show the answer" still opens.
(function () {
  var sets = document.querySelectorAll('[data-qm]');
  if (!sets.length) return;
  var es = (document.documentElement.lang || '').indexOf('es') === 0;
  Array.prototype.forEach.call(sets, function (box) {
    var fb = box.querySelector('[data-qm-fb]'), ans = box.querySelector('details.qm-ans');
    box.classList.add('qm-js');
    box.addEventListener('change', function (e) {
      var r = e.target; if (!r || r.type !== 'radio') return;
      var ok = r.hasAttribute('data-ok');
      Array.prototype.forEach.call(box.querySelectorAll('.qm-opt'), function (l) {
        var inp = l.querySelector('input'); l.classList.remove('qm-picked', 'qm-right', 'qm-wrong');
        if (inp.hasAttribute('data-ok')) l.classList.add('qm-right');
        if (inp === r) l.classList.add('qm-picked', ok ? 'qm-right' : 'qm-wrong');
      });
      box.classList.add('qm-done');
      if (fb) fb.textContent = ok ? (es ? '¡Correcto!' : 'Right!') : ((es ? 'No exactamente. La respuesta correcta es: ' : 'Not quite. The right answer is: ') + box.getAttribute('data-qm-right'));
      if (ans) ans.open = true;
    });
  });
})();

// Mixed-format extra question (Oct 30, 2026): "order the steps" and "match who decides".
// The Up/Down and Check buttons only appear when JavaScript runs; otherwise "Show the answer and why" still opens.
(function () {
  var boxes = document.querySelectorAll('[data-qx]');
  if (!boxes.length) return;
  var es = (document.documentElement.lang || '').indexOf('es') === 0; // Spanish final quiz (Oct 30, 2026)
  Array.prototype.forEach.call(boxes, function (box) {
    var kind = box.getAttribute('data-qx');
    var fb = box.querySelector('[data-qm-fb]'), ans = box.querySelector('details.qm-ans');
    Array.prototype.forEach.call(box.querySelectorAll('[data-qx-js],[data-qx-help]'), function (el) { el.hidden = false; });
    box.classList.add('qm-js');
    var list = box.querySelector('[data-qx-list]');
    function steps() { return Array.prototype.slice.call(list.children); }
    function stepText(li) { return li.querySelector('.qx-step-t').textContent; }
    function refresh() {
      steps().forEach(function (li, i, all) {
        li.classList.remove('qx-right', 'qx-wrong');
        var b = li.querySelectorAll('.qx-mv');
        b[0].disabled = i === 0; b[1].disabled = i === all.length - 1;
      });
    }
    if (list) {
      refresh();
      list.addEventListener('click', function (e) {
        var btn = e.target.closest ? e.target.closest('.qx-mv') : null; if (!btn || btn.disabled) return;
        var li = btn.closest('li'), dir = +btn.getAttribute('data-mv');
        if (dir < 0 && li.previousElementSibling) list.insertBefore(li, li.previousElementSibling);
        else if (dir > 0 && li.nextElementSibling) list.insertBefore(li.nextElementSibling, li);
        refresh();
        var pos = steps().indexOf(li) + 1;
        if (fb) fb.textContent = es ? 'Movió "' + stepText(li) + '" al paso ' + pos + ' de ' + steps().length + '.' : 'Moved "' + stepText(li) + '" to step ' + pos + ' of ' + steps().length + '.';
        var again = li.querySelector('.qx-mv[data-mv="' + dir + '"]');
        (again && !again.disabled ? again : li.querySelector('.qx-mv:not([disabled])')).focus();
      });
    }
    var check = box.querySelector('[data-qx-check]');
    if (check) check.addEventListener('click', function () {
      var good = 0, total = 0;
      if (kind === 'order') {
        steps().forEach(function (li, i) { total++; var ok = +li.getAttribute('data-i') === i; if (ok) good++; li.classList.add(ok ? 'qx-right' : 'qx-wrong'); });
        if (fb) fb.textContent = good === total ? (es ? '¡Correcto! Ese es el orden correcto.' : 'Right! That is the correct order.') : (es ? 'No exactamente. ' + good + ' de ' + total + ' pasos están en su lugar. El orden correcto es: ' : 'Not quite. ' + good + ' of ' + total + ' steps are in the right place. The right order is: ') +
          steps().slice().sort(function (a, b) { return a.getAttribute('data-i') - b.getAttribute('data-i'); }).map(function (li, i) { return (i + 1) + '. ' + stepText(li); }).join(' ');
      } else {
        var blank = 0;
        Array.prototype.forEach.call(box.querySelectorAll('.qx-sel'), function (s) {
          total++; var row = s.closest('.qx-row'); row.classList.remove('qx-right', 'qx-wrong');
          if (!s.value) { blank++; return; }
          var ok = s.value === s.getAttribute('data-ans'); if (ok) good++; row.classList.add(ok ? 'qx-right' : 'qx-wrong');
        });
        if (blank) { if (fb) fb.textContent = es ? 'Primero elija una respuesta en cada fila (faltan ' + blank + ').' : 'Choose an answer for every row first (' + blank + ' left).'; return; }
        if (fb) fb.textContent = good === total ? (es ? '¡Correcto! Las ' + total + ' coinciden.' : 'Right! All ' + total + ' match.') : (es ? 'No exactamente. ' + good + ' de ' + total + ' están bien. ' : 'Not quite. ' + good + ' of ' + total + ' are right. ') +
          Array.prototype.map.call(box.querySelectorAll('.qx-row'), function (r) { return r.querySelector('.qx-issue').textContent + ': ' + r.querySelector('.qx-sel').getAttribute('data-ans') + '.'; }).join(' ');
      }
      box.classList.add('qm-done');
      if (ans) ans.open = true;
    });
  });
})();

// "Who decides?" lookup filter (Oct 30, 2026). Without JavaScript the full table shows and the filter stays hidden.
(function () {
  var box = document.querySelector('[data-wd-filter]');
  if (!box) return;
  var es = (document.documentElement.lang || '').indexOf('es') === 0;
  var input = box.querySelector('input'), status = box.querySelector('[role="status"]');
  var rows = Array.prototype.slice.call(document.querySelectorAll('[data-wd-row]'));
  var norm = function (t) { return (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); };
  var hay = rows.map(function (r) { return norm(r.textContent + ' ' + r.getAttribute('data-k')); });
  box.hidden = false;
  input.addEventListener('input', function () {
    var words = norm(input.value).split(/\s+/).filter(Boolean), shown = 0;
    rows.forEach(function (r, i) { var ok = words.every(function (w) { return hay[i].indexOf(w) !== -1; }); r.hidden = !ok; if (ok) shown++; });
    status.textContent = words.length ? (es ? shown + ' de ' + rows.length + ' temas' : shown + ' of ' + rows.length + ' issues') : '';
  });
})();
