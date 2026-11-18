// Vérifie les 6 niveaux du jeu 2 : chaque solution de référence est valide, son Python obtient les 3 étoiles,
// le plateau de départ ne les obtient pas, et chaque variante fausse échoue comme prévu.
// Usage : node outils-construction/verifier_niveaux.mjs [chemin de python 3.14]
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Plateau } from "../site/js/ligne/modele.js";
import { generer } from "../site/js/ligne/generateur.js";
import { etoiles } from "../site/js/ligne/etoiles.js";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PYTHON = process.argv[2] || "python3";
const PILOTE = path.join(RACINE, "outils-construction", "_executer_ligne.py");
writeFileSync(PILOTE, `import json, sys
sys.path.insert(0, ${JSON.stringify(path.join(RACINE, "site", "python"))})
import ligne
d = json.load(sys.stdin)
print(json.dumps(ligne.executer_ligne(d["code"], d["niveau"], d["tests"], d["suivre"]), ensure_ascii=False))
`);

function executer(niveau, tests, plateau) {
  const tous = plateau.valider(), problemes = tous.filter((p) => p.bloquant);
  if (problemes.length) return { problemes, avertissements: tous };
  const g = generer(plateau);
  const sortie = execFileSync(PYTHON, ["-I", PILOTE], { input: JSON.stringify({ code: g.code, niveau, tests, suivre: g.suivre }), encoding: "utf-8" });
  const r = JSON.parse(sortie);
  return { g, r, e: etoiles(niveau, plateau, r) };
}

function appliquer(base, v) {
  const g = structuredClone(base);
  if (v.retirer) { g.pieces = g.pieces.filter((p) => !v.retirer.includes(p.id)); g.tapis = g.tapis.filter((t) => !v.retirer.includes(t.de) && !v.retirer.includes(t.vers)); }
  if (v.retirerTapis) g.tapis = g.tapis.filter((t) => !v.retirerTapis.includes(t.id));
  if (v.pieces) g.pieces.push(...structuredClone(v.pieces));
  if (v.tapis) g.tapis.push(...structuredClone(v.tapis));
  if (v.regler) for (const [id, p] of Object.entries(v.regler)) Object.assign(g.pieces.find((x) => x.id === id).params, p);
  if (v.inverser) { const [a, b] = v.inverser.map((id) => g.pieces.find((x) => x.id === id)); [a.type, b.type] = [b.type, a.type]; [a.params, b.params] = [b.params, a.params]; }
  if (v.machine) g.machine = structuredClone(v.machine);
  return g;
}

const dossier = path.join(RACINE, "site", "ligne", "niveaux");
let echecs = 0;
for (const id of readdirSync(dossier).filter((n) => n.startsWith("ligne-")).sort()) {
  const niveau = JSON.parse(readFileSync(path.join(dossier, id, "niveau.json"), "utf-8"));
  const tests = readFileSync(path.join(dossier, id, "tests.py"), "utf-8");
  const { solution, variantes } = JSON.parse(readFileSync(path.join(RACINE, "solutions-ligne", id + ".json"), "utf-8"));
  const ko = (m) => { echecs++; console.log("ÉCHEC", id, m); };
  // solution
  const plateauSolution = new Plateau(niveau, solution);
  const remarques = plateauSolution.valider();
  if (remarques.length) ko("la solution a des remarques : " + remarques.map((p) => p.message).join(" | "));
  const s = executer(niveau, tests, plateauSolution);
  if (s.problemes) ko("solution refusée : " + s.problemes.map((p) => p.message).join(" | "));
  else if (s.r.erreur || s.e.join() !== "true,true,true") ko(`solution : étoiles ${s.e} ${s.r.erreur ? s.r.erreur.messageOriginal : ""} ${JSON.stringify(s.r.tests.filter((t) => !t.ok))}`);
  // départ
  const d = executer(niveau, tests, new Plateau(niveau));
  if (!d.problemes && d.e[0]) ko("le plateau de départ obtient déjà l'étoile 1");
  // variantes
  const resume = [];
  for (const v of variantes) {
    const r = executer(niveau, tests, new Plateau(niveau, appliquer(solution, v)));
    if (r.problemes) { ko(`variante « ${v.nom} » refusée : ${r.problemes.map((p) => p.message).join(" | ")}`); continue; }
    if (v.attendu.erreur) { if (!r.r.erreur) ko(`variante « ${v.nom} » : une erreur était attendue`); else resume.push(`${v.nom} -> ${r.r.erreur.messageOriginal}`); continue; }
    const ok = v.attendu.etoiles.every((a, i) => a === null || a === r.e[i]);
    if (!ok) ko(`variante « ${v.nom} » : étoiles ${r.e}, attendu ${v.attendu.etoiles}`);
    else resume.push(`${v.nom} -> ${r.e.map((x) => (x ? 1 : 0)).join("")} ${r.r.tests.filter((t) => !t.ok).map((t) => t.message).join(" / ").slice(0, 140)}`);
  }
  if (!s.problemes) console.log(`ok  ${id}  ${s.e.map((x) => (x ? 1 : 0)).join("")}  ${s.r.trace.length} lignes suivies  départ : ${d.problemes ? d.problemes.length + " problème(s)" : "étoiles " + d.e}`);
  for (const l of resume) console.log("      variante", l);
  if (process.argv.includes("--code")) console.log(s.g.code);
}
console.log(echecs ? `${echecs} échec(s)` : "6 niveaux vérifiés, 0 échec");
process.exit(echecs ? 1 : 0);
