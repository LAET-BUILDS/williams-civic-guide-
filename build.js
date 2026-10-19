#!/usr/bin/env node
/*
 * Static site builder for the unofficial Williams, CA civic education site.
 * No framework: Markdown (content/pages) + JSON (content/data) -> HTML (dist/).
 * Run: npm run build      Output: dist/
 *
 * Claim tags you can use inside Markdown and in content/data/*.json text (see UPDATING.md):
 *   [[V:source-id]]  Verified    (we read it in the cited source)
 *   [[U:source-id]]  Unverified  (summary, search result, general knowledge, or not re-checked)
 *   [[C:source-id]]  Calculated  (we computed it from the cited source)
 *   Several sources: [[V:src-a,src-b]]
 * Blocks: {{next-meeting}} {{meeting-list}} {{method-checklist}} {{glossary}} {{sources-table}}
 *         {{corrections}} {{legend}} {{site-updated}}   Inline: {{site-name}}
 * v2 design blocks: {{layers-diagram}} {{layers-diagram:home}} {{course-path}} {{legend-chips}} {{disclaimer}} {{doc-search}}
 *
 * Spanish review flag: an ES page with front matter "review: pending" shows a visible
 * "pending review by <site.es_review.reviewer>" notice. REQUIRE_ES_REVIEW=1 makes the build fail
 * while any Spanish page is still pending (use it before going public).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const MarkdownIt = require('markdown-it');
const anchorMod = require('markdown-it-anchor');
const anchor = anchorMod.default || anchorMod;

const ROOT = __dirname;
const C = p => path.join(ROOT, 'content', p);
const DIST = path.join(ROOT, 'dist');
const readJSON = p => JSON.parse(fs.readFileSync(C(p), 'utf8'));

const site = readJSON('data/site.json');
const sourcesArr = readJSON('data/sources.json');
const SOURCES = Object.fromEntries(sourcesArr.map(s => [s.id, s]));
const meetings = readJSON('data/meetings.json');
const corrections = readJSON('data/corrections.json');
const method = readJSON('data/method.json');
const glossary = readJSON('data/glossary.json');
const BASE = (process.env.BASE_PATH || site.base_path || '/').replace(/\/?$/, '/');
const BUILD_DATE = process.env.BUILD_DATE || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }); // YYYY-MM-DD, Pacific time
const KINDS = Object.keys(site.legend.en); // e.g. V, U, C
const TAG_RE = new RegExp(`\\[\\[([${KINDS.join('')}]):([\\w,\\s-]+)\\]\\]`, 'g');
const siteName = lang => (lang === 'es' && site.site_name_es) ? site.site_name_es : (site.site_name || 'Williams Civic Guide');
const USED_SOURCES = new Set();

const T = {
  en: { V: 'Verified', U: 'Unverified', C: 'Calculated',
        source: 'Source', sourcesOnPage: 'Sources cited on this page', accessed: 'accessed', updated: 'Page last updated',
        siteUpdated: 'Site last built', skip: 'Skip to main content', menu: 'Site sections', lang: 'Español',
        langName: 'es', other: 'Ver esta página en español', official: 'official', thirdParty: 'unofficial / third-party',
        nextMeeting: 'Next City Council meeting', confirm: 'Confirm before you go', legend: 'How to read the labels', home: 'Home', menuBtn: 'Menu', disclaimer: 'Full disclaimer', notice: 'Notice' },
  es: { V: 'Verificado', U: 'No verificado', C: 'Calculado',
        source: 'Fuente', sourcesOnPage: 'Fuentes citadas en esta página', accessed: 'consultado', updated: 'Última actualización de la página',
        siteUpdated: 'Sitio generado', skip: 'Saltar al contenido principal', menu: 'Secciones del sitio', lang: 'English',
        langName: 'en', other: 'View this page in English', official: 'oficial', thirdParty: 'no oficial / de terceros',
        nextMeeting: 'Próxima reunión del Concejo Municipal', confirm: 'Confirme antes de ir', legend: 'Cómo leer las etiquetas', home: 'Inicio', menuBtn: 'Menú', disclaimer: 'Aviso completo', notice: 'Aviso' }
};

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const url = p => BASE + p.replace(/^\//, '');
const pre = lang => (lang === 'es' ? 'es/' : '');

function fmtDate(iso, lang, opts = {}) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', Object.assign({ year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Los_Angeles' }, opts));
}

// ---------- citations ----------
function makeCiter(lang) {
  const used = []; // source ids in order
  function num(id) {
    if (!SOURCES[id]) throw new Error(`Unknown source id "${id}". Add it to content/data/sources.json`);
    USED_SOURCES.add(id);
    let i = used.indexOf(id);
    if (i === -1) { used.push(id); i = used.length - 1; }
    return i + 1;
  }
  function tag(kind, ids) {
    const label = T[lang][kind];
    const refs = ids.split(',').map(s => s.trim()).filter(Boolean).map(id => {
      const n = num(id);
      return `<a class="cite" href="#cite-${n}" aria-label="${esc(T[lang].source)} ${n}: ${esc(SOURCES[id].title)}">[${n}]</a>`;
    }).join('');
    return `<span class="tag tag-${kind.toLowerCase()}">${label}</span>${refs}`;
  }
  function list() {
    if (!used.length) return '';
    const items = used.map((id, i) => {
      const s = SOURCES[id];
      const kind = s.official ? T[lang].official : T[lang].thirdParty;
      return `<li id="cite-${i + 1}"><a href="${esc(s.url)}">${esc(s.title)}</a> <span class="src-meta">(${esc(s.publisher)}; ${kind}; ${T[lang].accessed} ${esc(s.accessed)})</span>${s.note ? ` <span class="src-note">${esc(lang === 'es' && s.note_es ? s.note_es : s.note)}</span>` : ''} <a class="src-more" href="${url(pre(lang) + 'reference/')}#src-${esc(id)}" aria-label="${lang === 'es' ? 'Detalles de la fuente' : 'Source details'}">↗</a></li>`;
    }).join('\n');
    return `<section class="page-sources" aria-labelledby="page-sources-h"><h2 id="page-sources-h">${T[lang].sourcesOnPage}</h2><ol>${items}</ol></section>`;
  }
  return { tag, list, num };
}
const hasTag = s => new RegExp(TAG_RE.source).test(s);
const tagify = (s, cite) => String(s).replace(TAG_RE, (_, k, ids) => cite.tag(k, ids));

// ---------- markdown ----------
const md = new MarkdownIt({ html: true, linkify: true, typographer: false });
const slug = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
md.use(anchor, { slugify: slug });
// Root-relative Markdown links (href="/layers/") get BASE. Links that url() already
// rooted at BASE must be left alone, or a non-root BASE_PATH is applied twice.
const fixLinks = html => html.replace(/href="\/(?!\/)/g, (match, offset, whole) => {
  if (BASE !== '/' && whole.startsWith(`href="${BASE}`, offset)) return match;
  return `href="${BASE}`;
});
const inline = (s, cite) => fixLinks(md.renderInline(tagify(s, cite)));

// ---------- meetings ----------
function thirdWednesday(y, m) { // m: 0-11
  const d = new Date(Date.UTC(y, m, 1));
  const first = (3 - d.getUTCDay() + 7) % 7 + 1;
  return new Date(Date.UTC(y, m, first + 14)).toISOString().slice(0, 10);
}
function upcomingMeetings(n) {
  const out = []; const [y0, m0] = BUILD_DATE.split('-').map(Number);
  for (let k = 0; out.length < n && k < 24; k++) {
    const y = y0 + Math.floor((m0 - 1 + k) / 12), m = (m0 - 1 + k) % 12;
    const iso = thirdWednesday(y, m);
    if (iso >= BUILD_DATE) out.push(iso);
  }
  return out;
}
function nextMeetingHTML(lang, cite) {
  const L = lang;
  const listed = meetings.meetings.filter(m => m.date >= BUILD_DATE).sort((a, b) => a.date.localeCompare(b.date));
  const m = listed[0];
  if (!m) {
    const d = upcomingMeetings(1)[0];
    return `<div class="card meeting-card"><h2>${T[L].nextMeeting}</h2><p class="big">${fmtDate(d, L, { weekday: 'long' })}, 6:00 PM</p><p>${cite.tag('C', 'city-council-page')} ${L === 'es' ? 'Calculado a partir del calendario de “tercer miércoles”.' : 'Calculated from the “third Wednesday” schedule.'} ${L === 'es' ? 'Confirme al' : 'Confirm at'} <a href="tel:+15302353270">(530) 235-3270</a>.</p></div>`;
  }
  const calcTag = m.calc_source ? cite.tag('C', m.calc_source) : '';
  const agendaTag = m.agenda_source ? cite.tag('V', m.agenda_source) : '';
  const items = (m.items || []).map(it => `<li>${esc(it[L] || it.en)} ${cite.tag(it.status || 'V', it.sources.join(','))}</li>`).join('');
  return `<div class="card meeting-card" id="next-meeting">
<h2>${T[L].nextMeeting}</h2>
<p class="big"><time datetime="${m.date}T${m.time}">${fmtDate(m.date, L, { weekday: 'long' })}, ${esc(m.time_label)}</time></p>
<p>${esc(m.place)}</p>
<p>${calcTag ? calcTag + ' ' + esc(m.calc_note[L]) : ''} ${agendaTag ? agendaTag + ' ' + esc(m.agenda_note[L]) : ''}</p>
<p class="confirm"><strong>${T[L].confirm}:</strong> <a href="tel:+15302353270">(530) 235-3270</a> · <a href="${esc(SOURCES['agenda-index'].url)}">${L === 'es' ? 'Página oficial de agendas' : 'Official agenda page'}</a></p>
${items ? `<details><summary>${L === 'es' ? 'En la agenda (selección)' : 'On the agenda (selected items)'}</summary><ul>${items}</ul></details>` : ''}
${m.agenda_caveat ? `<p class="small">${esc(m.agenda_caveat[L])}</p>` : ''}
</div>`;
}
function meetingListHTML(lang, cite) {
  const rows = upcomingMeetings(6).map(d => `<li><time datetime="${d}">${fmtDate(d, lang, { weekday: 'long' })}</time>, 6:00 PM</li>`).join('');
  return `<p>${cite.tag('C', 'city-council-page')} ${lang === 'es' ? 'Fechas calculadas (tercer miércoles de cada mes). Las reuniones pueden cambiar, cancelarse o agregarse; confirme siempre en la página oficial.' : 'Calculated dates (third Wednesday of each month). Meetings can move, be cancelled, or be added; always confirm on the official page.'}</p><ul class="dates">${rows}</ul>`;
}

// ---------- The Method: interactive checklist (stepper UI) ----------
function methodHTML(lang, cite) {
  const es = lang === 'es';
  const total = method.steps.reduce((a, s) => a + s.items.length, 0);
  const W = es ? 'Paso' : 'Step';
  const stepNav = method.steps.map((s, i) => `<li><a href="#step-${esc(s.id)}" data-step-link="${esc(s.id)}"><span class="sn-num" aria-hidden="true">${i + 1}</span><span class="sn-title">${esc(s.title[lang])}</span><span class="sn-count" data-step-count="${esc(s.id)}">0/${s.items.length}</span></a></li>`).join('');
  const steps = method.steps.map((s, i) => {
    const n = i + 1, next = method.steps[i + 1];
    const items = s.items.map(it => `<li><input type="checkbox" id="m-${esc(it.id)}" data-save="${esc(it.id)}"><label for="m-${esc(it.id)}">${inline(it[lang] || it.en, cite)}</label></li>`).join('');
    const nextLink = next
      ? `<a class="step-next" href="#step-${esc(next.id)}">${es ? 'Siguiente' : 'Next'}: ${W} ${n + 1}, ${esc(next.title[lang])} <span aria-hidden="true">↓</span></a>`
      : `<a class="step-next" href="#m-unknown">${es ? 'Siguiente: anote lo que todavía no sabe' : 'Next: write down what is still unknown'} <span aria-hidden="true">↓</span></a>`;
    return `<li class="step" id="step-${esc(s.id)}" data-step="${esc(s.id)}">
<div class="step-marker" aria-hidden="true"><span>${n}</span></div>
<div class="step-body">
<h3 id="step-${esc(s.id)}-h"><span class="step-n">${W} ${n}.</span> ${esc(s.title[lang])}</h3>
<p class="step-intro">${inline(s.intro[lang], cite)}</p>
<fieldset aria-labelledby="step-${esc(s.id)}-h"><legend class="visually-hidden">${W} ${n}: ${esc(s.title[lang])}</legend><ul class="checks">${items}</ul></fieldset>
<p class="step-source"><strong>${es ? 'Fuente' : 'Source'}:</strong> ${inline(s.source[lang], cite)}</p>
<p class="step-foot"><span class="step-count" data-step-count="${esc(s.id)}">0/${s.items.length}</span> ${nextLink}</p>
</div>
</li>`;
  }).join('\n');
  return `<section class="checklist" id="checklist" aria-labelledby="checklist-h" data-checklist="${esc(method.storage_key)}" data-total="${total}" data-lang="${lang}">
<h2 id="checklist-h">${es ? 'Su lista de verificación' : 'Your checklist'}</h2>
<p class="cl-note cl-nojs">${es ? 'Puede marcar las casillas, pero sin JavaScript no se guardan.' : 'You can tick the boxes, but without JavaScript they are not saved.'}</p>
<p class="cl-note cl-js" hidden>${es ? 'Sus marcas y notas se guardan automáticamente <strong>solo en este navegador</strong> (almacenamiento local). No se envía nada a ningún lado, no hace falta una cuenta y no hay rastreo. Si usa una computadora compartida, borre la lista al terminar.' : 'Your ticks and notes save automatically <strong>in this browser only</strong> (local storage). Nothing is sent anywhere, no account is needed, and there is no tracking. On a shared computer, clear the list when you finish.'}</p>
<p class="cl-field"><label for="m-section">${es ? 'Sección del código que está revisando (por ejemplo, el número y el título)' : 'Code section you are checking (for example, its number and title)'}</label>
<input type="text" id="m-section" data-save="section" autocomplete="off"></p>
<div class="cl-bar">
<div class="cl-bar-top"><p id="m-progress" class="cl-progress" role="status" aria-live="polite">${es ? `0 de ${total} puntos marcados.` : `0 of ${total} items ticked.`}</p></div>
<div class="meter" aria-hidden="true"><span data-meter style="width:0%"></span></div>
<nav class="stepper-nav" aria-label="${es ? 'Pasos del Método' : 'Method steps'}"><ol>${stepNav}</ol></nav>
</div>
<ol class="steps">
${steps}
</ol>
<div class="cl-end">
<p class="cl-field"><label for="m-unknown">${es ? 'Lo que todavía no sé (preguntas abiertas, fuentes por revisar)' : 'Still unknown (open questions, sources still to check)'}</label>
<textarea id="m-unknown" data-save="unknown" rows="5"></textarea></p>
<p class="cl-actions" hidden><button type="button" class="btn btn-danger" data-clear>${es ? 'Borrar mi lista' : 'Clear my checklist'}</button> <span class="small" id="m-save-status" role="status" aria-live="polite"></span></p>
</div>
</section>`;
}

// ---------- home page blocks ----------
const ICONS = {
  federal: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path d="M12 2 2 7v2h20V7L12 2zm-7 9v7H3v2h18v-2h-2v-7h-2v7h-3v-7h-2v7H9v-7H7v7H5v-7z" fill="currentColor"/></svg>',
  state: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" fill="currentColor"/></svg>',
  city: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path d="M3 21V10l5-3v3l5-3v4h3V4h4v17H3zm3-2h2v-3H6v3zm5 0h2v-3h-2v3zm5 0h2v-3h-2v3zm0-6h2v-2h-2v2z" fill="currentColor"/></svg>'
};
function layersDiagramHTML(lang, variant) {
  const es = lang === 'es';
  const base = url(pre(lang) + 'layers/');
  const L = es
    ? [['federal', '1. Federal', 'Constitución de EE. UU. y Carta de Derechos; leyes federales', 'nivel-1-federal'],
       ['state', '2. Estatal', 'Constitución de California; leyes estatales (códigos)', 'nivel-2-estatal'],
       ['city', '3. Ciudad', 'Código Municipal de Williams (ordenanzas del Concejo)', 'nivel-3-ciudad']]
    : [['federal', '1. Federal', 'U.S. Constitution and Bill of Rights; federal laws', 'layer-1-federal'],
       ['state', '2. State', 'California Constitution; state statutes (codes)', 'layer-2-state'],
       ['city', '3. City', 'Williams Municipal Code (council ordinances)', 'layer-3-city']];
  const cap = es
    ? '<strong>Diagrama:</strong> tres niveles, del más alto al más bajo. Un nivel inferior debe caber dentro de los de arriba.'
    : '<strong>Diagram:</strong> three layers, highest first. A lower layer must fit inside the ones above it.';
  const linked = variant === 'home';
  const box = (i) => {
    if (i >= L.length) return '';
    const [k, name, desc, anchor] = L[i];
    const nameHTML = linked ? `<a href="${base}#${anchor}">${name}</a>` : name;
    return `<div class="layer layer-${i + 1} layer-${k}"><p class="layer-name"><span class="layer-icon">${ICONS[k]}</span>${nameHTML}</p><p class="layer-desc">${desc}</p>${box(i + 1)}</div>`;
  };
  const wins = es ? 'Si chocan, normalmente gana el nivel más alto.' : 'When they clash, the higher layer usually wins.';
  return `<figure class="layers layers-${variant || 'page'}" aria-labelledby="layers-cap-${variant || 'page'}">
<figcaption id="layers-cap-${variant || 'page'}">${cap}</figcaption>
${box(0)}
<p class="layers-rule"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M12 3l7 7h-4v11H9V10H5z" fill="currentColor"/></svg> ${wins}</p>
</figure>`;
}
// Course-card icons (decorative; Valley Modern style, adopted Oct 19, 2026)
const pathIcon = (d) => `<span class="path-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg></span>`;
const PATH_ICONS = {
  'layers/': pathIcon('<path d="M12 3 2.5 8 12 13l9.5-5z"/><path d="m2.5 12 9.5 5 9.5-5"/><path d="m2.5 16 9.5 5 9.5-5"/>'),
  'method/': pathIcon('<rect x="5" y="3.5" width="14" height="18" rx="2"/><path d="M9 3.5h6v2.5H9z"/><path d="m8.5 11 1.5 1.5 3-3"/><path d="M14.5 11.5H16"/><path d="m8.5 16.5 1.5 1.5 3-3"/><path d="M14.5 17H16"/>'),
  'take-part/': pathIcon('<path d="M4 5.5h16v10H11l-4.5 3.5v-3.5H4z"/><path d="M8 9.5h8M8 12.5h5"/>'),
  'documents/': pathIcon('<path d="M7 3.5h8.5L19 7v13.5H7z"/><path d="M15 3.5V7.5h4"/><path d="M5 6v16h11"/><path d="M10 11h6M10 14h6M10 17h4"/>'),
};
function coursePathHTML(lang) {
  const es = lang === 'es';
  const total = method.steps.reduce((a, s) => a + s.items.length, 0);
  const P = pre(lang);
  const cards = es ? [
    ['layers/', 'Tres niveles de la ley', 'La ley federal, la estatal y la de la ciudad, y qué pasa cuando chocan.', 'Lección'],
    ['method/', 'El Método', 'Siete pasos para revisar cualquier norma de la ciudad, con una lista que puede ir marcando en pantalla. Sus marcas se quedan en su navegador.', 'Lista interactiva'],
    ['take-part/', 'Participe', 'Reuniones del Concejo, comentario público, la Ley Brown, los registros públicos y cómo los residentes pueden proponer o impugnar una ordenanza.', 'Guía práctica'],
    ['documents/', 'Documentos fundamentales', 'Las constituciones de EE. UU. y de California completas, con buscador (texto en inglés).', 'Consulta']
  ] : [
    ['layers/', 'Three layers of law', 'Federal, state and city law, and what happens when they clash.', 'Lesson'],
    ['method/', 'The Method', 'Seven steps to check any city rule, with a checklist you can tick on screen. Your ticks stay in your browser.', 'Interactive checklist'],
    ['take-part/', 'Take part', 'Council meetings, public comment, the Brown Act, public records, and how residents can propose or challenge an ordinance.', 'Practical guide'],
    ['documents/', 'Founding documents', 'The full U.S. and California constitutions, searchable.', 'Reference']
  ];
  const items = cards.map(([path, title, desc, kind], i) => {
    const prog = path === 'method/' ? `<div class="path-progress" data-progress-key="${esc(method.storage_key)}" data-total="${total}" data-lang="${lang}" hidden><div class="meter meter-sm" aria-hidden="true"><span data-meter style="width:0%"></span></div><p class="small" data-progress-text></p></div>` : '';
    return `<li class="path-card" id="path-${path.replace(/\/$/, '')}">${PATH_ICONS[path] || ''}<p class="path-kicker"><span class="path-num" aria-hidden="true">${i + 1}</span> <span class="visually-hidden">${es ? 'Parte' : 'Part'} ${i + 1}: </span>${esc(kind)}</p><h3><a class="card-link" href="${url(P + path)}">${esc(title)}</a></h3><p>${esc(desc)}</p>${prog}</li>`;
  }).join('');
  return `<ol class="path">${items}</ol>`;
}
function legendChipsHTML(lang) {
  const d = site.legend_short[lang];
  const more = url(pre(lang) + 'reference/') + '#labels';
  return `<ul class="chip-legend">${KINDS.map(k => `<li><span class="tag tag-${k.toLowerCase()}">${T[lang][k]}</span> <span>${esc(d[k])}</span></li>`).join('')}</ul>
<p class="small"><a href="${more}">${lang === 'es' ? 'Más sobre las etiquetas y nuestras reglas' : 'More about labels and our rules'}</a></p>`;
}
function disclaimerHTML(lang) {
  const D = site.disclaimer[lang];
  return `<div class="disclaimer-full">${D.map(p => `<p>${p}</p>`).join('')}</div>`;
}

// ---------- glossary ----------
function glossaryHTML(lang, cite) {
  const terms = glossary.terms.slice().sort((a, b) => a[lang].term.localeCompare(b[lang].term, lang === 'es' ? 'es' : 'en', { sensitivity: 'base' }));
  const ids = new Set();
  for (const t of glossary.terms) { if (ids.has(t.id)) throw new Error('Duplicate glossary id ' + t.id); ids.add(t.id); if (!hasTag(t.en.def) || !hasTag(t.es.def)) throw new Error(`Glossary term "${t.id}" needs a claim tag in both languages`); }
  const toc = terms.map(t => `<li><a href="#${esc(t.id)}">${esc(t[lang].term)}</a></li>`).join('');
  const dl = terms.map(t => `<div class="term" id="${esc(t.id)}"><dt>${esc(t[lang].term)}</dt><dd>${inline(t[lang].def, cite)}</dd></div>`).join('\n');
  return `<nav aria-labelledby="gl-toc" class="toc gl-toc"><h2 id="gl-toc">${lang === 'es' ? 'Términos' : 'Terms'} (${terms.length})</h2><ul>${toc}</ul></nav>
<h2 id="definitions">${lang === 'es' ? 'Definiciones' : 'Definitions'}</h2>
<dl class="glossary">${dl}</dl>`;
}

// ---------- reference blocks ----------
function sourcesTableHTML(lang) {
  const es = lang === 'es';
  const rows = sourcesArr.map(s => `<tr id="src-${esc(s.id)}"><td><a href="${esc(s.url)}">${esc(s.title)}</a></td><td>${esc(s.publisher)}</td><td>${s.official ? (es ? 'Oficial' : 'Official') : (es ? 'No oficial / terceros' : 'Unofficial / third-party')}</td><td><time datetime="${esc(s.accessed)}">${esc(s.accessed)}</time></td><td>${esc((es && s.note_es) || s.note || '')}</td></tr>`).join('');
  return `<div class="table-wrap" role="region" aria-labelledby="src-cap" tabindex="0"><table class="sources"><caption id="src-cap">${es ? 'Todas las fuentes usadas en este sitio' : 'All sources used on this site'}</caption><thead><tr><th scope="col">${es ? 'Fuente' : 'Source'}</th><th scope="col">${es ? 'Editor' : 'Publisher'}</th><th scope="col">${es ? 'Tipo' : 'Type'}</th><th scope="col">${es ? 'Consultado' : 'Accessed'}</th><th scope="col">${es ? 'Notas' : 'Notes'}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function correctionsHTML(lang) {
  if (!corrections.length) return `<p>${lang === 'es' ? 'Todavía no hay correcciones.' : 'No corrections yet.'}</p>`;
  return `<ul class="corrections">${corrections.map(c => `<li><time datetime="${c.date}">${c.date}</time>: ${esc(c[lang] || c.en)}${c.page ? ` (<a href="${url(pre(lang) + c.page)}">${esc(c.page)}</a>)` : ''}</li>`).join('')}</ul>`;
}
function legendHTML(lang) {
  const d = site.legend[lang];
  return `<details class="legend"><summary>${T[lang].legend}</summary><dl>${KINDS.map(k => `<dt><span class="tag tag-${k.toLowerCase()}">${T[lang][k]}</span></dt><dd>${esc(d[k])}</dd>`).join('')}</dl></details>`;
}

function docSearchHTML(lang) {
  const es = lang === 'es';
  const idx = [url('assets/data/us-constitution-search.json'), url('assets/data/ca-constitution-search.json')].join(' ');
  return `<div class="doc-search doc-search-hero" data-scope="all" data-index="${idx}" data-lang="${lang}" hidden>
<label for="q-all">${es ? 'Busque en las dos constituciones (texto en inglés)' : 'Search both constitutions'}</label>
<div class="search-field"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M10 3a7 7 0 0 1 5.6 11.2l5.1 5.1-1.4 1.4-5.1-5.1A7 7 0 1 1 10 3zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" fill="currentColor"/></svg><input id="q-all" type="search" autocomplete="off" aria-describedby="q-all-hint q-all-status" placeholder="${es ? 'p. ej. free speech, jury, recall' : 'e.g. free speech, jury, recall'}"></div>
<p id="q-all-hint" class="small">${es ? 'Escriba al menos 3 letras. Los resultados enlazan a la sección exacta.' : 'Type at least 3 letters. Results link to the exact section.'}</p>
<p id="q-all-status" class="small" role="status" aria-live="polite"></p><ol class="search-results" id="q-all-results"></ol></div>`;
}

// ---------- layout ----------
function nav(lang, current) {
  return site.nav.map(n => {
    const href = url(pre(lang) + n.path);
    const cur = current === n.path ? ' aria-current="page"' : '';
    return `<li${n.path === '' ? ' class="nav-home"' : ''}><a href="${href}"${cur}>${esc((n.short && n.short[lang]) || n[lang])}</a></li>`;
  }).join('');
}
const LOGO = '<svg class="logo" viewBox="0 0 32 32" width="32" height="32" aria-hidden="true" focusable="false"><rect width="32" height="32" rx="8" fill="var(--brand)"/><rect x="5" y="6" width="22" height="20" rx="4" fill="none" stroke="var(--on-brand)" stroke-width="2.2"/><rect x="9" y="11" width="14" height="11" rx="3" fill="none" stroke="var(--on-brand)" stroke-width="2.2" opacity=".85"/><rect x="13" y="15.5" width="6" height="4.5" rx="1.5" fill="var(--warm-2)"/></svg>';
function reviewNotice(lang, review) {
  if (lang !== 'es' || review !== 'pending') return '';
  const who = (site.es_review && site.es_review.reviewer) || 'un hablante nativo';
  return `<div class="review-note" role="note" aria-label="Estado de la traducción"><p><strong>Traducción pendiente de revisión por ${esc(who)}.</strong> Si algo no se entiende, la versión en inglés es la de referencia.</p></div>`;
}
// Inner pages: wrap the leading breadcrumb + <h1> in a .page-head band (small valley motif in CSS). Content is unchanged.
function pageHead(body, pageClass) {
  if (/\bpage-home\b/.test(pageClass)) return body;
  return body.replace(/^(\s*)((?:<p class="crumbs">[\s\S]*?<\/p>\s*)?<h1\b[\s\S]*?<\/h1>)/, '$1<div class="page-head">$2</div>');
}
function layout({ lang, title, description, body, navKey, altHref, updated, extraHead = '', review = '', pageClass = '' }) {
  const t = T[lang];
  const B = site.banner[lang];
  const name = siteName(lang);
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} | ${esc(name)}</title>
<meta name="description" content="${esc(description || site.description[lang])}">
<meta name="robots" content="${site.noindex ? 'noindex, nofollow' : 'index,follow'}">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#3f5320" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#141912" media="(prefers-color-scheme: dark)">
<script>document.documentElement.className += ' js';</script>
${review ? `<meta name="translation-review" content="${esc(review)}">` : ''}
${altHref ? `<link rel="alternate" hreflang="${t.langName}" href="${altHref}">` : ''}
<link rel="preload" href="${url('assets/fonts/figtree-var.woff2')}" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${url('assets/fonts/outfit.woff2')}" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${url('assets/css/site.css')}">
<link rel="icon" href="data:,">
${extraHead}
</head>
<body class="${esc(pageClass)}">
<a class="skip-link" href="#main">${t.skip}</a>
<header class="site-header">
<div class="banner" role="note" aria-label="${t.notice}"><p class="wrap-wide"><strong>${esc(B.strong)}</strong> <a href="${url(pre(lang) + 'reference/')}#disclaimer">${t.disclaimer}</a></p></div>
<div class="wrap-wide header-row">
<a class="brand" href="${url(pre(lang))}">${LOGO}<span class="brand-name">${esc(name)}</span></a>
<nav aria-label="${t.menu}" class="site-nav">
<button type="button" class="menu-btn" aria-expanded="false" aria-controls="site-menu" hidden><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path class="mb-open" d="M3 6h18v2.2H3zm0 5h18v2.2H3zm0 5h18v2.2H3z" fill="currentColor"/><path class="mb-close" d="M6.2 4.6 12 10.4l5.8-5.8 1.6 1.6-5.8 5.8 5.8 5.8-1.6 1.6-5.8-5.8-5.8 5.8-1.6-1.6 5.8-5.8-5.8-5.8z" fill="currentColor"/></svg><span class="menu-label">${t.menuBtn}</span></button>
<ul class="nav" id="site-menu">${nav(lang, navKey)}</ul>
</nav>
${altHref ? `<a class="lang-switch" href="${altHref}" lang="${t.langName}" hreflang="${t.langName}">${t.lang}<span class="visually-hidden"> (${t.other})</span></a>` : ''}
</div>
</header>
<main id="main" tabindex="-1" class="${/page-(home|doc-us|doc-ca|doc-index)\b/.test(pageClass) ? 'wrap-wide' : 'wrap'}">
${reviewNotice(lang, review)}
${pageHead(body, pageClass)}
<p class="updated">${t.updated}: <time datetime="${updated}">${fmtDate(updated, lang)}</time> · ${t.siteUpdated}: <time datetime="${BUILD_DATE}">${fmtDate(BUILD_DATE, lang)}</time></p>
</main>
<footer class="site-footer"><div class="wrap-wide">
<p class="footer-brand">${LOGO}<span>${esc(name)}</span></p>
<p>${esc(site.footer[lang])}</p>
<p><a href="${url(pre(lang) + 'reference/')}">${lang === 'es' ? 'Referencias y fuentes' : 'Reference & sources'}</a> · <a href="${esc(site.official_url)}">cityofwilliams.org</a> · <a href="${url(pre(lang) + 'reference/')}#report-error">${lang === 'es' ? 'Reportar un error' : 'Report an error'}</a></p>
</div></footer>
<script src="${url('assets/js/site.js')}" defer></script>
</body>
</html>`;
}

function renderPage(file, lang) {
  const raw = fs.readFileSync(file, 'utf8');
  const { data: fm, content } = matter(raw);
  const cite = makeCiter(lang);
  // block shortcodes first (they produce HTML; keep them on their own line)
  let src = content
    .replace(/\{\{site-name\}\}/g, () => esc(siteName(lang)))
    .replace(/\{\{next-meeting\}\}/g, () => nextMeetingHTML(lang, cite))
    .replace(/\{\{meeting-list\}\}/g, () => meetingListHTML(lang, cite))
    .replace(/\{\{method-checklist\}\}/g, () => methodHTML(lang, cite))
    .replace(/\{\{glossary\}\}/g, () => glossaryHTML(lang, cite))
    .replace(/\{\{sources-table\}\}/g, () => sourcesTableHTML(lang))
    .replace(/\{\{corrections\}\}/g, () => correctionsHTML(lang))
    .replace(/\{\{legend\}\}/g, () => legendHTML(lang))
    .replace(/\{\{legend-chips\}\}/g, () => legendChipsHTML(lang))
    .replace(/\{\{layers-diagram(?::(\w+))?\}\}/g, (_, v) => layersDiagramHTML(lang, v))
    .replace(/\{\{course-path\}\}/g, () => coursePathHTML(lang))
    .replace(/\{\{disclaimer\}\}/g, () => disclaimerHTML(lang))
    .replace(/\{\{doc-search\}\}/g, () => docSearchHTML(lang))
    .replace(/\{\{site-updated\}\}/g, () => fmtDate(BUILD_DATE, lang));
  if (/\{\{[\w:-]+\}\}/.test(src)) throw new Error(`${file}: unknown shortcode ${src.match(/\{\{[\w:-]+\}\}/)[0]}`);
  if (/\[\[[A-Z]:/.test(src.replace(TAG_RE, ''))) throw new Error(`${file}: claim tag with an unknown label (allowed: ${KINDS.join(', ')})`);
  src = tagify(src, cite);
  let html = fixLinks(md.render(src));
  html += cite.list();
  return { fm, html };
}

function outPathFor(rel, lang) {
  const noext = rel.replace(/\.md$/, '');
  const pagePath = noext === 'index' ? '' : noext.replace(/\/index$/, '') + '/';
  return { pagePath, file: path.join(DIST, lang === 'es' ? 'es' : '', pagePath, 'index.html') };
}

function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => d.isDirectory() ? walk(path.join(dir, d.name)) : d.name.endsWith('.md') ? [path.join(dir, d.name)] : []); }
function write(file, s) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, s); }
function copyDir(a, b) { fs.mkdirSync(b, { recursive: true }); for (const d of fs.readdirSync(a, { withFileTypes: true })) { const s = path.join(a, d.name), t = path.join(b, d.name); d.isDirectory() ? copyDir(s, t) : fs.copyFileSync(s, t); } }

const foundational = require('./tools/foundational-pages.js');

function main() {
  fs.rmSync(DIST, { recursive: true, force: true });
  copyDir(path.join(ROOT, 'assets'), path.join(DIST, 'assets'));
  const pages = [];
  const pendingES = [];
  for (const lang of ['en', 'es']) {
    const dir = C('pages/' + lang);
    for (const file of walk(dir)) {
      const rel = path.relative(dir, file).split(path.sep).join('/');
      const { pagePath, file: out } = outPathFor(rel, lang);
      const otherLang = lang === 'en' ? 'es' : 'en';
      const otherFile = C(`pages/${otherLang}/${rel}`);
      if (!fs.existsSync(otherFile)) console.warn(`WARNING: ${lang}/${rel} has no ${otherLang} version`);
      const altHref = fs.existsSync(otherFile) ? url(pre(otherLang) + pagePath) : null;
      const { fm, html } = renderPage(file, lang);
      if (!fm.title || !fm.updated) throw new Error(`${file}: front matter needs "title" and "updated"`);
      const updated = fm.updated instanceof Date ? fm.updated.toISOString().slice(0, 10) : String(fm.updated);
      const navKey = fm.nav || pagePath;
      const review = lang === 'es' ? String(fm.review || 'reviewed') : '';
      if (review === 'pending') pendingES.push(rel);
      const pageClass = 'page-' + (fm.page_class || (pagePath === '' ? 'home' : pagePath.replace(/\/$/, '').replace(/\//g, '-')));
      write(out, layout({ lang, title: fm.title, description: fm.description, body: html, navKey, altHref, updated, review, pageClass }));
      pages.push({ lang, path: pre(lang) + pagePath, title: fm.title, updated, ...(lang === 'es' ? { review } : {}) });
    }
  }
  const extra = foundational.build({ layout, write, url, esc, DIST, BASE, ROOT, SOURCES, makeCiter, T, BUILD_DATE });
  pages.push(...extra);
  const origin = (process.env.SITE_ORIGIN || site.origin || '').replace(/\/$/, '');
  write(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(p => `<url><loc>${origin}${url(p.path)}</loc><lastmod>${p.updated}</lastmod></url>`).join('\n')}\n</urlset>\n`);
  write(path.join(DIST, '404.html'), layout({ lang: 'en', title: 'Page not found', body: `<h1>Page not found</h1><p>This page may have been removed when the site was reorganized. Try the <a href="${url('')}">home page</a>.</p><p lang="es">Página no encontrada. Puede que se haya quitado al reorganizar el sitio. Vaya a <a href="${url('es/')}">Inicio</a>.</p>`, navKey: '', altHref: null, updated: BUILD_DATE, pageClass: 'page-404' }));
  write(path.join(DIST, 'robots.txt'), site.noindex ? 'User-agent: *\nDisallow: /\n' : 'User-agent: *\nAllow: /\n');
  fs.writeFileSync(path.join(DIST, '.nojekyll'), '');
  write(path.join(DIST, 'pages.json'), JSON.stringify(pages, null, 1));
  const unused = sourcesArr.map(s => s.id).filter(id => !USED_SOURCES.has(id));
  if (unused.length) console.warn(`WARNING: sources never cited (remove them or cite them): ${unused.join(', ')}`);
  console.log(`Built ${pages.length} pages into dist/ (site name "${siteName('en')}", base path ${BASE}, build date ${BUILD_DATE}, noindex ${site.noindex ? 'on' : 'OFF'})`);
  if (pendingES.length) {
    console.log(`Spanish pages pending review by ${(site.es_review || {}).reviewer || '?'}: ${pendingES.length} (${pendingES.join(', ')})`);
    if (process.env.REQUIRE_ES_REVIEW === '1') { console.error('REQUIRE_ES_REVIEW=1: Spanish review still pending. Failing.'); process.exit(1); }
  }
}
main();
