'use strict';
/* Generates the full-text Foundational Documents pages from content/foundational/*.json.
 * The legal text itself is never edited here; it comes from tools/extract_foundational.py.
 * Plain-language summaries come from content/foundational/summaries.json and are always
 * labeled "Unofficial summary". */
const fs = require('fs');
const path = require('path');

module.exports.build = function ({ layout, write, url, esc, DIST, ROOT, SOURCES, makeCiter, T, BUILD_DATE }) {
  const F = p => JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'foundational', p), 'utf8'));
  const us = F('us-constitution.json');
  const ca = F('ca-constitution.json');
  const sums = F('summaries.json');
  const pages = [];
  const updated = sums.updated || BUILD_DATE;

  const summaryBox = (s) => s ? `<div class="summary"><p><span class="tag tag-summary">Unofficial summary</span> ${esc(s.en)}</p></div>` : '';
  const sourceBox = (doc) => `<div class="card source-box"><p><strong>Official text source:</strong> ${doc.sources.map(u => `<a href="${esc(u)}">${esc(u.replace(/^https?:\/\//, ''))}</a>`).join(' · ')}</p>
<p class="small">${esc(doc.source_note)}</p>
${doc.also_see ? `<p class="small">Also see: ${doc.also_see.map(u => `<a href="${esc(u)}">${esc(u.replace(/^https?:\/\//, ''))}</a>`).join(' · ')}</p>` : ''}
<p class="small">Summaries on this page are unofficial, written in plain language by site volunteers, and are not legal advice. When the summary and the text differ, the text controls. Check the official source before relying on any wording.</p></div>`;
  const ICON_SEARCH = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M10 3a7 7 0 0 1 5.6 11.2l5.1 5.1-1.4 1.4-5.1-5.1A7 7 0 1 1 10 3zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" fill="currentColor"/></svg>';
  const searchBox = (scope, label, extra = '') => `<div class="doc-search" data-scope="${scope}"${extra} hidden><label for="q-${scope}">${label}</label><div class="search-field">${ICON_SEARCH}<input id="q-${scope}" type="search" autocomplete="off" aria-describedby="q-${scope}-status"></div><p id="q-${scope}-status" class="small" role="status" aria-live="polite"></p><ol class="search-results" id="q-${scope}-results"></ol></div>`;

  const sectionHTML = (s, lvl = 3) => `<section class="doc-sec" id="${esc(s.id)}">${s.label || s.caption ? `<h${lvl}>${s.label ? `<a class="self" href="#${esc(s.id)}">${esc(s.label)}</a>` : ''}${s.caption ? ` <span class="caption">${esc(s.caption)}</span>` : ''}</h${lvl}>` : ''}${s.paras.map(p => `<p>${esc(p)}</p>`).join('')}</section>`;

  // ---------------- U.S. Constitution ----------------
  {
    const toc = [];
    let body = `<p class="crumbs"><a href="${url('documents/')}">Founding documents</a> › U.S. Constitution</p>
<h1>Constitution of the United States, with all 27 amendments</h1>
<div class="doc-layout">
<aside class="doc-aside" aria-label="Search and contents">
${searchBox('us', 'Search this page (words or phrases)')}
<details class="toc toc-jump" open><summary>Contents <span class="small">(jump to a part)</span></summary><nav aria-labelledby="toc-us"><h2 id="toc-us" class="visually-hidden">Contents</h2><ol>__TOC__</ol></nav></details>
</aside>
<div class="doc-main">
${sourceBox(us)}`;
    for (const part of us.constitution) {
      toc.push(`<li><a href="#${part.id}">${esc(part.title)}</a>${sums.us[part.id] ? ` <span class="small">${esc(sums.us[part.id].short || '')}</span>` : ''}</li>`);
      body += `<section class="doc-part" id="${part.id}" data-searchable><h2>${esc(part.title)}</h2>${summaryBox(sums.us[part.id])}${part.sections.map(s => sectionHTML(s)).join('')}</section>`;
    }
    const amendBlock = (list, heading, id) => {
      toc.push(`<li><a href="#${id}">${heading}</a><ol>${list.map(a => `<li><a href="#${a.id}">${esc(a.title)}</a>${sums.us[a.id] && sums.us[a.id].short ? ` <span class="small">${esc(sums.us[a.id].short)}</span>` : ''}</li>`).join('')}</ol></li>`);
      return `<section id="${id}"><h2>${heading}</h2>${list.map(a => `<section class="doc-part" id="${a.id}" data-searchable><h3 class="amend-h">${esc(a.title)}</h3>${summaryBox(sums.us[a.id])}${a.notes.length ? `<div class="doc-notes">${a.notes.map(n => `<p class="small">${esc(n)}</p>`).join('')}</div>` : ''}${a.sections.map(s => sectionHTML(s, 4)).join('')}</section>`).join('')}</section>`;
    };
    body += amendBlock(us.bill_of_rights, 'The Bill of Rights (Amendments I–X)', 'bill-of-rights');
    body += amendBlock(us.later_amendments, 'Amendments XI–XXVII', 'later-amendments');
    body = body.replace('__TOC__', toc.join('')) + '</div></div>';
    // search index (also used by the combined search on /documents/)
    const usIndex = [];
    const addIdx = (part, s) => usIndex.push({ d: 'us', a: part.title, p: `documents/us-constitution/#${s.id || part.id}`, l: s.label || '', c: s.caption || '', t: s.paras.join(' ') });
    for (const part of us.constitution) part.sections.forEach(s => addIdx(part, s));
    for (const a of [...us.bill_of_rights, ...us.later_amendments]) a.sections.forEach(s => addIdx(a, s));
    write(path.join(DIST, 'assets', 'data', 'us-constitution-search.json'), JSON.stringify(usIndex));
    write(path.join(DIST, 'documents', 'us-constitution', 'index.html'), layout({ lang: 'en', title: 'U.S. Constitution and amendments', description: 'Full text of the U.S. Constitution and all 27 amendments from the National Archives, with unofficial plain-language summaries.', body, navKey: 'documents/', altHref: url('es/documents/'), updated, pageClass: 'page-doc page-doc-us' }));
    pages.push({ lang: 'en', path: 'documents/us-constitution/', title: 'U.S. Constitution', updated });
  }

  // ---------------- California Constitution ----------------
  {
    const index = [];
    const arts = ca.articles;
    const tocItems = arts.map(a => {
      const href = url(`documents/ca-constitution/${a.id}/`);
      const s = sums.ca[a.id];
      if (a.repealed) return `<li class="repealed">Article ${esc(a.number)} <span class="small">${esc(a.title)}</span></li>`;
      return `<li><a href="${href}">Article ${esc(a.number)}: ${esc(a.title)}</a>${s ? `<br><span class="small"><span class="tag tag-summary">Unofficial summary</span> ${esc(s.short || s.en)}</span>` : ''}</li>`;
    }).join('');
    const live = arts.filter(a => !a.repealed);
    live.forEach((a, i) => {
      const prev = live[i - 1], next = live[i + 1];
      const pager = `<nav class="pager" aria-label="Article navigation"><ul>${prev ? `<li><a rel="prev" href="${url(`documents/ca-constitution/${prev.id}/`)}">← Article ${esc(prev.number)}</a></li>` : ''}<li><a href="${url('documents/ca-constitution/')}">All articles</a></li>${next ? `<li><a rel="next" href="${url(`documents/ca-constitution/${next.id}/`)}">Article ${esc(next.number)} →</a></li>` : ''}</ul></nav>`;
      const secToc = a.sections.length > 3 ? `<details class="toc toc-jump"><summary>Jump to a section <span class="small">(${a.sections.length} in this article)</span></summary><ol>${a.sections.map(s => `<li><a href="#${esc(s.id)}">${esc(s.label)}</a>${s.caption ? ` ${esc(s.caption)}` : ''}</li>`).join('')}</ol></details>` : '';
      const searchLink = `<a class="jump-search" href="${url('documents/ca-constitution/')}#q-ca">${ICON_SEARCH}<span>Search all articles</span></a>`;
      const body = `<p class="crumbs"><a href="${url('documents/')}">Founding documents</a> › <a href="${url('documents/ca-constitution/')}">California Constitution</a> › Article ${esc(a.number)}</p>
<h1>California Constitution, Article ${esc(a.number)}: ${esc(a.title)}</h1>
${summaryBox(sums.ca[a.id])}
<p class="small">Text: ${esc(ca.source_name)}, ${esc(ca.as_of)}. <a href="${esc(ca.sources[0])}">Official PDF</a> · <a href="${esc(ca.also_see[0])}">leginfo.legislature.ca.gov</a>. Automatically extracted; check the official source before relying on any wording.</p>
<div class="jump-bar">${secToc}${searchLink}</div>
${pager.replace('Article navigation', 'Article navigation (top)')}
${a.notes.map(n => `<p class="small">${esc(n)}</p>`).join('')}
${a.sections.map(s => sectionHTML(s, 2)).join('')}
${pager.replace('Article navigation', 'Article navigation (bottom)')}`;
      write(path.join(DIST, 'documents', 'ca-constitution', a.id, 'index.html'), layout({ lang: 'en', title: `CA Constitution Art. ${a.number}: ${a.title}`, description: `Full text of Article ${a.number} (${a.title}) of the California Constitution.`, body, navKey: 'documents/', altHref: null, updated, pageClass: 'page-doc page-doc-article' }));
      pages.push({ lang: 'en', path: `documents/ca-constitution/${a.id}/`, title: `CA Constitution Art. ${a.number}`, updated });
      for (const s of a.sections) index.push({ a: a.number, at: a.title, p: `documents/ca-constitution/${a.id}/#${s.id}`, l: s.label, c: s.caption, t: s.paras.join(' ') });
    });
    write(path.join(DIST, 'assets', 'data', 'ca-constitution-search.json'), JSON.stringify(index));
    const body = `<p class="crumbs"><a href="${url('documents/')}">Founding documents</a> › California Constitution</p>
<h1>Constitution of the State of California</h1>
<p>${esc(ca.as_of)}.</p>
${searchBox('ca', 'Search the whole California Constitution', ` data-index="${url('assets/data/ca-constitution-search.json')}"`).replace('class="doc-search"', 'class="doc-search doc-search-hero"')}
${sourceBox(ca)}
<p class="small">How the text was produced: the official PDF's text layer drops the letter pairs “ff”, “fi” and “fl” (for example “efect” for “effect”). Our extraction script restored them using a dictionary and logged every change in <code>content/foundational/ca-ligature-log.json</code>. Line-end hyphens were removed only when the joined word is a real word. If you find an extraction error, please report it on the <a href="${url('reference/')}#report-error">Reference page</a>.</p>
<p><strong>Most relevant to Williams residents:</strong> <a href="${url('documents/ca-constitution/article-i/')}#article-i-sec-3">Art. I §3 (right of access to meetings and records)</a> · <a href="${url('documents/ca-constitution/article-ii/')}">Art. II (initiative, referendum, recall)</a> · <a href="${url('documents/ca-constitution/article-xi/')}">Art. XI (local government)</a> · <a href="${url('documents/ca-constitution/article-xiii-c/')}">Art. XIII C</a> and <a href="${url('documents/ca-constitution/article-xiii-d/')}">XIII D</a> (local taxes, fees: Prop 218)</p>
<nav aria-labelledby="toc-ca" class="toc"><h2 id="toc-ca">Articles</h2><p class="small">Articles shown in grey were repealed or renumbered; the publication keeps a placeholder for each.</p><ol class="plain art-grid">${tocItems}</ol></nav>`;
    write(path.join(DIST, 'documents', 'ca-constitution', 'index.html'), layout({ lang: 'en', title: 'California Constitution', description: 'Full text of the California Constitution from the California State Senate publication, article by article, with search and unofficial summaries.', body, navKey: 'documents/', altHref: url('es/documents/'), updated, pageClass: 'page-doc page-doc-ca', extraHead: `<meta name="ca-search-index" content="${url('assets/data/ca-constitution-search.json')}">` }));
    pages.push({ lang: 'en', path: 'documents/ca-constitution/', title: 'California Constitution', updated });
  }
  return pages;
};
