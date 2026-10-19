#!/usr/bin/env node
/* Style-direction previews for the HOME page (EN + ES). Does NOT touch dist/ or assets/.
 * Copies the built site (dist/) into _themes-preview/<A|B|C>/ and, on the two home pages only,
 * adds data-theme on <html>, small inline SVG icons on the course cards, font preloads and one
 * theme stylesheet (themes/base.css + themes/<x>.css concatenated). Fonts are local WOFF2 subsets
 * (Latin + Latin-1, so Spanish accents and ñ are covered) in themes/fonts/.
 * Usage: node tools/build-themes.js [A B C]   (needs a fresh `npm run build` first)        */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, '_themes-preview');
const THEMES = {
  A: { file: 'a-civic-editorial.css', name: 'Civic Editorial', fonts: ['newsreader-display.woff2', 'publicsans-var.woff2'], color: '#14284b' },
  B: { file: 'b-valley-modern.css', name: 'Valley Modern', fonts: ['outfit.woff2', 'figtree-var.woff2'], color: '#3f5320', extra: ['valley-hero.svg', 'valley-hero-dark.svg'] },
  C: { file: 'c-founders-archival.css', name: 'Founders Archival', fonts: ['ebgaramond.woff2', 'caslon-regular.woff2', 'caslon-bold.woff2'], color: '#2b2118' },
};
const ico = (d) => `<span class="path-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg></span>`;
const ICONS = {
  'path-layers': ico('<path d="M12 3 2.5 8 12 13l9.5-5z"/><path d="m2.5 12 9.5 5 9.5-5"/><path d="m2.5 16 9.5 5 9.5-5"/>'),
  'path-method': ico('<rect x="5" y="3.5" width="14" height="18" rx="2"/><path d="M9 3.5h6v2.5H9z"/><path d="m8.5 11 1.5 1.5 3-3"/><path d="M14.5 11.5H16"/><path d="m8.5 16.5 1.5 1.5 3-3"/><path d="M14.5 17H16"/>'),
  'path-take-part': ico('<path d="M4 5.5h16v10H11l-4.5 3.5v-3.5H4z"/><path d="M8 9.5h8M8 12.5h5"/>'),
  'path-documents': ico('<path d="M7 3.5h8.5L19 7v13.5H7z"/><path d="M15 3.5V7.5h4"/><path d="M5 6v16h11"/><path d="M10 11h6M10 14h6M10 17h4"/>'),
};
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    e.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}
const pick = process.argv.slice(2).map(s => s.toUpperCase()).filter(k => THEMES[k]);
const base = fs.readFileSync(path.join(ROOT, 'themes', 'base.css'), 'utf8');
for (const key of (pick.length ? pick : Object.keys(THEMES))) {
  const t = THEMES[key], dir = path.join(OUT, key);
  fs.mkdirSync(dir, { recursive: true });
  for (const e of fs.readdirSync(dir)) fs.rmSync(path.join(dir, e), { recursive: true, force: true }); // keep dir (a preview server may be serving it)
  copyDir(DIST, dir);
  const tdir = path.join(dir, 'assets', 'themes');
  fs.mkdirSync(tdir, { recursive: true });
  fs.writeFileSync(path.join(tdir, 'theme.css'), `/* Theme ${key}: ${t.name} (preview). Layered on top of site.css. */\n` + base + '\n' + fs.readFileSync(path.join(ROOT, 'themes', t.file), 'utf8'));
  for (const f of t.fonts) fs.copyFileSync(path.join(ROOT, 'themes', 'fonts', f), path.join(tdir, f));
  for (const f of (t.extra || [])) fs.copyFileSync(path.join(ROOT, 'themes', f), path.join(tdir, f));
  for (const home of ['index.html', 'es/index.html']) {
    const fp = path.join(dir, home);
    let h = fs.readFileSync(fp, 'utf8');
    h = h.replace(/<html lang="(\w+)">/, `<html lang="$1" data-theme="${key.toLowerCase()}">`);
    h = h.replace(/(<meta name="theme-color" content=")#[0-9a-f]+(" media="\(prefers-color-scheme: light\)">)/, `$1${t.color}$2`);
    const pre = t.fonts.slice(0, 2).map(f => `<link rel="preload" href="/assets/themes/${f}" as="font" type="font/woff2" crossorigin>`).join('\n');
    h = h.replace(/(<link rel="stylesheet" href="\/assets\/css\/site.css">)/, `${pre}\n$1\n<link rel="stylesheet" href="/assets/themes/theme.css">`);
    for (const [id, svg] of Object.entries(ICONS)) h = h.replace(new RegExp(`(<li class="path-card" id="${id}">)`), `$1${svg}`);
    fs.writeFileSync(fp, h);
  }
  console.log(`${key} ${t.name}: ${path.relative(ROOT, dir)}/ (home + /es/ themed)`);
}
