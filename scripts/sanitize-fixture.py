#!/usr/bin/env python3
"""Turn a browser "Save Page As…" file into a trimmed, de-identified test fixture.

Usage:
    scripts/sanitize-fixture.py RAW.html tests/fixtures/<site>/<name>.html [--redact "Full Name" ...]
    scripts/sanitize-fixture.py RAW.html OUT.html --strip-text [--keep-text "Shorts" ...] [--keep-path reels ...]

It drops scripts, styles, iframes, media sources (img/video/source src, posters), event handlers, and tracking
attributes, keeping DOM
structure, ids, classes, roles, aria-*, and data-* (what rules match on). Tracking/session/browser URL
parameters (ei, ved, sca_esv, hs, fbs, biw, bih, client, sxsrf, …) are removed from every URL, including
URL-encoded nested ones, and their long values are replaced everywhere else (e.g. element ids) with SCRUBBED.
Email addresses become user@example.com, Google API keys (AIza…) become REDACTED_API_KEY, and every --redact string (case-insensitive) becomes REDACTED. Always also pass your name, first name, and surname, then grep the output before committing
(see docs/conventions.md → Testing).

--strip-text is REQUIRED for feeds and social pages (and any page showing other people's names or posts):
  * Every text node and text attribute (alt, title, placeholder, aria-label, value, text-like data-*) becomes
    "Text". Phrases passed with --keep-text survive (whole words, case-insensitive): pass the UI labels that
    rules match on, e.g. --keep-text "Suggested for you".
  * In every URL, path segments, query values, and fragments become pseudonyms: the same value always gets the
    same pseudonym of the same length (/@SomeChannel -> /@p1xxxxxxxxxx), so links that pointed to the same thing
    still do. Structural words (watch, shorts, reel, p, …; see KEEP_SEGMENTS) and --keep-path values survive, so
    selectors like a[href*="/shorts/"] keep matching. Hosts outside the known platforms become siteN.example.
    ID-like pseudonymized values (8+ chars with a digit or mixed case) are replaced everywhere else too.
  * CSS url(...) in style attributes and every *src*/*thumb*/poster/avatar/image attribute are blanked.
The self-test (tests/sanitize-fixture/) runs in scripts/verify.sh; update its expected files with any change here.
"""
import sys, re, html, argparse
from html.parser import HTMLParser
from urllib.parse import urlsplit, urlunsplit
VOID = {'area','base','br','col','embed','hr','img','input','link','meta','source','track','wbr'}
DROP = {'script','style','noscript','link','meta','iframe','object','embed'}
MEDIA_ATTRS = {'img': ('src',), 'source': ('src',), 'video': ('src', 'poster'), 'audio': ('src',), 'track': ('src',), 'image': ('href', 'xlink:href')}
DROP_ATTR = re.compile(r'^(on.*|jsaction|jsdata|ping|data-ved|srcset|data-lpage|nonce)$')
# Per-request / per-session / browser-identifying URL parameters (Google and similar sites).
TRACK = r'(?:ei|sei|ved|sca_esv|sca_upv|hs|fbs|biw|bih|dpr|client|sclient|sxsrf|oq|gs_lp|gs_lcrp|iflsig|uact|mstk|ictx|rlz|aqs|sourceid)'
PLAIN_PARAM = re.compile(r'(?<=[?&])' + TRACK + r'=[^&#]*(?:&|(?=#)|$)')
ENCODED_PARAM = re.compile(r'(?<=%3F|%3f|%26)' + TRACK + r'(?:%3D|%3d)(?:(?!%26)[^&#])*(?:%26)?')
VALUE = re.compile(r'(?:[?&]|%3F|%3f|%26)' + TRACK + r'(?:=|%3D|%3d)([A-Za-z0-9_:.-]{8,})')

TRACK_NAME = re.compile('^' + TRACK + '$')

# ── --strip-text ─────────────────────────────────────────────────────────────
PLACEHOLDER = 'Text'
# URL path segments / query values that name a kind of page, not a person or a post. Compared lowercased.
KEEP_SEGMENTS = {
    'watch', 'shorts', 'reel', 'reels', 'p', 'tv', 'stories', 'story', 'feed', 'explore', 'results', 'search',
    'hashtag', 'tag', 'tags', 'channel', 'user', 'u', 'c', 'r', 'in', 'playlist', 'live', 'videos', 'video',
    'about', 'featured', 'community', 'posts', 'photos', 'photo', 'status', 'groups', 'friends', 'marketplace',
    'gaming', 'home', 'trending', 'subscriptions', 'library', 'history', 'following', 'foryou', 'notifications',
    'messages', 'direct', 'inbox', 'settings', 'account', 'accounts', 'help', 'embed', 'music', 'premium',
}
# Hosts of the platforms dummify targets (and their CDNs). Any other host could name a person (their blog).
KNOWN_HOST = re.compile(r'(?:^|\.)(?:google|gstatic|googleusercontent|youtube|youtu|ytimg|instagram|cdninstagram'
                        r'|facebook|fb|fbcdn|messenger|tiktok|tiktokcdn|x|twitter|twimg|threads|reddit|redd'
                        r'|linkedin|licdn|bing|duckduckgo)\.[a-z.]+$')
TEXT_ATTRS = {'alt', 'title', 'placeholder', 'label', 'value', 'abbr', 'summary', 'download', 'aria-label',
              'aria-description', 'aria-roledescription', 'aria-valuetext', 'aria-placeholder',
              'aria-braillelabel', 'aria-brailleroledescription'}
TEXTY_DATA = re.compile(r'^data-.*(?:title|label|tooltip|text|name|desc|caption|alt|tip|content|message)')
URL_ATTR = re.compile(r'(?:^|[-:])(?:href|action|formaction|cite|url|link)$')
MEDIA_NAME = re.compile(r'(?:src|srcset|thumb|thumbnail|poster|image|img|avatar)$')
NON_HIERARCHICAL = re.compile(r'^([a-zA-Z][a-zA-Z0-9+.-]*):(?!//)(.*)$', re.S)  # mailto:, tel:, javascript:
ID_LIKE = re.compile(r'^(?=.*(?:\d|[a-z].*[A-Z]|[A-Z].*[a-z]))[A-Za-z0-9_-]{8,}$')

class Stripper:
    """Replaces other people's text and identifiers with neutral, stable placeholders."""
    def __init__(s, keep_text, keep_path):
        phrases = [r'\s+'.join(map(re.escape, k.split())) for k in keep_text if k.strip()]
        # One capturing group, so re.split() returns kept phrases at odd indices.
        s.keep = re.compile(r'(?<!\w)(' + '|'.join(sorted(phrases, key=len, reverse=True)) + r')(?!\w)', re.I) if phrases else None
        s.keep_path = KEEP_SEGMENTS | {k.lower() for k in keep_path}
        s.pseudonyms = {}
        s.hosts = {}
    def text(s, t):
        parts = s.keep.split(t) if s.keep else [t]
        out = []
        for i, p in enumerate(parts):
            if i % 2 or not p.strip():  # a kept phrase, or whitespace
                out.append(p); continue
            r = re.sub(r'\S(?:.*\S)?', PLACEHOLDER, p, flags=re.S)
            # Keep words apart where a kept phrase touched other text ("#shorts" -> "Text shorts", not "Textshorts").
            if i > 0 and not p[0].isspace(): r = ' ' + r
            if i < len(parts) - 1 and not p[-1].isspace(): r += ' '
            out.append(r)
        return ''.join(out)
    def pseudonym(s, v):
        if v not in s.pseudonyms:
            p = f'p{len(s.pseudonyms) + 1}'
            s.pseudonyms[v] = p + 'x' * (len(v) - len(p))  # same length: ID-shaped regexes still match
        return s.pseudonyms[v]
    def piece(s, v):
        return v if v == '' or v.lower() in s.keep_path else s.pseudonym(v)
    def segment(s, seg):
        return '@' + s.piece(seg[1:]) if seg.startswith('@') else s.piece(seg)
    def host(s, netloc):
        name = netloc.rsplit('@', 1)[-1].split(':')[0].lower()
        if KNOWN_HOST.search(name): return name
        return s.hosts.setdefault(name, f'site{len(s.hosts) + 1}.example')
    def url(s, v):
        m = NON_HIERARCHICAL.match(v)
        if m: return f'{m.group(1)}:' + (s.piece(m.group(2)) if m.group(2) else '')
        try: u = urlsplit(v)
        except ValueError: return s.piece(v)
        netloc = s.host(u.netloc) if u.netloc else ''
        path = '/'.join(map(s.segment, u.path.split('/')))
        query = '&'.join((k + '=' + s.piece(val)) if eq else s.piece(k)
                         for k, eq, val in (q.partition('=') for q in u.query.split('&'))) if u.query else ''
        out = urlunsplit((u.scheme, netloc, path, query, s.piece(u.fragment)))
        return out + ('#' if v.endswith('#') and not u.fragment else '')
    def attr(s, k, v):
        if k == 'xmlns' or k.startswith('xmlns:'): return v  # a namespace (w3.org), not a link to anyone
        if k == 'style': return re.sub(r'url\([^)]*\)', 'none', v, flags=re.I)
        if MEDIA_NAME.search(k): return ''
        if k in TEXT_ATTRS or TEXTY_DATA.match(k): return s.text(v)
        if URL_ATTR.search(k) or re.match(r'^(?:https?:)?//', v, re.I): return s.url(v)
        if k.startswith('data-') and (re.search(r'\s', v.strip()) or v[:1] in '{['): return s.text(v)
        return v
    def ids_elsewhere(s, out):
        """Video/post IDs also appear outside URLs (element ids, class names). Replace those too."""
        for v in sorted((v for v in s.pseudonyms if ID_LIKE.match(v)), key=len, reverse=True):
            out = out.replace(v, s.pseudonyms[v])
        return out

def is_tracking_input(tag, attrs):
    """Hidden form fields that carry the same tracking values as URLs (e.g. <input name="biw" value="912">)."""
    return tag == 'input' and any(k == 'name' and TRACK_NAME.match(v or '') for k, v in attrs)

def scrub_url(v):
    v = PLAIN_PARAM.sub('', v)
    v = ENCODED_PARAM.sub('', v)
    return re.sub(r'(?:[?&]|%3F|%26)+(?=#|$)', '', v)
class S(HTMLParser):
    def __init__(s, strip=None):
        super().__init__(convert_charrefs=True); s.out=[]; s.skip=0; s.svg=0; s.current_tag=''; s.strip=strip
    def attrs(s, attrs):
        r=[]
        for k,v in attrs:
            if DROP_ATTR.match(k): continue
            v = v or ''
            if k in ('src','href') and v.startswith('data:'): v=''
            # Media is never needed by rules, and can identify the user (e.g. their avatar). Blank it.
            if k in MEDIA_ATTRS.get(s.current_tag, ()): v=''
            v = scrub_url(v)
            if s.strip and v: v = s.strip.attr(k, v)
            r.append(f' {k}="{html.escape(v, quote=True)}"' if v!='' or k not in ('src',) else f' {k}=""')
        return ''.join(r)
    def handle_starttag(s,tag,attrs):
        s.current_tag=tag
        if s.skip or s.svg:
            if tag not in VOID and (tag in DROP or s.skip): s.skip+= 1 if tag in DROP or s.skip else 0
            if s.svg and tag not in VOID: s.svg+=1
            return
        if tag in DROP:
            if tag not in VOID: s.skip=1
            return
        if is_tracking_input(tag, attrs): return
        s.out.append(f'<{tag}{s.attrs(attrs)}>')
        if tag=='svg': s.svg=1
    def handle_startendtag(s,tag,attrs):
        s.current_tag=tag
        if s.skip or s.svg or tag in DROP or is_tracking_input(tag, attrs): return
        s.out.append(f'<{tag}{s.attrs(attrs)}>')
    def handle_endtag(s,tag):
        if s.skip:
            s.skip-=1; return
        if s.svg:
            s.svg-=1
            if s.svg: return
        if tag in VOID or tag in DROP: return
        s.out.append(f'</{tag}>')
    def handle_data(s,d):
        if s.skip or s.svg: return
        s.out.append(html.escape(s.strip.text(d) if s.strip else d, quote=False))
ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument('raw'); ap.add_argument('out')
ap.add_argument('--redact', action='append', default=[], help='literal string to replace with REDACTED')
ap.add_argument('--strip-text', action='store_true', help='replace all text and identifying URL parts (feeds, social pages)')
ap.add_argument('--keep-text', action='append', default=[], help='with --strip-text: phrase to keep, e.g. a UI label a rule matches')
ap.add_argument('--keep-path', action='append', default=[], help='with --strip-text: URL path segment or query value to keep')
args = ap.parse_args()
if (args.keep_text or args.keep_path) and not args.strip_text:
    ap.error('--keep-text and --keep-path only apply with --strip-text')
strip = Stripper(args.keep_text, args.keep_path) if args.strip_text else None
src=open(args.raw,encoding='utf-8',errors='replace').read()
p=S(strip); p.feed(src); out='<!doctype html>\n'+''.join(p.out)
# Tracking values also leak outside URLs (e.g. ids derived from `ei`). Replace every long value seen in the raw page.
for value in sorted({m.group(1) for m in VALUE.finditer(html.unescape(src))}, key=len, reverse=True):
    out = out.replace(value, 'SCRUBBED')
if strip: out = strip.ids_elsewhere(out)
for literal in filter(None, (s.strip() for s in args.redact)):
    out=re.sub(re.escape(literal), 'REDACTED', out, flags=re.I)
out=re.sub(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}', 'user@example.com', out)
# Google embeds a (public) browser API key in its pages. Secret scanners flag it, so never commit one.
out=re.sub(r'AIza[0-9A-Za-z_-]{35}', 'REDACTED_API_KEY', out)
out=re.sub(r'\n\s*\n+', '\n', out)
open(args.out,'w',encoding='utf-8').write(out)
print(f'{args.out}: {len(src)} -> {len(out)} bytes')
