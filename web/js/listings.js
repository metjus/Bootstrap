"use strict";
const filterFields = [
  ["query", "q"],
  ["location", "mesto"],
  ["min", "min"],
  ["max", "max"],
  ["distance", "okruh"],
  ["condition", "stav"],
  ["sort", "zoradenie"],
];
let listMode = params.get("typ") === "buy" ? "buy" : "sell",
  listCategory = CATEGORIES.some((c) => c[0] === params.get("kategoria")) ? params.get("kategoria") : "all",
  listPage = Math.max(1, Number(params.get("strana")) || 1),
  savedOnly = params.get("oblubene") === "1",
  listRequest = 0,
  listTimer = null;
function listingQuery() {
  const q = new URLSearchParams();
  if (listCategory !== "all") q.set("kategoria", listCategory);
  if (listMode === "buy") q.set("typ", "buy");
  if (savedOnly) q.set("oblubene", "1");
  for (const [id, key] of filterFields) {
    const v = $("#" + id).value.trim();
    if (v && !(key === "okruh" && v === "0") && !(key === "zoradenie" && v === "recent")) q.set(key, v);
  }
  if (listPage > 1) q.set("strana", listPage);
  return q;
}
function filterProblem() {
  if ($("#max").value !== "" && Number($("#min").value) > Number($("#max").value))
    return L("Cena od nesmie byť vyššia než cena do.", "Cena od nesmí být vyšší než cena do.");
  if ($("#distance").value !== "0" && !$("#location").value.trim())
    return L("Pre vzdialenosť zadaj mesto alebo PSČ.", "Pro vzdálenost zadej město nebo PSČ.");
  return "";
}
async function loadListings({ push = false, focus = false } = {}) {
  const problem = filterProblem();
  $("#filterError").textContent = problem;
  if (problem) return;
  const q = listingQuery();
  history[push ? "pushState" : "replaceState"](null, "", "/inzeraty/" + (q.size ? "?" + q : ""));
  const api_q = new URLSearchParams({ country: lang, type: listMode, page: listPage });
  if (listCategory !== "all") api_q.set("cat", listCategory);
  if (savedOnly) {
    api_q.set("saved", "1");
    api_q.delete("type");
    api_q.delete("country");
  }
  const map = { q: "q", mesto: "city", okruh: "radius", min: "min", max: "max", stav: "cond", zoradenie: "sort" };
  for (const [key, value] of q) if (map[key]) api_q.set(map[key], value);
  const id = ++listRequest,
    grid = $("#grid");
  grid.setAttribute("aria-busy", "true");
  grid.classList.add("loading");
  try {
    const r = await api("listings?" + api_q);
    if (id !== listRequest) return;
    if (r.page > r.pages && r.total) {
      listPage = r.pages;
      return loadListings();
    }
    grid.innerHTML = r.listings.map(cardMarkup).join("");
    $("#empty").hidden = r.listings.length > 0;
    $("#resultCount").textContent =
      r.total +
      " " +
      (lang === "cz" ? plural(r.total, "nabídka", "nabídky", "nabídek") : plural(r.total, "ponuka", "ponuky", "ponúk")) +
      (listCategory !== "all" ? " · " + catName(listCategory) : "");
    const pager = $("#pager");
    pager.innerHTML = pagerMarkup(r.page, r.pages);
    pager.hidden = r.pages <= 1;
    if (focus) $("#offersTitle").focus();
  } catch (e) {
    if (id !== listRequest) return;
    if (e.status === 401) return signIn();
    grid.innerHTML = "";
    $("#empty").hidden = true;
    $("#resultCount").textContent = "";
    $("#filterError").textContent = e.message;
  } finally {
    if (id === listRequest) {
      grid.removeAttribute("aria-busy");
      grid.classList.remove("loading");
    }
  }
}
function renderListingChrome() {
  const title = savedOnly
    ? L("Obľúbené inzeráty", "Oblíbené inzeráty")
    : listCategory === "all"
      ? L("Všetky inzeráty", "Všechny inzeráty")
      : catName(listCategory);
  $("#offersTitle").textContent = title;
  document.title = title + " — Bazaro";
  $("#breadcrumbCategory").textContent = savedOnly ? L("Obľúbené", "Oblíbené") : catName(listCategory);
  $("#categorySelect").value = listCategory;
  $(".mode-switch").hidden = savedOnly;
  $$("[data-mode]").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === listMode);
    b.setAttribute("aria-pressed", String(b.dataset.mode === listMode));
  });
  $("#resetAll").hidden =
    listCategory === "all" && !savedOnly && filterFields.every(([id]) => ["", "0", "recent"].includes($("#" + id).value));
}
function refresh(delay = 0) {
  listPage = 1;
  renderListingChrome();
  clearTimeout(listTimer);
  listTimer = setTimeout(loadListings, delay);
}
window.pageInit = async function () {
  if (savedOnly && !state.user) return signIn();
  $("#categorySelect").innerHTML = [["all"], ...CATEGORIES]
    .map(([id]) => `<option value="${esc(id)}">${esc(catName(id))}</option>`)
    .join("");
  $("#sort").innerHTML = `<option value="recent">${L("Najnovšie", "Nejnovější")}</option><option value="low">${L("Najlacnejšie", "Nejlevnější")}</option><option value="high">${L("Najdrahšie", "Nejdražší")}</option>`;
  $("#min").placeholder = lang === "cz" ? "0 Kč" : "0 €";
  $("#max").placeholder = L("Bez limitu", "Bez limitu");
  for (const [id, key] of filterFields) if (params.has(key)) $("#" + id).value = params.get(key);
  if (!$("#sort").value) $("#sort").value = "recent";
  if (!$("#distance").value) $("#distance").value = "0";
  $$("[data-mode]").forEach(
    (b) =>
      (b.onclick = () => {
        listMode = b.dataset.mode;
        refresh();
      }),
  );
  $("#categorySelect").onchange = (e) => {
    listCategory = e.target.value;
    refresh();
  };
  wireSearchForm((e) => {
    e.preventDefault();
    refresh();
  });
  $("#query").addEventListener("input", () => refresh(400));
  $("#location").addEventListener("change", () => refresh());
  for (const id of ["min", "max"]) $("#" + id).addEventListener("input", () => refresh(500));
  for (const id of ["distance", "condition", "sort"]) $("#" + id).addEventListener("change", () => refresh());
  const clear = () => {
    for (const [id] of filterFields) $("#" + id).value = id === "sort" ? "recent" : id === "distance" ? "0" : "";
    refresh();
  };
  $("#resetFilters").onclick = clear;
  $("#emptyReset").onclick = clear;
  $("#pager").onclick = (e) => {
    const b = e.target.closest("[data-page]");
    if (!b || b.disabled) return;
    listPage = Number(b.dataset.page);
    loadListings({ push: true, focus: true });
    $("#offers").scrollIntoView({ block: "start" });
  };
  addEventListener("popstate", () => location.reload());
  renderListingChrome();
  await loadListings();
};
