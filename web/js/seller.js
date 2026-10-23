"use strict";
// Public seller page: name, membership and all active listings.
let sellerPage = Math.max(1, Number(params.get("strana")) || 1);
async function loadSellerListings(id) {
  const r = await api(`listings?seller=${encodeURIComponent(id)}&page=${sellerPage}`);
  $("#results").innerHTML = r.listings.length
    ? r.listings.map(rowMarkup).join("")
    : '<div class="empty"><h3>Žiadne aktívne inzeráty</h3><p>Tento predajca momentálne nič neponúka.</p></div>';
  $("#resultCount").textContent =
    `${r.total} ${plural(r.total, "aktívny inzerát", "aktívne inzeráty", "aktívnych inzerátov")}`;
  $("#pager").innerHTML = pagerMarkup(r.page, r.pages);
  $("#pager").hidden = r.pages <= 1;
}
window.pageInit = async function () {
  const id = params.get("id") || "";
  try {
    const { seller } = await api("sellers/" + encodeURIComponent(id));
    document.title = `${seller.name} — inzeráty — ${SITE}`;
    $("#sellerContent").innerHTML =
      `<div class="breadcrumbs" style="margin-top:24px"><a href="/">Domov</a><span>/</span><span>Predajca</span></div><div class="seller-hero" style="margin-top:8px"><span class="avatar">${esc(seller.name.trim()[0])}</span><div><span class="kicker">Predajca</span><h1>${esc(seller.name)}</h1><p class="muted" style="margin:4px 0 0">Na ${esc(SITE)} od ${fmtDate(seller.since, { month: "long", year: "numeric" })} · ✓ overený email</p></div></div>`;
    $("#pager").onclick = (e) => {
      const b = e.target.closest("[data-page]");
      if (!b || b.disabled) return;
      sellerPage = Number(b.dataset.page);
      history.replaceState(null, "", `/predajca/?id=${encodeURIComponent(id)}&strana=${sellerPage}`);
      loadSellerListings(id);
      scrollTo({ top: 0 });
    };
    await loadSellerListings(id);
  } catch (e) {
    $("#sellerContent").innerHTML =
      `<div class="not-found"><h1>Predajca sa nenašiel</h1><p class="muted">${esc(e.message)}</p><a class="btn btn-ink" href="/inzeraty/">Najnovšie inzeráty</a></div>`;
  }
};
