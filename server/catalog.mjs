// Category tree shared by the API and the browser (build writes it to /catalog.js).
// Slugs are part of public URLs (/auto/osobne-auta/), so never rename an existing slug.
const tree = [
  [
    "auto",
    "Auto",
    "Osobné autá|Úžitkové a nákladné|Náhradné diely|Pneumatiky a disky|Autoelektronika|Príslušenstvo|Ostatné",
  ],
  ["moto", "Motocykle", "Motocykle|Skútre|Štvorkolky|Náhradné diely|Prilby a oblečenie|Ostatné"],
  ["reality", "Reality", "Byty|Domy|Pozemky|Chaty a chalupy|Garáže|Komerčné priestory|Prenájom|Ostatné"],
  [
    "nabytok",
    "Nábytok",
    "Sedačky a kreslá|Postele a matrace|Skrine a komody|Stoly a stoličky|Kuchynské linky|Kancelársky nábytok|Ostatné",
  ],
  ["dom", "Dom a záhrada", "Záhrada|Náradie|Stavebný materiál|Kúrenie a klíma|Dekorácie|Domáce potreby|Ostatné"],
  ["elektro", "Elektro", "TV a audio|Veľké spotrebiče|Kuchynské spotrebiče|Malé spotrebiče|Hry a konzoly|Ostatné"],
  ["pc", "Počítače", "Notebooky|Stolové počítače|Monitory|Komponenty|Tablety|Tlačiarne|Príslušenstvo|Ostatné"],
  ["mobily", "Mobily", "Apple|Samsung|Xiaomi|Ostatné značky|Smart hodinky|Príslušenstvo"],
  ["foto", "Foto", "Fotoaparáty|Objektívy|Kamery a drony|Príslušenstvo|Ostatné"],
  ["deti", "Deti", "Kočíky|Autosedačky|Oblečenie a obuv|Hračky|Detský nábytok|Ostatné"],
  ["oblecenie", "Oblečenie", "Dámske|Pánske|Obuv|Doplnky|Hodinky a šperky|Ostatné"],
  [
    "sport",
    "Šport",
    "Bicykle|Fitness|Zimné športy|Kolieskové športy|Turistika a kemping|Loptové hry|Vodné športy|Ostatné",
  ],
  ["hudba", "Hudba", "Gitary|Klávesy|Bicie|Zvuková technika|Platne a CD|Ostatné"],
  ["knihy", "Knihy", "Beletria|Odborné|Detské|Učebnice|Komiksy|Ostatné"],
  ["zvierata", "Zvieratá", "Psy|Mačky|Hlodavce|Vtáky|Akvaristika|Hospodárske zvieratá|Potreby pre zvieratá|Ostatné"],
  ["stroje", "Stroje", "Poľnohospodárske|Stavebné|Dielenské|Ostatné"],
  ["vstupenky", "Vstupenky", "Koncerty|Šport|Divadlo|Ostatné"],
  ["sluzby", "Služby", "Remeslá|Opravy|Sťahovanie a doprava|Doučovanie|Upratovanie|Ostatné"],
  ["ostatne", "Ostatné", "Zberateľstvo|Starožitnosti|Kozmetika|Darujem|Ostatné"],
];
export const slugify = (s) =>
  String(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
export const CATALOG = tree.map(([slug, name, subs]) => ({
  slug,
  name,
  subs: subs.split("|").map((n) => ({ slug: slugify(n), name: n })),
}));
export const category = (slug) => CATALOG.find((c) => c.slug === slug) || null;
export const subcategory = (cat, slug) => category(cat)?.subs.find((s) => s.slug === slug) || null;
// Names used by the first release, mapped for migrated data.
export const LEGACY_CATEGORIES = {
  Elektronika: "elektro",
  Mobily: "mobily",
  Počítače: "pc",
  "Auto-moto": "auto",
  Bývanie: "nabytok",
  Nehnuteľnosti: "reality",
  Šport: "sport",
  Oblečenie: "oblecenie",
  Deti: "deti",
  Zvieratá: "zvierata",
  Záhrada: "dom",
  Stroje: "stroje",
  Hudba: "hudba",
  Knihy: "knihy",
  Služby: "sluzby",
  Ostatné: "ostatne",
};
export const PRICE_TYPES = ["fixed", "free", "negotiable", "text"];
