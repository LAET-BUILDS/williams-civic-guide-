#!/usr/bin/env node
/* Checks that every internal link and #anchor in dist/ points to something that exists.
 * External links are listed (not fetched) in dist-external-links.txt for manual checking. */
const fs = require('fs');
const path = require('path');
const DIST = path.join(__dirname, '..', 'dist');
const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? walk(p) : p.endsWith('.html') && files.push(p); } })(DIST);
const ids = new Map();
for (const f of files) { const s = fs.readFileSync(f, 'utf8'); ids.set(f, new Set([...s.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]))); }
// The Pages workflow sets BASE_PATH only on the build step. When it is unset here,
// read the prefix the build wrote onto the stylesheet so subpath links still resolve.
function basePath() {
  if (process.env.BASE_PATH) return process.env.BASE_PATH.replace(/\/?$/, '/');
  for (const f of files) {
    const s = fs.readFileSync(f, 'utf8');
    const m = s.match(/href="([^"]*)assets\/css\/site\.css"/);
    if (!m) continue;
    const prefix = m[1];
    if (!prefix || prefix === '/') return '/';
    return prefix.endsWith('/') ? prefix : prefix + '/';
  }
  return '/';
}
const BP = basePath();
let bad = 0; const ext = new Set();
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/href="([^"]+)"/g)) {
    const h = m[1].replace(/&amp;/g, '&');
    if (/^(https?:)?\/\//.test(h)) { ext.add(h); continue; }
    if (/^(mailto|tel|data):/.test(h)) continue;
    let [p, hash] = h.split('#');
    if (p && BP !== '/' && p.startsWith(BP)) p = '/' + p.slice(BP.length);
    let target = f;
    if (p) {
      target = p.startsWith('/') ? path.join(DIST, p) : path.join(path.dirname(f), p);
      if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
      if (!fs.existsSync(target)) { console.log(`MISSING ${h}  (in ${path.relative(DIST, f)})`); bad++; continue; }
    }
    if (hash && target.endsWith('.html') && !(ids.get(target) || new Set()).has(decodeURIComponent(hash))) { console.log(`NO ANCHOR #${hash} in ${path.relative(DIST, target)}  (linked from ${path.relative(DIST, f)})`); bad++; }
  }
}
fs.writeFileSync(path.join(DIST, '..', 'dist-external-links.txt'), [...ext].sort().join('\n') + '\n');
console.log(`${files.length} HTML files; ${bad} broken internal links/anchors; ${ext.size} external links listed in dist-external-links.txt`);
process.exit(bad ? 1 : 0);
