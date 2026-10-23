"use strict";
// Home page and the category overview.
window.pageInit = async function () {
  const board = $("#catBoard");
  if (page === "categories") board.dataset.full = "1";
  categoryBoard(board);
  const heroSearch = $("#heroSearch");
  if (heroSearch)
    heroSearch.onsubmit = (e) => {
      e.preventDefault();
      location.assign(listingSearchUrl(heroSearch));
    };
  const counts = loadCategoryCounts().then((c) => {
    categoryBoard(board, c.counts);
    if ($("#heroStats") && c.total) {
      $("#statTotal").textContent = new Intl.NumberFormat("sk-SK").format(c.total);
      $("#statToday").textContent = new Intl.NumberFormat("sk-SK").format(c.today);
      $("#heroStats").hidden = false;
    }
    if ($("#catCount"))
      $("#catCount").textContent =
        `${c.total} ${plural(c.total, "aktívny inzerát", "aktívne inzeráty", "aktívnych inzerátov")} v ${CATALOG.length} kategóriách.`;
  });
  if (page !== "home") return counts;
  const [top, latest] = await Promise.all([
    api("listings/featured").catch(() => ({ listings: [] })),
    api("listings?limit=12").catch((e) => ({ error: e.message, listings: [] })),
  ]);
  if (top.listings.length) {
    $("#topStrip").innerHTML = top.listings.map(cardMarkup).join("");
    $("#topSection").hidden = false;
  }
  $("#latestRows").innerHTML = latest.listings.length
    ? latest.listings.map(rowMarkup).join("")
    : `<div class="empty"><h3>${latest.error ? esc(latest.error) : "Zatiaľ tu nie je žiadny inzerát"}</h3><p>Buď prvý – pridanie je zadarmo a zaberie minútu.</p><a class="btn btn-tag" href="/pridat/">${icon("plus")}Pridať inzerát</a></div>`;
  await counts;
};
