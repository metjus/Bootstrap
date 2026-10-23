"use strict";
function safeNext() {
  const next = params.get("next") || "";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/prihlasenie") ? next : "/ucet/";
}
function validEmail(value) {
  const email = value.trim(),
    parts = email.split("@");
  if (email.length > 254 || parts.length !== 2 || !parts[0] || parts[0].length > 64) return false;
  if (parts[0].startsWith(".") || parts[0].endsWith(".") || parts[0].includes("..")) return false;
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(parts[0])) return false;
  const labels = parts[1].split(".");
  return (
    labels.length >= 2 &&
    labels.every((l) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(l)) &&
    /^[a-z]{2,63}$/i.test(labels.at(-1))
  );
}
function renderSignup(host) {
  host.innerHTML = `<form class="dialog-form" id="registerForm" novalidate><span class="small-kicker">NOVÝ ÚČET</span><h1 id="dialogTitle">Vitaj na ${esc(SITE)}.</h1><p class="modal-muted">Na pridávanie inzerátov a kontaktovanie potrebuješ účet s overeným emailom.</p><label for="registerName">Meno *</label><input id="registerName" required minlength="2" maxlength="80" autocomplete="name" aria-describedby="nameError"><p class="field-error" id="nameError"></p><label for="registerEmail">Email *</label><input id="registerEmail" type="email" required maxlength="254" autocomplete="email" aria-describedby="emailError"><p class="field-error" id="emailError"></p><label for="registerPassword">Heslo *</label><input id="registerPassword" type="password" required minlength="12" maxlength="128" autocomplete="new-password" aria-describedby="passwordHint passwordError"><p class="field-hint" id="passwordHint">Aspoň 12 znakov. Odporúčame vetu alebo správcu hesiel.</p><p class="field-error" id="passwordError"></p><label for="registerRepeat">Heslo znovu *</label><input id="registerRepeat" type="password" required minlength="12" maxlength="128" autocomplete="new-password" aria-describedby="repeatError"><p class="field-error" id="repeatError"></p><label class="checkbox-row" for="registerTerms"><input id="registerTerms" type="checkbox" required><span>Súhlasím s <a href="/podmienky/" target="_blank" rel="noopener">podmienkami používania</a> a beriem na vedomie <a href="/ochrana-udajov/" target="_blank" rel="noopener">zásady ochrany osobných údajov</a>. *</span></label><p class="field-error" id="termsError"></p>${state.config.email ? "" : `<div class="notice">Registrácia bude dostupná po nastavení odosielania emailov.</div>`}<div class="turnstile-box" id="captchaBox"></div><p class="field-error" id="registerError" role="alert"></p><button class="primary" id="registerSubmit">Vytvoriť účet</button><p class="auth-switch">Už máš účet? <a href="/prihlasenie/">Prihlás sa ↗</a></p></form>`;
  const field = (id) => $("#" + id);
  let captchaToken = () => "";
  if (state.config.turnstile)
    captcha($("#captchaBox"))
      .then((get) => (captchaToken = get))
      .catch((e) => ($("#registerError").textContent = e.message));
  else $("#captchaBox").remove();
  function validate() {
    const errors = {
      name: field("registerName").value.trim().length < 2 ? "Zadaj meno s aspoň 2 znakmi." : "",
      email: validEmail(field("registerEmail").value) ? "" : "Zadaj platný email, napr. meno@domena.sk.",
      password: field("registerPassword").value.length < 12 ? "Heslo musí mať aspoň 12 znakov." : "",
      repeat: field("registerRepeat").value !== field("registerPassword").value ? "Heslá sa nezhodujú." : "",
      terms: field("registerTerms").checked ? "" : "Na vytvorenie účtu potvrď podmienky.",
    };
    for (const [key, msg] of Object.entries(errors)) {
      $("#" + key + "Error").textContent = msg;
      const input = {
        name: "registerName",
        email: "registerEmail",
        password: "registerPassword",
        repeat: "registerRepeat",
        terms: "registerTerms",
      }[key];
      field(input).setAttribute("aria-invalid", String(!!msg));
    }
    return errors;
  }
  field("registerEmail").onblur = () => field("registerEmail").value && validate();
  $("#registerForm").onsubmit = (e) => {
    e.preventDefault();
    const errors = validate(),
      first = Object.keys(errors).find((k) => errors[k]);
    if (first) {
      field(
        {
          name: "registerName",
          email: "registerEmail",
          password: "registerPassword",
          repeat: "registerRepeat",
          terms: "registerTerms",
        }[first],
      ).focus();
      return;
    }
    operation(
      $("#registerSubmit"),
      async () => {
        const r = await api("auth/register", "POST", {
          name: field("registerName").value,
          email: field("registerEmail").value.trim(),
          password: field("registerPassword").value,
          repeat: field("registerRepeat").value,
          terms: true,
          captcha: captchaToken(),
        });
        host.innerHTML = `<div class="dialog-form"><span class="small-kicker">POSLEDNÝ KROK</span><h1>Skontroluj email.</h1><p>${esc(r.message)}</p><p class="modal-muted">Odkaz platí 24 hodín. Po potvrdení sa prihlás.</p><a href="/prihlasenie/" class="primary">Prihlásiť sa</a></div>`;
      },
      $("#registerError"),
    );
  };
}
function renderAction(host, mode) {
  const token = new URLSearchParams(location.hash.slice(1)).get("token") || "";
  if (token) history.replaceState(null, "", location.pathname);
  const titles = {
    verify: "Potvrdenie emailu",
    forgot: "Obnov prístup.",
    reset: "Nové heslo.",
  };
  let fields = "";
  if (mode === "forgot")
    fields = `<p class="modal-muted">Pošleme ti odkaz na nastavenie nového hesla.</p><label for="actionEmail">Email</label><input id="actionEmail" type="email" required autocomplete="email" maxlength="254">`;
  if (mode === "reset")
    fields = `<label for="actionPassword">Nové heslo (aspoň 12 znakov)</label><input id="actionPassword" type="password" minlength="12" maxlength="128" required autocomplete="new-password"><label for="actionRepeat">Heslo znovu</label><input id="actionRepeat" type="password" minlength="12" maxlength="128" required autocomplete="new-password">`;
  if ((mode === "verify" || mode === "reset") && !token) {
    host.innerHTML = `<div class="dialog-form"><h1>${titles[mode]}</h1><p>Odkaz je neúplný. Otvor ho priamo z emailu alebo si nechaj poslať nový.</p><a class="primary" href="${mode === "reset" ? "/zabudnute-heslo/" : "/prihlasenie/"}">${mode === "reset" ? "Poslať nový odkaz" : "Prihlásiť sa"}</a></div>`;
    return;
  }
  host.innerHTML = `<form class="dialog-form" id="authActionForm"><h1>${titles[mode]}</h1>${fields}${mode === "forgot" ? '<div class="turnstile-box" id="captchaBox"></div>' : ""}<p id="authActionStatus" role="status"></p><button class="primary" id="actionSubmit">${mode === "verify" ? "Potvrdiť email" : mode === "forgot" ? "Poslať odkaz" : "Uložiť heslo"}</button><p class="auth-switch"><a href="/prihlasenie/">Prihlásiť sa ↗</a></p></form>`;
  let captchaToken = () => "";
  if ($("#captchaBox")) {
    if (state.config.turnstile) captcha($("#captchaBox")).then((get) => (captchaToken = get));
    else $("#captchaBox").remove();
  }
  $("#authActionForm").onsubmit = (e) => {
    e.preventDefault();
    if (mode === "reset" && $("#actionPassword").value !== $("#actionRepeat").value) {
      $("#authActionStatus").textContent = "Heslá sa nezhodujú.";
      return;
    }
    operation(
      $("#actionSubmit"),
      async () => {
        const r = await api("auth/" + mode, "POST", {
          token,
          email: $("#actionEmail")?.value.trim(),
          password: $("#actionPassword")?.value,
          repeat: $("#actionRepeat")?.value,
          captcha: captchaToken(),
        });
        host.innerHTML = `<div class="dialog-form"><span class="success-mark" aria-hidden="true">✓</span><h1>${esc(r.message)}</h1>${mode === "forgot" ? `<p class="modal-muted">Odkaz platí 1 hodinu. Skontroluj aj spam.</p>` : `<a class="primary" href="${state.user ? "/ucet/" : "/prihlasenie/"}">${state.user ? "Môj účet" : "Prihlásiť sa"}</a>`}</div>`;
      },
      $("#authActionStatus"),
    );
  };
  if (mode === "verify") $("#authActionForm").requestSubmit();
}
window.pageInit = async function () {
  const host = $("#authContent");
  if (page === "signin") {
    if (state.user) return location.replace(safeNext());
    host.innerHTML = signInMarkup().replace('<h2 id="dialogTitle">', '<h1 id="dialogTitle">').replace("</h2>", "</h1>");
    wireSignIn(() => location.assign(safeNext()));
    $("#signinEmail").focus();
  } else if (page === "signup") {
    if (state.user) return location.replace("/ucet/");
    renderSignup(host);
  } else renderAction(host, document.body.dataset.action);
};
