"""Write a compact copy of data/catalog.json for the website (site/catalog.json).

Hand-picked entries are refreshed from data/curated.json, so edits there show up
without re-running the full crawl.

Run after scripts/collect.py, or after editing data/curated.json:
  python scripts/build_site.py
"""

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
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
    stamp_assets()


def stamp_assets():
    """Point the pages at their scripts and style.css with ?v=<hash> so browsers fetch new versions after a deploy."""
    for page in ("index.html", "try.html", "tree.html", "menu.html"):
        path = ROOT / "site" / page
        html = path.read_text(encoding="utf-8")
        for name in ("i18n.js", "app.js", "try.js", "tree.js", "menu.js", "style.css"):
            digest = hashlib.sha256((ROOT / "site" / name).read_bytes()).hexdigest()[:10]
            html = re.sub(rf'"{re.escape(name)}(\?v=[0-9a-f]+)?"', f'"{name}?v={digest}"', html)
        path.write_text(html, encoding="utf-8")


if __name__ == "__main__":
    main()
