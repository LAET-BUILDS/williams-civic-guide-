# Home-page style directions (reference only)

**Adopted Oct 19, 2026: B · Valley Modern** is now the live style on every page. It is merged into
`assets/css/site.css` (sections 1, 3, 4 and 5), with its fonts in `assets/fonts/` and the landscape art in `assets/img/`.
The files here are kept for reference only; the production build (`npm run build`) does not read them, and the
preview scripts now live in `themes/preview-tools/` (their output folder `_themes-preview/` was deleted).

Original note: three themes layered on top of the v2 `assets/css/site.css`.

| Key | Direction | Fonts (local WOFF2, Latin + Latin-1 subset) | Theme file |
|---|---|---|---|
| A | Civic Editorial | Newsreader (display) + Public Sans (body), about 65 KB | `a-civic-editorial.css` |
| B | Valley Modern | Outfit (display) + Figtree (body), about 39 KB, plus `valley-hero*.svg` (2 KB) | `b-valley-modern.css` |
| C | Founders Archival | EB Garamond (display, true small caps) + Libre Caslon Text (body), about 107 KB | `c-founders-archival.css` |

`base.css` holds the parts all three share: spacing scale, type scale, the course-card icon slot, and hover, focus and motion polish.
Each theme has light and dark (`prefers-color-scheme`) palettes.

```bash
npm run build                      # dist/ as usual (the live build; already Valley Modern)
# note: previews built on top of the v3 site.css are no longer a clean comparison; use the v2 backup
# /workspace/williams-site-v2-backup-2026-10-19.tgz to reproduce the original previews
node themes/preview-tools/build-themes.js         # -> _themes-preview/A|B|C/ (only / and /es/ are themed)
for k in A:8091 B:8092 C:8093; do python3 -m http.server ${k#*:} --directory _themes-preview/${k%:*} & done
node themes/preview-tools/shoot-themes.js /workspace/shots/styles      # phone 430 + desktop 1280, full page
node themes/preview-tools/a11y-themes.js                               # axe WCAG 2.1 A/AA, EN+ES, light/dark, menu open
```

To adopt one: append `base.css` and the chosen theme to `site.css` (or link them), copy its fonts to `assets/`,
and add the four card icons from `tools/build-themes.js` to the home template in `build.js`.
