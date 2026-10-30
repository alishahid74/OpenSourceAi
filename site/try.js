// "Try AI in your browser": small open models that run on the visitor's own computer with Transformers.js.
// Shares the language code and text with the main page through i18n.js.
import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";

const $ = (id) => document.getElementById(id);
const SAMPLES = "https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/";

// Languages offered for speech to text (Whisper understands about 100).
const STT_LANGS = ["en", "es", "fr", "pt", "ar", "ur", "hi", "zh", "de", "it", "ru", "ja", "id", "tr", "bn", "fa", "ko", "sw"];
// Translation pairs with a small OPUS-MT model, each to and from English. Japanese is "jap" as a target.
const TR_LANGS = ["es", "fr", "de", "it", "ar", "hi", "zh", "ru", "ja", "id"];
const trModel = (from, to) => `Xenova/opus-mt-${from}-${to === "ja" ? "jap" : to}`;

const langName = (code) => {
  try { return new Intl.DisplayNames([LANG], { type: "language" }).of(code); } catch { return code; }
};

// ---- status, progress and model loading ----

function demoUI(prefix) {
  const bar = $(prefix + "Bar");
  let last = null;
  const ui = {
    say(key, vars) { last = [key, vars]; bar.hidden = true; $(prefix + "Status").textContent = key ? t(key, vars) : ""; },
    progress(f) { ui.say("try.loading", { p: Math.round(f * 100) }); bar.hidden = false; bar.value = f; },
    busy(on) {
      for (const el of document.querySelectorAll(`[data-demo="${prefix}"]`)) el.disabled = on;
      for (const el of document.querySelectorAll(`[data-demo-label="${prefix}"]`)) el.classList.toggle("disabled", on);
    },
    // Show the last message again in the new language.
    retranslate() { if (last && bar.hidden) ui.say(...last); },
  };
  return ui;
}
const stt = demoUI("stt");
const tr = demoUI("tr");
const bg = demoUI("bg");

const models = new Map();
function load(task, model, options, ui) {
  if (!models.has(model)) {
    const files = {};
    const progress_callback = (p) => {
      if (p.status !== "progress" || !p.total) return;
      files[p.file] = [p.loaded, p.total];
      const all = Object.values(files);
      ui.progress(all.reduce((a, f) => a + f[0], 0) / all.reduce((a, f) => a + f[1], 0));
    };
    models.set(model, pipeline(task, model, { ...options, progress_callback }).catch((err) => {
      models.delete(model);
      throw err;
    }));
  }
  return models.get(model);
}

async function run(ui, work) {
  ui.busy(true);
  const start = performance.now();
  try {
    await work();
    ui.say("try.done", { s: ((performance.now() - start) / 1000).toLocaleString(LANG, { maximumFractionDigits: 1 }) });
  } catch (err) {
    console.error(err);
    ui.say("try.error", { msg: err?.message || String(err) });
  } finally {
    ui.busy(false);
  }
}

// ---- speech to text ----

async function decodeAudio(blob) {
  const ctx = new AudioContext({ sampleRate: 16000 });
  try {
    const audio = await ctx.decodeAudioData(await blob.arrayBuffer());
    return audio.getChannelData(0);
  } finally {
    ctx.close();
  }
}

function transcribe(blob) {
  $("sttAudio").src = URL.createObjectURL(blob);
  $("sttAudio").hidden = false;
  $("sttOut").textContent = "";
  return run(stt, async () => {
    const audio = await decodeAudio(blob);
    const asr = await load("automatic-speech-recognition", "Xenova/whisper-tiny", { dtype: "q8" }, stt);
    stt.say("try.working");
    // Whisper guesses English when no language is given, so always pass the chosen one.
    const out = await asr(audio, { language: $("sttLang").value, task: "transcribe", chunk_length_s: 30, stride_length_s: 5 });
    $("sttOut").textContent = out.text.trim();
  });
}

let recorder = null;
async function toggleRecording() {
  if (recorder) { recorder.stop(); return; }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    stt.say("stt.mic");
    return;
  }
  const chunks = [];
  recorder = new MediaRecorder(stream);
  recorder.ondataavailable = (ev) => chunks.push(ev.data);
  recorder.onstop = () => {
    stream.getTracks().forEach((track) => track.stop());
    recorder = null;
    $("sttRecord").textContent = t("stt.record");
    transcribe(new Blob(chunks, { type: chunks[0]?.type }));
  };
  recorder.start();
  $("sttRecord").textContent = t("stt.stop");
  stt.say("stt.recording");
}

async function sample(file, lang) {
  $("sttLang").value = lang;
  stt.busy(true);
  try {
    const blob = await (await fetch(SAMPLES + file)).blob();
    await transcribe(blob);
  } catch (err) {
    stt.say("try.error", { msg: err.message });
    stt.busy(false);
  }
}

// ---- translate ----

async function translate() {
  const [from, to] = $("trDir").value.split(">");
  const lines = $("trIn").value.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) { $("trIn").focus(); return; }
  $("trOut").textContent = "";
  await run(tr, async () => {
    const translator = await load("translation", trModel(from, to), { dtype: "q8" }, tr);
    tr.say("try.working");
    const out = await translator(lines, { max_new_tokens: 512 });
    $("trOut").textContent = out.map((o) => o.translation_text).join("\n");
  });
}

// ---- remove background ----

function removeBackground(src) {
  $("bgIn").src = src;
  $("bgPair").hidden = false;
  $("bgOut").replaceChildren();
  $("bgSave").hidden = true;
  return run(bg, async () => {
    const remover = await load("background-removal", "Xenova/modnet", { dtype: "uint8" }, bg);
    bg.say("try.working");
    const [image] = await remover(src);
    // toCanvas() gives an OffscreenCanvas, which can't be shown or saved directly.
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext("2d").drawImage(image.toCanvas(), 0, 0);
    $("bgOut").replaceChildren(canvas);
    $("bgSave").href = canvas.toDataURL("image/png");
    $("bgSave").hidden = false;
  });
}

// ---- page ----

function render() {
  applyI18n();
  const sttLang = $("sttLang").value || (STT_LANGS.includes(LANG) ? LANG : "en");
  $("sttLang").innerHTML = STT_LANGS.map((c) => `<option value="${c}">${langName(c)}</option>`).join("");
  $("sttLang").value = sttLang;
  if (!recorder) $("sttRecord").textContent = t("stt.record");

  const pairs = TR_LANGS.flatMap((c) => [["en", c], [c, "en"]]);
  const dir = $("trDir").value || (TR_LANGS.includes(LANG) ? `en>${LANG}` : "en>es");
  $("trDir").innerHTML = pairs.map(([a, b]) => `<option value="${a}>${b}">${langName(a)} → ${langName(b)}</option>`).join("");
  $("trDir").value = dir;

  for (const el of document.querySelectorAll(".size")) el.textContent = t("try.size", { n: +el.dataset.mb });
  for (const el of document.querySelectorAll(".uses")) el.textContent = t("try.uses", { name: el.dataset.name, license: el.dataset.license });
  for (const ui of [stt, tr, bg]) ui.retranslate();
}

LANG = detectLang();
render();
$("lang").addEventListener("change", (ev) => { chooseLang(ev.target.value); render(); });
$("sttRecord").addEventListener("click", toggleRecording);
$("sttFile").addEventListener("change", (ev) => { const f = ev.target.files[0]; if (f) transcribe(f); ev.target.value = ""; });
$("sttSampleEn").addEventListener("click", () => sample("jfk.wav", "en"));
$("sttSampleFr").addEventListener("click", () => sample("french-audio.mp3", "fr"));
$("trGo").addEventListener("click", translate);
$("trIn").addEventListener("keydown", (ev) => { if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) translate(); });
$("bgFile").addEventListener("change", (ev) => { const f = ev.target.files[0]; if (f) removeBackground(URL.createObjectURL(f)); ev.target.value = ""; });
$("bgSample").addEventListener("click", () => removeBackground(SAMPLES + "corgi.jpg"));
