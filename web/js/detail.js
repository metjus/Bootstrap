"use strict";
let current = null,
  galleryIndex = 0;
function showGalleryPhoto(index) {
  const photos = current.photos;
  galleryIndex = (index + photos.length) % photos.length;
  $("#galleryPhoto").src = photos[galleryIndex];
  $("#galleryCounter").textContent = galleryIndex + 1 + " / " + photos.length;
  $$("[data-gallery-index]").forEach((b) =>
    b.setAttribute("aria-pressed", String(Number(b.dataset.galleryIndex) === galleryIndex)),
  );
}
function statusNotice(d) {
  if (d.status === "sold") return d.buy ? "Tento dopyt je ukončený." : "Tento predmet je už predaný.";
  if (d.status === "expired")
    return "Platnosť inzerátu vypršala. Verejnosť ho nevidí" + (d.mine ? " – predĺž ho v Môj účet." : ".");
  if (d.status === "hidden")
    return "Inzerát je skrytý moderátorom." + (d.moderationNote ? " Dôvod: " + d.moderationNote : "");
  return "";
}
function renderDetail() {
  const d = current,
    photos = d.photos,
    live = d.status === "active",
    saved = state.favorites.has(d.id),
    notice = statusNotice(d);
  document.title = d.title + " — " + SITE;
  const facts = [
    ["Lokalita", `${esc(d.city)}${d.zip ? ", " + formatZip(d.zip) : ""}`],
    ["Stav", esc(conditionName(d.state))],
    ["Kategória", `<a href="${catUrl(d.cat, d.sub)}">${esc(d.subName)}</a>`],
    ["Pridané", fmtDate(d.createdAt)],
    ["Platí do", fmtDate(d.expires)],
    ["Zobrazenia", d.viewCount ?? 0],
    ["Číslo inzerátu", d.id],
  ];
  $("#adContent").innerHTML =
    `${notice ? `<div class="sold-notice">${esc(notice)}</div>` : ""}<div class="breadcrumbs"><a href="/">Domov</a><span>/</span><a href="${catUrl(d.cat)}">${esc(d.catName)}</a><span>/</span><a href="${catUrl(d.cat, d.sub)}">${esc(d.subName)}</a></div>
<div class="ad-layout"><div class="ad-gallery">
  <div class="gallery-stage ${d.noPhoto ? "no-photo" : ""}" id="galleryStage" tabindex="0" aria-label="Galéria fotografií – šípkami prepínaš"><img id="galleryPhoto" src="${esc(photos[0])}" alt="${esc(d.title)}">${photos.length > 1 ? `<button type="button" id="galleryPrev" class="gallery-nav prev" aria-label="Predchádzajúca fotografia">‹</button><button type="button" id="galleryNext" class="gallery-nav next" aria-label="Ďalšia fotografia">›</button><span class="gallery-counter" id="galleryCounter">1 / ${photos.length}</span>` : ""}</div>
  ${photos.length > 1 ? `<div class="gallery-thumbnails" id="galleryThumbs">${photos.map((src, i) => `<button type="button" data-gallery-index="${i}" aria-label="Fotografia ${i + 1}" aria-pressed="${i === 0}"><img src="${esc(src)}" alt="" loading="lazy"></button>`).join("")}</div>` : ""}
  
</div>
<aside class="ad-summary">
  <div class="ad-card">
    <div class="lrow-badges">${d.boost ? '<span class="badge-top">TOP</span>' : ""}<span class="${d.buy ? "badge-buy" : "lrow-cat"}">${d.buy ? "KÚPIM" : "PREDÁM"}</span></div>
    <h1>${esc(d.title)}</h1>
    ${priceTag(d, "tag-lg")}
    <dl class="ad-facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>
    <div class="detail-buttons">${
      d.mine
        ? `<a class="btn btn-ink btn-lg" href="/ucet/">Spravovať inzerát</a>`
        : `<button type="button" class="btn btn-ink btn-lg" id="contact"${live ? "" : " disabled"}>${icon("chat")}${d.buy ? "Ponúknuť predmet" : "Napísať predajcovi"}</button><button type="button" class="btn btn-line" id="revealContacts" aria-controls="contactInfo" aria-expanded="false"${live ? "" : " disabled"}>${icon(d.hasPhone ? "phone" : "mail")}${d.hasPhone ? "Zobraziť telefón a email" : "Zobraziť email"}</button>`
    }<div class="contact-info" id="contactInfo" hidden tabindex="-1"></div><div class="composer" id="composer" hidden><label for="composerText">Správa pre ${esc(d.seller)}</label><textarea id="composerText" maxlength="4000">Dobrý deň, je inzerát „${esc(d.title)}“ ešte aktuálny?</textarea><button type="button" class="btn btn-tag" id="composerSend">Odoslať správu</button><p class="field-error" id="composerError" role="alert"></p></div></div>
    <div class="detail-row"><button type="button" class="btn btn-line ${saved ? "selected" : ""}" data-fav="${d.id}" data-fav-label="1" aria-pressed="${saved}">${icon("heart")}${saved ? "Uložené" : "Uložiť"}</button><button type="button" class="btn btn-line" id="share">${icon("share")}Zdieľať</button>${d.mine ? "" : `<a class="btn btn-line" href="/nahlasit/?inzerat=${d.id}">${icon("flag")}Nahlásiť</a>`}</div>
  </div>
  <div class="ad-card"><a class="seller-card" href="/predajca/?id=${encodeURIComponent(d.sellerId)}"><span class="avatar">${esc((d.seller || "?").trim()[0])}</span><span><strong>${esc(d.seller)}</strong><small>Na ${esc(SITE)} od ${fmtDate(d.sellerSince, { month: "long", year: "numeric" })} · ✓ overený email</small></span>${icon("arrow")}</a><p class="safety-note" style="margin:14px 0 0">${icon("shield")}<span>Neplať vopred a nezadávaj údaje karty do odkazov od cudzích. <button type="button" class="link-btn" id="safetyTips">Tipy pre bezpečný obchod</button></span></p></div>
  ${state.user?.admin ? adminPanel(d) : ""}
</aside><div class="ad-description"><h2>Popis</h2><p>${esc(d.desc)}</p></div></div>
${d.mine ? "" : `<div class="mobile-actions">${priceTag(d)}<button type="button" class="btn btn-line" id="mobileReveal"${live ? "" : " disabled"}>${icon(d.hasPhone ? "phone" : "mail")}Kontakt</button><button type="button" class="btn btn-ink" id="mobileContact"${live ? "" : " disabled"}>${icon("chat")}Napísať</button></div>`}`;
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
    let startX = null;
    $("#galleryStage").addEventListener("touchstart", (e) => (startX = e.touches[0].clientX), { passive: true });
    $("#galleryStage").addEventListener("touchend", (e) => {
      if (startX === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) showGalleryPhoto(galleryIndex + (dx < 0 ? 1 : -1));
      startX = null;
    });
  }
  $("#safetyTips").onclick = explainSafety;
  $("#share").onclick = async () => {
    const url = location.origin + "/inzerat/?id=" + d.id;
    try {
      if (navigator.share) await navigator.share({ title: d.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast("Odkaz je skopírovaný.");
      }
    } catch {}
  };
  const openComposer = () =>
    requireAccount(() => {
      $("#composer").hidden = false;
      if (innerWidth <= 760) {
        $(".detail-buttons").style.display = "flex";
        $("#composer").scrollIntoView({ block: "center" });
      }
      $("#composerText").focus();
    });
  const reveal = () =>
    requireAccount(() =>
      operation($("#revealContacts"), async () => {
        const c = await api("listings/" + d.id + "/contacts", "POST", {});
        $("#contactInfo").innerHTML =
          `${c.phone ? `<div class="contact-field"><span>Telefón</span><a href="tel:${esc(c.phone.replace(/[^\d+]/g, ""))}">${esc(c.phone)}</a></div>` : ""}<div class="contact-field"><span>Email</span><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></div>`;
        $("#contactInfo").hidden = false;
        $("#revealContacts").setAttribute("aria-expanded", "true");
        if (innerWidth <= 760) {
          $(".detail-buttons").style.display = "flex";
          $("#contactInfo").scrollIntoView({ block: "center" });
        }
      }),
    );
  if ($("#contact")) $("#contact").onclick = openComposer;
  if ($("#revealContacts")) $("#revealContacts").onclick = reveal;
  if ($("#mobileContact")) $("#mobileContact").onclick = openComposer;
  if ($("#mobileReveal")) $("#mobileReveal").onclick = reveal;
  if ($("#composerSend"))
    $("#composerSend").onclick = () =>
      operation(
        $("#composerSend"),
        async () => {
          const text = $("#composerText").value.trim();
          if (!text) throw Error("Napíš správu.");
          const { id } = await api("conversations", "POST", { id: d.id });
          await api("conversations/" + id + "/messages", "POST", { text });
          $("#composer").innerHTML =
            `<div class="notice">Správa je odoslaná. Odpoveď nájdeš v <a href="/spravy/?inzerat=${id}">Správach</a>.</div>`;
        },
        $("#composerError"),
      );
  if ($("#adminActions")) wireAdminPanel(d);
}
function adminPanel(d) {
  return `<div class="admin-inline" id="adminActions"><span class="kicker" style="margin:0">Administrácia</span><p>Stav: ${esc(d.status)}${d.moderationNote ? " · " + esc(d.moderationNote) : ""}</p>${d.status === "hidden" ? '<button type="button" class="btn btn-line" data-admin="restore">Obnoviť</button>' : '<button type="button" class="btn btn-line" data-admin="hide">Skryť</button>'}${d.boost ? '<button type="button" class="btn btn-line" data-admin="unboost">Zrušiť TOP</button>' : ""}<button type="button" class="btn btn-line delete-action" data-admin="delete">Odstrániť</button><a class="link-btn" href="/administracia/?sekcia=pouzivatelia&q=${encodeURIComponent(d.sellerId)}">Inzerent</a></div>`;
}
function wireAdminPanel(d) {
  $("#adminActions").onclick = async (e) => {
    const b = e.target.closest("[data-admin]");
    if (!b) return;
    const action = b.dataset.admin,
      needsNote = action === "hide" || action === "delete";
    const note = await confirmDialog({
      title: {
        hide: "Skryť inzerát?",
        restore: "Obnoviť inzerát?",
        delete: "Odstrániť inzerát?",
        unboost: "Zrušiť zvýraznenie?",
      }[action],
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
async function loadMore() {
  const d = current;
  const [mine, similar] = await Promise.all([
    api(`listings?seller=${encodeURIComponent(d.sellerId)}&exclude=${d.id}&limit=4`).catch(() => null),
    api(`listings?cat=${d.cat}&sub=${d.sub}&type=${d.buy ? "buy" : "sell"}&exclude=${d.id}&limit=4`).catch(() => null),
  ]);
  if (mine?.listings.length && !d.mine) {
    $("#sellerMoreTitle").textContent = `Ďalšie inzeráty – ${d.seller} (${mine.total})`;
    $("#sellerMoreLink").href = "/predajca/?id=" + encodeURIComponent(d.sellerId);
    $("#sellerMoreRows").innerHTML = mine.listings.map(rowMarkup).join("");
    $("#sellerMore").hidden = false;
  }
  if (similar?.listings.length) {
    $("#relatedGrid").innerHTML = similar.listings.map(cardMarkup).join("");
    $("#relatedLink").href = catUrl(d.cat, d.sub);
    $("#related").hidden = false;
  }
}
async function loadDetail() {
  const id = Number(params.get("id"));
  try {
    if (!Number.isSafeInteger(id) || id <= 0) throw Error("Inzerát sa nenašiel.");
    current = (await api("listings/" + id)).listing;
    renderDetail();
  } catch (e) {
    $("#adContent").innerHTML =
      `<div class="not-found"><span class="tag tag-lg">Predané?</span><h1>Inzerát nie je dostupný</h1><p class="muted">${esc(e.message)} Mohol byť predaný, odstránený alebo mu vypršala platnosť.</p><a href="/inzeraty/" class="btn btn-ink">Najnovšie inzeráty</a></div>`;
    return false;
  }
  return true;
}
window.pageInit = async function () {
  if (!(await loadDetail())) return;
  if (state.user?.verified && !current.mine && current.status === "active" && hasAnalyticsConsent())
    api("listings/" + current.id + "/view", "POST", {}).catch(() => {});
  $$(".catbar a").forEach((a) => a.classList.toggle("active", a.dataset.cat === current.cat));
  if (current.status === "active") loadMore();
};
