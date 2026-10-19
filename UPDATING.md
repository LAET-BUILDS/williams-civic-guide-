# Updating the site

You only edit text files in `content/`. Then rebuild. No database, no admin panel.

```bash
npm run build                      # rebuild dist/ (uses today's date, Pacific time)
npm run serve                      # preview at http://localhost:8080
```

The "Next meeting" box on **Take part** is chosen **at build time**. Rebuild after each meeting.
To preview as of another day: `BUILD_DATE=2026-10-22 npm run build`.
If the site is ever hosted under a sub-folder, build with `BASE_PATH=/williams/ npm run build`.
Write links in Markdown as `/take-part/` (English) or `/es/take-part/` (Spanish); the prefix is added for you.

---

## 1. Ground rules (please keep these)

1. **Unofficial education, not legal advice.** No lawyer reviews this site. Never write anything that tells a reader
   whether a specific rule is valid or what they should do in their own case. Teach the questions, link the sources.
2. **Every legal claim gets a label and a source.** Use the claim tags below. The build **fails** if a tag points to a
   source id that is not in `content/data/sources.json`, or uses a label other than V, U or C.
3. **Never invent legal facts.** Use only what you read in a cited source. If you only saw a summary, a search
   snippet, or you are writing from general knowledge, label it `U`. Do not cite a court case unless you have
   confirmed it exists (CourtListener) and read what it decided.
4. **No worked examples for now.** The v2 decision (Oct 18, 2026) removed the examples section. Do not add analysis of
   specific Williams code sections ("this section may be unlawful") without a new decision.
5. **Always update both languages** (`content/pages/en/` and `content/pages/es/`). See §2 for the review flag.
6. Change `updated:` in the page's front matter whenever you change its facts.

## 2. Spanish pages and the review flag

Every Spanish page has `review: pending` in its front matter. While it is there, the page shows a visible notice:
"Traducción pendiente de revisión por bino" (the name comes from `es_review.reviewer` in `site.json`), and the
build prints the list of pending pages.

When bino has reviewed a page, change its front matter to `review: done` (any value other than `pending`) and rebuild.
The Method checklist text (`content/data/method.json`) and glossary (`content/data/glossary.json`) are part of the
`method.md` and `glossary.md` pages; review them together.

Before going public, run `npm run check:es-review`: it fails while any Spanish page is still pending.
If you change Spanish text later, set `review: pending` again.

Write plain, natural Spanish. Quotes from English-only legal texts are marked "traducción no oficial".

## 3. Claim tags (use inside any Markdown page, and inside method.json / glossary.json text)

| Tag | Shows as | Use when |
|---|---|---|
| `[[V:source-id]]` | **Verified** | You read it yourself in the cited document. |
| `[[U:source-id]]` | **Unverified** | From a summary, search snippet, notes or general knowledge; or you could not open the source. |
| `[[C:source-id]]` | **Calculated** | You computed it (e.g. "third Wednesday" dates). Cite the inputs. |

Several sources: `[[V:archives-bor,archives-11-27]]`. Each tag becomes a label plus numbered citations, and the
page gets a "Sources cited" list at the bottom. For plain-language definitions from general knowledge, use
`[[U:volunteer-definitions]]`.

**To upgrade U to V:** open the official source in a normal browser (leginfo for statutes, Municode for the city code),
read the exact text, update the source's `accessed` date in `sources.json`, and change the tag to `V`.

## 4. Change the site name

Edit `site_name` in `content/data/site.json` (default "Williams Civic Guide"). If the Spanish name should differ,
fill in `site_name_es`. The name appears in the header, page titles and the home page heading (`{{site-name}}`).

## 5. Add a source

Add an object to `content/data/sources.json` (ids are lower-case-with-dashes and never change once used):

```json
{"id": "packet-2026-11-18", "title": "City Council agenda packet, November 18, 2026", "publisher": "City of Williams",
 "official": true, "url": "https://www.cityofwilliams.org/....pdf", "accessed": "2026-11-14",
 "note": "Agenda and staff reports.", "note_es": "Agenda e informes del personal."}
```

Spaces in URLs must be written `%20`. The Reference page lists every source automatically. The build warns about
sources that no page cites; remove them or cite them.

## 6. Edit The Method checklist

Steps and items are in `content/data/method.json`, English and Spanish side by side. Each step has `title`, `intro`,
`items` and a `source` line (Markdown with claim tags).

**Item ids are stored in visitors' browsers.** Keep an id when you only fix wording. If you change what an item
means, give it a new id (old ticks for the old id are then ignored). If you restructure the whole list, change
`storage_key` (e.g. to `wcg-method-v2`) so everyone starts fresh. Do not add anything that sends data off the device.

## 7. Edit the glossary

Terms are in `content/data/glossary.json`. Each needs an `id` (the `#anchor`, same in both languages), and an
`en` and `es` `term` and `def`. Every definition must contain a claim tag in both languages, or the build fails.
Link to a term from any page with `[ordinance](/glossary/#ordinance)` or `(/es/glossary/#ordinance)`.

## 8. Add a new council meeting

1. When the agenda is posted, add the packet to `sources.json` (§5).
2. Add a meeting object to `meetings` in `content/data/meetings.json`. Copy the existing one and change the date,
   `agenda_source`, notes and `items`. Each item needs `status` (`V` or `U`) and `sources`.
3. Before the agenda is posted, leave out `agenda_source`/`agenda_note`/`items`; the box shows the date as
   **Calculated** and tells readers to call to confirm. With no future meeting listed, it falls back to the next
   calculated third Wednesday.
4. Rebuild and check `/take-part/` in English and Spanish.

## 9. Add a new page

1. Create `content/pages/en/<name>.md` and `content/pages/es/<name>.md` (same file name). Front matter needs
   `title`, `description` and `updated`; the Spanish file also gets `review: pending`.
2. To add it to the menu, add `{"path": "<name>/", "en": "...", "es": "..."}` to `nav` in `site.json`.
   Sub-pages can set `nav: parent-path/` to highlight the parent menu item.
3. Rebuild and run the checks (§12).

## 10. Log a correction

Add to `content/data/corrections.json` (newest first), then fix the page and change its `updated:` date:

```json
{"date": "2026-11-02", "page": "take-part/", "en": "We said X; the record says Y. Fixed.", "es": "Dijimos X; el registro dice Y. Corregido."}
```

## 11. Founding documents

- **U.S. Constitution**: National Archives transcriptions. **California Constitution**: extracted from the California
  State Senate's 2025-26 PDF. Unofficial summaries are in `content/foundational/summaries.json`.
- To refresh after the Constitution changes: `tools/fetch_foundational.sh`, then `npm run build`. The PDF loses
  "fi/ff/fl" letter pairs; the extractor restores them and logs each change in `content/foundational/ca-ligature-log.json`.
- **Brown Act and Public Records Act** full text is not copied in (leginfo blocks automated downloads and we do not
  bypass that). The guides are at `content/pages/*/take-part/brown-act.md` and `public-records-act.md`.

## 12. Before publishing any change

```bash
npm run build
npm run serve &            # or in another terminal
npm run check:links        # 0 broken internal links/anchors expected
npm run test:a11y          # 0 WCAG A/AA violations expected
npm run test:smoke         # all checks PASS expected
```

Also check by hand: keyboard only (Tab, Space to tick), phone width, and zoom to 200%.

## 13. Going public checklist (nothing is deployed yet)

- bino reviews every Spanish page; `npm run check:es-review` passes.
- Upgrade as many `U` claims as possible to `V` from official sources.
- Add a real contact (email or form) on the Reference page (`[maintainer to add...]` placeholder, EN and ES).
- Choose the final site name (`site_name`).
- Only then: set `"noindex": false` and `"origin"` in `site.json`, and pick a host (`netlify.toml` and
  `docs/github-pages-workflow.yml` are kept as options; neither is connected).

## v2 design (Oct 18, 2026)
- Header menu labels: `nav[].short` in `content/data/site.json`. The one-line disclaimer strip uses `banner.strong`; the full disclaimer (`disclaimer[]`) appears only on the Reference page via `{{disclaimer}}`.
- New blocks: `{{layers-diagram}}` (add `:home` for the linked home version), `{{course-path}}` (home cards; The Method card reads checklist progress from localStorage), `{{legend-chips}}` (uses `legend_short`), `{{doc-search}}` (searches both constitutions).
- Styles: `assets/css/site.css` (color tokens at the top, dark mode in the `prefers-color-scheme: dark` block). Screenshots: `node tools/screenshots.js /workspace/shots/v2` with the local server running.
