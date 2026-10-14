"use strict";
async function renderFeatured() {
  const grid = $("#boostGrid");
  grid.setAttribute("aria-busy", "true");
  try {
    const r = await api("listings/featured?country=" + lang);
    const latest = r.kind === "latest";
    $('[data-t="boostLabel"]').textContent = latest ? L("NAJNOVŠIE PONUKY", "NEJNOVĚJŠÍ NABÍDKY") : L("ZVÝRAZNENÉ PONUKY", "ZVÝRAZNĚNÉ NABÍDKY");
    $('[data-t="boostTitle"]').textContent = latest ? L("Čerstvo pridané.", "Čerstvě přidané.") : L("Objav niečo výnimočné.", "Objev něco výjimečného.");
    $('[data-t="boostDescription"]').textContent = latest
      ? L("Najnovšie inzeráty z tvojej krajiny.", "Nejnovější inzeráty z tvé země.")
      : L("Výber zvýraznených ponúk z celého bazára. Ďalší dobrý nález môže byť práve tu.", "Výběr zvýrazněných nabídek z celého bazaru. Další dobrý nález může být právě tady.");
    $("#shuffleBoosts").hidden = latest;
    grid.innerHTML = r.listings.length
      ? r.listings.map(cardMarkup).join("")
      : `<div class="account-empty"><h3>${L("Priestor pre tvoju ponuku.", "Prostor pro tvoji nabídku.")}</h3><p>${L("Zatiaľ tu nie sú žiadne inzeráty. Buď prvý.", "Zatím tu nejsou žádné inzeráty. Buď první.")}</p><a class="primary" href="/pridat/">${L("Pridať inzerát", "Přidat inzerát")} ↗</a></div>`;
  } catch (e) {
    grid.innerHTML = `<p class="form-error">${esc(e.message)}</p>`;
  } finally {
    grid.removeAttribute("aria-busy");
  }
}
window.pageInit = async function () {
  wireSearchForm();
  $("#shuffleBoosts").onclick = renderFeatured;
  $("#addBottom").onclick = (e) => {
    if (!state.user?.verified) {
      e.preventDefault();
      requireAccount(() => location.assign("/pridat/"));
    }
  };
  await renderFeatured();
};
