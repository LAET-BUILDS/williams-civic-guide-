#!/usr/bin/env python3
"""Extract foundational-document text from saved OFFICIAL sources into JSON.

Sources (saved under _raw/ by tools/fetch_foundational.sh):
  - National Archives transcriptions (archives.gov): Constitution, Bill of Rights, Amendments 11-27
  - California Senate, "Constitutions of California and the United States" 2025-26 PDF
    (California Constitution as last amended Nov 5, 2024)

No text is written by hand. The only automated change to the California text is
restoring the ff/fi/fl ligature letters that pdftotext drops (e.g. "efect" -> "effect").
Every restoration is logged in content/foundational/ca-ligature-log.json.
"""
import json, re, os, sys, html, collections
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, '_raw')
OUT = os.path.join(ROOT, 'content', 'foundational')

def blocks(path, start, end):
    lines = open(path, encoding='utf-8').read().split('\n')
    s = next(i for i, l in enumerate(lines) if l.strip().startswith(start))
    e = next(i for i in range(s + 1, len(lines)) if lines[i].strip().startswith(end))
    out, cur = [], []
    for l in lines[s:e]:
        if l.strip():
            cur.append(l.strip())
        elif cur:
            out.append(' '.join(cur)); cur = []
    if cur: out.append(' '.join(cur))
    return out

def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')

# ---------- U.S. Constitution ----------
def us_constitution():
    b = blocks(os.path.join(RAW, 'us-constitution.txt'), 'We the People', 'For biographies')
    parts = [{'id': 'preamble', 'title': 'Preamble', 'sections': [{'id': 'preamble', 'label': '', 'paras': [b[0]]}]}]
    cur_art = None; cur_sec = None
    for blk in b[1:]:
        m = re.match(r'^Article\.\s*([IVX]+)\.?$', blk)
        if m:
            cur_art = {'id': 'article-' + m.group(1).lower(), 'title': 'Article ' + m.group(1), 'sections': []}
            parts.append(cur_art); cur_sec = None; continue
        m = re.match(r'^Section\.?\s*(\d+)\.?$', blk)
        if m and cur_art:
            cur_sec = {'id': cur_art['id'] + '-section-' + m.group(1), 'label': 'Section ' + m.group(1), 'paras': []}
            cur_art['sections'].append(cur_sec); continue
        if cur_sec is None:
            cur_sec = {'id': cur_art['id'] + '-text', 'label': '', 'paras': []}
            cur_art['sections'].append(cur_sec)
        cur_sec['paras'].append(blk)
    # Split signatures off Article VII (they begin at "done in Convention")
    art7 = parts[-1]
    paras = art7['sections'][-1]['paras']
    k = next((i for i, p in enumerate(paras) if p.startswith('done in Convention')), None)
    if k is not None:
        sig = paras[k:]; art7['sections'][-1]['paras'] = paras[:k]
        parts.append({'id': 'signatures', 'title': 'Signatures', 'sections': [{'id': 'signatures-text', 'label': '', 'paras': sig}]})
    return parts

def amendments(path, start, end, header_re):
    b = blocks(path, start, end)
    amends = []; cur = None; sec = None
    for blk in b:
        m = re.match(header_re, blk)
        if m:
            num = m.group(1)
            cur = {'id': 'amendment-' + num.lower(), 'title': 'Amendment ' + num, 'notes': [], 'sections': []}
            amends.append(cur); sec = None; continue
        if cur is None: continue
        if re.match(r'^(Passed by Congress|Originally proposed)', blk) or blk.startswith('Note:') or blk.startswith('*'):
            cur['notes'].append(blk); continue
        m = re.match(r'^Section\.?\s*(\d+)\.?$', blk)
        if m:
            sec = {'id': cur['id'] + '-section-' + m.group(1), 'label': 'Section ' + m.group(1), 'paras': []}
            cur['sections'].append(sec); continue
        if sec is None:
            sec = {'id': cur['id'] + '-text', 'label': '', 'paras': []}; cur['sections'].append(sec)
        sec['paras'].append(blk)
    return amends

def us_all():
    const = us_constitution()
    bor_path = os.path.join(RAW, 'us-bill-of-rights.txt')
    # Use the second "Amendment I" (the ratified ten, not the 1789 twelve-article resolution)
    txt = open(bor_path, encoding='utf-8').read()
    i = txt.find('The U.S. Bill of Rights')
    tmp = os.path.join(RAW, '_bor_tail.txt'); open(tmp, 'w').write(txt[i:])
    bor = amendments(tmp, 'Amendment I', 'Amendments 11-27', r'^Amendment ([IVX]+)$')
    later = amendments(os.path.join(RAW, 'us-amendments-11-27.txt'), 'AMENDMENT XI', 'Back to Constitution', r'^AMENDMENT ([IVX]+)$')
    return {
        'title': 'Constitution of the United States',
        'source_name': 'National Archives (archives.gov) transcriptions',
        'sources': [
            'https://www.archives.gov/founding-docs/constitution-transcript',
            'https://www.archives.gov/founding-docs/bill-of-rights-transcript',
            'https://www.archives.gov/founding-docs/amendments-11-27'],
        'also_see': ['https://constitution.congress.gov/constitution/', 'https://www.govinfo.gov/app/collection/cdoc'],
        'source_note': 'Transcription of the parchment original; spelling and punctuation reflect the original. Bill of Rights text is the first ten amendments in their original form. Amendments 11-27 include the Archives\' editorial notes. Some passages of the original text were later changed or superseded by amendments; the amendment notes say which.',
        'constitution': const, 'bill_of_rights': bor, 'later_amendments': later}

# ---------- California Constitution ----------
def load_dictionary(text_words):
    try:
        from spellchecker import SpellChecker
        sc = SpellChecker()
        freq = sc.word_frequency
        def known(w): return w in freq
        def score(w): return freq[w]
    except Exception:
        freq = {}; known = lambda w: False; score = lambda w: 0
    good = collections.Counter(w for w in text_words if re.search(r'ff|fi|fl', w))
    return known, score, good

LIG = ['ff', 'fi', 'fl', 'ffi', 'ffl']
def fix_word(w, known, score, good, log):
    core = w.lower()
    if 'f' not in core or known(core): return w
    cands = set()
    idx = [i for i, c in enumerate(core) if c == 'f']
    for i in idx:
        for lig in LIG:
            c = core[:i] + lig + core[i + 1:]
            if known(c) or good.get(c): cands.add(c)
    if not cands:
        # two ligatures in one word (e.g. "efciency" -> "efficiency" already 1; "afrm" rare)
        for i in idx:
            for j in idx:
                if j <= i: continue
                for a in LIG:
                    for b in LIG:
                        c = core[:i] + a + core[i+1:j] + b + core[j+1:]
                        if known(c) or good.get(c): cands.add(c)
    if not cands: return w
    best = max(cands, key=lambda c: (known(c), score(c), good.get(c, 0)))
    out = best
    if w[0].isupper(): out = best[0].upper() + best[1:]
    if w.isupper() and len(w) > 1: out = best.upper()
    log[w + ' -> ' + out] += 1
    return out

SMALL = {'and','or','of','the','for','to','in','on','a','an','from','by'}
def nice_title(t):
    if not t.isupper(): return t
    w = t.lower().split(' ')
    return ' '.join(x if (i and x in SMALL) else x[:1].upper() + x[1:] for i, x in enumerate(w))

def ca_constitution():
    lines = open(os.path.join(RAW, 'ca_us_const.txt'), encoding='utf-8').read().split('\n')
    s = next(i for i, l in enumerate(lines) if l.strip().startswith('CONSTITUTION OF THE STATE OF CALIFORNIA *'))
    e = next(i for i in range(s, len(lines)) if lines[i].strip() == 'INDEX TO CALIFORNIA CONSTITUTION')
    body = lines[s + 2:e]
    # drop page furniture
    clean = []
    for l in body:
        t = l.strip()
        if re.fullmatch(r'\(?\d{1,3}\)?', t): continue
        if t in ('CONSTITUTION OF CALIFORNIA',): continue
        if re.fullmatch(r'Art\. [IVXLA-Z ]+(, §§? ?[\d.,\-–— ]+[a-z]?)?', t): continue
        if t.startswith('* Adopted by the people on May 7, 1879') or t.startswith('efect at time of adoption') or t.startswith('effect at time of adoption'):
            continue
        clean.append(l.rstrip())
    words = re.findall(r"[A-Za-z]+", '\n'.join(clean))
    known, score, good = load_dictionary(w.lower() for w in words)
    log = collections.Counter()
    def fix(text):
        return re.sub(r"[A-Za-z]+", lambda m: fix_word(m.group(0), known, score, good, log), text)
    # paragraph assembly
    paras = []; cur = ''
    def flush():
        nonlocal cur
        if cur.strip(): paras.append(cur.strip())
        cur = ''
    for l in clean:
        t = l.strip()
        if not t: flush(); continue
        starts_new = bool(re.match(r'^(\(|SEC\.|SECTION|\[|ARTICLE )', t))
        if starts_new: flush()
        if cur.endswith('-') and t[:1].islower():
            # A line-end hyphen is either a soft break ("con-" + "sult") or a real
            # compound ("two-" + "thirds"). Drop it only if the joined word is a real word.
            frag = re.findall(r'[A-Za-z]+-$', cur)
            first = re.match(r'[A-Za-z]+', t)
            joined = (frag[0][:-1] + first.group(0)) if frag and first else ''
            jfix = fix_word(joined, known, score, good, collections.Counter()) if joined else ''
            if joined and (known(joined.lower()) or jfix != joined):
                cur = cur[:-1] + t
            else:
                cur = cur + t
        else:
            cur = (cur + ' ' + t) if cur else t
        if t.startswith('[') and t.endswith(']') and not cur.startswith('SEC'):
            flush()
        elif len(t) < 55 and (t.endswith('.') or t.endswith(']') or t.endswith(':')):
            flush()
    flush()
    paras = [fix(p) for p in paras]
    # A few words the dictionary pass cannot resolve (ligature lost across a hyphen
    # or Latin terms). Restorations only; logged like the others.
    MANUAL = {'oneffth': 'one-fifth', 'fourffths': 'four-fifths', 'Twentyfve': 'Twenty-five',
              'fde': 'fide', 'ofcio': 'officio', 'sportfshing': 'sportfishing'}
    def manual(m):
        w = m.group(0)
        if w in MANUAL:
            log[w + ' -> ' + MANUAL[w] + ' (manual)'] += 1
            return MANUAL[w]
        return w
    paras = [re.sub(r'[A-Za-z]+', manual, p) for p in paras]
    # structure
    arts = []; art = None; sec = None; pending_caption = None
    i = 0
    preamble = None
    while i < len(paras):
        p = paras[i]
        if p == 'PREAMBLE':
            preamble = paras[i + 1]; i += 2; continue
        m = re.match(r'^ARTICLE ([IVXL]+(?: [A-E])?)\b(.*)$', p)
        if m:
            title = m.group(2).strip()
            if not title and i + 1 < len(paras) and paras[i+1].isupper() and not paras[i+1].startswith('SEC'):
                title = paras[i + 1]; i += 1
            num = m.group(1)
            title = title.lstrip('* ').strip()
            repealed = title.startswith('.') or title.startswith('to ')
            if repealed:
                title = title.lstrip('. ')
            aid = 'article-' + slug(num) + ('-former' if repealed else '')
            art = {'id': aid, 'number': num, 'title': nice_title(title) if not repealed else title, 'repealed': repealed, 'sections': [], 'notes': []}
            arts.append(art); sec = None; pending_caption = None; i += 1; continue
        if art is None: i += 1; continue
        if p.startswith('[') and p.endswith(']') and not re.match(r'^\[(Repealed|As amended|New section|Added|Renumbered|Amended)', p):
            pending_caption = p.strip('[]'); i += 1; continue
        m = re.match(r'^(SECTION|SEC\.)\s*([0-9]+(?:\.[0-9]+)?[a-z]?[½¼¾]?|[½¼¾])\.\s*(.*)$', p)
        if m:
            num = m.group(2)
            base_id = art['id'] + '-sec-' + slug(num)
            sid = base_id; n = 2
            prior = next((x for x in art['sections'] if x['id'] == base_id), None)
            if prior is not None and not prior['caption'] and all(q.startswith('[') for q in prior['paras']):
                # earlier entry is a "[Repealed ...]" placeholder: keep the clean id for the live section
                prior['id'] = base_id + '-former'
            while any(x['id'] == sid for x in art['sections']): sid = base_id + '-' + str(n); n += 1
            sec = {'id': sid, 'label': 'Sec. ' + num, 'caption': pending_caption or '', 'paras': [m.group(3)] if m.group(3) else []}
            art['sections'].append(sec); pending_caption = None; i += 1; continue
        if sec is None:
            art['notes'].append(p)
        else:
            sec['paras'].append(p)
        i += 1
    json.dump(dict(sorted(log.items(), key=lambda kv: -kv[1])), open(os.path.join(OUT, 'ca-ligature-log.json'), 'w'), indent=1)
    return {
        'title': 'Constitution of the State of California',
        'as_of': 'As last amended November 5, 2024 (per the source publication)',
        'source_name': 'California State Senate, "Constitutions of California and the United States" (2025-26 edition, PDF)',
        'sources': ['https://www.senate.ca.gov/system/files/2026-04/2025-26_california_and_us_constitution.pdf'],
        'also_see': ['https://leginfo.legislature.ca.gov/faces/codesTOCSelected.xhtml?tocCode=CONS'],
        'source_note': 'Text extracted automatically from the official Senate PDF. Bracketed captions and history notes ("[As amended ...]") are part of that publication. The PDF text layer drops the letter pairs ff/fi/fl; these were restored automatically (%d distinct words) and logged. Always check the official source before relying on any wording.' % len(log),
        'preamble': preamble, 'articles': arts}

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    us = us_all()
    json.dump(us, open(os.path.join(OUT, 'us-constitution.json'), 'w'), indent=1, ensure_ascii=False)
    ca = ca_constitution()
    json.dump(ca, open(os.path.join(OUT, 'ca-constitution.json'), 'w'), indent=1, ensure_ascii=False)
    print('US articles', len(us['constitution']), 'BOR', len(us['bill_of_rights']), 'later', len(us['later_amendments']))
    print('CA articles', len(ca['articles']), 'sections', sum(len(a['sections']) for a in ca['articles']))
