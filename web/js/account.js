"use strict";
const accountTab = ["inzeraty", "oblubene", "nastavenia"].includes(params.get("sekcia")) ? params.get("sekcia") : "inzeraty";
let accountFilter = "all",
  accountPage = 1,
  ownCache = [];
function statusLabel(d) {
  if (d.status === "hidden") return `<span class="status-closed">${L("Skryté moderátorom", "Skryto moderátorem")}</span>`;
  if (d.status === "sold")
    return `<span class="status-closed">✓ ${d.buy ? L("Ukončený dopyt", "Ukončená poptávka") : L("Predané", "Prodáno")}</span>`;
  return `<span>${L("Aktívny", "Aktivní")}</span>`;
}
function managementRow(d) {
  const closed = d.status === "sold",
    hidden = d.status === "hidden";
  return `<article class="manage-row"><a class="manage-photo" href="/inzerat/?id=${d.id}"><img src="${esc(d.photo)}" alt="${esc(d.title)}" loading="lazy"></a><div class="manage-info"><div class="manage-status">${statusLabel(d)}${d.boost ? '<span class="status-boost">↑ BOOST</span>' : ""}<small>${d.buy ? L("KÚPIM", "KOUPÍM") : L("PREDÁM", "PRODÁM")}</small></div><h3><a href="/inzerat/?id=${d.id}">${esc(d.title)} ↗</a></h3><p>${esc(catName(d.cat))} · ${esc(d.city)} · ◉ ${d.viewCount ?? 0} · ${fmtDate(d.createdAt)}</p><strong>${price(d)}</strong>${d.boost ? `<p class="boost-expiry">Boost ${L("do", "do")} ${fmtDate(d.boostUntil)}</p>` : ""}${hidden && d.moderationNote ? `<p class="field-error">${L("Dôvod", "Důvod")}: ${esc(d.moderationNote)}</p>` : ""}</div><div class="manage-actions">${hidden ? "" : `<button type="button" class="outline" data-manage="edit" data-id="${d.id}">${L("Upraviť", "Upravit")}</button>${closed ? "" : `<button type="button" class="outline boost-action" data-manage="boost" data-id="${d.id}">↑ ${d.boost ? L("Spravovať Boost", "Spravovat Boost") : "Boost"}</button>`}<button type="button" class="text-button" data-manage="status" data-id="${d.id}">${closed ? L("Znovu aktivovať", "Znovu aktivovat") : d.buy ? L("Ukončiť dopyt", "Ukončit poptávku") : L("Označiť ako predané", "Označit jako prodané")}</button>`}<button type="button" class="text-button delete-action" data-manage="delete" data-id="${d.id}">${L("Odstrániť", "Odstranit")}</button></div></article>`;
}
function accountShell(counts) {
  const u = state.user,
    total = Object.values(counts || {}).reduce((a, b) => a + b, 0);
  return `<div class="account-heading"><div><span class="small-kicker">${L("MÔJ ÚČET", "MŮJ ÚČET")}</span><h1>${L("Ahoj", "Ahoj")}, ${esc(u.name)}<span>.</span></h1><p>${L("Tvoje ponuky, dobré nálezy a nastavenia.", "Tvoje nabídky, dobré nálezy a nastavení.")}</p></div><a class="primary" href="/pridat/" id="accountAdd">＋ ${L("Pridať inzerát", "Přidat inzerát")}</a></div><div class="account-layout"><aside class="account-sidebar"><div class="profile-summary"><span class="profile-avatar" aria-hidden="true">${esc(u.name.trim().charAt(0).toUpperCase())}</span><strong>${esc(u.name)}</strong><span class="profile-email">${esc(u.email)}</span><small>${u.verified ? L("✓ Email overený", "✓ Email ověřený") : L("Email čaká na overenie", "Email čeká na ověření")}</small></div><nav aria-label="${L("Menu účtu", "Menu účtu")}">${[
    ["inzeraty", L("Moje inzeráty", "Moje inzeráty"), counts ? total : ""],
    ["oblubene", L("Obľúbené", "Oblíbené"), state.favorites.size],
    ["nastavenia", L("Nastavenia", "Nastavení"), ""],
  ]
    .map(([key, label, count]) => `<a href="/ucet/?sekcia=${key}"${accountTab === key ? ' class="active" aria-current="page"' : ""}>${label} <span>${count}</span></a>`)
    .join("")}${u.verified ? `<a href="/spravy/">${L("Správy", "Zprávy")}${state.unread ? ` <span>${state.unread}</span>` : " ↗"}</a>` : ""}${u.admin ? '<a href="/administracia/">Administrácia ↗</a>' : ""}</nav><button type="button" class="text-button" id="accountLogout">${L("Odhlásiť sa", "Odhlásit se")} ↗</button></aside><section class="account-workspace" id="workspace"><p role="status" class="loading-line">${L("Načítavam…", "Načítám…")}</p></section></div>`;
}
async function renderOwn() {
  const r = await api(`me/listings?status=${accountFilter === "all" ? "" : accountFilter}&page=${accountPage}`),
    counts = r.counts,
    total = (counts.active || 0) + (counts.sold || 0) + (counts.hidden || 0);
  ownCache = r.listings;
  $("#accountContent").innerHTML = accountShell(counts);
  $("#workspace").innerHTML = `${!state.user.verified ? `<div class="notice">${L("Na pridávanie inzerátov potvrď svoj email.", "Pro přidávání inzerátů potvrď svůj email.")} <button type="button" class="text-button" id="verifyAgain">${L("Poslať odkaz znova", "Poslat odkaz znovu")}</button></div>` : ""}<div class="workspace-heading"><h2>${L("Moje inzeráty", "Moje inzeráty")}</h2><span>${total} ${L("celkom", "celkem")}</span></div><div class="manage-filters" aria-label="${L("Stav inzerátov", "Stav inzerátů")}">${[
    ["all", L("Všetky", "Všechny"), total],
    ["active", L("Aktívne", "Aktivní"), counts.active || 0],
    ["sold", L("Ukončené", "Ukončené"), counts.sold || 0],
    ...(counts.hidden ? [["hidden", L("Skryté", "Skryté"), counts.hidden]] : []),
  ]
    .map(([key, label, n]) => `<button type="button" data-account-filter="${key}" aria-pressed="${accountFilter === key}" class="${accountFilter === key ? "active" : ""}">${label} <span>${n}</span></button>`)
    .join("")}</div>${
    r.listings.length
      ? r.listings.map(managementRow).join("")
      : `<div class="account-empty"><span aria-hidden="true">↗</span><h3>${total ? L("V tomto výbere zatiaľ nič nie je.", "V tomto výběru zatím nic není.") : L("Tvoj prvý inzerát začína tu.", "Tvůj první inzerát začíná tady.")}</h3><p>${L("Pridanie je zadarmo. Stačí pár údajov a dobré fotografie.", "Přidání je zdarma. Stačí pár údajů a dobré fotografie.")}</p><a class="primary" href="/pridat/">${L("Pridať inzerát", "Přidat inzerát")}</a></div>`
  }<nav class="pager" aria-label="${L("Stránkovanie", "Stránkování")}">${pagerMarkup(r.page, r.pages)}</nav>`;
  $("#workspace").onclick = (e) => {
    const filter = e.target.closest("[data-account-filter]");
    if (filter) {
      accountFilter = filter.dataset.accountFilter;
      accountPage = 1;
      return renderAccount();
    }
    const pageButton = e.target.closest("[data-page]");
    if (pageButton && !pageButton.disabled) {
      accountPage = Number(pageButton.dataset.page);
      return renderAccount();
    }
    const b = e.target.closest("[data-manage]");
    if (b) manageListing(b.dataset.manage, Number(b.dataset.id));
  };
  if ($("#verifyAgain")) $("#verifyAgain").onclick = verifyNotice;
}
async function renderFavorites() {
  $("#accountContent").innerHTML = accountShell(null);
  const r = await api("me/favorites?page=" + accountPage);
  $("#workspace").innerHTML = `<div class="workspace-heading"><h2>${L("Obľúbené nálezy", "Oblíbené nálezy")}</h2><span>${r.total}</span></div><p class="workspace-description">${L("Ponuky aj dopyty, ktoré si chceš pozrieť neskôr.", "Nabídky i poptávky, které si chceš prohlédnout později.")}</p>${
    r.listings.length
      ? `<div class="grid account-favorites">${r.listings.map((d) => `<div>${d.status === "sold" ? `<p class="saved-closed">${L("Inzerát je ukončený", "Inzerát je ukončený")}</p>` : ""}${cardMarkup(d)}</div>`).join("")}</div>`
      : `<div class="account-empty"><span aria-hidden="true">♡</span><h3>${L("Dobrý nález si zaslúži srdiečko.", "Dobrý nález si zaslouží srdíčko.")}</h3><p>${L("Klikni na srdiečko pri inzeráte a nájdeš ho tu.", "Klikni na srdíčko u inzerátu a najdeš ho tady.")}</p><a class="outline" href="/kategorie/">${L("Prehliadať kategórie", "Procházet kategorie")} ↗</a></div>`
  }<nav class="pager" aria-label="${L("Stránkovanie", "Stránkování")}">${pagerMarkup(r.page, r.pages)}</nav>`;
  $("#workspace").onclick = (e) => {
    const b = e.target.closest("[data-page]");
    if (b && !b.disabled) {
      accountPage = Number(b.dataset.page);
      renderAccount();
    }
  };
}
function renderSettings() {
  const u = state.user;
  $("#accountContent").innerHTML = accountShell(null);
  $("#workspace").innerHTML = `<div class="workspace-heading"><h2>${L("Profil", "Profil")}</h2></div><form class="dialog-form profile-form" id="profileForm"><label for="profileName">${L("Meno", "Jméno")} *</label><input id="profileName" value="${esc(u.name)}" required minlength="2" maxlength="80" autocomplete="name"><label for="profilePhone">${L("Telefón (nepovinné)", "Telefon (nepovinné)")}</label><input id="profilePhone" type="tel" value="${esc(u.phone)}" maxlength="30" autocomplete="tel"><p class="field-hint">${L("Predvyplní sa pri novom inzeráte. Existujúce inzeráty upravíš samostatne.", "Předvyplní se u nového inzerátu. Existující inzeráty upravíš samostatně.")}</p><label class="checkbox-row"><input type="checkbox" id="profileNotifications"${u.notifications ? " checked" : ""}><span>${L("Posielať email pri novej správe", "Posílat email při nové zprávě")}</span></label><button class="primary" id="profileSave">${L("Uložiť profil", "Uložit profil")}</button><p id="profileStatus" role="status"></p></form>
<div class="workspace-heading settings-heading"><h2>Email</h2></div><form class="dialog-form profile-form" id="emailForm"><p class="field-hint">${L("Súčasný email", "Současný email")}: <strong>${esc(u.email)}</strong>. ${L("Nový email začne platiť po potvrdení odkazu, ktorý naň pošleme.", "Nový email začne platit po potvrzení odkazu, který na něj pošleme.")}</p><label for="newEmail">${L("Nový email", "Nový email")}</label><input id="newEmail" type="email" required maxlength="254" autocomplete="email"><label for="emailPassword">${L("Heslo na potvrdenie", "Heslo pro potvrzení")}</label><input id="emailPassword" type="password" required autocomplete="current-password" maxlength="128"><button class="outline" id="emailSave">${L("Zmeniť email", "Změnit email")}</button><p id="emailStatus" role="status"></p></form>
<div class="workspace-heading settings-heading"><h2>${L("Heslo", "Heslo")}</h2></div><form class="dialog-form profile-form" id="passwordForm"><label for="currentPassword">${L("Súčasné heslo", "Současné heslo")}</label><input id="currentPassword" type="password" required autocomplete="current-password" maxlength="128"><label for="newPassword">${L("Nové heslo (aspoň 12 znakov)", "Nové heslo (alespoň 12 znaků)")}</label><input id="newPassword" type="password" required minlength="12" maxlength="128" autocomplete="new-password"><label for="repeatPassword">${L("Nové heslo znovu", "Nové heslo znovu")}</label><input id="repeatPassword" type="password" required minlength="12" maxlength="128" autocomplete="new-password"><button class="outline" id="passwordSave">${L("Zmeniť heslo", "Změnit heslo")}</button><p id="passwordStatus" role="status"></p></form>
<div class="profile-privacy"><h3>${L("Súkromie a údaje", "Soukromí a údaje")}</h3><p>${L("Stiahni si kópiu svojich údajov alebo uprav súhlas s voliteľným ukladaním.", "Stáhni si kopii svých údajů nebo uprav souhlas s volitelným ukládáním.")}</p><a class="outline" href="/api/account/export" download>${L("Stiahnuť moje údaje", "Stáhnout moje údaje")}</a> <button type="button" class="outline" id="profileCookies">${L("Nastavenia cookies", "Nastavení cookies")}</button> <a href="/ochrana-udajov/">${L("Ochrana osobných údajov", "Ochrana osobních údajů")} ↗</a></div>
<div class="profile-privacy danger-zone"><h3>${L("Odstránenie účtu", "Odstranění účtu")}</h3><p>${L("Vymažú sa tvoje kontaktné údaje, inzeráty, fotografie, obľúbené a odoslané správy. Túto akciu nemožno vrátiť.", "Vymažou se tvoje kontaktní údaje, inzeráty, fotografie, oblíbené a odeslané zprávy. Tuto akci nelze vrátit.")}</p><button type="button" class="outline delete-action" id="deleteAccount">${L("Odstrániť účet", "Odstranit účet")}</button></div>`;
  $("#profileCookies").onclick = openPrivacySettings;
  $("#profileForm").onsubmit = (e) => {
    e.preventDefault();
    operation(
      $("#profileSave"),
      async () => {
        await api("profile", "PATCH", {
          name: $("#profileName").value,
          phone: $("#profilePhone").value,
          notifications: $("#profileNotifications").checked,
        });
        Object.assign(state.user, {
          name: $("#profileName").value.trim(),
          phone: $("#profilePhone").value.trim(),
          notifications: $("#profileNotifications").checked,
        });
        updateHeader();
        $("#profileStatus").textContent = L("Profil je uložený.", "Profil je uložený.");
      },
      $("#profileStatus"),
    );
  };
  $("#emailForm").onsubmit = (e) => {
    e.preventDefault();
    operation(
      $("#emailSave"),
      async () => {
        const r = await api("account/email", "POST", { email: $("#newEmail").value.trim(), password: $("#emailPassword").value });
        $("#emailStatus").textContent = r.message;
        $("#emailForm").reset();
      },
      $("#emailStatus"),
    );
  };
  $("#passwordForm").onsubmit = (e) => {
    e.preventDefault();
    if ($("#newPassword").value !== $("#repeatPassword").value) {
      $("#passwordStatus").textContent = L("Nové heslá sa nezhodujú.", "Nová hesla se neshodují.");
      return;
    }
    operation(
      $("#passwordSave"),
      async () => {
        const r = await api("account/password", "POST", {
          current: $("#currentPassword").value,
          password: $("#newPassword").value,
          repeat: $("#repeatPassword").value,
        });
        $("#passwordStatus").textContent = r.message;
        $("#passwordForm").reset();
      },
      $("#passwordStatus"),
    );
  };
  $("#deleteAccount").onclick = () => {
    openModal(
      `<form class="dialog-form" id="deleteAccountForm"><h2 id="dialogTitle">${L("Odstrániť účet?", "Odstranit účet?")}</h2><p>${L("Vymažú sa tvoje kontaktné údaje, inzeráty, fotografie, obľúbené a vlastné správy. Rozhovory druhej strany zostanú s anonymným profilom.", "Vymažou se tvoje kontaktní údaje, inzeráty, fotografie, oblíbené a vlastní zprávy. Rozhovory druhé strany zůstanou s anonymním profilem.")}</p><label for="deletePassword">${L("Heslo", "Heslo")}</label><input id="deletePassword" type="password" required autocomplete="current-password" autofocus><p id="deleteError" class="field-error" role="alert"></p><button class="outline delete-action" id="deleteConfirm">${L("Trvalo odstrániť účet", "Trvale odstranit účet")}</button></form>`,
    );
    $("#deleteAccountForm").onsubmit = (e) => {
      e.preventDefault();
      operation(
        $("#deleteConfirm"),
        async () => {
          await api("account", "DELETE", { password: $("#deletePassword").value });
          try {
            for (const k of Object.keys(localStorage))
              if (k.startsWith("bazar-listing-draft:" + state.user.id) || k.startsWith("bazar-message-draft:" + state.user.id + ":"))
                localStorage.removeItem(k);
          } catch {}
          location.assign("/");
        },
        $("#deleteError"),
      );
    };
  };
}
async function manageListing(action, id) {
  const d = ownCache.find((x) => x.id === id);
  if (!d) return;
  if (action === "edit") return editListing(d);
  if (action === "boost") return boostListing(d);
  const deleting = action === "delete",
    reactivating = d.status === "sold";
  const ok = await confirmDialog({
    title: deleting
      ? L("Odstrániť inzerát?", "Odstranit inzerát?")
      : reactivating
        ? L("Znovu zverejniť?", "Znovu zveřejnit?")
        : d.buy
          ? L("Ukončiť dopyt?", "Ukončit poptávku?")
          : L("Už je predaný?", "Už je prodaný?"),
    text:
      esc(d.title) +
      "<br>" +
      (deleting
        ? L("Inzerát aj fotografie sa natrvalo odstránia.", "Inzerát i fotografie se natrvalo odstraní.")
        : reactivating
          ? L("Inzerát sa znovu zobrazí vo vyhľadávaní.", "Inzerát se znovu zobrazí ve vyhledávání.")
          : L("Zmizne z vyhľadávania, ale zostane v tvojom účte. Neskôr ho môžeš znovu aktivovať.", "Zmizí z vyhledávání, ale zůstane ve tvém účtu. Později ho můžeš znovu aktivovat.")),
    confirm: deleting ? L("Odstrániť", "Odstranit") : L("Potvrdiť", "Potvrdit"),
    danger: deleting,
  });
  if (!ok) return;
  await operation(null, async () => {
    await api("listings/" + id, deleting ? "DELETE" : "PATCH", deleting ? {} : { status: reactivating ? "active" : "sold" });
    toast(L("Zmena je uložená.", "Změna je uložená."));
    await renderAccount();
  });
}
function editListing(d) {
  let photos = (d.uploadIds || []).map((id, i) => ({ id, src: d.photos[i] })),
    busy = false;
  const urls = [];
  openModal(
    `<form class="dialog-form" id="editListingForm"><span class="small-kicker">${L("ÚPRAVA INZERÁTU", "ÚPRAVA INZERÁTU")}</span><h2 id="dialogTitle">${L("Doladiť ponuku.", "Doladit nabídku.")}</h2><label>${L("Názov", "Název")}<input id="editTitle" value="${esc(d.title)}" required minlength="5" maxlength="140"></label><label>Popis<textarea id="editDescription" required minlength="15" maxlength="10000" rows="6">${esc(d.desc)}</textarea></label><div class="form-row"><label>${L("Typ inzerátu", "Typ inzerátu")}<select id="editType"><option value="sell"${!d.buy ? " selected" : ""}>${L("Predám", "Prodám")}</option><option value="buy"${d.buy ? " selected" : ""}>${L("Kúpim", "Koupím")}</option></select></label><label>${L("Stav predmetu", "Stav předmětu")}<select id="editCondition"><option value="Používané"${d.state === "Používané" ? " selected" : ""}>${L("Používané", "Použité")}</option><option value="Nové"${d.state === "Nové" ? " selected" : ""}>${L("Nové", "Nové")}</option></select></label></div><div class="form-row"><label>${L("Cena", "Cena")} (${d.country === "cz" ? "Kč" : "€"})<input id="editPrice" type="number" min="0" max="100000000" step="any" required value="${d.price}"></label><label>${L("Kategória", "Kategorie")}<select id="editCategory">${CATEGORIES.map((c) => `<option value="${esc(c[0])}"${d.cat === c[0] ? " selected" : ""}>${esc(catName(c[0]))}</option>`).join("")}</select></label></div><div class="form-row"><label>${L("Mesto", "Město")}<input id="editCity" required minlength="2" maxlength="100" value="${esc(d.city)}" list="editCities"><datalist id="editCities"></datalist></label><label>${L("Telefón (nepovinné)", "Telefon (nepovinné)")}<input id="editPhone" type="tel" maxlength="30" value="${esc(d.phone || "")}"></label></div><fieldset class="edit-photo-field"><legend>${L("Fotografie", "Fotografie")}</legend><p class="field-hint">${L("Najviac 8 fotografií. Prvá je titulná. Zmeny sa použijú až po uložení.", "Nejvýše 8 fotografií. První je titulní. Změny se použijí až po uložení.")}</p><div id="editPhotoGrid" class="edit-photo-grid"></div><label class="outline edit-photo-add">＋ ${L("Pridať fotografie", "Přidat fotografie")}<input id="editPhotos" type="file" accept="image/jpeg,image/png,image/webp" multiple></label></fieldset><p id="editStatus" class="field-error" role="alert"></p><div class="edit-form-actions"><button class="outline" type="button" id="editCancel">${L("Zrušiť", "Zrušit")}</button><button class="primary" id="editSubmit">${L("Uložiť zmeny", "Uložit změny")}</button></div></form>`,
  );
  if (lang === d.country) fillCityList($("#editCities"));
  function drawPhotos() {
    const host = $("#editPhotoGrid");
    host.innerHTML = photos
      .map(
        (p, i) =>
          `<div class="edit-photo"><img src="${esc(p.src)}" alt="${L("Fotografia", "Fotografie")} ${i + 1}">${i === 0 ? `<span class="edit-photo-cover">${L("Titulná", "Titulní")}</span>` : ""}<div><button type="button" data-photo-up="${i}" ${i === 0 ? "disabled" : ""} aria-label="${L("Posunúť dopredu", "Posunout dopředu")}">←</button><button type="button" data-photo-down="${i}" ${i === photos.length - 1 ? "disabled" : ""} aria-label="${L("Posunúť dozadu", "Posunout dozadu")}">→</button><button type="button" data-photo-remove="${i}" class="delete-action" aria-label="${L("Odstrániť fotografiu", "Odstranit fotografii")}">×</button></div></div>`,
      )
      .join("");
    host.onclick = (e) => {
      if (busy) return;
      const b = e.target.closest("[data-photo-up],[data-photo-down],[data-photo-remove]");
      if (!b) return;
      if (b.dataset.photoRemove !== undefined) photos.splice(Number(b.dataset.photoRemove), 1);
      else {
        const i = Number(b.dataset.photoUp ?? b.dataset.photoDown),
          j = i + (b.dataset.photoUp !== undefined ? -1 : 1);
        if (j >= 0 && j < photos.length) [photos[i], photos[j]] = [photos[j], photos[i]];
      }
      drawPhotos();
    };
    $("#editPhotos").disabled = busy || photos.length >= 8;
  }
  drawPhotos();
  $("#editCancel").onclick = closeModal;
  const cancelWhileSaving = (e) => busy && e.preventDefault();
  $("#modal").addEventListener("cancel", cancelWhileSaving);
  $("#modal").addEventListener(
    "close",
    () => {
      urls.forEach((src) => URL.revokeObjectURL(src));
      $("#modal").removeEventListener("cancel", cancelWhileSaving);
    },
    { once: true },
  );
  $("#editPhotos").onchange = async (e) => {
    if (busy) return;
    const files = [...(e.target.files || [])];
    e.target.value = "";
    if (photos.length + files.length > 8) return ($("#editStatus").textContent = L("Najviac 8 fotografií.", "Nejvýše 8 fotografií."));
    $("#editStatus").textContent = "";
    try {
      for (const file of files) {
        const blob = await preparePhoto(file),
          src = URL.createObjectURL(blob);
        urls.push(src);
        photos.push({ src, blob });
      }
    } catch (err) {
      $("#editStatus").textContent = err.message;
    }
    drawPhotos();
  };
  $("#editListingForm").onsubmit = (e) => {
    e.preventDefault();
    operation(
      $("#editSubmit"),
      async () => {
        if ($("#editType").value === "sell" && !photos.length)
          throw Error(L("Pridaj aspoň jednu fotografiu.", "Přidej alespoň jednu fotografii."));
        busy = true;
        $("#editCancel").disabled = true;
        try {
          const ids = [];
          for (const p of photos) {
            if (!p.id) p.id = (await api("uploads", "POST", p.blob)).id;
            ids.push(p.id);
          }
          await api("listings/" + d.id, "PATCH", {
            title: $("#editTitle").value,
            desc: $("#editDescription").value,
            price: $("#editPrice").value === "" ? null : Number($("#editPrice").value),
            cat: $("#editCategory").value,
            state: $("#editCondition").value,
            buy: $("#editType").value === "buy",
            city: $("#editCity").value,
            phone: $("#editPhone").value,
            uploadIds: ids,
          });
          busy = false;
          closeModal();
          toast(L("Inzerát je upravený.", "Inzerát je upravený."));
          await renderAccount();
        } finally {
          busy = false;
          if ($("#modal").open && $("#editCancel")) {
            $("#editCancel").disabled = false;
            drawPhotos();
          }
        }
      },
      $("#editStatus"),
    );
  };
}
function boostListing(d) {
  openModal(
    `<form class="dialog-form" id="boostForm"><span class="small-kicker">↑ BOOST</span><h2 id="dialogTitle">${L("Daj ponuke náskok.", "Dej nabídce náskok.")}</h2><p>${esc(d.title)}</p><p class="modal-muted">${L("Zvýraznený inzerát je vyššie vo výsledkoch a môže sa zobraziť vo výbere na úvodnej stránke.", "Zvýrazněný inzerát je výše ve výsledcích a může se zobrazit ve výběru na úvodní stránce.")}</p>${d.boost ? `<div class="notice">${L("Aktívny do", "Aktivní do")} ${fmtDate(d.boostUntil)}</div>` : ""}<label for="boostDuration">${L("Dĺžka zvýraznenia", "Délka zvýraznění")}</label><select id="boostDuration"><option value="3">3 ${L("dni", "dny")}</option><option value="7" selected>7 ${L("dní", "dní")}</option><option value="14">14 ${L("dní", "dní")}</option></select><div class="notice">${L("Zvýraznenie je momentálne bezplatné.", "Zvýraznění je momentálně zdarma.")}</div><p id="boostError" class="field-error" role="alert"></p><button class="primary" id="boostSubmit">${d.boost ? L("Predĺžiť Boost", "Prodloužit Boost") : L("Aktivovať Boost", "Aktivovat Boost")}</button>${d.boost ? `<button type="button" class="outline" id="boostOff">${L("Vypnúť Boost", "Vypnout Boost")}</button>` : ""}</form>`,
  );
  const send = (body, button) =>
    operation(
      button,
      async () => {
        await api("listings/" + d.id + "/boost", "POST", body);
        closeModal();
        toast(body.off ? L("Boost je vypnutý.", "Boost je vypnutý.") : L("Boost je aktívny.", "Boost je aktivní."));
        await renderAccount();
      },
      $("#boostError"),
    );
  $("#boostForm").onsubmit = (e) => {
    e.preventDefault();
    send({ days: Number($("#boostDuration").value) }, $("#boostSubmit"));
  };
  if ($("#boostOff")) $("#boostOff").onclick = () => send({ off: true }, $("#boostOff"));
}
async function renderAccount() {
  try {
    if (accountTab === "inzeraty") await renderOwn();
    else if (accountTab === "oblubene") await renderFavorites();
    else renderSettings();
    $("#accountLogout").onclick = () => operation($("#accountLogout"), logout);
  } catch (e) {
    $("#accountContent").innerHTML = `<div class="empty"><h2>${L("Účet sa nepodarilo načítať.", "Účet se nepodařilo načíst.")}</h2><p>${esc(e.message)}</p><button type="button" class="primary" id="accountRetry">${L("Skúsiť znova", "Zkusit znovu")}</button></div>`;
    $("#accountRetry").onclick = () => location.reload();
  }
}
window.pageInit = async function () {
  if (!state.user) {
    $("#accountContent").innerHTML = `<div class="account-guest"><span class="small-kicker">${L("TVOJ PRIESTOR", "TVŮJ PROSTOR")}</span><h1>${L("Všetko tvoje.<br>Na jednom mieste.", "Všechno tvoje.<br>Na jednom místě.")}</h1><p>${L("Spravuj inzeráty, ulož si dobré nálezy a maj pod kontrolou svoje kontakty.", "Spravuj inzeráty, ulož si dobré nálezy a měj pod kontrolou své kontakty.")}</p><a class="primary" href="${loginUrl()}">${L("Prihlásiť sa", "Přihlásit se")} ↗</a> <a class="outline" href="/registracia/">${L("Vytvoriť účet", "Vytvořit účet")}</a></div>`;
    return;
  }
  await renderAccount();
};
