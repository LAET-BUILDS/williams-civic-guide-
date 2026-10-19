# Williams Civic Guide (unofficial): prototype v3

An **unofficial, resident-run** civic education site for Williams, California (Colusa County). It is a short
course: learn the **three layers of law** (federal, state, city), then use **The Method** to check any section
of the Williams Municipal Code against the laws above it. English and Spanish.

- **Unofficial education, not legal advice.** No lawyer has reviewed it; the banner and footer say so on every page.
- Every legal claim is labeled **Verified** or **Unverified** (or **Calculated** for meeting dates) and links to its source.
- **Status: prototype, not deployed.** `noindex` is on and `robots.txt` disallows everything (`content/data/site.json`).
- **Site name** is one setting: `site_name` in `content/data/site.json` (default "Williams Civic Guide").
- **Spanish pages are marked "pending review by bino"** (front matter `review: pending`); see UPDATING.md §2.

Plan: `PLAN-v2.md` (decisions applied Oct 18, 2026: bilingual launch, interactive checklist, no worked examples,
no attorney, cut pages deleted). A backup of the v1 site is at `/workspace/williams-site-v1-backup-2026-10-18.tgz`; the v2 site (before the v3 restyle) is at `/workspace/williams-site-v2-backup-2026-10-19.tgz`.

**Style (v3, Oct 19, 2026): "Valley Modern"** (theme B from `themes/`): Outfit + Figtree local fonts, warm cream/olive/gold/sky palette, rounded cards, pill buttons and chips, light + dark. The SVG valley landscape is on the home hero; inner pages have a small motif in their header band.

## Pages (EN at `/`, ES at `/es/`)

| Page | Path |
|---|---|
| Home | `/` |
| Three layers of law (diagram, preemption, "which rule wins?" self-check) | `/layers/` |
| The Method (7 steps, interactive checklist) | `/method/` |
| Take part (meetings, public comment, Brown Act, public records, initiative and referendum) | `/take-part/` |
| Brown Act guide · Public Records Act guide | `/take-part/brown-act/` · `/take-part/public-records-act/` |
| Founding documents (U.S. and CA constitutions, full text, searchable; text in English) | `/documents/` |
| Glossary (34 terms) | `/glossary/` |
| Reference (official links: Municode, leginfo, CourtListener; all sources; corrections; report an error) | `/reference/` |

## Preview locally

```bash
cd /workspace/williams-site
npm install            # first time only
npm run build          # writes dist/
npm run serve          # http://localhost:8080  (Ctrl+C to stop)
```

Checks (with the server running in another terminal):

```bash
npm run check:links    # every internal link and #anchor resolves
npm run test:a11y      # axe-core WCAG 2.1 A/AA scan of every page, mobile + desktop
npm run test:smoke     # skip link, noindex, nav, ES review flag, searches, checklist save/clear, no 3rd-party requests
npm run check:overflow # no horizontal scroll at 320/375/430/1280 px (phone menu open too)
```

## The Method checklist

Plain HTML checkboxes, enhanced by `assets/js/site.js`. Ticks, the "section you are checking" field and the
"still unknown" notes are saved in the visitor's browser (`localStorage` key `wcg-method-v1`) and nowhere else:
no account, no cookies, no analytics, no network requests. Without JavaScript the boxes still work but are not saved
(the page says so). A "Clear my checklist" button removes the saved data. Steps and items live in
`content/data/method.json` (EN + ES in one file, so both languages stay in sync).

## Layout

| Path | What it is |
|---|---|
| `content/pages/en/**.md`, `content/pages/es/**.md` | Page text (Markdown). Same file name in both folders = translations, linked automatically. |
| `content/data/site.json` | Site name, banner, footer, navigation, label definitions, noindex, Spanish reviewer. |
| `content/data/method.json` | The Method steps and checklist items (EN/ES). |
| `content/data/glossary.json` | Glossary terms (EN/ES), each with a claim tag. |
| `content/data/sources.json` | Every source: id, title, URL, publisher, official or not, date accessed. |
| `content/data/meetings.json` | Next Council meeting (drives the Take part "Next meeting" box). |
| `content/data/corrections.json` | Public corrections log. |
| `content/foundational/` | U.S. and CA Constitution text (generated JSON) and unofficial summaries. |
| `build.js`, `tools/foundational-pages.js` | The builder (no framework; Node + markdown-it). |
| `tools/` | Extraction, accessibility, link and smoke tests. |
| `assets/` | One CSS file, one small optional JS file (search + checklist), two local WOFF2 fonts (`fonts/`: Outfit and Figtree, SIL Open Font License 1.1; about 39 KB, preloaded) and three small SVGs (`img/`). No third-party requests or scripts. |
| `themes/` | The three style directions (reference only; B is merged into `site.css`). Preview scripts in `themes/preview-tools/`. |
| `dist/` | Built site (static files; not deployed). |

## Not finished

- Spanish text needs bino's review (9 pages + checklist + glossary). `npm run check:es-review` fails until every ES page is marked reviewed.
- Many legal claims are still **Unverified** (leginfo and Municode blocked automated access). Confirm them in a normal browser and switch the tag to `V`.
- The Reference page's "Report an error" contact is a placeholder.
- The full-text constitution pages are English only (the Spanish site links to them and says so).

See **UPDATING.md** for how to edit content.
