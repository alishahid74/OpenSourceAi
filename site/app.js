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

function card(e) {
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
      <label class="cmp"><input type="checkbox" data-cmp="${e._i}" ${checked}> Compare</label>
    </div>
  </article>`;
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
    render();
  } catch (err) {
    $("counts").textContent = "Couldn't load the catalog. If you opened this file directly, serve the folder instead: python -m http.server -d site";
    console.error(err);
  }
}

main();
