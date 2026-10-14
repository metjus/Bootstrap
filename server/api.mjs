import { randomBytes, randomUUID, createHash, scryptSync, timingSafeEqual } from "node:crypto";
import { fold, resolvePlace, placesWithin } from "./places.mjs";

export const VERSION = "1.0.0";
const uid = () => randomUUID(),
  nid = () => Number.parseInt(randomBytes(6).toString("hex"), 16),
  secret = () => randomBytes(32).toString("hex"),
  sha = (s) => createHash("sha256").update(s).digest("hex");
const scryptOptions = { N: 16384, r: 8, p: 5, maxmem: 32 * 1024 * 1024 };
export const hashPassword = (p, salt = secret()) => `${salt}:${scryptSync(p, salt, 64, scryptOptions).toString("hex")}`;
export function checkPassword(p, stored) {
  try {
    const [salt, hash] = stored.split(":");
    const b = Buffer.from(hash, "hex"),
      a = scryptSync(p, salt, 64, scryptOptions);
    return b.length === a.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
export const CATEGORIES = [
  "Elektronika",
  "Mobily",
  "Počítače",
  "Auto-moto",
  "Bývanie",
  "Nehnuteľnosti",
  "Šport",
  "Oblečenie",
  "Deti",
  "Zvieratá",
  "Záhrada",
  "Stroje",
  "Hudba",
  "Knihy",
  "Služby",
  "Ostatné",
];
const CONDITIONS = ["Nové", "Používané"];
const DAY = 86400000;
export const cookieName = "__Host-bazar_session";
const DUMMY_HASH =
  "dummy:00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
const text = (v, max = 100) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const escapeLike = (s) => s.replace(/[\\%_]/g, "\\$&");
const emailValid = (v) =>
  typeof v === "string" &&
  v.length <= 254 &&
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,63}$/i.test(
    v,
  ) &&
  !v.split("@")[0].startsWith(".") &&
  !v.split("@")[0].endsWith(".") &&
  !v.split("@")[0].includes("..");
const passwordValid = (p) => typeof p === "string" && p.length >= 12 && p.length <= 128;
const phoneValid = (p) => !p || /^[+\d ()-]{5,30}$/.test(p);
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
export async function boundedBody(request, max) {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  let total = 0,
    chunks = [];
  try {
    for (;;) {
      const r = await reader.read();
      if (r.done) break;
      total += r.value.length;
      if (total > max) {
        await reader.cancel();
        fail(413, "Súbor alebo požiadavka je príliš veľká.");
      }
      chunks.push(r.value);
    }
  } finally {
    reader.releaseLock();
  }
  const out = new Uint8Array(total);
  let n = 0;
  for (const c of chunks) {
    out.set(c, n);
    n += c.length;
  }
  return out;
}
const bodyJSON = async (req) => {
  try {
    const value = JSON.parse(new TextDecoder().decode(await boundedBody(req, 64000)) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch (e) {
    if (e.status) throw e;
    fail(400, "Neplatná požiadavka.");
  }
};
export const sessionToken = (request) =>
  (request.headers.get("cookie") || "")
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(cookieName + "="))
    ?.slice(cookieName.length + 1);
export const adminEmails = (env) =>
  String(env.ADMIN_EMAIL || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
export const isAdminUser = (env, u) => !!(u?.verified && !u.banned && adminEmails(env).includes(u.email.toLowerCase()));
const mailReady = (env) => !!(env.RESEND_API_KEY && env.MAIL_FROM && env.APP_URL);
async function sendMail(env, to, subject, body, services) {
  if (!mailReady(env)) fail(503, "Odosielanie emailov ešte nie je nakonfigurované.");
  const f = services.mail || fetch;
  let r;
  try {
    r = await f("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, text: body }),
    });
  } catch {
    fail(502, "Email sa nepodarilo odoslať. Skús to neskôr.");
  }
  if (!r.ok) fail(502, "Email sa nepodarilo odoslať. Skús to neskôr.");
}
const searchText = (f) => fold([f.title, f.description, f.category, f.city].join(" "));
const listingSelect =
  "SELECT l.*,u.name seller,u.email owner_email,u.banned owner_banned,u.created owner_created FROM listings l JOIN users u ON u.id=l.owner";
const viewCount = "(SELECT count(*) FROM listing_views v WHERE v.listing_id=l.id) view_count";
function paging(params, size = 24, max = 60) {
  const limit = Math.min(max, Math.max(1, Number(params.get("limit")) || size)),
    page = Math.max(1, Math.min(10000, Math.floor(Number(params.get("page")) || 1)));
  return { limit, page, offset: (page - 1) * limit };
}
const pageResult = (key, rows, total, { limit, page }) => ({
  [key]: rows,
  total,
  page,
  pages: Math.max(1, Math.ceil(total / limit)),
});
let searchIndexComplete = false;

export async function api(request, env, services = {}) {
  const DB = env.DB,
    BUCKET = env.BUCKET,
    url = new URL(request.url),
    path = url.pathname.replace(/^\/api\/?/, "").replace(/\/$/, ""),
    method = request.method,
    now = Date.now();
  const stmt = (q, ...a) => DB.prepare(q).bind(...a),
    first = (q, ...a) => stmt(q, ...a).first(),
    all = async (q, ...a) => (await stmt(q, ...a).all()).results,
    run = (q, ...a) => stmt(q, ...a).run();
  let user = null,
    session = null;
  const need = (verify = true) => {
    if (!user) fail(401, "Najprv sa prihlás.");
    if (verify && !user.verified) fail(403, "Najprv over svoju emailovú adresu.");
    return user;
  };
  const admin = () => isAdminUser(env, user);
  const needAdmin = () => {
    if (!admin()) fail(403, "Nemáš oprávnenie na administráciu.");
  };
  const background = (promise) => {
    const p = promise.catch((e) => console.error("bazaro_background_failure", e.message));
    if (services.waitUntil) services.waitUntil(p);
    return p;
  };
  async function limit(scope, identity, max = 20, ms = 3600000) {
    const key = sha(scope + ":" + identity),
      expiry = now + ms;
    const row = await first(
      "INSERT INTO rate_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<? THEN 1 ELSE count+1 END, expires=CASE WHEN expires<? THEN ? ELSE expires END RETURNING count",
      key,
      expiry,
      now,
      now,
      expiry,
    );
    if (row.count > max) fail(429, "Príliš veľa pokusov. Skús to neskôr.");
  }
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  async function tokenMail(u, kind, data = "", to = u.email) {
    const t = secret(),
      expires = now + (kind === "reset" ? 3600000 : DAY);
    await run(
      "INSERT INTO email_tokens(hash,user_id,kind,expires,data) VALUES(?,?,?,?,?)",
      sha(t),
      u.id,
      kind,
      expires,
      data,
    );
    const copy = {
      verify: [
        "Overenie emailu — Bazaro",
        "Potvrď svoju emailovú adresu",
        "overenie",
        "24 hodín",
        "Ak si sa na Bazaro neregistroval, ignoruj tento email.",
      ],
      email: [
        "Potvrdenie novej emailovej adresy — Bazaro",
        "Potvrď novú emailovú adresu svojho účtu",
        "overenie",
        "24 hodín",
        "Ak si o zmenu nežiadal, ignoruj tento email.",
      ],
      reset: [
        "Obnova hesla — Bazaro",
        "Nastav si nové heslo",
        "obnova-hesla",
        "1 hodinu",
        "Ak si o obnovu nežiadal, ignoruj tento email. Heslo sa nezmení.",
      ],
    }[kind];
    try {
      await sendMail(
        env,
        to,
        copy[0],
        `${copy[1]}: ${env.APP_URL}/${copy[2]}/#token=${t}\n\nOdkaz platí ${copy[3]}. ${copy[4]}`,
        services,
      );
    } catch (e) {
      await run("DELETE FROM email_tokens WHERE hash=?", sha(t));
      throw e;
    }
  }
  const profile = (u) =>
    u
      ? {
          id: u.id,
          email: u.email,
          name: u.name,
          phone: u.phone,
          verified: !!u.verified,
          notifications: !!u.notifications,
          created: u.created,
          admin: isAdminUser(env, u),
        }
      : null;
  function listingDTO(d) {
    const ids = JSON.parse(d.photos || "[]"),
      mine = !!user && d.owner === user.id,
      photos = ids.map((id) => "/media/" + id);
    const out = {
      id: d.id,
      title: d.title,
      desc: d.description,
      cat: d.category,
      price: d.price / 100,
      country: d.country,
      city: d.city,
      state: d.condition,
      buy: !!d.buy,
      seller: d.seller,
      sellerSince: d.owner_created,
      status: d.status,
      boost: d.status === "active" && d.boost_until > now,
      boostUntil: d.boost_until,
      createdAt: d.created,
      updatedAt: d.updated || d.created,
      photos: photos.length ? photos : ["/assets/wanted.svg"],
      photo: photos[0] || "/assets/wanted.svg",
      photoCount: photos.length,
      noPhoto: !photos.length,
      hasPhone: !!d.phone,
      ownerId: d.owner,
      mine,
    };
    if (d.view_count !== undefined) out.viewCount = d.view_count;
    if (mine) Object.assign(out, { phone: d.phone, uploadIds: ids, moderationNote: d.moderation_note || "" });
    return out;
  }
  const listingRow = (id) =>
    first(`${listingSelect.replace("FROM", "," + viewCount + " FROM")} WHERE l.id=? AND l.status<>'deleted'`, id);
  const blocked = (a, b) =>
    first("SELECT 1 FROM blocks WHERE (user_id=? AND peer=?) OR (user_id=? AND peer=?)", a, b, b, a);
  async function conversation(id) {
    need();
    const c = await first(
      "SELECT * FROM conversations WHERE id=? AND (buyer=? OR seller=?)",
      Number(id),
      user.id,
      user.id,
    );
    if (!c) fail(404, "Rozhovor sa nenašiel.");
    return c;
  }
  function listingFields(b) {
    const title = text(b.title, 140),
      description = text(b.desc ?? b.description, 10000),
      city = text(b.city, 100),
      phone = text(b.phone, 30),
      category = b.cat ?? b.category,
      condition = b.state ?? b.condition,
      price = Number(b.price);
    if (
      title.length < 5 ||
      description.length < 15 ||
      city.length < 2 ||
      !CATEGORIES.includes(category) ||
      !CONDITIONS.includes(condition) ||
      b.price === "" ||
      b.price === null ||
      !Number.isFinite(price) ||
      price < 0 ||
      price > 100000000 ||
      !["sk", "cz"].includes(b.country)
    )
      fail(400, "Skontroluj názov, popis, kategóriu, miesto, krajinu a cenu.");
    if (!phoneValid(phone)) fail(400, "Neplatný telefón.");
    const f = {
      title,
      description,
      category,
      condition,
      price: Math.round(price * 100),
      city,
      phone,
      country: b.country,
      buy: !!b.buy,
    };
    return { ...f, search: searchText(f), cityKey: fold(city) };
  }
  function photoIds(ids, buy) {
    if (
      !Array.isArray(ids) ||
      ids.length > 8 ||
      new Set(ids).size !== ids.length ||
      ids.some((x) => typeof x !== "string" || x.length > 64) ||
      (!buy && !ids.length)
    )
      fail(400, "Ponuka potrebuje 1 až 8 fotografií.");
    return ids;
  }
  async function deletePhotos(ids) {
    for (const photo of ids) {
      await run("DELETE FROM uploads WHERE id=?", photo);
      await BUCKET.delete(photo);
    }
  }
  async function removeListing(d) {
    await DB.batch([
      stmt("UPDATE listings SET status='deleted',photos='[]',boost_until=0,updated=? WHERE id=?", now, d.id),
      stmt("DELETE FROM favorites WHERE listing_id=?", d.id),
    ]);
    await deletePhotos(JSON.parse(d.photos || "[]"));
  }
  async function purgeUser(id) {
    const files = await all("SELECT id FROM uploads WHERE owner=?", id);
    await DB.batch([
      stmt("DELETE FROM favorites WHERE user_id=?", id),
      stmt("DELETE FROM favorites WHERE listing_id IN (SELECT id FROM listings WHERE owner=?)", id),
      stmt("DELETE FROM blocks WHERE user_id=? OR peer=?", id, id),
      stmt("DELETE FROM listing_views WHERE user_id=?", id),
      stmt("DELETE FROM messages WHERE sender=?", id),
      stmt("UPDATE reports SET user_id=NULL,contact='' WHERE user_id=?", id),
      stmt("UPDATE listings SET status='deleted',photos='[]',phone='',boost_until=0,updated=? WHERE owner=?", now, id),
      stmt("DELETE FROM uploads WHERE owner=?", id),
      stmt("DELETE FROM email_tokens WHERE user_id=?", id),
      stmt("DELETE FROM sessions WHERE user_id=?", id),
      stmt(
        "UPDATE users SET name='Odstránený účet',email=?,phone='',password='',deleted=1,banned=0,ban_reason='' WHERE id=?",
        id + "@deleted.invalid",
        id,
      ),
    ]);
    for (const f of files) await BUCKET.delete(f.id);
  }
  async function audit(action, target, note = "") {
    await run(
      "INSERT INTO admin_log(id,admin,action,target,note,created) VALUES(?,?,?,?,?,?)",
      nid(),
      user.email,
      action,
      String(target),
      note,
      now,
    );
  }
  function notify(to, subject, body) {
    if (!mailReady(env) || !to || to.endsWith("@deleted.invalid")) return;
    background(sendMail(env, to, subject, body, services));
  }
  async function ensureSearchIndex() {
    if (searchIndexComplete) return;
    const rows = await all(
      "SELECT id,title,description,category,city FROM listings WHERE search='' AND status<>'deleted' LIMIT 200",
    );
    if (rows.length)
      await DB.batch(
        rows.map((r) => stmt("UPDATE listings SET search=?,city_key=? WHERE id=?", searchText(r), fold(r.city), r.id)),
      );
    if (rows.length < 200) searchIndexComplete = true;
  }
  async function unreadCount() {
    if (!user?.verified) return 0;
    return (
      await first(
        "SELECT count(*) n FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE (c.buyer=? OR c.seller=?) AND m.sender<>? AND m.read=0",
        user.id,
        user.id,
        user.id,
      )
    ).n;
  }
  const messageDTO = (m) => ({
    id: m.id,
    text: m.body,
    direction: m.sender === user.id ? "out" : "in",
    sentAt: m.sent,
    read: !!m.read,
  });

  try {
    if (!DB || !BUCKET) fail(503, "Serverové úložisko ešte nie je pripravené.");
    const token = sessionToken(request);
    if (token) {
      session = await first("SELECT * FROM sessions WHERE hash=? AND expires>?", sha(token), now);
      if (session) user = await first("SELECT * FROM users WHERE id=? AND deleted=0 AND banned=0", session.user_id);
      if (!user) session = null;
    }
    if (!["GET", "HEAD"].includes(method)) {
      if (request.headers.get("origin") !== url.origin || request.headers.get("x-bazar-request") !== "1")
        fail(403, "Požiadavka nie je povolená.");
      if (user && request.headers.get("x-csrf-token") !== session.csrf) fail(403, "Relácia sa zmenila. Obnov stránku.");
      await limit("write", ip, 120, 60000);
    }

    // ---- System -------------------------------------------------------------
    if (path === "health" && method === "GET") {
      await first("SELECT 1 ok");
      return json({
        ok: true,
        database: true,
        storage: !!BUCKET,
        email: mailReady(env),
        admin: adminEmails(env).length > 0,
        version: VERSION,
      });
    }
    if (path === "bootstrap" && method === "GET") {
      const fav = user ? await all("SELECT listing_id FROM favorites WHERE user_id=? LIMIT 2000", user.id) : [];
      return json({
        user: profile(user),
        csrf: user ? session.csrf : null,
        favorites: fav.map((x) => x.listing_id),
        unread: await unreadCount(),
        config: { email: mailReady(env), admin: admin() },
      });
    }

    // ---- Authentication -----------------------------------------------------
    if (path === "auth/register" && method === "POST") {
      const b = await bodyJSON(request),
        email = text(b.email, 254).toLowerCase(),
        name = text(b.name, 80);
      if (
        !emailValid(email) ||
        name.length < 2 ||
        !passwordValid(b.password) ||
        b.password !== b.repeat ||
        b.terms !== true
      )
        fail(400, "Vyplň meno, platný email, zhodné heslá s aspoň 12 znakmi a potvrď podmienky.");
      await limit("register", ip, 8);
      await limit("email", email, 5);
      if (!mailReady(env)) fail(503, "Registráciu spustíme po nastavení odosielania overovacích emailov.");
      let u = await first("SELECT * FROM users WHERE email=?", email);
      if (!u) {
        u = { id: uid(), email, name };
        await run(
          "INSERT INTO users(id,email,name,password,created,terms) VALUES(?,?,?,?,?,?)",
          u.id,
          email,
          name,
          hashPassword(b.password),
          now,
          now,
        );
      }
      if (!u.verified && !u.deleted && !u.banned) await tokenMail(u, "verify");
      return json({ message: "Ak je možné účet vytvoriť, poslali sme overovací email. Skontroluj aj spam." }, 202);
    }
    if (path === "auth/verify" && method === "POST") {
      const b = await bodyJSON(request);
      await limit("verify", ip, 15, 60000);
      const hash = sha(text(b.token, 128));
      const t = await first(
        "SELECT * FROM email_tokens WHERE hash=? AND kind IN ('verify','email') AND expires>?",
        hash,
        now,
      );
      if (!t) fail(400, "Odkaz je neplatný alebo vypršal.");
      const claimed = await first("DELETE FROM email_tokens WHERE hash=? AND expires>? RETURNING user_id", hash, now);
      if (!claimed) fail(400, "Odkaz je neplatný alebo vypršal.");
      if (t.kind === "email") {
        if (await first("SELECT 1 FROM users WHERE email=? AND id<>?", t.data, t.user_id))
          fail(409, "Tento email už používa iný účet.");
        await DB.batch([
          stmt("UPDATE users SET email=?,verified=1 WHERE id=? AND deleted=0", t.data, t.user_id),
          stmt("DELETE FROM email_tokens WHERE user_id=? AND kind='email'", t.user_id),
        ]);
        return json({ message: "Nový email je potvrdený." });
      }
      await DB.batch([
        stmt("UPDATE users SET verified=1 WHERE id=? AND deleted=0", t.user_id),
        stmt("DELETE FROM email_tokens WHERE user_id=? AND kind='verify'", t.user_id),
      ]);
      return json({ message: "Email je overený. Teraz sa prihlás." });
    }
    if (path === "auth/resend" && method === "POST") {
      const b = await bodyJSON(request),
        email = text(b.email, 254).toLowerCase();
      await limit("email", email, 5);
      await limit("resend", ip, 8);
      if (!mailReady(env)) fail(503, "Odosielanie emailov ešte nie je nastavené.");
      const u = await first("SELECT * FROM users WHERE email=? AND deleted=0 AND banned=0", email);
      if (u && !u.verified) await tokenMail(u, "verify");
      return json({ message: "Ak účet čaká na overenie, poslali sme nový email." }, 202);
    }
    if (path === "auth/login" && method === "POST") {
      const b = await bodyJSON(request),
        email = text(b.email, 254).toLowerCase();
      if (typeof b.password !== "string" || b.password.length > 128) fail(400, "Neplatné údaje.");
      await limit("loginIP", ip, 20, 900000);
      await limit("login", email, 10, 900000);
      const u = await first("SELECT * FROM users WHERE email=? AND deleted=0", email);
      if (!checkPassword(b.password, u?.password || DUMMY_HASH) || !u) fail(401, "Email alebo heslo nie je správne.");
      if (u.banned) fail(403, "Účet je zablokovaný. Ak ide o omyl, kontaktuj prevádzkovateľa.");
      const t = secret(),
        csrf = secret();
      await DB.batch([
        stmt("INSERT INTO sessions(hash,user_id,csrf,expires) VALUES(?,?,?,?)", sha(t), u.id, csrf, now + 7 * DAY),
        stmt("UPDATE users SET last_login=? WHERE id=?", now, u.id),
      ]);
      user = u;
      return json({ user: profile(u), csrf }, 200, {
        "Set-Cookie": `${cookieName}=${t}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`,
      });
    }
    if (path === "auth/logout" && method === "POST") {
      if (session) await run("DELETE FROM sessions WHERE hash=?", session.hash);
      return json({ ok: true }, 200, {
        "Set-Cookie": `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
      });
    }
    if (path === "auth/forgot" && method === "POST") {
      const b = await bodyJSON(request),
        email = text(b.email, 254).toLowerCase();
      await limit("forgot", ip, 8);
      await limit("email", email, 5);
      if (!mailReady(env)) fail(503, "Odosielanie emailov ešte nie je nastavené.");
      const u = await first("SELECT * FROM users WHERE email=? AND deleted=0 AND banned=0", email);
      if (u) await tokenMail(u, "reset");
      return json({ message: "Ak účet existuje, poslali sme email na obnovu hesla." }, 202);
    }
    if (path === "auth/reset" && method === "POST") {
      const b = await bodyJSON(request);
      await limit("reset", ip, 10);
      if (!passwordValid(b.password) || b.password !== b.repeat)
        fail(400, "Heslá sa musia zhodovať a mať aspoň 12 znakov.");
      const t = await first(
        "SELECT * FROM email_tokens WHERE hash=? AND kind='reset' AND expires>?",
        sha(text(b.token, 128)),
        now,
      );
      if (!t) fail(400, "Odkaz je neplatný alebo vypršal.");
      const claimed = await first("DELETE FROM email_tokens WHERE hash=? AND expires>? RETURNING user_id", t.hash, now);
      if (!claimed) fail(400, "Odkaz je neplatný alebo vypršal.");
      const result = await run(
        "UPDATE users SET password=?,verified=1 WHERE id=? AND deleted=0",
        hashPassword(b.password),
        t.user_id,
      );
      if (!result.meta?.changes) fail(400, "Odkaz je neplatný.");
      await DB.batch([
        stmt("DELETE FROM email_tokens WHERE user_id=? AND kind='reset'", t.user_id),
        stmt("DELETE FROM sessions WHERE user_id=?", t.user_id),
      ]);
      return json({ message: "Heslo je zmenené. Prihlás sa znova." });
    }

    // ---- Account ------------------------------------------------------------
    if (path === "profile" && method === "PATCH") {
      need(false);
      const b = await bodyJSON(request),
        name = b.name === undefined ? user.name : text(b.name, 80),
        phone = b.phone === undefined ? user.phone : text(b.phone, 30),
        notifications = b.notifications === undefined ? user.notifications : b.notifications === false ? 0 : 1;
      if (name.length < 2 || !phoneValid(phone)) fail(400, "Skontroluj meno a telefón.");
      await run("UPDATE users SET name=?,phone=?,notifications=? WHERE id=?", name, phone, notifications, user.id);
      return json({ ok: true });
    }
    if (path === "account/password" && method === "POST") {
      need(false);
      const b = await bodyJSON(request);
      await limit("password", user.id, 10);
      if (!checkPassword(String(b.current || ""), user.password)) fail(403, "Súčasné heslo nie je správne.");
      if (!passwordValid(b.password) || b.password !== b.repeat)
        fail(400, "Nové heslá sa musia zhodovať a mať aspoň 12 znakov.");
      await DB.batch([
        stmt("UPDATE users SET password=? WHERE id=?", hashPassword(b.password), user.id),
        stmt("DELETE FROM sessions WHERE user_id=? AND hash<>?", user.id, session.hash),
        stmt("DELETE FROM email_tokens WHERE user_id=? AND kind='reset'", user.id),
      ]);
      return json({ message: "Heslo je zmenené. Ostatné prihlásenia sme odhlásili." });
    }
    if (path === "account/email" && method === "POST") {
      need(false);
      const b = await bodyJSON(request),
        email = text(b.email, 254).toLowerCase();
      await limit("emailChange", user.id, 5);
      if (!checkPassword(String(b.password || ""), user.password)) fail(403, "Heslo nie je správne.");
      if (!emailValid(email)) fail(400, "Zadaj platný email.");
      if (email === user.email) fail(400, "Toto je tvoj súčasný email.");
      if (!mailReady(env)) fail(503, "Odosielanie emailov ešte nie je nastavené.");
      if (!(await first("SELECT 1 FROM users WHERE email=?", email))) {
        await run("DELETE FROM email_tokens WHERE user_id=? AND kind='email'", user.id);
        await tokenMail(user, "email", email, email);
      }
      return json({ message: "Na novú adresu sme poslali potvrdzovací odkaz. Zmena platí po jeho otvorení." }, 202);
    }
    if (path === "account/export" && method === "GET") {
      need(false);
      const listings = await all("SELECT * FROM listings WHERE owner=? AND status<>'deleted'", user.id),
        favorites = await all("SELECT listing_id FROM favorites WHERE user_id=?", user.id),
        messages = await all(
          "SELECT m.conversation_id,m.body,m.sent FROM messages m WHERE m.sender=? ORDER BY m.sent",
          user.id,
        ),
        blocks = await all("SELECT peer FROM blocks WHERE user_id=?", user.id);
      return json(
        {
          exported: new Date(now).toISOString(),
          account: { ...profile(user), terms: user.terms, lastLogin: user.last_login },
          listings: listings.map((l) => ({
            id: l.id,
            title: l.title,
            description: l.description,
            category: l.category,
            price: l.price / 100,
            country: l.country,
            city: l.city,
            condition: l.condition,
            buy: !!l.buy,
            phone: l.phone,
            status: l.status,
            created: l.created,
          })),
          favorites: favorites.map((f) => f.listing_id),
          sentMessages: messages,
          blockedAccounts: blocks.length,
        },
        200,
        { "Content-Disposition": 'attachment; filename="bazaro-moje-udaje.json"' },
      );
    }
    if (path === "account" && method === "DELETE") {
      need(false);
      const b = await bodyJSON(request);
      if (!checkPassword(String(b.password || ""), user.password)) fail(403, "Heslo nie je správne.");
      if (admin() && adminEmails(env).length === 1)
        fail(400, "Jediný administrátor nemôže odstrániť účet. Najprv zmeň ADMIN_EMAIL.");
      await purgeUser(user.id);
      return json({ ok: true }, 200, {
        "Set-Cookie": `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
      });
    }
    if (path === "me/listings" && method === "GET") {
      need(false);
      const p = paging(url.searchParams, 20, 50),
        status = url.searchParams.get("status");
      const filter = ["active", "sold", "hidden"].includes(status) ? status : null;
      const counts = Object.fromEntries(
        (
          await all(
            "SELECT status,count(*) n FROM listings WHERE owner=? AND status<>'deleted' GROUP BY status",
            user.id,
          )
        ).map((r) => [r.status, r.n]),
      );
      const where = "l.owner=? AND l.status<>'deleted'" + (filter ? " AND l.status=?" : "");
      const args = filter ? [user.id, filter] : [user.id];
      const total = (await first(`SELECT count(*) n FROM listings l WHERE ${where}`, ...args)).n;
      const rows = await all(
        `${listingSelect.replace("FROM", "," + viewCount + " FROM")} WHERE ${where} ORDER BY l.created DESC LIMIT ? OFFSET ?`,
        ...args,
        p.limit,
        p.offset,
      );
      return json({ ...pageResult("listings", rows.map(listingDTO), total, p), counts });
    }
    if (path === "me/favorites" && method === "GET") {
      need(false);
      const p = paging(url.searchParams, 24, 60);
      const where =
        "l.id IN (SELECT listing_id FROM favorites WHERE user_id=?) AND l.status IN ('active','sold') AND u.banned=0";
      const total = (await first(`SELECT count(*) n FROM listings l JOIN users u ON u.id=l.owner WHERE ${where}`, user.id))
        .n;
      const rows = await all(
        `${listingSelect} WHERE ${where} ORDER BY l.status='active' DESC,l.created DESC LIMIT ? OFFSET ?`,
        user.id,
        p.limit,
        p.offset,
      );
      return json(pageResult("listings", rows.map(listingDTO), total, p));
    }

    // ---- Photos -------------------------------------------------------------
    if (path === "uploads" && method === "POST") {
      need();
      await limit("upload", user.id, 60);
      const stale = await all(
        "SELECT id FROM uploads WHERE owner=? AND listing_id IS NULL AND created<? LIMIT 40",
        user.id,
        now - DAY,
      );
      await deletePhotos(stale.map((f) => f.id));
      const count = await first("SELECT count(*) n FROM uploads WHERE owner=? AND listing_id IS NULL", user.id);
      if (count.n >= 40) fail(400, "Najprv dokonči alebo vymaž rozpracované fotografie.");
      const bytes = await boundedBody(request, 10 * 1024 * 1024);
      const mime = request.headers.get("content-type")?.split(";")[0],
        sig = Buffer.from(bytes.subarray(0, 12));
      const valid =
        (mime === "image/jpeg" && sig[0] === 255 && sig[1] === 216 && sig[2] === 255) ||
        (mime === "image/png" && sig.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
        (mime === "image/webp" && sig.toString("ascii", 0, 4) === "RIFF" && sig.toString("ascii", 8, 12) === "WEBP");
      if (!valid) fail(400, "Použi fotografiu JPG, PNG alebo WebP.");
      const id = uid();
      await BUCKET.put(id, bytes, { httpMetadata: { contentType: mime } });
      try {
        await run(
          "INSERT INTO uploads(id,owner,mime,bytes,created) VALUES(?,?,?,?,?)",
          id,
          user.id,
          mime,
          bytes.length,
          now,
        );
      } catch (e) {
        await BUCKET.delete(id);
        throw e;
      }
      return json({ id, url: "/media/" + id }, 201);
    }
    if (/^uploads\/[\w-]+$/.test(path) && method === "DELETE") {
      need();
      const id = path.split("/")[1];
      const u = await first("SELECT * FROM uploads WHERE id=? AND owner=? AND listing_id IS NULL", id, user.id);
      if (!u) fail(404, "Fotografia sa nenašla.");
      await deletePhotos([id]);
      return json({ ok: true });
    }

    // ---- Listings -----------------------------------------------------------
    if (path === "listings" && method === "GET") {
      await ensureSearchIndex();
      const q = url.searchParams,
        where = ["l.status='active'", "u.banned=0"],
        args = [];
      const country = ["sk", "cz"].includes(q.get("country")) ? q.get("country") : null;
      if (country) {
        where.push("l.country=?");
        args.push(country);
      }
      if (q.get("type") === "buy" || q.get("type") === "sell") {
        where.push("l.buy=?");
        args.push(q.get("type") === "buy" ? 1 : 0);
      }
      if (CATEGORIES.includes(q.get("cat"))) {
        where.push("l.category=?");
        args.push(q.get("cat"));
      }
      if (CONDITIONS.includes(q.get("cond"))) {
        where.push("l.condition=?");
        args.push(q.get("cond"));
      }
      const min = Number(q.get("min")),
        max = Number(q.get("max"));
      if (q.get("min") && Number.isFinite(min) && min > 0) {
        where.push("l.price>=?");
        args.push(Math.round(min * 100));
      }
      if (q.get("max") && Number.isFinite(max) && max >= 0) {
        where.push("l.price<=?");
        args.push(Math.round(max * 100));
      }
      for (const word of fold(text(q.get("q"), 200))
        .split(" ")
        .filter(Boolean)
        .slice(0, 8)) {
        where.push("l.search LIKE ? ESCAPE '\\'");
        args.push("%" + escapeLike(word) + "%");
      }
      const loc = text(q.get("city"), 100);
      if (loc) {
        const radius = Math.min(300, Math.max(0, Number(q.get("radius")) || 0)),
          countries = country ? [country] : ["sk", "cz"];
        let origin = null;
        for (const c of countries) origin = origin || resolvePlace(c, loc);
        if (origin && radius > 0) {
          const keys = countries.flatMap((c) => placesWithin(c, origin, radius).map((p) => fold(p.name)));
          where.push(`l.city_key IN (${keys.map(() => "?").join(",")})`);
          args.push(...keys);
        } else if (origin) {
          where.push("l.city_key=?");
          args.push(fold(origin.name));
        } else if (fold(loc)) {
          where.push("l.city_key LIKE ? ESCAPE '\\'");
          args.push("%" + escapeLike(fold(loc)) + "%");
        }
      }
      if (q.get("saved") === "1") {
        need(false);
        where.push("l.id IN (SELECT listing_id FROM favorites WHERE user_id=?)");
        args.push(user.id);
      }
      const sort = q.get("sort"),
        order =
          sort === "low"
            ? "l.price ASC,l.created DESC"
            : sort === "high"
              ? "l.price DESC,l.created DESC"
              : "(l.boost_until>?) DESC,l.created DESC";
      const p = paging(q, 24, 60),
        sqlWhere = where.join(" AND ");
      const total = (await first(`SELECT count(*) n FROM listings l JOIN users u ON u.id=l.owner WHERE ${sqlWhere}`, ...args))
        .n;
      const rows = await all(
        `${listingSelect} WHERE ${sqlWhere} ORDER BY ${order} LIMIT ? OFFSET ?`,
        ...args,
        ...(sort === "low" || sort === "high" ? [] : [now]),
        p.limit,
        p.offset,
      );
      return json(pageResult("listings", rows.map(listingDTO), total, p));
    }
    if (path === "listings/featured" && method === "GET") {
      const country = url.searchParams.get("country") === "cz" ? "cz" : "sk";
      const boosted = await all(
        `${listingSelect} WHERE l.status='active' AND u.banned=0 AND l.country=? AND l.buy=0 AND l.boost_until>? ORDER BY random() LIMIT 4`,
        country,
        now,
      );
      if (boosted.length) return json({ kind: "boosted", listings: boosted.map(listingDTO) });
      const latest = await all(
        `${listingSelect} WHERE l.status='active' AND u.banned=0 AND l.country=? ORDER BY l.created DESC LIMIT 8`,
        country,
      );
      return json({ kind: "latest", listings: latest.map(listingDTO) });
    }
    if (path === "listings" && method === "POST") {
      need();
      await limit("listing", user.id, 30);
      await limit("listingDay", user.id, 100, DAY);
      const b = await bodyJSON(request),
        f = listingFields(b),
        ids = photoIds(b.uploadIds, f.buy);
      const submission = text(b.submission, 80);
      if (!submission) fail(400, "Chýba identifikátor inzerátu.");
      const previous = await first("SELECT id FROM listings WHERE owner=? AND submission=?", user.id, submission);
      if (previous) return json({ id: previous.id });
      const encoded = JSON.stringify(ids),
        id = nid();
      const result = await DB.batch([
        stmt(
          "INSERT INTO listings(id,owner,title,description,category,price,city,country,condition,buy,phone,photos,created,updated,submission,search,city_key) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT count(*) FROM uploads WHERE owner=? AND listing_id IS NULL AND id IN (SELECT value FROM json_each(?)))=?",
          id,
          user.id,
          f.title,
          f.description,
          f.category,
          f.price,
          f.city,
          f.country,
          f.condition,
          +f.buy,
          f.phone,
          encoded,
          now,
          now,
          submission,
          f.search,
          f.cityKey,
          user.id,
          encoded,
          ids.length,
        ),
        stmt(
          "UPDATE uploads SET listing_id=? WHERE owner=? AND listing_id IS NULL AND id IN (SELECT value FROM json_each(?)) AND EXISTS(SELECT 1 FROM listings WHERE id=?)",
          id,
          user.id,
          encoded,
          id,
        ),
      ]);
      if (!result[0].meta?.changes) fail(409, "Fotografie sa zmenili alebo nepatria tomuto účtu. Nahraj ich znova.");
      return json({ id }, 201);
    }
    const lm = path.match(/^listings\/(\d+)(?:\/(contacts|boost|view))?$/);
    if (lm) {
      const id = Number(lm[1]),
        action = lm[2],
        d = await listingRow(id);
      if (!d) fail(404, "Inzerát sa nenašiel.");
      const mine = user && d.owner === user.id,
        publicVisible = ["active", "sold"].includes(d.status) && !d.owner_banned;
      if (!action && method === "GET") {
        if (!publicVisible && !mine && !admin()) fail(404, "Inzerát sa nenašiel.");
        const out = listingDTO(d);
        if (admin() && !mine) Object.assign(out, { adminView: true, moderationNote: d.moderation_note || "" });
        return json({ listing: out });
      }
      if (action === "contacts" && method === "POST") {
        need();
        if (d.status !== "active" || d.owner_banned) fail(404, "Inzerát nie je aktívny.");
        await limit("contacts", user.id, 60);
        return json({ email: d.owner_email, phone: d.phone });
      }
      if (action === "view" && method === "POST") {
        need();
        if (!mine && d.status === "active")
          await run(
            "INSERT OR IGNORE INTO listing_views(user_id,listing_id,day) VALUES(?,?,?)",
            user.id,
            id,
            Math.floor(now / DAY),
          );
        return json({ ok: true });
      }
      if (action === "boost" && method === "POST") {
        need();
        if (!mine) fail(404, "Inzerát sa nenašiel.");
        if (d.status !== "active") fail(400, "Zvýrazniť možno iba aktívny inzerát.");
        const b = await bodyJSON(request);
        if (b.off === true) {
          await run("UPDATE listings SET boost_until=0 WHERE id=?", id);
          return json({ ok: true });
        }
        if (![3, 7, 14].includes(Number(b.days))) fail(400, "Vyber dĺžku zvýraznenia.");
        await run("UPDATE listings SET boost_until=? WHERE id=?", now + Number(b.days) * DAY, id);
        return json({ ok: true, free: true });
      }
      if (!action && (method === "PATCH" || method === "DELETE")) {
        need();
        if (!mine) fail(404, "Inzerát sa nenašiel.");
        if (method === "DELETE") {
          await removeListing(d);
          return json({ ok: true });
        }
        if (d.status === "hidden") fail(403, "Inzerát je skrytý moderátorom. Môžeš ho iba odstrániť.");
        const b = await bodyJSON(request);
        if (b.status) {
          if (!["active", "sold"].includes(b.status)) fail(400, "Neplatný stav.");
          await run("UPDATE listings SET status=?,boost_until=0,updated=? WHERE id=?", b.status, now, id);
          return json({ ok: true });
        }
        const f = listingFields({
          title: d.title,
          desc: d.description,
          cat: d.category,
          state: d.condition,
          city: d.city,
          phone: d.phone,
          country: d.country,
          buy: !!d.buy,
          price: d.price / 100,
          ...b,
        });
        const ids = photoIds(b.uploadIds === undefined ? JSON.parse(d.photos) : b.uploadIds, f.buy),
          encoded = JSON.stringify(ids);
        const result = await DB.batch([
          stmt(
            "UPDATE listings SET title=?,description=?,category=?,price=?,city=?,country=?,condition=?,buy=?,phone=?,photos=?,search=?,city_key=?,updated=? WHERE id=? AND photos=? AND (SELECT count(*) FROM uploads WHERE owner=? AND (listing_id IS NULL OR listing_id=?) AND id IN (SELECT value FROM json_each(?)))=?",
            f.title,
            f.description,
            f.category,
            f.price,
            f.city,
            f.country,
            f.condition,
            +f.buy,
            f.phone,
            encoded,
            f.search,
            f.cityKey,
            now,
            id,
            d.photos,
            user.id,
            id,
            encoded,
            ids.length,
          ),
          stmt(
            "UPDATE uploads SET listing_id=? WHERE owner=? AND listing_id IS NULL AND id IN (SELECT value FROM json_each(?)) AND EXISTS(SELECT 1 FROM listings WHERE id=? AND photos=?)",
            id,
            user.id,
            encoded,
            id,
            encoded,
          ),
        ]);
        if (!result[0].meta?.changes)
          fail(409, "Fotografie sa zmenili alebo nepatria tomuto účtu. Obnov inzerát a skús znova.");
        for (const photo of JSON.parse(d.photos).filter((x) => !ids.includes(x))) {
          const deleted = await run(
            "DELETE FROM uploads WHERE id=? AND owner=? AND listing_id=? AND NOT EXISTS(SELECT 1 FROM listings WHERE id=? AND photos LIKE ?)",
            photo,
            user.id,
            id,
            id,
            "%" + photo + "%",
          );
          if (deleted.meta?.changes) await BUCKET.delete(photo);
        }
        return json({ ok: true });
      }
    }

    // ---- Favorites ----------------------------------------------------------
    if (path === "favorites" && method === "POST") {
      need();
      const b = await bodyJSON(request),
        id = Number(b.id);
      const d = await listingRow(id);
      if (!d || d.status === "hidden" || d.owner_banned) fail(404, "Inzerát sa nenašiel.");
      if (b.save === true) await run("INSERT OR IGNORE INTO favorites(user_id,listing_id) VALUES(?,?)", user.id, id);
      else await run("DELETE FROM favorites WHERE user_id=? AND listing_id=?", user.id, id);
      return json({ ok: true, saved: b.save === true });
    }

    // ---- Messages -----------------------------------------------------------
    if (path === "inbox" && method === "GET") {
      need();
      const p = paging(url.searchParams, 30, 60),
        unreadOnly = url.searchParams.get("filter") === "unread",
        query = text(url.searchParams.get("q"), 100);
      const peer = "CASE WHEN c.buyer=? THEN c.seller ELSE c.buyer END";
      const unread = "(SELECT count(*) FROM messages m WHERE m.conversation_id=c.id AND m.read=0 AND m.sender<>?)";
      let where =
        "((c.buyer=? AND c.buyer_hidden=0) OR (c.seller=? AND c.seller_hidden=0 AND EXISTS(SELECT 1 FROM messages m WHERE m.conversation_id=c.id)))";
      const args = [user.id, user.id];
      if (unreadOnly) {
        where += ` AND ${unread}>0`;
        args.push(user.id);
      }
      if (query) {
        where += " AND (l.title LIKE ? ESCAPE '\\' OR p.name LIKE ? ESCAPE '\\')";
        args.push("%" + escapeLike(query) + "%", "%" + escapeLike(query) + "%");
      }
      const from = `FROM conversations c LEFT JOIN listings l ON l.id=c.listing_id JOIN users p ON p.id=${peer}`;
      const total = (await first(`SELECT count(*) n ${from} WHERE ${where}`, user.id, ...args)).n;
      const rows = await all(
        `SELECT c.*,l.title,l.price,l.country,l.buy,l.photos,l.status listing_status,p.name peer_name,p.id peer_id,
          (SELECT body FROM messages m WHERE m.conversation_id=c.id ORDER BY m.sent DESC,m.id DESC LIMIT 1) last_body,
          (SELECT sender FROM messages m WHERE m.conversation_id=c.id ORDER BY m.sent DESC,m.id DESC LIMIT 1) last_sender,
          ${unread} unread ${from} WHERE ${where} ORDER BY c.updated DESC LIMIT ? OFFSET ?`,
        user.id,
        user.id,
        ...args,
        p.limit,
        p.offset,
      );
      const blockedPeers = (await all("SELECT peer FROM blocks WHERE user_id=?", user.id)).map((x) => x.peer);
      return json({
        ...pageResult(
          "threads",
          rows.map((c) => {
            const photos = c.photos ? JSON.parse(c.photos) : [];
            return {
              id: String(c.id),
              adId: c.listing_id,
              peer: c.peer_name,
              peerKey: c.peer_id,
              title: c.title && c.listing_status !== "deleted" ? c.title : "Odstránený inzerát",
              price: (c.price || 0) / 100,
              country: c.country || "sk",
              buy: !!c.buy,
              photo: photos.length && c.listing_status !== "deleted" ? "/media/" + photos[0] : "/assets/wanted.svg",
              last: c.last_body || "",
              lastOut: c.last_sender === user.id,
              unread: c.unread,
              updatedAt: c.updated,
              closed: c.listing_status !== "active",
              blocked: blockedPeers.includes(c.peer_id),
            };
          }),
          total,
          p,
        ),
        unread: await unreadCount(),
        notificationEmail: !!user.notifications,
      });
    }
    if (path === "conversations" && method === "POST") {
      need();
      const b = await bodyJSON(request),
        d = await listingRow(Number(b.id));
      if (!d || d.status !== "active" || d.owner_banned) fail(404, "Inzerát nie je aktívny.");
      if (d.owner === user.id) fail(400, "Nemôžeš písať sám sebe.");
      if (await blocked(user.id, d.owner)) fail(403, "Komunikácia je zablokovaná.");
      await run(
        "INSERT OR IGNORE INTO conversations(id,listing_id,buyer,seller,updated) VALUES(?,?,?,?,?)",
        nid(),
        d.id,
        user.id,
        d.owner,
        now,
      );
      const c = await first("SELECT * FROM conversations WHERE listing_id=? AND buyer=?", d.id, user.id);
      await run("UPDATE conversations SET buyer_hidden=0 WHERE id=?", c.id);
      return json({ id: String(c.id) });
    }
    const cm = path.match(/^conversations\/(\d+)(?:\/(messages|read|block))?$/);
    if (cm) {
      const c = await conversation(cm[1]),
        action = cm[2],
        peer = c.buyer === user.id ? c.seller : c.buyer;
      if (!action && method === "GET") {
        const d = await first("SELECT * FROM listings WHERE id=?", c.listing_id),
          p = await first("SELECT name,deleted FROM users WHERE id=?", peer),
          photos = d && d.status !== "deleted" ? JSON.parse(d.photos) : [];
        const ms = await all(
          "SELECT * FROM messages WHERE conversation_id=? ORDER BY sent DESC,id DESC LIMIT 51",
          c.id,
        );
        return json({
          thread: {
            id: String(c.id),
            adId: c.listing_id,
            peer: p?.name || "Odstránený účet",
            peerKey: peer,
            peerDeleted: !p || !!p.deleted,
            title: d && d.status !== "deleted" ? d.title : "Odstránený inzerát",
            price: (d?.price || 0) / 100,
            country: d?.country || "sk",
            buy: !!d?.buy,
            photo: photos.length ? "/media/" + photos[0] : "/assets/wanted.svg",
            closed: !d || d.status !== "active",
            blocked: !!(await first("SELECT 1 FROM blocks WHERE user_id=? AND peer=?", user.id, peer)),
            blockedBy: !!(await first("SELECT 1 FROM blocks WHERE user_id=? AND peer=?", peer, user.id)),
            role: c.buyer === user.id ? "buyer" : "seller",
          },
          messages: ms.slice(0, 50).reverse().map(messageDTO),
          hasMore: ms.length > 50,
        });
      }
      if (action === "messages" && method === "POST") {
        await limit("message", user.id, 40, 60000);
        await limit("messageDay", user.id, 1000, DAY);
        if (await blocked(user.id, peer)) fail(403, "Komunikácia je zablokovaná.");
        const b = await bodyJSON(request),
          message = text(b.text, 4000);
        if (!message) fail(400, "Napíš správu.");
        const p = await first("SELECT * FROM users WHERE id=? AND deleted=0", peer);
        if (!p) fail(400, "Účet už nie je dostupný.");
        const pending = await first(
          "SELECT count(*) n FROM messages WHERE conversation_id=? AND sender=? AND read=0",
          c.id,
          user.id,
        );
        const m = { id: nid(), conversation_id: c.id, sender: user.id, body: message, sent: now, read: 0 };
        await DB.batch([
          stmt(
            "INSERT INTO messages(id,conversation_id,sender,body,sent) VALUES(?,?,?,?,?)",
            m.id,
            c.id,
            user.id,
            message,
            now,
          ),
          stmt("UPDATE conversations SET updated=?,buyer_hidden=0,seller_hidden=0 WHERE id=?", now, c.id),
        ]);
        if (p.notifications && !p.banned && !pending.n)
          notify(
            p.email,
            "Nová správa — Bazaro",
            `${user.name} ti poslal(a) správu na Bazaro.\n\nPrečítať a odpovedať: ${env.APP_URL}/spravy/?inzerat=${c.id}\n\nUpozornenia vypneš v časti Správy → Emailové upozornenia.`,
          );
        return json({ ok: true, message: messageDTO(m) }, 201);
      }
      if (action === "messages" && method === "GET") {
        const q = url.searchParams;
        if (q.has("after")) {
          const after = Number(q.get("after")) || 0,
            afterId = Number(q.get("afterId")) || 0;
          const rows = await all(
            "SELECT * FROM messages WHERE conversation_id=? AND (sent>? OR (sent=? AND id>?)) ORDER BY sent,id LIMIT 200",
            c.id,
            after,
            after,
            afterId,
          );
          const reads = await all(
            "SELECT id FROM messages WHERE conversation_id=? AND sender=? AND read=1 ORDER BY sent DESC LIMIT 200",
            c.id,
            user.id,
          );
          return json({ messages: rows.map(messageDTO), readIds: reads.map((r) => r.id) });
        }
        const before = Number(q.get("before")) || Number.MAX_SAFE_INTEGER,
          beforeId = Number(q.get("beforeId")) || Number.MAX_SAFE_INTEGER;
        const rows = await all(
          "SELECT * FROM messages WHERE conversation_id=? AND (sent<? OR (sent=? AND id<?)) ORDER BY sent DESC,id DESC LIMIT 51",
          c.id,
          before,
          before,
          beforeId,
        );
        return json({ messages: rows.slice(0, 50).reverse().map(messageDTO), hasMore: rows.length > 50 });
      }
      if (action === "read" && method === "POST") {
        await run("UPDATE messages SET read=1 WHERE conversation_id=? AND sender<>? AND read=0", c.id, user.id);
        return json({ ok: true, unread: await unreadCount() });
      }
      if (action === "block" && method === "POST") {
        const b = await bodyJSON(request);
        if (b.block) await run("INSERT OR IGNORE INTO blocks(user_id,peer) VALUES(?,?)", user.id, peer);
        else await run("DELETE FROM blocks WHERE user_id=? AND peer=?", user.id, peer);
        return json({ ok: true });
      }
      if (!action && method === "DELETE") {
        await run(
          `UPDATE conversations SET ${c.buyer === user.id ? "buyer_hidden" : "seller_hidden"}=1 WHERE id=?`,
          c.id,
        );
        return json({ ok: true });
      }
    }

    // ---- Reports ------------------------------------------------------------
    if (path === "reports" && method === "POST") {
      await limit("report", ip, 10);
      const b = await bodyJSON(request),
        details = text(b.details, 3000),
        reason = text(b.reason, 100),
        contact = text(b.email || user?.email, 254);
      if (details.length < 10 || !reason || !emailValid(contact) || b.confirm !== true)
        fail(400, "Vyplň dôvod, podrobnosti, email a potvrď pravdivosť hlásenia.");
      let id = Number(b.listingId) || null;
      if (id && !(await listingRow(id))) id = null;
      const note =
        details + (b.url ? "\nOdkaz: " + text(b.url, 1000) : "") + (b.name ? "\nOznamovateľ: " + text(b.name, 80) : "");
      await run(
        "INSERT INTO reports(id,user_id,listing_id,reason,details,contact,created) VALUES(?,?,?,?,?,?,?)",
        nid(),
        user?.id || null,
        id,
        reason,
        note,
        contact,
        now,
      );
      for (const to of adminEmails(env))
        notify(
          to,
          "Nové hlásenie — Bazaro",
          `Dôvod: ${reason}\n${id ? "Inzerát: " + env.APP_URL + "/inzerat/?id=" + id + "\n" : ""}\nPosúdiť: ${env.APP_URL}/administracia/?sekcia=hlasenia`,
        );
      return json({ ok: true }, 201);
    }

    // ---- Administration -----------------------------------------------------
    if (path.startsWith("admin/")) {
      needAdmin();
      const q = url.searchParams,
        sub = path.slice(6);
      async function moderateListing(d, action, note) {
        if (action === "hide") {
          if (!["active", "sold"].includes(d.status)) fail(400, "Skryť možno iba zverejnený inzerát.");
          await DB.batch([
            stmt(
              "UPDATE listings SET status='hidden',boost_until=0,moderation_note=?,updated=? WHERE id=?",
              note,
              now,
              d.id,
            ),
            stmt(
              "UPDATE reports SET status='resolved',resolution=?,resolved=? WHERE listing_id=? AND status='open'",
              "Inzerát skrytý" + (note ? ": " + note : ""),
              now,
              d.id,
            ),
          ]);
          notify(
            d.owner_email,
            "Tvoj inzerát bol skrytý — Bazaro",
            `Inzerát „${d.title}“ sme skryli, pretože porušuje pravidlá inzercie.${note ? "\n\nDôvod: " + note : ""}\n\nPravidlá: ${env.APP_URL}/pravidla-inzercie/\nAk nesúhlasíš, odpovedz prevádzkovateľovi cez kontakt uvedený na ${env.APP_URL}/kontakt/`,
          );
        } else if (action === "restore") {
          if (d.status !== "hidden") fail(400, "Obnoviť možno iba skrytý inzerát.");
          await run("UPDATE listings SET status='active',moderation_note='',updated=? WHERE id=?", now, d.id);
        } else if (action === "delete") {
          await removeListing(d);
          await run(
            "UPDATE reports SET status='resolved',resolution=?,resolved=? WHERE listing_id=? AND status='open'",
            "Inzerát odstránený" + (note ? ": " + note : ""),
            now,
            d.id,
          );
          notify(
            d.owner_email,
            "Tvoj inzerát bol odstránený — Bazaro",
            `Inzerát „${d.title}“ bol odstránený administrátorom.${note ? "\n\nDôvod: " + note : ""}\n\nPravidlá: ${env.APP_URL}/pravidla-inzercie/`,
          );
        } else if (action === "unboost") {
          await run("UPDATE listings SET boost_until=0 WHERE id=?", d.id);
        } else fail(400, "Neznáma akcia.");
        await audit("listing." + action, d.id, note);
      }
      if (sub === "stats" && method === "GET") {
        const week = now - 7 * DAY;
        const s = await first(
          `SELECT
            (SELECT count(*) FROM users WHERE deleted=0) users,
            (SELECT count(*) FROM users WHERE deleted=0 AND verified=1) verified,
            (SELECT count(*) FROM users WHERE deleted=0 AND banned=1) banned,
            (SELECT count(*) FROM users WHERE deleted=0 AND created>?) usersWeek,
            (SELECT count(*) FROM listings WHERE status='active') active,
            (SELECT count(*) FROM listings WHERE status='sold') sold,
            (SELECT count(*) FROM listings WHERE status='hidden') hidden,
            (SELECT count(*) FROM listings WHERE status<>'deleted' AND created>?) listingsWeek,
            (SELECT count(*) FROM listings WHERE status='active' AND boost_until>?) boosted,
            (SELECT count(*) FROM reports WHERE status='open') openReports,
            (SELECT count(*) FROM messages WHERE sent>?) messagesWeek,
            (SELECT count(*) FROM conversations) conversations,
            (SELECT coalesce(sum(bytes),0) FROM uploads) storageBytes,
            (SELECT count(*) FROM uploads) photos`,
          week,
          week,
          now,
          week,
        );
        const categories = await all(
          "SELECT category,count(*) n FROM listings WHERE status='active' GROUP BY category ORDER BY n DESC",
        );
        return json({ stats: s, categories, email: mailReady(env), version: VERSION });
      }
      if (sub === "reports" && method === "GET") {
        const p = paging(q, 25, 100),
          status = ["open", "resolved"].includes(q.get("status")) ? q.get("status") : null;
        const where = status ? "WHERE r.status=?" : "",
          args = status ? [status] : [];
        const total = (await first(`SELECT count(*) n FROM reports r ${where}`, ...args)).n;
        const rows = await all(
          `SELECT r.*,l.title listing_title,l.status listing_status,l.owner listing_owner,o.name owner_name,o.email owner_email,u.name reporter_name,
            (SELECT count(*) FROM reports x WHERE x.listing_id=r.listing_id AND x.listing_id IS NOT NULL) listing_reports
           FROM reports r LEFT JOIN listings l ON l.id=r.listing_id LEFT JOIN users o ON o.id=l.owner LEFT JOIN users u ON u.id=r.user_id
           ${where} ORDER BY r.status='open' DESC,r.created DESC LIMIT ? OFFSET ?`,
          ...args,
          p.limit,
          p.offset,
        );
        return json(pageResult("reports", rows, total, p));
      }
      const rm = sub.match(/^reports\/(\d+)$/);
      if (rm && method === "POST") {
        const b = await bodyJSON(request),
          note = text(b.note, 500),
          r = await first("SELECT * FROM reports WHERE id=?", Number(rm[1]));
        if (!r) fail(404, "Hlásenie sa nenašlo.");
        if (b.action === "hide" || b.action === "delete") {
          const d = r.listing_id ? await listingRow(r.listing_id) : null;
          if (!d) fail(400, "Hlásenie nemá dostupný inzerát.");
          await moderateListing(d, b.action, note);
        } else if (b.action === "resolve") {
          await run(
            "UPDATE reports SET status='resolved',resolution=?,resolved=? WHERE id=?",
            note || "Bez zásahu",
            now,
            r.id,
          );
          await audit("report.resolve", r.id, note);
        } else if (b.action === "reopen") {
          await run("UPDATE reports SET status='open',resolution='',resolved=0 WHERE id=?", r.id);
          await audit("report.reopen", r.id, note);
        } else fail(400, "Neznáma akcia.");
        return json({ ok: true });
      }
      if (sub === "listings" && method === "GET") {
        await ensureSearchIndex();
        const p = paging(q, 25, 100),
          status = q.get("status"),
          term = text(q.get("q"), 200),
          where = [],
          args = [];
        if (["active", "sold", "hidden", "deleted"].includes(status)) {
          where.push("l.status=?");
          args.push(status);
        } else where.push("l.status<>'deleted'");
        if (q.get("owner")) {
          where.push("l.owner=?");
          args.push(text(q.get("owner"), 64));
        }
        if (/^\d+$/.test(term)) {
          where.push("l.id=?");
          args.push(Number(term));
        } else if (term.includes("@")) {
          where.push("u.email LIKE ? ESCAPE '\\'");
          args.push("%" + escapeLike(term.toLowerCase()) + "%");
        } else
          for (const word of fold(term).split(" ").filter(Boolean).slice(0, 8)) {
            where.push("l.search LIKE ? ESCAPE '\\'");
            args.push("%" + escapeLike(word) + "%");
          }
        const sqlWhere = where.join(" AND ");
        const total = (await first(`SELECT count(*) n FROM listings l JOIN users u ON u.id=l.owner WHERE ${sqlWhere}`, ...args))
          .n;
        const rows = await all(
          `${listingSelect.replace("FROM", ",(SELECT count(*) FROM reports r WHERE r.listing_id=l.id AND r.status='open') open_reports FROM")} WHERE ${sqlWhere} ORDER BY l.created DESC LIMIT ? OFFSET ?`,
          ...args,
          p.limit,
          p.offset,
        );
        return json(
          pageResult(
            "listings",
            rows.map((r) => ({
              ...listingDTO(r),
              ownerEmail: r.owner_email,
              ownerBanned: !!r.owner_banned,
              openReports: r.open_reports,
              moderationNote: r.moderation_note,
            })),
            total,
            p,
          ),
        );
      }
      const alm = sub.match(/^listings\/(\d+)$/);
      if (alm && method === "POST") {
        const b = await bodyJSON(request),
          d = await first(`${listingSelect} WHERE l.id=?`, Number(alm[1]));
        if (!d || d.status === "deleted") fail(404, "Inzerát sa nenašiel.");
        await moderateListing(d, b.action, text(b.note, 500));
        return json({ ok: true });
      }
      if (sub === "users" && method === "GET") {
        const p = paging(q, 25, 100),
          filter = q.get("filter"),
          term = text(q.get("q"), 200).toLowerCase(),
          where = ["u.deleted=0"],
          args = [];
        if (filter === "banned") where.push("u.banned=1");
        if (filter === "unverified") where.push("u.verified=0");
        if (term) {
          where.push("(u.email LIKE ? ESCAPE '\\' OR lower(u.name) LIKE ? ESCAPE '\\' OR u.id=?)");
          args.push("%" + escapeLike(term) + "%", "%" + escapeLike(term) + "%", term);
        }
        const sqlWhere = where.join(" AND ");
        const total = (await first(`SELECT count(*) n FROM users u WHERE ${sqlWhere}`, ...args)).n;
        const rows = await all(
          `SELECT u.id,u.email,u.name,u.phone,u.verified,u.banned,u.ban_reason,u.created,u.last_login,
            (SELECT count(*) FROM listings l WHERE l.owner=u.id AND l.status<>'deleted') listings,
            (SELECT count(*) FROM reports r JOIN listings l ON l.id=r.listing_id WHERE l.owner=u.id) reports
           FROM users u WHERE ${sqlWhere} ORDER BY u.created DESC LIMIT ? OFFSET ?`,
          ...args,
          p.limit,
          p.offset,
        );
        const admins = adminEmails(env);
        return json(
          pageResult(
            "users",
            rows.map((r) => ({ ...r, verified: !!r.verified, banned: !!r.banned, admin: admins.includes(r.email) })),
            total,
            p,
          ),
        );
      }
      const aum = sub.match(/^users\/([\w-]+)$/);
      if (aum && method === "POST") {
        const b = await bodyJSON(request),
          note = text(b.note, 500),
          target = await first("SELECT * FROM users WHERE id=? AND deleted=0", aum[1]);
        if (!target) fail(404, "Používateľ sa nenašiel.");
        if (["ban", "delete", "logout"].includes(b.action) && adminEmails(env).includes(target.email))
          fail(400, "Administrátorský účet takto upraviť nemožno.");
        if (b.action === "ban") {
          await DB.batch([
            stmt("UPDATE users SET banned=1,ban_reason=? WHERE id=?", note, target.id),
            stmt("DELETE FROM sessions WHERE user_id=?", target.id),
            stmt("UPDATE listings SET boost_until=0 WHERE owner=?", target.id),
          ]);
          notify(
            target.email,
            "Tvoj účet bol zablokovaný — Bazaro",
            `Tvoj účet na Bazaro bol zablokovaný pre porušenie pravidiel.${note ? "\n\nDôvod: " + note : ""}\n\nKontakt: ${env.APP_URL}/kontakt/`,
          );
        } else if (b.action === "unban") await run("UPDATE users SET banned=0,ban_reason='' WHERE id=?", target.id);
        else if (b.action === "verify") await run("UPDATE users SET verified=1 WHERE id=?", target.id);
        else if (b.action === "logout") await run("DELETE FROM sessions WHERE user_id=?", target.id);
        else if (b.action === "delete") await purgeUser(target.id);
        else fail(400, "Neznáma akcia.");
        await audit("user." + b.action, target.email, note);
        return json({ ok: true });
      }
      if (sub === "log" && method === "GET") {
        const p = paging(q, 50, 100);
        const total = (await first("SELECT count(*) n FROM admin_log")).n;
        const rows = await all("SELECT * FROM admin_log ORDER BY created DESC LIMIT ? OFFSET ?", p.limit, p.offset);
        return json(pageResult("log", rows, total, p));
      }
    }
    fail(404, "Táto požiadavka neexistuje.");
  } catch (e) {
    if (!e.status) console.error("bazaro_api_failure", path, e.message);
    return json({ error: e.status ? e.message : "Serverová chyba. Skús to neskôr." }, e.status || 500);
  }
}

export async function media(request, env) {
  const id = new URL(request.url).pathname.split("/")[2];
  if (!id || !/^[\w-]{1,64}$/.test(id)) return new Response("Not found", { status: 404 });
  const row = await env.DB.prepare(
    "SELECT up.*,l.status,o.banned owner_banned FROM uploads up LEFT JOIN listings l ON l.id=up.listing_id LEFT JOIN users o ON o.id=up.owner WHERE up.id=?",
  )
    .bind(id)
    .first();
  if (!row) return new Response("Not found", { status: 404 });
  const isPublic = row.listing_id && ["active", "sold"].includes(row.status) && !row.owner_banned;
  if (!isPublic) {
    const t = sessionToken(request);
    const viewer = t
      ? await env.DB.prepare(
          "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=? AND s.expires>? AND u.deleted=0 AND u.banned=0",
        )
          .bind(sha(t), Date.now())
          .first()
      : null;
    if (!viewer || (viewer.id !== row.owner && !isAdminUser(env, viewer)))
      return new Response("Not found", { status: 404 });
  }
  const obj = await env.BUCKET.get(id);
  if (!obj) return new Response("Not found", { status: 404 });
  return new Response(request.method === "HEAD" ? null : obj.body, {
    headers: {
      "Content-Type": row.mime,
      "Cache-Control": isPublic ? "public, max-age=3600" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}

// Daily housekeeping, triggered by the cron schedule in wrangler.jsonc.
export async function maintenance(env, now = Date.now()) {
  const DB = env.DB,
    run = (q, ...a) => DB.prepare(q).bind(...a).run();
  await run("DELETE FROM rate_limits WHERE expires<?", now);
  await run("DELETE FROM sessions WHERE expires<?", now);
  await run("DELETE FROM email_tokens WHERE expires<?", now);
  const stale = (
    await DB.prepare("SELECT id FROM uploads WHERE listing_id IS NULL AND created<? LIMIT 500")
      .bind(now - DAY)
      .all()
  ).results;
  for (const f of stale) {
    await run("DELETE FROM uploads WHERE id=?", f.id);
    await env.BUCKET.delete(f.id);
  }
  return { removedUploads: stale.length };
}
