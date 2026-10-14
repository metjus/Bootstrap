"use strict";
// Shared client code: state, API, header, auth dialogs, favorites, cards, cookies and translations.
const $ = (s, root = document) => root.querySelector(s),
  $$ = (s, root = document) => [...root.querySelectorAll(s)];
const BOOT = window.BAZAR_BOOT,
  PLACES = window.BAZARO_PLACES || { sk: [], cz: [] };
const page = document.body.dataset.page,
  params = new URLSearchParams(location.search);
let lang = "sk";
try {
  lang = localStorage.getItem("bazar-lang") === "cz" ? "cz" : "sk";
} catch {}
const L = (sk, cz) => (lang === "cz" ? cz : sk);
const state = {
  user: BOOT.user,
  csrf: BOOT.csrf,
  favorites: new Set(BOOT.favorites || []),
  config: BOOT.config || {},
  unread: BOOT.unread || 0,
};
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const locale = () => (lang === "cz" ? "cs-CZ" : "sk-SK");
const fmtDate = (n, opts = { day: "numeric", month: "short", year: "numeric" }) =>
  n ? new Intl.DateTimeFormat(locale(), opts).format(new Date(n)) : "—";
const fmtDateTime = (n) =>
  fmtDate(n, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const money = (value, country) =>
  new Intl.NumberFormat(country === "cz" ? "cs-CZ" : "sk-SK", { maximumFractionDigits: 2 }).format(value) +
  (country === "cz" ? " Kč" : " €");
const price = (d) =>
  d.buy ? L("Do ", "Do ") + money(d.price, d.country) : d.price === 0 ? L("Zadarmo", "Zdarma") : money(d.price, d.country);
function plural(n, one, few, many) {
  return n === 1 ? one : n >= 2 && n <= 4 ? few : many;
}
const CATEGORIES = [
  ["Elektronika", "Elektronika", "Elektronika"],
  ["Mobily", "Mobily", "Mobily"],
  ["Počítače", "Počítače", "Počítače"],
  ["Auto-moto", "Auto-moto", "Auto-moto"],
  ["Bývanie", "Bývanie", "Bydlení"],
  ["Nehnuteľnosti", "Nehnuteľnosti", "Nemovitosti"],
  ["Šport", "Šport", "Sport"],
  ["Oblečenie", "Oblečenie", "Oblečení"],
  ["Deti", "Deti", "Děti"],
  ["Zvieratá", "Zvieratá", "Zvířata"],
  ["Záhrada", "Záhrada", "Zahrada"],
  ["Stroje", "Stroje", "Stroje"],
  ["Hudba", "Hudba", "Hudba"],
  ["Knihy", "Knihy", "Knihy"],
  ["Služby", "Služby", "Služby"],
  ["Ostatné", "Ostatné", "Ostatní"],
];
const catName = (c) =>
  c === "all" ? L("Všetky kategórie", "Všechny kategorie") : CATEGORIES.find((x) => x[0] === c)?.[lang === "cz" ? 2 : 1] || c;
const conditionName = (c) => (c === "Nové" ? L("Nové", "Nové") : L("Používané", "Použité"));
const iconPaths = {
  all: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  Elektronika: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  Mobily: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M10 5h4M11 19h2"/>',
  Počítače: '<path d="M5 4h14v12H5zM3 16h18l1 4H2z"/>',
  "Auto-moto": '<path d="m5 8 2-4h10l2 4M4 8h16l1 4v6H3v-6zM3 15h18M5 18v3M19 18v3M6 11h2M16 11h2"/>',
  Bývanie:
    '<path d="M5 12V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v4M5 10a2 2 0 0 0-3 2v6h20v-6a2 2 0 0 0-3-2M6 18v3M18 18v3M5 14h14"/>',
  Nehnuteľnosti: '<path d="m2 11 10-8 10 8M5 9v12h14V9M10 21v-7h4v7"/>',
  Šport:
    '<circle cx="12" cy="12" r="9"/><path d="m12 7 5 4-2 6H9l-2-6zM12 3v4M3 10l4 1M21 10l-4 1M6 20l3-3M18 20l-3-3"/>',
  Oblečenie: '<path d="m8 3-6 4 3 5 3-2v11h8V10l3 2 3-5-6-4a4 4 0 0 1-8 0Z"/>',
  Deti: '<path d="M14 4h5l2 4v5H4V8h9V4zM4 13l3 4h12l2-4M4 8H2M12 4v4"/><circle cx="8" cy="20" r="2"/><circle cx="18" cy="20" r="2"/>',
  Zvieratá:
    '<path d="M7 17c0-3 2-6 5-6s5 3 5 6c0 2-2 3-5 2-3 1-5 0-5-2Z"/><ellipse cx="5" cy="10" rx="2" ry="3"/><ellipse cx="19" cy="10" rx="2" ry="3"/><ellipse cx="9" cy="5" rx="2" ry="3"/><ellipse cx="15" cy="5" rx="2" ry="3"/>',
  Záhrada: '<path d="M12 21V11M12 14C4 14 3 8 3 4c5 0 9 3 9 10ZM12 11c0-6 4-8 9-8 0 5-3 8-9 8ZM7 21h10"/>',
  Stroje: '<path d="m14 3 2 2-1 4 4-1 2 2-8 8-5-5zM8 13l-5 5 3 3 5-5"/>',
  Hudba:
    '<path d="M9 17V5l12-3v12M9 8l12-3"/><ellipse cx="6" cy="18" rx="3" ry="3"/><ellipse cx="18" cy="15" rx="3" ry="3"/>',
  Knihy: '<path d="M12 5C8 2 4 3 2 4v16c3-2 7-1 10 1 3-2 7-3 10-1V4c-2-1-6-2-10 1ZM12 5v16"/>',
  Služby: '<path d="M8 6V4h8v2M3 7h18v14H3zM3 12c6 4 12 4 18 0M10 12h4v4h-4z"/>',
  Ostatné: '<path d="m12 2 9 5v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10M7 4l10 6"/>',
};
const categoryIcon = (id) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[id] || iconPaths.Ostatné}</svg>`;

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
    throw Error(L("Pripojenie zlyhalo. Skontroluj internet a skús znova.", "Připojení selhalo. Zkontroluj internet a zkus to znovu."));
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
    throw Object.assign(Error(result.error || L("Požiadavka zlyhala.", "Požadavek selhal.")), { status: r.status });
  }
  return result;
}

// ---- UI helpers -------------------------------------------------------------
function toast(t) {
  const el = $("#toast");
  el.textContent = t;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (el.hidden = true), 4500);
}
let modalScrollState = null;
function lockPageScroll() {
  if (modalScrollState) return;
  const body = document.body,
    root = document.documentElement;
  modalScrollState = { x: scrollX, y: scrollY, bodyStyle: body.style.cssText, rootStyle: root.style.cssText };
  const scrollbarWidth = Math.max(0, innerWidth - root.clientWidth);
  root.style.overflow = "hidden";
  Object.assign(body.style, {
    position: "fixed",
    top: `-${modalScrollState.y}px`,
    left: `-${modalScrollState.x}px`,
    right: "0",
    width: "100%",
    overflow: "hidden",
  });
  if (scrollbarWidth) body.style.paddingRight = scrollbarWidth + "px";
}
function unlockPageScroll() {
  if (!modalScrollState) return;
  const s = modalScrollState;
  modalScrollState = null;
  document.body.style.cssText = s.bodyStyle;
  document.documentElement.style.cssText = s.rootStyle + ";scroll-behavior:auto";
  scrollTo(s.x, s.y);
  document.documentElement.style.cssText = s.rootStyle;
}
function openModal(html) {
  const modal = $("#modal");
  $("#modalContent").innerHTML = html;
  if (!modal.open) {
    lockPageScroll();
    try {
      modal.showModal();
    } catch (e) {
      unlockPageScroll();
      throw e;
    }
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
    button.textContent = L("Pracujem…", "Pracuji…");
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
function confirmDialog({ title, text = "", confirm, danger = false, note = null }) {
  return new Promise((resolve) => {
    openModal(
      `<form class="dialog-form" id="confirmForm"><h2 id="dialogTitle">${esc(title)}</h2>${text ? `<p class="modal-muted">${text}</p>` : ""}${note !== null ? `<label for="confirmNote">${esc(note)}<textarea id="confirmNote" maxlength="500" rows="3"></textarea></label>` : ""}<div class="form-row"><button type="button" class="outline" id="confirmCancel">${L("Zrušiť", "Zrušit")}</button><button class="${danger ? "outline delete-action" : "primary"}" id="confirmOk">${esc(confirm || L("Potvrdiť", "Potvrdit"))}</button></div></form>`,
    );
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      resolve(v);
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
function pagerMarkup(page, pages) {
  if (pages <= 1) return "";
  const nums = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  let last = 0,
    out = `<button type="button" class="outline" data-page="${page - 1}"${page <= 1 ? " disabled" : ""} aria-label="${L("Predchádzajúca strana", "Předchozí strana")}">←</button>`;
  for (const n of [...nums].sort((a, b) => a - b)) {
    if (n - last > 1) out += '<span class="pager-gap">…</span>';
    out += `<button type="button" class="${n === page ? "primary" : "outline"}" data-page="${n}"${n === page ? ' aria-current="page"' : ""}>${n}</button>`;
    last = n;
  }
  return (
    out +
    `<button type="button" class="outline" data-page="${page + 1}"${page >= pages ? " disabled" : ""} aria-label="${L("Ďalšia strana", "Další strana")}">→</button>`
  );
}
function fillCityList(list = $("#citySuggestions")) {
  if (list)
    list.innerHTML = PLACES[lang]
      .map((p) => `<option value="${esc(p.name)}"></option><option value="${p.zip.slice(0, 3) + " " + p.zip.slice(3)}">${esc(p.name)}</option>`)
      .join("");
}
// Downscale and re-encode photos in the browser so uploads stay small and EXIF data is dropped.
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
      reject(Error(L("Fotografiu sa nepodarilo načítať.", "Fotografii se nepodařilo načíst.")));
    };
    image.src = url;
  });
}
function canvasBlob(canvas, quality = 0.84) {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(Error(L("Fotografiu sa nepodarilo spracovať.", "Fotografii se nepodařilo zpracovat.")))), "image/jpeg", quality),
  );
}
async function preparePhoto(file, max = 1600) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw Error(L("Použi fotografiu JPG, PNG alebo WebP.", "Použij fotografii JPG, PNG nebo WebP."));
  if (file.size > 25 * 1024 * 1024) throw Error(L("Fotografia je príliš veľká.", "Fotografie je příliš velká."));
  const image = await readImage(file),
    scale = Math.min(max / image.width, max / image.height, 1),
    c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(image.width * scale));
  c.height = Math.max(1, Math.round(image.height * scale));
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(image, 0, 0, c.width, c.height);
  return canvasBlob(c);
}

// ---- Header & layout ------------------------------------------------------
function updateHeader() {
  const u = state.user,
    account = $("#account");
  account.textContent = u ? u.name : L("Prihlásiť sa", "Přihlásit se");
  account.href = u ? "/ucet/" : "/prihlasenie/?next=" + encodeURIComponent(location.pathname + location.search);
  account.title = u ? L("Otvoriť môj účet", "Otevřít můj účet") : L("Prihlásiť sa", "Přihlásit se");
  $("#register").hidden = !!u;
  $("#savedCount").textContent = state.favorites.size;
  const link = $("#inboxLink"),
    badge = $("#inboxBadge");
  link.hidden = !u?.verified;
  badge.textContent = state.unread > 99 ? "99+" : state.unread;
  badge.hidden = !state.unread;
  link.setAttribute(
    "aria-label",
    L("Správy", "Zprávy") + (state.unread ? ", " + state.unread + " " + L("neprečítaných", "nepřečtených") : ""),
  );
}
const translations = {
  homeNav: "Domů",
  categoriesNav: "Kategorie",
  listingsNav: "Inzeráty",
  signin: "Přihlásit se",
  signup: "Registrace",
  add: "＋ Přidat inzerát",
  footer: "Bazar pro Slovensko a Česko",
  footerExplore: "Objevuj",
  allAds: "Všechny inzeráty ↗",
  footerAccount: "Můj účet",
  footerMessages: "Zprávy",
  footerSafety: "Bezpečné obchodování",
  footerRules: "Pravidla a soukromí",
  footerTerms: "Podmínky používání",
  footerPrivacy: "Ochrana osobních údajů",
  footerCookies: "Cookies",
  footerSettings: "Nastavení cookies",
  footerHelp: "Pomoc a kontakt",
  footerAds: "Pravidla inzerce",
  footerReport: "Nahlásit obsah",
  footerContact: "Kontakt a provozovatel",
  footerNote: "Dohoda, platba i předání probíhají přímo mezi uživateli.",
  language: "Jazyk",
  eyebrow: "BAZAR PRO SLOVENSKO A ČESKO",
  studioTitle: "Tvůj další<br><span>dobrý nález.</span>",
  intro: "Dobré věci nemusí být nové. Objev nabídky ve svém okolí nebo přidej vlastní inzerát zdarma.",
  studioBrowse: 'Začni kategorií <span aria-hidden="true">↗</span>',
  artCaption: "CELÝ SVĚT VĚCÍ.",
  artHome: "Bydlení",
  artPhone: "Mobily",
  artSport: "Sport",
  artTech: "Elektronika",
  looking: "Co hledáš?",
  where: "Město nebo PSČ",
  search: "Hledat <span>↗</span>",
  studioFree: "Přidání inzerátu je zdarma.",
  studioDirect: "Dohoda přímo mezi vámi.",
  boostLabel: "ZVÝRAZNĚNÉ NABÍDKY",
  boostTitle: "Objev něco výjimečného.",
  shuffle: "Další výběr ↻",
  boostDescription: "Výběr zvýrazněných nabídek z celého bazaru. Další dobrý nález může být právě tady.",
  latestLabel: "NEJNOVĚJŠÍ NABÍDKY",
  latestTitle: "Čerstvě přidané.",
  latestDescription: "Nejnovější inzeráty z tvé země.",
  browse: "Procházet kategorie ↗",
  guideKicker: "JEDNODUŠE. PO SVÉM.",
  guideTitle: "Od nálezu<br>k dohodě.",
  how: "Jak funguje kontakt ↗",
  guideFind: "Najdi tu pravou věc.",
  guideFindCopy: "Vyber kategorii, místo a cenu. Zbytek už objevíš.",
  guideTalk: "Zeptej se na detaily.",
  guideTalkCopy: "Napiš zprávu nebo si zobraz dostupné kontakty.",
  guideDeal: "Domluv si předání.",
  guideDealCopy: "Čas, místo i platbu si domluvíte přímo mezi sebou.",
  room: "UDĚLEJ MÍSTO NOVÉMU",
  selling: "Méně věcí doma.<br>Více místa pro tebe.",
  sellingcopy: "Vyfoť, přidej a domluv se. Tvůj inzerát je zdarma.",
  categoryHeading: "Najdi své místo.",
  categoryDescription:
    "Od drobností do domácnosti až po nové bydlení. Vyber kategorii a prohlédni si nabídky nebo poptávky.",
  discoverlabel: "OBJEVUJ",
  sortLabel: "Řazení",
  sell: "Prodám",
  buy: "Koupím",
  changeCategory: "Změnit kategorii ↗",
  categoryFilter: "Kategorie",
  min: "Cena od",
  max: "Cena do",
  distance: "Vzdálenost",
  condition: "Stav",
  reset: "Vymazat filtry",
  filterHelp: "Vzdálenost se počítá orientačně od centra vybraného města z nabídky.",
  resetAll: "Zrušit výběr ×",
  emptyTitle: "Žádné výsledky",
  emptyCopy: "Zkus jiný výraz, místo nebo širší cenové rozpětí.",
  relatedKicker: "PODOBNÉ NABÍDKY",
  relatedTitle: "Mohlo by tě zajímat.",
  backHome: "← Zpět na úvod",
};
function applyLanguage() {
  document.documentElement.lang = lang === "cz" ? "cs" : "sk";
  $("#language").innerHTML = lang.toUpperCase() + " <span>⌄</span>";
  if (lang === "cz")
    $$("[data-t]").forEach((e) => {
      if (translations[e.dataset.t]) e.innerHTML = translations[e.dataset.t];
    });
  const q = $("#query"),
    loc = $("#location");
  if (q) q.placeholder = L("Napr. bicykel, iPhone, kreslo…", "Např. kolo, iPhone, křeslo…");
  if (loc) loc.placeholder = L("Celé Slovensko", "Celé Česko");
  fillCityList();
}

// ---- Accounts ---------------------------------------------------------------
const loginUrl = () => "/prihlasenie/?next=" + encodeURIComponent(location.pathname + location.search);
function signInMarkup() {
  return `<form class="dialog-form" id="signinForm"><span class="small-kicker">${L("PRIHLÁSENIE", "PŘIHLÁŠENÍ")}</span><h2 id="dialogTitle">${L("Vitaj späť.", "Vítej zpátky.")}</h2><p class="modal-muted">${L("Tvoje inzeráty a správy na jednom mieste.", "Tvoje inzeráty a zprávy na jednom místě.")}</p><label for="signinEmail">Email</label><input id="signinEmail" type="email" required autocomplete="email" maxlength="254" autofocus><label for="signinPassword">${L("Heslo", "Heslo")}</label><input id="signinPassword" type="password" required autocomplete="current-password" maxlength="128"><p id="signinError" class="field-error" role="alert"></p><button class="primary" id="signinSubmit">${L("Prihlásiť sa", "Přihlásit se")}</button><p class="auth-switch"><a href="/zabudnute-heslo/">${L("Zabudnuté heslo?", "Zapomenuté heslo?")}</a></p><p class="auth-switch">${L("Ešte nemáš účet?", "Ještě nemáš účet?")} <a href="/registracia/">${L("Zaregistruj sa", "Zaregistruj se")} ↗</a></p></form>`;
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
// Opens the login dialog; after login the page reloads (or navigates) so every view uses the new session.
function signIn(next) {
  openModal(signInMarkup());
  wireSignIn(() => (next ? location.assign(next) : location.reload()));
}
function verifyNotice() {
  openModal(
    `<div class="dialog-form"><span class="small-kicker">${L("OVERENIE EMAILU", "OVĚŘENÍ EMAILU")}</span><h2 id="dialogTitle">${L("Over svoj email.", "Ověř svůj email.")}</h2><p>${L("Pred pridaním inzerátu, uložením obľúbených alebo kontaktovaním potrebuješ potvrdiť odkaz, ktorý sme poslali na", "Před přidáním inzerátu, uložením oblíbených nebo kontaktováním potřebuješ potvrdit odkaz, který jsme poslali na")} <strong>${esc(state.user.email)}</strong>.</p><button class="primary" type="button" id="resendEmail">${L("Poslať nový odkaz", "Poslat nový odkaz")}</button><p id="resendStatus" role="status"></p></div>`,
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

// ---- Favorites & cards ----------------------------------------------------
function syncFavoriteButtons(id) {
  const saved = state.favorites.has(id);
  $$(`[data-fav="${id}"]`).forEach((b) => {
    b.classList.toggle("selected", saved);
    b.setAttribute("aria-pressed", String(saved));
    b.setAttribute("aria-label", saved ? L("Odobrať z obľúbených", "Odebrat z oblíbených") : L("Uložiť do obľúbených", "Uložit do oblíbených"));
    b.textContent = b.dataset.favLabel ? (saved ? L("♥ Uložené", "♥ Uloženo") : L("♡ Uložiť inzerát", "♡ Uložit inzerát")) : saved ? "♥" : "♡";
  });
  $("#savedCount").textContent = state.favorites.size;
}
function toggleFavorite(id) {
  requireAccount(() =>
    operation(null, async () => {
      const save = !state.favorites.has(id);
      await api("favorites", "POST", { id, save });
      save ? state.favorites.add(id) : state.favorites.delete(id);
      syncFavoriteButtons(id);
      toast(save ? L("Uložené do obľúbených.", "Uloženo do oblíbených.") : L("Odobraté z obľúbených.", "Odebráno z oblíbených."));
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
function cardMarkup(d) {
  const saved = state.favorites.has(d.id),
    label = esc(d.title);
  return `<article class="card ${d.boost ? "boosted" : ""}"><div class="card-photo"><a href="/inzerat/?id=${d.id}" aria-label="${label}"><img src="${esc(d.photo)}" alt="${label}" loading="lazy" decoding="async"></a>${d.photoCount > 1 ? `<span class="photo-count">▧ ${d.photoCount}</span>` : ""}${d.boost ? '<span class="badge">↑ BOOST</span>' : d.buy ? `<span class="badge">${L("KÚPIM", "KOUPÍM")}</span>` : ""}<button type="button" class="favorite ${saved ? "selected" : ""}" aria-label="${saved ? L("Odobrať z obľúbených", "Odebrat z oblíbených") : L("Uložiť do obľúbených", "Uložit do oblíbených")}" aria-pressed="${saved}" data-fav="${d.id}">${saved ? "♥" : "♡"}</button></div><div class="card-detail"><span class="card-category">${esc(catName(d.cat))}</span><h3><a href="/inzerat/?id=${d.id}">${label}</a></h3><div class="card-price">${price(d)}</div><div class="card-bottom"><span>${esc(d.city)}</span><span>${fmtDate(d.createdAt, { day: "numeric", month: "short" })}</span></div></div></article>`;
}
function renderCategories(host = $("#categories")) {
  if (!host) return;
  host.innerHTML = [["all"], ...CATEGORIES]
    .map(
      ([id]) =>
        `<a class="category" href="/inzeraty/${id === "all" ? "" : "?kategoria=" + encodeURIComponent(id)}"><span class="category-icon">${categoryIcon(id)}</span><span class="category-name">${esc(catName(id))}</span><span class="category-arrow" aria-hidden="true">↗</span></a>`,
    )
    .join("");
}
function wireSearchForm(onSubmit) {
  const form = $("#searchForm");
  if (!form) return;
  form.onsubmit =
    onSubmit ||
    ((e) => {
      e.preventDefault();
      const q = new URLSearchParams();
      if ($("#query").value.trim()) q.set("q", $("#query").value.trim());
      if ($("#location").value.trim()) q.set("mesto", $("#location").value.trim());
      location.assign("/inzeraty/" + (q.size ? "?" + q : ""));
    });
}

// ---- Cookies ----------------------------------------------------------------
const privacyKey = "bazar-cookie-choice",
  privacyVersion = 3;
function readPrivacyChoice() {
  try {
    const c = JSON.parse(localStorage.getItem(privacyKey));
    if (c && c.version === privacyVersion && typeof c.analytics === "boolean" && Date.now() - c.savedAt < 180 * 86400000)
      return c;
  } catch {}
  return null;
}
const hasAnalyticsConsent = () => readPrivacyChoice()?.analytics === true;
function renderCookieBanner() {
  $("#cookieBannerTitle").textContent = L("Tvoje súkromie. Tvoja voľba.", "Tvoje soukromí. Tvoje volba.");
  $("#cookieBannerCopy").innerHTML = L(
    'Nevyhnutné ukladanie zabezpečuje prihlásenie a tvoje nastavenia. So súhlasom započítame tvoje zobrazenia inzerátov do štatistiky pre inzerujúcich. Reklamné cookies nepoužívame. <a href="/cookies/">Viac o cookies</a>',
    'Nezbytné ukládání zajišťuje přihlášení a tvoje nastavení. Se souhlasem započítáme tvoje zobrazení inzerátů do statistiky pro inzerující. Reklamní cookies nepoužíváme. <a href="/cookies/">Více o cookies</a>',
  );
  $("#cookieReject").textContent = L("Odmietnuť voliteľné", "Odmítnout volitelné");
  $("#cookieAccept").textContent = L("Prijať voliteľné", "Přijmout volitelné");
  $("#cookieCustomize").textContent = L("Nastaviť", "Nastavit");
  $("#cookieBanner").hidden = !!readPrivacyChoice();
}
function savePrivacyChoice(analytics) {
  try {
    localStorage.setItem(
      privacyKey,
      JSON.stringify({ version: privacyVersion, necessary: true, analytics: !!analytics, marketing: false, savedAt: Date.now() }),
    );
  } catch {}
  if ($("#cookiePreferencesForm")) closeModal();
  renderCookieBanner();
}
function openPrivacySettings() {
  openModal(
    `<form class="dialog-form privacy-form" id="cookiePreferencesForm"><span class="small-kicker">${L("SÚKROMIE", "SOUKROMÍ")}</span><h2 id="dialogTitle">${L("Nastavenia cookies", "Nastavení cookies")}</h2><p class="modal-muted">${L("Voliteľné ukladanie je predvolene vypnuté. Voľbu môžeš kedykoľvek zmeniť.", "Volitelné ukládání je ve výchozím stavu vypnuté. Volbu můžeš kdykoliv změnit.")}</p><label class="checkbox-row privacy-option"><input type="checkbox" checked disabled><span><strong>${L("Nevyhnutné", "Nezbytné")}</strong><small>${L("Prihlásenie, jazyk, rozpracované inzeráty a správy. Vždy aktívne.", "Přihlášení, jazyk, rozpracované inzeráty a zprávy. Vždy aktivní.")}</small></span></label><label class="checkbox-row privacy-option"><input id="cookieAnalytics" type="checkbox"${hasAnalyticsConsent() ? " checked" : ""}><span><strong>${L("Štatistika zobrazení", "Statistika zobrazení")}</strong><small>${L("Ako prihlásený používateľ sa započítaš do počtu zobrazení inzerátu najviac raz denne. Nepoužívame služby tretích strán.", "Jako přihlášený uživatel se započítáš do počtu zobrazení inzerátu nejvýše jednou denně. Nepoužíváme služby třetích stran.")}</small></span></label><label class="checkbox-row privacy-option"><input type="checkbox" disabled><span><strong>Marketing</strong><small>${L("Nepoužívame.", "Nepoužíváme.")}</small></span></label><div class="privacy-actions"><button type="button" id="preferencesReject" class="outline">${L("Odmietnuť voliteľné", "Odmítnout volitelné")}</button><button type="button" id="preferencesAccept" class="outline">${L("Prijať voliteľné", "Přijmout volitelné")}</button><button type="submit" class="primary">${L("Uložiť výber", "Uložit výběr")}</button></div></form>`,
  );
  $("#preferencesReject").onclick = () => savePrivacyChoice(false);
  $("#preferencesAccept").onclick = () => savePrivacyChoice(true);
  $("#cookiePreferencesForm").onsubmit = (e) => {
    e.preventDefault();
    savePrivacyChoice($("#cookieAnalytics").checked);
  };
}

// ---- Informational dialogs --------------------------------------------------
function explainContact() {
  openModal(
    `<div class="dialog-form"><span class="small-kicker">${L("KONTAKT", "KONTAKT")}</span><h2 id="dialogTitle">${L("Dohoda priamo medzi vami.", "Dohoda přímo mezi vámi.")}</h2><p>${L("Pri inzeráte môžeš napísať správu alebo zobraziť email a prípadný telefón. Potrebuješ účet s overeným emailom.", "U inzerátu můžeš napsat zprávu nebo zobrazit email a případný telefon. Potřebuješ účet s ověřeným emailem.")}</p><p>${L("O novej správe ti pošleme emailové upozornenie. Odpovedá sa na webe v časti Správy.", "O nové zprávě ti pošleme emailové upozornění. Odpovídá se na webu v části Zprávy.")}</p><div class="notice">${L("Platbu a odovzdanie si dohodnete sami. Overenie emailu nepotvrdzuje totožnosť.", "Platbu a předání si domluvíte sami. Ověření emailu nepotvrzuje totožnost.")}</div></div>`,
  );
}
function explainSafety() {
  openModal(
    `<div class="dialog-form"><span class="small-kicker">${L("BEZPEČNOSŤ", "BEZPEČNOST")}</span><h2 id="dialogTitle">${L("Obchoduj s rozvahou.", "Obchoduj s rozvahou.")}</h2><p>${L("Overený email potvrdzuje prístup k emailovej schránke, nie dôveryhodnosť predajcu.", "Ověřený email potvrzuje přístup k emailové schránce, ne důvěryhodnost prodejce.")}</p><p>${L("Pri osobnom odbere si predmet prezri a vyskúšaj. Neplať vopred neznámym ľuďom a nezadávaj údaje karty do odkazov, ktoré ti niekto pošle.", "Při osobním odběru si předmět prohlédni a vyzkoušej. Neplať předem neznámým lidem a nezadávej údaje karty do odkazů, které ti někdo pošle.")}</p><p>${L("Podozrivý inzerát nahlás a kontakt môžeš v správach zablokovať.", "Podezřelý inzerát nahlas a kontakt můžeš ve zprávách zablokovat.")}</p></div>`,
  );
}

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
  applyLanguage();
  updateHeader();
  renderCookieBanner();
  $("#cookieReject").onclick = () => savePrivacyChoice(false);
  $("#cookieAccept").onclick = () => savePrivacyChoice(true);
  $("#cookieCustomize").onclick = openPrivacySettings;
  for (const id of ["cookieSettings", "legalCookieSettings"]) if ($("#" + id)) $("#" + id).onclick = openPrivacySettings;
  $("#safety").onclick = explainSafety;
  if ($("#howContact")) $("#howContact").onclick = explainContact;
  $("#language").onclick = () => {
    try {
      localStorage.setItem("bazar-lang", lang === "sk" ? "cz" : "sk");
    } catch {}
    location.reload();
  };
  $("#close").onclick = closeModal;
  $("#modal").addEventListener("close", unlockPageScroll);
  $("#modal").addEventListener("click", (e) => {
    if (e.target !== $("#modal")) return;
    const r = $("#modal").getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeModal();
  });
  $("#add").onclick = (e) => {
    if (!state.user || !state.user.verified) {
      e.preventDefault();
      requireAccount(() => location.assign("/pridat/"));
    }
  };
  $("#saved").onclick = (e) => {
    if (!state.user) {
      e.preventDefault();
      signIn("/inzeraty/?oblubene=1");
    }
  };
  $$("[data-portal]").forEach((e) => (e.innerHTML = categoryIcon(e.dataset.portal)));
  renderCategories();
  const navTarget = { home: "/", categories: "/kategorie/", listings: "/inzeraty/" }[page];
  $$("header nav a").forEach((a) => {
    if (a.getAttribute("href") === navTarget) {
      a.classList.add("active");
      a.setAttribute("aria-current", "page");
    }
  });
  if (typeof window.pageInit === "function") await window.pageInit();
  setInterval(pollUnread, 60000);
  document.addEventListener("visibilitychange", pollUnread);
};
