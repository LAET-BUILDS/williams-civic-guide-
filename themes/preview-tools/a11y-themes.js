#!/usr/bin/env node
/* axe-core WCAG 2.0/2.1 A + AA (+ best-practice) on each theme's home page, EN and ES,
 * using the same passes as a11y-check.js: phone light, desktop light, phone dark, phone menu open.
 * Needs preview servers: A 8091, B 8092, C 8093. Usage: node tools/a11y-themes.js [A B C] */
const fs = require('fs');
const puppeteer = require('puppeteer-core');
const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const PORT = { A: 8091, B: 8092, C: 8093 };
const keys = process.argv.slice(2).length ? process.argv.slice(2) : ['A', 'B', 'C'];
(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox', '--headless=new'] });
  const page = await browser.newPage(); await page.setCacheEnabled(false);
  let grand = 0;
  for (const k of keys) {
    let total = 0; const out = []; let runs = 0;
    for (const vp of [{ w: 375, label: 'phone' }, { w: 430, label: 'phone-430' }, { w: 1280, label: 'desktop' }, { w: 375, label: 'phone-dark', dark: true }, { w: 1280, label: 'desktop-dark', dark: true }, { w: 375, label: 'phone-menu-open', menu: true }]) {
      await page.setViewport({ width: vp.w, height: 900 });
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: vp.dark ? 'dark' : 'light' }]);
      for (const p of ['', 'es/']) {
        await page.goto(`http://localhost:${PORT[k]}/${p}`, { waitUntil: 'networkidle0' });
        await page.evaluate(() => document.fonts.ready);
        if (vp.menu) { await page.click('.menu-btn'); await new Promise(r => setTimeout(r, 100)); }
        await page.evaluate(axeSource);
        const r = await page.evaluate(async () => await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } }));
        runs++;
        const wc = r.violations.filter(x => x.tags.some(t => /^wcag/.test(t)));
        total += wc.length;
        for (const x of r.violations) out.push(`  ${vp.label} /${p} [${x.impact}] ${x.id}: ${x.help} (${x.nodes.length}) e.g. ${x.nodes[0].target.join(' ')} ${x.nodes[0].any.map(a => a.message).join(' ').slice(0, 160)}`);
      }
    }
    grand += total;
    console.log(`Theme ${k}: ${runs} axe runs (EN+ES home; phone 375/430, desktop, dark phone/desktop, menu open). WCAG A/AA violations: ${total}`);
    if (out.length) console.log(out.join('\n'));
  }
  await browser.close();
  process.exit(grand ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
