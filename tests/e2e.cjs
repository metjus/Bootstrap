// End-to-end test in a real Chromium against the worker running in Miniflare (local D1 + R2).
// Run: npm run test:e2e   (needs `npx playwright install chromium` once, or PLAYWRIGHT_CHROMIUM=path)
const { createRequire } = require("node:module"),
  fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const wr = createRequire(require.resolve("wrangler/package.json"));
const { Miniflare } = wr("miniflare");
const esbuild = wr("esbuild");
const { chromium } = require("playwright-core");
const PORT = 8799,
  ORIGIN = `http://localhost:${PORT}`,
  SHOTS = process.env.E2E_SCREENSHOTS || "";
const types = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
};
(async () => {
  const bundle = await esbuild.build({
    stdin: {
      contents: "import worker from './worker.mjs';export default worker",
      resolveDir: process.cwd(),
      sourcefile: "e2e-entry.mjs",
    },
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    target: "es2022",
    external: ["node:crypto"],
  });
  const mails = [];
  const mf = new Miniflare({
    host: "localhost",
    port: PORT,
    modules: true,
    script: bundle.outputFiles[0].text,
    compatibilityDate: "2026-05-15",
    compatibilityFlags: ["nodejs_compat"],
    d1Databases: ["DB"],
    r2Buckets: ["BUCKET"],
    bindings: {
      APP_URL: ORIGIN,
      ADMIN_EMAIL: "admin@bazaro.test",
      MAIL_FROM: "Bazaro <noreply@bazaro.test>",
      RESEND_API_KEY: "test",
      OPERATOR_NAME: "Testovací prevádzkovateľ s.r.o.",
      OPERATOR_ADDRESS: "Hlavná 1, 811 01 Bratislava",
      OPERATOR_ID: "12345678",
      CONTACT_EMAIL: "info@bazaro.test",
      PUBLIC_INDEXING: "false",
    },
    serviceBindings: {
      ASSETS: async (request) => {
        const file = path.join("public", decodeURIComponent(new URL(request.url).pathname));
        if (!file.startsWith("public") || !fs.existsSync(file) || fs.statSync(file).isDirectory())
          return new Response("Not found", { status: 404 });
        return new Response(fs.readFileSync(file), {
          headers: { "Content-Type": types[path.extname(file)] || "application/octet-stream" },
        });
      },
    },
    outboundService: async (request) => {
      if (new URL(request.url).hostname === "api.resend.com") {
        mails.push(await request.json());
        return Response.json({ id: "test" });
      }
      return new Response("blocked", { status: 502 });
    },
  });
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });
  const errors = [];
  const shot = async (page, name) =>
    SHOTS &&
    (await page.waitForTimeout(900), await page.screenshot({ path: path.join(SHOTS, name + ".png"), fullPage: true }));
  async function newPage(width = 1280) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, locale: "sk-SK" });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    page.on(
      "console",
      (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push(m.text()),
    );
    return page;
  }
  const tokenFor = (email) =>
    mails
      .filter((m) => m.to[0] === email)
      .at(-1)
      .text.match(/#token=([a-f0-9]+)/)[1];
  async function registerAndLogin(page, name, email) {
    await page.goto(ORIGIN + "/registracia/");
    await page.fill("#registerName", name);
    await page.fill("#registerEmail", email);
    await page.fill("#registerPassword", "dlhe-heslo-12345");
    await page.fill("#registerRepeat", "dlhe-heslo-12345");
    await page.check("#registerTerms");
    await page.click("#registerSubmit");
    await page.getByText("Skontroluj email.").waitFor();
    await page.goto(ORIGIN + "/overenie/#token=" + tokenFor(email));
    await page.getByText("Email je overený").waitFor();
    await page.goto(ORIGIN + "/prihlasenie/");
    await page.fill("#signinEmail", email);
    await page.fill("#signinPassword", "dlhe-heslo-12345");
    await page.click("#signinSubmit");
    await page.waitForURL(ORIGIN + "/ucet/");
  }
  try {
    const db = await mf.getD1Database("DB");
    for (const file of fs.readdirSync("migrations").sort())
      for (const sql of fs.readFileSync("migrations/" + file, "utf8").split("--> statement-breakpoint"))
        if (sql.replace(/--.*$/gm, "").trim()) await db.prepare(sql).run();
    await mf.ready;

    // Empty home page
    const seller = await newPage();
    await seller.goto(ORIGIN + "/");
    await seller.getByText("Zatiaľ tu nie je žiadny inzerát").waitFor();
    await shot(seller, "01-home-empty");

    // Seller registers, verifies email and publishes a listing with a photo
    await registerAndLogin(seller, "Peter Predajca", "peter@bazaro.test");
    await shot(seller, "02-account-empty");
    const photo = path.join(require("node:os").tmpdir(), "bazaro-e2e.png");
    fs.writeFileSync(photo, await seller.screenshot());
    await seller.goto(ORIGIN + "/pridat/");
    await seller.selectOption("#draftCategory", "sport");
    await seller.locator("#draftSub:not([disabled])").waitFor();
    await seller.selectOption("#draftSub", "bicykle");
    await seller.fill("#draftTitle", "Horský bicykel Trek Marlin");
    await seller.fill("#draftDescription", "Pravidelne servisovaný, nové brzdové platničky. Osobný odber.");
    await seller.fill("#draftPrice", "420");
    await seller.fill("#draftZip", "917 01");
    await seller.fill("#draftCity", "Trnava");
    await seller.locator("#draftPlace", { hasText: "Trnava" }).waitFor();
    await shot(seller, "03a-create-details");
    await seller.click("#nextStep");
    await seller.setInputFiles("#draftUpload", photo);
    await seller.locator(".draft-photo").first().waitFor();
    await seller.click("#rotate");
    await shot(seller, "03-create-photos");
    await seller.click("#nextStep");
    await seller.check("#previewBoost");
    await shot(seller, "04-create-preview");
    await seller.click("#nextStep");
    await seller.getByText("Inzerát je zverejnený.").waitFor();
    const listingUrl = await seller.locator(".create-success a.primary").getAttribute("href");
    const listingId = Number(new URL(listingUrl, ORIGIN).searchParams.get("id"));
    assert(listingId > 0);
    await seller.goto(ORIGIN + "/ucet/");
    await seller.getByText("Horský bicykel Trek Marlin").first().waitFor();
    await seller.getByText(/Platí ešte 60 dní/).waitFor();
    await shot(seller, "05-account-listings");

    // Visitor searches without diacritics, filters by radius and opens the detail
    const visitor = await newPage(390);
    await visitor.goto(ORIGIN + "/");
    await visitor.locator("#latestRows .lrow").first().waitFor();
    await visitor.locator("#topStrip .card").first().waitFor();
    await shot(visitor, "06-home-mobile");
    await visitor.goto(ORIGIN + "/inzeraty/?q=horsky%20bicykel&mesto=Bratislava&okruh=50");
    await visitor.locator("#results .lrow").first().waitFor();
    assert.match(await visitor.textContent("#resultCount"), /^1 /);
    await shot(visitor, "07-search-mobile");
    await visitor.goto(ORIGIN + "/inzeraty/?mesto=Ko%C5%A1ice&okruh=50");
    await visitor.locator("#empty:not([hidden])").waitFor();
    await visitor.goto(ORIGIN + "/sport/bicykle/");
    await visitor.locator("#results .lrow").first().waitFor();
    assert.match(await visitor.textContent("#offersTitle"), /Bicykle/);
    await visitor.goto(ORIGIN + "/inzeraty/?q=neexistuje");
    await visitor.locator("#empty:not([hidden])").waitFor();
    await visitor.goto(ORIGIN + listingUrl);
    await visitor.getByRole("heading", { name: "Horský bicykel Trek Marlin" }).waitFor();
    await shot(visitor, "08-detail-mobile");
    await visitor.goto(ORIGIN + (await visitor.locator(".seller-card").getAttribute("href")));
    await visitor.getByRole("heading", { name: "Peter Predajca" }).waitFor();
    await visitor.locator("#results .lrow").first().waitFor();

    // Buyer contacts the seller
    const buyer = await newPage();
    await registerAndLogin(buyer, "Jana Kupujúca", "jana@bazaro.test");
    await buyer.goto(ORIGIN + listingUrl);
    await buyer.click("#revealContacts");
    await buyer.getByText("peter@bazaro.test").waitFor();
    await buyer.click("[data-fav-label]");
    await buyer.locator("[data-fav-label]", { hasText: "Uložené" }).waitFor();
    await buyer.click("#contact");
    await buyer.fill("#composerText", "Dobrý deň, je bicykel ešte dostupný?");
    await buyer.click("#composerSend");
    await buyer.getByText("Správa je odoslaná").waitFor();
    await buyer.goto(ORIGIN + (await buyer.locator("#composer a").getAttribute("href")));
    await buyer.locator(".conversation-message.outgoing").first().waitFor();
    assert(mails.some((m) => m.to[0] === "peter@bazaro.test" && /Nová správa/.test(m.subject)));

    // Seller sees the unread message and replies
    await seller.goto(ORIGIN + "/spravy/");
    await seller.locator(".thread-row.unread").first().waitFor();
    await seller.locator(".thread-row").first().click();
    await seller.getByText("je bicykel ešte dostupný").waitFor();
    await seller.fill("#messageText", "Áno, môžete si ho pozrieť zajtra.");
    await seller.click("#sendMessage");
    await seller.locator(".conversation-message.outgoing").first().waitFor();
    await shot(seller, "09-inbox");
    await buyer.getByText("môžete si ho pozrieť zajtra").waitFor({ timeout: 15000 });

    // Buyer reports the listing
    await buyer.goto(ORIGIN + "/nahlasit/?inzerat=" + listingId);
    await buyer.fill("#reportExplanation", "Fotografia nezodpovedá popisu predmetu.");
    await buyer.check("#reportConfirm");
    await buyer.click("#legalReportForm button.primary");
    await buyer.getByText("Hlásenie je uložené").waitFor();

    // Administrator hides the listing from the report queue
    const admin = await newPage();
    await registerAndLogin(admin, "Správca", "admin@bazaro.test");
    await admin.goto(ORIGIN + "/administracia/");
    await admin.locator(".admin-stat").first().waitFor();
    await shot(admin, "10-admin-overview");
    await admin.goto(ORIGIN + "/administracia/?sekcia=hlasenia");
    await admin.getByText("Fotografia nezodpovedá popisu").waitFor();
    await shot(admin, "11-admin-reports");
    await admin.click('[data-action="hide"]');
    await admin.fill("#confirmNote", "Zavádzajúca fotografia");
    await admin.click("#confirmOk");
    await admin.getByText("Žiadne hlásenia.").waitFor();
    assert(mails.some((m) => m.to[0] === "peter@bazaro.test" && /Zavádzajúca fotografia/.test(m.text)));
    await visitor.goto(ORIGIN + listingUrl);
    await visitor.getByText("Inzerát nie je dostupný").waitFor();
    await seller.goto(ORIGIN + "/ucet/");
    await seller.getByText("Skryté moderátorom").waitFor();
    await admin.goto(ORIGIN + "/administracia/?sekcia=pouzivatelia");
    await admin.getByText("jana@bazaro.test").waitFor();
    await shot(admin, "12-admin-users");
    await admin.goto(ORIGIN + "/administracia/?sekcia=zaznam");
    await admin.getByText("Skrytie inzerátu").waitFor();

    // Legal pages show configured operator details
    await visitor.goto(ORIGIN + "/kontakt/");
    await visitor.getByText("Testovací prevádzkovateľ s.r.o.").first().waitFor();
    await shot(visitor, "13-contact-mobile");
    await visitor.goto(ORIGIN + "/kategorie/");
    await visitor.locator("#catBoard .cat-tile").first().waitFor();
    await shot(visitor, "14-categories-mobile");

    assert.deepEqual(errors, [], "browser console errors");
    console.log(
      "Passed: e2e in Chromium — registration, email verification, login, listing with subcategory, PSČ and photo editor, search with radius, category page, seller page, contacts, favorites, messages, reporting, admin moderation and legal pages.",
    );
  } finally {
    await browser.close();
    await mf.dispose();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
