import test from "node:test";
import assert from "node:assert/strict";
import { handle } from "../worker.mjs";
const env = {
  PUBLIC_INDEXING: "false",
  ASSETS: { fetch: async () => new Response("asset", { headers: { "Content-Type": "text/css" } }) },
  DB: {
    prepare() {
      return {
        bind() {
          return this;
        },
        async first() {
          return null;
        },
      };
    },
  },
  BUCKET: {},
};
test("standalone HTML routes, privacy headers, indexing switch and assets", async () => {
  let r = await handle(new Request("https://bazaro.test/"), env);
  assert.equal(r.status, 200);
  assert((await r.text()).includes("bazaro"));
  assert.equal(r.headers.get("X-Robots-Tag"), "noindex, nofollow");
  assert(r.headers.get("Content-Security-Policy").includes("frame-ancestors 'none'"));
  r = await handle(new Request("https://bazaro.test/kategorie", { method: "HEAD" }), env);
  assert.equal(r.status, 200);
  assert.equal(await r.text(), "");
  assert((await (await handle(new Request("https://bazaro.test/robots.txt"), env)).text()).includes("Disallow: /"));
  assert.equal((await handle(new Request("https://bazaro.test/sitemap.xml"), env)).status, 404);
  assert.equal(
    (await handle(new Request("https://bazaro.test/style.css"), env)).headers.get("Content-Type"),
    "text/css",
  );
  assert.equal((await handle(new Request("https://bazaro.test/", { method: "POST" }), env)).status, 405);
  r = await handle(new Request("https://bazaro.test/"), { ...env, PUBLIC_INDEXING: "true" });
  assert.equal(r.headers.get("X-Robots-Tag"), null);
  r = await handle(new Request("https://bazaro.test/ucet/"), { ...env, PUBLIC_INDEXING: "true" });
  assert.equal(r.headers.get("X-Robots-Tag"), "noindex, nofollow");
});
test("operator details come from configuration and unknown paths return the 404 page", async () => {
  let r = await handle(new Request("https://bazaro.test/kontakt/"), env);
  let html = await r.text();
  assert(html.includes("údaj doplní prevádzkovateľ"));
  assert(!html.includes("{{OPERATOR_NAME}}"));
  r = await handle(new Request("https://bazaro.test/kontakt/"), {
    ...env,
    OPERATOR_NAME: "Bazaro s.r.o.",
    OPERATOR_ADDRESS: "Hlavná 1, Bratislava",
    CONTACT_EMAIL: "info@bazaro.sk",
  });
  html = await r.text();
  assert(html.includes("Bazaro s.r.o.") && html.includes("mailto:info@bazaro.sk"));
  r = await handle(new Request("https://bazaro.test/podmienky/"), { ...env, OPERATOR_NAME: "<script>x</script>" });
  assert(!(await r.text()).includes("<script>x</script>"));
  r = await handle(new Request("https://bazaro.test/neexistuje/"), {
    ...env,
    ASSETS: { fetch: async () => new Response("missing", { status: 404 }) },
  });
  assert.equal(r.status, 404);
  assert((await r.text()).includes("Táto stránka sa už predala"));
  assert.equal(
    (
      await handle(new Request("https://bazaro.test/__404"), {
        ...env,
        ASSETS: { fetch: async () => new Response("x", { status: 404 }) },
      })
    ).status,
    404,
  );
});
test("category pages, site name and sitemap", async () => {
  let r = await handle(new Request("https://bazaro.test/auto/osobne-auta/"), { ...env, SITE_NAME: "Bazárik" });
  assert.equal(r.status, 200);
  const html = await r.text();
  assert(html.includes("<title>Osobné autá — Auto — bazár Bazárik</title>"));
  assert(html.includes('data-page="listings"'));
  assert(!html.includes("{{SITE_NAME}}"));
  assert.equal((await handle(new Request("https://bazaro.test/auto"), env)).status, 301);
  assert.equal(
    (
      await handle(new Request("https://bazaro.test/auto/neexistuje/"), {
        ...env,
        ASSETS: { fetch: async () => new Response("x", { status: 404 }) },
      })
    ).status,
    404,
  );
  r = await handle(new Request("https://bazaro.test/sitemap.xml"), {
    ...env,
    PUBLIC_INDEXING: "true",
    DB: {
      prepare: () => ({
        bind() {
          return this;
        },
        async all() {
          return { results: [] };
        },
      }),
    },
  });
  const xml = await r.text();
  assert(xml.includes("https://bazaro.test/reality/byty/"));
  assert(!xml.includes("/predajca/"));
});
test("forged platform headers do not grant moderation on public hosting", async () => {
  const r = await handle(
    new Request("https://bazaro.test/api/admin/reports", {
      headers: { "oai-authenticated-user-id": "owner", "oai-authenticated-user-email": "admin@example.sk" },
    }),
    { ...env, ADMIN_EMAIL: "admin@example.sk" },
  );
  assert.equal(r.status, 403);
});
