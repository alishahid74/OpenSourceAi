# OpenSourceAi

**Live site: https://alishahid74.github.io/OpenSourceAi/**

A catalog of the world's open-source AI (models, tools, frameworks, datasets), built to power a
**search & compare website** where anyone can find the right open AI for their task, hardware and license needs.

## What's here

| Path | What it is |
|---|---|
| `data/curated.json` | ~145 hand-checked notable projects, including research assistants and cybersecurity tools, from the USA, China, France, Germany, UAE, India, Singapore, Korea and elsewhere, with plain-language descriptions |
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
- **Will it run on my computer?**: visitors pick a typical computer or set their exact RAM and graphics card memory.
  Every model with a known size shows "Runs well", "Runs slowly" or "Too big". The estimate uses the real parameter
  count from Hugging Face (`params`): about 0.6 bytes per parameter for chat models (4-bit compressed, the way Ollama
  runs them) and 2 bytes for others, plus working memory. Image and video models are treated as needing a graphics card.
  The settings are saved in the visitor's browser.
- **How to use**: every entry has setup steps with copy buttons. Hand-picked entries use the `howto` steps in
  `data/curated.json`. Each step is `{"t": text}`, `{"cmd": shell command}` or `{"code": code}`.
  Other entries get steps generated from their type (Ollama for GGUF files, Python for Transformers models, and so on).

- **Try AI in your browser** (`site/try.html`, `site/try.js`): three demos that run on the visitor's own computer
  with [Transformers.js](https://github.com/huggingface/transformers.js), so nothing they record or upload leaves it.
  Speech to text uses Whisper tiny (about 40 MB), translation uses OPUS-MT (about 80 MB per language pair, 10 languages
  to and from English), and background removal uses MODNet (about 6 MB). The browser keeps each model after the first download.
- **Chat with AI, free** (`site/chat.html`, `site/chat.js`): a chat page where the model runs inside the page on the
  visitor's own computer with [WebLLM](https://github.com/mlc-ai/web-llm) (WebGPU, so a recent Chrome or Edge).
  Four small models to pick from (SmolLM2 360M, Qwen2.5 1.5B, Llama 3.2 3B, Qwen3 4B); each downloads once and the
  browser keeps it. No account, no key, and nothing typed leaves the computer. `chat.html?prompt=...` fills in a question.
- **Learn to prompt** (`site/learn.html`, `site/learn.js`): five prompting habits, each with a weak and a better prompt,
  ten ready-made prompts, and Anthropic's open-source pieces (Agent Skills, MCP, the prompting tutorial). Every example
  has a "Try it" button that opens the chat with the prompt typed in. The lessons and prompts are in `learn.js`, per language.
- **The family tree of open AI** (`site/tree.html`, `site/tree.js`): pick a family (Llama, Qwen, Whisper, …) or type any
  Hugging Face model to see what it was built from and what people built from it (fine-tuned versions, add-ons,
  compressed copies and merges), plus the languages those descendants were made for. Everything is read live from the
  Hugging Face API; click any model to make it the center.
- **Your computer's AI menu** (`site/menu.html`, `site/menu.js`): the finder's best pick for every task on one computer,
  with "How to use" steps and two alternatives. It guesses the computer from the browser (or uses the visitor's saved
  settings), can be printed or saved as a PDF, and can be shared as a link (`?ram=32&vram=12&mac=0&biz=1`).
- **Shared header and footer**: every page gets the same header (logo, menu, language picker), footer and link-preview
  tags from `scripts/build_site.py`, which fills the `<!-- site-header -->`, `<!-- site-footer -->` and `<!-- site-meta -->`
  markers. To add a page, add it to `PAGES` there and give it those markers. The build also writes `sitemap.xml` and `robots.txt`.
- **Languages**: English, Español, Français, Português, العربية, اردو, हिन्दी and 中文, chosen from the header
  (it starts in the browser's language; `?lang=ur` in the link picks one). Arabic and Urdu switch the page to right-to-left.
  The interface text lives in `site/i18n.js`; project descriptions and hand-written setup steps stay in English.
  The translations were machine-written, so corrections from native speakers are welcome.
  To add a language, copy the `en` block in `site/i18n.js`, translate it, and add it to `LANGS`.

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

## License

The code and the hand-picked list in this repo are under the [MIT License](LICENSE).
Each project listed in the catalog has its own license, shown on its entry.
