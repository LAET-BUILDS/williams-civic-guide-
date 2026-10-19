#!/usr/bin/env node
/* Smoke test (needs the local server on PORT, default 8080): keyboard skip link, language,
 * noindex, nav contents, Spanish review flag, Constitution search, and The Method checklist
 * (ticks persist in localStorage, keyboard works, clear works, no third-party requests). Exits 1 on failure. */
const puppeteer = require('puppeteer-core');
const PORT = process.env.PORT || 8080, B = `http://localhost:${PORT}/`;
const out = []; let fail = 0;
const check = (ok, msg) => { out.push(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fail++; };
(async () => {
  const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox', '--headless=new'] });
  const pg = await br.newPage(); await pg.setViewport({ width: 375, height: 800 });
  const foreign = [];
  pg.on('request', r => { if (!r.url().startsWith(B) && !r.url().startsWith('data:')) foreign.push(r.url()); });
  await pg.goto(B, { waitUntil: 'load' });
  await pg.keyboard.press('Tab');
  check(/Skip to main content/.test(await pg.evaluate(() => document.activeElement.textContent.trim())), '1st Tab focuses the skip link');
  await pg.keyboard.press('Enter');
  check(await pg.evaluate(() => document.activeElement.id) === 'main', 'Enter on skip link moves focus to #main');
  check(/not legal advice/i.test(await pg.evaluate(() => document.querySelector('.banner').textContent)), 'Banner says "not legal advice"');
  check(await pg.evaluate(() => document.querySelector('meta[name=robots]').content.includes('noindex')), 'noindex meta present');
  check(/Williams Civic Guide/.test(await pg.title()), 'Site name from site.json in <title>');
  const navText = await pg.evaluate(() => [...document.querySelectorAll('.nav a')].map(a => a.textContent).join(' | '));
  check(!/example/i.test(navText), 'Nav has no "examples" item: ' + navText);
  // v2 header: one-line disclaimer strip, single-row header, accessible menu disclosure
  const hdr = await pg.evaluate(() => { const b = document.querySelector('.banner p'); const lh = parseFloat(getComputedStyle(b).lineHeight); const row = document.querySelector('.header-row'); return { lines: Math.round((b.getBoundingClientRect().height - parseFloat(getComputedStyle(b).paddingTop) - parseFloat(getComputedStyle(b).paddingBottom)) / lh), rowH: row.getBoundingClientRect().height, notices: document.querySelectorAll('.notice').length }; });
  check(hdr.lines === 1, `Disclaimer strip is one line on a 375px phone (${hdr.lines})`);
  check(hdr.rowH < 70, `Header is a single row (${Math.round(hdr.rowH)}px)`);
  check(hdr.notices === 0, 'Home page has no second, large disclaimer box');
  check(await pg.evaluate(() => { const m = document.getElementById('site-menu'); return getComputedStyle(m).display === 'none' && document.querySelector('.menu-btn').getAttribute('aria-expanded') === 'false'; }), 'Phone: menu collapsed, button aria-expanded="false"');
  await pg.focus('.menu-btn'); await pg.keyboard.press('Enter');
  check(await pg.evaluate(() => document.querySelector('.menu-btn').getAttribute('aria-expanded') === 'true' && getComputedStyle(document.getElementById('site-menu')).display !== 'none'), 'Menu opens from the keyboard (aria-expanded="true")');
  await pg.keyboard.press('Escape');
  check(await pg.evaluate(() => document.querySelector('.menu-btn').getAttribute('aria-expanded') === 'false' && document.activeElement.classList.contains('menu-btn')), 'Escape closes the menu and returns focus to the button');
  check(await pg.evaluate(() => /Start the course/.test(document.querySelector('.hero .btn-primary').textContent) && document.querySelectorAll('.hero .btn-primary').length === 1), 'Home hero has one primary "Start the course" button');
  check(await pg.evaluate(() => document.querySelectorAll('.layers-home .layer').length === 3 && document.querySelectorAll('.path-card').length >= 3 && document.querySelectorAll('.path-card').length <= 5), 'Home has 3-layer diagram and 3-5 course cards');
  await pg.goto(B + 'reference/', { waitUntil: 'load' });
  check(await pg.evaluate(() => !!document.querySelector('#disclaimer') && /no lawyer has reviewed it/i.test(document.querySelector('.disclaimer-full').textContent)), 'Full disclaimer is on the Reference page');
  const pgD = await br.newPage(); await pgD.setViewport({ width: 1280, height: 900 }); await pgD.goto(B, { waitUntil: 'load' });
  check(await pgD.evaluate(() => getComputedStyle(document.querySelector('.menu-btn')).display === 'none' && getComputedStyle(document.getElementById('site-menu')).display === 'flex'), 'Desktop: inline menu, no menu button');
  await pgD.close();
  await pg.goto(B + 'es/', { waitUntil: 'load' });
  check(await pg.evaluate(() => document.documentElement.lang) === 'es', 'html lang="es" on Spanish page');
  check(/pendiente de revisión por bino/.test(await pg.evaluate(() => (document.querySelector('.review-note') || {}).textContent || '')), 'Spanish page shows "pending review by bino" notice');
  for (const gone of ['roads/', 'money/', 'oversight/', 'records/', 'code/', 'examples/']) {
    const r = await pg.goto(B + gone, { waitUntil: 'load' });
    check(r.status() === 404, `/${gone} is gone (HTTP ${r.status()})`);
  }
  await pg.goto(B + 'documents/us-constitution/', { waitUntil: 'load' });
  await pg.type('#q-us', 'quartered'); await new Promise(r => setTimeout(r, 500));
  check(/1 part matches/.test(await pg.evaluate(() => document.querySelector('#q-us-status').textContent)), 'US Constitution search finds "quartered"');
  await pg.goto(B + 'documents/ca-constitution/', { waitUntil: 'load' });
  await pg.type('#q-ca', 'public scrutiny'); await new Promise(r => setTimeout(r, 1500));
  check(/Art\. I/.test(await pg.evaluate(() => (document.querySelector('#q-ca-results a') || {}).textContent || '')), 'CA Constitution search finds "public scrutiny"');

  // The Method checklist
  await pg.goto(B + 'method/', { waitUntil: 'load' });
  await pg.evaluate(() => localStorage.clear()); await pg.reload({ waitUntil: 'load' });
  const total = await pg.evaluate(() => document.querySelectorAll('.checklist input[type=checkbox]').length);
  check(total >= 28, `Checklist has ${total} items`);
  check(await pg.evaluate(() => !document.querySelector('.cl-js').hidden && document.querySelector('.cl-nojs').hidden), 'Storage notice shown when JS + localStorage available');
  await pg.click('#m-find-official');
  await pg.focus('#m-read-who'); await pg.keyboard.press('Space');
  await pg.type('#m-section', 'WMC test section');
  await pg.type('#m-unknown', 'Who enforces this?');
  await new Promise(r => setTimeout(r, 500));
  check(/2 of \d+ items ticked/.test(await pg.evaluate(() => document.querySelector('#m-progress').textContent)), 'Progress status updates (mouse + keyboard Space)');
  await pg.reload({ waitUntil: 'load' });
  const kept = await pg.evaluate(() => [document.querySelector('#m-find-official').checked, document.querySelector('#m-read-who').checked, document.querySelector('#m-section').value, document.querySelector('#m-unknown').value]);
  check(kept[0] && kept[1] && kept[2] === 'WMC test section' && kept[3] === 'Who enforces this?', 'Ticks and notes persist after reload');
  await pg.goto(B + 'es/method/', { waitUntil: 'load' });
  check(await pg.evaluate(() => document.querySelector('#m-find-official').checked && /2 de \d+/.test(document.querySelector('#m-progress').textContent)), 'Same checklist state shown on the Spanish page');
  await pg.goto(B, { waitUntil: 'load' });
  check(/2 of 30 items ticked/.test(await pg.evaluate(() => (document.querySelector('.path-progress:not([hidden])') || {}).textContent || '')), 'Home course card shows checklist progress from localStorage');
  await pg.goto(B + 'documents/', { waitUntil: 'load' });
  await pg.type('#q-all', 'quartered'); await new Promise(r => setTimeout(r, 1500));
  check(/U\.S\. Constitution/.test(await pg.evaluate(() => (document.querySelector('#q-all-results a') || {}).textContent || '')), 'Combined search on /documents/ finds "quartered" in the U.S. Constitution');
  await pg.goto(B + 'es/method/', { waitUntil: 'load' });
  check(await pg.evaluate(() => /1\/4/.test(document.querySelector('[data-step-link="find"]').textContent) && document.querySelector('[data-meter]').style.width !== '0%'), 'Stepper shows per-step counts and progress bar');
  pg.once('dialog', d => d.accept());
  await pg.click('[data-clear]'); await new Promise(r => setTimeout(r, 200));
  check(await pg.evaluate(() => !document.querySelector('#m-find-official').checked && localStorage.getItem('wcg-method-v1') === null), 'Clear button empties the checklist and storage');
  check(await pg.evaluate(() => document.cookie === ''), 'No cookies set');
  check(foreign.length === 0, 'No requests to other sites' + (foreign.length ? ': ' + foreign.join(', ') : ''));

  // without JavaScript: page still renders and boxes are plain checkboxes
  const pg2 = await br.newPage(); await pg2.setJavaScriptEnabled(false);
  await pg2.goto(B + 'method/', { waitUntil: 'load' });
  check(await pg2.evaluate(() => !document.querySelector('.cl-nojs').hidden && document.querySelectorAll('.checklist input[type=checkbox]').length > 0), 'Without JS: checklist renders with a "not saved" note');
  await br.close();
  console.log(out.join('\n'));
  console.log(fail ? `\n${fail} check(s) failed` : '\nAll smoke checks passed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
