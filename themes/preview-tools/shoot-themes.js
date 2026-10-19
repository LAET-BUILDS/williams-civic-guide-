#!/usr/bin/env node
/* Full-page phone (430px) and desktop (1280px) screenshots of each theme's home page.
 * Needs one static server per theme: A on 8091, B on 8092, C on 8093 (see README in themes/).
 * Usage: node tools/shoot-themes.js [outDir] [A B C]   Env: SCHEME=dark, LANGPATH=es/ */
const puppeteer = require('puppeteer-core');
const path = require('path');
const OUT = process.argv[2] || '/workspace/shots/styles';
const keys = process.argv.slice(3).length ? process.argv.slice(3) : ['A', 'B', 'C'];
const PORT = { A: 8091, B: 8092, C: 8093 };
(async () => {
  const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox', '--headless=new'] });
  const pg = await br.newPage(); await pg.setCacheEnabled(false);
  await pg.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: process.env.SCHEME || 'light' }]);
  const sfx = (process.env.LANGPATH ? '-es' : '') + (process.env.SCHEME ? '-' + process.env.SCHEME : '');
  for (const k of keys) for (const [w, label, h] of [[430, 'phone', 932], [1280, 'desktop', 900]]) {
    await pg.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await pg.goto(`http://localhost:${PORT[k]}/${process.env.LANGPATH || ''}`, { waitUntil: 'networkidle0' });
    await pg.evaluate(() => document.fonts.ready);
    const f = path.join(OUT, `${k}-${label}${sfx}.png`);
    await pg.screenshot({ path: f, fullPage: true }); console.log(f);
  }
  await br.close();
})().catch(e => { console.error(e); process.exit(1); });
