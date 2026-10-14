import { api, media, maintenance } from "./server/api.mjs";
import { pages } from "./server/pages.mjs";
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const privatePages = new Set([
  "/ucet/",
  "/spravy/",
  "/administracia/",
  "/pridat/",
  "/prihlasenie/",
  "/registracia/",
  "/overenie/",
  "/obnova-hesla/",
  "/zabudnute-heslo/",
]);
function secure(response) {
  const r = new Response(response.body, response),
    h = r.headers;
  h.set("X-Content-Type-Options", "nosniff");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  h.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if ((h.get("Content-Type") || "").includes("text/html")) {
    h.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self' blob: data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
    );
    h.set("X-Frame-Options", "DENY");
  }
  h.set("Strict-Transport-Security", "max-age=31536000");
  return r;
}
// Operator details come from configuration so legal pages never contain made-up data.
function operatorValues(env) {
  const missing = '<span class="legal-missing">údaj doplní prevádzkovateľ v konfigurácii</span>';
  const value = (v) => (String(v || "").trim() ? esc(String(v).trim()) : missing);
  const email = String(env.CONTACT_EMAIL || "").trim();
  return {
    "{{OPERATOR_NAME}}": value(env.OPERATOR_NAME),
    "{{OPERATOR_ADDRESS}}": value(env.OPERATOR_ADDRESS),
    "{{OPERATOR_ID}}": value(env.OPERATOR_ID || "—"),
    "{{CONTACT_EMAIL}}": email ? `<a href="mailto:${esc(email)}">${esc(email)}</a>` : missing,
    "{{SITE_URL}}": esc(env.APP_URL || ""),
    "{{YEAR}}": String(new Date().getFullYear()),
  };
}
export async function handle(request, env, ctx = { waitUntil() {} }) {
  const url = new URL(request.url),
    path = url.pathname,
    canonicalPath = path.endsWith("/") ? path : path + "/",
    indexing = env.PUBLIC_INDEXING === "true";
  // Platform identity headers must never authorize a user on a standalone deployment.
  const headers = new Headers(request.headers);
  headers.delete("oai-authenticated-user-id");
  headers.delete("oai-authenticated-user-email");
  request = new Request(request, { headers });
  if (path.startsWith("/api/")) return secure(await api(request, env, { waitUntil: (p) => ctx.waitUntil(p) }));
  if (path.startsWith("/media/")) return secure(await media(request, env));
  if (!["GET", "HEAD"].includes(request.method))
    return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  if (path === "/robots.txt") {
    const body = indexing
      ? `User-agent: *\nAllow: /\n${[...privatePages].map((p) => "Disallow: " + p).join("\n")}\nDisallow: /api/\nSitemap: ${url.origin}/sitemap.xml\n`
      : "User-agent: *\nDisallow: /\n";
    return new Response(request.method === "HEAD" ? null : body, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  let html = path.startsWith("/") ? pages[path] || pages[canonicalPath] : null;
  if (html) {
    let noindex = !indexing || privatePages.has(canonicalPath),
      meta = "";
    for (const [k, v] of Object.entries(operatorValues(env))) html = html.replaceAll(k, v);
    if (canonicalPath === "/inzerat/") {
      const id = Number(url.searchParams.get("id"));
      const listing =
        Number.isSafeInteger(id) && id > 0 && env.DB
          ? await env.DB.prepare(
              "SELECT l.title,l.description,l.photos FROM listings l JOIN users u ON u.id=l.owner WHERE l.id=? AND l.status IN ('active','sold') AND u.banned=0",
            )
              .bind(id)
              .first()
          : null;
      if (listing) {
        const photo = JSON.parse(listing.photos || "[]")[0];
        html = html
          .replace(/<title>.*?<\/title>/, `<title>${esc(listing.title)} — Bazaro</title>`)
          .replace(
            /<meta name="description" content="[^"]*">/,
            `<meta name="description" content="${esc(listing.description.slice(0, 160))}">`,
          );
        meta =
          `<link rel="canonical" href="${esc(url.origin + "/inzerat/?id=" + id)}">` +
          `<meta property="og:title" content="${esc(listing.title)}"><meta property="og:type" content="product">` +
          (photo ? `<meta property="og:image" content="${esc(url.origin + "/media/" + photo)}">` : "");
      } else noindex = true;
    } else meta = `<link rel="canonical" href="${esc(url.origin + canonicalPath)}">`;
    html = html.replace("</head>", meta + (noindex ? '<meta name="robots" content="noindex, nofollow">' : "") + "</head>");
    const response = new Response(request.method === "HEAD" ? null : html, {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
    if (noindex) response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return secure(response);
  }
  if (path === "/sitemap.xml") {
    if (!indexing) return new Response("Indexing disabled", { status: 404 });
    const locations = Object.keys(pages)
      .filter((p) => p.startsWith("/") && !privatePages.has(p) && p !== "/inzerat/" && p !== "/nahlasit/")
      .map((p) => url.origin + p);
    if (env.DB) {
      let last = 0;
      for (;;) {
        const { results } = await env.DB.prepare(
          "SELECT id FROM listings WHERE status='active' AND id>? ORDER BY id LIMIT 1000",
        )
          .bind(last)
          .all();
        for (const r of results) locations.push(url.origin + "/inzerat/?id=" + r.id);
        if (results.length < 1000 || locations.length >= 49000) break;
        last = results.at(-1).id;
      }
    }
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      locations.map((u) => "<url><loc>" + esc(u) + "</loc></url>").join("") +
      "</urlset>";
    return new Response(request.method === "HEAD" ? null : xml, {
      headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=300" },
    });
  }
  const asset = await env.ASSETS.fetch(request);
  if (asset.status === 404 && pages.__404)
    return secure(
      new Response(request.method === "HEAD" ? null : pages.__404.replaceAll("{{YEAR}}", String(new Date().getFullYear())), {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
      }),
    );
  return secure(asset);
}
export default {
  async fetch(request, env, ctx) {
    try {
      return await handle(request, env, ctx);
    } catch (error) {
      console.error("bazaro_worker_failure", error.message);
      return new Response("Služba je dočasne nedostupná. Skús to neskôr.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      });
    }
  },
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(maintenance(env).catch((e) => console.error("bazaro_maintenance_failure", e.message)));
  },
};
