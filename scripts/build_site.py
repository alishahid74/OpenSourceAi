"""Write a compact copy of data/catalog.json for the website (site/catalog.json).

Hand-picked entries are refreshed from data/curated.json, so edits there show up
without re-running the full crawl.

It also puts the shared header, footer and sharing tags into every page, writes the
sitemap, and stamps asset versions.

Run after scripts/collect.py, or after editing data/curated.json:
  python scripts/build_site.py
"""

import datetime
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE_URL = "https://alishahid74.github.io/OpenSourceAi/"
GITHUB = "https://github.com/alishahid74/OpenSourceAi"
# The menu, in order: page file and the i18n key of its short name.
PAGES = [("index.html", "nav.find"), ("chat.html", "nav.chatShort"), ("learn.html", "nav.learn"), ("try.html", "nav.tryShort"),
         ("tree.html", "nav.treeShort"), ("menu.html", "nav.menuShort")]
ENGLISH = {"nav.find": "Find AI", "nav.chatShort": "Chat", "nav.tryShort": "Try in browser",
           "nav.treeShort": "Family tree", "nav.menuShort": "My AI menu", "nav.learn": "Learn"}
MARK = ('<svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="currentColor"/>'
        '<path d="M22.6 10.4A8.5 8.5 0 1 0 24.5 16" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>'
        '<circle cx="23.2" cy="8.8" r="2.3" fill="#fff"/></svg>')
KEEP = ("name", "org", "country", "category", "also_in", "tasks", "license", "license_type",
        "url", "hardware", "description", "source", "downloads", "likes", "stars", "language", "library", "howto", "params")


def key(entry):
    return entry["url"].rstrip("/").lower()


def main():
    catalog = json.loads((ROOT / "data" / "catalog.json").read_text(encoding="utf-8"))
    curated = {key(e): {**e, "source": "curated"} for e in json.loads((ROOT / "data" / "curated.json").read_text(encoding="utf-8"))}
    # Fill each curated entry with live numbers from the crawl, whether the crawl stored it as curated or fetched.
    for e in catalog["items"]:
        c = curated.get(key(e))
        if c:
            for field in ("downloads", "likes", "stars", "language", "library", "also_in", "params"):
                if e.get(field) is not None:
                    c.setdefault(field, e[field])
    items = list(curated.values())
    items += [e for e in catalog["items"] if key(e) not in curated]
    items = [{k: e[k] for k in KEEP if e.get(k) not in (None, "", [])} for e in items]
    out = ROOT / "site" / "catalog.json"
    out.write_text(json.dumps({"stats": catalog["stats"], "items": items}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {out} ({len(items)} items, {sum('howto' in e for e in items)} with how-to, {out.stat().st_size // 1024} KB)")
    apply_layout()
    stamp_assets()


def header(active):
    current = ' aria-current="page"'
    links = "".join(
        f'\n        <a href="{page}" data-page="{page}" data-i18n="{label}"{current if page == active else ""}>{ENGLISH[label]}</a>'
        for page, label in PAGES)
    return f"""<!-- site-header -->
  <header class="site-header">
    <div class="wrap site-bar">
      <a class="brand" href="index.html" data-page="index.html">{MARK}<span>OpenSourceAi</span></a>
      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="siteNav" data-i18n-aria="nav.toggle" aria-label="Menu">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
      <nav id="siteNav" class="site-nav" data-i18n-aria="nav.main" aria-label="Main menu">{links}
      </nav>
      <label class="langpick"><span class="sr-only" data-i18n="language">Language</span>
        <select id="lang"></select>
      </label>
    </div>
  </header>
  <!-- /site-header -->"""


def footer():
    explore = "".join(f'\n          <a href="{page}" data-page="{page}" data-i18n="{label}">{ENGLISH[label]}</a>' for page, label in PAGES)
    return f"""<!-- site-footer -->
  <footer class="site-footer">
    <div class="wrap foot-grid">
      <div class="foot-brand">
        <a class="brand" href="index.html" data-page="index.html">{MARK}<span>OpenSourceAi</span></a>
        <p data-i18n="foot.tagline">Open-source AI, explained simply.</p>
        <p data-i18n="foot.privacy">No accounts, no ads, no tracking.</p>
      </div>
      <nav class="foot-col" aria-labelledby="footExplore">
        <h2 id="footExplore" data-i18n="foot.explore">Explore</h2>{explore}
      </nav>
      <div class="foot-col">
        <h2 data-i18n="foot.about">About</h2>
        <a href="{GITHUB}#rules-for-what-counts-as-open-source" data-i18n="foot.licenses">How we check licenses</a>
        <a href="{GITHUB}#whats-here" data-i18n="foot.sources">Where the data comes from</a>
      </div>
      <div class="foot-col">
        <h2 data-i18n="foot.project">Project</h2>
        <a href="{GITHUB}" data-i18n="foot.code">Source code on GitHub</a>
        <a href="{GITHUB}/issues/new?title=Suggest%20a%20project" data-i18n="foot.suggest">Suggest a project</a>
        <a href="{GITHUB}/issues/new" data-i18n="foot.report">Report a problem</a>
      </div>
    </div>
    <div class="wrap foot-bottom"><span>© {datetime.date.today().year} OpenSourceAi</span><span data-i18n="foot.mit">Site code under the MIT License.</span></div>
  </footer>
  <!-- /site-footer -->"""


def meta(page, html):
    title = re.search(r"<title>(.*?)</title>", html).group(1)
    desc = re.search(r'<meta name="description" content="(.*?)">', html).group(1)
    url = SITE_URL + ("" if page == "index.html" else page)
    canonical = "" if page == "404.html" else f'\n  <link rel="canonical" href="{url}">\n  <meta property="og:url" content="{url}">'
    return f"""<!-- site-meta -->
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="apple-touch-icon.png">
  <meta name="theme-color" content="#1f6f5c">{canonical}
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="OpenSourceAi">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{desc}">
  <meta property="og:image" content="{SITE_URL}og-image.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <!-- /site-meta -->"""


def apply_layout():
    """Fill the <!-- site-... --> markers in every page, so the header, footer and sharing tags stay identical."""
    for page in [p for p, _ in PAGES] + ["404.html"]:
        path = ROOT / "site" / page
        html = path.read_text(encoding="utf-8")
        for name, block in (("site-header", header(page)), ("site-footer", footer()), ("site-meta", meta(page, html))):
            html = re.sub(rf"<!-- {name} -->.*?<!-- /{name} -->", lambda _: block, html, count=1, flags=re.S)
        path.write_text(html, encoding="utf-8")
    urls = "".join(f"  <url><loc>{SITE_URL}{'' if p == 'index.html' else p}</loc></url>\n" for p, _ in PAGES)
    (ROOT / "site" / "sitemap.xml").write_text(
        f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}</urlset>\n',
        encoding="utf-8")
    (ROOT / "site" / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {SITE_URL}sitemap.xml\n", encoding="utf-8")


def stamp_assets():
    """Point the pages at their scripts and style.css with ?v=<hash> so browsers fetch new versions after a deploy."""
    for page in ("index.html", "try.html", "tree.html", "menu.html", "chat.html", "learn.html", "404.html"):
        path = ROOT / "site" / page
        html = path.read_text(encoding="utf-8")
        for name in ("i18n.js", "app.js", "try.js", "tree.js", "menu.js", "chat.js", "learn.js", "style.css"):
            digest = hashlib.sha256((ROOT / "site" / name).read_bytes()).hexdigest()[:10]
            html = re.sub(rf'"{re.escape(name)}(\?v=[0-9a-f]+)?"', f'"{name}?v={digest}"', html)
        path.write_text(html, encoding="utf-8")


if __name__ == "__main__":
    main()
