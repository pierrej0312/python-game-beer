// Sauvegarde locale de la progression (03-jeu1-missions.md § 8). Le stockage du navigateur peut être
// indisponible ou vidé : toute lecture et toute écriture sont protégées, avec un repli en mémoire.

export const CLE = "jeux-python.progression.v1";
const VIDE = () => ({ pseudo: "", qualite: "haute", sans3d: false, son: true, missions: {} });
let memoire = null;

export function lire() {
  if (memoire) return memoire;
  try {
    const brut = localStorage.getItem(CLE);
    memoire = brut ? { ...VIDE(), ...JSON.parse(brut) } : VIDE();
  } catch (e) { memoire = VIDE(); }
  if (!memoire.missions || typeof memoire.missions !== "object") memoire.missions = {};
  return memoire;
}

export function ecrire() {
  try { localStorage.setItem(CLE, JSON.stringify(lire())); return true; } catch (e) { return false; }
}

export function fiche(id) {
  const p = lire();
  if (!p.missions[id]) p.missions[id] = { etoiles: [false, false, false], essais: 0, echecs: 0, code: null, termineeLe: null };
  return p.missions[id];
}

// Les étoiles obtenues sont conservées : une exécution moins bonne ne les retire pas.
export function noterResultat(id, etoiles, code) {
  const f = fiche(id);
  f.essais += 1;
  if (!etoiles[0]) f.echecs += 1;
  f.etoiles = f.etoiles.map((gagnee, i) => gagnee || Boolean(etoiles[i]));
  if (etoiles[0] && !f.termineeLe) f.termineeLe = new Date().toISOString().slice(0, 19);
  f.code = code;
  ecrire();
  return f;
}

export function sauverCode(id, code) { fiche(id).code = code; ecrire(); }

export function toutEffacer() {
  memoire = VIDE();
  try { localStorage.removeItem(CLE); } catch (e) { /* stockage indisponible */ }
}

export function reglage(nom, valeur) {
  const p = lire();
  if (valeur !== undefined) { p[nom] = valeur; ecrire(); }
  return p[nom];
}
