"use strict";
// Administration: overview, reports, listings, users and the audit log. Admin UI is Slovak only.
const adminTabs = [
  ["prehlad", "Prehľad"],
  ["hlasenia", "Hlásenia"],
  ["inzeraty", "Inzeráty"],
  ["pouzivatelia", "Používatelia"],
  ["zaznam", "Záznam akcií"],
];
const adminState = {
  tab: adminTabs.some((t) => t[0] === params.get("sekcia")) ? params.get("sekcia") : "prehlad",
  page: Math.max(1, Number(params.get("strana")) || 1),
  q: params.get("q") || "",
  filter: params.get("filter") || "",
  owner: params.get("owner") || "",
};
const listingStatus = { active: "Aktívny", sold: "Ukončený", hidden: "Skrytý", deleted: "Odstránený" };
const bytes = (n) => (n > 1e9 ? (n / 1e9).toFixed(2) + " GB" : n > 1e6 ? (n / 1e6).toFixed(1) + " MB" : Math.round(n / 1e3) + " kB");
function adminUrl(changes = {}) {
  const s = { ...adminState, ...changes },
    q = new URLSearchParams({ sekcia: s.tab });
  if (s.page > 1) q.set("strana", s.page);
  if (s.q) q.set("q", s.q);
  if (s.filter) q.set("filter", s.filter);
  if (s.owner) q.set("owner", s.owner);
  return "/administracia/?" + q;
}
function go(changes) {
  Object.assign(adminState, changes);
  history.pushState(null, "", adminUrl());
  renderAdmin();
}
function adminShell(body, counts = {}) {
  return `<div class="account-heading"><div><span class="small-kicker">ADMINISTRÁCIA</span><h1>Správa bazára<span>.</span></h1><p>Moderácia obsahu, používatelia a prehľad prevádzky.</p></div><a class="outline" href="/ucet/">← Môj účet</a></div><nav class="admin-tabs" aria-label="Sekcie administrácie">${adminTabs
    .map(
      ([key, label]) =>
        `<a href="${adminUrl({ tab: key, page: 1, q: "", filter: "", owner: "" })}" data-tab="${key}"${adminState.tab === key ? ' class="active" aria-current="page"' : ""}>${label}${counts[key] ? ` <span>${counts[key]}</span>` : ""}</a>`,
    )
    .join("")}</nav><div id="adminBody">${body}</div>`;
}
function searchBar(placeholder, filters = []) {
  return `<form class="admin-search" id="adminSearch"><input type="search" id="adminQuery" value="${esc(adminState.q)}" placeholder="${esc(placeholder)}" maxlength="200" aria-label="Hľadať">${
    filters.length
      ? `<select id="adminFilter" aria-label="Filter">${filters.map(([v, l]) => `<option value="${v}"${adminState.filter === v ? " selected" : ""}>${l}</option>`).join("")}</select>`
      : ""
  }<button class="primary" type="submit">Hľadať</button></form>${adminState.owner ? `<p class="notice">Filtrované podľa používateľa. <a href="${adminUrl({ owner: "", page: 1 })}">Zrušiť filter</a></p>` : ""}`;
}
const pager = (r) => `<nav class="pager" aria-label="Stránkovanie">${pagerMarkup(r.page, r.pages)}</nav>`;
async function overview() {
  const r = await api("admin/stats"),
    s = r.stats;
  const tile = (label, value, href) =>
    `<${href ? `a href="${href}"` : "div"} class="admin-stat"><span>${label}</span><strong>${value}</strong></${href ? "a" : "div"}>`;
  return {
    counts: { hlasenia: s.openReports },
    body: `${!r.email ? '<div class="notice">Odosielanie emailov nie je nakonfigurované (RESEND_API_KEY, MAIL_FROM, APP_URL). Registrácia a obnova hesla nefungujú.</div>' : ""}<div class="admin-stats">${[
      tile("Otvorené hlásenia", s.openReports, adminUrl({ tab: "hlasenia", filter: "open", page: 1 })),
      tile("Aktívne inzeráty", s.active, adminUrl({ tab: "inzeraty", filter: "active", page: 1 })),
      tile("Nové inzeráty (7 dní)", s.listingsWeek),
      tile("Skryté inzeráty", s.hidden, adminUrl({ tab: "inzeraty", filter: "hidden", page: 1 })),
      tile("Ukončené inzeráty", s.sold),
      tile("Zvýraznené (Boost)", s.boosted),
      tile("Používatelia", s.users, adminUrl({ tab: "pouzivatelia", page: 1 })),
      tile("Noví používatelia (7 dní)", s.usersWeek),
      tile("Overení používatelia", s.verified),
      tile("Zablokovaní", s.banned, adminUrl({ tab: "pouzivatelia", filter: "banned", page: 1 })),
      tile("Správy (7 dní)", s.messagesWeek),
      tile("Fotografie", s.photos + " · " + bytes(s.storageBytes)),
    ].join("")}</div><div class="workspace-heading"><h2>Aktívne inzeráty podľa kategórií</h2></div><div class="admin-bars">${
      r.categories.length
        ? r.categories
            .map(
              (c) =>
                `<div><span>${esc(c.category)}</span><span class="admin-bar"><span style="width:${Math.max(4, Math.round((c.n / r.categories[0].n) * 100))}%"></span></span><strong>${c.n}</strong></div>`,
            )
            .join("")
        : "<p>Zatiaľ žiadne aktívne inzeráty.</p>"
    }</div><p class="modal-muted">Verzia ${esc(r.version)}</p>`,
  };
}
async function reports() {
  const filter = adminState.filter || "open",
    r = await api(`admin/reports?status=${filter === "all" ? "" : filter}&page=${adminState.page}`);
  return {
    body: `<div class="manage-filters">${[
      ["open", "Otvorené"],
      ["resolved", "Vybavené"],
      ["all", "Všetky"],
    ]
      .map(([v, l]) => `<button type="button" data-filter="${v}" class="${filter === v ? "active" : ""}" aria-pressed="${filter === v}">${l}</button>`)
      .join("")}</div><p class="results-meta">${r.total} hlásení</p>${
      r.reports.length
        ? r.reports
            .map(
              (x) =>
                `<article class="manage-row admin-row"><div class="manage-info"><div class="manage-status"><span class="${x.status === "open" ? "status-boost" : "status-closed"}">${x.status === "open" ? "Otvorené" : "Vybavené"}</span><small>${fmtDateTime(x.created)}</small></div><h3>${esc(x.reason)}</h3><p class="admin-text">${esc(x.details)}</p><p>Oznamovateľ: ${esc(x.reporter_name || "anonym")} · <a href="mailto:${esc(x.contact)}">${esc(x.contact)}</a></p>${x.listing_id ? `<p>Inzerát: <a href="/inzerat/?id=${x.listing_id}" target="_blank" rel="noopener">${esc(x.listing_title || "#" + x.listing_id)} ↗</a> · ${listingStatus[x.listing_status] || "—"} · ${esc(x.owner_name || "")} &lt;${esc(x.owner_email || "")}&gt; · hlásení k inzerátu: ${x.listing_reports}</p>` : "<p>Bez prepojeného inzerátu.</p>"}${x.resolution ? `<p class="modal-muted">Výsledok: ${esc(x.resolution)}${x.resolved ? " · " + fmtDateTime(x.resolved) : ""}</p>` : ""}</div><div class="manage-actions">${
                  x.status === "open"
                    ? `${x.listing_id && ["active", "sold"].includes(x.listing_status) ? `<button type="button" class="outline delete-action" data-report="${x.id}" data-action="hide">Skryť inzerát</button>` : ""}${x.listing_id && x.listing_status && x.listing_status !== "deleted" ? `<button type="button" class="text-button delete-action" data-report="${x.id}" data-action="delete">Odstrániť inzerát</button>` : ""}<button type="button" class="outline" data-report="${x.id}" data-action="resolve">Vybaviť bez zásahu</button>`
                    : `<button type="button" class="text-button" data-report="${x.id}" data-action="reopen">Znovu otvoriť</button>`
                }</div></article>`,
            )
            .join("")
        : '<div class="account-empty"><h3>Žiadne hlásenia.</h3><p>V tomto výbere nie je nič na posúdenie.</p></div>'
    }${pager(r)}`,
    wire() {
      $("#adminBody").onclick = async (e) => {
        const f = e.target.closest("[data-filter]");
        if (f) return go({ filter: f.dataset.filter, page: 1 });
        const b = e.target.closest("[data-report]");
        if (!b) return;
        const action = b.dataset.action,
          withNote = ["hide", "delete", "resolve"].includes(action);
        const note = await confirmDialog({
          title: { hide: "Skryť inzerát?", delete: "Odstrániť inzerát?", resolve: "Vybaviť hlásenie?", reopen: "Znovu otvoriť hlásenie?" }[action],
          text: action === "hide" || action === "delete" ? "Inzerujúcemu pošleme email s dôvodom. Ostatné otvorené hlásenia k inzerátu sa vybavia." : "",
          note: withNote ? (action === "resolve" ? "Poznámka (interná)" : "Dôvod pre inzerujúceho") : null,
          danger: action === "delete" || action === "hide",
        });
        if (note === false) return;
        await operation(null, async () => {
          await api("admin/reports/" + b.dataset.report, "POST", { action, note: typeof note === "string" ? note : "" });
          toast("Hotovo.");
          renderAdmin();
        });
      };
    },
  };
}
async function listings() {
  const filter = adminState.filter || "",
    q = new URLSearchParams({ page: adminState.page });
  if (filter) q.set("status", filter);
  if (adminState.q) q.set("q", adminState.q);
  if (adminState.owner) q.set("owner", adminState.owner);
  const r = await api("admin/listings?" + q);
  return {
    body: `${searchBar("Názov, text, ID inzerátu alebo email inzerenta", [
      ["", "Všetky okrem odstránených"],
      ["active", "Aktívne"],
      ["sold", "Ukončené"],
      ["hidden", "Skryté"],
      ["deleted", "Odstránené"],
    ])}<p class="results-meta">${r.total} inzerátov</p>${
      r.listings.length
        ? r.listings
            .map(
              (d) =>
                `<article class="manage-row"><a class="manage-photo" href="/inzerat/?id=${d.id}" target="_blank" rel="noopener"><img src="${esc(d.photo)}" alt="" loading="lazy"></a><div class="manage-info"><div class="manage-status"><span class="${d.status === "active" ? "" : "status-closed"}">${listingStatus[d.status]}</span>${d.boost ? '<span class="status-boost">↑ BOOST</span>' : ""}${d.openReports ? `<span class="status-boost">${d.openReports} hlásení</span>` : ""}${d.ownerBanned ? '<span class="status-closed">Inzerent zablokovaný</span>' : ""}<small>#${d.id} · ${d.buy ? "KÚPIM" : "PREDÁM"} · ${d.country.toUpperCase()}</small></div><h3><a href="/inzerat/?id=${d.id}" target="_blank" rel="noopener">${esc(d.title)} ↗</a></h3><p>${esc(d.cat)} · ${esc(d.city)} · ${price(d)} · ${fmtDate(d.createdAt)}</p><p>${esc(d.seller)} · <a href="${adminUrl({ tab: "pouzivatelia", q: d.ownerEmail, filter: "", page: 1, owner: "" })}">${esc(d.ownerEmail)}</a></p>${d.moderationNote ? `<p class="modal-muted">Poznámka: ${esc(d.moderationNote)}</p>` : ""}</div><div class="manage-actions">${
                  d.status === "deleted"
                    ? ""
                    : `${d.status === "hidden" ? `<button type="button" class="outline" data-listing="${d.id}" data-action="restore">Obnoviť</button>` : `<button type="button" class="outline delete-action" data-listing="${d.id}" data-action="hide">Skryť</button>`}${d.boost ? `<button type="button" class="text-button" data-listing="${d.id}" data-action="unboost">Zrušiť Boost</button>` : ""}<button type="button" class="text-button delete-action" data-listing="${d.id}" data-action="delete">Odstrániť</button>`
                }</div></article>`,
            )
            .join("")
        : '<div class="account-empty"><h3>Nič sa nenašlo.</h3></div>'
    }${pager(r)}`,
    wire() {
      $("#adminBody").onclick = async (e) => {
        const b = e.target.closest("[data-listing]");
        if (!b) return;
        const action = b.dataset.action,
          withNote = action === "hide" || action === "delete";
        const note = await confirmDialog({
          title: { hide: "Skryť inzerát?", restore: "Obnoviť inzerát?", delete: "Odstrániť inzerát?", unboost: "Zrušiť Boost?" }[action],
          text: withNote ? "Inzerujúcemu pošleme email s dôvodom." : "",
          note: withNote ? "Dôvod pre inzerujúceho" : null,
          danger: withNote,
        });
        if (note === false) return;
        await operation(null, async () => {
          await api("admin/listings/" + b.dataset.listing, "POST", { action, note: typeof note === "string" ? note : "" });
          toast("Hotovo.");
          renderAdmin();
        });
      };
    },
  };
}
async function users() {
  const q = new URLSearchParams({ page: adminState.page });
  if (adminState.filter) q.set("filter", adminState.filter);
  if (adminState.q) q.set("q", adminState.q);
  const r = await api("admin/users?" + q);
  return {
    body: `${searchBar("Meno, email alebo ID", [
      ["", "Všetci"],
      ["banned", "Zablokovaní"],
      ["unverified", "Neoverení"],
    ])}<p class="results-meta">${r.total} používateľov</p>${
      r.users.length
        ? r.users
            .map(
              (u) =>
                `<article class="manage-row admin-row"><div class="manage-info"><div class="manage-status">${u.admin ? '<span class="status-boost">Administrátor</span>' : ""}${u.banned ? '<span class="status-closed">Zablokovaný</span>' : ""}<span class="${u.verified ? "" : "status-closed"}">${u.verified ? "✓ Overený" : "Neoverený"}</span><small>Registrácia ${fmtDate(u.created)} · Posledné prihlásenie ${u.last_login ? fmtDate(u.last_login) : "—"}</small></div><h3>${esc(u.name)}</h3><p><a href="mailto:${esc(u.email)}">${esc(u.email)}</a>${u.phone ? " · " + esc(u.phone) : ""}</p><p><a href="${adminUrl({ tab: "inzeraty", owner: u.id, q: "", filter: "", page: 1 })}">${u.listings} inzerátov ↗</a> · ${u.reports} hlásení na inzeráty</p>${u.banned && u.ban_reason ? `<p class="field-error">Dôvod blokovania: ${esc(u.ban_reason)}</p>` : ""}</div><div class="manage-actions">${
                  u.admin
                    ? ""
                    : `${u.banned ? `<button type="button" class="outline" data-user="${u.id}" data-action="unban">Odblokovať</button>` : `<button type="button" class="outline delete-action" data-user="${u.id}" data-action="ban">Zablokovať</button>`}${u.verified ? "" : `<button type="button" class="text-button" data-user="${u.id}" data-action="verify">Overiť ručne</button>`}<button type="button" class="text-button" data-user="${u.id}" data-action="logout">Odhlásiť všade</button><button type="button" class="text-button delete-action" data-user="${u.id}" data-action="delete">Odstrániť účet</button>`
                }</div></article>`,
            )
            .join("")
        : '<div class="account-empty"><h3>Nič sa nenašlo.</h3></div>'
    }${pager(r)}`,
    wire() {
      $("#adminBody").onclick = async (e) => {
        const b = e.target.closest("[data-user]");
        if (!b) return;
        const action = b.dataset.action;
        const note = await confirmDialog({
          title: {
            ban: "Zablokovať používateľa?",
            unban: "Odblokovať používateľa?",
            verify: "Overiť email ručne?",
            logout: "Odhlásiť zo všetkých zariadení?",
            delete: "Natrvalo odstrániť účet?",
          }[action],
          text: {
            ban: "Používateľ sa nebude môcť prihlásiť a jeho inzeráty zmiznú z verejného zobrazenia. Dostane email s dôvodom.",
            delete: "Vymažú sa kontaktné údaje, inzeráty, fotografie, obľúbené a odoslané správy používateľa. Akciu nemožno vrátiť.",
            verify: "Používa sa iba vtedy, ak overovací email nemohol byť doručený a totožnosť schránky si overil inak.",
          }[action],
          note: action === "ban" ? "Dôvod pre používateľa" : action === "delete" ? "Interná poznámka" : null,
          danger: action === "ban" || action === "delete",
        });
        if (note === false) return;
        await operation(null, async () => {
          await api("admin/users/" + b.dataset.user, "POST", { action, note: typeof note === "string" ? note : "" });
          toast("Hotovo.");
          renderAdmin();
        });
      };
    },
  };
}
async function auditLog() {
  const r = await api("admin/log?page=" + adminState.page);
  const names = {
    "listing.hide": "Skrytie inzerátu",
    "listing.restore": "Obnovenie inzerátu",
    "listing.delete": "Odstránenie inzerátu",
    "listing.unboost": "Zrušenie Boostu",
    "report.resolve": "Vybavenie hlásenia",
    "report.reopen": "Znovuotvorenie hlásenia",
    "user.ban": "Zablokovanie",
    "user.unban": "Odblokovanie",
    "user.verify": "Ručné overenie",
    "user.logout": "Odhlásenie všade",
    "user.delete": "Odstránenie účtu",
  };
  return {
    body: `<p class="results-meta">${r.total} záznamov</p>${
      r.log.length
        ? `<div class="admin-table-wrap"><table class="legal-table admin-table"><thead><tr><th>Čas</th><th>Administrátor</th><th>Akcia</th><th>Cieľ</th><th>Poznámka</th></tr></thead><tbody>${r.log
            .map(
              (x) =>
                `<tr><td>${fmtDateTime(x.created)}</td><td>${esc(x.admin)}</td><td>${esc(names[x.action] || x.action)}</td><td>${x.action.startsWith("listing.") ? `<a href="/inzerat/?id=${esc(x.target)}" target="_blank" rel="noopener">#${esc(x.target)}</a>` : esc(x.target)}</td><td>${esc(x.note)}</td></tr>`,
            )
            .join("")}</tbody></table></div>`
        : '<div class="account-empty"><h3>Zatiaľ žiadne akcie.</h3></div>'
    }${pager(r)}`,
  };
}
async function renderAdmin() {
  const host = $("#adminContent");
  try {
    const view = await { prehlad: overview, hlasenia: reports, inzeraty: listings, pouzivatelia: users, zaznam: auditLog }[adminState.tab]();
    host.innerHTML = adminShell(view.body, view.counts);
    view.wire?.();
    $(".admin-tabs").onclick = (e) => {
      const a = e.target.closest("[data-tab]");
      if (!a || e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      go({ tab: a.dataset.tab, page: 1, q: "", filter: "", owner: "" });
    };
    if ($("#adminSearch"))
      $("#adminSearch").onsubmit = (e) => {
        e.preventDefault();
        go({ q: $("#adminQuery")?.value.trim() || "", filter: $("#adminFilter")?.value || "", page: 1 });
      };
    if ($("#adminFilter")) $("#adminFilter").onchange = () => $("#adminSearch").requestSubmit();
    $$(".pager [data-page]", host).forEach(
      (b) =>
        (b.onclick = (e) => {
          e.stopPropagation();
          if (!b.disabled) go({ page: Number(b.dataset.page) });
        }),
    );
  } catch (e) {
    host.innerHTML = `<div class="account-guest"><h1>Administrácia</h1><p>${esc(e.message)}</p><a class="primary" href="/">Späť na úvod</a></div>`;
  }
}
window.pageInit = async function () {
  if (!state.user) {
    $("#adminContent").innerHTML = `<div class="account-guest"><h1>Administrácia</h1><p>Prihlás sa administrátorským účtom.</p><a class="primary" href="${loginUrl()}">Prihlásiť sa ↗</a></div>`;
    return;
  }
  if (!state.user.admin) {
    $("#adminContent").innerHTML = `<div class="account-guest"><h1>Administrácia</h1><p>Na túto časť nemáš oprávnenie.</p><a class="primary" href="/">Späť na úvod</a></div>`;
    return;
  }
  addEventListener("popstate", () => {
    const p = new URLSearchParams(location.search);
    Object.assign(adminState, {
      tab: adminTabs.some((t) => t[0] === p.get("sekcia")) ? p.get("sekcia") : "prehlad",
      page: Math.max(1, Number(p.get("strana")) || 1),
      q: p.get("q") || "",
      filter: p.get("filter") || "",
      owner: p.get("owner") || "",
    });
    renderAdmin();
  });
  await renderAdmin();
};
