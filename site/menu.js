"use strict";

// "Your computer's AI menu": the finder's top pick for every task, for one computer.
// Reuses app.js (catalog, finderMatches, fitFor, openHowto); app.js skips its own page setup here.

const menuPage = { source: "guess" };

// Where the computer comes from: a shared link, the visitor's saved settings, or a guess from the browser.
async function pickComputer() {
  const p = new URLSearchParams(location.search);
  if (p.has("ram")) {
    Object.assign(pc, { ram: +p.get("ram") || 16, vram: +p.get("vram") || 0, mac: p.get("mac") === "1" });
    finder.biz = p.get("biz") === "1" ? "yes" : "no";
    return "shared";
  }
  try {
    const saved = JSON.parse(localStorage.getItem("opensourceai.pc") || "null");
    if (saved && typeof saved.ram === "number") { Object.assign(pc, saved); return "saved"; }
  } catch { /* storage unavailable */ }
  // Browsers only hint: deviceMemory stops at 8 GB, and graphics memory isn't exposed at all.
  const isMac = /Mac/.test(navigator.platform || navigator.userAgent);
  const mem = navigator.deviceMemory;
  let ram = mem ? (mem >= 8 ? 16 : mem >= 4 ? 8 : 4) : (isMac ? 16 : 8);
  let vram = 0, mac = false;
  try {
    const adapter = await navigator.gpu?.requestAdapter();
    const vendor = (adapter?.info?.vendor || "").toLowerCase();
    if (isMac && vendor.includes("apple")) mac = true;
    else if (vendor.includes("nvidia") || vendor.includes("amd")) vram = 8;
  } catch { /* WebGPU unavailable */ }
  Object.assign(pc, { ram, vram, mac });
  return "guess";
}

function menuRow(task) {
  finder.task = task.id;
  const list = finderMatches();
  const label = esc(t(`task.${task.id}`));
  if (!list.length) return `<li class="menu-row"><div class="menu-task">${label}</div><p class="empty-row">${esc(t("menu.none"))}</p></li>`;
  const [top, ...rest] = list;
  const fit = fitFor(top);
  const badge = fit ? `<span class="tag fit-${fit.level}">${{ good: "✓", slow: "⚠", no: "✕" }[fit.level]} ${esc(fit.text)}</span>` : "";
  const also = rest.slice(0, 2).map((e) => `<button class="linklike" data-howto="${e._i}">${esc(e.name)}</button>`).join(", ");
  return `<li class="menu-row">
    <div class="menu-task">${label}</div>
    <div class="menu-pick">
      <a href="${esc(top.url)}" target="_blank" rel="noopener">${esc(top.name)}</a> ${badge}
      <p class="desc">${esc(top.description || "")}</p>
      ${also ? `<p class="menu-also">${esc(t("menu.alsoGood"))} ${also}</p>` : ""}
    </div>
    <button class="ghost no-print" data-howto="${top._i}">${esc(t("card.howto"))}</button>
  </li>`;
}

function shareURL() {
  const p = new URLSearchParams({ lang: LANG, ram: pc.ram, vram: pc.vram, mac: pc.mac ? 1 : 0, biz: finder.biz === "yes" ? 1 : 0 });
  return new URL(`menu.html?${p}`, location.href).href;
}

function renderMenu() {
  applyI18n();
  for (const o of $("pcRam").options) o.textContent = t("gb", { n: +o.value });
  for (const o of $("pcVram").options) o.textContent = o.value === "0" ? t("specs.noGpu") : t(o.value === "80" ? "specs.orMore" : "gb", { n: +o.value });
  $("pcRam").value = String(pc.ram);
  $("pcVram").value = String(pc.vram);
  $("pcVram").disabled = pc.mac;
  $("pcMac").checked = pc.mac;
  $("biz").checked = finder.biz === "yes";
  $("pcSource").textContent = t({ guess: "menu.guess", saved: "menu.saved", shared: "menu.shared" }[menuPage.source]);
  $("pcLine").textContent = pcSummary();
  if (!items.length) return;
  finder.hw = presetFor(pc) ?? tierFor(pc);
  $("menu").innerHTML = FINDER.task.map(menuRow).join("");
  $("made").textContent = t("menu.made", { date: new Date().toLocaleDateString(LANG, { year: "numeric", month: "long", day: "numeric" }), url: shareURL() });
}

async function share() {
  const url = shareURL();
  try {
    if (navigator.share) { await navigator.share({ title: t("menu.title"), url }); return; }
    await navigator.clipboard.writeText(url);
    $("shareNote").textContent = t("menu.copied");
  } catch {
    $("shareNote").textContent = url;
  }
}

async function startMenu() {
  LANG = detectLang();
  applyI18n();
  $("menuStatus").textContent = t("loading");
  menuPage.source = await pickComputer();
  try {
    const data = await (await fetch("catalog.json", { cache: "no-cache" })).json();
    items = data.items.map(prepare);
    $("menuStatus").textContent = "";
  } catch (err) {
    console.error(err);
    $("menuStatus").textContent = t("loadError");
  }
  renderMenu();

  $("lang").addEventListener("change", (ev) => { chooseLang(ev.target.value); renderMenu(); });
  const specChanged = () => {
    Object.assign(pc, { ram: +$("pcRam").value, vram: $("pcMac").checked ? 0 : +$("pcVram").value, mac: $("pcMac").checked });
    savePC();
    menuPage.source = "saved";
    renderMenu();
  };
  for (const id of ["pcRam", "pcVram", "pcMac"]) $(id).addEventListener("change", specChanged);
  $("biz").addEventListener("change", (ev) => { finder.biz = ev.target.checked ? "yes" : "no"; renderMenu(); });
  $("print").addEventListener("click", () => print());
  $("share").addEventListener("click", share);
  document.addEventListener("click", (ev) => {
    const how = ev.target.closest("[data-howto]");
    if (how) openHowto(items[+how.dataset.howto]);
  });
  $("howtoBody").addEventListener("click", (ev) => { if (ev.target.matches("[data-copy]")) copyCode(ev.target); });
  $("howtoClose").addEventListener("click", () => $("howtoDialog").close());
  $("howtoDialog").addEventListener("click", (ev) => { if (ev.target === ev.currentTarget) ev.currentTarget.close(); });
}

startMenu();
