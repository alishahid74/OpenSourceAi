"use strict";

// Everyday English words people use to search for each category. Labels are in i18n.js ("cat.<key>").
const CATEGORIES = {
  "llm":             "chat chatbot assistant write writing text llm language gpt answer reasoning",
  "code-llm":        "code coding programming developer",
  "vision-language": "image chat describe picture photo vqa multimodal see",
  "vision":          "detect detection segment segmentation object camera photo cutout remove background depth classify",
  "image-gen":       "image generate generation art draw picture photo diffusion",
  "video-gen":       "video generate generation animation movie clip",
  "speech-to-text":  "transcribe transcription speech voice audio subtitles dictation asr recognition",
  "text-to-speech":  "tts voice speak read aloud narration speech clone",
  "audio-music":     "music song audio sound stems vocals",
  "translation":     "translate translation language languages multilingual",
  "embeddings":      "search semantic embeddings similarity retrieval vector",
  "ocr":             "ocr scan document pdf read text extract receipt handwriting",
  "agents-rag":      "agent agents rag automation workflow assistant documents chatbot",
  "inference":       "local offline run server serve private inference",
  "app-ui":          "app ui interface desktop webui gui",
  "vector-db":       "vector database search store",
  "training":        "train training finetune fine-tune lora",
  "framework":       "framework library deep learning machine learning",
  "classic-ml-nlp":  "sentiment classify classification ner entities summarize summarization question nlp",
  "science":         "science protein biology weather climate forecast medicine",
  "robotics":        "robot robotics reinforcement control",
  "dataset":         "data dataset corpus training",
};

// Filter groups in display order; labels and help text are "lic.<key>", "hw.<key>", "src.<key>" in i18n.js.
const LICENSES = ["permissive", "copyleft", "restricted-open-weight", "non-commercial", "custom"];
const HARDWARE = ["cpu", "laptop", "gpu", "datacenter", "n/a", "unknown"];
const SOURCES = ["curated", "huggingface", "github"];

const catLabel = (c) => (CATEGORIES[c] ? t(`cat.${c}`) : c);
const licLabel = (l) => t(`lic.${LICENSES.includes(l) ? l : "custom"}`);

const PAGE = 60;
const MAX_COMPARE = 4;

const $ = (id) => document.getElementById(id);
const state = { q: "", cat: "", lic: new Set(), hw: new Set(), src: new Set(), country: "", fitsOnly: false, sort: "recommended", shown: PAGE };
const compare = new Map();
let items = [];

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function compact(n) {
  if (!n) return "";
  return Intl.NumberFormat(LANG, { notation: "compact", maximumFractionDigits: 1 }).format(n);
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
    // Category names in every language, so people can search in their own words.
    ...cats.map((c) => CATEGORIES[c] ? Object.values(STRINGS).map((d) => d[`cat.${c}`] || "").join(" ") + " " + CATEGORIES[c] : c),
  ].join(" ").toLowerCase().replace(/[-_/]/g, " ");
  e._name = (e.name + " " + (e.org || "")).toLowerCase().replace(/[-_/]/g, " ");
  return e;
}

function tokens(q) {
  return q.toLowerCase().replace(/[-_/]/g, " ").split(/\s+/).filter((w) => w.length > 1 || /\d/.test(w) || /[^\x00-\x7f]/.test(w));
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
    if (state.fitsOnly && fitFor(e)?.level === "no") continue;
    // Rank by how many words match (name matches count extra); allow one word to miss on longer queries.
    let score = 0;
    if (toks.length) {
      let matched = 0;
      for (const tok of toks) {
        if (e._name.includes(tok)) { matched++; score += 3; }
        else if (e._hay.includes(tok)) { matched++; score += 1; }
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
  const fit = fitFor(e);
  const pop = e.stars ? `★ ${compact(e.stars)}` : e.downloads ? `↓ ${t("card.perMonth", { n: compact(e.downloads) })}` : "";
  const desc = e.description
    ? `<p class="desc">${esc(e.description)}</p>`
    : `<p class="desc none">${esc((e.tasks || []).slice(0, 4).join(", ") || t("card.noDesc"))}</p>`;
  const checked = compare.has(e._i) ? "checked" : "";
  return `<article class="card${e.source === "curated" ? " featured" : ""}">
    <div class="card-head">
      <div>
        <h3><a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.name)}</a></h3>
        <div class="org">${esc(e.org)}${e.country ? " · " + esc(e.country) : ""}</div>
      </div>
      ${e.source === "curated" ? `<span class="tag pick" title="${esc(t("card.pickTitle"))}">${esc(t("card.pick"))}</span>` : ""}
    </div>
    ${desc}
    <div class="tags">
      <span class="tag lic-${esc(e.license_type)}" title="${esc(e.license)}">${esc(licLabel(e.license_type))}</span>
      ${CATEGORIES[e.category] ? `<span class="tag">${esc(catLabel(e.category))}</span>` : ""}
      ${fit ? `<span class="tag fit-${fit.level}" title="${esc(t("fit.title", { size: fit.size, pc: pcSummary() }))}">${{ good: "✓", slow: "⚠", no: "✕" }[fit.level]} ${esc(fit.text)}</span>`
        : HARDWARE.includes(e.hardware) && e.hardware !== "unknown" && e.hardware !== "n/a" ? `<span class="tag">${esc(t(`hw.${e.hardware}`))}</span>` : ""}
    </div>
    <div class="card-foot">
      <span>${esc(pop)}</span>
      <div class="card-actions">
        <button class="howto-btn" data-howto="${e._i}">${esc(t("card.howto"))}</button>
        ${withCompare ? `<label class="cmp"><input type="checkbox" data-cmp="${e._i}" ${checked}> ${esc(t("compare.check"))}</label>` : ""}
      </div>
    </div>
  </article>`;
}

// ---- how to use ----

const pyStep = () => ({ t: t("step.python") });

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
      { t: t("step.readme", { url: `${e.url}#readme` }) },
      { t: t("step.git") },
      { cmd: `git clone ${e.url}.git` },
    ];
    if (e.language) steps.push({ t: t("step.lang", { lang: e.language }) });
    return steps;
  }
  if (!id) return [{ t: t("step.openPage", { url: e.url }) }];
  const name = id.toLowerCase();
  if (e.library === "gguf" || name.includes("gguf")) {
    return [
      { t: t("step.ollama") },
      { cmd: `ollama run hf.co/${id}` },
      { t: t("step.llamacpp") },
      { cmd: `llama-cli -hf ${id}` },
    ];
  }
  if (e.library === "sentence-transformers") {
    return [pyStep(), { cmd: "pip install sentence-transformers" },
      { code: `from sentence_transformers import SentenceTransformer\n\nmodel = SentenceTransformer("${id}")\nvecs = model.encode(["first sentence", "second sentence"])\nprint(model.similarity(vecs[0], vecs[1]))` }];
  }
  if (e.library === "diffusers" && task === "text-to-image") {
    return [pyStep(), { cmd: "pip install diffusers transformers accelerate torch" },
      { code: `from diffusers import DiffusionPipeline\nimport torch\n\npipe = DiffusionPipeline.from_pretrained("${id}", torch_dtype=torch.float16).to("cuda")\nimage = pipe("a watercolor painting of a mountain village").images[0]\nimage.save("out.png")` },
      { t: t("step.gpuNote") }];
  }
  if (e.library === "mlx" && task === "text-generation") {
    return [{ t: t("step.mac") }, { cmd: "pip install mlx-lm" }, { cmd: `mlx_lm.generate --model ${id} --prompt "Hello"` }];
  }
  if (e.library === "transformers" && task) {
    return [pyStep(), { cmd: "pip install transformers torch" },
      { code: `from transformers import pipeline\n\npipe = pipeline("${task}", model="${id}")\nprint(pipe(${PIPELINE_INPUT[task] || '"your input here"'}))` },
      { t: t("step.more", { url: e.url }) }];
  }
  return [{ t: t("step.hfPage", { url: e.url }) }];
}

function linkify(text) {
  return esc(text).replace(/https?:\/\/[^\s)]+[^\s).,]/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
}

function codeBox(code) {
  return `<div class="codebox" dir="ltr"><pre><code>${esc(code)}</code></pre><button class="ghost copy" data-copy>${esc(t("copy"))}</button></div>`;
}

function openHowto(e) {
  const steps = e.howto || autoHowto(e);
  const caution = ["non-commercial", "restricted-open-weight", "custom", "copyleft"].includes(e.license_type) ? t(`caution.${e.license_type}`) : "";
  const fit = fitFor(e);
  const fitLine = fit
    ? `<p class="howto-meta"><span class="tag fit-${fit.level}">${esc(fit.text)}</span> ${esc(t("howto.needs", { size: fit.size, quant: memNeed(e).quant ? t("howto.quant") : "", pc: pcSummary() }))}</p>`
    : "";
  const hwKnown = HARDWARE.includes(e.hardware) && e.hardware !== "unknown";
  $("howtoTitle").textContent = t("howto.title", { name: e.name });
  $("howtoBody").innerHTML =
    `<p class="howto-meta">${esc(licLabel(e.license_type))} (<bdi>${esc(e.license)}</bdi>)${!fit && hwKnown ? " · " + esc(t(`hw.${e.hardware}`)) : ""}</p>` + fitLine +
    // Hand-written steps are in English; say so in other languages.
    (e.howto && LANG !== "en" ? `<p class="howto-meta">${esc(t("howto.english"))}</p>` : "") +
    `<ol>${steps.map((s) => `<li>${s.t ? `<p>${linkify(s.t)}</p>` : codeBox(s.cmd || s.code)}</li>`).join("")}</ol>` +
    (caution ? `<p class="caution">${esc(caution)}</p>` : "") +
    `<p class="howto-meta">${esc(t("howto.page"))} <a href="${esc(e.url)}" target="_blank" rel="noopener" dir="ltr">${esc(e.url)}</a></p>`;
  $("howtoDialog").showModal();
}

async function copyCode(btn) {
  const code = btn.previousElementSibling;
  try {
    await navigator.clipboard.writeText(code.textContent);
    btn.textContent = t("copied");
  } catch {
    const range = document.createRange();
    range.selectNodeContents(code);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    btn.textContent = t("pressCopy");
  }
  setTimeout(() => { btn.textContent = t("copy"); }, 1800);
}

// ---- finder ----

const HW_RANK = { "cpu": 0, "n/a": 0, "laptop": 1, "gpu": 2, "datacenter": 3 };

const FINDER = {
  task: [
    { id: "chat",       cats: ["llm", "app-ui", "inference"], exclude: (e) => e._cats.includes("image-gen") || (e.tasks || []).includes("image-gen") },
    { id: "code",       cats: ["code-llm"], extra: (e) => /coder|codestral|starcoder/i.test(e.name) || ["Aider", "OpenHands"].includes(e.name) },
    { id: "transcribe", cats: ["speech-to-text"] },
    { id: "speak",      cats: ["text-to-speech"] },
    { id: "translate",  cats: ["translation"] },
    { id: "images",     cats: ["image-gen"] },
    { id: "video",      cats: ["video-gen"] },
    { id: "see",        cats: ["vision-language"] },
    { id: "docs",       cats: ["ocr"] },
    { id: "detect",     cats: ["vision"] },
    { id: "music",      cats: ["audio-music"] },
    { id: "search",     cats: ["embeddings", "agents-rag", "vector-db"] },
  ],
  // Labels are "task.<id>", "hwq.<id>" and "biz.<id>" in i18n.js. Each computer answer is a typical machine; "Set my exact computer" overrides it.
  hw: [
    { id: 0, ram: 8, vram: 0 },
    { id: 1, note: true, ram: 16, vram: 0 },
    { id: 2, note: true, ram: 32, vram: 12 },
    { id: 3, ram: 256, vram: 80 },
  ],
  biz: [
    { id: "no" },
    { id: "yes" },
  ],
};
const finder = { task: "chat", hw: 1, biz: "no" };

// ---- will it run on my computer? ----

const pc = { ram: 16, vram: 0, mac: false };
const PC_KEY = "opensourceai.pc";

function loadPC() {
  try {
    const saved = JSON.parse(localStorage.getItem(PC_KEY) || "null");
    if (saved && typeof saved.ram === "number") Object.assign(pc, saved);
  } catch { /* storage unavailable */ }
  finder.hw = presetFor(pc) ?? tierFor(pc);
}

function savePC() {
  try { localStorage.setItem(PC_KEY, JSON.stringify(pc)); } catch { /* storage unavailable */ }
}

function presetFor(p) {
  const hit = FINDER.hw.find((o) => o.ram === p.ram && o.vram === p.vram && !p.mac);
  return hit ? hit.id : null;
}

// Rough tier for entries without a known size.
function tierFor(p) {
  const gpu = p.mac ? p.ram * 0.7 : p.vram;
  if (gpu >= 40) return 3;
  if (gpu >= 6) return 2;
  return p.ram >= 16 ? 1 : 0;
}

// Chat-style models are usually run 4-bit compressed (Ollama, llama.cpp): ~0.6 bytes per parameter.
// Everything else is assumed to run at 16-bit: 2 bytes per parameter. Plus room for working memory.
const QUANT_CATS = new Set(["llm", "code-llm", "vision-language"]);

function memNeed(e) {
  if (!e.params) return null;
  const quant = e.library === "gguf" || /gguf/i.test(e.name) || QUANT_CATS.has(e.category);
  const gb = (e.params * (quant ? 0.6 : 2)) / 1e9 + (quant ? 1 : 0.5);
  return { gb, quant, gpuOnly: e.category === "image-gen" || e.category === "video-gen" };
}

function fitFor(e) {
  const need = memNeed(e);
  if (!need) return null;
  const gpu = pc.mac ? pc.ram * 0.7 : pc.vram;
  const size = need.gb < 1 ? t("size.under1")
    : t("size.about", { n: need.gb.toLocaleString(LANG, { maximumFractionDigits: need.gb < 10 ? 1 : 0 }) });
  const fit = (level, key) => ({ level, text: t(`fit.${key}`), size });
  if (gpu && need.gb <= gpu * 0.9) return fit("good", "good");
  if (need.gpuOnly) return need.gb <= pc.ram * 0.75 ? fit("slow", "slowGpu") : fit("no", "no");
  if (need.gb <= Math.min(4, pc.ram * 0.5)) return fit("good", "good");
  if (need.gb <= pc.ram * 0.75) return fit("slow", "slow");
  return fit("no", "no");
}

function pcSummary() {
  const gpu = pc.mac ? t("pc.apple") : pc.vram ? t("pc.gpu", { n: pc.vram }) : t("pc.noGpu");
  return t("pc.summary", { ram: pc.ram, gpu });
}

function syncPCControls() {
  $("pcRam").value = String(pc.ram);
  $("pcVram").value = String(pc.vram);
  $("pcMac").checked = pc.mac;
  $("pcVram").disabled = pc.mac;
  $("pcSummary").textContent = pcSummary();
}

function pcChanged() {
  savePC();
  syncPCControls();
  renderFinder();
  rerender();
}

function finderMatches() {
  const task = FINDER.task.find((x) => x.id === finder.task);
  const out = [];
  // Hand-picked entries come first in the list, so their copies from crawls (often under another URL) get skipped.
  const seen = new Set(items.filter((e) => e.source === "curated").map((e) => e.name.toLowerCase()));
  for (const e of items) {
    if (e.source !== "curated" && seen.has(e.name.toLowerCase())) continue;
    // Use the real size when known; otherwise the rough hardware tier.
    const fit = fitFor(e);
    if (fit ? fit.level === "no" : !(HW_RANK[e.hardware] <= finder.hw)) continue;
    if (finder.biz === "yes" && (e.license_type === "non-commercial" || e.license_type === "custom")) continue;
    // Main category only: GitHub topic tags put general libraries into many extra categories.
    // Apps (like ComfyUI) count for the tasks they list.
    const fits = task.cats.includes(e.category)
      || (e.category === "app-ui" && (e.tasks || []).some((x) => task.cats.includes(x)))
      || (task.extra && task.extra(e));
    if (!fits || (task.exclude && task.exclude(e))) continue;
    if (e.source !== "curated") seen.add(e.name.toLowerCase());
    // Prefer hand-picked entries with written steps (easy ones first: no compiling), then popularity.
    const hard = e.howto && e.howto.some((s) => /cmake|git clone|docker/.test(s.cmd || ""));
    const score = (e.source === "curated" ? 4e12 : 0) + (e.howto ? 2e12 : 0) + (e.howto && !hard ? 1e12 : 0)
      + (fit && fit.level === "slow" ? -5e11 : 0) + e._pop;
    out.push([e, score]);
  }
  out.sort((a, b) => b[1] - a[1]);
  return out.map((x) => x[0]);
}

function renderFinder() {
  const preset = presetFor(pc);
  for (const [key, el, prefix] of [["task", "fTask", "task"], ["hw", "fHw", "hwq"], ["biz", "fBiz", "biz"]]) {
    const current = key === "hw" ? preset : finder[key];
    $(el).innerHTML = FINDER[key].map((o) =>
      `<button class="pill" data-key="${key}" data-val="${o.id}" aria-pressed="${String(o.id === current)}">${esc(t(`${prefix}.${o.id}`))}${o.note ? `<small>${esc(t(`${prefix}.${o.id}.note`))}</small>` : ""}</button>`
    ).join("");
  }
  if (preset === null) {
    $("fHw").insertAdjacentHTML("beforeend", `<button class="pill" aria-pressed="true" disabled>${esc(t("finder.myComputer"))}<small>${esc(pcSummary())}</small></button>`);
  }
  const list = finderMatches();
  $("fPicks").innerHTML = list.slice(0, 3).map((e) => card(e, false)).join("") ||
    `<p class="empty">${esc(t("finder.none"))}</p>`;
  $("fPicksTitle").hidden = list.length === 0;
  $("fAll").hidden = list.length <= 3;
}

function finderToFilters() {
  const task = FINDER.task.find((x) => x.id === finder.task);
  state.q = "";
  state.cat = task.cats[0];
  state.hw = new Set(Object.keys(HW_RANK).filter((k) => HW_RANK[k] <= finder.hw));
  state.lic = finder.biz === "yes" ? new Set(["permissive", "copyleft", "restricted-open-weight"]) : new Set();
  state.src = new Set();
  state.country = "";
  state.fitsOnly = true;
  syncControls();
  rerender();
  $("resultsTop").scrollIntoView({ behavior: "smooth", block: "start" });
}

function render() {
  const list = filtered();
  $("resultCount").textContent = t("results", { n: list.length });
  $("results").innerHTML = list.slice(0, state.shown).map(card).join("");
  $("more").hidden = list.length <= state.shown;
  $("more").textContent = t("more", { n: list.length - state.shown });
  $("empty").hidden = list.length > 0;
  for (const btn of $("categoryChips").children) btn.setAttribute("aria-pressed", String(btn.dataset.cat === state.cat));
  saveHash();
}

function rerender() {
  state.shown = PAGE;
  render();
}

function optionList(container, keys, prefix, set, counts) {
  container.innerHTML = keys
    .filter((k) => counts[k])
    .map((k) => `<label class="opt"><input type="checkbox" value="${esc(k)}" ${set.has(k) ? "checked" : ""}>
      <span>${esc(t(`${prefix}.${k}`))}<small>${esc(t(`${prefix}.${k}.help`))}</small></span><span class="n">${compact(counts[k])}</span></label>`)
    .join("");
}

function countBy(fn) {
  const c = {};
  for (const e of items) for (const k of [].concat(fn(e))) c[k] = (c[k] || 0) + 1;
  return c;
}

// Draws the category chips and sidebar options; runs again when the language changes.
function buildFilters() {
  const catCounts = countBy((e) => e._cats);
  const chips = [`<button class="chip" data-cat="">${esc(t("all"))}<span class="n">${compact(items.length)}</span></button>`];
  for (const k of Object.keys(CATEGORIES)) {
    if (catCounts[k]) chips.push(`<button class="chip" data-cat="${k}">${esc(catLabel(k))}<span class="n">${compact(catCounts[k])}</span></button>`);
  }
  $("categoryChips").innerHTML = chips.join("");

  optionList($("licenseFilter"), LICENSES, "lic", state.lic, countBy((e) => e.license_type));
  optionList($("hardwareFilter"), HARDWARE, "hw", state.hw, countBy((e) => e.hardware));
  optionList($("sourceFilter"), SOURCES, "src", state.src, countBy((e) => e.source));

  // Curated entries may say "USA/France"; split so each country is selectable.
  const countries = new Set();
  for (const e of items) for (const c of (e.country || "").split("/")) if (c.trim()) countries.add(c.trim());
  $("country").innerHTML = `<option value="">${esc(t("side.anyCountry"))}</option>` +
    [...countries].sort().map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
}

function syncControls() {
  $("q").value = state.q;
  $("sort").value = state.sort;
  $("fitsOnly").checked = state.fitsOnly;
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
    ["cmp.madeBy", (e) => esc(e.org) || "—"],
    ["cmp.country", (e) => esc(e.country) || "—"],
    ["cmp.what", (e) => esc(e.description) || esc((e.tasks || []).join(", ")) || "—"],
    ["cmp.category", (e) => esc(e._cats.map(catLabel).join(", "))],
    ["cmp.license", (e) => `<span class="tag lic-${esc(e.license_type)}">${esc(licLabel(e.license_type))}</span><br><small>${esc(e.license)}</small>`],
    ["cmp.yourPc", (e) => { const f = fitFor(e); return f ? `<span class="tag fit-${f.level}">${esc(f.text)}</span><br><small>${esc(t("cmp.needs", { size: f.size }))}</small>` : esc(HARDWARE.includes(e.hardware) ? t(`hw.${e.hardware}`) : e.hardware); }],
    ["cmp.popularity", (e) => [e.stars && t("cmp.stars", { n: compact(e.stars) }), e.downloads && t("cmp.downloads", { n: compact(e.downloads) }), e.likes && t("cmp.likes", { n: compact(e.likes) })].filter(Boolean).map(esc).join("<br>") || "—"],
    ["cmp.language", (e) => esc(e.language || e.library) || "—"],
    ["cmp.link", (e) => `<a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(t("cmp.open"))}</a>`],
  ];
  $("compareTable").innerHTML =
    `<thead><tr><th></th>${list.map((e) => `<th scope="col">${esc(e.name)}</th>`).join("")}</tr></thead><tbody>` +
    rows.map(([label, fn]) => `<tr><th scope="row">${esc(t(label))}</th>${list.map((e) => `<td>${fn(e)}</td>`).join("")}</tr>`).join("") +
    "</tbody>";
  $("compareDialog").showModal();
}

// ---- wiring ----

function wire() {
  let timer;
  $("q").addEventListener("input", (ev) => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.q = ev.target.value.trim(); rerender(); }, 120);
  });
  $("sort").addEventListener("change", (ev) => { state.sort = ev.target.value; rerender(); });
  $("country").addEventListener("change", (ev) => { state.country = ev.target.value; rerender(); });
  $("more").addEventListener("click", () => { state.shown += PAGE; render(); });
  $("reset").addEventListener("click", () => {
    Object.assign(state, { q: "", cat: "", lic: new Set(), hw: new Set(), src: new Set(), country: "", fitsOnly: false, sort: "recommended" });
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
        $("compareNote").textContent = t("compare.limit", { n: MAX_COMPARE });
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
  $("categoryChips").addEventListener("click", (ev) => {
    const b = ev.target.closest(".chip");
    if (!b) return;
    state.cat = b.dataset.cat === state.cat ? "" : b.dataset.cat;
    rerender();
  });
  // Look the set up on each change: reset and loadHash replace state.lic/hw/src with new sets.
  for (const [id, key] of [["licenseFilter", "lic"], ["hardwareFilter", "hw"], ["sourceFilter", "src"]]) {
    $(id).addEventListener("change", (ev) => {
      const v = ev.target.value;
      ev.target.checked ? state[key].add(v) : state[key].delete(v);
      rerender();
    });
  }
  $("lang").addEventListener("change", (ev) => setLang(ev.target.value));
  window.addEventListener("hashchange", () => { loadHash(); syncControls(); rerender(); });

  document.addEventListener("click", (ev) => {
    const how = ev.target.closest("[data-howto]");
    if (how) { openHowto(items[+how.dataset.howto]); return; }
    const pill = ev.target.closest(".pill[data-key]");
    if (pill) {
      const { key, val } = pill.dataset;
      if (key === "hw") {
        const o = FINDER.hw[+val];
        Object.assign(pc, { ram: o.ram, vram: o.vram, mac: false });
        finder.hw = o.id;
        pcChanged();
      } else {
        finder[key] = val;
        renderFinder();
      }
    }
  });
  const specChanged = () => {
    Object.assign(pc, { ram: +$("pcRam").value, vram: $("pcMac").checked ? 0 : +$("pcVram").value, mac: $("pcMac").checked });
    finder.hw = presetFor(pc) ?? tierFor(pc);
    pcChanged();
  };
  for (const id of ["pcRam", "pcVram", "pcMac"]) $(id).addEventListener("change", specChanged);
  $("fitsOnly").addEventListener("change", (ev) => { state.fitsOnly = ev.target.checked; rerender(); });
  $("fAll").addEventListener("click", finderToFilters);
  $("howtoBody").addEventListener("click", (ev) => { if (ev.target.matches("[data-copy]")) copyCode(ev.target); });
  $("howtoClose").addEventListener("click", () => $("howtoDialog").close());
  $("howtoDialog").addEventListener("click", (ev) => { if (ev.target === ev.currentTarget) ev.currentTarget.close(); });
}

// ---- language ----

let stats = null;

function setLang(code) {
  chooseLang(code);
  renderAll();
}

// Shared text is filled in by applyI18n() in i18n.js; this adds the parts only the main page has.
function applyStatic() {
  applyI18n();
  for (const o of $("pcRam").options) o.textContent = t("gb", { n: +o.value });
  for (const o of $("pcVram").options) o.textContent = o.value === "0" ? t("specs.noGpu") : t(o.value === "80" ? "specs.orMore" : "gb", { n: +o.value });
  const [before, after = ""] = t("foot.github").split("{link}");
  $("footGithub").innerHTML = `${esc(before)}<a href="https://github.com/alishahid74/OpenSourceAi" target="_blank" rel="noopener">GitHub</a>${esc(after)}`;
}

function renderAll() {
  applyStatic();
  if (!stats) return;
  const countries = new Set(items.flatMap((e) => (e.country || "").split("/").map((c) => c.trim()).filter(Boolean)));
  $("counts").textContent = t("counts", { n: items.length, k: Object.keys(stats.by_category).length, c: countries.size });
  $("generated").textContent = t("updated", { date: new Date(stats.generated).toLocaleDateString(LANG, { year: "numeric", month: "long", day: "numeric" }) });
  buildFilters();
  syncControls();
  syncPCControls();
  renderFinder();
  render();
  renderCompareBar();
}

async function main() {
  LANG = detectLang();
  applyStatic();
  try {
    // Revalidate every visit so a refreshed catalog shows up right after a deploy.
    const res = await fetch("catalog.json", { cache: "no-cache" });
    const data = await res.json();
    items = data.items.map(prepare);
    stats = data.stats;
    loadHash();
    loadPC();
    wire();
    renderAll();
  } catch (err) {
    $("counts").textContent = t("loadError");
    console.error(err);
  }
}

main();
