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
  host.innerHTML = `<form class="dialog-form" id="registerForm" novalidate><span class="small-kicker">${L("NOVÝ ÚČET", "NOVÝ ÚČET")}</span><h1 id="dialogTitle">${L("Vitaj na Bazaro.", "Vítej na Bazaro.")}</h1><p class="modal-muted">${L("Na pridávanie inzerátov a kontaktovanie potrebuješ účet s overeným emailom.", "Pro přidávání inzerátů a kontaktování potřebuješ účet s ověřeným emailem.")}</p><label for="registerName">${L("Meno", "Jméno")} *</label><input id="registerName" required minlength="2" maxlength="80" autocomplete="name" aria-describedby="nameError"><p class="field-error" id="nameError"></p><label for="registerEmail">Email *</label><input id="registerEmail" type="email" required maxlength="254" autocomplete="email" aria-describedby="emailError"><p class="field-error" id="emailError"></p><label for="registerPassword">${L("Heslo", "Heslo")} *</label><input id="registerPassword" type="password" required minlength="12" maxlength="128" autocomplete="new-password" aria-describedby="passwordHint passwordError"><p class="field-hint" id="passwordHint">${L("Aspoň 12 znakov. Odporúčame vetu alebo správcu hesiel.", "Alespoň 12 znaků. Doporučujeme větu nebo správce hesel.")}</p><p class="field-error" id="passwordError"></p><label for="registerRepeat">${L("Heslo znovu", "Heslo znovu")} *</label><input id="registerRepeat" type="password" required minlength="12" maxlength="128" autocomplete="new-password" aria-describedby="repeatError"><p class="field-error" id="repeatError"></p><label class="checkbox-row" for="registerTerms"><input id="registerTerms" type="checkbox" required><span>${L("Súhlasím s", "Souhlasím s")} <a href="/podmienky/" target="_blank" rel="noopener">${L("podmienkami používania", "podmínkami používání")}</a> ${L("a beriem na vedomie", "a beru na vědomí")} <a href="/ochrana-udajov/" target="_blank" rel="noopener">${L("zásady ochrany osobných údajov", "zásady ochrany osobních údajů")}</a>. *</span></label><p class="field-error" id="termsError"></p>${state.config.email ? "" : `<div class="notice">${L("Registrácia bude dostupná po nastavení odosielania emailov.", "Registrace bude dostupná po nastavení odesílání emailů.")}</div>`}<p class="field-error" id="registerError" role="alert"></p><button class="primary" id="registerSubmit">${L("Vytvoriť účet", "Vytvořit účet")}</button><p class="auth-switch">${L("Už máš účet?", "Už máš účet?")} <a href="/prihlasenie/">${L("Prihlás sa", "Přihlas se")} ↗</a></p></form>`;
  const field = (id) => $("#" + id);
  function validate() {
    const errors = {
      name: field("registerName").value.trim().length < 2 ? L("Zadaj meno s aspoň 2 znakmi.", "Zadej jméno s alespoň 2 znaky.") : "",
      email: validEmail(field("registerEmail").value) ? "" : L("Zadaj platný email, napr. meno@domena.sk.", "Zadej platný email, např. jmeno@domena.cz."),
      password: field("registerPassword").value.length < 12 ? L("Heslo musí mať aspoň 12 znakov.", "Heslo musí mít alespoň 12 znaků.") : "",
      repeat: field("registerRepeat").value !== field("registerPassword").value ? L("Heslá sa nezhodujú.", "Hesla se neshodují.") : "",
      terms: field("registerTerms").checked ? "" : L("Na vytvorenie účtu potvrď podmienky.", "Pro vytvoření účtu potvrď podmínky."),
    };
    for (const [key, msg] of Object.entries(errors)) {
      $("#" + key + "Error").textContent = msg;
      const input = { name: "registerName", email: "registerEmail", password: "registerPassword", repeat: "registerRepeat", terms: "registerTerms" }[key];
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
      field({ name: "registerName", email: "registerEmail", password: "registerPassword", repeat: "registerRepeat", terms: "registerTerms" }[first]).focus();
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
        });
        host.innerHTML = `<div class="dialog-form"><span class="small-kicker">${L("POSLEDNÝ KROK", "POSLEDNÍ KROK")}</span><h1>${L("Skontroluj email.", "Zkontroluj email.")}</h1><p>${esc(r.message)}</p><p class="modal-muted">${L("Odkaz platí 24 hodín. Po potvrdení sa prihlás.", "Odkaz platí 24 hodin. Po potvrzení se přihlas.")}</p><a href="/prihlasenie/" class="primary">${L("Prihlásiť sa", "Přihlásit se")}</a></div>`;
      },
      $("#registerError"),
    );
  };
}
function renderAction(host, mode) {
  const token = new URLSearchParams(location.hash.slice(1)).get("token") || "";
  if (token) history.replaceState(null, "", location.pathname);
  const titles = {
    verify: L("Potvrdenie emailu", "Potvrzení emailu"),
    forgot: L("Obnov prístup.", "Obnov přístup."),
    reset: L("Nové heslo.", "Nové heslo."),
  };
  let fields = "";
  if (mode === "forgot")
    fields = `<p class="modal-muted">${L("Pošleme ti odkaz na nastavenie nového hesla.", "Pošleme ti odkaz na nastavení nového hesla.")}</p><label for="actionEmail">Email</label><input id="actionEmail" type="email" required autocomplete="email" maxlength="254">`;
  if (mode === "reset")
    fields = `<label for="actionPassword">${L("Nové heslo (aspoň 12 znakov)", "Nové heslo (alespoň 12 znaků)")}</label><input id="actionPassword" type="password" minlength="12" maxlength="128" required autocomplete="new-password"><label for="actionRepeat">${L("Heslo znovu", "Heslo znovu")}</label><input id="actionRepeat" type="password" minlength="12" maxlength="128" required autocomplete="new-password">`;
  if ((mode === "verify" || mode === "reset") && !token) {
    host.innerHTML = `<div class="dialog-form"><h1>${titles[mode]}</h1><p>${L("Odkaz je neúplný. Otvor ho priamo z emailu alebo si nechaj poslať nový.", "Odkaz je neúplný. Otevři ho přímo z emailu nebo si nech poslat nový.")}</p><a class="primary" href="${mode === "reset" ? "/zabudnute-heslo/" : "/prihlasenie/"}">${mode === "reset" ? L("Poslať nový odkaz", "Poslat nový odkaz") : L("Prihlásiť sa", "Přihlásit se")}</a></div>`;
    return;
  }
  host.innerHTML = `<form class="dialog-form" id="authActionForm"><h1>${titles[mode]}</h1>${fields}<p id="authActionStatus" role="status"></p><button class="primary" id="actionSubmit">${mode === "verify" ? L("Potvrdiť email", "Potvrdit email") : mode === "forgot" ? L("Poslať odkaz", "Poslat odkaz") : L("Uložiť heslo", "Uložit heslo")}</button><p class="auth-switch"><a href="/prihlasenie/">${L("Prihlásiť sa", "Přihlásit se")} ↗</a></p></form>`;
  $("#authActionForm").onsubmit = (e) => {
    e.preventDefault();
    if (mode === "reset" && $("#actionPassword").value !== $("#actionRepeat").value) {
      $("#authActionStatus").textContent = L("Heslá sa nezhodujú.", "Hesla se neshodují.");
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
        });
        host.innerHTML = `<div class="dialog-form"><span class="success-mark" aria-hidden="true">✓</span><h1>${esc(r.message)}</h1>${mode === "forgot" ? `<p class="modal-muted">${L("Odkaz platí 1 hodinu. Skontroluj aj spam.", "Odkaz platí 1 hodinu. Zkontroluj i spam.")}</p>` : `<a class="primary" href="${state.user ? "/ucet/" : "/prihlasenie/"}">${state.user ? L("Môj účet", "Můj účet") : L("Prihlásiť sa", "Přihlásit se")}</a>`}</div>`;
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
