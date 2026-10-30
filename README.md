# OpenSourceAi

**Live site: https://alishahid74.github.io/OpenSourceAi/**

A catalog of the world's open-source AI (models, tools, frameworks, datasets), built to power a
**search & compare website** where anyone can find the right open AI for their task, hardware and license needs.

## What's here

| Path | What it is |
|---|---|
| `data/curated.json` | ~120 hand-checked notable projects from the USA, China, France, Germany, UAE, India, Singapore, Korea and elsewhere, with plain-language descriptions |
| `scripts/collect.py` | Pulls the most-downloaded models from Hugging Face and most-starred AI repos from GitHub, then merges them with the curated list |
| `data/catalog.json` | The generated catalog (`stats` + `items`). Rebuild it any time |
| `scripts/build_site.py` | Writes a compact copy of the catalog to `site/catalog.json` |
| `site/` | The search & compare website |

## Rebuild the catalog

```bash
python scripts/collect.py
```

Bigger crawl (takes longer; a GitHub token raises the rate limit):

```bash
GITHUB_TOKEN=your_token python scripts/collect.py --hf-per-task 1000 --gh-per-topic 300
```

No extra Python packages needed.

## Rules for what counts as "open source"

- An entry must have a declared license. No license means it is not legally open.
- Each entry gets a `license_type` so users can filter:
  - `permissive`: MIT, Apache-2.0, BSD, CC-BY and similar. Use for anything, including commercial
  - `copyleft`: GPL, AGPL, CC-BY-SA. Free to use, but changes must be shared under the same license
  - `restricted-open-weight`: Llama, Gemma, OpenRAIL and similar. Weights are downloadable, with use restrictions
  - `non-commercial`: CC-BY-NC and similar. Research and personal use only
  - `custom`: anything else; read the license
- Curated entries win over fetched duplicates; fetched data adds live stars and downloads.

## Entry fields

`name, org, country, category, tasks, license, license_type, url, hardware, description, source`,
plus `downloads`/`likes` (Hugging Face) or `stars`/`language`/`updated` (GitHub) when available.

`hardware` is a rough guide: `cpu` (any computer), `laptop` (8–16 GB RAM), `gpu` (consumer graphics card),
`datacenter`, `n/a` (libraries), or `unknown`. For Hugging Face models it is guessed from the parameter count in the name.

## Known gaps

- `country` is blank for fetched entries (only curated entries have it).
- `hardware` is `unknown` when a model name has no size in it.
- Some categories (e.g. reinforcement-learning under `robotics`) include many small hobby models.

## The website (`site/`)

A static search & compare page: plain HTML, CSS and JavaScript with no build tools.

- **Help me choose**: three questions (task, computer, business use) give the top 3 picks.
- **How to use**: every entry has setup steps with copy buttons. Hand-picked entries use the `howto` steps in
  `data/curated.json`. Each step is `{"t": text}`, `{"cmd": shell command}` or `{"code": code}`.
  Other entries get steps generated from their type (Ollama for GGUF files, Python for Transformers models, and so on).

People can search in everyday words ("transcribe audio", "remove background"), filter by task, license, hardware,
country and source, and compare up to 4 entries side by side. Filters are saved in the URL, so a search can be shared as a link.

Run it locally:

```bash
python -m http.server 8123 -d site
```

Then open http://localhost:8123.

After rebuilding the catalog, refresh the site's copy:

```bash
python scripts/build_site.py
```

To put it online, upload the `site/` folder to any static host, such as GitHub Pages, Netlify or Cloudflare Pages.

### GitHub

- `.github/workflows/pages.yml` deploys `site/` to GitHub Pages on every push to `main` that changes it.
- `.github/workflows/refresh.yml` re-collects the catalog every Monday, commits it if anything changed, and redeploys.
  Start it any time from the repo's **Actions** tab, under "Refresh catalog", by clicking **Run workflow**.

One-time setup: in the repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**.

A copy is also published at https://claude.ai/artifact/5CDNEjS2KPq8xiDFpAWdHp. Use the page's Share menu to choose who can open it.
On that copy, filters aren't saved in the link.

## License

The code and the hand-picked list in this repo are under the [MIT License](LICENSE).
Each project listed in the catalog has its own license, shown on its entry.
