// Atelier de construction : le programme posé dans le hall.
// Un programme est un arbre : une liste de postes dans l'ordre d'exécution ; un bloc (if, for, while) contient ses branches,
// chacune une liste de postes. Les tapis se tracent tout seuls en suivant le chemin du chariot (aiguillages, anneaux),
// le Python s'écrit avec ses indentations. Le chemin inverse (Python -> postes) passe par atelier.analyser() côté Python.
// Module sans DOM.
import { GRILLE, DEPART, FIN, PIECES, BLOCS, ligneDe, enteteDe, nomsCrees, paramsParDefaut } from "./catalogue.js";

const INDENT = "    ";

export class PlateauAtelier {
  constructor(fonction = null) {
    this.fonction = fonction;     // mission à fonction : { nom, parametres } ; sinon programme
    this.racine = [];
    this.numero = 0;
    this.routes = new Map();      // "de>vers" -> cases : tapis tracé à la main (sinon tracé automatique)
    this.trace = null;            // tapis en cours de tracé : { de, depart, cases }
  }

  nouvelId() { this.numero += 1; return "p" + this.numero; }

  // ---- parcours ----
  // tous les postes, dans l'ordre du code (un bloc avant ses branches), avec leur liste et leur profondeur
  *parcourir(liste = this.racine, profondeur = 0, parent = null, branche = null) {
    for (let i = 0; i < liste.length; i++) {
      const p = liste[i];
      yield { poste: p, liste, index: i, profondeur, parent, branche };
      if (p.branches) for (let k = 0; k < p.branches.length; k++) yield* this.parcourir(p.branches[k], profondeur + 1, p, k);
    }
  }
  get postes() { return [...this.parcourir()].map((e) => e.poste); }
  contexte(id) { for (const e of this.parcourir()) if (e.poste.id === id) return e; return null; }
  poste(id) { return this.contexte(id)?.poste || null; }
  ordre(id) { return this.postes.findIndex((p) => p.id === id); }
  index(id) { return this.ordre(id); }
  posteEn(x, z) { return this.postes.find((p) => p.x === x && p.z === z) || null; }
  dansZone(x, z) { return x >= 0 && z >= GRILLE.stockage && x < GRILLE.colonnes && z < GRILLE.rangees; }
  reserve(x, z) { return (x === DEPART.x && z === DEPART.z) || (x === FIN.x && z === FIN.z); }
  libre(x, z, sauf = null) {
    if (!this.dansZone(x, z) || this.reserve(x, z)) return false;
    const p = this.posteEn(x, z); return !p || p.id === sauf;
  }
  // p est-il dans le sous-arbre de bloc ?
  contient(bloc, id) {
    if (!bloc.branches) return false;
    for (const b of bloc.branches) for (const p of b) if (p.id === id || this.contient(p, id)) return true;
    return false;
  }

  creer(type, params = null, x, z) {
    const p = { id: this.nouvelId(), type, params: params ? structuredClone(params) : paramsParDefaut(type), x, z };
    if (BLOCS.has(type)) p.branches = type === "si" ? [[]] : [[]];
    return p;
  }

  // Pose un poste. cible : { apres: id } | { dans: idBloc, branche: k } | null (à la fin du programme).
  poser(type, x, z, cible = null) {
    if (!this.dansZone(x, z)) return { erreur: "Les rangées du fond, contre le mur, sont réservées aux données : posez les postes plus près de vous." };
    if (!this.libre(x, z)) return { erreur: "Cette case est déjà prise." };
    const p = this.creer(type, null, x, z);
    this.inserer(p, cible);
    return { poste: p };
  }

  inserer(p, cible) {
    // « à la fin » d'un bloc qui se termine par return : le poste neuf va juste avant le return, sinon il ne serait jamais exécuté
    const auBout = (liste) => {
      const dernier = liste[liste.length - 1];
      if (p.type !== "renvoyer" && dernier && dernier.type === "renvoyer") liste.splice(liste.length - 1, 0, p); else liste.push(p);
    };
    if (cible && cible.dans) { const b = this.poste(cible.dans); if (b && b.branches[cible.branche]) { auBout(b.branches[cible.branche]); return; } }
    if (cible && cible.apres) { const c = this.contexte(cible.apres); if (c) { c.liste.splice(c.index + 1, 0, p); return; } }
    auBout(this.racine);
  }

  // Le premier poste placé après un return dans le même bloc : il ne sera jamais exécuté.
  apresRetour() {
    for (const { poste, liste, index } of this.parcourir()) if (index > 0 && liste[index - 1].type === "renvoyer") return poste;
    return null;
  }

  supprimer(id) {
    const c = this.contexte(id); if (!c) return;
    c.liste.splice(c.index, 1);
    for (const cle of [...this.routes.keys()]) if (cle.includes(id)) this.routes.delete(cle);
  }
  regler(id, params) {
    const p = this.poste(id); if (!p) return;
    const q = structuredClone(params);
    if (p.type === "si") {
      // la bulle dit d'où vient chaque condition (_origines : rang de la branche d'avant, ou null pour une condition neuve) :
      // une condition retirée emporte sa branche, la voie « sinon » garde la sienne
      const anciennes = p.branches, n = p.params.conditions.length, sinonAvant = p.params.sinon ? anciennes[n] : [];
      const origines = q._origines || q.conditions.map((_, k) => (k < n ? k : null));
      p.branches = origines.map((i) => (i === null || i === undefined ? [] : anciennes[i] || []));
      if (q.sinon) p.branches.push(sinonAvant || []);
      delete q._origines;
    }
    p.params = q;
  }

  // elif : une condition de plus, avant la voie « sinon » ; else : la voie « sinon »
  ajouterElif(id, condition = "") {
    const p = this.poste(id); if (!p || p.type !== "si") return false;
    p.params.conditions.push(condition);
    p.branches.splice(p.params.conditions.length - 1, 0, []);
    return true;
  }
  ajouterSinon(id) {
    const p = this.poste(id); if (!p || p.type !== "si" || p.params.sinon) return false;
    p.params.sinon = true; p.branches.push([]);
    return true;
  }
  deplacer(id, x, z) { const p = this.poste(id); if (!p || !this.libre(x, z, id)) return false; p.x = x; p.z = z; return true; }
  // Change l'ordre d'exécution dans sa liste : sens -1 (plus tôt) ou +1 (plus tard).
  decaler(id, sens) {
    const c = this.contexte(id); if (!c) return false;
    const j = c.index + sens;
    if (j < 0 || j >= c.liste.length) return false;
    [c.liste[c.index], c.liste[j]] = [c.liste[j], c.liste[c.index]];
    return true;
  }

  // ---- placement automatique : la suite principale de gauche à droite, les branches d'un bloc en dessous, côte à côte ----
  ranger() {
    const largeur = (liste) => liste.reduce((s, p) => s + largeurPoste(p), 0);
    const largeurPoste = (p) => (p.branches ? Math.max(1, p.branches.reduce((s, b) => s + Math.max(1, largeur(b)), 0)) : 1);
    const placer = (liste, x, z) => {
      for (const p of liste) {
        p.x = x; p.z = z;
        if (p.branches) { let bx = x; for (const b of p.branches) { placer(b, bx, z + 2); bx += Math.max(1, largeur(b)) * 2; } }
        x += largeurPoste(p) * 2;
      }
    };
    for (const p of this.postes) { p.x = undefined; p.z = undefined; }
    placer(this.racine, 2, GRILLE.stockage);
    // ce qui sort de la grille ou tombe sur une case réservée : la première case libre
    const pris = new Set();
    for (const p of this.postes) {
      const cle = `${p.x},${p.z}`;
      if (!this.dansZone(p.x, p.z) || this.reserve(p.x, p.z) || pris.has(cle)) { p.x = undefined; p.z = undefined; const [x, z] = this.premiereLibre(); p.x = x; p.z = z; }
      pris.add(`${p.x},${p.z}`);
    }
  }

  premiereLibre(pres = null) {
    if (pres) {
      // la case libre la plus proche (en largeur d'abord)
      const vus = new Set([`${pres[0]},${pres[1]}`]), file = [pres];
      while (file.length) {
        const [x, z] = file.shift();
        if (this.libre(x, z)) return [x, z];
        for (const [dx, dz] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) { const n = [x + dx, z + dz]; const c = n.join(","); if (!vus.has(c) && n[0] >= 0 && n[1] >= GRILLE.stockage && n[0] < GRILLE.colonnes && n[1] < GRILLE.rangees) { vus.add(c); file.push(n); } }
      }
    }
    for (let z = GRILLE.stockage; z < GRILLE.rangees; z += 2) for (let x = 2; x < GRILLE.colonnes; x += 2) if (this.libre(x, z)) return [x, z];
    for (let z = GRILLE.stockage; z < GRILLE.rangees; z++) for (let x = 0; x < GRILLE.colonnes; x++) if (this.libre(x, z)) return [x, z];
    return [GRILLE.colonnes - 2, GRILLE.rangees - 1];
  }

  // Emplacements pour poser dans un bloc : un par branche, près de son dernier poste (ou sous le bloc si la branche est vide).
  emplacements() {
    const sortie = [], pris = new Set();
    for (const { poste } of this.parcourir()) {
      if (!poste.branches) continue;
      poste.branches.forEach((b, k) => {
        const dernier = b[b.length - 1];
        const pres = dernier ? [dernier.x, dernier.z + 2 < GRILLE.rangees ? dernier.z + 2 : dernier.z] : [poste.x + 2 * k, poste.z + 2];
        let place = this.premiereLibre([Math.min(GRILLE.colonnes - 1, pres[0]), Math.min(GRILLE.rangees - 1, pres[1])]);
        if (pris.has(place.join(","))) place = this.premiereLibre([place[0] + 1, place[1]]);
        pris.add(place.join(","));
        sortie.push({ bloc: poste.id, branche: k, x: place[0], z: place[1], libelle: libelleBranche(poste, k) });
      });
    }
    return sortie;
  }

  // Les postes viennent du code (analyse Python) : on garde la place des postes reconnus (même type, même rang dans l'ordre).
  depuisAnalyse(postesAnalyse) {
    const anciens = this.postes;
    const utilises = new Set();
    let rang = 0;
    const convertir = (liste) => liste.map((a) => {
      const i = rang++;
      let meme = anciens[i] && anciens[i].type === a.type && !utilises.has(anciens[i].id) ? anciens[i] : null;
      if (!meme) meme = anciens.find((p) => !utilises.has(p.id) && p.type === a.type && ligneDe(p) === ligneDe(a)) || null;
      if (meme) utilises.add(meme.id);
      const p = { id: meme ? meme.id : this.nouvelId(), type: a.type, params: structuredClone(a.params), x: meme?.x, z: meme?.z, lignes: a.lignes, entetes: a.entetes || [] };
      if (a.branches) p.branches = a.branches.map(convertir);
      return p;
    });
    this.racine = convertir(postesAnalyse);
    // une place reprise deux fois, ou absente : la case libre la plus proche du poste précédent
    const pris = new Set(); let precedent = [DEPART.x, DEPART.z];
    for (const p of this.postes) {
      const c = `${p.x},${p.z}`;
      if (p.x === undefined || pris.has(c) || !this.dansZone(p.x, p.z) || this.reserve(p.x, p.z)) {
        p.x = undefined; p.z = undefined;
        const [x, z] = this.premiereLibre([Math.min(GRILLE.colonnes - 1, precedent[0] + 2), precedent[1]]); p.x = x; p.z = z;
      }
      pris.add(`${p.x},${p.z}`); precedent = [p.x, p.z];
    }
  }

  // ---- le Python ----
  // Chaque poste reçoit ses lignes : un poste simple, la sienne ; un bloc, de son en-tête à la fin de ses branches.
  // entetes : lignes du bloc qui lui appartiennent (if, elif, else, for, while).
  code() {
    const lignes = [];
    const ecrire = (liste, niveau) => {
      if (!liste.length) { lignes.push(INDENT.repeat(niveau) + "pass"); return; }
      for (const p of liste) {
        const debut = lignes.length + 1;
        if (!p.branches) {
          for (const l of ligneDe(p).split("\n")) lignes.push(INDENT.repeat(niveau) + l);
          p.lignes = [debut, lignes.length]; p.entetes = [];
          continue;
        }
        p.entetes = [];
        if (p.type === "si") {
          p.params.conditions.forEach((c, k) => {
            p.entetes.push(lignes.length + 1);
            lignes.push(INDENT.repeat(niveau) + (k === 0 ? `if ${c}:` : `elif ${c}:`));
            ecrire(p.branches[k], niveau + 1);
          });
          if (p.params.sinon) { p.entetes.push(lignes.length + 1); lignes.push(INDENT.repeat(niveau) + "else:"); ecrire(p.branches[p.params.conditions.length], niveau + 1); }
        } else {
          p.entetes.push(lignes.length + 1);
          lignes.push(INDENT.repeat(niveau) + enteteDe(p));
          ecrire(p.branches[0], niveau + 1);
        }
        p.lignes = [debut, lignes.length];
      }
    };
    if (this.fonction) {
      lignes.push(`def ${this.fonction.nom}(${this.fonction.parametres.join(", ")}):`);
      if (this.fonction.doc) lignes.push(`${INDENT}"""${this.fonction.doc}"""`);
      ecrire(this.racine, 1);
    } else if (this.racine.length) ecrire(this.racine, 0);
    return lignes.join("\n") + (lignes.length ? "\n" : "");
  }

  // Le poste qui correspond à une ligne exécutée : le plus profond qui la contient (une ligne d'en-tête appartient au bloc).
  posteDeLigne(l) {
    let trouve = null;
    const chercher = (liste) => {
      for (const p of liste) {
        if (!p.lignes || l < p.lignes[0] || l > p.lignes[1]) continue;
        trouve = p;
        if (p.branches) for (const b of p.branches) chercher(b);
      }
    };
    chercher(this.racine);
    return trouve;
  }

  // Branche d'un bloc qui contient la ligne l (pour savoir quelle voie le chariot a prise), ou -1.
  brancheDeLigne(bloc, l) {
    if (!bloc.branches) return -1;
    return bloc.branches.findIndex((b) => b.some((p) => p.lignes && l >= p.lignes[0] && l <= p.lignes[1]));
  }

  // Variables connues avant un poste (dans l'ordre du code), avec leur type prévu ; les paramètres d'une fonction d'abord.
  variablesAvant(id = null) {
    const types = new Map();
    if (this.fonction) for (const n of this.fonction.parametres) types.set(n, this.fonction.types?.[n] || "?");
    for (const p of this.postes) {
      if (p.id === id) break;
      for (const [nom, type] of nomsCrees(p)) {
        if (!nom) continue;
        const t = type === "meme" ? (types.get(p.params.source) || "list") : type;
        types.delete(nom); types.set(nom, t);
      }
    }
    return types;
  }

  // ---- les tapis : le chemin du chariot ----
  // Arêtes de -> vers (ids, ou "depart" / "fin"), avec leur libellé (voie d'un if, corps ou sortie d'une boucle).
  aretes() {
    const sortie = [];
    const lier = (liste, apres) => {
      let suite = apres;
      for (let i = liste.length - 1; i >= 0; i--) {
        const p = liste[i];
        if (p.type === "renvoyer") sortie.push({ de: p.id, vers: "fin", libelle: "" });
        else if (p.type === "si") {
          p.branches.forEach((b, k) => sortie.push({ de: p.id, vers: lier(b, suite), libelle: libelleBranche(p, k), branche: k }));
          if (!p.params.sinon) sortie.push({ de: p.id, vers: suite, libelle: "sinon", branche: p.branches.length });
        } else if (p.type === "pour" || p.type === "tantque") {
          sortie.push({ de: p.id, vers: lier(p.branches[0], p.id), libelle: p.type === "pour" ? "un tour" : "vrai", branche: 0 });
          sortie.push({ de: p.id, vers: suite, libelle: p.type === "pour" ? "fini" : "faux", branche: 1 });
        } else sortie.push({ de: p.id, vers: suite, libelle: "" });
        suite = p.id;
      }
      return suite;
    };
    const entree = lier(this.racine, "fin");
    sortie.unshift({ de: "depart", vers: entree, libelle: "" });
    return sortie.filter((a) => a.de !== a.vers);
  }

  position(id) {
    if (id === "depart") return [DEPART.x, DEPART.z];
    if (id === "fin") return [FIN.x, FIN.z];
    const p = this.poste(id); return p ? [p.x, p.z] : null;
  }

  // Tapis dessinés : chaque arête, avec un tracé à la main s'il est encore valable, sinon le plus court chemin.
  tapis() {
    return this.aretes().map((a) => {
      const de = this.position(a.de), vers = this.position(a.vers);
      const route = this.routes.get(`${a.de}>${a.vers}`);
      const valide = route && routeValide(this, de, vers, route);
      return { ...a, cases: valide ? route : chemin(this, de, vers), manuel: Boolean(valide) };
    });
  }

  // le tapis qui passe par cette case ; un tapis tracé à la main d'abord (plusieurs tapis peuvent partager une case)
  tapisEn(x, z) {
    const sur = this.tapis().filter((t) => t.cases && t.cases.some(([a, b]) => a === x && b === z));
    return sur.find((t) => t.manuel) || sur[0] || null;
  }
  oublierRoute(t) { return this.routes.delete(`${t.de}>${t.vers}`); }

  // ---- tracé d'un tapis à la main : du début ou d'un poste, case par case, jusqu'à un autre poste ----
  commencer(x, z) {
    const depart = x === DEPART.x && z === DEPART.z, p = this.posteEn(x, z);
    if (!depart && !p) return { erreur: "Un tapis part du début (ou de la réception) ou d'un poste : appuyez sur l'un d'eux." };
    if (p && p.type === "renvoyer") return { erreur: "Après une expédition (return), la fonction s'arrête : aucun tapis n'en repart." };
    this.trace = { de: depart ? "depart" : p.id, depart: [x, z], cases: [] };
    return { trace: this.trace };
  }

  ajouter(x, z) {
    const t = this.trace; if (!t) return { erreur: "Commencez le tapis sur un poste." };
    const dernier = t.cases.length ? t.cases[t.cases.length - 1] : t.depart;
    if (Math.abs(dernier[0] - x) + Math.abs(dernier[1] - z) !== 1) return { erreur: "Un tapis avance d'une case à la fois, sans diagonale." };
    const avant = t.cases.length >= 2 ? t.cases[t.cases.length - 2] : (t.cases.length === 1 ? t.depart : null);
    if (avant && avant[0] === x && avant[1] === z) { t.cases.pop(); return { recul: true }; }       // revenir en arrière efface la dernière case
    const p = this.posteEn(x, z);
    if (p) {
      if (p.id === t.de) return { erreur: "Un tapis va d'un poste à un autre poste." };
      return this.terminer(p);
    }
    if (!this.dansZone(x, z) || this.reserve(x, z)) return { erreur: "Les tapis restent dans la zone des postes, devant la ligne jaune." };
    if (t.cases.some(([a, b]) => a === x && b === z)) return { erreur: "Ce tapis passe déjà par cette case." };
    t.cases.push([x, z]);
    return { case: [x, z] };
  }

  // Le poste d'arrivée s'exécute juste après le poste de départ : dans la même liste, ou en tête de la première branche d'un bloc.
  terminer(arrivee) {
    const t = this.trace; this.trace = null;
    const source = t.de === "depart" ? null : this.poste(t.de);
    if (source && (arrivee.id === source.id || this.contient(arrivee, source.id))) return { erreur: "Un bloc ne peut pas passer à l'intérieur de lui-même." };
    const avant = this.ordre(arrivee.id);
    this.supprimer(arrivee.id);
    if (!source) this.racine.unshift(arrivee);
    else if (source.branches) source.branches[0].unshift(arrivee);
    else { const c = this.contexte(source.id); c.liste.splice(c.index + 1, 0, arrivee); }
    const de = source ? source.id : "depart";
    this.routes.set(`${de}>${arrivee.id}`, t.cases.map((c) => [...c]));
    return { tapis: true, deplace: avant !== this.ordre(arrivee.id) || true, arrivee };
  }

  annulerTrace() { this.trace = null; }

  // Un nom de variable change : les postes suivants qui le lisent suivent, jusqu'à ce qu'un poste le redéfinisse.
  renommer(depuis, ancien, nouveau) {
    if (!ancien || ancien === nouveau) return 0;
    const mot = new RegExp(`\\b${ancien}\\b`, "g");
    const postes = this.postes, debut = postes.findIndex((p) => p.id === depuis);
    let n = 0;
    for (const p of postes.slice(debut + 1)) {
      const q = p.params; let change = false;
      for (const c of ["source", "cible"]) if (q[c] === ancien) { q[c] = nouveau; change = true; }
      for (const v of [q.valeur, ...(q.elements || [])]) {
        if (v && v.type === "variable" && v.valeur === ancien) { v.valeur = nouveau; change = true; }
        if (v && v.type === "expression") { const r = String(v.valeur).replace(mot, nouveau); if (r !== v.valeur) { v.valeur = r; change = true; } }
      }
      for (const c of ["expression", "code", "condition", "source"]) if (typeof q[c] === "string") { const r = q[c].replace(mot, nouveau); if (r !== q[c]) { q[c] = r; change = true; } }
      if (Array.isArray(q.conditions)) q.conditions = q.conditions.map((t) => { const r = t.replace(mot, nouveau); if (r !== t) change = true; return r; });
      if (change) n += 1;
      if (nomsCrees(p).some(([nom]) => nom === ancien)) break;
    }
    return n;
  }

  // ---- sauvegarde : places et tapis tracés, par rang dans l'ordre du code (les identifiants changent d'une session à l'autre) ----
  exporterPlaces() { return this.postes.map((p) => [p.x, p.z]); }
  importerPlaces(places, force = false) {
    if (!Array.isArray(places)) return;
    if (force) { this.postes.forEach((p, i) => { const pl = places[i]; if (pl) { p.x = pl[0]; p.z = pl[1]; } }); return; }   // annuler : les places d'une photo sont cohérentes entre elles
    this.postes.forEach((p, i) => { const pl = places[i]; if (pl && this.libre(pl[0], pl[1], p.id)) { p.x = pl[0]; p.z = pl[1]; } });
  }
  exporterRoutes() {
    const r = {}, rang = (id) => (id === "depart" || id === "fin" ? id : this.ordre(id));
    for (const [cle, cases] of this.routes) { const [de, vers] = cle.split(">"); r[`${rang(de)}>${rang(vers)}`] = cases; }
    return r;
  }
  importerRoutes(r) {
    this.routes = new Map();
    const postes = this.postes, id = (x) => (x === "depart" || x === "fin" ? x : postes[Number(x)]?.id);
    for (const [cle, cases] of Object.entries(r || {})) { const [de, vers] = cle.split(">").map(id); if (de && vers) this.routes.set(`${de}>${vers}`, cases); }
  }
}

export function libelleBranche(bloc, k) {
  if (bloc.type === "si") {
    const n = bloc.params.conditions.length;
    if (k === 0) return "vrai";
    if (k < n) return `elif ${k}`;
    return "sinon";
  }
  return bloc.type === "pour" ? "un tour" : "vrai";
}

function routeValide(plateau, de, vers, cases) {
  let precedent = de;
  for (const [x, z] of cases) {
    if (Math.abs(precedent[0] - x) + Math.abs(precedent[1] - z) !== 1 || !plateau.dansZone(x, z) || plateau.posteEn(x, z) || plateau.reserve(x, z)) return false;
    precedent = [x, z];
  }
  return Math.abs(precedent[0] - vers[0]) + Math.abs(precedent[1] - vers[1]) === 1;
}

function chemin(plateau, de, vers) {
  // largeur d'abord dans la zone des postes ; les cases des postes sont évitées
  if (!de || !vers) return null;
  const L = GRILLE.colonnes, P = GRILLE.rangees, cle = (x, z) => z * L + x;
  const precedent = new Map([[cle(...de), null]]), file = [de];
  const bloque = (x, z) => (x === vers[0] && z === vers[1]) ? false : plateau.posteEn(x, z) || plateau.reserve(x, z);
  while (file.length) {
    const [x, z] = file.shift();
    if (x === vers[0] && z === vers[1]) break;
    for (const [dx, dz] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < GRILLE.stockage || nx >= L || nz >= P || precedent.has(cle(nx, nz)) || bloque(nx, nz)) continue;
      precedent.set(cle(nx, nz), [x, z]); file.push([nx, nz]);
    }
  }
  if (!precedent.has(cle(...vers))) return null;          // pas de chemin : les postes sont enfermés
  const cases = [];
  for (let c = precedent.get(cle(...vers)); c && !(c[0] === de[0] && c[1] === de[1]); c = precedent.get(cle(...c))) cases.unshift(c);
  return cases;
}

export { PIECES };
