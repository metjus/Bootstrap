import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync } from "node:fs";
import { api, media, maintenance } from "../server/api.mjs";
function setup() {
  const sql = new DatabaseSync(":memory:");
  for (const f of readdirSync("migrations").sort()) sql.exec(readFileSync("migrations/" + f, "utf8"));
  const blobs = new Map(),
    mails = [];
  const db = {
    prepare(q) {
      let args = [];
      return {
        bind(...a) {
          args = a;
          return this;
        },
        async first() {
          return sql.prepare(q).get(...args) || null;
        },
        async all() {
          return { results: sql.prepare(q).all(...args) };
        },
        async run() {
          const r = sql.prepare(q).run(...args);
          return { meta: { changes: r.changes } };
        },
      };
    },
    async batch(ss) {
      sql.exec("BEGIN");
      try {
        const r = [];
        for (const s of ss) r.push(await s.run());
        sql.exec("COMMIT");
        return r;
      } catch (e) {
        sql.exec("ROLLBACK");
        throw e;
      }
    },
  };
  const env = {
    DB: db,
    BUCKET: {
      async put(id, bytes) {
        blobs.set(id, bytes);
      },
      async get(id) {
        return blobs.has(id) ? { body: blobs.get(id) } : null;
      },
      async delete(id) {
        blobs.delete(id);
      },
    },
    APP_URL: "https://market.test",
    RESEND_API_KEY: "test",
    MAIL_FROM: "bazaar@example.test",
    ADMIN_EMAIL: "admin@example.test",
  };
  const services = {
    mail: async (_, o) => {
      mails.push(JSON.parse(o.body));
      return new Response("{}");
    },
  };
  async function call(path, method = "GET", body, user, headers = {}) {
    const h = { Origin: "https://market.test", "x-bazar-request": "1", ...headers };
    if (user) {
      h.cookie = user.cookie;
      h["x-csrf-token"] = user.csrf;
    }
    Object.assign(h, headers);
    if (body !== undefined) h["Content-Type"] = body instanceof Uint8Array ? "image/jpeg" : "application/json";
    const r = await api(
      new Request("https://market.test/api/" + path, {
        method,
        headers: h,
        body: body === undefined ? undefined : body instanceof Uint8Array ? body : JSON.stringify(body),
      }),
      env,
      services,
    );
    return { status: r.status, v: await r.json(), cookie: r.headers.get("set-cookie")?.split(";")[0] };
  }
  async function register(email) {
    const b = { email, name: "Test user", password: "long-password-123", repeat: "long-password-123", terms: true };
    assert.equal((await call("auth/register", "POST", b)).status, 202);
    const token = mails.at(-1).text.match(/#token=([a-f0-9]+)/)[1];
    assert.equal((await call("auth/verify", "POST", { token })).status, 200);
    assert.equal((await call("auth/verify", "POST", { token })).status, 400);
    const r = await call("auth/login", "POST", b);
    assert.equal(r.status, 200);
    return { cookie: r.cookie, csrf: r.v.csrf, id: r.v.user.id };
  }
  const jpeg = new Uint8Array([255, 216, 255, 224, 0, 0]);
  const upload = async (user) => (await call("uploads", "POST", jpeg, user)).v.id;
  async function listing(user, extra = {}) {
    const photo = extra.buy ? null : await upload(user);
    const r = await call(
      "listings",
      "POST",
      {
        submission: "s" + Math.random(),
        title: "Mestský bicykel",
        desc: "Bicykel v dobrom stave. Osobné vyzdvihnutie.",
        cat: "Šport",
        price: 150,
        city: "Bratislava",
        state: "Používané",
        country: "sk",
        uploadIds: photo ? [photo] : [],
        ...extra,
      },
      user,
    );
    assert.equal(r.status, 201, JSON.stringify(r.v));
    return r.v.id;
  }
  return { sql, env, blobs, mails, call, register, upload, listing };
}
test("account, listing, favorites, conversations, blocking, moderation, reset and deletion", async () => {
  const { call, register, sql, env, blobs, mails, upload } = setup();
  const seller = await register("seller@example.sk"),
    buyer = await register("buyer@example.sk"),
    other = await register("other@example.sk");
  const image = await upload(seller);
  assert.equal(blobs.size, 1);
  const fields = {
    submission: "draft1",
    title: "Mestský bicykel",
    desc: "Bicykel v dobrom stave. Osobné vyzdvihnutie.",
    cat: "Šport",
    price: 150,
    city: "Bratislava",
    state: "Používané",
    country: "sk",
    uploadIds: [image],
  };
  const created = await call("listings", "POST", fields, seller);
  assert.equal(created.status, 201);
  const id = created.v.id;
  assert.equal((await call("listings", "POST", { ...fields, submission: "work", cat: "Práca" }, seller)).status, 400);
  assert.equal((await call("listings/" + id, "PATCH", { cat: "Práca" }, seller)).status, 400);
  assert.equal((await call("listings", "POST", fields, seller)).v.id, id);
  assert.equal((await call("listings/" + id, "PATCH", { status: "sold" }, buyer)).status, 404);
  let list = await call("listings?country=sk");
  assert.equal(list.v.total, 1);
  assert.equal(list.v.listings[0].phone, undefined);
  assert.equal(list.v.listings[0].email, undefined);
  assert.equal(list.v.listings[0].city, "Bratislava");
  assert.equal((await call("listings/" + id + "/contacts", "POST", {})).status, 401);
  assert.equal((await call("listings/" + id + "/contacts", "POST", {}, buyer)).v.email, "seller@example.sk");
  assert.equal((await call("favorites", "POST", { id, save: true }, buyer)).status, 200);
  assert.deepEqual((await call("bootstrap", "GET", undefined, buyer)).v.favorites, [id]);
  assert.equal((await call("me/favorites", "GET", undefined, buyer)).v.total, 1);
  assert.equal((await call("listings?saved=1", "GET", undefined, buyer)).v.total, 1);
  assert.equal((await call("listings?saved=1")).status, 401);
  await call("listings/" + id + "/view", "POST", {}, buyer);
  await call("listings/" + id + "/view", "POST", {}, buyer);
  await call("listings/" + id + "/view", "POST", {}, seller);
  assert.equal((await call("listings/" + id)).v.listing.viewCount, 1);
  const c1 = (await call("conversations", "POST", { id }, buyer)).v.id,
    c2 = (await call("conversations", "POST", { id }, other)).v.id;
  assert.notEqual(c1, c2);
  assert.equal((await call("conversations", "POST", { id }, seller)).status, 400);
  // the seller does not see a conversation until the buyer writes
  assert.equal((await call("inbox", "GET", undefined, seller)).v.total, 0);
  assert.equal((await call("conversations/" + c1 + "/messages", "POST", { text: "Je to aktuálne?" }, other)).status, 404);
  const mailsBefore = mails.length;
  assert.equal((await call("conversations/" + c1 + "/messages", "POST", { text: "Je to aktuálne?" }, buyer)).status, 201);
  assert.equal((await call("conversations/" + c1 + "/messages", "POST", { text: "Ešte otázka." }, buyer)).status, 201);
  assert.equal(mails.length, mailsBefore + 1, "only the first unread message triggers an email");
  assert.match(mails.at(-1).text, /spravy\/\?inzerat=/);
  let inbox = await call("inbox", "GET", undefined, seller);
  assert.equal(inbox.v.total, 1);
  assert.equal(inbox.v.unread, 2);
  assert.equal(inbox.v.threads[0].last, "Ešte otázka.");
  assert.equal((await call("bootstrap", "GET", undefined, seller)).v.unread, 2);
  assert.equal(
    (await call("conversations/" + c1 + "/messages", "POST", { text: "Áno, dohodnime odber." }, seller)).status,
    201,
  );
  const thread = await call("conversations/" + c1, "GET", undefined, buyer);
  assert.equal(thread.v.messages.length, 3);
  assert.equal(thread.v.thread.role, "buyer");
  const last = thread.v.messages[1];
  const newer = await call(`conversations/${c1}/messages?after=${last.sentAt}&afterId=${last.id}`, "GET", undefined, buyer);
  assert.equal(newer.v.messages.at(-1).text, "Áno, dohodnime odber.");
  assert.equal((await call("conversations/" + c1 + "/read", "POST", {}, seller)).v.unread, 0);
  assert.equal((await call("inbox?filter=unread", "GET", undefined, seller)).v.total, 0);
  assert.equal((await call("inbox?q=bicykel", "GET", undefined, seller)).v.total, 1);
  assert.equal((await call("conversations/" + c1 + "/block", "POST", { block: true }, buyer)).status, 200);
  assert.equal((await call("conversations/" + c1 + "/messages", "POST", { text: "Test blokovania" }, seller)).status, 403);
  assert.equal((await call("conversations/" + c1, "GET", undefined, seller)).v.thread.blockedBy, true);
  await call("conversations/" + c1 + "/block", "POST", { block: false }, buyer);
  await call("conversations/" + c1 + "/read", "POST", {}, buyer);
  assert.equal(sql.prepare("SELECT read FROM messages WHERE sender=?").get(seller.id).read, 1);
  await call(
    "reports",
    "POST",
    { listingId: id, reason: "Podozrenie", details: "Prosím skontrolovať tento inzerát.", email: "buyer@example.sk", confirm: true },
    buyer,
  );
  assert.equal((await call("admin/reports", "GET", undefined, buyer)).status, 403);
  const native = { "oai-authenticated-user-id": "owner", "oai-authenticated-user-email": "admin@example.test" };
  assert.equal((await call("admin/reports", "GET", undefined, buyer, native)).status, 403);
  const admin = await register("admin@example.test");
  assert.equal((await call("bootstrap", "GET", undefined, admin)).v.user.admin, true);
  const rs = await call("admin/reports?status=open", "GET", undefined, admin);
  assert.equal(rs.status, 200);
  assert.equal(rs.v.total, 1);
  assert.equal((await call("admin/reports/" + rs.v.reports[0].id, "POST", { action: "hide", note: "Podvod" }, admin)).status, 200);
  assert.match(mails.at(-1).text, /Podvod/);
  assert.equal((await call("listings?country=sk")).v.total, 0);
  assert.equal((await call("admin/reports?status=open", "GET", undefined, admin)).v.total, 0);
  assert.equal((await call("listings/" + id)).status, 404);
  assert.equal((await call("listings/" + id, "GET", undefined, seller)).v.listing.moderationNote, "Podvod");
  assert.equal((await call("listings/" + id, "GET", undefined, admin)).v.listing.adminView, true);
  assert.equal((await call("listings/" + id, "PATCH", { title: "Skúsim upraviť" }, seller)).status, 403);
  assert.equal((await media(new Request("https://market.test/media/" + image), env)).status, 404);
  assert.equal((await media(new Request("https://market.test/media/" + image, { headers: { cookie: admin.cookie } }), env)).status, 200);
  assert.equal((await call("admin/listings/" + id, "POST", { action: "restore" }, admin)).status, 200);
  assert.equal((await call("listings?country=sk")).v.total, 1);
  assert.equal((await call("admin/log", "GET", undefined, admin)).v.log.length, 2);
  await call("auth/forgot", "POST", { email: "buyer@example.sk" });
  const reset = mails.at(-1).text.match(/#token=([a-f0-9]+)/)[1];
  assert.equal(
    (await call("auth/reset", "POST", { token: reset, password: "new-password-1234", repeat: "new-password-1234" })).status,
    200,
  );
  assert.equal((await call("favorites", "POST", { id, save: false }, buyer)).status, 401);
  assert.equal(
    (await call("auth/reset", "POST", { token: reset, password: "new-password-1234", repeat: "new-password-1234" })).status,
    400,
  );
  assert.equal((await call("account", "DELETE", { password: "wrong-password-123" }, seller)).status, 403);
  assert.equal((await call("account", "DELETE", { password: "long-password-123" }, seller)).status, 200);
  assert.equal(blobs.size, 0);
  assert.equal(sql.prepare("SELECT deleted FROM users WHERE id=?").get(seller.id).deleted, 1);
  assert.equal((await media(new Request("https://market.test/media/" + image), env)).status, 404);
  assert.equal((await call("account", "DELETE", { password: "long-password-123" }, admin)).status, 400);
});
test("server-side search, filters, sorting, pagination and featured listings", async () => {
  const { call, register, listing, sql } = setup();
  const seller = await register("shop@example.sk"),
    czech = await register("cz@example.cz");
  for (let i = 0; i < 30; i++) {
    if (i === 20) sql.exec("DELETE FROM rate_limits");
    await listing(seller, { title: "Kniha číslo " + i, cat: "Knihy", price: i, city: i % 2 ? "Trnava" : "Košice" });
  }
  sql.exec("DELETE FROM rate_limits");
  await listing(seller, { title: "Horský bicykel Trek", desc: "Ľahký hliníkový rám, kotúčové brzdy.", price: 450, city: "Žilina", state: "Nové" });
  await listing(seller, { title: "Hľadám detskú postieľku", desc: "Kúpim zachovalú postieľku s matracom.", cat: "Deti", price: 80, buy: true });
  await listing(czech, { title: "Kolo pro děti", desc: "Dětské kolo, velikost 16 palců.", country: "cz", city: "Brno", price: 1200 });
  let r = await call("listings?country=sk&type=sell");
  assert.equal(r.v.total, 31);
  assert.equal(r.v.listings.length, 24);
  assert.equal(r.v.pages, 2);
  r = await call("listings?country=sk&type=sell&page=2");
  assert.equal(r.v.listings.length, 7);
  assert.equal((await call("listings?country=sk&type=buy")).v.total, 1);
  assert.equal((await call("listings?country=cz")).v.total, 1);
  // diacritics-insensitive full text
  assert.equal((await call("listings?country=sk&q=horsky%20BICYKEL")).v.listings[0].title, "Horský bicykel Trek");
  assert.equal((await call("listings?country=sk&q=hlinikovy")).v.total, 1);
  assert.equal((await call("listings?country=sk&q=kniha&cat=Knihy&min=10&max=19")).v.total, 10);
  assert.equal((await call("listings?country=sk&q=100%25")).v.total, 0);
  assert.equal((await call("listings?country=sk&cond=Nov%C3%A9")).v.total, 1);
  r = await call("listings?country=sk&type=sell&sort=low&limit=3");
  assert.deepEqual(r.v.listings.map((x) => x.price), [0, 1, 2]);
  r = await call("listings?country=sk&type=sell&sort=high&limit=1");
  assert.equal(r.v.listings[0].price, 450);
  // exact town, radius around a town and free-text town
  assert.equal((await call("listings?country=sk&city=Trnava")).v.total, 15);
  assert.equal((await call("listings?country=sk&city=trnava")).v.total, 15);
  assert.equal((await call("listings?country=sk&city=91701")).v.total, 15);
  assert.equal((await call("listings?country=sk&type=sell&city=Bratislava&radius=50")).v.total, 15);
  assert.equal((await call("listings?country=sk&type=sell&city=Bratislava&radius=300")).v.total, 16, "Košice is more than 300 km away");
  assert.equal((await call("listings?country=sk&city=zil")).v.total, 1);
  r = await call("listings/featured?country=sk");
  assert.equal(r.v.kind, "latest");
  const boosted = (await call("listings?country=sk&q=trek")).v.listings[0].id;
  assert.equal((await call("listings/" + boosted + "/boost", "POST", { days: 7 }, seller)).status, 200);
  r = await call("listings/featured?country=sk");
  assert.equal(r.v.kind, "boosted");
  assert.equal(r.v.listings[0].id, boosted);
  assert.equal((await call("listings?country=sk&type=sell")).v.listings[0].id, boosted, "boosted listings come first");
  assert.equal((await call("listings/" + boosted + "/boost", "POST", { off: true }, seller)).status, 200);
  assert.equal((await call("listings/featured?country=sk")).v.kind, "latest");
  // owner listing management
  await call("listings/" + boosted, "PATCH", { status: "sold" }, seller);
  r = await call("me/listings?status=sold", "GET", undefined, seller);
  assert.equal(r.v.total, 1);
  assert.equal(r.v.counts.active, 31);
  assert.equal(r.v.counts.sold, 1);
  assert.equal((await call("me/listings?page=2", "GET", undefined, seller)).v.listings.length, 12);
  assert.equal((await call("listings?country=sk&q=trek")).v.total, 0);
  assert.equal((await call("listings/" + boosted)).v.listing.status, "sold");
});
test("administration: stats, listings, users, bans and audit log", async () => {
  const { call, register, listing, mails, sql } = setup();
  const admin = await register("admin@example.test"),
    user = await register("spammer@example.sk"),
    good = await register("good@example.sk");
  const spam = await listing(user, { title: "Lacné hodinky Rolex", desc: "Originál, platba vopred na účet." });
  await listing(good, { title: "Detská postieľka", cat: "Deti" });
  assert.equal((await call("admin/stats", "GET", undefined, user)).status, 403);
  let s = (await call("admin/stats", "GET", undefined, admin)).v;
  assert.equal(s.stats.users, 3);
  assert.equal(s.stats.active, 2);
  assert.equal((await call("admin/listings?q=rolex", "GET", undefined, admin)).v.total, 1);
  assert.equal((await call("admin/listings?q=" + spam, "GET", undefined, admin)).v.total, 1);
  assert.equal((await call("admin/listings?q=spammer%40", "GET", undefined, admin)).v.total, 1);
  assert.equal((await call("admin/users?q=good", "GET", undefined, admin)).v.total, 1);
  assert.equal((await call("admin/users/" + admin.id, "POST", { action: "ban" }, admin)).status, 400);
  assert.equal((await call("admin/users/" + user.id, "POST", { action: "ban", note: "Spam" }, admin)).status, 200);
  assert.match(mails.at(-1).text, /Spam/);
  assert.equal((await call("bootstrap", "GET", undefined, user)).v.user, null, "ban ends sessions");
  const login = await call("auth/login", "POST", { email: "spammer@example.sk", password: "long-password-123" });
  assert.equal(login.status, 403);
  assert.equal((await call("listings?country=sk")).v.total, 1, "banned owner listings are not public");
  assert.equal((await call("listings/" + spam)).status, 404);
  assert.equal((await call("admin/users?filter=banned", "GET", undefined, admin)).v.users[0].ban_reason, "Spam");
  assert.equal((await call("admin/users/" + user.id, "POST", { action: "unban" }, admin)).status, 200);
  assert.equal((await call("listings?country=sk")).v.total, 2);
  assert.equal((await call("admin/listings/" + spam, "POST", { action: "delete", note: "Podvod" }, admin)).status, 200);
  assert.equal(sql.prepare("SELECT status FROM listings WHERE id=?").get(spam).status, "deleted");
  assert.equal((await call("admin/listings?status=deleted", "GET", undefined, admin)).v.total, 1);
  assert.equal((await call("admin/users/" + user.id, "POST", { action: "delete" }, admin)).status, 200);
  assert.equal(sql.prepare("SELECT deleted FROM users WHERE id=?").get(user.id).deleted, 1);
  const log = (await call("admin/log", "GET", undefined, admin)).v.log.map((x) => x.action);
  assert.deepEqual(log, ["user.delete", "listing.delete", "user.unban", "user.ban"]);
  s = (await call("admin/stats", "GET", undefined, admin)).v;
  assert.equal(s.stats.users, 2);
});
test("password change, email change and data export", async () => {
  const { call, register, mails } = setup();
  const u = await register("me@example.sk");
  await register("taken@example.sk");
  assert.equal((await call("account/password", "POST", { current: "bad-password-000", password: "another-password-1", repeat: "another-password-1" }, u)).status, 403);
  assert.equal((await call("account/password", "POST", { current: "long-password-123", password: "short", repeat: "short" }, u)).status, 400);
  assert.equal(
    (await call("account/password", "POST", { current: "long-password-123", password: "another-password-1", repeat: "another-password-1" }, u)).status,
    200,
  );
  assert.equal((await call("bootstrap", "GET", undefined, u)).v.user.email, "me@example.sk", "current session stays");
  assert.equal((await call("auth/login", "POST", { email: "me@example.sk", password: "another-password-1" })).status, 200);
  const sent = mails.length;
  assert.equal((await call("account/email", "POST", { email: "taken@example.sk", password: "another-password-1" }, u)).status, 202);
  assert.equal(mails.length, sent, "no email reveals an existing account");
  assert.equal((await call("account/email", "POST", { email: "new@example.sk", password: "wrong-password-1" }, u)).status, 403);
  assert.equal((await call("account/email", "POST", { email: "new@example.sk", password: "another-password-1" }, u)).status, 202);
  assert.deepEqual(mails.at(-1).to, ["new@example.sk"]);
  const token = mails.at(-1).text.match(/#token=([a-f0-9]+)/)[1];
  assert.equal((await call("auth/verify", "POST", { token })).status, 200);
  assert.equal((await call("bootstrap", "GET", undefined, u)).v.user.email, "new@example.sk");
  const exp = await call("account/export", "GET", undefined, u);
  assert.equal(exp.status, 200);
  assert.equal(exp.v.account.email, "new@example.sk");
  assert.equal((await call("profile", "PATCH", { notifications: false }, u)).status, 200);
  const b = (await call("bootstrap", "GET", undefined, u)).v.user;
  assert.equal(b.notifications, false);
  assert.equal(b.name, "Test user", "partial profile update keeps the name");
});
test("email fail-closed, validation, CSRF and upload signature guards", async () => {
  const { call, register, env, sql } = setup();
  delete env.RESEND_API_KEY;
  const body = { name: "Test", email: "a@example.sk", password: "long-password-123", repeat: "long-password-123", terms: true };
  assert.equal((await call("auth/register", "POST", body)).status, 503);
  assert.equal(sql.prepare("SELECT count(*) n FROM users").get().n, 0);
  assert.equal((await call("auth/register", "POST", { ...body, email: "jdjd@djdj" })).status, 400);
  env.RESEND_API_KEY = "test";
  const user = await register("user@example.sk");
  assert.equal((await call("profile", "PATCH", { name: "changed" }, user, { "x-csrf-token": "wrong" })).status, 403);
  assert.equal((await call("profile", "PATCH", { name: "changed" }, user, { Origin: "https://evil.test" })).status, 403);
  assert.equal((await call("uploads", "POST", new Uint8Array([1, 2, 3]), user)).status, 400);
  assert.equal((await call("listings?country=sk&page=-5")).v.page, 1);
});
test("photo edits preserve ownership, cover order and storage until the update is valid", async () => {
  const { call, register, sql, blobs, env, upload } = setup(),
    seller = await register("edit@example.sk"),
    other = await register("foreign@example.sk");
  const first = await upload(seller),
    second = await upload(seller),
    foreign = await upload(other);
  const fields = {
    submission: "edit-photos",
    title: "Mestský bicykel",
    desc: "Bicykel v dobrom stave. Osobné vyzdvihnutie.",
    cat: "Šport",
    price: 150,
    city: "Bratislava",
    state: "Používané",
    country: "sk",
    uploadIds: [first, second],
  };
  const id = (await call("listings", "POST", fields, seller)).v.id;
  assert.equal((await call("listings/" + id, "PATCH", { uploadIds: [second, first] }, other)).status, 404);
  assert.equal((await call("listings/" + id, "PATCH", { title: "Nepovolená zmena", uploadIds: [foreign] }, seller)).status, 409);
  assert.equal(sql.prepare("SELECT title FROM listings WHERE id=?").get(id).title, fields.title);
  assert.equal(blobs.has(first), true);
  assert.equal(sql.prepare("SELECT listing_id FROM uploads WHERE id=?").get(foreign).listing_id, null);
  assert.equal((await call("listings/" + id, "PATCH", { uploadIds: [second, second] }, seller)).status, 400);
  assert.equal((await call("listings/" + id, "PATCH", { uploadIds: [] }, seller)).status, 400);
  assert.equal((await call("listings/" + id, "PATCH", { uploadIds: [second, first] }, seller)).status, 200);
  assert.equal((await call("listings/" + id)).v.listing.photo, "/media/" + second);
  const replacement = await upload(seller);
  assert.equal((await call("listings/" + id, "PATCH", { state: "Nové", buy: false, uploadIds: [replacement, second] }, seller)).status, 200);
  assert.equal(blobs.has(first), false);
  assert.equal((await media(new Request("https://market.test/media/" + first), env)).status, 404);
  assert.equal(sql.prepare("SELECT listing_id FROM uploads WHERE id=?").get(replacement).listing_id, id);
  assert.deepEqual((await call("me/listings", "GET", undefined, seller)).v.listings[0].uploadIds, [replacement, second]);
  assert.equal((await call("listings/" + id, "PATCH", { title: "Mestský bicykel Author", city: "Košice" }, seller)).status, 200);
  assert.equal((await call("listings?country=sk&q=author&city=kosice")).v.total, 1, "edits refresh the search index");
  assert.equal((await call("listings/" + id, "PATCH", { buy: true, uploadIds: [] }, seller)).status, 200);
  assert.equal((await call("listings/" + id)).v.listing.noPhoto, true);
  assert.equal(blobs.has(replacement), false);
  assert.equal(blobs.has(second), false);
  assert.equal((await call("listings/" + id, "PATCH", { buy: false }, seller)).status, 400);
});
test("maintenance removes expired sessions, limits and abandoned uploads", async () => {
  const { call, register, sql, env, blobs, upload } = setup();
  const u = await register("cron@example.sk");
  const orphan = await upload(u);
  const later = Date.now() + 8 * 86400000;
  const r = await maintenance(env, later);
  assert.equal(r.removedUploads, 1);
  assert.equal(blobs.has(orphan), false);
  assert.equal(sql.prepare("SELECT count(*) n FROM sessions").get().n, 0);
  assert.equal(sql.prepare("SELECT count(*) n FROM rate_limits").get().n, 0);
  assert.equal((await call("bootstrap", "GET", undefined, u)).v.user, null);
});
