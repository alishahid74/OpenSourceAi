// Chat with an open model that runs inside the page. WebLLM downloads the model once into the
// browser's cache and runs it on the visitor's graphics chip through WebGPU, so nothing is sent anywhere.

const WEBLLM = "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.86/+esm";

// gb is WebLLM's estimate of the graphics memory each model needs.
const MODELS = [
  { id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC", name: "Qwen2.5 1.5B", gb: 1.6, about: "chat.m.qwen" },
  { id: "Llama-3.2-3B-Instruct-q4f16_1-MLC", name: "Llama 3.2 3B", gb: 2.3, about: "chat.m.llama" },
  { id: "Qwen3-4B-q4f16_1-MLC", name: "Qwen3 4B", gb: 3.4, about: "chat.m.qwen3", thinks: true },
  { id: "SmolLM2-360M-Instruct-q4f16_1-MLC", name: "SmolLM2 360M", gb: 0.4, about: "chat.m.smol" },
];
const MODEL_KEY = "opensourceai.chatModel";
// Where downloads are kept: the browser's Cache Storage by default, or IndexedDB once Cache Storage has failed on this browser.
const STORE_KEY = "opensourceai.chatStore";
// A model is dozens of files; if one drops, the ones already saved are kept, so trying again carries on from there.
const TRIES = 3;
const SYSTEM = "You are a helpful, friendly assistant. Answer in the same language the user writes in. Keep answers clear and not too long.";
// The models remember about 4,000 tokens, so older turns are dropped to keep the conversation under this many characters.
const HISTORY_CHARS = 6000;

const $ = (id) => document.getElementById(id);

let webllm = null;     // the WebLLM module, imported on first Start
let engine = null;
let loadedId = null;   // model currently in the engine
let chosen = MODELS[0];
let history = [];      // {role, content}
let busy = false;      // a download or an answer is in progress
let cached = new Set();
let lastLoad = null;   // [key, vars] of the last load message, so a language change can redraw it
let store = "cache";

try { if (localStorage.getItem(STORE_KEY) === "indexeddb") store = "indexeddb"; } catch { /* storage unavailable */ }

try { chosen = MODELS.find((m) => m.id === localStorage.getItem(MODEL_KEY)) || chosen; } catch { /* storage unavailable */ }

async function checkSupport() {
  try {
    if (navigator.gpu && await navigator.gpu.requestAdapter()) return true;
  } catch { /* no WebGPU */ }
  return false;
}

// WebLLM keeps each model's files in the "webllm/model" cache, under the model's Hugging Face address.
async function findCached() {
  if (store === "indexeddb") {
    try {
      webllm ??= await import(WEBLLM);
      const appConfig = { ...webllm.prebuiltAppConfig, cacheBackend: store };
      const hits = await Promise.all(MODELS.map((m) => webllm.hasModelInCache(m.id, appConfig)));
      cached = new Set(MODELS.filter((m, i) => hits[i]).map((m) => m.id));
    } catch { cached = new Set(); }
    return;
  }
  try {
    const keys = await (await caches.open("webllm/model")).keys();
    cached = new Set(MODELS.filter((m) => keys.some((r) => r.url.includes(`/${m.id}/`))).map((m) => m.id));
  } catch { cached = new Set(); }
}

function renderModels() {
  $("models").innerHTML = MODELS.map((m) => `
    <button type="button" class="model-card" data-id="${m.id}" aria-pressed="${m === chosen}">
      <b dir="ltr">${m.name}</b>
      <span>${t(m.about)}</span>
      <small>${t("chat.uses", { n: m.gb.toLocaleString(LANG) })}${cached.has(m.id) ? ` · <span class="tag fit-good">✓ ${t("chat.cached")}</span>` : ""}</small>
    </button>`).join("");
  const ready = loadedId === chosen.id;
  $("start").textContent = t(cached.has(chosen.id) ? "chat.startCached" : "chat.start") + (cached.has(chosen.id) ? "" : ` (${chosen.gb.toLocaleString(LANG)} GB)`);
  $("start").hidden = ready;
  $("start").disabled = busy;
  $("modelName").textContent = loadedId ? MODELS.find((m) => m.id === loadedId).name : "";
}

function isDownloadError(err) {
  return /network|fetch|Cache|load failed|Cannot fetch/i.test(String(err?.message || err));
}

function loadMessage(key, vars) {
  lastLoad = key ? [key, vars] : null;
  $("loadStatus").textContent = key ? t(key, vars) : "";
}

async function start() {
  if (busy) return;
  busy = true;
  const model = chosen;
  renderModels();
  $("loadBar").hidden = false;
  $("loadBar").value = 0;
  loadMessage("chat.opening", { name: model.name });
  try {
    // Ask the browser not to clear the downloaded models when the disk gets full.
    navigator.storage?.persist?.().catch(() => {});
    webllm ??= await import(WEBLLM);
    const progress = (r) => {
      $("loadBar").value = r.progress || 0;
      // WebLLM says "Fetching param cache" while downloading and "Loading model from cache" when already downloaded.
      if (!/^Fetching/.test(r.text || "")) loadMessage("chat.opening", { name: model.name });
      else loadMessage("chat.downloading", { name: model.name, pct: Math.round((r.progress || 0) * 100) });
    };
    for (let attempt = 1; ; attempt++) {
      try {
        if (engine) {
          engine.setInitProgressCallback(progress);
          await engine.reload(model.id);
        } else {
          engine = await webllm.CreateMLCEngine(model.id, {
            initProgressCallback: progress,
            appConfig: { ...webllm.prebuiltAppConfig, cacheBackend: store },
          });
        }
        break;
      } catch (err) {
        if (!isDownloadError(err) || attempt >= TRIES) throw err;
        console.warn(err);
        loadMessage("chat.retrying", { n: attempt, total: TRIES - 1 });
        await new Promise((r) => setTimeout(r, 2000 * attempt));
        // Last try: keep the files in IndexedDB instead, which works where Cache Storage keeps failing.
        if (attempt === TRIES - 1 && store === "cache") {
          store = "indexeddb";
          try { localStorage.setItem(STORE_KEY, store); } catch { /* storage unavailable */ }
          await engine?.unload().catch(() => {});
          engine = null;
        }
      }
    }
    loadedId = model.id;
    cached.add(model.id);
    history = [];
    $("chatState").textContent = "";
    loadMessage("chat.loaded", { name: model.name });
  } catch (err) {
    console.error(err);
    const key = /memory|OOM|allocation/i.test(String(err)) ? "chat.memory" : isDownloadError(err) ? "chat.netError" : "chat.error";
    loadMessage(key, { msg: err.message || String(err) });
  } finally {
    busy = false;
    $("loadBar").hidden = true;
    renderModels();
    renderLog();
  }
}

// Models answer in Markdown. This turns the common parts (bold, italics, code, lists, headings, quotes, links)
// into HTML. Everything is escaped first, so nothing the model writes can add its own HTML to the page.
const escHTML = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function inline(text) {
  const codes = [];
  let s = escHTML(text).replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`);
  s = s
    .replace(/\*\*(.+?)\*\*|__(.+?)__/g, (_, a, b) => `<strong>${a ?? b}</strong>`)
    .replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\w)/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener nofollow">$1</a>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code dir="ltr">${codes[i]}</code>`);
}

function blocks(text) {
  const out = [];
  let list = null;      // {tag, start, items}
  let para = [];
  const flushPara = () => { if (para.length) out.push(`<p>${para.map(inline).join("<br>")}</p>`); para = []; };
  const flushList = () => {
    if (!list) return;
    const start = list.tag === "ol" && list.start !== 1 ? ` start="${list.start}"` : "";
    out.push(`<${list.tag}${start}>${list.items.map((it) => `<li>${it.map(inline).join("<br>")}</li>`).join("")}</${list.tag}>`);
    list = null;
  };
  for (const line of text.split("\n")) {
    const bullet = /^\s*[-*+•]\s+(.*)$/.exec(line);
    const number = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
    const heading = /^\s*#{1,6}\s+(.*)$/.exec(line);
    const quote = /^\s*>\s?(.*)$/.exec(line);
    if (!line.trim()) { flushPara(); if (list) list.gap = true; continue; }
    if (bullet || number) {
      flushPara();
      const tag = bullet ? "ul" : "ol";
      if (!list || list.tag !== tag) { flushList(); list = { tag, start: number ? +number[1] : 1, items: [] }; }
      list.items.push([bullet ? bullet[1] : number[2]]);
      list.gap = false;
    } else if (heading) {
      flushPara(); flushList();
      out.push(`<h3>${inline(heading[1].replace(/#+\s*$/, ""))}</h3>`);
    } else if (quote) {
      flushPara(); flushList();
      out.push(`<blockquote>${inline(quote[1])}</blockquote>`);
    } else if (list && !list.gap && /^\s{2,}/.test(line)) {
      list.items[list.items.length - 1].push(line.trim());   // a list item that wraps onto the next line
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara(); flushList();
  return out.join("");
}

function formatAnswer(text) {
  // Code fences alternate text and code; an unfinished fence (still streaming) is shown as code too.
  return text.split(/^\s*```[\w+-]*\s*$/m).map((part, i) =>
    i % 2 ? `<pre dir="ltr"><code>${escHTML(part.replace(/^\n|\n$/g, ""))}</code></pre>` : blocks(part)).join("");
}

function renderLog() {
  const log = $("log");
  if (!loadedId) { log.innerHTML = `<p class="chat-empty">${t("chat.first")}</p>`; return; }
  if (!history.length) {
    log.innerHTML = `<div class="chat-empty"><p>${t("chat.empty")}</p><div class="chips">${
      ["chat.s1", "chat.s2", "chat.s3", "chat.s4"].map((k) => `<button type="button" class="chip" data-suggest="${k}">${t(k)}</button>`).join("")}</div></div>`;
    return;
  }
  // No spaces around the text: messages keep their line breaks (white-space: pre-wrap).
  log.innerHTML = history.map((m) => m.role === "user"
    ? `<div class="msg msg-user" dir="auto"><span class="sr-only">${t("chat.you")}: </span>${escHTML(m.content)}</div>`
    : `<div class="msg msg-assistant${m.writing ? " writing" : ""}" dir="auto">
        <div class="msg-who"><span aria-hidden="true">✦</span> <bdi>${escHTML(m.model || t("chat.ai"))}</bdi></div>
        <div class="msg-body">${formatAnswer(m.content)}</div>
      </div>`).join("");
  log.scrollTop = log.scrollHeight;
}

function trimmed() {
  const keep = [];
  let size = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    size += history[i].content.length;
    if (size > HISTORY_CHARS && keep.length) break;
    keep.unshift(history[i]);
  }
  return [{ role: "system", content: SYSTEM }, ...keep];
}

async function ask(text) {
  text = text.trim();
  if (!text || busy || !loadedId) return;
  busy = true;
  const model = MODELS.find((m) => m.id === loadedId);
  history.push({ role: "user", content: text });
  const reply = { role: "assistant", content: "", model: model.name, writing: true };
  const messages = trimmed();
  history.push(reply);
  $("q").value = "";
  $("send").hidden = true;
  $("stop").hidden = false;
  $("chatState").textContent = t("chat.writing");
  renderModels();
  renderLog();
  let started = 0;  // from the first word, so the one-time warm-up doesn't count against the speed
  let raw = "";
  try {
    const stream = await engine.chat.completions.create({
      messages, stream: true, temperature: 0.7, max_tokens: 1024,
      // Qwen3 would otherwise "think out loud" first, which takes long on a small computer.
      ...(model.thinks ? { extra_body: { enable_thinking: false } } : {}),
    });
    for await (const chunk of stream) {
      raw += chunk.choices[0]?.delta?.content || "";
      started ||= performance.now();
      reply.content = raw.replace(/<think>[\s\S]*?(<\/think>|$)/g, "").trimStart();
      renderLog();
    }
    const words = reply.content.split(/\s+/).filter(Boolean).length;
    const secs = started ? (performance.now() - started) / 1000 : 0;
    $("chatState").textContent = secs > 0.5 ? t("chat.speed", { n: Math.round(words / secs) }) : "";
  } catch (err) {
    console.error(err);
    reply.content ||= t("chat.error", { msg: err.message || String(err) });
    $("chatState").textContent = "";
  } finally {
    reply.writing = false;
    busy = false;
    $("send").hidden = false;
    $("stop").hidden = true;
    renderModels();
    renderLog();
    $("q").focus();
  }
}

function newChat() {
  if (busy) return;
  history = [];
  $("chatState").textContent = "";
  renderLog();
}

function redraw() {
  applyI18n();
  renderModels();
  renderLog();
  if (lastLoad) loadMessage(...lastLoad);
}

LANG = detectLang();
redraw();
const prefill = new URLSearchParams(location.search).get("prompt");
if (prefill) {
  $("q").value = prefill;
  // A prompt from the Learn page in another language: the smallest model only speaks English, so suggest Qwen this time.
  if (LANG !== "en" && chosen.id.startsWith("SmolLM2") && loadedId === null) { chosen = MODELS[0]; renderModels(); }
}

$("lang").addEventListener("change", (ev) => { chooseLang(ev.target.value); redraw(); });
$("models").addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-id]");
  if (!b || busy) return;
  chosen = MODELS.find((m) => m.id === b.dataset.id);
  try { localStorage.setItem(MODEL_KEY, chosen.id); } catch { /* storage unavailable */ }
  renderModels();
});
$("start").addEventListener("click", start);
$("chatForm").addEventListener("submit", (ev) => { ev.preventDefault(); ask($("q").value); });
$("q").addEventListener("keydown", (ev) => {
  if (ev.key === "Enter" && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); ask($("q").value); }
});
$("stop").addEventListener("click", () => engine?.interruptGenerate());
$("newChat").addEventListener("click", newChat);
$("log").addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-suggest]");
  if (b) ask(t(b.dataset.suggest));
});

const supported = await checkSupport();
$("support").textContent = t(supported ? "chat.supported" : "chat.noGpu");
$("support").removeAttribute("data-i18n");
$("support").dataset.i18n = supported ? "chat.supported" : "chat.noGpu";
$("support").classList.add(supported ? "ok" : "bad");
if (supported) { await findCached(); renderModels(); }
else { $("start").disabled = true; $("q").disabled = true; }
