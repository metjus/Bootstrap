// Composes web/layout.html + web/pages/* into server/pages.mjs and copies static files to public/.
import { readdirSync, readFileSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { PLACES } from "../server/places.mjs";

const routes = [
  // [route, partial, data-page, title, description, data-action]
  ["/", "home", "home", "Bazaro — bazár pre Slovensko a Česko", "Predaj, čo nepoužívaš, a nájdi dobré veci vo svojom okolí. Pridanie inzerátu je zadarmo."],
  ["/kategorie/", "categories", "categories", "Kategórie — Bazaro", "Všetky kategórie inzerátov na Bazaro."],
  ["/inzeraty/", "listings", "listings", "Inzeráty — Bazaro", "Ponuky a dopyty z celého Slovenska a Česka."],
  ["/inzerat/", "detail", "detail", "Inzerát — Bazaro", "Inzerát na Bazaro."],
  ["/pridat/", "create", "create", "Pridať inzerát — Bazaro", "Pridaj inzerát zadarmo."],
  ["/ucet/", "account", "account", "Môj účet — Bazaro", "Správa účtu a inzerátov."],
  ["/spravy/", "inbox", "inbox", "Správy — Bazaro", "Rozhovory k inzerátom."],
  ["/administracia/", "admin", "admin", "Administrácia — Bazaro", "Administrácia bazára."],
  ["/prihlasenie/", "auth", "signin", "Prihlásenie — Bazaro", "Prihlásenie do účtu Bazaro."],
  ["/registracia/", "auth", "signup", "Registrácia — Bazaro", "Vytvor si účet na Bazaro."],
  ["/overenie/", "auth", "auth-action", "Overenie emailu — Bazaro", "Overenie emailovej adresy.", "verify"],
  ["/zabudnute-heslo/", "auth", "auth-action", "Zabudnuté heslo — Bazaro", "Obnova prístupu k účtu.", "forgot"],
  ["/obnova-hesla/", "auth", "auth-action", "Nové heslo — Bazaro", "Nastavenie nového hesla.", "reset"],
  ["/podmienky/", "terms", "legal", "Podmienky používania — Bazaro", "Podmienky používania služby Bazaro."],
  ["/ochrana-udajov/", "privacy", "legal", "Ochrana osobných údajov — Bazaro", "Informácie o spracúvaní osobných údajov."],
  ["/cookies/", "cookies", "legal", "Cookies — Bazaro", "Cookies a ukladanie v prehliadači."],
  ["/pravidla-inzercie/", "rules", "legal", "Pravidlá inzercie — Bazaro", "Čo môže a nemôže obsahovať inzerát."],
  ["/kontakt/", "contact", "legal", "Kontakt a prevádzkovateľ — Bazaro", "Kontaktné údaje prevádzkovateľa."],
  ["/nahlasit/", "report", "legal", "Nahlásiť obsah — Bazaro", "Nahlásenie nezákonného alebo nevhodného obsahu."],
  ["__404", "404", "notfound", "Stránka neexistuje — Bazaro", "Stránka sa nenašla."],
];

rmSync("public", { recursive: true, force: true });
mkdirSync("public", { recursive: true });
const hash = createHash("sha256");
function copyTree(from, to) {
  for (const e of readdirSync(from, { withFileTypes: true })) {
    if (e.name === "pages" || e.name === "layout.html") continue;
    const src = path.join(from, e.name),
      dest = path.join(to, e.name);
    if (e.isDirectory()) {
      mkdirSync(dest, { recursive: true });
      copyTree(src, dest);
    } else {
      hash.update(e.name).update(readFileSync(src));
      copyFileSync(src, dest);
    }
  }
}
// web/js/* is served from the site root (/core.js, /home.js, …).
copyTree("web/js", "public");
for (const e of readdirSync("web", { withFileTypes: true }))
  if (!["js", "pages", "layout.html"].includes(e.name)) {
    if (e.isDirectory()) {
      mkdirSync(path.join("public", e.name), { recursive: true });
      copyTree(path.join("web", e.name), path.join("public", e.name));
    } else {
      hash.update(e.name).update(readFileSync(path.join("web", e.name)));
      copyFileSync(path.join("web", e.name), path.join("public", e.name));
    }
  }
const places = "window.BAZARO_PLACES=" + JSON.stringify(PLACES) + ";\n";
writeFileSync("public/places.js", places);
hash.update(places);
const layout = readFileSync("web/layout.html", "utf8");
hash.update(layout);
const pages = {},
  partials = {};
for (const [, partial] of routes) partials[partial] ??= readFileSync(`web/pages/${partial}.html`, "utf8");
for (const p of Object.values(partials)) hash.update(p);
const build = hash.digest("hex").slice(0, 10);
const attr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
for (const [route, partial, page, title, description, action] of routes)
  pages[route] = layout
    .replace("{{MAIN}}", () => partials[partial].trim())
    .replaceAll("{{PAGE}}", page)
    .replaceAll("{{ACTION}}", action ? ` data-action="${action}"` : "")
    .replaceAll("{{TITLE}}", attr(title))
    .replaceAll("{{DESCRIPTION}}", attr(description))
    .replaceAll("{{BUILD}}", build);
writeFileSync("server/pages.mjs", "export const pages = " + JSON.stringify(pages) + ";\n");
console.log(`Build ${build}: ${routes.length} stránok, statické súbory v public/.`);
