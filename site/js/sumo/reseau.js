// Un petit réseau de neurones (perceptron multicouche) écrit à la main, pour le labo des neurones.
// Couches cachées : ReLU. Deux sorties possibles : « classes » (softmax sur les actions, erreur : entropie croisée ; mode Sumo)
// ou « nombre » (un neurone sans activation, erreur : carré de l'écart ; mode Ventes). Optimiseur : Adam.
// Le cerveau exporté se rejoue en Python pur (modèle de la génération 3) : même calcul, couche par couche.
// Aucun accès à la page ici : ce module se teste aussi avec Node.

// Hasard reproductible : la même graine donne le même réseau et le même entraînement.
export function hasard(graine = 2026) {
  let a = graine >>> 0;
  const suivant = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const normal = () => { const u = 1 - suivant(), v = suivant(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  return { suivant, normal };
}

// tailles : [entrées, cachées..., sorties]. couches[l] = [{ poids: [...], biais }, ...] (un objet par neurone).
export function creerReseau(tailles, graine = 2026, sortie = "classes") {
  const h = hasard(graine);
  const couches = [];
  for (let l = 1; l < tailles.length; l++) {
    const nIn = tailles[l - 1], echelle = Math.sqrt(2 / nIn);
    couches.push(Array.from({ length: tailles[l] }, () => ({ poids: Array.from({ length: nIn }, () => h.normal() * echelle), biais: 0 })));
  }
  return { tailles: [...tailles], couches, adam: null, pas: 0, sortie };
}

// Le calcul : renvoie les activations de chaque couche (la dernière : les probabilités des actions).
export function propager(reseau, x) {
  const activations = [x];
  let v = x;
  reseau.couches.forEach((couche, l) => {
    const z = couche.map((n) => n.poids.reduce((s, p, i) => s + p * v[i], n.biais));
    if (l < reseau.couches.length - 1) v = z.map((s) => (s > 0 ? s : 0));
    else if (reseau.sortie === "nombre") v = z;
    else { const m = Math.max(...z), e = z.map((s) => Math.exp(s - m)), t = e.reduce((a, b) => a + b, 0); v = e.map((s) => s / t); }
    activations.push(v);
  });
  return activations;
}
export const predire = (reseau, x) => { const p = propager(reseau, x).at(-1); return p.indexOf(Math.max(...p)); };
export const predireNombre = (reseau, x) => propager(reseau, x).at(-1)[0];
// l'erreur d'une ligne, et ce qu'elle renvoie à la dernière couche (le gradient de l'erreur)
function perte(reseau, sortie, y) {
  if (reseau.sortie === "nombre") { const e = sortie[0] - y; return { erreur: 0.5 * e * e, delta: [e] }; }
  return { erreur: -Math.log(Math.max(1e-12, sortie[y])), delta: sortie.map((p, k) => p - (k === y ? 1 : 0)) };   // softmax + entropie croisée
}

// Une passe sur les données (une époque), par petits paquets. donnees : [{ x, y, poids }] ; poids = nombre de fois que la ligne apparaît.
export function epoque(reseau, donnees, { taux = 0.01, paquet = 64, graine = 1 } = {}) {
  const h = hasard(graine + reseau.pas);
  const ordre = donnees.map((_, i) => i);
  for (let i = ordre.length - 1; i > 0; i--) { const j = Math.floor(h.suivant() * (i + 1)); [ordre[i], ordre[j]] = [ordre[j], ordre[i]]; }
  if (!reseau.adam) reseau.adam = reseau.couches.map((c) => c.map((n) => ({ mp: n.poids.map(() => 0), vp: n.poids.map(() => 0), mb: 0, vb: 0 })));
  let erreur = 0, total = 0;
  for (let debut = 0; debut < ordre.length; debut += paquet) {
    const lot = ordre.slice(debut, debut + paquet).map((i) => donnees[i]);
    const somme = lot.reduce((s, d) => s + d.poids, 0);
    const grad = reseau.couches.map((c) => c.map((n) => ({ p: n.poids.map(() => 0), b: 0 })));
    for (const d of lot) {
      const acts = propager(reseau, d.x), w = d.poids / somme;
      const pe = perte(reseau, acts.at(-1), d.y);
      erreur += d.poids * pe.erreur; total += d.poids;
      let delta = pe.delta.map((v) => v * w);
      for (let l = reseau.couches.length - 1; l >= 0; l--) {
        const entree = acts[l], couche = reseau.couches[l];
        couche.forEach((n, k) => { grad[l][k].b += delta[k]; for (let i = 0; i < entree.length; i++) grad[l][k].p[i] += delta[k] * entree[i]; });
        if (l > 0) delta = entree.map((a, i) => (a > 0 ? couche.reduce((s, n, k) => s + n.poids[i] * delta[k], 0) : 0));
      }
    }
    // Adam
    reseau.pas++;
    const b1 = 0.9, b2 = 0.999, eps = 1e-8, c1 = 1 - b1 ** reseau.pas, c2 = 1 - b2 ** reseau.pas;
    reseau.couches.forEach((couche, l) => couche.forEach((n, k) => {
      const a = reseau.adam[l][k], g = grad[l][k];
      for (let i = 0; i < n.poids.length; i++) {
        a.mp[i] = b1 * a.mp[i] + (1 - b1) * g.p[i]; a.vp[i] = b2 * a.vp[i] + (1 - b2) * g.p[i] ** 2;
        n.poids[i] -= taux * (a.mp[i] / c1) / (Math.sqrt(a.vp[i] / c2) + eps);
      }
      a.mb = b1 * a.mb + (1 - b1) * g.b; a.vb = b2 * a.vb + (1 - b2) * g.b ** 2;
      n.biais -= taux * (a.mb / c1) / (Math.sqrt(a.vb / c2) + eps);
    }));
  }
  return erreur / total;
}

// Part des bonnes réponses (pondérée par le nombre de fois que chaque ligne apparaît).
export function exactitude(reseau, donnees) {
  let bon = 0, total = 0;
  for (const d of donnees) { total += d.poids; if (predire(reseau, d.x) === d.y) bon += d.poids; }
  return total ? bon / total : 0;
}
export function erreurMoyenne(reseau, donnees) {
  let e = 0, total = 0;
  for (const d of donnees) { e += d.poids * perte(reseau, propager(reseau, d.x).at(-1), d.y).erreur; total += d.poids; }
  return total ? e / total : 0;
}

// Le cerveau en texte Python, au même format que apprentissage.exporter_cerveau (scikit-learn) : à coller dans robot3.py.
export function exporterCerveau(reseau, actions, decimales = 3) {
  const r = (v) => { const s = Number(v.toFixed(decimales)); return Object.is(s, -0) ? "0.0" : String(s).includes(".") || String(s).includes("e") ? String(s) : `${s}.0`; };
  const couches = reseau.couches.map((c) => `[${c.map((n) => `[[${n.poids.map(r).join(", ")}], ${r(n.biais)}]`).join(", ")}]`);
  return `CERVEAU = {'actions': [${actions.map((a) => `'${a}'`).join(", ")}], 'couches': [${couches.join(", ")}]}`;
}

// Les lignes du fichier decisions-gagnants.json (regroupées, avec leur nombre) en données d'entraînement et de test.
export function preparer(lignes, { part = 0.25, graine = 2026 } = {}) {
  const h = hasard(graine), entrainement = [], test = [];
  for (const l of lignes) {
    const d = { x: l.slice(0, -2).map((v) => v / 10), y: l.at(-2), poids: l.at(-1) };
    (h.suivant() < part ? test : entrainement).push(d);
  }
  return { entrainement, test };
}
