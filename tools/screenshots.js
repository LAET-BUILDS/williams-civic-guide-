#!/usr/bin/env node
/* Phone (430px) and desktop (1280px) screenshots of key pages. Needs the local server on PORT.
 * Usage: node tools/screenshots.js [outDir]   Env: FULL=0 for viewport-only, SCHEME=dark */
const puppeteer = require('puppeteer-core');
const path = require('path');
const PORT = process.env.PORT || 8080, B = `http://localhost:${PORT}/`;
const OUT = process.argv[2] || '/workspace/shots/v2';
const pages = (process.env.PAGES || 'home=,layers=layers/,method=method/,take-part=take-part/,documents=documents/,us-constitution=documents/us-constitution/,es-home=es/').split(',').map(x => x.split('='));
(async () => {
  const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox', '--headless=new'] });
  const pg = await br.newPage(); await pg.setCacheEnabled(false);
  if (process.env.SCHEME) await pg.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: process.env.SCHEME }]);
  const suffix = process.env.SCHEME ? '-' + process.env.SCHEME : '';
  for (const [w, label, h] of [[430, 'phone', 932], [1280, 'desktop', 900]]) {
    await pg.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    for (const [name, p] of pages) {
      await pg.goto(B + p, { waitUntil: 'networkidle0' });
      if (process.env.SEED) await pg.evaluate(s => localStorage.setItem('wcg-method-v1', s), process.env.SEED);
      await pg.reload({ waitUntil: 'networkidle0' });
      const full = process.env.FULL !== '0' && name !== 'us-constitution';
      const f = path.join(OUT, `${name}-${label}${suffix}.png`);
      await pg.screenshot({ path: f, fullPage: full });
      console.log(f);
    }
  }
  await br.close();
})().catch(e => { console.error(e); process.exit(1); });
