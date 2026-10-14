import { readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
const io = createInterface({ input: process.stdin, output: process.stdout }),
  c = JSON.parse(readFileSync("wrangler.jsonc", "utf8"));
const email = (v) => /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(v);
try {
  const ask = async (label, current, valid) => {
    for (;;) {
      const answer = (await io.question(label + (current ? " [" + current + "]" : "") + ": ")).trim() || current || "";
      if (valid(answer)) return answer;
      console.log("Neplatná hodnota. Skús znova.");
    }
  };
  const currentDb = c.d1_databases[0].database_id === "00000000-0000-0000-0000-000000000000" ? "" : c.d1_databases[0].database_id;
  c.d1_databases[0].database_id = await ask("ID vytvorenej D1 databázy", currentDb, (v) => /^[0-9a-f-]{36}$/i.test(v) && !/^0{8}-/.test(v));
  c.vars.APP_URL = await ask("HTTPS adresa webu bez lomky na konci", c.vars.APP_URL, (v) => {
    try {
      const u = new URL(v);
      return u.protocol === "https:" && u.origin === v;
    } catch {
      return false;
    }
  });
  c.vars.ADMIN_EMAIL = await ask("Email(y) administrátorov, oddelené čiarkou", c.vars.ADMIN_EMAIL, (v) =>
    v.split(",").every((x) => email(x.trim())),
  );
  c.vars.MAIL_FROM = await ask("Odosielateľ, napr. Bazaro <noreply@mail.tvojadomena.sk>", c.vars.MAIL_FROM, (v) => /@/.test(v));
  console.log("\nÚdaje prevádzkovateľa sa zobrazia v kontakte, podmienkach a ochrane údajov.");
  c.vars.OPERATOR_NAME = await ask("Názov firmy alebo meno prevádzkovateľa", c.vars.OPERATOR_NAME, (v) => v.length >= 3);
  c.vars.OPERATOR_ADDRESS = await ask("Sídlo / adresa prevádzkovateľa", c.vars.OPERATOR_ADDRESS, (v) => v.length >= 5);
  c.vars.OPERATOR_ID = await ask("IČO (ak nemáš, nechaj prázdne)", c.vars.OPERATOR_ID, () => true);
  c.vars.CONTACT_EMAIL = await ask("Verejný kontaktný email", c.vars.CONTACT_EMAIL, email);
  writeFileSync("wrangler.jsonc", JSON.stringify(c, null, 2) + "\n");
  console.log("Uložené. RESEND_API_KEY nastav cez: npx wrangler secret put RESEND_API_KEY");
} finally {
  io.close();
}
