"use strict";
// Shared client code: state, API, header, auth dialogs, favorites, listing cards, cookies and helpers.
const $ = (s, root = document) => root.querySelector(s),
  $$ = (s, root = document) => [...root.querySelectorAll(s)];
const BOOT = window.BAZAR_BOOT,
  CATALOG = window.CATALOG || [],
  ICONS = window.ICONS || {},
  PLACES = window.BAZARO_PLACES || [];
const page = document.body.dataset.page,
  params = new URLSearchParams(location.search);
const state = {
  user: BOOT.user,
  csrf: BOOT.csrf,
  favorites: new Set(BOOT.favorites || []),
  config: BOOT.config || {},
  unread: BOOT.unread || 0,
};
const SITE = state.config.site || "Bazaro";
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const icon = (name, cls = "icon") =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.ostatne || ""}</svg>`;
const fmtDate = (n, opts = { day: "numeric", month: "numeric", year: "numeric" }) =>
  n ? new Intl.DateTimeFormat("sk-SK", opts).format(new Date(n)) : "—";
const fmtDateTime = (n) =>
  fmtDate(n, { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
function fmtAgo(n) {
  const d = new Date(n),
    now = new Date(),
    day = 86400000,
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const time = new Intl.DateTimeFormat("sk-SK", { hour: "2-digit", minute: "2-digit" }).format(d);
  if (n >= start) return "dnes " + time;
  if (n >= start - day) return "včera " + time;
  return fmtDate(n, {
    day: "numeric",
    month: "numeric",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}
const money = (value) => new Intl.NumberFormat("sk-SK", { maximumFractionDigits: 2 }).format(value) + " €";
function priceLabel(d) {
  const type = d.priceType || "fixed";
  if (type === "free") return "Zadarmo";
  if (type === "negotiable") return "Dohodou";
  if (type === "text") return "V texte";
  return (d.buy ? "do " : "") + money(d.price);
}
const price = priceLabel;
const priceTag = (d, cls = "") =>
  `<span class="tag ${d.priceType === "free" ? "free" : ["negotiable", "text"].includes(d.priceType) ? "soft" : ""} ${cls}">${esc(priceLabel(d))}</span>`;
const plural = (n, one, few, many) => (n === 1 ? one : n >= 2 && n <= 4 ? few : many);
const formatZip = (z) => (z && z.length === 5 ? z.slice(0, 3) + " " + z.slice(3) : z || "");
const category = (slug) => CATALOG.find((c) => c.slug === slug) || null;
const subcategory = (cat, sub) => category(cat)?.subs.find((s) => s.slug === sub) || null;
const catName = (slug) => (slug === "all" ? "Všetky kategórie" : category(slug)?.name || "Ostatné");
const catUrl = (cat, sub) => (cat ? `/${cat}/` + (sub ? `${sub}/` : "") : "/inzeraty/");
const conditionName = (c) => (c === "Nové" ? "Nové" : "Používané");

// ---- API ------------------------------------------------------------------
async function api(path, method = "GET", body) {
  const headers = { "x-bazar-request": "1" };
  if (state.csrf) headers["x-csrf-token"] = state.csrf;
  const blob = body instanceof Blob;
  if (body !== undefined) headers["Content-Type"] = blob ? body.type : "application/json";
  let r;
  try {
    r = await fetch("/api/" + path, {
      method,
      headers,
      credentials: "same-origin",
      cache: "no-store",
      body: body === undefined ? undefined : blob ? body : JSON.stringify(body),
    });
  } catch {
    throw Error("Pripojenie zlyhalo. Skontroluj internet a skús znova.");
  }
  let result = {};
  try {
    result = await r.json();
  } catch {}
  if (!r.ok) {
    if (r.status === 401 && state.user) {
      state.user = null;
      state.csrf = null;
      updateHeader();
    }
    throw Object.assign(Error(result.error || "Požiadavka zlyhala."), { status: r.status });
  }
  return result;
}

// ---- UI helpers -------------------------------------------------------------
function toast(t) {
  const el = $("#toast");
  el.textContent = t;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (el.hidden = true), 4200);
}
let modalScrollY = null;
function openModal(html) {
  const modal = $("#modal");
  $("#modalContent").innerHTML = html;
  if (!modal.open) {
    modalScrollY = scrollY;
    document.documentElement.style.overflow = "hidden";
    modal.showModal();
  }
  modal.scrollTop = 0;
  $("#modalContent [autofocus]")?.focus();
}
const closeModal = () => $("#modal").open && $("#modal").close();
async function operation(button, fn, status) {
  if (button?.disabled) return;
  const before = button?.innerHTML;
  if (button) {
    button.disabled = true;
    button.textContent = "Moment…";
  }
  if (status) status.textContent = "";
  try {
    return await fn();
  } catch (e) {
    if (status) {
      status.textContent = e.message;
      status.setAttribute("role", "alert");
    } else toast(e.message);
  } finally {
    if (button?.isConnected) {
      button.disabled = false;
      button.innerHTML = before;
    }
  }
}
function confirmDialog({ title, text = "", confirm = "Potvrdiť", danger = false, note = null }) {
  return new Promise((resolve) => {
    openModal(
      `<form class="dialog-form" id="confirmForm"><h2 id="dialogTitle">${esc(title)}</h2>${text ? `<p class="modal-muted">${text}</p>` : ""}${note !== null ? `<label for="confirmNote">${esc(note)}<textarea id="confirmNote" maxlength="500" rows="3"></textarea></label>` : ""}<div class="form-row"><button type="button" class="btn btn-line" id="confirmCancel">Zrušiť</button><button class="btn ${danger ? "btn-line delete-action" : "btn-ink"}" id="confirmOk">${esc(confirm)}</button></div></form>`,
    );
    let done = false;
    const finish = (v) => {
      if (!done) {
        done = true;
        resolve(v);
      }
    };
    $("#confirmCancel").onclick = () => closeModal();
    $("#confirmForm").onsubmit = (e) => {
      e.preventDefault();
      const value = note !== null ? $("#confirmNote").value.trim() : true;
      closeModal();
      finish(value);
    };
    $("#modal").addEventListener("close", () => finish(false), { once: true });
  });
}
function pagerMarkup(current, pages) {
  if (pages <= 1) return "";
  const nums = new Set([1, pages, current - 1, current, current + 1].filter((n) => n >= 1 && n <= pages));
  let last = 0,
    out = `<button type="button" class="btn btn-line" data-page="${current - 1}"${current <= 1 ? " disabled" : ""} aria-label="Predchádzajúca strana">←</button>`;
  for (const n of [...nums].sort((a, b) => a - b)) {
    if (n - last > 1) out += '<span class="pager-gap">…</span>';
    out += `<button type="button" class="btn ${n === current ? "btn-ink" : "btn-line"}" data-page="${n}"${n === current ? ' aria-current="page"' : ""}>${n}</button>`;
    last = n;
  }
  return (
    out +
    `<button type="button" class="btn btn-line" data-page="${current + 1}"${current >= pages ? " disabled" : ""} aria-label="Ďalšia strana">→</button>`
  );
}
function fillCityList(list = $("#placeList")) {
  if (list && !list.children.length)
    list.innerHTML = PLACES.map(
      ([name, zip]) => `<option value="${esc(name)}"></option><option value="${formatZip(zip)}">${esc(name)}</option>`,
    ).join("");
}
// Photos are downscaled and re-encoded in the browser (smaller uploads, EXIF location data removed).
function readImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file),
      image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(Error("Fotografiu sa nepodarilo načítať. Použi JPG, PNG alebo WebP."));
    };
    image.src = url;
  });
}
function canvasBlob(canvas, quality = 0.84) {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(Error("Fotografiu sa nepodarilo spracovať."))),
      "image/jpeg",
      quality,
    ),
  );
}
function drawScaled(image, max) {
  const scale = Math.min(max / image.width, max / image.height, 1),
    c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(image.width * scale));
  c.height = Math.max(1, Math.round(image.height * scale));
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(image, 0, 0, c.width, c.height);
  return c;
}
async function preparePhoto(file, max = 1600) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name || ""))
    throw Error("Použi fotografiu JPG, PNG alebo WebP.");
  if (file.size > 25 * 1024 * 1024) throw Error("Fotografia je príliš veľká.");
  return canvasBlob(drawScaled(await readImage(file), max));
}
// Uploads a photo and a 480 px thumbnail used in listings; returns the upload id.
async function uploadPhoto(blob) {
  const { id } = await api("uploads", "POST", new Blob([blob], { type: "image/jpeg" }));
  try {
    const thumb = await canvasBlob(drawScaled(await readImage(blob), 480), 0.78);
    await api("uploads/" + id + "/thumb", "POST", thumb);
  } catch {}
  return id;
}
// Cloudflare Turnstile widget; resolves to a token getter (empty string when disabled).
let turnstileScript = null;
async function captcha(host) {
  const key = state.config.turnstile;
  if (!key || !host) return () => "";
  turnstileScript ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.onload = resolve;
    s.onerror = () => reject(Error("Overenie sa nepodarilo načítať."));
    document.head.append(s);
  });
  await turnstileScript;
  let token = "";
  const widget = window.turnstile.render(host, {
    sitekey: key,
    language: "sk",
    callback: (t) => (token = t),
    "expired-callback": () => (token = ""),
  });
  return () => {
    const t = token;
    if (t) {
      token = "";
      setTimeout(() => window.turnstile.reset(widget), 0);
    }
    return t;
  };
}

// ---- Header & layout ------------------------------------------------------
function updateHeader() {
  const u = state.user,
    account = $("#account");
  account.textContent = u ? u.name.split(" ")[0] : "Prihlásiť sa";
  account.href = u ? "/ucet/" : loginUrl();
  $("#savedCount").textContent = state.favorites.size;
  $("#savedCount").hidden = !state.favorites.size;
  $("#inboxLink").hidden = !u?.verified;
  for (const badge of [$("#inboxBadge"), $("#tabInbox")]) {
    badge.textContent = state.unread > 99 ? "99+" : state.unread;
    badge.hidden = !state.unread;
  }
}
const loginUrl = () => "/prihlasenie/?next=" + encodeURIComponent(location.pathname + location.search);
function listingSearchUrl(form, base = "/inzeraty/") {
  const q = new URLSearchParams(),
    data = new FormData(form);
  for (const key of ["q", "mesto"]) if (String(data.get(key) || "").trim()) q.set(key, String(data.get(key)).trim());
  if (q.has("mesto") && data.get("okruh") !== null) q.set("okruh", data.get("okruh"));
  return base + (q.size ? "?" + q : "");
}
function wireHeaderSearch() {
  const form = $("#headerSearch");
  $("#hsQuery").value = params.get("q") || "";
  $("#hsLoc").value = params.get("mesto") || "";
  if (params.has("okruh")) $("#hsRadius").value = params.get("okruh");
  form.onsubmit = (e) => {
    e.preventDefault();
    location.assign(listingSearchUrl(form));
  };
}

// ---- Accounts ---------------------------------------------------------------
function signInMarkup(heading = "h2") {
  return `<form class="dialog-form" id="signinForm"><span class="kicker">Prihlásenie</span><${heading} id="dialogTitle">Vitaj späť</${heading}><label for="signinEmail">Email<input id="signinEmail" type="email" required autocomplete="email" maxlength="254" autofocus></label><label for="signinPassword">Heslo<input id="signinPassword" type="password" required autocomplete="current-password" maxlength="128"></label><p id="signinError" class="field-error" role="alert"></p><button class="btn btn-ink btn-lg" id="signinSubmit">Prihlásiť sa</button><p class="auth-switch"><a href="/zabudnute-heslo/">Zabudnuté heslo?</a> · Nemáš účet? <a href="/registracia/">Zaregistruj sa</a></p></form>`;
}
function wireSignIn(after) {
  $("#signinForm").onsubmit = (e) => {
    e.preventDefault();
    operation(
      $("#signinSubmit"),
      async () => {
        const r = await api("auth/login", "POST", {
          email: $("#signinEmail").value.trim(),
          password: $("#signinPassword").value,
        });
        state.user = r.user;
        state.csrf = r.csrf;
        after();
      },
      $("#signinError"),
    );
  };
}
function signIn(next) {
  openModal(signInMarkup());
  wireSignIn(() => (next ? location.assign(next) : location.reload()));
}
function verifyNotice() {
  openModal(
    `<div class="dialog-form"><span class="kicker">Overenie emailu</span><h2 id="dialogTitle">Ešte potvrď email</h2><p>Na pridanie inzerátu, ukladanie a písanie správ potrebuješ potvrdiť odkaz, ktorý sme poslali na <strong>${esc(state.user.email)}</strong>.</p><button class="btn btn-ink" type="button" id="resendEmail">Poslať nový odkaz</button><p id="resendStatus" class="modal-muted" role="status"></p></div>`,
  );
  $("#resendEmail").onclick = () =>
    operation(
      $("#resendEmail"),
      async () => {
        $("#resendStatus").textContent = (await api("auth/resend", "POST", { email: state.user.email })).message;
      },
      $("#resendStatus"),
    );
}
function requireAccount(next, { verified = true } = {}) {
  if (!state.user) return signIn();
  if (verified && !state.user.verified) return verifyNotice();
  next();
}
async function logout() {
  try {
    await api("auth/logout", "POST", {});
  } catch {}
  location.assign("/");
}

// ---- Favorites, cards and rows ----------------------------------------------
function syncFavoriteButtons(id) {
  const saved = state.favorites.has(id);
  $$(`[data-fav="${id}"]`).forEach((b) => {
    b.classList.toggle("selected", saved);
    b.setAttribute("aria-pressed", String(saved));
    b.setAttribute("aria-label", saved ? "Odobrať z obľúbených" : "Uložiť do obľúbených");
    if (b.dataset.favLabel) b.innerHTML = icon("heart") + (saved ? "Uložené" : "Uložiť");
  });
  updateHeader();
}
function toggleFavorite(id) {
  requireAccount(() =>
    operation(null, async () => {
      const save = !state.favorites.has(id);
      await api("favorites", "POST", { id, save });
      save ? state.favorites.add(id) : state.favorites.delete(id);
      syncFavoriteButtons(id);
      toast(save ? "Uložené do obľúbených." : "Odobraté z obľúbených.");
    }),
  );
}
document.addEventListener("click", (e) => {
  const f = e.target.closest("[data-fav]");
  if (f) {
    e.preventDefault();
    toggleFavorite(Number(f.dataset.fav));
  }
});
const favButton = (d) => {
  const saved = state.favorites.has(d.id);
  return `<button type="button" class="favorite ${saved ? "selected" : ""}" aria-label="${saved ? "Odobrať z obľúbených" : "Uložiť do obľúbených"}" aria-pressed="${saved}" data-fav="${d.id}">${icon("heart")}</button>`;
};
const locationLabel = (d) => esc(d.city) + (d.zip ? ` <span class="muted">${formatZip(d.zip)}</span>` : "");
function cardMarkup(d) {
  const label = esc(d.title);
  return `<article class="card ${d.boost ? "boosted" : ""}"><div class="card-photo"><img src="${esc(d.thumb || d.photo)}" alt="" loading="lazy" decoding="async"><div class="badges">${d.boost ? '<span class="badge-top">TOP</span>' : ""}${d.buy ? '<span class="badge-buy">KÚPIM</span>' : ""}</div>${d.photoCount > 1 ? `<span class="photo-count">${icon("camera")}${d.photoCount}</span>` : ""}${favButton(d)}</div><div class="card-detail"><h3><a href="/inzerat/?id=${d.id}">${label}</a></h3>${priceTag(d)}<div class="card-meta"><span>${esc(d.city)}</span><span>${fmtAgo(d.createdAt)}</span></div></div></article>`;
}
function rowMarkup(d) {
  return `<article class="lrow ${d.boost ? "boosted" : ""}"><div class="lrow-photo"><img src="${esc(d.thumb || d.photo)}" alt="" loading="lazy" decoding="async">${d.photoCount > 1 ? `<span class="photo-count">${icon("camera")}${d.photoCount}</span>` : ""}</div><div class="lrow-body"><div class="lrow-badges">${d.boost ? '<span class="badge-top">TOP</span>' : ""}${d.buy ? '<span class="badge-buy">KÚPIM</span>' : ""}<span class="lrow-cat">${esc(d.catName)} › ${esc(d.subName)}</span></div><h3><a href="/inzerat/?id=${d.id}">${esc(d.title)}</a></h3><p class="lrow-desc">${esc(d.desc)}</p><div class="lrow-meta"><span>${icon("pin")}${locationLabel(d)}</span><span>${icon("clock")}${fmtAgo(d.createdAt)}</span>${d.viewCount !== undefined ? `<span>${icon("eye")}${d.viewCount}</span>` : ""}</div></div><div class="lrow-side">${priceTag(d)}${favButton(d)}</div></article>`;
}
function categoryBoard(host, counts = null) {
  if (!host) return;
  const n = (c, s) =>
    counts ? counts.filter((x) => x.c === c && (!s || x.s === s)).reduce((a, x) => a + x.n, 0) : null;
  host.innerHTML = CATALOG.map((c) => {
    const total = n(c.slug);
    const subs = c.subs
      .filter((s) => s.slug !== "ostatne")
      .map((s) => ({ ...s, n: n(c.slug, s.slug) }))
      .sort((a, b) => (b.n || 0) - (a.n || 0))
      .slice(0, host.dataset.full ? 20 : 5);
    return `<div class="cat-tile"><a class="cat-tile-head" href="${catUrl(c.slug)}"><span class="icon-wrap">${icon(c.slug)}</span><span><strong>${esc(c.name)}</strong>${total !== null ? `<small>${total} ${plural(total, "inzerát", "inzeráty", "inzerátov")}</small>` : ""}</span></a><div class="cat-subs">${subs.map((s) => `<a href="${catUrl(c.slug, s.slug)}">${esc(s.name)}${s.n ? ` <b>${s.n}</b>` : ""}</a>`).join("")}</div></div>`;
  }).join("");
}
let categoryCounts = null;
async function loadCategoryCounts() {
  try {
    categoryCounts ??= await api("categories");
  } catch {
    categoryCounts = { counts: [], total: 0, today: 0 };
  }
  return categoryCounts;
}

// ---- Cookies ----------------------------------------------------------------
const privacyKey = "bazar-cookie-choice",
  privacyVersion = 3;
function readPrivacyChoice() {
  try {
    const c = JSON.parse(localStorage.getItem(privacyKey));
    if (
      c &&
      c.version === privacyVersion &&
      typeof c.analytics === "boolean" &&
      Date.now() - c.savedAt < 180 * 86400000
    )
      return c;
  } catch {}
  return null;
}
const hasAnalyticsConsent = () => readPrivacyChoice()?.analytics === true;
const renderCookieBanner = () => ($("#cookieBanner").hidden = !!readPrivacyChoice());
function savePrivacyChoice(analytics) {
  try {
    localStorage.setItem(
      privacyKey,
      JSON.stringify({
        version: privacyVersion,
        necessary: true,
        analytics: !!analytics,
        marketing: false,
        savedAt: Date.now(),
      }),
    );
  } catch {}
  if ($("#cookiePreferencesForm")) closeModal();
  renderCookieBanner();
}
function openPrivacySettings() {
  openModal(
    `<form class="dialog-form" id="cookiePreferencesForm"><span class="kicker">Súkromie</span><h2 id="dialogTitle">Nastavenia cookies</h2><p class="modal-muted">Voliteľné ukladanie je predvolene vypnuté. Voľbu môžeš kedykoľvek zmeniť.</p><label class="checkbox-row privacy-option"><input type="checkbox" checked disabled><span><strong>Nevyhnutné</strong><small>Prihlásenie, rozpracované inzeráty a neodoslané správy. Vždy aktívne.</small></span></label><label class="checkbox-row privacy-option"><input id="cookieAnalytics" type="checkbox"${hasAnalyticsConsent() ? " checked" : ""}><span><strong>Štatistika zobrazení</strong><small>Ako prihlásený používateľ sa započítaš do počtu zobrazení inzerátu najviac raz denne. Nepoužívame služby tretích strán.</small></span></label><label class="checkbox-row privacy-option"><input type="checkbox" disabled><span><strong>Marketing</strong><small>Nepoužívame.</small></span></label><div class="privacy-actions"><button type="button" id="preferencesReject" class="btn btn-line">Len nevyhnutné</button><button type="submit" class="btn btn-ink">Uložiť výber</button></div></form>`,
  );
  $("#preferencesReject").onclick = () => savePrivacyChoice(false);
  $("#cookiePreferencesForm").onsubmit = (e) => {
    e.preventDefault();
    savePrivacyChoice($("#cookieAnalytics").checked);
  };
}

// ---- Informational dialogs --------------------------------------------------
function explainSafety() {
  openModal(
    `<div class="dialog-form"><span class="kicker">Bezpečný obchod</span><h2 id="dialogTitle">Obchoduj s rozvahou</h2><p>Overený email potvrdzuje iba prístup k schránke, nie dôveryhodnosť predajcu.</p><p>Vec si pri osobnom odbere prezri a vyskúšaj. <strong>Neplať vopred</strong> neznámym ľuďom a nikdy nezadávaj údaje karty do odkazov, ktoré ti niekto pošle – ani „kuriérom“ či „bazárom“.</p><p>Podozrivý inzerát nahlás a kontakt v správach zablokuj.</p></div>`,
  );
}
const explainContact = explainSafety;

// ---- Startup ----------------------------------------------------------------
async function pollUnread() {
  if (!state.user?.verified || page === "inbox" || document.visibilityState !== "visible") return;
  try {
    const r = await api("inbox?limit=1");
    if (r.unread !== state.unread) {
      state.unread = r.unread;
      updateHeader();
    }
  } catch {}
}
window.startBazaro = async function () {
  updateHeader();
  wireHeaderSearch();
  fillCityList();
  renderCookieBanner();
  $("#cookieReject").onclick = () => savePrivacyChoice(false);
  $("#cookieAccept").onclick = () => savePrivacyChoice(true);
  $("#cookieCustomize").onclick = openPrivacySettings;
  for (const id of ["cookieSettings", "legalCookieSettings"])
    if ($("#" + id)) $("#" + id).onclick = openPrivacySettings;
  $("#safety").onclick = explainSafety;
  if ($("#howContact")) $("#howContact").onclick = explainSafety;
  $("#close").onclick = closeModal;
  $("#modal").addEventListener("close", () => {
    document.documentElement.style.overflow = "";
    if (modalScrollY !== null) scrollTo(0, modalScrollY);
    modalScrollY = null;
  });
  $("#modal").addEventListener("click", (e) => {
    if (e.target !== $("#modal")) return;
    const r = $("#modal").getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeModal();
  });
  for (const link of $$('a[href="/pridat/"]'))
    link.addEventListener("click", (e) => {
      if (!state.user?.verified) {
        e.preventDefault();
        requireAccount(() => location.assign("/pridat/"));
      }
    });
  $("#saved").onclick = (e) => {
    if (!state.user) {
      e.preventDefault();
      signIn("/inzeraty/?oblubene=1");
    }
  };
  $$('.tabbar a[data-tab="inbox"], .tabbar a[data-tab="account"]').forEach((a) =>
    a.addEventListener("click", (e) => {
      if (!state.user) {
        e.preventDefault();
        signIn(a.getAttribute("href"));
      }
    }),
  );
  const tab = { home: "home", categories: "categories", create: "create", inbox: "inbox", account: "account" }[page];
  if (tab) $(`.tabbar [data-tab="${tab}"]`)?.classList.add("active");
  if (typeof window.pageInit === "function") await window.pageInit();
  setInterval(pollUnread, 60000);
  document.addEventListener("visibilitychange", pollUnread);
};
