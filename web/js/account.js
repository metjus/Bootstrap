"use strict";
const accountTab = ["inzeraty", "oblubene", "nastavenia"].includes(params.get("sekcia"))
  ? params.get("sekcia")
  : "inzeraty";
let accountFilter = "all",
  accountPage = 1,
  ownCache = [];
function statusLabel(d) {
  if (d.status === "hidden") return '<span class="status-closed">Skryté moderátorom</span>';
  if (d.status === "expired") return '<span class="status-expired">Vypršal</span>';
  if (d.status === "sold") return `<span class="status-closed">✓ ${d.buy ? "Ukončený dopyt" : "Predané"}</span>`;
  return "<span>Aktívny</span>";
}
function managementRow(d) {
  const closed = d.status === "sold",
    hidden = d.status === "hidden",
    daysLeft = Math.ceil((d.expires - Date.now()) / 86400000);
  return `<article class="manage-row"><a class="manage-photo" href="/inzerat/?id=${d.id}"><img src="${esc(d.thumb || d.photo)}" alt="" loading="lazy"></a><div class="manage-info"><div class="manage-status">${statusLabel(d)}${d.boost ? '<span class="status-boost">TOP</span>' : ""}<small>${d.buy ? "KÚPIM" : "PREDÁM"} · ${esc(d.subName)}</small></div><h3><a href="/inzerat/?id=${d.id}">${esc(d.title)}</a></h3><p>${esc(d.city)} · ${icon("eye", "icon")} ${d.viewCount ?? 0} · pridané ${fmtDate(d.createdAt)}</p><p>${d.status === "active" ? `Platí ešte ${daysLeft} ${plural(daysLeft, "deň", "dni", "dní")} (do ${fmtDate(d.expires)})` : d.status === "expired" ? `Vypršal ${fmtDate(d.expires)}` : ""}${d.boost ? ` · TOP do ${fmtDate(d.boostUntil)}` : ""}</p><div>${priceTag(d)}</div>${hidden && d.moderationNote ? `<p class="field-error">Dôvod: ${esc(d.moderationNote)}</p>` : ""}</div><div class="manage-actions">${d.renewable ? `<button type="button" class="btn btn-tag" data-manage="renew" data-id="${d.id}">Predĺžiť o 60 dní</button>` : ""}${hidden ? "" : `<button type="button" class="outline" data-manage="edit" data-id="${d.id}">Upraviť</button>${closed || d.status === "expired" ? "" : `<button type="button" class="outline" data-manage="boost" data-id="${d.id}">${d.boost ? "Spravovať TOP" : "Zvýrazniť (TOP)"}</button>`}${d.status === "expired" ? "" : `<button type="button" class="text-button" data-manage="status" data-id="${d.id}">${closed ? "Znovu aktivovať" : d.buy ? "Ukončiť dopyt" : "Označiť ako predané"}</button>`}`}<button type="button" class="text-button delete-action" data-manage="delete" data-id="${d.id}">Odstrániť</button></div></article>`;
}
function accountShell(counts) {
  const u = state.user,
    total = Object.values(counts || {}).reduce((a, b) => a + b, 0);
  return `<div class="account-heading"><div><span class="small-kicker">MÔJ ÚČET</span><h1>Ahoj, ${esc(u.name)}<span>.</span></h1><p>Tvoje ponuky, dobré nálezy a nastavenia.</p></div><a class="primary" href="/pridat/" id="accountAdd">＋ Pridať inzerát</a></div><div class="account-layout"><aside class="account-sidebar"><div class="profile-summary"><span class="profile-avatar" aria-hidden="true">${esc(u.name.trim().charAt(0).toUpperCase())}</span><strong>${esc(u.name)}</strong><span class="profile-email">${esc(u.email)}</span><small>${u.verified ? "✓ Email overený" : "Email čaká na overenie"}</small></div><nav aria-label="Menu účtu">${[
    ["inzeraty", "Moje inzeráty", counts ? total : ""],
    ["oblubene", "Obľúbené", state.favorites.size],
    ["nastavenia", "Nastavenia", ""],
  ]
    .map(
      ([key, label, count]) =>
        `<a href="/ucet/?sekcia=${key}"${accountTab === key ? ' class="active" aria-current="page"' : ""}>${label} <span>${count}</span></a>`,
    )
    .join(
      "",
    )}${u.verified ? `<a href="/spravy/">Správy${state.unread ? ` <span>${state.unread}</span>` : " ↗"}</a>` : ""}${u.admin ? '<a href="/administracia/">Administrácia ↗</a>' : ""}</nav><button type="button" class="text-button" id="accountLogout">Odhlásiť sa ↗</button></aside><section class="account-workspace" id="workspace"><p role="status" class="loading-line">Načítavam…</p></section></div>`;
}
async function renderOwn() {
  const r = await api(`me/listings?status=${accountFilter === "all" ? "" : accountFilter}&page=${accountPage}`),
    counts = r.counts,
    total = (counts.active || 0) + (counts.expired || 0) + (counts.sold || 0) + (counts.hidden || 0);
  ownCache = r.listings;
  $("#accountContent").innerHTML = accountShell(counts);
  $("#workspace").innerHTML =
    `${!state.user.verified ? `<div class="notice">Na pridávanie inzerátov potvrď svoj email. <button type="button" class="text-button" id="verifyAgain">Poslať odkaz znova</button></div>` : ""}<div class="workspace-heading"><h2>Moje inzeráty</h2><span>${total} celkom</span></div><div class="manage-filters" aria-label="Stav inzerátov">${[
      ["all", "Všetky", total],
      ["active", "Aktívne", counts.active || 0],
      ...(counts.expired ? [["expired", "Vypršané", counts.expired]] : []),
      ["sold", "Ukončené", counts.sold || 0],
      ...(counts.hidden ? [["hidden", "Skryté", counts.hidden]] : []),
    ]
      .map(
        ([key, label, n]) =>
          `<button type="button" data-account-filter="${key}" aria-pressed="${accountFilter === key}" class="${accountFilter === key ? "active" : ""}">${label} <span>${n}</span></button>`,
      )
      .join("")}</div>${
      r.listings.length
        ? r.listings.map(managementRow).join("")
        : `<div class="account-empty"><span aria-hidden="true">↗</span><h3>${total ? "V tomto výbere zatiaľ nič nie je." : "Tvoj prvý inzerát začína tu."}</h3><p>Pridanie je zadarmo. Stačí pár údajov a dobré fotografie.</p><a class="primary" href="/pridat/">Pridať inzerát</a></div>`
    }<nav class="pager" aria-label="Stránkovanie">${pagerMarkup(r.page, r.pages)}</nav>`;
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
  $("#workspace").innerHTML =
    `<div class="workspace-heading"><h2>Obľúbené nálezy</h2><span>${r.total}</span></div><p class="workspace-description">Ponuky aj dopyty, ktoré si chceš pozrieť neskôr.</p>${
      r.listings.length
        ? `<div class="grid account-favorites">${r.listings.map((d) => `<div>${d.status === "sold" ? `<p class="saved-closed">Inzerát je ukončený</p>` : ""}${cardMarkup(d)}</div>`).join("")}</div>`
        : `<div class="account-empty"><span aria-hidden="true">♡</span><h3>Dobrý nález si zaslúži srdiečko.</h3><p>Klikni na srdiečko pri inzeráte a nájdeš ho tu.</p><a class="outline" href="/kategorie/">Prehliadať kategórie ↗</a></div>`
    }<nav class="pager" aria-label="Stránkovanie">${pagerMarkup(r.page, r.pages)}</nav>`;
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
  $("#workspace").innerHTML =
    `<div class="workspace-heading"><h2>Profil</h2></div><form class="dialog-form profile-form" id="profileForm"><label for="profileName">Meno *</label><input id="profileName" value="${esc(u.name)}" required minlength="2" maxlength="80" autocomplete="name"><label for="profilePhone">Telefón (nepovinné)</label><input id="profilePhone" type="tel" value="${esc(u.phone)}" maxlength="30" autocomplete="tel"><p class="field-hint">Predvyplní sa pri novom inzeráte. Existujúce inzeráty upravíš samostatne.</p><label class="checkbox-row"><input type="checkbox" id="profileNotifications"${u.notifications ? " checked" : ""}><span>Posielať email pri novej správe</span></label><button class="primary" id="profileSave">Uložiť profil</button><p id="profileStatus" role="status"></p></form>
<div class="workspace-heading settings-heading"><h2>Email</h2></div><form class="dialog-form profile-form" id="emailForm"><p class="field-hint">Súčasný email: <strong>${esc(u.email)}</strong>. Nový email začne platiť po potvrdení odkazu, ktorý naň pošleme.</p><label for="newEmail">Nový email</label><input id="newEmail" type="email" required maxlength="254" autocomplete="email"><label for="emailPassword">Heslo na potvrdenie</label><input id="emailPassword" type="password" required autocomplete="current-password" maxlength="128"><button class="outline" id="emailSave">Zmeniť email</button><p id="emailStatus" role="status"></p></form>
<div class="workspace-heading settings-heading"><h2>Heslo</h2></div><form class="dialog-form profile-form" id="passwordForm"><label for="currentPassword">Súčasné heslo</label><input id="currentPassword" type="password" required autocomplete="current-password" maxlength="128"><label for="newPassword">Nové heslo (aspoň 12 znakov)</label><input id="newPassword" type="password" required minlength="12" maxlength="128" autocomplete="new-password"><label for="repeatPassword">Nové heslo znovu</label><input id="repeatPassword" type="password" required minlength="12" maxlength="128" autocomplete="new-password"><button class="outline" id="passwordSave">Zmeniť heslo</button><p id="passwordStatus" role="status"></p></form>
<div class="profile-privacy"><h3>Súkromie a údaje</h3><p>Stiahni si kópiu svojich údajov alebo uprav súhlas s voliteľným ukladaním.</p><a class="outline" href="/api/account/export" download>Stiahnuť moje údaje</a> <button type="button" class="outline" id="profileCookies">Nastavenia cookies</button> <a href="/ochrana-udajov/">Ochrana osobných údajov ↗</a></div>
<div class="profile-privacy danger-zone"><h3>Odstránenie účtu</h3><p>Vymažú sa tvoje kontaktné údaje, inzeráty, fotografie, obľúbené a odoslané správy. Túto akciu nemožno vrátiť.</p><button type="button" class="outline delete-action" id="deleteAccount">Odstrániť účet</button></div>`;
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
        $("#profileStatus").textContent = "Profil je uložený.";
      },
      $("#profileStatus"),
    );
  };
  $("#emailForm").onsubmit = (e) => {
    e.preventDefault();
    operation(
      $("#emailSave"),
      async () => {
        const r = await api("account/email", "POST", {
          email: $("#newEmail").value.trim(),
          password: $("#emailPassword").value,
        });
        $("#emailStatus").textContent = r.message;
        $("#emailForm").reset();
      },
      $("#emailStatus"),
    );
  };
  $("#passwordForm").onsubmit = (e) => {
    e.preventDefault();
    if ($("#newPassword").value !== $("#repeatPassword").value) {
      $("#passwordStatus").textContent = "Nové heslá sa nezhodujú.";
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
      `<form class="dialog-form" id="deleteAccountForm"><h2 id="dialogTitle">Odstrániť účet?</h2><p>Vymažú sa tvoje kontaktné údaje, inzeráty, fotografie, obľúbené a vlastné správy. Rozhovory druhej strany zostanú s anonymným profilom.</p><label for="deletePassword">Heslo</label><input id="deletePassword" type="password" required autocomplete="current-password" autofocus><p id="deleteError" class="field-error" role="alert"></p><button class="outline delete-action" id="deleteConfirm">Trvalo odstrániť účet</button></form>`,
    );
    $("#deleteAccountForm").onsubmit = (e) => {
      e.preventDefault();
      operation(
        $("#deleteConfirm"),
        async () => {
          await api("account", "DELETE", { password: $("#deletePassword").value });
          try {
            for (const k of Object.keys(localStorage))
              if (
                k.startsWith("bazar-listing-draft:" + state.user.id) ||
                k.startsWith("bazar-message-draft:" + state.user.id + ":")
              )
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
  if (action === "renew")
    return operation(null, async () => {
      await api("listings/" + id + "/renew", "POST", {});
      toast("Inzerát je predĺžený o 60 dní.");
      await renderAccount();
    });
  const deleting = action === "delete",
    reactivating = d.status === "sold";
  const ok = await confirmDialog({
    title: deleting
      ? "Odstrániť inzerát?"
      : reactivating
        ? "Znovu zverejniť?"
        : d.buy
          ? "Ukončiť dopyt?"
          : "Už je predaný?",
    text:
      esc(d.title) +
      "<br>" +
      (deleting
        ? "Inzerát aj fotografie sa natrvalo odstránia."
        : reactivating
          ? "Inzerát sa znovu zobrazí vo vyhľadávaní."
          : "Zmizne z vyhľadávania, ale zostane v tvojom účte. Neskôr ho môžeš znovu aktivovať."),
    confirm: deleting ? "Odstrániť" : "Potvrdiť",
    danger: deleting,
  });
  if (!ok) return;
  await operation(null, async () => {
    await api(
      "listings/" + id,
      deleting ? "DELETE" : "PATCH",
      deleting ? {} : { status: reactivating ? "active" : "sold" },
    );
    toast("Zmena je uložená.");
    await renderAccount();
  });
}
function editListing(d) {
  let photos = (d.uploadIds || []).map((id, i) => ({ id, src: d.photos[i] })),
    busy = false;
  const urls = [];
  openModal(
    `<form class="dialog-form" id="editListingForm"><span class="kicker">Úprava inzerátu</span><h2 id="dialogTitle">Doladiť ponuku</h2><label>Názov<input id="editTitle" value="${esc(d.title)}" required minlength="5" maxlength="140"></label><label>Popis<textarea id="editDescription" required minlength="15" maxlength="10000" rows="6">${esc(d.desc)}</textarea></label><div class="form-row"><label>Typ inzerátu<select id="editType"><option value="sell"${!d.buy ? " selected" : ""}>Predám</option><option value="buy"${d.buy ? " selected" : ""}>Kúpim</option></select></label><label>Stav<select id="editCondition"><option value="Používané"${d.state === "Používané" ? " selected" : ""}>Používané</option><option value="Nové"${d.state === "Nové" ? " selected" : ""}>Nové</option></select></label></div><div class="form-row"><label>Kategória<select id="editCategory">${CATALOG.map((c) => `<option value="${c.slug}"${d.cat === c.slug ? " selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label><label>Podkategória<select id="editSub"></select></label></div><div class="form-row"><label>Cena<select id="editPriceType"><option value="fixed"${d.priceType === "fixed" ? " selected" : ""}>Pevná cena</option><option value="free"${d.priceType === "free" ? " selected" : ""}>Zadarmo</option><option value="negotiable"${d.priceType === "negotiable" ? " selected" : ""}>Dohodou</option><option value="text"${d.priceType === "text" ? " selected" : ""}>V texte</option></select></label><label>Suma (€)<input id="editPrice" type="number" min="0" max="100000000" step="any" value="${d.priceType === "fixed" ? d.price : ""}"></label></div><div class="form-row"><label>PSČ<input id="editZip" required inputmode="numeric" maxlength="6" value="${esc(formatZip(d.zip))}"></label><label>Obec<input id="editCity" required minlength="2" maxlength="100" value="${esc(d.city)}" list="placeList"></label></div><label>Telefón (nepovinné)<input id="editPhone" type="tel" maxlength="30" value="${esc(d.phone || "")}"></label><fieldset class="edit-photo-field"><legend>Fotografie</legend><p class="field-hint">Najviac 8 fotografií. Prvá je titulná. Zmeny sa použijú až po uložení.</p><div id="editPhotoGrid" class="edit-photo-grid"></div><label class="outline edit-photo-add">＋ Pridať fotografie<input id="editPhotos" type="file" accept="image/jpeg,image/png,image/webp" multiple></label></fieldset><p id="editStatus" class="field-error" role="alert"></p><div class="edit-form-actions"><button class="outline" type="button" id="editCancel">Zrušiť</button><button class="primary" id="editSubmit">Uložiť zmeny</button></div></form>`,
  );
  const fillSubs = () => {
    const c = category($("#editCategory").value);
    $("#editSub").innerHTML = (c?.subs || [])
      .map((x) => `<option value="${x.slug}"${x.slug === d.sub ? " selected" : ""}>${esc(x.name)}</option>`)
      .join("");
  };
  fillSubs();
  $("#editCategory").onchange = fillSubs;
  const syncPrice = () => ($("#editPrice").closest("label").hidden = $("#editPriceType").value !== "fixed");
  syncPrice();
  $("#editPriceType").onchange = syncPrice;
  function drawPhotos() {
    const host = $("#editPhotoGrid");
    host.innerHTML = photos
      .map(
        (p, i) =>
          `<div class="edit-photo"><img src="${esc(p.src)}" alt="Fotografia ${i + 1}">${i === 0 ? `<span class="edit-photo-cover">Titulná</span>` : ""}<div><button type="button" data-photo-up="${i}" ${i === 0 ? "disabled" : ""} aria-label="Posunúť dopredu">←</button><button type="button" data-photo-down="${i}" ${i === photos.length - 1 ? "disabled" : ""} aria-label="Posunúť dozadu">→</button><button type="button" data-photo-remove="${i}" class="delete-action" aria-label="Odstrániť fotografiu">×</button></div></div>`,
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
    if (photos.length + files.length > 8) return ($("#editStatus").textContent = "Najviac 8 fotografií.");
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
        if ($("#editType").value === "sell" && !photos.length) throw Error("Pridaj aspoň jednu fotografiu.");
        busy = true;
        $("#editCancel").disabled = true;
        try {
          const ids = [];
          for (const p of photos) {
            if (!p.id) p.id = await uploadPhoto(p.blob);
            ids.push(p.id);
          }
          await api("listings/" + d.id, "PATCH", {
            title: $("#editTitle").value,
            desc: $("#editDescription").value,
            priceType: $("#editPriceType").value,
            price:
              $("#editPriceType").value === "fixed"
                ? $("#editPrice").value === ""
                  ? null
                  : Number($("#editPrice").value)
                : 0,
            cat: $("#editCategory").value,
            sub: $("#editSub").value,
            zip: $("#editZip").value,
            state: $("#editCondition").value,
            buy: $("#editType").value === "buy",
            city: $("#editCity").value,
            phone: $("#editPhone").value,
            uploadIds: ids,
          });
          busy = false;
          closeModal();
          toast("Inzerát je upravený.");
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
    `<form class="dialog-form" id="boostForm"><span class="small-kicker">↑ BOOST</span><h2 id="dialogTitle">Daj ponuke náskok.</h2><p>${esc(d.title)}</p><p class="modal-muted">Zvýraznený inzerát je vyššie vo výsledkoch a môže sa zobraziť vo výbere na úvodnej stránke.</p>${d.boost ? `<div class="notice">Aktívny do ${fmtDate(d.boostUntil)}</div>` : ""}<label for="boostDuration">Dĺžka zvýraznenia</label><select id="boostDuration"><option value="3">3 dni</option><option value="7" selected>7 dní</option><option value="14">14 dní</option></select><div class="notice">Zvýraznenie je momentálne bezplatné.</div><p id="boostError" class="field-error" role="alert"></p><button class="primary" id="boostSubmit">${d.boost ? "Predĺžiť Boost" : "Aktivovať Boost"}</button>${d.boost ? `<button type="button" class="outline" id="boostOff">Vypnúť Boost</button>` : ""}</form>`,
  );
  const send = (body, button) =>
    operation(
      button,
      async () => {
        await api("listings/" + d.id + "/boost", "POST", body);
        closeModal();
        toast(body.off ? "Boost je vypnutý." : "Boost je aktívny.");
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
    $("#accountContent").innerHTML =
      `<div class="empty"><h2>Účet sa nepodarilo načítať.</h2><p>${esc(e.message)}</p><button type="button" class="primary" id="accountRetry">Skúsiť znova</button></div>`;
    $("#accountRetry").onclick = () => location.reload();
  }
}
window.pageInit = async function () {
  if (!state.user) {
    $("#accountContent").innerHTML =
      `<div class="account-guest"><span class="small-kicker">TVOJ PRIESTOR</span><h1>Všetko tvoje.<br>Na jednom mieste.</h1><p>Spravuj inzeráty, ulož si dobré nálezy a maj pod kontrolou svoje kontakty.</p><a class="primary" href="${loginUrl()}">Prihlásiť sa ↗</a> <a class="outline" href="/registracia/">Vytvoriť účet</a></div>`;
    return;
  }
  await renderAccount();
};
