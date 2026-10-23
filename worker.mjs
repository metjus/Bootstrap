import { api, media, maintenance, siteName } from "./server/api.mjs";
import { CATALOG, category, subcategory } from "./server/catalog.mjs";
import { pages } from "./server/pages.mjs";
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
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
const TURNSTILE = "https://challenges.cloudflare.com";
function secure(response) {
  const r = new Response(response.body, response),
    h = r.headers;
  h.set("X-Content-Type-Options", "nosniff");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  h.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if ((h.get("Content-Type") || "").includes("text/html")) {
    h.set(
      "Content-Security-Policy",
      `default-src 'self'; script-src 'self' ${TURNSTILE}; frame-src ${TURNSTILE}; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob:; connect-src 'self' blob: data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`,
    );
    h.set("X-Frame-Options", "DENY");
  }
  h.set("Strict-Transport-Security", "max-age=31536000");
  return r;
}
// Site name and operator details come from configuration, so legal pages never contain made-up data.
function configValues(env) {
  const missing = '<span class="legal-missing">údaj doplní prevádzkovateľ v konfigurácii</span>';
  const value = (v) => (String(v || "").trim() ? esc(String(v).trim()) : missing);
  const email = String(env.CONTACT_EMAIL || "").trim();
  return {
    "{{SITE_NAME}}": esc(siteName(env)),
    "{{OPERATOR_NAME}}": value(env.OPERATOR_NAME),
    "{{OPERATOR_ADDRESS}}": value(env.OPERATOR_ADDRESS),
    "{{OPERATOR_ID}}": value(env.OPERATOR_ID || "—"),
    "{{CONTACT_EMAIL}}": email ? `<a href="mailto:${esc(email)}">${esc(email)}</a>` : missing,
    "{{SITE_URL}}": esc(env.APP_URL || ""),
    "{{YEAR}}": String(new Date().getFullYear()),
  };
}
const fill = (html, env) => {
  for (const [k, v] of Object.entries(configValues(env))) html = html.replaceAll(k, v);
  return html;
};
// /auto/ and /auto/osobne-auta/ are category pages rendered by the listings page.
function categoryRoute(path) {
  const m = path.match(/^\/([a-z]+)\/(?:([a-z0-9-]+)\/)?$/);
  const c = m && category(m[1]);
  if (!c) return null;
  if (m[2] && !subcategory(c.slug, m[2])) return null;
  return { cat: c, sub: m[2] ? subcategory(c.slug, m[2]) : null };
}
export async function handle(request, env, ctx = { waitUntil() {} }) {
  const url = new URL(request.url),
    path = url.pathname,
    canonicalPath = path.endsWith("/") ? path : path + "/",
    indexing = env.PUBLIC_INDEXING === "true",
    site = siteName(env);
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
  const route = categoryRoute(canonicalPath);
  if (route && path !== canonicalPath) return Response.redirect(url.origin + canonicalPath + url.search, 301);
  let html = route ? pages["/inzeraty/"] : path.startsWith("/") ? pages[path] || pages[canonicalPath] : null;
  if (html) {
    let noindex = !indexing || privatePages.has(canonicalPath),
      meta = "";
    html = fill(html, env);
    if (route) {
      const name = route.sub ? `${route.sub.name} — ${route.cat.name}` : route.cat.name;
      html = html
        .replace(/<title>.*?<\/title>/, `<title>${esc(name)} — bazár ${esc(site)}</title>`)
        .replace(
          /<meta name="description" content="[^"]*">/,
          `<meta name="description" content="${esc(`${name}: inzeráty z celého Slovenska. Predaj a kúp z druhej ruky na ${site}.`)}">`,
        );
      meta = `<link rel="canonical" href="${esc(url.origin + canonicalPath)}">`;
    } else if (canonicalPath === "/inzerat/") {
      const id = Number(url.searchParams.get("id"));
      const listing =
        Number.isSafeInteger(id) && id > 0 && env.DB
          ? await env.DB.prepare(
              "SELECT l.title,l.description,l.photos FROM listings l JOIN users u ON u.id=l.owner WHERE l.id=? AND (l.status='sold' OR (l.status='active' AND l.expires>?)) AND u.banned=0",
            )
              .bind(id, Date.now())
              .first()
          : null;
      if (listing) {
        const photo = JSON.parse(listing.photos || "[]")[0];
        html = html
          .replace(/<title>.*?<\/title>/, `<title>${esc(listing.title)} — ${esc(site)}</title>`)
          .replace(
            /<meta name="description" content="[^"]*">/,
            `<meta name="description" content="${esc(listing.description.slice(0, 160))}">`,
          );
        meta =
          `<link rel="canonical" href="${esc(url.origin + "/inzerat/?id=" + id)}">` +
          `<meta property="og:title" content="${esc(listing.title)}"><meta property="og:type" content="product">` +
          (photo ? `<meta property="og:image" content="${esc(url.origin + "/media/" + photo)}">` : "");
      } else noindex = true;
    } else if (canonicalPath === "/predajca/") noindex = true;
    else meta = `<link rel="canonical" href="${esc(url.origin + canonicalPath)}">`;
    html = html.replace(
      "</head>",
      meta + (noindex ? '<meta name="robots" content="noindex, nofollow">' : "") + "</head>",
    );
    const response = new Response(request.method === "HEAD" ? null : html, {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
    if (noindex) response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return secure(response);
  }
  if (path === "/sitemap.xml") {
    if (!indexing) return new Response("Indexing disabled", { status: 404 });
    const locations = Object.keys(pages)
      .filter(
        (p) => p.startsWith("/") && !privatePages.has(p) && !["/inzerat/", "/nahlasit/", "/predajca/"].includes(p),
      )
      .map((p) => url.origin + p);
    for (const c of CATALOG) {
      locations.push(`${url.origin}/${c.slug}/`);
      for (const s of c.subs) locations.push(`${url.origin}/${c.slug}/${s.slug}/`);
    }
    if (env.DB) {
      let last = 0;
      for (;;) {
        const { results } = await env.DB.prepare(
          "SELECT id FROM listings WHERE status='active' AND expires>? AND id>? ORDER BY id LIMIT 1000",
        )
          .bind(Date.now(), last)
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
      new Response(request.method === "HEAD" ? null : fill(pages.__404, env), {
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
