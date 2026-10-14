# Bazaro — bazár pre Cloudflare Workers

Kompletný bazár pre Slovensko a Česko: web, používateľské účty, inzeráty s fotografiami, správy a administrácia. Beží ako jeden Cloudflare Worker s databázou D1 a úložiskom fotografií R2. Neobsahuje žiadne demo inzeráty ani ukážkové účty — po nasadení je databáza prázdna.

## Čo bazár obsahuje

**Web**
- Úvod so zvýraznenými (Boost) ponukami, alebo najnovšími inzerátmi, ak žiadne zvýraznené nie sú.
- Kategórie, výpis inzerátov s vyhľadávaním na serveri (bez ohľadu na diakritiku), filtrami (Predám/Kúpim, kategória, cena, stav, mesto/PSČ, okruh v km), zoradením a stránkovaním.
- Detail inzerátu s galériou, kontaktmi pre prihlásených, obľúbenými, zdieľaním, podobnými ponukami a nahlásením.
- Pridanie inzerátu v 3 krokoch: údaje, 1–8 fotografií s úpravou (otočenie, orez, jas), náhľad. Rozpracovaný inzerát sa ukladá v prehliadači.
- Správy: rozhovor ku každému inzerátu, neprečítané, vyhľadávanie, priebežné načítanie nových správ, blokovanie, skrytie, emailové upozornenia.
- Môj účet: moje inzeráty (úprava vrátane fotografií, ukončenie, obnovenie, odstránenie, Boost), obľúbené, nastavenia (profil, zmena emailu s overením, zmena hesla, export údajov, odstránenie účtu).
- Registrácia s overením emailu, prihlásenie, obnova hesla. Slovenčina a čeština, mobilné rozloženie.
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
- Denná údržba cez Cron: maže expirované relácie, tokeny, limity a neuložené fotografie.
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
npm run configure          # ID databázy, adresa webu, admin email, odosielateľ, údaje prevádzkovateľa
npm run db:remote          # vytvorí tabuľky (migrácie 0001 a 0002)
npx wrangler secret put RESEND_API_KEY
npm run deploy
```

- `APP_URL` má tvar `https://bazaro.TVOJ-SUBDOMAIN.workers.dev` (bez lomky na konci), neskôr tvoja doména.
- `ADMIN_EMAIL` môže obsahovať viac adries oddelených čiarkou.
- `MAIL_FROM` napr. `Bazaro <noreply@mail.tvojadomena.sk>` — musí byť z domény overenej v Resend.
- `npm run deploy` odmietne nasadenie, kým nie je konfigurácia vyplnená.

### Overenie po nasadení

1. Otvor `/api/health` — `database`, `storage`, `email` a `admin` musia byť `true`.
2. Zaregistruj sa presne s `ADMIN_EMAIL`, potvrď email a prihlás sa. V účte uvidíš odkaz **Administrácia**.
3. Druhým účtom vyskúšaj pridanie inzerátu, správy, obľúbené, nahlásenie a v administrácii jeho vybavenie.

### Aktualizácia existujúceho nasadenia

Ak už beží staršia verzia, spusti `npm run db:remote` (pridá migráciu `0002_production.sql`, existujúce dáta zostanú) a potom `npm run deploy`. Vyhľadávací index pre staršie inzeráty sa doplní automaticky. Ak máš v databáze testovacie inzeráty, odstráň ich v **Administrácia → Inzeráty**.

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
- `web/layout.html` — spoločná hlavička a pätička; `web/pages/*.html` — obsah stránok; `web/js/*.js` — klientsky kód; `web/*.css` — štýly.
- `scripts/build.mjs` zloží stránky do `server/pages.mjs` a statické súbory do `public/` (oba sú generované, needituj ich).
- `server/api.mjs` — API, `server/places.mjs` — mestá pre filter vzdialenosti, `worker.mjs` — vstup Workera, `migrations/` — databáza. Už aplikovanú migráciu nemeň; zmeny patria do novej.

## Známe obmedzenia

- Boost je zatiaľ bezplatný; platobná brána nie je zapojená.
- Filter vzdialenosti pozná ~100 väčších miest SK/CZ; ostatné obce sa hľadajú podľa názvu.
- Správy sa obnovujú každých pár sekúnd (nie websockety); na notifikačný email sa nedá odpovedať.
