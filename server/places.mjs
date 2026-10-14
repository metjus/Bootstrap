// Built-in towns used for the location hint list and the approximate distance filter.
// Coordinates are town centres; distances are therefore orientational.
const raw = {
  sk: [
    ["Bratislava", 48.1486, 17.1077, "81101"],
    ["Košice", 48.7164, 21.2611, "04001"],
    ["Prešov", 49.0018, 21.2393, "08001"],
    ["Žilina", 49.2232, 18.7394, "01001"],
    ["Nitra", 48.3061, 18.0764, "94901"],
    ["Banská Bystrica", 48.7363, 19.1462, "97401"],
    ["Trnava", 48.3774, 17.5872, "91701"],
    ["Trenčín", 48.8945, 18.0444, "91101"],
    ["Martin", 49.0665, 18.9216, "03601"],
    ["Poprad", 49.0597, 20.2975, "05801"],
    ["Prievidza", 48.7745, 18.6275, "97101"],
    ["Zvolen", 48.5762, 19.1371, "96001"],
    ["Považská Bystrica", 49.1214, 18.4206, "01701"],
    ["Michalovce", 48.7543, 21.9195, "07101"],
    ["Nové Zámky", 47.9859, 18.1617, "94001"],
    ["Spišská Nová Ves", 48.9446, 20.5615, "05201"],
    ["Komárno", 47.7631, 18.129, "94501"],
    ["Humenné", 48.9371, 21.9063, "06601"],
    ["Levice", 48.2153, 18.6073, "93401"],
    ["Bardejov", 49.2918, 21.2727, "08501"],
    ["Liptovský Mikuláš", 49.0833, 19.6119, "03101"],
    ["Lučenec", 48.3299, 19.6668, "98401"],
    ["Piešťany", 48.5918, 17.8273, "92101"],
    ["Ružomberok", 49.0748, 19.3038, "03401"],
    ["Topoľčany", 48.5617, 18.1752, "95501"],
    ["Trebišov", 48.6286, 21.7182, "07501"],
    ["Čadca", 49.438, 18.7899, "02201"],
    ["Dubnica nad Váhom", 48.959, 18.1689, "01841"],
    ["Rimavská Sobota", 48.383, 20.0222, "97901"],
    ["Partizánske", 48.6271, 18.3778, "95801"],
    ["Šaľa", 48.1515, 17.877, "92701"],
    ["Dunajská Streda", 47.9926, 17.6191, "92901"],
    ["Vranov nad Topľou", 48.8888, 21.6852, "09301"],
    ["Brezno", 48.8062, 19.638, "97701"],
    ["Senica", 48.679, 17.3662, "90501"],
    ["Snina", 48.9881, 22.1563, "06901"],
    ["Rožňava", 48.6604, 20.5321, "04801"],
    ["Nové Mesto nad Váhom", 48.7572, 17.8317, "91501"],
    ["Pezinok", 48.2894, 17.2665, "90201"],
    ["Malacky", 48.4361, 17.0184, "90101"],
    ["Senec", 48.2199, 17.4003, "90301"],
    ["Skalica", 48.8449, 17.2266, "90901"],
    ["Galanta", 48.1902, 17.7268, "92401"],
    ["Hlohovec", 48.4253, 17.803, "92001"],
    ["Kežmarok", 49.136, 20.4321, "06001"],
    ["Stará Ľubovňa", 49.2986, 20.6862, "06401"],
    ["Žiar nad Hronom", 48.5916, 18.853, "96501"],
    ["Dolný Kubín", 49.2096, 19.2965, "02601"],
    ["Zlaté Moravce", 48.3854, 18.4005, "95301"],
    ["Svidník", 49.3056, 21.5703, "08901"],
    ["Sereď", 48.2863, 17.7334, "92601"],
    ["Detva", 48.5601, 19.4209, "96212"],
  ],
  cz: [
    ["Praha", 50.0755, 14.4378, "11000"],
    ["Brno", 49.1951, 16.6068, "60200"],
    ["Ostrava", 49.8209, 18.2625, "70200"],
    ["Plzeň", 49.7384, 13.3736, "30100"],
    ["Liberec", 50.7671, 15.0562, "46001"],
    ["Olomouc", 49.5938, 17.2509, "77900"],
    ["České Budějovice", 48.9745, 14.4743, "37001"],
    ["Hradec Králové", 50.2104, 15.8327, "50002"],
    ["Ústí nad Labem", 50.6607, 14.0323, "40001"],
    ["Pardubice", 50.0343, 15.7812, "53002"],
    ["Zlín", 49.2265, 17.6707, "76001"],
    ["Havířov", 49.7798, 18.4369, "73601"],
    ["Kladno", 50.1473, 14.1029, "27201"],
    ["Most", 50.503, 13.6362, "43401"],
    ["Opava", 49.9387, 17.9026, "74601"],
    ["Frýdek-Místek", 49.6882, 18.3536, "73801"],
    ["Karviná", 49.854, 18.5417, "73301"],
    ["Jihlava", 49.3961, 15.5912, "58601"],
    ["Teplice", 50.6404, 13.8245, "41501"],
    ["Děčín", 50.7822, 14.2148, "40502"],
    ["Karlovy Vary", 50.231, 12.8712, "36001"],
    ["Chomutov", 50.4605, 13.4178, "43001"],
    ["Jablonec nad Nisou", 50.7243, 15.1711, "46601"],
    ["Mladá Boleslav", 50.4113, 14.9032, "29301"],
    ["Prostějov", 49.4719, 17.1118, "79601"],
    ["Přerov", 49.4552, 17.451, "75002"],
    ["Česká Lípa", 50.6856, 14.5377, "47001"],
    ["Třebíč", 49.2149, 15.8817, "67401"],
    ["Třinec", 49.6776, 18.6708, "73961"],
    ["Tábor", 49.4144, 14.6578, "39002"],
    ["Znojmo", 48.8555, 16.0488, "66902"],
    ["Kolín", 50.0281, 15.2006, "28002"],
    ["Příbram", 49.6899, 14.0104, "26101"],
    ["Cheb", 50.0796, 12.3739, "35002"],
    ["Písek", 49.3088, 14.1475, "39701"],
    ["Trutnov", 50.561, 15.9127, "54101"],
    ["Kroměříž", 49.2979, 17.3931, "76701"],
    ["Vsetín", 49.3387, 17.9962, "75501"],
    ["Šumperk", 49.9653, 16.9706, "78701"],
    ["Uherské Hradiště", 49.0698, 17.4597, "68601"],
    ["Břeclav", 48.759, 16.882, "69002"],
    ["Hodonín", 48.8489, 17.1324, "69501"],
    ["Český Těšín", 49.7461, 18.6261, "73701"],
    ["Litoměřice", 50.5335, 14.1318, "41201"],
    ["Havlíčkův Brod", 49.6079, 15.5807, "58001"],
    ["Nový Jičín", 49.5944, 18.0103, "74101"],
    ["Chrudim", 49.9511, 15.7956, "53701"],
    ["Krnov", 50.0897, 17.7039, "79401"],
    ["Kutná Hora", 49.9484, 15.2682, "28401"],
    ["Vyškov", 49.2775, 16.999, "68201"],
    ["Beroun", 49.9638, 14.072, "26601"],
    ["Blansko", 49.3631, 16.6445, "67801"],
  ],
};

export const PLACES = Object.fromEntries(
  Object.entries(raw).map(([country, rows]) => [
    country,
    rows.map(([name, lat, lon, zip]) => ({ name, lat, lon, zip })),
  ]),
);

// Lower-case, diacritics-free, single-spaced form used for search and city matching.
export const fold = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

export function resolvePlace(country, value) {
  const key = fold(value),
    zip = String(value ?? "").replace(/\s/g, "");
  return (PLACES[country] || []).find((p) => fold(p.name) === key || p.zip === zip) || null;
}

export function distanceKm(a, b) {
  const r = Math.PI / 180,
    dLat = (b.lat - a.lat) * r,
    dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function placesWithin(country, origin, km) {
  return (PLACES[country] || []).filter((p) => distanceKm(origin, p) <= km);
}
