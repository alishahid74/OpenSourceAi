"use strict";

// The family tree of open AI. Everything comes live from the Hugging Face API, which allows requests from this site:
// a model's tags name its parents ("base_model:<id>"), and childrenModelCount says how many models were built from it.

const API = "https://huggingface.co/api/models";
const RELATIONS = ["finetune", "adapter", "quantized", "merge"];

// Starting points: the most-built-upon model of each well-known family.
const FAMILIES = [
  ["Llama", "meta-llama/Llama-3.1-8B-Instruct"],
  ["Qwen", "Qwen/Qwen2.5-7B-Instruct"],
  ["Mistral", "mistralai/Mistral-7B-v0.1"],
  ["Gemma", "google/gemma-3-4b-it"],
  ["DeepSeek", "deepseek-ai/DeepSeek-R1"],
  ["Phi", "microsoft/Phi-3-mini-4k-instruct"],
  ["Whisper", "openai/whisper-small"],
  ["BERT", "google-bert/bert-base-uncased"],
  ["Stable Diffusion", "stabilityai/stable-diffusion-xl-base-1.0"],
  ["FLUX", "black-forest-labs/FLUX.1-dev"],
];

// Country of the organizations behind well-known original models. Hugging Face doesn't record where people are.
const ORG_COUNTRY = {
  "meta-llama": "USA", "facebook": "USA", "google": "USA", "google-bert": "USA", "microsoft": "USA", "openai": "USA",
  "nvidia": "USA", "ibm-granite": "USA", "allenai": "USA", "apple": "USA", "Qwen": "China", "deepseek-ai": "China",
  "THUDM": "China", "zai-org": "China", "moonshotai": "China", "01-ai": "China", "internlm": "China", "baidu": "China",
  "mistralai": "France", "stabilityai": "UK", "black-forest-labs": "Germany", "tiiuae": "UAE", "CohereLabs": "Canada",
  "CohereForAI": "Canada", "LGAI-EXAONE": "South Korea", "sarvamai": "India", "ai4bharat": "India",
};

// Short tags that look like language codes but aren't languages.
const NOT_LANGUAGES = new Set(["art", "mul", "und", "zxx", "mis"]);

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const compact = (n) => Intl.NumberFormat(LANG, { notation: "compact", maximumFractionDigits: 1 }).format(n || 0);
const hfLink = (id) => `https://huggingface.co/${id}`;

let path = [];        // model ids visited, oldest first
let shown = null;     // data for the model on screen, kept so a language change can redraw it
let request = 0;      // ignore answers to requests the visitor has already moved on from
let lastStatus = null;

function status(key, vars) {
  lastStatus = key ? [key, vars] : null;
  $("treeStatus").textContent = key ? t(key, vars) : "";
}

async function getJSON(url) {
  const res = await fetch(url);
  // Hugging Face answers 401 rather than 404 for models that don't exist when you're not signed in.
  if (res.status === 404 || res.status === 401) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const childrenURL = (rel, id, limit, expand) =>
  `${API}?filter=${encodeURIComponent(`base_model:${rel}:${id}`)}&sort=downloads&direction=-1&limit=${limit}&expand[]=${expand}`;

async function load(id) {
  const info = await getJSON(`${API}/${id}?expand[]=childrenModelCount&expand[]=tags&expand[]=downloads&expand[]=likes&expand[]=pipeline_tag`);
  if (!info) return null;
  const counts = info.childrenModelCount || {};
  const [tops, fine, adapters] = await Promise.all([
    Promise.all(RELATIONS.map((rel) => (counts[rel] ? getJSON(childrenURL(rel, info.id, 6, "downloads")) : []))),
    counts.finetune ? getJSON(childrenURL("finetune", info.id, 200, "tags")) : [],
    counts.adapter ? getJSON(childrenURL("adapter", info.id, 100, "tags")) : [],
  ]);
  // Each descendant counts once for every language it lists.
  const sample = [...(fine || []), ...(adapters || [])];
  const langs = {};
  const names = new Intl.DisplayNames(["en"], { type: "language", fallback: "none" });
  for (const m of sample) {
    for (const tag of new Set(m.tags || [])) {
      if (!/^[a-z]{2,3}$/.test(tag) || NOT_LANGUAGES.has(tag)) continue;
      try { if (names.of(tag)) langs[tag] = (langs[tag] || 0) + 1; } catch { /* not a language code */ }
    }
  }
  const parents = (info.tags || []).filter((tg) => tg.split(":").length === 2 && tg.startsWith("base_model:")).map((tg) => tg.slice(11));
  return { info, counts, tops: Object.fromEntries(RELATIONS.map((rel, i) => [rel, tops[i] || []])), langs, sampleSize: sample.length, parents };
}

async function show(id, how = "reset") {
  const mine = ++request;
  status("tree.loading");
  $("tree").setAttribute("aria-busy", "true");
  try {
    const data = await load(id);
    if (mine !== request) return;
    if (!data) { status("tree.notFound"); return; }
    if (how === "reset") path = [data.info.id];
    else if (how === "child") path.push(data.info.id);
    else path = path.slice(0, path.indexOf(data.info.id) + 1);
    shown = data;
    status(null);
    render();
    const hash = `#m=${encodeURIComponent(data.info.id)}`;
    if (location.hash !== hash) history.pushState(null, "", location.pathname + location.search + hash);
  } catch (err) {
    console.error(err);
    if (mine === request) status("tree.error");
  } finally {
    if (mine === request) $("tree").removeAttribute("aria-busy");
  }
}

function modelButton(id, small) {
  const [author, name] = id.includes("/") ? id.split("/") : ["", id];
  return `<button class="tree-model" data-id="${esc(id)}" dir="ltr"><span>${esc(name)}</span><small>${esc(author)}${small ? " · " + esc(small) : ""}</small></button>`;
}

function render() {
  for (const b of $("families").children) b.setAttribute("aria-pressed", String(shown?.info.id === b.dataset.id));
  $("treePath").hidden = path.length < 2;
  $("treePath").innerHTML = `<span>${esc(t("tree.path"))}:</span> ` +
    path.map((id, i) => i === path.length - 1 ? `<b dir="ltr">${esc(id.split("/").pop())}</b>` : `<button class="linklike" data-path="${esc(id)}" dir="ltr">${esc(id.split("/").pop())}</button>`).join(" → ");
  if (!shown) return;

  const { info, counts, tops, langs, sampleSize, parents } = shown;
  const [author, name] = info.id.split("/");
  const total = RELATIONS.reduce((a, rel) => a + (counts[rel] || 0), 0);
  const country = ORG_COUNTRY[author];
  const display = new Intl.DisplayNames([LANG], { type: "language" });
  const langList = Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, 30);

  $("tree").innerHTML = `
    <div class="tree-parents">${parents.length
      ? `<span>${esc(t("tree.builtFrom"))}</span> ${parents.slice(0, 3).map((p) => modelButton(p)).join("")}`
      : `<span class="tag">${esc(t("tree.original"))}</span>`}</div>
    <section class="tree-center">
      <h2 dir="ltr">${esc(name || info.id)}</h2>
      <p class="org" dir="auto">${esc(author)}${country ? " · " + esc(country) : ""}${info.pipeline_tag ? " · " + esc(info.pipeline_tag) : ""}</p>
      <div class="tree-stats">
        <div><span>${esc(t("tree.total"))}</span><b>${num(total)}</b></div>
        <div><span>${esc(t("tree.downloads"))}</span><b>${compact(info.downloads)}</b></div>
        <div><span>${esc(t("tree.likes"))}</span><b>${compact(info.likes)}</b></div>
      </div>
      <a href="${esc(hfLink(info.id))}" target="_blank" rel="noopener">${esc(t("tree.open"))}</a>
    </section>
    ${total ? `<div class="tree-branches">${RELATIONS.filter((rel) => counts[rel]).map((rel) => `
      <section class="branch branch-${rel}">
        <h3>${esc(t(`rel.${rel}`))} <span class="n">${num(counts[rel])}</span></h3>
        <p class="help">${esc(t(`rel.${rel}.help`))}</p>
        <div class="branch-list">${tops[rel].map((m) => modelButton(m.id, m.downloads ? "↓ " + compact(m.downloads) : "")).join("")}</div>
        ${counts[rel] > tops[rel].length ? `<a class="more-link" target="_blank" rel="noopener" href="https://huggingface.co/models?other=${encodeURIComponent(`base_model:${rel}:${info.id}`)}&sort=downloads">${esc(t("tree.more", { n: counts[rel] - tops[rel].length }))}</a>` : ""}
      </section>`).join("")}</div>`
      : `<p class="empty">${esc(t("tree.noChildren"))}</p>`}
    ${langList.length ? `<section class="tree-langs">
      <h3>${esc(t("tree.languages"))}</h3>
      <div class="chips">${langList.map(([code, n]) => `<span class="chip" lang="${esc(code)}">${esc(display.of(code))}<span class="n">${num(n)}</span></span>`).join("")}</div>
      <p class="demo-meta">${esc(t("tree.languagesNote", { n: sampleSize }))}</p>
    </section>` : ""}`;
}

function idFromInput(text) {
  const s = text.trim();
  const url = /huggingface\.co\/([^/\s]+\/[^/\s?#]+)/.exec(s);
  if (url) return url[1];
  return /^[\w.-]+\/[\w.-]+$/.test(s) ? s : null;
}

async function search(text) {
  const id = idFromInput(text);
  if (id) return show(id);
  if (!text.trim()) return;
  status("tree.loading");
  try {
    const hits = await getJSON(`${API}?search=${encodeURIComponent(text.trim())}&sort=downloads&direction=-1&limit=1`);
    if (hits && hits.length) show(hits[0].id);
    else status("tree.notFound");
  } catch {
    status("tree.error");
  }
}

function idFromHash() {
  const m = /^#m=(.+)$/.exec(location.hash);
  return m ? decodeURIComponent(m[1]) : null;
}

function redraw() {
  applyI18n();
  $("families").innerHTML = FAMILIES.map(([label, id]) => `<button class="chip" data-id="${esc(id)}">${esc(label)}</button>`).join("");
  if (lastStatus) status(...lastStatus);
  render();
}

LANG = detectLang();
redraw();
$("lang").addEventListener("change", (ev) => { chooseLang(ev.target.value); redraw(); });
$("families").addEventListener("click", (ev) => { const b = ev.target.closest("[data-id]"); if (b) show(b.dataset.id); });
$("tree").addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-id]");
  if (b) { show(b.dataset.id, "child"); $("treePath").scrollIntoView({ behavior: "smooth", block: "start" }); }
});
$("treePath").addEventListener("click", (ev) => { const b = ev.target.closest("[data-path]"); if (b) show(b.dataset.path, "back"); });
$("treeSearch").addEventListener("submit", (ev) => { ev.preventDefault(); search($("treeQ").value); });
window.addEventListener("popstate", () => {
  const id = idFromHash();
  if (id && id !== shown?.info.id) show(id, path.includes(id) ? "back" : "reset");
});
show(idFromHash() || FAMILIES[0][1]);
