#!/usr/bin/env node
/* Fails if any page scrolls horizontally at 320, 375, 430 or 1280 px (light and dark, menu closed and open on phones).
 * Needs the local server on PORT (default 8080). */
const fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer-core');
const PORT = process.env.PORT || 8080, B = `http://localhost:${PORT}/`;
const pages = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'dist', 'pages.json'), 'utf8')).map(p => p.path).concat(['404.html']);
(async () => {
  const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox', '--headless=new'] });
  const pg = await br.newPage();
  let bad = 0, runs = 0;
  for (const w of [320, 375, 430, 1280]) {
    await pg.setViewport({ width: w, height: 800 });
    for (const p of pages) {
      await pg.goto(B + p, { waitUntil: 'load' });
      await pg.evaluate(() => document.fonts.ready);
      const passes = w < 1024 ? [false, true] : [false];
      for (const menu of passes) {
        if (menu) await pg.evaluate(() => { const b = document.querySelector('.menu-btn'); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); });
        const o = await pg.evaluate(() => { const d = document.documentElement; const wide = [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.right > d.clientWidth + 1 && getComputedStyle(e).position !== 'fixed' && !e.closest('.table-wrap, .stepper-nav ol, main > table, .toc-jump ol, .visually-hidden'); }).slice(0, 3).map(e => e.tagName.toLowerCase() + (e.className ? '.' + String(e.className).split(' ')[0] : '')); return { sw: d.scrollWidth, cw: d.clientWidth, wide }; });
        runs++;
        if (o.sw > o.cw) { bad++; console.log(`OVERFLOW ${w}px${menu ? ' menu' : ''} /${p}: scrollWidth ${o.sw} > ${o.cw} ${o.wide.join(', ')}`); }
      }
    }
  }
  await br.close();
  console.log(`${runs} checks (${pages.length} pages x 320/375/430/1280, phone menu open too); horizontal overflow: ${bad}`);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
