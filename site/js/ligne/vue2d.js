// Jeu 2 : le plateau sans 3D (README des jeux, règle 5 : chaque jeu a un mode sans 3D).
// Une grille de cases-boutons, utilisable à la souris et au clavier (flèches, Entrée), et un journal des étapes.
import { GRILLE, PIECES, LIBELLES_SORTIES } from "./modele.js";
import { conditionTexte } from "./generateur.js";
import { decrireEtape } from "./rejeu-ligne.js";

// ----- Réglages -----
const DUREE_PAS = 0.42;          // secondes par étape, vitesse 1 (comme la scène 3D)
const SYMBOLES = { cuve: "CUVE", stock: "STOCK", remplisseuse: "REMP", capsuleuse: "CAPS", etiqueteuse: "ÉTIQ", compteur: "BAC", controle: "SI", detecteur: "TANT", casiers: "CASI", machine: "MACH", tableau: "PRINT", quai: "QUAI", rebut: "BENNE" };
const FLECHES = { "1,0": "→", "-1,0": "←", "0,1": "↓", "0,-1": "↑" };

export function creerVue2D(conteneur, { surCase = () => {} } = {}) {
  const racine = document.createElement("div");
  racine.className = "vue2d";
  const grille = document.createElement("div");
  grille.className = "grille2d"; grille.setAttribute("role", "grid"); grille.setAttribute("aria-label", "Plateau du hall de production, 12 colonnes sur 8 rangées");
  grille.style.gridTemplateColumns = `repeat(${GRILLE.colonnes}, 1fr)`;
  grille.style.gridTemplateRows = `repeat(${GRILLE.rangees}, 1fr)`;
  const journal = document.createElement("ol");
  journal.className = "journal-texte journal2d"; journal.setAttribute("aria-live", "polite");
  const zone = document.createElement("div"); zone.className = "zone-grille"; zone.append(grille);   // la grille garde ses proportions dans la place disponible
  racine.append(zone, journal);
  conteneur.prepend(racine);

  const cases = [];
  let focus = [0, 0];
  for (let z = 0; z < GRILLE.rangees; z++) {
    const rangee = document.createElement("div"); rangee.setAttribute("role", "row"); rangee.style.display = "contents";
    for (let x = 0; x < GRILLE.colonnes; x++) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "case2d"; b.setAttribute("role", "gridcell"); b.tabIndex = x === 0 && z === 0 ? 0 : -1;
      b.dataset.x = x; b.dataset.z = z;
      b.addEventListener("click", () => { surCase("appui", x, z); surCase("relache", x, z); });
      b.addEventListener("focus", () => { focus = [x, z]; });
      b.addEventListener("keydown", (e) => {
        const d = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[e.key];
        if (!d) return;
        e.preventDefault();
        const nx = Math.max(0, Math.min(GRILLE.colonnes - 1, x + d[0])), nz = Math.max(0, Math.min(GRILLE.rangees - 1, z + d[1]));
        allerA(nx, nz);
      });
      rangee.append(b); cases.push(b);
    }
    grille.append(rangee);
  }
  const caseEn = (x, z) => cases[z * GRILLE.colonnes + x];
  function allerA(x, z) { const a = caseEn(...focus), b = caseEn(x, z); a.tabIndex = -1; b.tabIndex = 0; b.focus(); }

  const S = { vitesse: 1, enPause: false, sauter: false, surLenteur: null, calme: true };
  let plateauCourant = null;

  function dessiner(plateau, { selection = null, problemes = [], trace = null } = {}) {
    plateauCourant = plateau;
    const erreurs = new Set(problemes.map((p) => p.id));
    for (const b of cases) { b.textContent = ""; b.className = "case2d"; b.removeAttribute("title"); b.setAttribute("aria-label", `Case ${Number(b.dataset.x) + 1}, rangée ${Number(b.dataset.z) + 1} : vide`); }
    const tapisAvecTrace = trace ? [...plateau.tapis, { de: trace.de, sortie: trace.sortie, vers: null, cases: trace.cases, apercu: true }] : plateau.tapis;
    for (const t of tapisAvecTrace) {
      const de = plateau.piece(t.de), vers = t.vers ? plateau.piece(t.vers) : null;
      const pts = [[de.x, de.z], ...t.cases, ...(vers ? [[vers.x, vers.z]] : [])];
      t.cases.forEach(([x, z], i) => {
        const b = caseEn(x, z), dernier = i === t.cases.length - 1;
        const sortie = LIBELLES_SORTIES[t.sortie] ? ` (sortie « ${LIBELLES_SORTIES[t.sortie]} »)` : "";
        b.classList.add("tapis2d"); if (t.apercu) b.classList.add("apercu");
        if (t.ouvert && dernier) {
          // tapis ouvert : la dernière case est la trappe
          b.textContent = "●"; b.classList.add("trappe2d");
          b.setAttribute("aria-label", `Case ${x + 1}, rangée ${z + 1} : bout du tapis de ${PIECES[de.type].art}${sortie}, trappe : les bouteilles y tombent`);
          return;
        }
        const suivant = pts[i + 2] || pts[i + 1], d = [Math.sign(suivant[0] - x), Math.sign(suivant[1] - z)];
        b.textContent = FLECHES[d.join(",")] || "•";
        b.setAttribute("aria-label", `Case ${x + 1}, rangée ${z + 1} : tapis de ${PIECES[de.type].art}${sortie} vers ${vers ? PIECES[vers.type].art : "…"}`);
      });
    }
    for (const p of plateau.pieces) {
      const b = caseEn(p.x, p.z);
      const detail = detailPiece(p, plateau);
      b.innerHTML = "";
      const s = document.createElement("strong"); s.textContent = SYMBOLES[p.type];
      const d = document.createElement("span"); d.textContent = detail;
      b.append(s, d);
      b.classList.add("piece2d", "piece-" + p.type);
      if (p.fixe) b.classList.add("fixe");
      if (p.id === selection) b.classList.add("selection");
      if (erreurs.has(p.id)) b.classList.add("probleme");
      b.title = `${PIECES[p.type].nom}${detail ? " : " + detail : ""}`;
      b.setAttribute("aria-label", `Case ${p.x + 1}, rangée ${p.z + 1} : ${PIECES[p.type].nom}${detail ? ", " + detail : ""}${erreurs.has(p.id) ? ", à corriger" : ""}`);
    }
  }

  function detailPiece(p, plateau) {
    const q = p.params;
    switch (p.type) {
      case "cuve": return q.cuve;
      case "etiqueteuse": return q.biere || "à régler";
      case "machine": return `${plateau.machine.nom}${q.biere ? " · " + q.biere : ""}`;
      case "compteur": return q.nom || "";
      case "controle":
      case "detecteur": return q.valeur === null || q.valeur === undefined ? "à régler" : conditionTexte(q).replace('bouteille["', "").replace('"]', "");
      case "casiers": return `de ${q.taille}`;
      case "tableau": return q.bac || "à régler";
      case "quai": return q.quai;
      default: return "";
    }
  }

  // ---------- rejeu ----------
  let actif = null;
  function preparerRejeu(plateau) { plateauCourant = plateau; journal.innerHTML = ""; if (actif) actif.classList.remove("active"); actif = null; }

  function attendre(duree) {
    return new Promise((fin) => {
      if (S.sauter || duree <= 0) { fin(); return; }
      let reste = duree, avant = performance.now();
      const tic = (t) => { const dt = (t - avant) / 1000; avant = t; if (!S.enPause) reste -= dt * S.vitesse; if (reste <= 0 || S.sauter) fin(); else requestAnimationFrame(tic); };
      requestAnimationFrame(tic);
    });
  }

  async function jouerEtape(e, facteur = 1) {
    if (e.type === "init") return;
    const li = document.createElement("li");
    li.textContent = decrireEtape(e, plateauCourant);
    if (e.type === "erreur" || e.type === "chute") li.className = "journal-echec";
    else if (e.type === "piece" && plateauCourant.piece(e.piece)?.type === "rebut") li.className = "journal-echec";
    else if (e.type === "apparition" || e.type === "print") li.className = "journal-info";
    journal.append(li);
    while (journal.children.length > 200) journal.firstChild.remove();
    li.scrollIntoView({ block: "nearest" });
    if (actif) actif.classList.remove("active");
    const p = e.piece ? plateauCourant.piece(e.piece) : null;
    if (p) { actif = caseEn(p.x, p.z); actif.classList.add("active"); }
    await attendre(DUREE_PAS * facteur);
  }

  function terminer({ reussi }) {
    const li = document.createElement("li");
    li.className = reussi ? "" : "journal-echec";
    li.textContent = reussi ? "La ligne a tourné jusqu'au bout." : "La ligne s'est arrêtée : regardez l'onglet Problèmes.";
    journal.append(li); li.scrollIntoView({ block: "nearest" });
  }

  function detruire() { racine.remove(); }
  return Object.assign(S, { dessiner, preparerRejeu, jouerEtape, terminer, detruire, allumer() {}, ecrireEtiquette() {} });
}
