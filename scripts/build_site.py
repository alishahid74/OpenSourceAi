"""Write a compact copy of data/catalog.json for the website (site/catalog.json).

Run after scripts/collect.py:
  python scripts/build_site.py
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KEEP = ("name", "org", "country", "category", "also_in", "tasks", "license", "license_type",
        "url", "hardware", "description", "source", "downloads", "likes", "stars", "language", "library")


def main():
    catalog = json.loads((ROOT / "data" / "catalog.json").read_text(encoding="utf-8"))
    items = []
    for e in catalog["items"]:
        items.append({k: e[k] for k in KEEP if e.get(k) not in (None, "", [])})
    out = ROOT / "site" / "catalog.json"
    out.write_text(json.dumps({"stats": catalog["stats"], "items": items}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {out} ({len(items)} items, {out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
