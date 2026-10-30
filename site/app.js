"use strict";

// Friendly names for categories, plus everyday words people use to search for them.
const CATEGORIES = {
  "llm":            { label: "Chat & text",        words: "chat chatbot assistant write writing text llm language gpt answer reasoning" },
  "code-llm":       { label: "Code models",        words: "code coding programming developer" },
  "vision-language":{ label: "Chat about images",  words: "image chat describe picture photo vqa multimodal see" },
  "vision":         { label: "Vision",             words: "detect detection segment segmentation object camera photo cutout remove background depth classify" },
  "image-gen":      { label: "Make images",        words: "image generate generation art draw picture photo diffusion" },
  "video-gen":      { label: "Make video",         words: "video generate generation animation movie clip" },
  "speech-to-text": { label: "Speech to text",     words: "transcribe transcription speech voice audio subtitles dictation asr recognition" },
  "text-to-speech": { label: "Text to speech",     words: "tts voice speak read aloud narration speech clone" },
  "audio-music":    { label: "Music & audio",      words: "music song audio sound stems vocals" },
  "translation":    { label: "Translation",        words: "translate translation language languages multilingual" },
  "embeddings":     { label: "Search & embeddings",words: "search semantic embeddings similarity retrieval vector" },
  "ocr":            { label: "Read documents (OCR)",words: "ocr scan document pdf read text extract receipt handwriting" },
  "agents-rag":     { label: "Agents & RAG",       words: "agent agents rag automation workflow assistant documents chatbot" },
  "inference":      { label: "Run AI locally",     words: "local offline run server serve private inference" },
  "app-ui":         { label: "Apps & interfaces",  words: "app ui interface desktop webui gui" },
  "vector-db":      { label: "Vector databases",   words: "vector database search store" },
  "training":       { label: "Fine-tuning",        words: "train training finetune fine-tune lora" },
  "framework":      { label: "Frameworks",         words: "framework library deep learning machine learning" },
  "classic-ml-nlp": { label: "Text analysis",      words: "sentiment classify classification ner entities summarize summarization question nlp" },
  "science":        { label: "Science",            words: "science protein biology weather climate forecast medicine" },
  "robotics":       { label: "Robotics",           words: "robot robotics reinforcement control" },
  "dataset":        { label: "Datasets",           words: "data dataset corpus training" },
};

const LICENSES = {
  "permissive":             { label: "Free for any use",       help: "MIT, Apache, BSD… including business" },
  "copyleft":               { label: "Free, share changes",    help: "GPL, AGPL: modifications must stay open" },
  "restricted-open-weight": { label: "Open, with conditions",  help: "Llama, Gemma, OpenRAIL: read the terms" },
  "non-commercial":         { label: "Non-commercial only",    help: "Research and personal use" },
  "custom":                 { label: "Other license",          help: "Check the license yourself" },
};

const HARDWARE = {
  "cpu":        { label: "Any computer",     help: "Even old laptops, Raspberry Pi" },
  "laptop":     { label: "Modern laptop",    help: "8–16 GB of memory" },
  "gpu":        { label: "Gaming GPU",       help: "Consumer graphics card" },
  "datacenter": { label: "Server / cloud",   help: "Multiple big GPUs" },
  "n/a":        { label: "Software library", help: "Hardware depends on use" },
  "unknown":    { label: "Not sure",         help: "Size not stated" },
};

const SOURCES = {
  "curated":     { label: "Hand-picked",  help: "Checked, with descriptions" },
  "huggingface": { label: "Hugging Face", help: "Most-downloaded models" },
  "github":      { label: "GitHub",       help: "Most-starred projects" },
};

const PAGE = 60;
const MAX_COMPARE = 4;

const $ = (id) => document.getElementById(id);
const state = { q: "", cat: "", lic: new Set(), hw: new Set(), src: new Set(), country: "", sort: "recommended", shown: PAGE };
const compare = new Map();
let items = [];

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function compact(n) {
  if (!n) return "";
  return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

function popularity(e) {
  return (e.stars || 0) * 50 + (e.downloads || 0) + (e.likes || 0) * 1000;
}

function prepare(e, i) {
  const cats = [e.category, ...(e.also_in || [])];
  e._i = i;
  e._cats = cats;
  e._pop = popularity(e);
  e._hay = [
    e.name, e.org, e.description, e.license, e.country, e.language, e.library,
    ...(e.tasks || []),
    ...cats.map((c) => CATEGORIES[c] ? CATEGORIES[c].label + " " + CATEGORIES[c].words : c),
  ].join(" ").toLowerCase().replace(/[-_/]/g, " ");
  e._name = (e.name + " " + (e.org || "")).toLowerCase().replace(/[-_/]/g, " ");
  return e;
}

function tokens(q) {
  return q.toLowerCase().replace(/[-_/]/g, " ").split(/\s+/).filter((t) => t.length > 1 || /\d/.test(t));
}

function filtered() {
  const toks = tokens(state.q);
  const out = [];
  for (const e of items) {
    if (state.cat && !e._cats.includes(state.cat)) continue;
    if (state.lic.size && !state.lic.has(e.license_type)) continue;
    if (state.hw.size && !state.hw.has(e.hardware)) continue;
    if (state.src.size && !state.src.has(e.source)) continue;
    if (state.country && !(e.country || "").includes(state.country)) continue;
    // Rank by how many words match (name matches count extra); allow one word to miss on longer queries.
    let score = 0;
    if (toks.length) {
      let matched = 0;
      for (const t of toks) {
        if (e._name.includes(t)) { matched++; score += 3; }
        else if (e._hay.includes(t)) { matched++; score += 1; }
      }
      if (matched < Math.max(1, toks.length - 1)) continue;
      score += matched * 10;
    }
    out.push([e, score]);
  }
  const bySort = {
    recommended: (a, b) => (b[1] - a[1]) || ((b[0].source === "curated") - (a[0].source === "curated")) || (b[0]._pop - a[0]._pop),
    popular: (a, b) => (b[0]._pop - a[0]._pop),
    name: (a, b) => a[0].name.localeCompare(b[0].name),
  };
  out.sort(bySort[state.sort]);
  return out.map((x) => x[0]);
}

function card(e, withCompare = true) {
  const lic = LICENSES[e.license_type] || LICENSES.custom;
  const hw = HARDWARE[e.hardware];
  const cat = CATEGORIES[e.category];
  const pop = e.stars ? `★ ${compact(e.stars)}` : e.downloads ? `↓ ${compact(e.downloads)}/mo` : "";
  const desc = e.description
    ? `<p class="desc">${esc(e.description)}</p>`
    : `<p class="desc none">${esc((e.tasks || []).slice(0, 4).join(", ") || "No description yet")}</p>`;
  const checked = compare.has(e._i) ? "checked" : "";
  return `<article class="card${e.source === "curated" ? " featured" : ""}">
    <div class="card-head">
      <div>
        <h3><a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.name)}</a></h3>
        <div class="org">${esc(e.org)}${e.country ? " · " + esc(e.country) : ""}</div>
      </div>
      ${e.source === "curated" ? '<span class="tag pick" title="Hand-picked">Pick</span>' : ""}
    </div>
    ${desc}
    <div class="tags">
      <span class="tag lic-${esc(e.license_type)}" title="${esc(e.license)}">${esc(lic.label)}</span>
      ${cat ? `<span class="tag">${esc(cat.label)}</span>` : ""}
      ${hw && e.hardware !== "unknown" && e.hardware !== "n/a" ? `<span class="tag">${esc(hw.label)}</span>` : ""}
    </div>
    <div class="card-foot">
      <span>${esc(pop)}</span>
      <div class="card-actions">
        <button class="howto-btn" data-howto="${e._i}">How to use</button>
        ${withCompare ? `<label class="cmp"><input type="checkbox" data-cmp="${e._i}" ${checked}> Compare</label>` : ""}
      </div>
    </div>
  </article>`;
}

// ---- how to use ----

const PY_STEP = { t: "You need Python 3.10 or newer. In a terminal, run:" };

const PIPELINE_INPUT = {
  "text-generation": '[{"role": "user", "content": "Hello! What can you do?"}], max_new_tokens=200',
  "image-text-to-text": '[{"role": "user", "content": [{"type": "image", "url": "photo.jpg"}, {"type": "text", "text": "What is in this picture?"}]}]',
  "automatic-speech-recognition": '"recording.mp3"',
  "text-to-speech": '"Hello from open-source AI"',
  "text-to-audio": '"calm piano music"',
  "translation": '"Good morning, how are you?"',
  "summarization": '"Paste a long article here..."',
  "text-classification": '"I love this product!"',
  "token-classification": '"Ali works at the Ministry of Health in Lahore."',
  "question-answering": 'question="Where is the Eiffel Tower?", context="The Eiffel Tower is in Paris."',
  "zero-shot-classification": '"The match ended 2-1", candidate_labels=["sports", "politics", "tech"]',
  "feature-extraction": '"Some text to turn into numbers"',
  "image-classification": '"photo.jpg"',
  "object-detection": '"photo.jpg"',
  "image-segmentation": '"photo.jpg"',
  "depth-estimation": '"photo.jpg"',
  "image-to-text": '"scan.png"',
};

function hfId(e) {
  const m = /^https:\/\/huggingface\.co\/([^/]+\/[^/]+)$/.exec(e.url);
  return m ? m[1] : null;
}

function autoHowto(e) {
  const id = hfId(e);
  const task = (e.tasks || [])[0];
  if (e.source === "github") {
    const steps = [
      { t: `Read the project's setup guide: ${e.url}#readme` },
      { t: "Or download the code with Git:" },
      { cmd: `git clone ${e.url}.git` },
    ];
    if (e.language) steps.push({ t: `It's written mainly in ${e.language}, so you'll need that installed.` });
    return steps;
  }
  if (!id) return [{ t: `Open the project page and follow its instructions: ${e.url}` }];
  const name = id.toLowerCase();
  if (e.library === "gguf" || name.includes("gguf")) {
    return [
      { t: "Easiest: install Ollama from ollama.com/download, then run:" },
      { cmd: `ollama run hf.co/${id}` },
      { t: "Or with llama.cpp (winget install llama.cpp, or brew install llama.cpp):" },
      { cmd: `llama-cli -hf ${id}` },
    ];
  }
  if (e.library === "sentence-transformers") {
    return [PY_STEP, { cmd: "pip install sentence-transformers" },
      { code: `from sentence_transformers import SentenceTransformer\n\nmodel = SentenceTransformer("${id}")\nvecs = model.encode(["first sentence", "second sentence"])\nprint(model.similarity(vecs[0], vecs[1]))` }];
  }
  if (e.library === "diffusers" && task === "text-to-image") {
    return [PY_STEP, { cmd: "pip install diffusers transformers accelerate torch" },
      { code: `from diffusers import DiffusionPipeline\nimport torch\n\npipe = DiffusionPipeline.from_pretrained("${id}", torch_dtype=torch.float16).to("cuda")\nimage = pipe("a watercolor painting of a mountain village").images[0]\nimage.save("out.png")` },
      { t: "Needs an NVIDIA graphics card. No coding? ComfyUI Desktop (comfy.org/download) runs most image models with clicks." }];
  }
  if (e.library === "mlx" && task === "text-generation") {
    return [{ t: "For Apple Silicon Macs." }, { cmd: "pip install mlx-lm" }, { cmd: `mlx_lm.generate --model ${id} --prompt "Hello"` }];
  }
  if (e.library === "transformers" && task) {
    return [PY_STEP, { cmd: "pip install transformers torch" },
      { code: `from transformers import pipeline\n\npipe = pipeline("${task}", model="${id}")\nprint(pipe(${PIPELINE_INPUT[task] || '"your input here"'}))` },
      { t: `More options: click "Use this model" on ${e.url}` }];
  }
  return [{ t: `Open the model page and click "Use this model" for ready-made code and apps: ${e.url}` }];
}

function linkify(text) {
  return esc(text).replace(/https?:\/\/[^\s)]+[^\s).,]/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
}

function codeBox(code) {
  return `<div class="codebox"><pre><code>${esc(code)}</code></pre><button class="ghost copy" data-copy>Copy</button></div>`;
}

function openHowto(e) {
  const steps = e.howto || autoHowto(e);
  const lic = LICENSES[e.license_type] || LICENSES.custom;
  const hw = HARDWARE[e.hardware];
  const caution = {
    "non-commercial": "This license allows personal and research use only, not business use.",
    "restricted-open-weight": "Free to use, but the license has conditions. Read it before using this in a product.",
    "custom": "This project uses its own license. Read it before using this in a product.",
    "copyleft": "If you change this and share it, or run it as a service, you must share your changes under the same license.",
  }[e.license_type];
  $("howtoTitle").textContent = `How to use ${e.name}`;
  $("howtoBody").innerHTML =
    `<p class="howto-meta">${esc(lic.label)} (${esc(e.license)})${hw && hw.label !== "Not sure" ? " · " + esc(hw.label) : ""}</p>` +
    `<ol>${steps.map((s) => `<li>${s.t ? `<p>${linkify(s.t)}</p>` : codeBox(s.cmd || s.code)}</li>`).join("")}</ol>` +
    (caution ? `<p class="caution">${esc(caution)}</p>` : "") +
    `<p class="howto-meta">Project page: <a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.url)}</a></p>`;
  $("howtoDialog").showModal();
}

async function copyCode(btn) {
  const code = btn.previousElementSibling;
  try {
    await navigator.clipboard.writeText(code.textContent);
    btn.textContent = "Copied";
  } catch {
    const range = document.createRange();
    range.selectNodeContents(code);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    btn.textContent = "Press Ctrl+C";
  }
  setTimeout(() => { btn.textContent = "Copy"; }, 1800);
}

// ---- finder ----

const HW_RANK = { "cpu": 0, "n/a": 0, "laptop": 1, "gpu": 2, "datacenter": 3 };

const FINDER = {
  task: [
    { id: "chat",       label: "Chat or write",          cats: ["llm", "app-ui", "inference"], exclude: (e) => e._cats.includes("image-gen") || (e.tasks || []).includes("image-gen") },
    { id: "code",       label: "Help with code",         cats: ["code-llm"], extra: (e) => /coder|codestral|starcoder/i.test(e.name) || ["Aider", "OpenHands"].includes(e.name) },
    { id: "transcribe", label: "Speech to text",         cats: ["speech-to-text"] },
    { id: "speak",      label: "Text to speech",         cats: ["text-to-speech"] },
    { id: "translate",  label: "Translate",              cats: ["translation"] },
    { id: "images",     label: "Make images",            cats: ["image-gen"] },
    { id: "video",      label: "Make video",             cats: ["video-gen"] },
    { id: "see",        label: "Ask about photos",       cats: ["vision-language"] },
    { id: "docs",       label: "Read scans & PDFs",      cats: ["ocr"] },
    { id: "detect",     label: "Spot objects in photos", cats: ["vision"] },
    { id: "music",      label: "Music & audio",          cats: ["audio-music"] },
    { id: "search",     label: "Search my documents",    cats: ["embeddings", "agents-rag", "vector-db"] },
  ],
  hw: [
    { id: 0, label: "Basic or older computer" },
    { id: 1, label: "Modern laptop", note: "8–16 GB" },
    { id: 2, label: "Gaming PC", note: "with graphics card" },
    { id: 3, label: "Server or cloud" },
  ],
  biz: [
    { id: "no", label: "No, personal or study" },
    { id: "yes", label: "Yes, for business" },
  ],
};
const finder = { task: "chat", hw: 1, biz: "no" };

function finderMatches() {
  const t = FINDER.task.find((x) => x.id === finder.task);
  const out = [];
  // Hand-picked entries come first in the list, so their copies from crawls (often under another URL) get skipped.
  const seen = new Set(items.filter((e) => e.source === "curated").map((e) => e.name.toLowerCase()));
  for (const e of items) {
    if (e.source !== "curated" && seen.has(e.name.toLowerCase())) continue;
    const rank = HW_RANK[e.hardware];
    if (rank === undefined || rank > finder.hw) continue;
    if (finder.biz === "yes" && (e.license_type === "non-commercial" || e.license_type === "custom")) continue;
    // Main category only: GitHub topic tags put general libraries into many extra categories.
    // Apps (like ComfyUI) count for the tasks they list.
    const fits = t.cats.includes(e.category)
      || (e.category === "app-ui" && (e.tasks || []).some((x) => t.cats.includes(x)))
      || (t.extra && t.extra(e));
    if (!fits || (t.exclude && t.exclude(e))) continue;
    if (e.source !== "curated") seen.add(e.name.toLowerCase());
    // Prefer hand-picked entries with written steps (easy ones first: no compiling), then popularity.
    const hard = e.howto && e.howto.some((s) => /cmake|git clone|docker/.test(s.cmd || ""));
    const score = (e.source === "curated" ? 4e12 : 0) + (e.howto ? 2e12 : 0) + (e.howto && !hard ? 1e12 : 0) + e._pop;
    out.push([e, score]);
  }
  out.sort((a, b) => b[1] - a[1]);
  return out.map((x) => x[0]);
}

function renderFinder() {
  for (const [key, el] of [["task", "fTask"], ["hw", "fHw"], ["biz", "fBiz"]]) {
    $(el).innerHTML = FINDER[key].map((o) =>
      `<button class="pill" data-key="${key}" data-val="${o.id}" aria-pressed="${String(o.id === finder[key])}">${esc(o.label)}${o.note ? `<small>${esc(o.note)}</small>` : ""}</button>`
    ).join("");
  }
  const list = finderMatches();
  $("fPicks").innerHTML = list.slice(0, 3).map((e) => card(e, false)).join("") ||
    '<p class="empty">Nothing fits that combination yet. Try a more powerful computer option.</p>';
  $("fPicksTitle").hidden = list.length === 0;
  $("fAll").hidden = list.length <= 3;
  $("fAll").textContent = "See more like these";
}

function finderToFilters() {
  const t = FINDER.task.find((x) => x.id === finder.task);
  state.q = "";
  state.cat = t.cats[0];
  state.hw = new Set(Object.keys(HW_RANK).filter((k) => HW_RANK[k] <= finder.hw));
  state.lic = finder.biz === "yes" ? new Set(["permissive", "copyleft", "restricted-open-weight"]) : new Set();
  state.src = new Set();
  state.country = "";
  syncControls();
  rerender();
  $("resultsTop").scrollIntoView({ behavior: "smooth", block: "start" });
}

function render() {
  const list = filtered();
  $("resultCount").textContent = `${list.length.toLocaleString()} result${list.length === 1 ? "" : "s"}`;
  $("results").innerHTML = list.slice(0, state.shown).map(card).join("");
  $("more").hidden = list.length <= state.shown;
  $("more").textContent = `Show more (${(list.length - state.shown).toLocaleString()} left)`;
  $("empty").hidden = list.length > 0;
  for (const btn of $("categoryChips").children) btn.setAttribute("aria-pressed", String(btn.dataset.cat === state.cat));
  saveHash();
}

function rerender() {
  state.shown = PAGE;
  render();
}

function optionList(container, defs, set, counts) {
  container.innerHTML = Object.entries(defs)
    .filter(([k]) => counts[k])
    .map(([k, d]) => `<label class="opt"><input type="checkbox" value="${esc(k)}">
      <span>${esc(d.label)}<small>${esc(d.help)}</small></span><span class="n">${compact(counts[k])}</span></label>`)
    .join("");
  container.addEventListener("change", (ev) => {
    const v = ev.target.value;
    ev.target.checked ? set.add(v) : set.delete(v);
    rerender();
  });
}

function countBy(fn) {
  const c = {};
  for (const e of items) for (const k of [].concat(fn(e))) c[k] = (c[k] || 0) + 1;
  return c;
}

function buildFilters() {
  const catCounts = countBy((e) => e._cats);
  const chips = [`<button class="chip" data-cat="">All<span class="n">${compact(items.length)}</span></button>`];
  for (const [k, d] of Object.entries(CATEGORIES)) {
    if (catCounts[k]) chips.push(`<button class="chip" data-cat="${k}">${esc(d.label)}<span class="n">${compact(catCounts[k])}</span></button>`);
  }
  $("categoryChips").innerHTML = chips.join("");
  $("categoryChips").addEventListener("click", (ev) => {
    const b = ev.target.closest(".chip");
    if (!b) return;
    state.cat = b.dataset.cat === state.cat ? "" : b.dataset.cat;
    rerender();
  });

  optionList($("licenseFilter"), LICENSES, state.lic, countBy((e) => e.license_type));
  optionList($("hardwareFilter"), HARDWARE, state.hw, countBy((e) => e.hardware));
  optionList($("sourceFilter"), SOURCES, state.src, countBy((e) => e.source));

  // Curated entries may say "USA/France"; split so each country is selectable.
  const countries = new Set();
  for (const e of items) for (const c of (e.country || "").split("/")) if (c.trim()) countries.add(c.trim());
  $("country").insertAdjacentHTML("beforeend",
    [...countries].sort().map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join(""));
}

function syncControls() {
  $("q").value = state.q;
  $("sort").value = state.sort;
  $("country").value = state.country;
  for (const [id, set] of [["licenseFilter", state.lic], ["hardwareFilter", state.hw], ["sourceFilter", state.src]]) {
    for (const input of $(id).querySelectorAll("input")) input.checked = set.has(input.value);
  }
}

function saveHash() {
  const p = new URLSearchParams();
  if (state.q) p.set("q", state.q);
  if (state.cat) p.set("cat", state.cat);
  if (state.lic.size) p.set("lic", [...state.lic].join(","));
  if (state.hw.size) p.set("hw", [...state.hw].join(","));
  if (state.src.size) p.set("src", [...state.src].join(","));
  if (state.country) p.set("country", state.country);
  if (state.sort !== "recommended") p.set("sort", state.sort);
  const h = p.toString();
  try { history.replaceState(null, "", h ? "#" + h : location.pathname + location.search); } catch { /* some embeds refuse URL changes */ }
}

function loadHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  const set = (k) => new Set((p.get(k) || "").split(",").filter(Boolean));
  state.q = p.get("q") || "";
  state.cat = p.get("cat") || "";
  state.lic = set("lic");
  state.hw = set("hw");
  state.src = set("src");
  state.country = p.get("country") || "";
  state.sort = p.get("sort") || "recommended";
}

// ---- compare ----

function renderCompareBar() {
  $("compareNote").textContent = "";
  $("compareBar").hidden = compare.size === 0;
  $("compareList").textContent = `${compare.size}/${MAX_COMPARE}: ` + [...compare.values()].map((e) => e.name).join(", ");
  $("compareOpen").disabled = compare.size < 2;
}

function openCompare() {
  const list = [...compare.values()];
  const rows = [
    ["Made by", (e) => esc(e.org) || "—"],
    ["Country", (e) => esc(e.country) || "—"],
    ["What it does", (e) => esc(e.description) || esc((e.tasks || []).join(", ")) || "—"],
    ["Category", (e) => esc(e._cats.map((c) => CATEGORIES[c]?.label || c).join(", "))],
    ["License", (e) => `<span class="tag lic-${esc(e.license_type)}">${esc((LICENSES[e.license_type] || LICENSES.custom).label)}</span><br><small>${esc(e.license)}</small>`],
    ["Runs on", (e) => esc(HARDWARE[e.hardware]?.label || e.hardware)],
    ["Popularity", (e) => [e.stars && `★ ${compact(e.stars)} stars`, e.downloads && `↓ ${compact(e.downloads)} downloads/mo`, e.likes && `♥ ${compact(e.likes)} likes`].filter(Boolean).join("<br>") || "—"],
    ["Language", (e) => esc(e.language || e.library) || "—"],
    ["Link", (e) => `<a href="${esc(e.url)}" target="_blank" rel="noopener">Open ↗</a>`],
  ];
  $("compareTable").innerHTML =
    `<thead><tr><th></th>${list.map((e) => `<th scope="col">${esc(e.name)}</th>`).join("")}</tr></thead><tbody>` +
    rows.map(([label, fn]) => `<tr><th scope="row">${label}</th>${list.map((e) => `<td>${fn(e)}</td>`).join("")}</tr>`).join("") +
    "</tbody>";
  $("compareDialog").showModal();
}

// ---- wiring ----

function wire() {
  let t;
  $("q").addEventListener("input", (ev) => {
    clearTimeout(t);
    t = setTimeout(() => { state.q = ev.target.value.trim(); rerender(); }, 120);
  });
  $("sort").addEventListener("change", (ev) => { state.sort = ev.target.value; rerender(); });
  $("country").addEventListener("change", (ev) => { state.country = ev.target.value; rerender(); });
  $("more").addEventListener("click", () => { state.shown += PAGE; render(); });
  $("reset").addEventListener("click", () => {
    Object.assign(state, { q: "", cat: "", lic: new Set(), hw: new Set(), src: new Set(), country: "", sort: "recommended" });
    syncControls();
    rerender();
  });
  $("toggleFilters").addEventListener("click", (ev) => {
    const open = $("filters").classList.toggle("open");
    ev.currentTarget.setAttribute("aria-expanded", String(open));
  });
  $("results").addEventListener("change", (ev) => {
    const i = ev.target.dataset.cmp;
    if (i === undefined) return;
    const e = items[+i];
    if (ev.target.checked) {
      if (compare.size >= MAX_COMPARE) {
        ev.target.checked = false;
        $("compareNote").textContent = `You can compare up to ${MAX_COMPARE} at a time. Untick one first.`;
        return;
      }
      compare.set(e._i, e);
    } else compare.delete(e._i);
    renderCompareBar();
  });
  $("compareClear").addEventListener("click", () => { compare.clear(); renderCompareBar(); render(); });
  $("compareOpen").addEventListener("click", openCompare);
  $("compareClose").addEventListener("click", () => $("compareDialog").close());
  $("compareDialog").addEventListener("click", (ev) => { if (ev.target === ev.currentTarget) ev.currentTarget.close(); });
  window.addEventListener("hashchange", () => { loadHash(); syncControls(); rerender(); });

  document.addEventListener("click", (ev) => {
    const how = ev.target.closest("[data-howto]");
    if (how) { openHowto(items[+how.dataset.howto]); return; }
    const pill = ev.target.closest(".pill");
    if (pill) {
      const { key, val } = pill.dataset;
      finder[key] = key === "hw" ? +val : val;
      renderFinder();
    }
  });
  $("fAll").addEventListener("click", finderToFilters);
  $("howtoBody").addEventListener("click", (ev) => { if (ev.target.matches("[data-copy]")) copyCode(ev.target); });
  $("howtoClose").addEventListener("click", () => $("howtoDialog").close());
  $("howtoDialog").addEventListener("click", (ev) => { if (ev.target === ev.currentTarget) ev.currentTarget.close(); });
}

async function main() {
  try {
    const res = await fetch("catalog.json");
    const data = await res.json();
    items = data.items.map(prepare);
    const s = data.stats;
    const countries = new Set(items.flatMap((e) => (e.country || "").split("/").map((c) => c.trim()).filter(Boolean)));
    $("counts").textContent = `${items.length.toLocaleString()} open-source AI projects · ${Object.keys(s.by_category).length} kinds of task · hand-picked entries from ${countries.size} countries`;
    $("generated").textContent = `Catalog updated ${new Date(s.generated).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}.`;
    buildFilters();
    loadHash();
    syncControls();
    wire();
    renderFinder();
    render();
  } catch (err) {
    $("counts").textContent = "Couldn't load the catalog. If you opened this file directly, serve the folder instead: python -m http.server -d site";
    console.error(err);
  }
}

main();
