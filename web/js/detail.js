"use strict";
let current = null,
  galleryIndex = 0;
function showGalleryPhoto(index) {
  const photos = current.photos;
  galleryIndex = (index + photos.length) % photos.length;
  $("#galleryPhoto").src = photos[galleryIndex];
  $("#galleryPhoto").alt = current.title + " — " + L("fotografia", "fotografie") + " " + (galleryIndex + 1);
  $("#galleryCounter").textContent = galleryIndex + 1 + " / " + photos.length;
  $$("[data-gallery-index]").forEach((b) =>
    b.setAttribute("aria-pressed", String(Number(b.dataset.galleryIndex) === galleryIndex)),
  );
}
function statusNotice(d) {
  if (d.status === "sold") return d.buy ? L("Dopyt je ukončený.", "Poptávka je ukončená.") : L("Tento predmet je predaný.", "Tento předmět je prodaný.");
  if (d.status === "hidden")
    return (
      L("Inzerát je skrytý moderátorom a verejnosť ho nevidí.", "Inzerát je skrytý moderátorem a veřejnost ho nevidí.") +
      (d.moderationNote ? " " + L("Dôvod: ", "Důvod: ") + d.moderationNote : "")
    );
  return "";
}
function renderDetail() {
  const d = current,
    photos = d.photos,
    saved = state.favorites.has(d.id),
    views = d.viewCount ?? 0,
    canContact = d.status === "active" && !d.mine;
  document.title = d.title + " — Bazaro";
  const notice = statusNotice(d);
  $("#adContent").innerHTML =
    `${notice ? `<div class="notice sold-notice">${esc(notice)}</div>` : ""}<div class="breadcrumbs"><a href="/">${L("Domov", "Domů")}</a><span>/</span><a href="/kategorie/">${L("Kategórie", "Kategorie")}</a><span>/</span><a href="/inzeraty/?kategoria=${encodeURIComponent(d.cat)}${d.buy ? "&typ=buy" : ""}">${esc(catName(d.cat))}</a></div><div class="ad-layout"><div><div class="gallery-stage" id="galleryStage" tabindex="0" aria-label="${L("Galéria fotografií, šípky vľavo a vpravo menia fotografiu", "Galerie fotografií, šipky vlevo a vpravo mění fotografii")}"><img id="galleryPhoto" src="${esc(photos[0])}" alt="${esc(d.title)}">${photos.length > 1 ? `<button type="button" id="galleryPrev" class="gallery-nav prev" aria-label="${L("Predchádzajúca fotografia", "Předchozí fotografie")}">‹</button><button type="button" id="galleryNext" class="gallery-nav next" aria-label="${L("Nasledujúca fotografia", "Další fotografie")}">›</button>` : ""}<span class="gallery-counter" id="galleryCounter" role="status"${d.noPhoto ? " hidden" : ""}>1 / ${photos.length}</span></div>${photos.length > 1 ? `<div class="gallery-thumbnails" id="galleryThumbs">${photos.map((src, i) => `<button type="button" data-gallery-index="${i}" aria-label="${L("Zobraziť fotografiu", "Zobrazit fotografii")} ${i + 1}" aria-pressed="${i === 0}"><img src="${esc(src)}" alt="" loading="lazy"></button>`).join("")}</div>` : ""}<div class="ad-description"><h2>${L("Popis inzerátu", "Popis inzerátu")}</h2><p>${esc(d.desc)}</p></div></div><aside class="ad-summary"><span class="small-kicker">${d.buy ? L("KÚPIM", "KOUPÍM") : L("PREDÁM", "PRODÁM")}${d.boost ? " · ↑ BOOST" : ""}</span><h1>${esc(d.title)}</h1><div class="detail-price">${price(d)}</div><div class="ad-facts"><span>⌖ ${esc(d.city)}</span><span>${esc(conditionName(d.state))}</span><span>${d.noPhoto ? L("Bez fotografie", "Bez fotografie") : d.photoCount + " " + (lang === "cz" ? plural(d.photoCount, "fotografie", "fotografie", "fotografií") : plural(d.photoCount, "fotografia", "fotografie", "fotografií"))}</span><span class="ad-views" title="${L("Zobrazenia prihlásených používateľov so súhlasom, najviac raz denne.", "Zobrazení přihlášených uživatelů se souhlasem, nejvýše jednou denně.")}">◉ ${views} ${lang === "cz" ? plural(views, "zobrazení", "zobrazení", "zobrazení") : plural(views, "zobrazenie", "zobrazenia", "zobrazení")}</span><span>${L("Pridané", "Přidáno")} ${fmtDate(d.createdAt)}</span></div><div class="seller"><strong>${esc(d.seller)}</strong><small class="checked">✓ ${L("Email overený", "Email ověřený")}</small><small>${L("Na Bazaro od", "Na Bazaro od")} ${fmtDate(d.sellerSince, { year: "numeric", month: "long" })}</small></div><div class="detail-buttons">${
      d.mine
        ? `<a class="primary" href="/ucet/">${L("Spravovať inzerát", "Spravovat inzerát")} ↗</a>`
        : `<button type="button" class="primary" id="contact"${canContact ? "" : " disabled"}>${d.buy ? L("Ponúknuť predmet", "Nabídnout předmět") : L("Napísať predajcovi", "Napsat prodejci")} ↗</button><button type="button" class="outline" id="revealContacts" aria-controls="contactInfo" aria-expanded="false"${canContact ? "" : " disabled"}>${d.hasPhone ? L("Zobraziť kontakty", "Zobrazit kontakty") : L("Zobraziť email", "Zobrazit email")} <span class="contact-methods">${d.hasPhone ? "Email + " + L("telefón", "telefon") : "Email"}</span></button><div class="contact-info" id="contactInfo" hidden tabindex="-1"></div>`
    }<button type="button" class="outline" data-fav="${d.id}" data-fav-label="1" aria-pressed="${saved}">${saved ? L("♥ Uložené", "♥ Uloženo") : L("♡ Uložiť inzerát", "♡ Uložit inzerát")}</button><button type="button" class="outline" id="share">${L("Zdieľať", "Sdílet")} ↗</button></div><p class="modal-muted">${L("Dohoda, platba a odovzdanie prebiehajú priamo medzi vami.", "Dohoda, platba i předání probíhají přímo mezi vámi.")} <button type="button" class="text-button" id="safetyTips">${L("Tipy pre bezpečný obchod", "Tipy pro bezpečný obchod")}</button></p>${d.mine ? "" : `<a class="text-button" href="/nahlasit/?inzerat=${d.id}">${L("Nahlásiť inzerát", "Nahlásit inzerát")} ↗</a>`}${state.user?.admin ? adminPanel(d) : ""}</aside></div>`;
  galleryIndex = 0;
  if ($("#galleryThumbs"))
    $("#galleryThumbs").onclick = (e) => {
      const b = e.target.closest("[data-gallery-index]");
      if (b) showGalleryPhoto(Number(b.dataset.galleryIndex));
    };
  $("#galleryStage").onkeydown = (e) => {
    if (photos.length > 1 && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
      e.preventDefault();
      showGalleryPhoto(galleryIndex + (e.key === "ArrowRight" ? 1 : -1));
    }
  };
  if (photos.length > 1) {
    $("#galleryPrev").onclick = () => showGalleryPhoto(galleryIndex - 1);
    $("#galleryNext").onclick = () => showGalleryPhoto(galleryIndex + 1);
  }
  $("#safetyTips").onclick = explainSafety;
  $("#share").onclick = async () => {
    const url = location.origin + "/inzerat/?id=" + d.id;
    try {
      if (navigator.share) await navigator.share({ title: d.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast(L("Odkaz je skopírovaný.", "Odkaz je zkopírovaný."));
      }
    } catch {}
  };
  if ($("#contact"))
    $("#contact").onclick = () =>
      requireAccount(() =>
        operation($("#contact"), async () => {
          const r = await api("conversations", "POST", { id: d.id });
          location.assign("/spravy/?inzerat=" + r.id);
        }),
      );
  if ($("#revealContacts"))
    $("#revealContacts").onclick = () =>
      requireAccount(() =>
        operation($("#revealContacts"), async () => {
          const c = await api("listings/" + d.id + "/contacts", "POST", {});
          $("#contactInfo").innerHTML =
            `<div class="contact-info-title">${L("Kontakty inzerujúceho", "Kontakty inzerujícího")}</div><div class="contact-field"><span>Email</span><strong><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></strong></div>${c.phone ? `<div class="contact-field"><span>${L("Telefón", "Telefon")}</span><strong><a href="tel:${esc(c.phone.replace(/[^\d+]/g, ""))}">${esc(c.phone)}</a></strong></div>` : ""}`;
          $("#contactInfo").hidden = false;
          $("#contactInfo").focus();
          $("#revealContacts").setAttribute("aria-expanded", "true");
        }),
      );
  if ($("#adminActions")) wireAdminPanel(d);
}
function adminPanel(d) {
  return `<div class="admin-inline" id="adminActions"><span class="small-kicker">ADMINISTRÁCIA</span><p>${esc(d.status)}${d.moderationNote ? " · " + esc(d.moderationNote) : ""}</p>${d.status === "hidden" ? '<button type="button" class="outline" data-admin="restore">Obnoviť</button>' : '<button type="button" class="outline" data-admin="hide">Skryť</button>'}${d.boost ? '<button type="button" class="outline" data-admin="unboost">Zrušiť Boost</button>' : ""}<button type="button" class="outline delete-action" data-admin="delete">Odstrániť</button><a class="text-button" href="/administracia/?sekcia=pouzivatelia&q=${encodeURIComponent(d.ownerId)}">Inzerent ↗</a></div>`;
}
function wireAdminPanel(d) {
  $("#adminActions").onclick = async (e) => {
    const b = e.target.closest("[data-admin]");
    if (!b) return;
    const action = b.dataset.admin,
      needsNote = action === "hide" || action === "delete";
    const note = await confirmDialog({
      title: { hide: "Skryť inzerát?", restore: "Obnoviť inzerát?", delete: "Odstrániť inzerát?", unboost: "Zrušiť Boost?" }[action],
      text: needsNote ? "Dôvod pošleme inzerujúcemu emailom." : "",
      note: needsNote ? "Dôvod (pre inzerujúceho)" : null,
      danger: action === "delete",
    });
    if (note === false) return;
    await operation(null, async () => {
      await api("admin/listings/" + d.id, "POST", { action, note: typeof note === "string" ? note : "" });
      toast("Hotovo.");
      if (action === "delete") location.assign("/administracia/?sekcia=inzeraty");
      else await loadDetail();
    });
  };
}
async function loadRelated() {
  try {
    const r = await api(`listings?country=${current.country}&cat=${encodeURIComponent(current.cat)}&type=${current.buy ? "buy" : "sell"}&limit=5`);
    const items = r.listings.filter((x) => x.id !== current.id).slice(0, 4);
    if (!items.length) return;
    $("#relatedGrid").innerHTML = items.map(cardMarkup).join("");
    $("#related").hidden = false;
  } catch {}
}
async function loadDetail() {
  const id = Number(params.get("id"));
  try {
    if (!Number.isSafeInteger(id) || id <= 0) throw Error(L("Inzerát sa nenašiel.", "Inzerát nebyl nalezen."));
    current = (await api("listings/" + id)).listing;
    renderDetail();
  } catch (e) {
    $("#adContent").innerHTML =
      `<div class="empty"><h1>${L("Inzerát nie je dostupný.", "Inzerát není dostupný.")}</h1><p>${esc(e.message)}</p><a href="/inzeraty/" class="primary">${L("Prehliadať inzeráty", "Procházet inzeráty")} ↗</a></div>`;
    return false;
  }
  return true;
}
window.pageInit = async function () {
  if (!(await loadDetail())) return;
  if (state.user?.verified && !current.mine && current.status === "active" && hasAnalyticsConsent())
    api("listings/" + current.id + "/view", "POST", {}).catch(() => {});
  if (current.status === "active") loadRelated();
};
