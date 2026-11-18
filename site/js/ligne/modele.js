// Jeu 2 : le plateau de la ligne de production (05-jeu2-builder.md § 5).
// Le plateau est un graphe : les pièces sont les nœuds, les tapis sont les arêtes, tracés case par case.
// Ce module ne touche ni au DOM ni à la 3D : la vue 3D, la vue sans 3D et les contrôles s'en servent.

// ----- Réglages -----
export const GRILLE = { colonnes: 12, rangees: 8 };
export const TAILLES_CASIER = [6, 12, 24];

// Catalogue des pièces : nom affiché, équivalent Python, sorties nommées, réglages.
export const PIECES = {
  cuve:         { art: "la cuve", nom: "Cuve", python: "les données de départ (for)", entree: false, sorties: ["suite"], source: true },
  stock:        { art: "la zone de stock", nom: "Zone de stock", python: "les données de départ (for)", entree: false, sorties: ["suite"], source: true },
  remplisseuse: { art: "la remplisseuse", nom: "Remplisseuse", python: "remplir(bouteille)", entree: true, sorties: ["suite"] },
  capsuleuse:   { art: "la capsuleuse", nom: "Capsuleuse", python: "capsuler(bouteille)", entree: true, sorties: ["suite"] },
  etiqueteuse:  { art: "l'étiqueteuse", nom: "Étiqueteuse", python: "etiqueter(bouteille, ...)", entree: true, sorties: ["suite"], reglages: ["biere"] },
  compteur:     { art: "le bac compteur", nom: "Bac compteur", python: "une variable", entree: true, sorties: ["suite"], reglages: ["nom"] },
  controle:     { art: "le contrôle qualité", nom: "Contrôle qualité", python: "if / elif / else", entree: true, sorties: ["oui", "non"], reglages: ["champ", "comparateur", "valeur"] },
  detecteur:    { art: "le détecteur de boucle", nom: "Détecteur de boucle", python: "while", entree: true, sorties: ["encore", "sortie"], reglages: ["champ", "comparateur", "valeur"] },
  casiers:      { art: "la mise en casiers", nom: "Mise en casiers", python: "accumuler dans une liste", entree: true, sorties: ["pleins"], reglages: ["taille"] },
  machine:      { art: "votre machine", nom: "Votre machine", python: "une fonction (def)", entree: true, sorties: ["suite"], reglages: ["biere"] },
  tableau:      { art: "le tableau de bord", nom: "Tableau de bord", python: "print(...)", entree: false, sorties: [], reglages: ["bac"] },
  quai:         { art: "le quai", nom: "Quai", python: "expedier(...)", entree: true, sorties: [], puits: true },
  rebut:        { art: "le rebut", nom: "Rebut", python: "rebut(bouteille)", entree: true, sorties: [], puits: true },
};

export const LIBELLES_SORTIES = { suite: "", oui: "oui", non: "non", pleins: "casiers pleins", encore: "encore un tour", sortie: "sortie" };
export const COMPARATEURS = ["<", "<=", "==", "!=", ">=", ">"];
export const CHAMPS = { volume_cl: "volume (cl)", biere: "bière" };
export const ETAPES_MACHINE = { remplir: "remplir", capsuler: "capsuler", etiqueter: "étiqueter" };
const MOTS_RESERVES = new Set(["False", "None", "True", "and", "as", "assert", "async", "await", "break", "class", "continue", "def", "del",
  "elif", "else", "except", "finally", "for", "from", "global", "if", "import", "in", "is", "lambda", "nonlocal", "not", "or", "pass",
  "raise", "return", "try", "while", "with", "yield", "print", "len", "list", "dict", "str", "int", "sum", "range",
  "bouteille", "casier", "cuve", "stock", "remplir", "capsuler", "etiqueter", "expedier", "rebut"]);

export const cle = (x, z) => x + "," + z;
export const Art = (type) => { const a = PIECES[type].art; return a.charAt(0).toUpperCase() + a.slice(1); };
const voisins = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;

// Un nom de variable Python lisible par un débutant : minuscules, chiffres et _, sans accent.
export function verifierNom(nom) {
  if (!nom) return "Donnez un nom au bac (exemple : nb_bouteilles).";
  if (!/^[a-z_][a-z0-9_]*$/.test(nom)) return `« ${nom} » n'est pas un nom de variable valide : minuscules, chiffres et _ seulement, sans accent ni espace, sans commencer par un chiffre (exemple : nb_bouteilles).`;
  if (MOTS_RESERVES.has(nom)) return `« ${nom} » est déjà un mot de Python ou une machine de la brasserie : choisissez un autre nom.`;
  return null;
}

export class Plateau {
  constructor(niveau, graphe = null) {
    this.niveau = niveau;
    this.pieces = [];
    this.tapis = [];
    this.machine = { nom: "conditionner", etapes: ["remplir", "capsuler", "etiqueter"] };
    this.compteurId = 0;
    const depart = graphe || niveau.depart || { pieces: [], tapis: [] };
    for (const p of niveau.fixes) this.pieces.push({ ...structuredClone(p), fixe: true });
    for (const p of depart.pieces || []) if (!this.pieces.some((q) => q.id === p.id)) this.pieces.push(structuredClone(p));
    for (const t of depart.tapis || []) this.tapis.push(structuredClone(t));
    if (depart.machine) this.machine = structuredClone(depart.machine);
    for (const o of [...this.pieces, ...this.tapis]) { const n = parseInt(String(o.id).replace(/\D/g, ""), 10); if (n > this.compteurId) this.compteurId = n; }
    this.trace = null;
  }

  exporter() {
    return { pieces: this.pieces.filter((p) => !p.fixe).map((p) => structuredClone(p)), tapis: structuredClone(this.tapis), machine: structuredClone(this.machine) };
  }

  piece(id) { return this.pieces.find((p) => p.id === id); }
  pieceEn(x, z) { return this.pieces.find((p) => p.x === x && p.z === z) || null; }
  tapisEn(x, z) { return this.tapis.find((t) => t.cases.some(([a, b]) => a === x && b === z)) || null; }
  dedans(x, z) { return x >= 0 && z >= 0 && x < GRILLE.colonnes && z < GRILLE.rangees; }
  libre(x, z) { return this.dedans(x, z) && !this.pieceEn(x, z) && !this.tapisEn(x, z) && !(this.trace && this.trace.cases.some(([a, b]) => a === x && b === z)); }
  sortants(id) { return this.tapis.filter((t) => t.de === id); }
  sortantsRelies(id) { return this.tapis.filter((t) => t.de === id && t.vers); }
  entrants(id) { return this.tapis.filter((t) => t.vers === id && t.vers !== null); }
  suivant(id, sortie = "suite") { const t = this.tapis.find((u) => u.de === id && u.sortie === sortie); return t ? t.vers : null; }
  sortiesLibres(id) { const p = this.piece(id); return p ? PIECES[p.type].sorties.filter((s) => !this.tapis.some((t) => t.de === id && t.sortie === s)) : []; }
  nouvelId(prefixe) { this.compteurId += 1; return prefixe + this.compteurId; }

  // Pose une pièce de la palette. Renvoie { piece } ou { erreur }.
  poser(type, x, z) {
    if (!this.niveau.palette.includes(type)) return { erreur: "Cette pièce n'est pas disponible dans ce niveau." };
    if (!this.dedans(x, z)) return { erreur: "Cette case est hors du hall." };
    if (!this.libre(x, z)) return { erreur: "Cette case est déjà occupée." };
    const piece = { id: this.nouvelId("p"), type, x, z, params: {} };
    if (type === "compteur") piece.params.nom = this.nomLibre();
    if (type === "casiers") piece.params.taille = 24;
    if (type === "controle" || type === "detecteur") piece.params = { champ: this.niveau.champs ? this.niveau.champs[0] : "volume_cl", comparateur: "<", valeur: null };
    if (type === "tableau") { const bacs = this.bacs(); piece.params.bac = bacs.length ? bacs[0] : null; }
    this.pieces.push(piece);
    return { piece };
  }

  nomLibre() {
    const pris = new Set(this.bacs());
    for (const nom of ["nb_bouteilles", "nb_casiers", "compteur", "total"]) if (!pris.has(nom)) return nom;
    return "compteur_" + (pris.size + 1);
  }

  bacs() { return this.pieces.filter((p) => p.type === "compteur").map((p) => p.params.nom).filter(Boolean); }

  // Supprime la pièce ou le tapis de la case. Les pièces fixes du niveau ne se suppriment pas.
  supprimer(x, z) {
    const p = this.pieceEn(x, z);
    if (p) {
      if (p.fixe) return { erreur: `${Art(p.type)} fait partie du niveau : on ne la retire pas.` };
      this.pieces = this.pieces.filter((q) => q !== p);
      this.tapis = this.tapis.filter((t) => t.de !== p.id && t.vers !== p.id);
      if (p.type === "compteur") for (const q of this.pieces) if (q.type === "tableau" && q.params.bac === p.params.nom) q.params.bac = null;
      return { supprime: p };
    }
    const t = this.tapisEn(x, z);
    if (t) { this.tapis = this.tapis.filter((u) => u !== t); return { supprime: t }; }
    return { erreur: "Il n'y a rien à retirer sur cette case." };
  }

  deplacer(id, x, z) {
    const p = this.piece(id);
    if (!p || p.fixe) return { erreur: "Cette pièce fait partie du niveau : elle ne se déplace pas." };
    if (!this.libre(x, z)) return { erreur: "Cette case est déjà occupée." };
    p.x = x; p.z = z;
    this.tapis = this.tapis.filter((t) => t.de !== p.id && t.vers !== p.id);
    return { piece: p };
  }

  regler(id, params) {
    const p = this.piece(id);
    if (!p) return;
    const ancien = p.params.nom;
    Object.assign(p.params, params);
    if (p.type === "compteur" && ancien && params.nom !== undefined && ancien !== params.nom)
      for (const q of this.pieces) if (q.type === "tableau" && q.params.bac === ancien) q.params.bac = params.nom;
  }

  // ---------- tracé d'un tapis, case par case ----------
  // commencer(x, z, sortie?) sur une pièce qui a une sortie libre ; ajouter(x, z) case voisine ; le tapis se termine sur une pièce qui accepte des bouteilles.
  commencer(x, z, sortie = null) {
    const p = this.pieceEn(x, z);
    if (!p) return { erreur: "Un tapis part d'une pièce : cliquez d'abord sur la pièce de départ." };
    const libres = this.sortiesLibres(p.id);
    if (!libres.length) return { erreur: PIECES[p.type].sorties.length ? `Chaque sortie de ${PIECES[p.type].art} a déjà son tapis.` : `${Art(p.type)} ne fait partir aucun tapis : un tapis part d'une pièce qui envoie des bouteilles.` };
    const choisie = sortie && libres.includes(sortie) ? sortie : libres[0];
    this.trace = { de: p.id, sortie: choisie, cases: [], depart: [x, z] };
    return { trace: this.trace };
  }

  ajouter(x, z) {
    const tr = this.trace;
    if (!tr) return { erreur: "Aucun tapis en cours." };
    const dernier = tr.cases.length ? tr.cases[tr.cases.length - 1] : tr.depart;
    if (dernier[0] === x && dernier[1] === z) return { rien: true };
    const avant = tr.cases.length >= 2 ? tr.cases[tr.cases.length - 2] : (tr.cases.length === 1 ? tr.depart : null);
    if (avant && avant[0] === x && avant[1] === z) { tr.cases.pop(); return { recul: true }; }       // retour en arrière : on efface la dernière case
    if (!voisins(dernier, [x, z])) return { erreur: "Un tapis avance d'une case à la fois, sans diagonale." };
    const p = this.pieceEn(x, z);
    if (p) {
      if (p.id === tr.de) return { erreur: "Un tapis ne revient pas sur sa pièce de départ." };
      if (!PIECES[p.type].entree) return { erreur: `${Art(p.type)} ne reçoit pas de bouteilles.` };
      const t = { id: this.nouvelId("t"), de: tr.de, sortie: tr.sortie, vers: p.id, cases: tr.cases };
      this.tapis.push(t); this.trace = null;
      return { tapis: t };
    }
    if (!this.dedans(x, z)) return { erreur: "Le tapis sortirait du hall." };
    if (this.tapisEn(x, z)) return { erreur: "Deux tapis ne se croisent pas : contournez l'autre tapis." };
    if (tr.cases.some(([a, b]) => a === x && b === z)) return { erreur: "Ce tapis passe déjà par cette case." };
    tr.cases.push([x, z]);
    return { case: [x, z] };
  }

  // Termine le tapis en cours sur sa dernière case, sans pièce au bout : un tapis ouvert. Les bouteilles y tombent dans la trappe.
  terminerOuvert() {
    const tr = this.trace;
    if (!tr || !tr.cases.length) return { erreur: "Un tapis ouvert a au moins une case." };
    const t = { id: this.nouvelId("t"), de: tr.de, sortie: tr.sortie, vers: null, ouvert: true, cases: tr.cases };
    this.tapis.push(t); this.trace = null;
    return { tapis: t };
  }

  annulerTrace() { this.trace = null; }

  // ---------- contrôle du plateau avant de lancer la ligne ----------
  // Renvoie la liste des problèmes : { id, message }. Une liste vide : la ligne peut tourner.
  valider() {
    // bloquant : la ligne ne peut pas tourner ; sinon simple avertissement (la ligne tourne, des bouteilles tomberont)
    const problemes = [], ajouter = (id, message, bloquant = true) => problemes.push({ id, message, bloquant });
    for (const p of this.pieces) {
      const c = PIECES[p.type], Nom = Art(p.type);
      if (c.entree && !this.entrants(p.id).length && !c.puits) ajouter(p.id, `${Nom} ne reçoit aucune bouteille : aucun tapis n'arrive jusqu'à elle.`.replace("elle.", c.art.startsWith("le ") ? "lui." : "elle."), false);
      for (const s of c.sorties) {
        const t = this.tapis.find((u) => u.de === p.id && u.sortie === s);
        const nomSortie = LIBELLES_SORTIES[s] ? `la sortie « ${LIBELLES_SORTIES[s]} » ${c.art.startsWith("le ") ? "du " + c.art.slice(3) : "de " + c.art}` : `la sortie ${c.art.startsWith("le ") ? "du " + c.art.slice(3) : "de " + c.art}`;
        if (!t) ajouter(p.id, `Rien n'est branché sur ${nomSortie} : les bouteilles qui la prennent tomberont dans la trappe.`, false);
        else if (t.ouvert) ajouter(p.id, `Le tapis de ${nomSortie} ne mène à aucune pièce : les bouteilles tomberont dans la trappe au bout.`, false);
      }
      if (p.type === "compteur") { const e = verifierNom(p.params.nom); if (e) ajouter(p.id, e); }
      if (p.type === "etiqueteuse" && !p.params.biere) ajouter(p.id, "Choisissez la bière que cette étiqueteuse imprime.");
      if (p.type === "machine") {
        if (this.machine.etapes.includes("etiqueter") && !p.params.biere) ajouter(p.id, "Choisissez la bière que votre machine étiquette sur cette ligne.");
        if (!this.machine.etapes.length) ajouter(p.id, "Votre machine ne fait encore rien : choisissez ses étapes dans « Créer la machine ».");
        const e = verifierNom(this.machine.nom); if (e) ajouter(p.id, e.replace("au bac", "à la machine").replace("nom de variable", "nom de fonction"));
      }
      if ((p.type === "controle" || p.type === "detecteur") && (p.params.valeur === null || p.params.valeur === undefined || p.params.valeur === ""))
        ajouter(p.id, `Réglez la condition ${p.type === "controle" ? "du contrôle qualité" : "du détecteur de boucle"} : ce qu'on mesure, la comparaison et la valeur (onglet Pièce).`);
      if (p.type === "tableau" && !p.params.bac) ajouter(p.id, "Choisissez le bac que le tableau de bord affiche.");
      if (p.type === "tableau" && p.params.bac && !this.bacs().includes(p.params.bac)) ajouter(p.id, `Le tableau de bord affiche « ${p.params.bac} », mais aucun bac ne porte ce nom.`);
      // l'anneau : depuis la sortie « encore », tout chemin doit revenir au détecteur
      if (p.type === "detecteur") {
        const depart = this.suivant(p.id, "encore");
        if (depart && !this.revientA(depart, p.id)) ajouter(p.id, "La sortie « encore un tour » doit revenir au détecteur par un anneau de tapis : sans retour, la bouteille ne ferait jamais de second tour.");
      }
    }
    const noms = this.bacs();
    for (const n of new Set(noms)) if (noms.filter((m) => m === n).length > 1) ajouter(this.pieces.find((p) => p.type === "compteur" && p.params.nom === n).id, `Deux bacs s'appellent « ${n} » : chaque variable a son propre nom.`);
    // après la mise en casiers, ce sont des casiers qui circulent : seuls un bac compteur et un quai les acceptent
    for (const p of this.pieces.filter((q) => q.type === "casiers")) {
      const vus = new Set(); let id = this.suivant(p.id, "pleins");
      while (id && !vus.has(id)) {
        vus.add(id); const q = this.piece(id);
        if (!["compteur", "quai"].includes(q.type)) { ajouter(q.id, `${Art(q.type)} reçoit des casiers entiers : après la mise en casiers, seuls un bac compteur et un quai sont possibles.`); break; }
        id = this.suivant(id, "suite");
      }
    }
    const cycle = this.cycle();
    if (cycle) ajouter(cycle, "Ce tapis ramène les bouteilles en arrière sans passer par un détecteur de boucle : elles tourneraient sans fin. Un anneau part de la sortie « encore un tour » d'un détecteur et revient à lui.");
    return problemes;
  }

  bloquants() { return this.valider().filter((p) => p.bloquant); }

  // vrai si tout chemin parti de « depart » finit par revenir sur la pièce « cible »
  revientA(depart, cible) {
    const vus = new Set(), pile = [depart];
    while (pile.length) {
      const id = pile.pop();
      if (id === cible || vus.has(id)) continue;
      vus.add(id);
      const p = this.piece(id), sorties = PIECES[p.type].sorties;
      if (!sorties.length) return false;
      for (const s of sorties) { const n = this.suivant(id, s); if (!n) return false; pile.push(n); }
    }
    return true;
  }

  cycle() {
    const etat = new Map();
    const visiter = (id) => {
      etat.set(id, 1);
      for (const t of this.sortants(id)) {
        if (!t.vers || t.sortie === "encore") continue;
        const e = etat.get(t.vers);
        if (e === 1) return t.vers;
        if (!e) { const r = visiter(t.vers); if (r) return r; }
      }
      etat.set(id, 2); return null;
    };
    for (const p of this.pieces) if (!etat.get(p.id)) { const r = visiter(p.id); if (r) return r; }
    return null;
  }

  // Mesures pour l'étoile 2
  nbCasesTapis() { return this.tapis.reduce((s, t) => s + t.cases.length, 0); }
  nbPiecesPosees() { return this.pieces.filter((p) => !p.fixe && p.type !== "tableau").length; }
}
