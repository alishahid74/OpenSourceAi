"""Collect open-source AI projects into one catalog.

Sources:
  - data/curated.json           hand-checked notable projects (always wins on duplicates)
  - Hugging Face Hub API        most-downloaded models per task
  - GitHub search API           most-starred repos per AI topic

Only entries with a declared license are kept: without a license, a project is
not legally open source. Set GITHUB_TOKEN to raise GitHub's rate limit.

Usage:
  python scripts/collect.py                 # default sizes
  python scripts/collect.py --hf-per-task 1000 --gh-per-topic 300
  python scripts/collect.py --skip-github
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
USER_AGENT = "OpenSourceAi-catalog/0.1"

HF_FIELDS = ("downloads", "likes", "tags", "pipeline_tag", "library_name", "createdAt", "safetensors", "gguf")

# Hugging Face pipeline tag -> our category
HF_TASKS = {
    "text-generation": "llm",
    "image-text-to-text": "vision-language",
    "text-to-image": "image-gen",
    "image-to-image": "image-gen",
    "text-to-video": "video-gen",
    "image-to-video": "video-gen",
    "automatic-speech-recognition": "speech-to-text",
    "text-to-speech": "text-to-speech",
    "text-to-audio": "audio-music",
    "translation": "translation",
    "feature-extraction": "embeddings",
    "sentence-similarity": "embeddings",
    "object-detection": "vision",
    "image-segmentation": "vision",
    "image-classification": "vision",
    "depth-estimation": "vision",
    "text-classification": "classic-ml-nlp",
    "token-classification": "classic-ml-nlp",
    "summarization": "classic-ml-nlp",
    "question-answering": "classic-ml-nlp",
    "zero-shot-classification": "classic-ml-nlp",
    "image-to-text": "ocr",
    "robotics": "robotics",
    "reinforcement-learning": "robotics",
    "time-series-forecasting": "science",
}

# GitHub topic -> our category
GH_TOPICS = {
    "llm": "llm",
    "large-language-models": "llm",
    "machine-learning": "framework",
    "deep-learning": "framework",
    "llm-inference": "inference",
    "local-llm": "inference",
    "ai-agents": "agents-rag",
    "rag": "agents-rag",
    "deep-research": "research",
    "llm-security": "security",
    "vector-database": "vector-db",
    "stable-diffusion": "image-gen",
    "computer-vision": "vision",
    "speech-recognition": "speech-to-text",
    "text-to-speech": "text-to-speech",
    "fine-tuning": "training",
    "nlp": "classic-ml-nlp",
    "ocr": "ocr",
    "robotics": "robotics",
    "bioinformatics": "science",
}

PERMISSIVE = {
    "mit", "apache-2.0", "bsd", "bsd-2-clause", "bsd-3-clause", "isc", "unlicense",
    "cc0-1.0", "cc-by-4.0", "cc-by-3.0", "odc-by",
    "zlib", "bsl-1.0", "mpl-2.0", "artistic-2.0", "wtfpl", "0bsd",
    "ecl-2.0", "postgresql", "afl-3.0", "pddl", "odbl", "cdla-permissive-2.0",
    "bsd-3-clause-clear", "openmdw-1.0", "openmdw-1.1",
}
COPYLEFT = {"gpl-2.0", "gpl-3.0", "agpl-3.0", "lgpl-2.1", "lgpl-3.0", "lgpl", "lgpl-lr", "epl-2.0", "eupl-1.2", "cc-by-sa-3.0", "cc-by-sa-4.0", "gfdl"}
NON_COMMERCIAL = re.compile(r"(^|-)nc(-|$)|non-commercial|noncommercial|research")
RESTRICTED = re.compile(r"llama|gemma|rail|openrail\+\+|creativeml|bigscience|bigcode|deepfloyd|qwen|tongyi|falcon|nvidia|stabilityai|flux|hunyuan|apple|exaone|deepseek")
NO_LICENSE = {None, "", "other", "unknown", "noassertion", "unlicensed"}


def license_type(spdx):
    s = (spdx or "").lower()
    if s in NO_LICENSE:
        return None
    if NON_COMMERCIAL.search(s):
        return "non-commercial"
    if s in COPYLEFT or s.startswith(("gpl", "agpl", "lgpl")):
        return "copyleft"
    if s in PERMISSIVE:
        return "permissive"
    if RESTRICTED.search(s):
        return "restricted-open-weight"
    return "custom"


def get_json(url, headers=None, retries=4):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, **(headers or {})})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                return json.load(resp), resp.headers
        except urllib.error.HTTPError as e:
            if e.code in (403, 429) and attempt < retries - 1:
                reset = e.headers.get("X-RateLimit-Reset")
                wait = max(5, int(reset) - int(time.time()) + 1) if reset else 30 * (attempt + 1)
                wait = min(wait, 120)
                print(f"  rate limited, waiting {wait}s", file=sys.stderr)
                time.sleep(wait)
                continue
            raise
        except (urllib.error.URLError, TimeoutError):
            if attempt < retries - 1:
                time.sleep(5 * (attempt + 1))
                continue
            raise


def next_link(headers):
    link = headers.get("Link") or ""
    m = re.search(r'<([^>]+)>;\s*rel="next"', link)
    return m.group(1) if m else None


def params_from_name(model_id):
    """Parameter count from the model name, e.g. "Llama-3.1-8B" -> 8e9, or None."""
    m = re.search(r"(\d+(?:\.\d+)?)\s*[bB](?![a-z])", model_id.split("/")[-1])
    return int(float(m.group(1)) * 1e9) if m else None


def hardware_tier(params):
    """Rough hardware tier from a parameter count."""
    if not params:
        return "unknown"
    billions = params / 1e9
    if billions <= 2:
        return "cpu"
    if billions <= 9:
        return "laptop"
    if billions <= 35:
        return "gpu"
    return "datacenter"


def fetch_huggingface(per_task):
    out = []
    for task, category in HF_TASKS.items():
        query = urllib.parse.urlencode({"pipeline_tag": task, "sort": "downloads", "direction": -1, "limit": min(per_task, 1000)})
        # expand[] replaces the default fields, so list every field we use.
        query += "".join(f"&expand[]={f}" for f in HF_FIELDS)
        url = f"https://huggingface.co/api/models?{query}"
        got = 0
        while url and got < per_task:
            items, headers = get_json(url)
            for m in items:
                tags = m.get("tags") or []
                lic = next((t.split(":", 1)[1] for t in tags if t.startswith("license:")), None)
                ltype = license_type(lic)
                if ltype is None:
                    continue
                org, _, name = m["id"].partition("/")
                # Real parameter count: safetensors weights, else GGUF metadata, else the name.
                n_params = ((m.get("safetensors") or {}).get("total")
                            or (m.get("gguf") or {}).get("total")
                            or params_from_name(m["id"]))
                out.append({
                    "name": name or m["id"],
                    "org": org if name else "",
                    "country": "",
                    "category": category,
                    "tasks": [task],
                    "license": lic,
                    "license_type": ltype,
                    "url": f"https://huggingface.co/{m['id']}",
                    "hardware": hardware_tier(n_params),
                    "params": n_params,
                    "description": "",
                    "source": "huggingface",
                    "downloads": m.get("downloads", 0),
                    "likes": m.get("likes", 0),
                    "library": m.get("library_name"),
                    "created": m.get("createdAt"),
                })
            got += len(items)
            url = next_link(headers)
        print(f"  huggingface {task}: scanned {got}", file=sys.stderr)
    return out


def fetch_github(per_topic):
    token = os.environ.get("GITHUB_TOKEN")
    headers = {"Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    # Search API: 10 req/min without a token, 30 with one.
    pause = 2.5 if token else 6.5
    out = []
    for topic, category in GH_TOPICS.items():
        got = 0
        page = 1
        while got < min(per_topic, 1000):
            q = urllib.parse.urlencode({"q": f"topic:{topic} archived:false", "sort": "stars", "order": "desc", "per_page": 100, "page": page})
            data, _ = get_json(f"https://api.github.com/search/repositories?{q}", headers)
            time.sleep(pause)
            items = data.get("items") or []
            for r in items:
                lic = (r.get("license") or {}).get("spdx_id")
                ltype = license_type(lic)
                if ltype is None:
                    continue
                out.append({
                    "name": r["name"],
                    "org": r["owner"]["login"],
                    "country": "",
                    "category": category,
                    "tasks": [t for t in (r.get("topics") or [])][:8],
                    "license": lic,
                    "license_type": ltype,
                    "url": r["html_url"],
                    "hardware": "n/a",
                    "description": (r.get("description") or "").strip(),
                    "source": "github",
                    "stars": r.get("stargazers_count", 0),
                    "language": r.get("language"),
                    "updated": r.get("pushed_at"),
                })
            got += len(items)
            page += 1
            if len(items) < 100:
                break
        print(f"  github topic:{topic}: scanned {got}", file=sys.stderr)
    return out


def key(entry):
    return entry["url"].rstrip("/").lower()


def merge(curated, fetched):
    by_url = {}
    for e in curated:
        by_url[key(e)] = {**e, "source": "curated"}
    for e in fetched:
        k = key(e)
        if k in by_url:
            existing = by_url[k]
            # keep curated text, but pick up live popularity numbers
            for field in ("downloads", "likes", "stars", "language", "updated", "library", "created", "params"):
                if e.get(field) is not None and field not in existing:
                    existing[field] = e[field]
            if e["category"] != existing["category"]:
                existing.setdefault("also_in", [])
                if e["category"] not in existing["also_in"]:
                    existing["also_in"].append(e["category"])
            continue
        by_url[k] = e
    return list(by_url.values())


def popularity(e):
    return e.get("stars", 0) * 50 + e.get("downloads", 0) + e.get("likes", 0) * 1000


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--hf-per-task", type=int, default=300, help="models to scan per Hugging Face task")
    ap.add_argument("--gh-per-topic", type=int, default=100, help="repos to scan per GitHub topic (max 1000)")
    ap.add_argument("--skip-huggingface", action="store_true")
    ap.add_argument("--skip-github", action="store_true")
    args = ap.parse_args()

    curated = json.loads((DATA / "curated.json").read_text(encoding="utf-8"))
    fetched = []
    if not args.skip_huggingface:
        print("Fetching Hugging Face...", file=sys.stderr)
        fetched += fetch_huggingface(args.hf_per_task)
    if not args.skip_github:
        print("Fetching GitHub...", file=sys.stderr)
        fetched += fetch_github(args.gh_per_topic)

    catalog = merge(curated, fetched)
    catalog.sort(key=lambda e: (e["source"] != "curated", -popularity(e)))

    stats = {
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "total": len(catalog),
        "by_source": {},
        "by_category": {},
        "by_license_type": {},
    }
    for e in catalog:
        for field, bucket in (("source", "by_source"), ("category", "by_category"), ("license_type", "by_license_type")):
            stats[bucket][e[field]] = stats[bucket].get(e[field], 0) + 1
    for bucket in ("by_source", "by_category", "by_license_type"):
        stats[bucket] = dict(sorted(stats[bucket].items(), key=lambda kv: -kv[1]))

    (DATA / "catalog.json").write_text(json.dumps({"stats": stats, "items": catalog}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(stats, indent=2))


if __name__ == "__main__":
    main()
