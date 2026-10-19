#!/usr/bin/env node
/* Runs axe-core (WCAG 2.0/2.1 A and AA rules) against every built page.
 * Needs: npm run build; a local server (npm run serve) on PORT (default 8080);
 * Google Chrome or Chromium (set CHROME_PATH if not /usr/bin/google-chrome). */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const PORT = process.env.PORT || 8080;
const BASE = `http://localhost:${PORT}/`;
const pages = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'dist', 'pages.json'), 'utf8'));
(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox', '--headless=new'] });
  const page = await browser.newPage();
  await page.setCacheEnabled(false);
  let total = 0; const summary = [];
  // light and dark mode (prefers-color-scheme) on phone and desktop, plus phone with the menu open
  for (const vp of [{ width: 375, height: 800, label: 'mobile' }, { width: 1280, height: 900, label: 'desktop' }, { width: 375, height: 800, label: 'mobile-dark', dark: true }, { width: 1280, height: 900, label: 'desktop-dark', dark: true }, { width: 375, height: 800, label: 'mobile-menu-open', menu: true }]) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: vp.dark ? 'dark' : 'light' }]);
    for (const p of pages) {
      if (vp.label !== 'mobile' && /ca-constitution\/article-/.test(p.path) && !/article-i\/$/.test(p.path)) continue; // same template; check one
      if (vp.menu && !/^(es\/)?$|^method\/$/.test(p.path)) continue; // menu panel is the same on every page
      const res = await page.goto(BASE + p.path, { waitUntil: 'load' });
      if (!res || res.status() !== 200) { console.log(`HTTP ${res && res.status()} ${p.path}`); total++; continue; }
      if (vp.menu) { await page.click('.menu-btn'); await new Promise(r => setTimeout(r, 100)); }
      await page.evaluate(axeSource);
      const r = await page.evaluate(async () => await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } }));
      const v = r.violations;
      total += v.filter(x => x.tags.some(t => /^wcag/.test(t))).length;
      if (v.length) {
        summary.push(`${vp.label} /${p.path}`);
        for (const x of v) summary.push(`   [${x.impact}] ${x.id}${x.tags.some(t => /^wcag/.test(t)) ? '' : ' (best-practice)'}: ${x.help} (${x.nodes.length} nodes) e.g. ${x.nodes[0].target.join(' ')}`);
      }
    }
  }
  await browser.close();
  console.log(summary.join('\n') || 'No axe violations.');
  console.log(`\nPages checked: ${pages.length} (mobile, light) + desktop, dark-mode and menu-open passes. WCAG A/AA violations: ${total}`);
  process.exit(total ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
