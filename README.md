# Bazaro — bazár pre Cloudflare Workers

Kompletný bazár pre Slovensko: web, používateľské účty, inzeráty s fotografiami, správy a administrácia. Beží ako jeden Cloudflare Worker s databázou D1 a úložiskom fotografií R2. Neobsahuje žiadne demo inzeráty ani ukážkové účty — po nasadení je databáza prázdna.

## Čo bazár obsahuje

**Web**
- Úvod so zvýraznenými (Boost) ponukami, alebo najnovšími inzerátmi, ak žiadne zvýraznené nie sú.
- 19 kategórií s podkategóriami (`server/catalog.mjs`), vlastné adresy kategórií (`/auto/`, `/auto/osobne-auta/`).
- Výpis inzerátov ako na bazos.sk: riadky s náhľadovou fotkou, vyhľadávanie na serveri (bez ohľadu na diakritiku), filtre (Predám/Kúpim, kategória, podkategória, cena, stav, iba s fotkou, PSČ alebo obec + okruh v km), zoradenie a stránkovanie.
- Cena: pevná suma, **Zadarmo**, **Dohodou** alebo vlastný text (napr. „Ponúknite“). Inzeráty bez ceny sa pri zoradení podľa ceny radia na koniec.
- PSČ: každé slovenské PSČ sa priradí k najbližšiemu zo 105 referenčných miest (okresné mestá a väčšie obce), takže okruh 10–20 km funguje bez 50 km nepresnosti. Presné súradnice všetkých PSČ doplníš príkazom `npm run postal` (stiahne otvorené dáta GeoNames).
- Detail inzerátu s galériou, kontaktmi pre prihlásených, obľúbenými, zdieľaním, **ďalšími inzerátmi predajcu**, podobnými ponukami a nahlásením. Stránka predajcu `/predajca/?id=…` so všetkými jeho aktívnymi inzerátmi.
- Platnosť inzerátu **60 dní**; 3 dni pred koncom príde email a posledných 7 dní sa dá jedným klikom predĺžiť o ďalších 60 dní.
- Fotografie sa pri nahratí zmenšia a uloží sa aj náhľad (rýchle výpisy).
- Ochrana proti spamu Cloudflare Turnstile pri registrácii a pridaní inzerátu (voliteľná).
- Pridanie inzerátu v 3 krokoch: údaje, 1–8 fotografií s úpravou (otočenie, orez, jas), náhľad. Rozpracovaný inzerát sa ukladá v prehliadači.
- Správy: rozhovor ku každému inzerátu, neprečítané, vyhľadávanie, priebežné načítanie nových správ, blokovanie, skrytie, emailové upozornenia.
- Môj účet: moje inzeráty (úprava vrátane fotografií, ukončenie, obnovenie, odstránenie, Boost), obľúbené, nastavenia (profil, zmena emailu s overením, zmena hesla, export údajov, odstránenie účtu).
- Registrácia s overením emailu, prihlásenie, obnova hesla. Iba slovenčina, mobilné rozloženie so spodnou navigáciou.
- Právne stránky (podmienky, ochrana údajov, cookies, pravidlá inzercie, kontakt, nahlásenie obsahu). Údaje prevádzkovateľa sa dopĺňajú z konfigurácie.

**Administrácia** (`/administracia/`, prístup majú overené účty z `ADMIN_EMAIL`)
- Prehľad: používatelia, inzeráty, hlásenia, správy, úložisko, inzeráty podľa kategórií.
- Hlásenia: otvorené/vybavené, skrytie alebo odstránenie inzerátu s dôvodom (inzerent dostane email), vybavenie bez zásahu, znovuotvorenie.
- Inzeráty: vyhľadávanie podľa textu, ID alebo emailu, filtrovanie podľa stavu, skrytie, obnovenie, odstránenie, zrušenie Boostu.
- Používatelia: vyhľadávanie, zablokovanie s dôvodom (odhlási ho a jeho inzeráty zmiznú z webu), odblokovanie, ručné overenie, odhlásenie všade, odstránenie účtu.
- Záznam všetkých administrátorských akcií.
- Pri novom hlásení príde administrátorom email.

**Bezpečnosť a prevádzka**
- Heslá scrypt, HttpOnly/Secure relácie, CSRF a kontrola Origin, limity pokusov, kontrola vlastníctva inzerátov a fotografií, CSP a ďalšie bezpečnostné hlavičky.
- Denná údržba cez Cron: maže expirované relácie, tokeny, limity a neuložené fotografie, posiela upozornenia na končiace inzeráty.
- robots.txt, sitemap.xml a indexovanie zapínané premennou `PUBLIC_INDEXING`.

## Čo potrebuješ

1. Node.js 22.13+ a terminál (napr. PowerShell).
2. Účet Cloudflare s **Workers Paid** (scrypt potrebuje viac CPU, než dovolí bezplatný plán), D1 databázu a R2 bucket.
3. Účet [Resend](https://resend.com) s overenou odosielacou doménou. Bez emailov registrácia zámerne nefunguje.
4. Údaje prevádzkovateľa: meno/názov, adresa, IČO (ak máš) a verejný kontaktný email.

## Nasadenie krok za krokom

V priečinku projektu (tam, kde je `package.json`):

```powershell
npm install
npx wrangler login
npx wrangler d1 create bazaro-db
npx wrangler r2 bucket create bazaro-photos
npm run configure          # ID databázy, názov webu, adresa webu, admin email, odosielateľ, údaje prevádzkovateľa, Turnstile
npm run db:remote          # vytvorí tabuľky (migrácie 0001–0003)
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put TURNSTILE_SECRET   # len ak používaš Turnstile
npm run deploy
```

- `APP_URL` má tvar `https://bazaro.TVOJ-SUBDOMAIN.workers.dev` (bez lomky na konci), neskôr tvoja doména.
- `SITE_NAME` je názov bazára (logo, titulky, emaily, právne texty). Zmeníš ho kedykoľvek bez úprav kódu.
- `ADMIN_EMAIL` môže obsahovať viac adries oddelených čiarkou.
- `MAIL_FROM` napr. `Bazaro <noreply@mail.tvojadomena.sk>` — musí byť z domény overenej v Resend.
- `npm run deploy` odmietne nasadenie, kým nie je konfigurácia vyplnená.
- Turnstile (voliteľné): Cloudflare → Turnstile → Add widget, doména tvojho webu, režim Managed. Site key daj do `TURNSTILE_SITE_KEY` vo `wrangler.jsonc`, Secret key cez `npx wrangler secret put TURNSTILE_SECRET`. Bez nich web funguje, len bez tejto ochrany.
- Presné PSČ (voliteľné): `npm run postal` a potom `npm run deploy`.

### Overenie po nasadení

1. Otvor `/api/health` — `database`, `storage`, `email` a `admin` musia byť `true`.
2. Zaregistruj sa presne s `ADMIN_EMAIL`, potvrď email a prihlás sa. V účte uvidíš odkaz **Administrácia**.
3. Druhým účtom vyskúšaj pridanie inzerátu, správy, obľúbené, nahlásenie a v administrácii jeho vybavenie.

### Aktualizácia existujúceho nasadenia

Ak už beží staršia verzia, spusti `npm run db:remote` (pridá chýbajúce migrácie `0002_production.sql` a `0003_catalog.sql`, existujúce dáta zostanú; staré kategórie sa premapujú na nové) a potom `npm run deploy`. Vyhľadávací index pre staršie inzeráty sa doplní automaticky. Ak máš v databáze testovacie inzeráty, odstráň ich v **Administrácia → Inzeráty**.

## Doména a verejné spustenie

- Doménu pripojíš v Cloudflare → Worker → Settings → Domains & Routes → Custom Domain. Potom zmeň `APP_URL` a znova nasaď.
- Keď je web pripravený pre verejnosť, nastav `"PUBLIC_INDEXING": "true"` vo `wrangler.jsonc` a nasaď.
- Právne texty sú pripravené pre bežnú prevádzku bazára, no **nechaj ich skontrolovať právnikom** a over, že zodpovedajú tvojej prevádzke.
- Zapni zálohy D1 (Time Travel je v D1 automaticky; pre dlhšie zálohy použi `npx wrangler d1 export`).

## Vývoj

```powershell
npm run dev            # lokálny server (vytvor si .dev.vars podľa .dev.vars.example)
npm run db:local       # migrácie lokálnej databázy
npm test               # API a routing testy
npm run test:runtime   # test v natívnom Workerd s D1/R2
npm run test:e2e       # test v prehliadači (raz: npx playwright-core install chromium)
```

Štruktúra:
- `web/layout.html` — spoločná hlavička a pätička; `web/pages/*.html` — obsah stránok; `web/js/*.js` — klientsky kód; `web/app.css` — dizajn; `web/fonts/` — písma (Bricolage Grotesque, Inter; licencia OFL).
- `scripts/build.mjs` zloží stránky do `server/pages.mjs` a statické súbory do `public/` (oba sú generované, needituj ich).
- `server/api.mjs` — API, `server/catalog.mjs` — kategórie a podkategórie, `server/places.mjs` — PSČ a mestá pre filter vzdialenosti, `server/icons.mjs` — ikony, `worker.mjs` — vstup Workera, `migrations/` — databáza. Už aplikovanú migráciu nemeň; zmeny patria do novej.

## Známe obmedzenia

- Boost je zatiaľ bezplatný; platobná brána nie je zapojená.
- Bez `npm run postal` je poloha inzerátu daná referenčným mestom podľa prvých 3 číslic PSČ (presnosť zvyčajne do ~15 km).
- Správy sa obnovujú každých pár sekúnd (nie websockety); na notifikačný email sa nedá odpovedať.
