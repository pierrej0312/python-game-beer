// Le robot 3 apprend par renforcement : il joue des combats, on récompense ce qui fait gagner.
// Méthode : stratégie d'évolution (on essaie des variantes du réseau autour du réseau actuel, chacune joue ses combats,
// et le réseau se déplace vers les variantes qui ont le mieux réussi). Aucun exemple à imiter : seul le résultat compte.
// Le réseau : 19 entrées (apprentissage.js, divisées par ECHELLES), des couches cachées ReLU, une note par action ;
// le robot joue l'action la mieux notée parmi celles qu'il peut payer (comme robot3_modele.py).
import { R } from "./regles.js";
import { combattre, cout } from "./moteur.js";
import { adversaires } from "./robots.js";
import { caracteristiques, ECHELLES } from "./apprentissage.js";

export function hasard(graine) {
  let a = graine >>> 0;
  const suivant = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { suivant, normal: () => { const u = 1 - suivant(), v = suivant(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); } };
}

// Le réseau est rangé à plat dans un tableau de nombres (plus simple à faire varier), avec ses tailles.
export function nouveauReseau(cachees, graine = 2026) {
  const tailles = [ECHELLES.length, ...cachees, R.ACTIONS.length], h = hasard(graine), poids = [];
  for (let l = 1; l < tailles.length; l++) {
    const e = Math.sqrt(2 / tailles[l - 1]);
    for (let j = 0; j < tailles[l]; j++) { for (let i = 0; i < tailles[l - 1]; i++) poids.push(h.normal() * e); poids.push(0); }
  }
  return { tailles, poids: Float64Array.from(poids) };
}

export function notes(reseau, x, poids = reseau.poids) {
  let v = x, k = 0; const t = reseau.tailles;
  for (let l = 1; l < t.length; l++) {
    const s = new Array(t[l]);
    for (let j = 0; j < t[l]; j++) {
      let z = 0; for (let i = 0; i < t[l - 1]; i++) z += poids[k++] * v[i];
      z += poids[k++];
      s[j] = l < t.length - 1 && z < 0 ? 0 : z;
    }
    v = s;
  }
  return v;
}

export function strategieDe(reseau, poids = reseau.poids) {
  return (etat) => {
    const x = caracteristiques(etat).map((v, i) => v / ECHELLES[i]);
    const n = notes(reseau, x, poids);
    let meilleure = -1;
    for (let i = 0; i < n.length; i++) if (cout(R.ACTIONS[i]) <= etat.moi.energie && (meilleure < 0 || n[i] > n[meilleure])) meilleure = i;
    return R.ACTIONS[meilleure];
  };
}

// La récompense d'un robot : 1 par victoire, 0,5 par égalité, plus un peu pour l'écart de vie à la fin (il départage).
export function evaluer(strategie, noms = Object.keys(adversaires())) {
  let score = 0, victoires = 0;
  for (const nom of noms) {
    for (const cote of ["a", "b"]) {
      const adv = adversaires()[nom];
      const r = cote === "a" ? combattre(strategie, adv) : combattre(adv, strategie);
      const f = r.journal.at(-1), moi = cote === "a" ? f.vie_a : f.vie_b, lui = cote === "a" ? f.vie_b : f.vie_a;
      if (r.vainqueur === cote) { score += 1; victoires += 1; } else if (r.vainqueur === "egalite") score += 0.5;
      score += (moi - lui) / 400;
    }
  }
  return { score, victoires, combats: 2 * noms.length };
}

// Une génération : n paires de variantes (+ε et −ε), chacune évaluée ; le réseau avance vers les meilleures.
export function creerEntraineur(reseau, { paires = 12, sigma = 0.08, taux = 0.03, graine = 1 } = {}) {
  const h = hasard(graine), dim = reseau.poids.length;
  const m = new Float64Array(dim), v = new Float64Array(dim);
  let pas = 0;
  return {
    generation() {
      const bruits = [], scores = [];
      for (let p = 0; p < paires; p++) {
        const e = new Float64Array(dim); for (let i = 0; i < dim; i++) e[i] = h.normal();
        for (const s of [1, -1]) {
          const w = new Float64Array(dim); for (let i = 0; i < dim; i++) w[i] = reseau.poids[i] + s * sigma * e[i];
          scores.push(evaluer(strategieDe(reseau, w)).score); bruits.push([e, s]);
        }
      }
      // les rangs plutôt que les scores bruts : la mise à jour ne dépend pas de l'échelle des récompenses
      const ordre = scores.map((s, i) => [s, i]).sort((x, y) => x[0] - y[0]), rang = new Array(scores.length);
      ordre.forEach(([, i], k) => { rang[i] = k / (scores.length - 1) - 0.5; });
      const g = new Float64Array(dim);
      bruits.forEach(([e, s], k) => { for (let i = 0; i < dim; i++) g[i] += rang[k] * s * e[i]; });
      pas++;
      for (let i = 0; i < dim; i++) {                     // Adam, comme dans le labo de la veille
        const gi = g[i] / (bruits.length * sigma);
        m[i] = 0.9 * m[i] + 0.1 * gi; v[i] = 0.999 * v[i] + 0.001 * gi * gi;
        reseau.poids[i] += taux * (m[i] / (1 - 0.9 ** pas)) / (Math.sqrt(v[i] / (1 - 0.999 ** pas)) + 1e-8);
      }
      const r = evaluer(strategieDe(reseau));
      return { generation: pas, ...r, moyenne: scores.reduce((a, b) => a + b, 0) / scores.length };
    },
  };
}

// Le cerveau en texte Python, à coller dans robot3_modele.py (même format : une liste de neurones [poids, biais] par couche).
export function exporterCerveau(reseau, decimales = 3) {
  const t = reseau.tailles, couches = []; let k = 0;
  const r = (x) => { const s = Number(x.toFixed(decimales)); return Object.is(s, -0) || s === 0 ? "0.0" : Number.isInteger(s) ? `${s}.0` : String(s); };
  for (let l = 1; l < t.length; l++) {
    const neurones = [];
    for (let j = 0; j < t[l]; j++) { const p = []; for (let i = 0; i < t[l - 1]; i++) p.push(r(reseau.poids[k++])); neurones.push(`[[${p.join(", ")}], ${r(reseau.poids[k++])}]`); }
    couches.push(`[${neurones.join(", ")}]`);
  }
  return `CERVEAU = {'actions': [${R.ACTIONS.map((a) => `'${a}'`).join(", ")}], 'couches': [${couches.join(", ")}]}`;
}
