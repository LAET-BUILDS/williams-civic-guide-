#!/usr/bin/env bash
# Re-download the official sources for the Foundational Documents section, then extract.
# Only official/public-domain sources. Do NOT add code that bypasses bot checks
# (leginfo.legislature.ca.gov and constitution.congress.gov block automated requests).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p _raw
UA="Mozilla/5.0 (citizen-info-site builder)"
html2txt() { python3 - "$1" "$2" <<'PY'
import re, html, sys
s = open(sys.argv[1], encoding='utf-8').read()
t = re.sub(r'<script.*?</script>|<style.*?</style>', '', s, flags=re.S)
t = re.sub(r'<(h[1-6]|p|br|div|li)[^>]*>', '\n', t)
t = html.unescape(re.sub(r'<[^>]+>', '', t))
open(sys.argv[2], 'w').write(re.sub(r'\n\s*\n+', '\n\n', t))
PY
}
curl -sfL -A "$UA" -o _raw/us-constitution.html https://www.archives.gov/founding-docs/constitution-transcript
curl -sfL -A "$UA" -o _raw/us-bill-of-rights.html https://www.archives.gov/founding-docs/bill-of-rights-transcript
curl -sfL -A "$UA" -o _raw/us-amendments-11-27.html https://www.archives.gov/founding-docs/amendments-11-27
for n in us-constitution us-bill-of-rights us-amendments-11-27; do html2txt _raw/$n.html _raw/$n.txt; done
curl -sfL -A "$UA" -o _raw/ca_us_const.pdf https://www.senate.ca.gov/system/files/2026-04/2025-26_california_and_us_constitution.pdf
pdftotext _raw/ca_us_const.pdf _raw/ca_us_const.txt 2>/dev/null
[ -d .venv ] || { python3 -m venv .venv && .venv/bin/pip install --quiet pyspellchecker; }
.venv/bin/python tools/extract_foundational.py
echo "Done. Review content/foundational/ca-ligature-log.json, then: npm run build"
