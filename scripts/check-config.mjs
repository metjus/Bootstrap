import { readFileSync } from "node:fs";
const c = JSON.parse(readFileSync("wrangler.jsonc", "utf8")),
  v = c.vars || {},
  errors = [];
const email = (x) => /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(x);
if (!c.d1_databases?.[0]?.database_id || /^0{8}-/.test(c.d1_databases[0].database_id))
  errors.push("Chýba ID D1 databázy.");
if (!/^https:\/\/[^/]+$/.test(v.APP_URL || ""))
  errors.push("APP_URL musí byť skutočná HTTPS adresa bez lomky na konci.");
if (
  !String(v.ADMIN_EMAIL || "")
    .split(",")
    .every((x) => email(x.trim()))
)
  errors.push("Chýba email administrátora.");
if (!v.MAIL_FROM) errors.push("Chýba odosielateľ MAIL_FROM na overenej doméne.");
if (!v.OPERATOR_NAME || !v.OPERATOR_ADDRESS)
  errors.push("Chýba názov a adresa prevádzkovateľa (OPERATOR_NAME, OPERATOR_ADDRESS).");
if (!email(v.CONTACT_EMAIL || "")) errors.push("Chýba verejný kontaktný email CONTACT_EMAIL.");
if (errors.length) {
  console.error(errors.join("\n") + "\nSpusť: npm run configure");
  process.exitCode = 1;
} else
  console.log("Konfigurácia je vyplnená. Nezabudni na secret RESEND_API_KEY (npx wrangler secret put RESEND_API_KEY).");
