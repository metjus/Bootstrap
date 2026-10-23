"use strict";
// Results page: /inzeraty/, /<category>/ and /<category>/<subcategory>/ with filters kept in the URL.
const pathParts = location.pathname.split("/").filter(Boolean);
const filters = {
  cat: category(pathParts[0])
    ? pathParts[0]
    : CATALOG.some((c) => c.slug === params.get("kategoria"))
      ? params.get("kategoria")
      : "",
  sub: "",
  q: params.get("q") || "",
  loc: params.get("mesto") || "",
  radius: params.get("okruh") || (params.get("mesto") ? "50" : "50"),
  min: params.get("min") || "",
  max: params.get("max") || "",
  cond: params.get("stav") || "",
  sort: params.get("zoradenie") || "recent",
  type: params.get("typ") === "buy" ? "buy" : "sell",
  photo: params.get("foto") === "1",
  saved: params.get("oblubene") === "1",
  page: Math.max(1, Number(params.get("strana")) || 1),
};
filters.sub = subcategory(filters.cat, pathParts[1])?.slug || "";
let view = "rows",
  request = 0,
  timer = null;
try {
  view = localStorage.getItem("bazar-view") === "grid" ? "grid" : "rows";
} catch {}
function pageUrl() {
  const q = new URLSearchParams();
  if (filters.q) q.set("q", filters.q);
  if (filters.loc) {
    q.set("mesto", filters.loc);
    q.set("okruh", filters.radius);
  }
  if (filters.min) q.set("min", filters.min);
  if (filters.max) q.set("max", filters.max);
  if (filters.cond) q.set("stav", filters.cond);
  if (filters.sort !== "recent") q.set("zoradenie", filters.sort);
  if (filters.type === "buy") q.set("typ", "buy");
  if (filters.photo) q.set("foto", "1");
  if (filters.saved) q.set("oblubene", "1");
  if (filters.page > 1) q.set("strana", filters.page);
  return catUrl(filters.cat, filters.sub) + (q.size ? "?" + q : "");
}
function apiQuery() {
  const q = new URLSearchParams({ page: filters.page });
  if (!filters.saved) q.set("type", filters.type);
  if (filters.cat) q.set("cat", filters.cat);
  if (filters.sub) q.set("sub", filters.sub);
  if (filters.q) q.set("q", filters.q);
  if (filters.loc) {
    q.set("loc", filters.loc);
    q.set("radius", filters.radius);
  }
  if (filters.min) q.set("min", filters.min);
  if (filters.max) q.set("max", filters.max);
  if (filters.cond) q.set("cond", filters.cond);
  if (filters.sort !== "recent") q.set("sort", filters.sort);
  if (filters.photo) q.set("photo", "1");
  if (filters.saved) q.set("saved", "1");
  return q;
}
function chrome() {
  const c = category(filters.cat),
    s = subcategory(filters.cat, filters.sub);
  const title = filters.saved
    ? "Obľúbené inzeráty"
    : s
      ? s.name
      : c
        ? c.name
        : filters.q
          ? `„${filters.q}“`
          : "Všetky inzeráty";
  $("#offersTitle").textContent = title;
  document.title = `${s ? s.name + " — " : ""}${c ? c.name : title} — ${SITE}`;
  $("#crumbs").innerHTML =
    '<a href="/">Domov</a><span>/</span>' +
    (c
      ? `<a href="${catUrl(c.slug)}">${esc(c.name)}</a>` + (s ? `<span>/</span><span>${esc(s.name)}</span>` : "")
      : "<span>Inzeráty</span>");
  $$(".catbar a").forEach((a) => a.classList.toggle("active", a.dataset.cat === filters.cat));
  $$(".catbar a.active").forEach((a) => a.scrollIntoView({ block: "nearest", inline: "center" }));
  const subs = $("#subcats");
  subs.hidden = !c;
  if (c) {
    const counts = categoryCounts?.counts || [];
    const n = (sub) => counts.filter((x) => x.c === c.slug && (!sub || x.s === sub)).reduce((a, x) => a + x.n, 0);
    subs.innerHTML =
      `<a class="chip ${!filters.sub ? "active" : ""}" href="${catUrl(c.slug)}" data-sub="">Všetko${categoryCounts ? ` <b>${n()}</b>` : ""}</a>` +
      c.subs
        .map(
          (x) =>
            `<a class="chip ${filters.sub === x.slug ? "active" : ""}" href="${catUrl(c.slug, x.slug)}" data-sub="${x.slug}">${esc(x.name)}${categoryCounts ? ` <b>${n(x.slug)}</b>` : ""}</a>`,
        )
        .join("");
  }
  $("#categorySelect").value = filters.cat;
  const sub = $("#subSelect");
  sub.hidden = !c;
  if (c)
    sub.innerHTML =
      `<option value="">Všetky podkategórie</option>` +
      c.subs.map((x) => `<option value="${x.slug}">${esc(x.name)}</option>`).join("");
  sub.value = filters.sub;
  $$("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === filters.type)));
  $$("[data-mode]").forEach((b) => b.classList.toggle("active", b.dataset.mode === filters.type));
  $("[data-mode]").closest("fieldset").hidden = filters.saved;
  for (const [id, key] of [
    ["location", "loc"],
    ["distance", "radius"],
    ["min", "min"],
    ["max", "max"],
    ["condition", "cond"],
    ["sort", "sort"],
  ])
    if ($("#" + id).value !== filters[key]) $("#" + id).value = filters[key];
  $("#withPhoto").checked = filters.photo;
  $("#hsQuery").value = filters.q;
  $("#hsLoc").value = filters.loc;
  $("#hsRadius").value = filters.radius;
  const active = [];
  if (filters.q) active.push(["q", `„${filters.q}“`]);
  if (filters.loc) active.push(["loc", `${filters.loc}${filters.radius !== "0" ? " +" + filters.radius + " km" : ""}`]);
  if (filters.min || filters.max) active.push(["price", `${filters.min || 0} – ${filters.max || "∞"} €`]);
  if (filters.cond) active.push(["cond", filters.cond]);
  if (filters.photo) active.push(["photo", "S fotografiou"]);
  if (filters.type === "buy") active.push(["type", "Kúpim"]);
  $("#activeFilters").innerHTML = active
    .map(([k, l]) => `<button type="button" data-clear="${k}">${esc(l)}${icon("close")}</button>`)
    .join("");
  $("#filterCount").textContent = active.length ? ` (${active.length})` : "";
  $$("[data-view]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === view)));
}
async function load({ push = false, focus = false } = {}) {
  const problem =
    filters.min && filters.max && Number(filters.min) > Number(filters.max)
      ? "Cena od nesmie byť vyššia než cena do."
      : "";
  $("#filterError").textContent = problem;
  if (problem) return;
  history[push ? "pushState" : "replaceState"](null, "", pageUrl());
  chrome();
  const id = ++request,
    host = $("#results");
  host.setAttribute("aria-busy", "true");
  host.style.opacity = ".5";
  try {
    const r = await api("listings?" + apiQuery());
    if (id !== request) return;
    if (r.page > r.pages && r.total) {
      filters.page = r.pages;
      return load();
    }
    host.className = view === "grid" ? "grid" : "rows";
    host.innerHTML = r.listings.map(view === "grid" ? cardMarkup : rowMarkup).join("");
    $("#empty").hidden = r.listings.length > 0;
    $("#resultCount").innerHTML =
      `${new Intl.NumberFormat("sk-SK").format(r.total)} ${plural(r.total, "inzerát", "inzeráty", "inzerátov")}${r.pages > 1 ? ` <small>· strana ${r.page} z ${r.pages}</small>` : ""}`;
    $("#pager").innerHTML = pagerMarkup(r.page, r.pages);
    $("#pager").hidden = r.pages <= 1;
    if (focus) $("#offersTitle").focus({ preventScroll: true });
  } catch (e) {
    if (id !== request) return;
    if (e.status === 401) return signIn();
    host.innerHTML = "";
    $("#empty").hidden = true;
    $("#resultCount").textContent = "";
    $("#filterError").textContent = e.message;
  } finally {
    if (id === request) {
      host.removeAttribute("aria-busy");
      host.style.opacity = "";
    }
  }
}
function refresh(delay = 0) {
  filters.page = 1;
  clearTimeout(timer);
  timer = setTimeout(() => load({ push: false }), delay);
}
function openFilters(open) {
  $("#filters").classList.toggle("open", open);
  $(".filters-scrim")?.remove();
  if (open) {
    const scrim = document.createElement("div");
    scrim.className = "filters-scrim";
    scrim.onclick = () => openFilters(false);
    document.body.append(scrim);
  }
}
window.pageInit = async function () {
  if (filters.saved && !state.user) return signIn();
  $("#categorySelect").innerHTML =
    '<option value="">Všetky kategórie</option>' +
    CATALOG.map((c) => `<option value="${c.slug}">${esc(c.name)}</option>`).join("");
  $$("[data-mode]").forEach(
    (b) =>
      (b.onclick = () => {
        filters.type = b.dataset.mode;
        refresh();
      }),
  );
  $("#categorySelect").onchange = (e) => {
    filters.cat = e.target.value;
    filters.sub = "";
    refresh();
  };
  $("#subSelect").onchange = (e) => {
    filters.sub = e.target.value;
    refresh();
  };
  $("#subcats").onclick = (e) => {
    const a = e.target.closest("[data-sub]");
    if (!a || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    filters.sub = a.dataset.sub;
    refresh();
  };
  $("#headerSearch").onsubmit = (e) => {
    e.preventDefault();
    filters.q = $("#hsQuery").value.trim();
    filters.loc = $("#hsLoc").value.trim();
    filters.radius = $("#hsRadius").value;
    refresh();
  };
  $("#location").addEventListener("change", (e) => {
    filters.loc = e.target.value.trim();
    refresh();
  });
  $("#distance").onchange = (e) => {
    filters.radius = e.target.value;
    if (filters.loc) refresh();
  };
  for (const id of ["min", "max"])
    $("#" + id).addEventListener("input", (e) => {
      filters[id] = e.target.value;
      refresh(500);
    });
  $("#condition").onchange = (e) => {
    filters.cond = e.target.value;
    refresh();
  };
  $("#sort").onchange = (e) => {
    filters.sort = e.target.value;
    refresh();
  };
  $("#withPhoto").onchange = (e) => {
    filters.photo = e.target.checked;
    refresh();
  };
  const clearAll = () => {
    Object.assign(filters, { q: "", loc: "", min: "", max: "", cond: "", photo: false, type: "sell", sort: "recent" });
    refresh();
  };
  $("#resetFilters").onclick = clearAll;
  $("#emptyReset").onclick = clearAll;
  $("#activeFilters").onclick = (e) => {
    const b = e.target.closest("[data-clear]");
    if (!b) return;
    const k = b.dataset.clear;
    if (k === "price") filters.min = filters.max = "";
    else if (k === "photo") filters.photo = false;
    else if (k === "type") filters.type = "sell";
    else filters[k] = "";
    refresh();
  };
  $$("[data-view]").forEach(
    (b) =>
      (b.onclick = () => {
        view = b.dataset.view;
        try {
          localStorage.setItem("bazar-view", view);
        } catch {}
        load();
      }),
  );
  $("#pager").onclick = (e) => {
    const b = e.target.closest("[data-page]");
    if (!b || b.disabled) return;
    filters.page = Number(b.dataset.page);
    load({ push: true, focus: true });
    scrollTo({ top: 0 });
  };
  $("#filtersOpen").onclick = () => openFilters(true);
  $("#filtersClose").onclick = () => openFilters(false);
  $("#filtersApply").onclick = () => openFilters(false);
  addEventListener("popstate", () => location.reload());
  chrome();
  await load();
  loadCategoryCounts().then(chrome);
};
