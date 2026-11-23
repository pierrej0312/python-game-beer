// Le texte d'une valeur Python reçue du moteur ({ t: type, v: valeur }) : "Café du Pont", [1, 2, …], {"Q1": 3}.
// Partagé par l'usine (bacs, cartons, onglet Bacs). Repris de l'ancien atelier (scene-atelier.js), retiré le 23/11/2026.
const TEXTE_MAX = 13;                        // caractères affichés sur un carton

export function texteValeur(e, court = false) {
  if (!e) return "?";
  let t;
  switch (e.t) {
    case "str": t = `"${e.v}"`; break;
    case "int": case "float": t = String(e.v); break;
    case "bool": t = e.v ? "True" : "False"; break;
    case "None": t = "None"; break;
    case "list": t = `[${e.v.map((x) => texteValeur(x)).join(", ")}${e.n > e.v.length ? ", …" : ""}]`; break;
    case "tuple": t = `(${e.v.map((x) => texteValeur(x)).join(", ")}${e.v.length === 1 ? "," : ""})`; break;
    case "dict": t = `{${e.v.map(([k, v]) => `${texteValeur(k)}: ${texteValeur(v)}`).join(", ")}${e.n > e.v.length ? ", …" : ""}}`; break;
    case "set": t = e.v.length ? `{${e.v.map((x) => texteValeur(x)).join(", ")}}` : "set()"; break;
    default: t = e.r || e.t;
  }
  return court && t.length > TEXTE_MAX ? t.slice(0, TEXTE_MAX - 1) + "…" : t;
}
