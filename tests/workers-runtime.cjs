const { createRequire } = require("node:module"),
  { readFileSync } = require("node:fs"),
  assert = require("node:assert/strict");
const wr = createRequire(require.resolve("wrangler/package.json"));
const { Miniflare } = wr("miniflare");
const esbuild = wr("esbuild");
(async () => {
  const bundle = await esbuild.build({
    stdin: {
      contents: "import worker from './worker.mjs';export default worker",
      resolveDir: process.cwd(),
      sourcefile: "runtime-entry.mjs",
    },
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    target: "es2022",
    external: ["node:crypto"],
  });
  const mf = new Miniflare({
    modules: true,
    script: bundle.outputFiles[0].text,
    compatibilityDate: "2026-05-15",
    compatibilityFlags: ["nodejs_compat"],
    d1Databases: ["DB"],
    r2Buckets: ["BUCKET"],
  });
  try {
    const db = await mf.getD1Database("DB");
    for (const file of require("node:fs").readdirSync("migrations").sort())
      for (const sql of readFileSync("migrations/" + file, "utf8").split("--> statement-breakpoint"))
        if (sql.replace(/--.*$/gm, "").trim()) await db.prepare(sql).run();
    const health = await mf.dispatchFetch("https://market.test/api/health");
    assert.equal(health.status, 200);
    const homepage = await mf.dispatchFetch("https://market.test/");
    assert.equal(homepage.status, 200);
    assert.equal(homepage.headers.get("X-Robots-Tag"), "noindex, nofollow");
    const boot = await mf.dispatchFetch("https://market.test/api/bootstrap");
    assert.equal(boot.status, 200);
    assert.equal((await boot.json()).user, null);
    const empty = await mf.dispatchFetch("https://market.test/api/listings?country=sk");
    assert.equal((await empty.json()).total, 0);
    const login = await mf.dispatchFetch("https://market.test/api/auth/login", {
      method: "POST",
      headers: { Origin: "https://market.test", "x-bazar-request": "1", "content-type": "application/json" },
      body: JSON.stringify({ email: "missing@example.sk", password: "long-password-123" }),
    });
    assert.equal(login.status, 401);
    const reg = await mf.dispatchFetch("https://market.test/api/auth/register", {
      method: "POST",
      headers: { Origin: "https://market.test", "x-bazar-request": "1", "content-type": "application/json" },
      body: JSON.stringify({
        name: "Test user",
        email: "test@example.sk",
        password: "long-password-123",
        repeat: "long-password-123",
        terms: true,
      }),
    });
    assert.equal(reg.status, 503);
    const { createHash } = require("node:crypto"),
      sessionToken = "runtime-token",
      owner = "runtime-owner",
      csrf = "runtime-csrf";
    await db
      .prepare("INSERT INTO users(id,email,name,password,verified,created,terms) VALUES(?,?,?,?,1,?,?)")
      .bind(owner, "runtime@example.sk", "Runtime tester", "unused", Date.now(), Date.now())
      .run();
    await db
      .prepare("INSERT INTO sessions(hash,user_id,csrf,expires) VALUES(?,?,?,?)")
      .bind(createHash("sha256").update(sessionToken).digest("hex"), owner, csrf, Date.now() + 60000)
      .run();
    const call = async (path, method, body) =>
      mf.dispatchFetch("https://market.test/api/" + path, {
        method,
        headers: {
          Origin: "https://market.test",
          "x-bazar-request": "1",
          "x-csrf-token": csrf,
          cookie: "__Host-bazar_session=" + sessionToken,
          "content-type": body instanceof Uint8Array ? "image/jpeg" : "application/json",
        },
        body: body instanceof Uint8Array ? body : JSON.stringify(body),
      });
    const jpeg = new Uint8Array([255, 216, 255, 224, 0, 0]);
    const p1 = await (await call("uploads", "POST", jpeg)).json(),
      p2 = await (await call("uploads", "POST", jpeg)).json();
    const created = await call("listings", "POST", {
      submission: "native",
      title: "Native bicykel",
      desc: "Bicykel v dobrom stave, osobný odber.",
      cat: "sport",
      sub: "bicykle",
      price: 150,
      zip: "81101",
      city: "Bratislava",
      state: "Používané",
      uploadIds: [p1.id, p2.id],
    });
    assert.equal(created.status, 201);
    const id = (await created.json()).id;
    assert.equal((await call("listings/" + id, "PATCH", { uploadIds: [p2.id] })).status, 200);
    assert.equal(
      (await db.prepare("SELECT photos FROM listings WHERE id=?").bind(id).first()).photos,
      JSON.stringify([p2.id]),
    );
    const bucket = await mf.getR2Bucket("BUCKET");
    assert.equal(await bucket.get(p1.id), null);
    assert(await bucket.get(p2.id));
    assert.equal((await call("listings/" + id, "PATCH", { uploadIds: [] })).status, 400);
    const found = await mf.dispatchFetch("https://market.test/api/listings?q=bicykel&loc=81101&radius=10");
    assert.equal((await found.json()).total, 1);
    const media = await mf.dispatchFetch("https://market.test/media/" + p2.id);
    assert.equal(media.status, 200);
    console.log(
      "Passed: native Workerd crypto/scrypt, D1 migrated schema, R2 binding, health/bootstrap fail-closed registration, atomic photo replacement and server search with native D1/R2.",
    );
  } finally {
    await mf.dispose();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
