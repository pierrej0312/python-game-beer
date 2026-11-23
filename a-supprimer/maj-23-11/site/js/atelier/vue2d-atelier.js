// Atelier sans 3D : le hall en cases-boutons, les données en texte, le rejeu dans un journal.
// Même interface que la scène 3D (scene-atelier.js) : le contrôleur (atelier.js) ne voit pas la différence.
// Souris et clavier : flèches pour se déplacer dans le hall, Entrée pour agir sur la case.
import { GRILLE, DEPART, FIN, PIECES, CATEGORIES, ligneDe, enteteDe } from "./catalogue.js";
import { texteValeur } from "./scene-atelier.js";

// ----- Réglages -----
const DUREE_PAS = 0.55;          // secondes par étape du rejeu, vitesse 1
const JOURNAL_MAX = 300;         // lignes gardées dans le journal
const LARGEUR_CASE = 78, HAUTEUR_CASE = 48;   // pixels, au moins
const FLECHES = { "1,0": "→", "-1,0": "←", "0,1": "↓", "0,-1": "↑" };
// une case est étroite : le mot-clé Python du poste, puis la donnée visée ; la ligne entière est dans l'infobulle et le journal
const MOTS = { creer_liste: "[ ]", creer_tuple: "( )", creer_dict: "{ }", creer_set: "set()", variable: "=", calcul: "calcul", lire_case: "[i]", tranche: "[:]",
  longueur: "len", contient: "in", trier_copie: "sorted", ajouter: "append", retirer: "remove", remplacer_case: "[i] =", trier_sur_place: "sort",
  decomposer: "a, b =", afficher: "print", renvoyer: "return", si: "if", pour: "for", tantque: "while", lire_cle: "[clé]", lire_get: "get",
  ecrire_cle: "[clé] =", ajouter_set: "add", code_libre: "code" };
function cible(p) {
  const q = p.params;
  switch (p.type) {
    case "si": return q.conditions[0] || "";
    case "pour": return q.variable || "";
    case "tantque": return q.condition || "";
    case "renvoyer": return q.expression || "";
    case "afficher": return q.expression || "";
    case "decomposer": return (q.noms || []).join(", ");
    default: return q.nom || q.dest || q.cible || q.source || "";
  }
}

const L = GRILLE.colonnes, P = GRILLE.rangees, H = GRILLE.stockage;   // le hall commence sous la zone des données

export function creerVue2DAtelier(conteneur, { surCase = () => {}, decrire = () => "" } = {}) {
  const racine = document.createElement("div");
  racine.className = "vue2d atelier2d";
  const donnees = document.createElement("div");
  donnees.className = "donnees2d"; donnees.setAttribute("aria-label", "Données du programme");
  const grille = document.createElement("div");
  grille.className = "grille2d"; grille.setAttribute("role", "grid");
  grille.setAttribute("aria-label", `Hall de l'atelier, ${L} colonnes sur ${P - H} rangées`);
  // des cases assez larges pour lire « 3. append » : le hall défile s'il ne tient pas en largeur
  grille.style.gridTemplateColumns = `repeat(${L}, ${LARGEUR_CASE}px)`;
  grille.style.gridTemplateRows = `repeat(${P - H}, ${HAUTEUR_CASE}px)`;
  const journal = document.createElement("ol");
  journal.className = "journal-texte journal2d"; journal.setAttribute("aria-live", "polite");
  const zone = document.createElement("div"); zone.className = "zone-grille"; zone.append(grille);
  racine.append(donnees, zone, journal);
  conteneur.prepend(racine);

  const cases = [];
  let focus = [0, H];
  for (let z = H; z < P; z++) {
    const rangee = document.createElement("div"); rangee.setAttribute("role", "row"); rangee.style.display = "contents";
    for (let x = 0; x < L; x++) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "case2d"; b.setAttribute("role", "gridcell"); b.tabIndex = x === 0 && z === H ? 0 : -1;
      b.dataset.x = x; b.dataset.z = z;
      b.addEventListener("click", (e) => { surCase("appui", x, z, e); surCase("relache", x, z, e); });
      b.addEventListener("mouseenter", (e) => surCase("survol", x, z, e));
      b.addEventListener("focus", () => { focus = [x, z]; });
      b.addEventListener("keydown", (e) => {
        const d = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[e.key];
        if (!d) return;
        e.preventDefault();
        allerA(Math.max(0, Math.min(L - 1, x + d[0])), Math.max(H, Math.min(P - 1, z + d[1])));
      });
      rangee.append(b); cases.push(b);
    }
    grille.append(rangee);
  }
  const caseEn = (x, z) => (z >= H && z < P && x >= 0 && x < L ? cases[(z - H) * L + x] : null);
  function allerA(x, z) { const a = caseEn(...focus), b = caseEn(x, z); if (a) a.tabIndex = -1; b.tabIndex = 0; b.focus(); }

  const S = { vitesse: 1, enPause: false, sauter: false, surLenteur: null, calme: true };
  let plateauCourant = null, placesDonnees = new Map(), boutonsDonnees = new Map();

  // ---------- le hall ----------
  function etiquette(b, titre, detail) {
    b.innerHTML = "";
    const s = document.createElement("strong"); s.textContent = titre; b.append(s);
    if (detail) { const d = document.createElement("span"); d.textContent = detail; b.append(d); }
  }

  function dessiner(plateau, { selection = null, problemes = [], trace = null, emplacements = [] } = {}) {
    plateauCourant = plateau;
    const erreurs = new Set(problemes), f = plateau.fonction;
    for (const b of cases) {
      b.textContent = ""; b.className = "case2d"; b.removeAttribute("title");
      b.setAttribute("aria-label", `Case ${Number(b.dataset.x) + 1}, rangée ${Number(b.dataset.z) - H + 1} : vide`);
    }
    // les tapis : une flèche par case, dans le sens du chariot
    const tapis = plateau.tapis();
    if (trace && trace.cases.length) tapis.push({ de: trace.de, vers: null, cases: trace.cases, apercu: true });
    for (const t of tapis) {
      const de = plateau.position(t.de), vers = t.vers ? plateau.position(t.vers) : null;
      if (!de || !t.cases) continue;
      const pts = [de, ...t.cases, ...(vers ? [vers] : [])];
      t.cases.forEach(([x, z], i) => {
        const b = caseEn(x, z); if (!b) return;
        const suivant = pts[i + 2] || pts[i + 1], d = [Math.sign(suivant[0] - x), Math.sign(suivant[1] - z)];
        b.textContent = FLECHES[d.join(",")] || "•";
        b.classList.add("tapis2d"); if (t.manuel) b.classList.add("manuel"); if (t.apercu) b.classList.add("apercu");
        b.setAttribute("aria-label", `Case ${x + 1}, rangée ${z - H + 1} : tapis${t.libelle ? " « " + t.libelle + " »" : ""}${t.manuel ? ", tracé à la main" : ""}`);
      });
    }
    // les quais
    const dep = caseEn(DEPART.x, DEPART.z), fin = caseEn(FIN.x, FIN.z);
    if (dep) { etiquette(dep, "DÉBUT", f ? f.parametres.join(", ") : ""); dep.classList.add("quai2d"); dep.setAttribute("aria-label", f ? `Réception : la fonction ${f.nom} reçoit ${f.parametres.join(", ")}` : "Début du programme"); }
    if (fin) { etiquette(fin, "FIN", f ? "return" : ""); fin.classList.add("quai2d"); fin.setAttribute("aria-label", f ? "Expédition : ce que la fonction renvoie" : "Fin du programme"); }
    // les emplacements où poser dans un bloc
    for (const e of emplacements) {
      const b = caseEn(e.x, e.z); if (!b || b.classList.contains("piece2d")) continue;
      b.textContent = "+"; b.classList.add("emplacement2d");
      b.setAttribute("aria-label", `Case ${e.x + 1}, rangée ${e.z - H + 1} : emplacement${e.libelle ? " (" + e.libelle + ")" : ""}`);
    }
    // les postes : la ligne de Python qu'ils écrivent
    for (const p of plateau.postes) {
      const b = caseEn(p.x, p.z); if (!b) continue;
      const ligne = (p.branches ? enteteDe(p) : ligneDe(p).split("\n")[0]) || PIECES[p.type].nom;
      etiquette(b, `${plateau.ordre(p.id) + 1}. ${MOTS[p.type] || p.type}`, cible(p));
      b.classList.add("piece2d");
      b.style.setProperty("--couleur", (CATEGORIES[PIECES[p.type].categorie] || CATEGORIES.libre).couleur);
      if (p.id === selection) b.classList.add("selection");
      if (erreurs.has(p.id)) b.classList.add("probleme");
      b.title = `${PIECES[p.type].nom} : ${ligne}`;
      b.setAttribute("aria-label", `Case ${p.x + 1}, rangée ${p.z - H + 1} : ${PIECES[p.type].nom}, ${ligne}${erreurs.has(p.id) ? ", à corriger" : ""}`);
    }
  }

  // ---------- les données (au-dessus du hall, en texte) ----------
  // chaque donnée reçoit une place fictive dans la zone des données (rangées 0 à 2) : un clic l'ouvre comme dans la 3D
  function construireDonnees(etat) {
    donnees.innerHTML = ""; placesDonnees = new Map(); boutonsDonnees = new Map();
    const noms = Object.keys(etat);
    if (!noms.length) { const v = document.createElement("p"); v.className = "vide"; v.textContent = "Aucune donnée pour l'instant : les variables apparaissent ici."; donnees.append(v); return; }
    noms.forEach((nom, i) => {
      const x = i % L, z = Math.min(H - 1, Math.floor(i / L));
      placesDonnees.set(nom, { x0: x, z, largeur: 1 });
      const b = document.createElement("button"); b.type = "button"; b.className = "donnee2d";
      const e = etat[nom], type = e.t === "str" ? "str" : e.t;
      b.innerHTML = "";
      const n = document.createElement("strong"); n.textContent = `${nom} `;
      const t = document.createElement("span"); t.className = "type2d"; t.textContent = `${type}${e.n !== undefined ? " · " + e.n : ""}`;
      const v = document.createElement("code"); v.textContent = texteValeur(e);
      b.append(n, t, v);
      b.setAttribute("aria-label", `${nom}, ${type} : ${texteValeur(e)}`);
      b.addEventListener("click", (ev) => { surCase("appui", x, z, ev); surCase("relache", x, z, ev); });
      donnees.append(b); boutonsDonnees.set(nom, b);
    });
  }

  function donneeEn(x, z) {
    for (const [nom, pl] of placesDonnees) if (z === pl.z && x === pl.x0) return nom;
    return null;
  }

  // position d'une case dans la vue, pour ancrer la bulle
  function projeter(x, z) {
    const b = caseEn(x, z), v = conteneur.getBoundingClientRect();
    if (!b) return { x: v.width / 2, y: v.height / 3 };
    const r = b.getBoundingClientRect();
    return { x: r.left - v.left + r.width / 2, y: r.top - v.top };
  }

  // ---------- rejeu ----------
  let actif = null;
  function ecrire(texte, classe = "") {
    const li = document.createElement("li"); li.textContent = texte; if (classe) li.className = classe;
    journal.append(li);
    while (journal.children.length > JOURNAL_MAX) journal.firstChild.remove();
    li.scrollIntoView({ block: "nearest" });
  }
  function eteindre() { if (actif) actif.classList.remove("active"); actif = null; for (const b of boutonsDonnees.values()) b.classList.remove("active"); }

  function preparerRejeu(plateau, etatInitial = {}) {
    plateauCourant = plateau; journal.innerHTML = ""; eteindre();
    construireDonnees(etatInitial);
    const f = plateau.fonction;
    if (f) ecrire(`Réception : ${f.nom}(${f.parametres.map((n) => texteValeur(etatInitial[n], true)).join(", ")})`, "journal-info");
    else ecrire("Le programme démarre.", "journal-info");
  }

  function attendre(duree) {
    return new Promise((fin) => {
      if (S.sauter || duree <= 0) { fin(); return; }
      let reste = duree, avant = performance.now();
      const tic = (t) => { const dt = (t - avant) / 1000; avant = t; if (!S.enPause) reste -= dt * S.vitesse; if (reste <= 0 || S.sauter) fin(); else requestAnimationFrame(tic); };
      requestAnimationFrame(tic);
    });
  }

  async function jouerEtape(e, facteur = 1) {
    eteindre();
    const p = plateauCourant && plateauCourant.poste(e.poste);
    if (p) { actif = caseEn(p.x, p.z); if (actif) actif.classList.add("active"); }
    ecrire(decrire(e), e.erreur || e.retourOk === false ? "journal-echec" : e.decision ? "journal-info" : "");
    if (e.apres) {
      construireDonnees(e.apres);
      // les données qui ont changé à cette étape
      for (const [nom, b] of boutonsDonnees) if (JSON.stringify(e.avant?.[nom]) !== JSON.stringify(e.apres[nom])) b.classList.add("active");
    }
    await attendre(DUREE_PAS * facteur);
  }

  async function finFonction(retour, ok) { ecrire(`Expédition : la fonction renvoie ${retour}.`, ok ? "" : "journal-echec"); }

  function terminer({ reussi }) {
    eteindre();
    ecrire(reussi ? "Le rejeu est terminé : les tests visibles passent." : "Le rejeu est terminé : regardez les onglets Tests et Problèmes.", reussi ? "" : "journal-echec");
  }

  function detruire() { racine.remove(); }
  return Object.assign(S, { dessiner, construireDonnees, donneeEn, projeter, preparerRejeu, jouerEtape, finFonction, terminer, detruire, allumer() {}, sansTroisD: true });
}
