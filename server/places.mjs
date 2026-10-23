// Locations for Slovakia: every district town plus other larger towns serve as reference points.
// A listing's PSČ is resolved to coordinates in this order:
//   1. exact PSČ from the optional GeoNames dataset (server/postal-data.mjs, `npm run postal`),
//   2. the reference town for the PSČ's first three digits (postal district),
//   3. a town matching the entered municipality name.
// Distances are therefore approximate (typically within ~10 km), which suits a radius filter.
import { POSTAL } from "./postal-data.mjs";

const towns = [
  ["Bratislava", 48.1486, 17.1077, "81101"],
  ["Malacky", 48.4361, 17.0184, "90101"],
  ["Pezinok", 48.2894, 17.2665, "90201"],
  ["Senec", 48.2199, 17.4003, "90301"],
  ["Stupava", 48.2741, 17.0318, "90031"],
  ["Modra", 48.3336, 17.3069, "90001"],
  ["Šamorín", 48.0267, 17.3097, "93101"],
  ["Dunajská Streda", 47.9926, 17.6191, "92901"],
  ["Veľký Meder", 47.8569, 17.77, "93201"],
  ["Galanta", 48.1902, 17.7268, "92401"],
  ["Sereď", 48.2863, 17.7334, "92601"],
  ["Šaľa", 48.1515, 17.877, "92701"],
  ["Hlohovec", 48.4253, 17.803, "92001"],
  ["Piešťany", 48.5918, 17.8273, "92101"],
  ["Trnava", 48.3774, 17.5872, "91701"],
  ["Senica", 48.679, 17.3662, "90501"],
  ["Skalica", 48.8449, 17.2266, "90901"],
  ["Holíč", 48.8111, 17.1625, "90801"],
  ["Myjava", 48.7555, 17.5683, "90701"],
  ["Trenčín", 48.8945, 18.0444, "91101"],
  ["Nové Mesto nad Váhom", 48.7572, 17.8317, "91501"],
  ["Bánovce nad Bebravou", 48.7186, 18.2581, "95701"],
  ["Partizánske", 48.6271, 18.3778, "95801"],
  ["Ilava", 48.9977, 18.2347, "01901"],
  ["Dubnica nad Váhom", 48.959, 18.1689, "01841"],
  ["Púchov", 49.124, 18.3262, "02001"],
  ["Považská Bystrica", 49.1214, 18.4206, "01701"],
  ["Prievidza", 48.7745, 18.6275, "97101"],
  ["Handlová", 48.7275, 18.76, "97251"],
  ["Nitra", 48.3061, 18.0764, "94901"],
  ["Vráble", 48.2436, 18.3083, "95201"],
  ["Zlaté Moravce", 48.3854, 18.4005, "95301"],
  ["Topoľčany", 48.5617, 18.1752, "95501"],
  ["Nové Zámky", 47.9859, 18.1617, "94001"],
  ["Šurany", 48.0864, 18.1856, "94201"],
  ["Štúrovo", 47.7986, 18.7172, "94301"],
  ["Komárno", 47.7631, 18.129, "94501"],
  ["Hurbanovo", 47.8711, 18.1947, "94701"],
  ["Kolárovo", 47.9214, 17.9989, "94603"],
  ["Levice", 48.2153, 18.6073, "93401"],
  ["Šahy", 48.0717, 18.9489, "93601"],
  ["Želiezovce", 47.9483, 18.6556, "93701"],
  ["Žilina", 49.2232, 18.7394, "01001"],
  ["Rajec", 49.0886, 18.6342, "01501"],
  ["Bytča", 49.2236, 18.5583, "01401"],
  ["Kysucké Nové Mesto", 49.3, 18.7856, "02401"],
  ["Čadca", 49.438, 18.7899, "02201"],
  ["Turzovka", 49.4044, 18.6253, "02354"],
  ["Martin", 49.0665, 18.9216, "03601"],
  ["Vrútky", 49.1131, 18.9192, "03861"],
  ["Turčianske Teplice", 48.8622, 18.8622, "03901"],
  ["Ružomberok", 49.0748, 19.3038, "03401"],
  ["Liptovský Mikuláš", 49.0833, 19.6119, "03101"],
  ["Liptovský Hrádok", 49.0397, 19.7239, "03301"],
  ["Dolný Kubín", 49.2096, 19.2965, "02601"],
  ["Námestovo", 49.4078, 19.4803, "02901"],
  ["Tvrdošín", 49.337, 19.556, "02744"],
  ["Trstená", 49.3611, 19.6119, "02801"],
  ["Banská Bystrica", 48.7363, 19.1462, "97401"],
  ["Brezno", 48.8062, 19.638, "97701"],
  ["Zvolen", 48.5762, 19.1371, "96001"],
  ["Detva", 48.5601, 19.4209, "96212"],
  ["Hriňová", 48.5775, 19.5267, "96205"],
  ["Krupina", 48.3553, 19.0669, "96301"],
  ["Žiar nad Hronom", 48.5916, 18.853, "96501"],
  ["Kremnica", 48.7056, 18.9183, "96701"],
  ["Žarnovica", 48.4842, 18.7203, "96681"],
  ["Nová Baňa", 48.4247, 18.6397, "96801"],
  ["Banská Štiavnica", 48.4586, 18.8931, "96901"],
  ["Lučenec", 48.3299, 19.6668, "98401"],
  ["Fiľakovo", 48.2689, 19.825, "98601"],
  ["Poltár", 48.4306, 19.7944, "98701"],
  ["Veľký Krtíš", 48.2106, 19.3494, "99001"],
  ["Rimavská Sobota", 48.383, 20.0222, "97901"],
  ["Hnúšťa", 48.5803, 19.9528, "98101"],
  ["Tornaľa", 48.4167, 20.3333, "98201"],
  ["Revúca", 48.6833, 20.1167, "05001"],
  ["Rožňava", 48.6604, 20.5321, "04801"],
  ["Košice", 48.7164, 21.2611, "04001"],
  ["Moldava nad Bodvou", 48.6142, 21.0003, "04501"],
  ["Gelnica", 48.8553, 20.9369, "05601"],
  ["Spišská Nová Ves", 48.9446, 20.5615, "05201"],
  ["Levoča", 49.0256, 20.5883, "05401"],
  ["Poprad", 49.0597, 20.2975, "05801"],
  ["Svit", 49.0603, 20.205, "05921"],
  ["Vysoké Tatry", 49.1394, 20.2208, "06201"],
  ["Kežmarok", 49.136, 20.4321, "06001"],
  ["Stará Ľubovňa", 49.2986, 20.6862, "06401"],
  ["Prešov", 49.0018, 21.2393, "08001"],
  ["Sabinov", 49.1031, 21.0981, "08301"],
  ["Lipany", 49.1544, 20.9608, "08271"],
  ["Bardejov", 49.2918, 21.2727, "08501"],
  ["Giraltovce", 49.1139, 21.5167, "08701"],
  ["Svidník", 49.3056, 21.5703, "08901"],
  ["Stropkov", 49.2014, 21.6517, "09101"],
  ["Vranov nad Topľou", 48.8888, 21.6852, "09301"],
  ["Humenné", 48.9371, 21.9063, "06601"],
  ["Medzilaborce", 49.2719, 21.9036, "06801"],
  ["Snina", 48.9881, 22.1563, "06901"],
  ["Michalovce", 48.7543, 21.9195, "07101"],
  ["Strážske", 48.8728, 21.8381, "07222"],
  ["Sobrance", 48.7447, 22.1811, "07301"],
  ["Veľké Kapušany", 48.55, 22.0833, "07901"],
  ["Trebišov", 48.6286, 21.7182, "07501"],
  ["Kráľovský Chlmec", 48.4239, 21.98, "07701"],
];
// First three digits of a PSČ (postal district) -> nearest reference town.
const prefixes = {
  Bratislava: "800-859,900",
  Malacky: "901",
  Pezinok: "902",
  Senec: "903",
  Senica: "905-906",
  Myjava: "907",
  Holíč: "908",
  Skalica: "909",
  Trenčín: "911-914",
  "Nové Mesto nad Váhom": "915-916",
  Trnava: "917-919",
  Hlohovec: "920",
  Piešťany: "921-923",
  Galanta: "924-925",
  Sereď: "926",
  Šaľa: "927",
  "Dunajská Streda": "929-930",
  Šamorín: "931",
  "Veľký Meder": "932",
  Levice: "934-935",
  Šahy: "936",
  Želiezovce: "937",
  "Nové Zámky": "940-941",
  Šurany: "942",
  Štúrovo: "943",
  Komárno: "945-946",
  Hurbanovo: "947",
  Nitra: "949-951",
  Vráble: "952",
  "Zlaté Moravce": "953",
  Topoľčany: "955-956",
  "Bánovce nad Bebravou": "957",
  Partizánske: "958",
  Zvolen: "960-961",
  Detva: "962",
  Krupina: "963",
  "Žiar nad Hronom": "965-966",
  Kremnica: "967",
  "Nová Baňa": "968",
  "Banská Štiavnica": "969",
  Prievidza: "971-972",
  "Banská Bystrica": "974-976",
  Brezno: "977",
  "Rimavská Sobota": "979-980",
  Hnúšťa: "981",
  Tornaľa: "982",
  Lučenec: "984-985",
  Fiľakovo: "986",
  Poltár: "987",
  "Veľký Krtíš": "990-992",
  Žilina: "010-013",
  Bytča: "014",
  Rajec: "015",
  "Považská Bystrica": "017",
  "Dubnica nad Váhom": "018",
  Ilava: "019",
  Púchov: "020",
  Čadca: "022-023",
  "Kysucké Nové Mesto": "024",
  "Dolný Kubín": "026",
  Tvrdošín: "027",
  Trstená: "028",
  Námestovo: "029",
  "Liptovský Mikuláš": "031-032",
  "Liptovský Hrádok": "033",
  Ružomberok: "034",
  Martin: "036-038",
  "Turčianske Teplice": "039",
  Košice: "040-044",
  "Moldava nad Bodvou": "045",
  Rožňava: "048-049",
  Revúca: "050",
  "Spišská Nová Ves": "052-053",
  Levoča: "054",
  Gelnica: "055-056",
  Poprad: "058-059",
  Kežmarok: "060-061",
  "Vysoké Tatry": "062",
  "Stará Ľubovňa": "064-065",
  Humenné: "066-067",
  Medzilaborce: "068",
  Snina: "069",
  Michalovce: "071-072",
  Sobrance: "073",
  Trebišov: "075-076",
  "Kráľovský Chlmec": "077",
  "Veľké Kapušany": "079",
  Prešov: "080-082",
  Sabinov: "083",
  Bardejov: "085-086",
  Giraltovce: "087",
  Svidník: "089-090",
  Stropkov: "091",
  "Vranov nad Topľou": "093-094",
};
export const PLACES = towns.map(([name, lat, lon, zip]) => ({ name, lat, lon, zip }));
const byName = new Map(PLACES.map((p) => [p.name, p]));
const byPrefix = new Map();
for (const [name, range] of Object.entries(prefixes)) {
  for (const part of range.split(",")) {
    const [from, to = from] = part.split("-").map(Number);
    for (let n = from; n <= to; n++) byPrefix.set(String(n).padStart(3, "0"), byName.get(name));
  }
}

// Lower-case, diacritics-free, single-spaced form used for search and town matching.
export const fold = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
export const normalizeZip = (v) => {
  const digits = String(v ?? "").replace(/\s/g, "");
  return /^\d{5}$/.test(digits) ? digits : "";
};
export const formatZip = (zip) => (zip ? zip.slice(0, 3) + " " + zip.slice(3) : "");
const townByName = (value) => {
  const key = fold(value);
  return key ? PLACES.find((p) => fold(p.name) === key) || null : null;
};

// Resolves a PSČ and/or municipality to { lat, lon, area } or null.
export function locate(zip, city = "") {
  const z = normalizeZip(zip);
  if (z && POSTAL[z]) return { lat: POSTAL[z][0], lon: POSTAL[z][1], area: POSTAL[z][2] || city, exact: true };
  const town = townByName(city) || (z && PLACES.find((p) => p.zip === z));
  if (town) return { lat: town.lat, lon: town.lon, area: town.name };
  const ref = z && byPrefix.get(z.slice(0, 3));
  if (ref) return { lat: ref.lat, lon: ref.lon, area: ref.name };
  return null;
}
// Search origin from free text: a PSČ ("917 01") or a town name.
export function resolveOrigin(value) {
  const z = normalizeZip(value);
  return z ? locate(z) : townByName(value) ? locate("", value) : null;
}
export function distanceKm(a, b) {
  const r = Math.PI / 180,
    dLat = (b.lat - a.lat) * r,
    dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
// SQL-friendly bounds: an equirectangular circle needs only arithmetic in SQLite.
export function radiusBounds(origin, km) {
  const dLat = km / 111.2,
    k = Math.cos((origin.lat * Math.PI) / 180);
  return { lat: origin.lat, lon: origin.lon, dLat, dLon: dLat / k, k2: k * k, r2: dLat * dLat };
}
