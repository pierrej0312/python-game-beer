// L'usine de la Fonderie : mise en page d'un programme en ligne de production.
// Chaque instruction est une machine, posée de gauche à droite dans l'ordre du code.
// if / elif : des trieurs en série sur le rail principal ; chacun dévie la bouteille vers sa voie quand sa condition est vraie.
// Le rail principal continue tout droit : c'est le else (ou rien). Les voies se rebranchent sur le rail principal,
// sauf celles qui finissent par return (la commande part) ou break / continue (un tube aérien vers la sortie ou l'entrée de la boucle).
// Les voies sont rangées vers le fond dans l'ordre du code : la voie du if est la plus éloignée, celle du dernier elif la plus proche.
// for / while : une machine de boucle et son anneau de retour.
// Entrée : l'analyse Python (atelier.analyser : postes, corps) et le texte du code. Sortie : machines, tapis, fentes
// (points « + » où insérer une machine), zones au sol. Module sans DOM ni three.js : il se teste seul.

export const PAS = 4.4;          // une machine occupe PAS unités le long de la ligne (machines agrandies : 2,2 de large)
export const ECART_VOIE = 3.4;   // écart minimal entre deux voies parallèles (machines agrandies)
export const LARGEUR_RANG = 13.3;  // au-delà, le programme passe au rang suivant, comme une ligne de texte
export const ECART_BACS = 3.5;   // place d'un contenant dans le parc de stockage
export const PORTE = 3.0;        // écart entre deux trieurs (if, elif) sur le rail principal

// ---- les variables du programme, dans l'ordre où elles apparaissent, avec le contenant qui leur va ----
// genre : valeur (cuve), liste, tuple (caisse scellée), dict (fût à cadrans), set (bac de tri).
// Les paramètres d'une fonction viennent d'abord, avec le type annoncé par la mission. À la marche, le vrai type l'emporte.
const GENRE_TYPE = { list: "liste", tuple: "tuple", dict: "dict", set: "set" };
export function variablesDe(analyse, fonction = null) {
  const vues = new Map();
  const noter = (nom, genre) => {
    if (!nom || !/^[A-Za-z_]\w*$/.test(nom)) return;
    if (!vues.has(nom)) vues.set(nom, genre);
    else if (vues.get(nom) === "valeur" && genre !== "valeur") vues.set(nom, genre);
  };
  for (const n of (analyse.parametres || (fonction && fonction.parametres) || [])) noter(n, GENRE_TYPE[fonction && fonction.types && fonction.types[n]] || "valeur");
  const parcourir = (postes) => postes.forEach((p) => {
    const q = p.params || {};
    switch (p.type) {
      case "creer_liste": noter(q.nom, "liste"); break;
      case "creer_tuple": noter(q.nom, "tuple"); break;
      case "creer_dict": noter(q.nom, "dict"); break;
      case "creer_set": noter(q.nom, "set"); break;
      case "variable": case "calcul": noter(q.nom, "valeur"); break;
      case "tranche": case "trier_copie": noter(q.dest, "liste"); break;
      case "lire_case": case "lire_cle": case "lire_get": case "longueur": case "contient": noter(q.dest, "valeur"); break;
      case "trier_sur_place": if (q.dest) noter(q.dest, "valeur"); break;
      case "decomposer": (q.noms || []).forEach((n) => noter(n, "valeur")); break;
      case "pour": String(q.variable || "").split(",").forEach((n) => noter(n.trim(), "valeur")); break;
      default: break;
    }
    if (p.branches && p.type !== "module") p.branches.forEach(parcourir);
  });
  parcourir(analyse.postes || []);
  return [...vues].map(([nom, genre]) => ({ nom, genre }));
}

// ---- mesure : largeur et débords d'une liste, avant de la placer ----
function mesurerListe(postes) {
  let largeur = 0, haut = 0, bas = 0;
  for (const p of postes) {
    const m = mesurerPoste(p);
    largeur += m.largeur; haut = Math.max(haut, m.haut); bas = Math.max(bas, m.bas);
  }
  return { largeur: Math.max(largeur, PAS), haut, bas };
}

// Les voies d'un if : une par condition (if, elif), et le rail principal (else, ou rien).
function voiesDe(p) {
  const n = p.params.conditions.length;
  const conditions = p.branches.slice(0, n).map((b, k) => ({ postes: b, corps: p.corps ? p.corps[k] : null, k }));
  const sinon = p.params.sinon ? { postes: p.branches[n], corps: p.corps ? p.corps[n] : null, k: n } : { postes: [], corps: null, k: n, directe: true };
  return { conditions, sinon };
}
// Une voie qui finit par return, break ou continue ne revient pas sur le rail principal.
export const sautDe = (p) => (p && p.type === "code_libre" ? ({ break: "break", continue: "continue" })[String(p.params.code).trim()] || null : null);
const finitVoie = (postes) => { const d = postes[postes.length - 1]; return !!d && (d.type === "renvoyer" || !!sautDe(d)); };

// Un bloc (try, with, match, class, for/while avec else) : la première partie sur le rail, les autres en voies au fond,
// chacune ouverte par son sas (la ligne except…, else:, finally:, case…).
function mesurerBloc(p) {
  const ms = p.branches.map((b) => mesurerListe(b));
  const largeur = PAS + Math.max(ms[0].largeur, ...ms.slice(1).map((m) => PAS + m.largeur)) + PAS;
  let haut = ms[0].haut;
  for (let k = ms.length - 1; k >= 1; k--) haut += ECART_VOIE + ms[k].bas + ms[k].haut;
  return { largeur, haut, bas: ms[0].bas, ms };
}

function mesurerPoste(p) {
  if (p.type === "module") return { largeur: 0, haut: 0, bas: 0 };          // une fonction a son bâtiment, hors de la ligne
  if (p.type === "bloc") return mesurerBloc(p);
  if (p.type === "si") {
    const { conditions, sinon } = voiesDe(p);
    const mc = conditions.map((v) => mesurerListe(v.postes)), ms = mesurerListe(sinon.postes);
    const largeur = conditions.length * PORTE + Math.max(ms.largeur, ...mc.map((v) => v.largeur)) + PAS;
    let haut = ms.haut;
    for (let k = mc.length - 1; k >= 0; k--) haut += ECART_VOIE + mc[k].bas + mc[k].haut;
    return { largeur, haut, bas: ms.bas };
  }
  if (p.type === "pour" || p.type === "tantque") {
    const c = mesurerListe(p.branches[0]);
    return { largeur: PAS + c.largeur + PAS, haut: c.haut + ECART_VOIE, bas: c.bas + ECART_VOIE };
  }
  return { largeur: PAS, haut: 0, bas: 0 };
}

// ---- placement ----
// ---- les ateliers repliables : le programme principal découpé en sections ----
// Une ligne de commentaire en colonne 0 de la forme « # --- Titre --- » (ou « # === Titre === », ou « # %% Titre ») ouvre une section.
// Sans ces commentaires, un long programme (plus de 40 instructions principales) est découpé en parties de 20.
// Une section fermée est un atelier sur la ligne ; ouverte, ses machines reprennent leur place, précédées d'une enseigne.
const MOTIF_SECTION = /^#\s*(?:-{2,}|={2,}|%%)\s*(.*?)\s*[-=]*\s*$/;
export function sectionsDe(postes, code) {
  const lignes = code.split("\n"), entetes = [];
  lignes.forEach((l, i) => { const m = l.match(MOTIF_SECTION); if (m) entetes.push({ ligne: i + 1, titre: m[1] || `Section ${entetes.length + 1}` }); });
  const principaux = postes.map((p, i) => [p, i]).filter(([p]) => p.type !== "module");
  let sections = [];
  if (entetes.length) {
    const avant = principaux.filter(([p]) => p.lignes[0] < entetes[0].ligne);
    if (avant.length) sections.push({ titre: "Début", elements: avant });
    entetes.forEach((e, k) => {
      const fin = k + 1 < entetes.length ? entetes[k + 1].ligne : Infinity;
      sections.push({ titre: e.titre, elements: principaux.filter(([p]) => p.lignes[0] > e.ligne && p.lignes[0] < fin) });
    });
  } else if (principaux.length > 40) {
    for (let k = 0; k < principaux.length; k += 20) sections.push({ titre: `Partie ${k / 20 + 1}`, elements: principaux.slice(k, k + 20) });
  } else return null;
  sections = sections.filter((x) => x.elements.length);
  sections.forEach((x, k) => {
    x.id = `section${k}:${x.titre}`;
    x.debut = x.elements[0][0].lignes[0]; x.fin = x.elements[x.elements.length - 1][0].lignes[1];
    if (!entetes.length) x.titre = `${x.titre} (lignes ${x.debut} à ${x.fin})`;
  });
  return sections;
}

export function disposer(analyse, code, { fonction = null, sectionsOuvertes = new Set(), modulesOuverts = new Set() } = {}) {
  const lignes = code.split("\n");
  const texteDe = (n) => (lignes[n - 1] || "").trim();
  const sortie = { machines: [], tapis: [], fentes: [], zones: [], voies: [], stations: [], sauts: [], parcs: {}, liaisons: [] };

  // boucle : la boucle qui contient cette liste ({ entree, sortie } : points du rail), pour les tubes de break et continue.
  function placerListe(postes, corps, x, z, profondeur, contexte, boucle = null) {
    const m = mesurerListe(postes);
    sortie.tapis.push({ de: [x, z], a: [x + m.largeur, z] });
    if (!postes.length && corps && corps.pass) {
      // un bloc vide : la plaque « pass », un tapis qui ne fait rien
      sortie.machines.push({ id: "pass:" + corps.pass, poste: null, type: "passer", role: "plaque", ligne: corps.pass, texte: "pass", x: x + PAS / 2 + 0.6, z, profondeur, decor: true });
      sortie.fentes.push({ x: x + 0.4, z, cible: { postes, corps, index: 0, contexte } });
      return m;
    }
    let cx = x;
    postes.forEach((p, i) => {
      if (p.type !== "module") sortie.fentes.push({ x: cx, z, cible: { postes, corps, index: i, contexte } });
      cx += placerPoste(p, cx, z, profondeur, boucle);
    });
    // pas de fente après un return, un break, un continue : une machine posée là ne tournerait jamais
    if (!finitVoie(postes)) {
      sortie.fentes.push({ x: postes.length ? cx : x + PAS / 2, z, cible: { postes, corps, index: postes.length, contexte } });
    }
    return m;
  }

  function placerPoste(p, x, z, profondeur, boucle = null) {
    const base = { id: p.id, poste: p, type: p.type, ligne: p.lignes[0], texte: texteDe(p.lignes[0]), profondeur };
    if (p.type === "module") return 0;
    if (p.type === "section" || p.type === "enseigne") {
      const x0 = p.section;
      sortie.machines.push({ id: p.id, poste: null, type: p.type, role: p.type, section: x0.id, ligne: x0.debut, lignes: [x0.debut, x0.fin],
        texte: (p.type === "section" ? "" : "▾ ") + x0.titre, x: x + PAS / 2, z, profondeur });
      return PAS;
    }
    if (p.type === "bloc") {
      const { largeur, ms } = mesurerBloc(p);
      const xCorps = x + PAS, xFin = x + largeur - PAS / 2;
      sortie.machines.push({ ...base, role: "sas", partie: 0, genre: p.params.genre, x: x + PAS / 2, z });
      sortie.tapis.push({ de: [x, z], a: [xCorps, z] });
      sortie.zones.push({ x1: x - 0.2, z1: z - 1.1, x2: xFin + 0.4, z2: z + ms[0].bas + 1.1, type: "bloc", profondeur: profondeur + 1 });
      placerListe(p.branches[0], p.corps ? p.corps[0] : null, xCorps, z, profondeur + 1, { bloc: p, voie: 0 }, boucle);
      if (!finitVoie(p.branches[0])) sortie.tapis.push({ de: [xCorps + ms[0].largeur, z], a: [xFin, z] });
      let bord = z - ms[0].haut;
      const zv = [];
      for (let k = ms.length - 1; k >= 1; k--) { zv[k] = bord - ECART_VOIE - ms[k].bas; bord = zv[k] - ms[k].haut; }
      for (let k = 1; k < ms.length; k++) {
        const xs = xCorps + PAS / 2;
        sortie.tapis.push({ de: [x + PAS / 2, z], par: [[x + PAS / 2, zv[k]]], a: [xCorps, zv[k]], derive: true });
        sortie.machines.push({ id: `${p.id}:partie${k}`, poste: p, type: "partie", role: "sas", partie: k, genre: p.params.genre,
          ligne: p.entetes[k], texte: texteDe(p.entetes[k]), x: xs, z: zv[k], profondeur });
        sortie.tapis.push({ de: [xCorps, zv[k]], a: [xCorps + PAS, zv[k]] });
        sortie.zones.push({ x1: xCorps - 0.6, z1: zv[k] - ms[k].haut - 0.9, x2: xFin + 0.4, z2: zv[k] + ms[k].bas + 0.9, type: "bloc", profondeur: profondeur + 1 });
        placerListe(p.branches[k], p.corps ? p.corps[k] : null, xCorps + PAS, zv[k], profondeur + 1, { bloc: p, voie: k }, boucle);
        if (!finitVoie(p.branches[k])) sortie.tapis.push({ de: [xCorps + PAS + ms[k].largeur, zv[k]], par: [[xFin, zv[k]]], a: [xFin, z] });
      }
      sortie.machines.push({ id: p.id + ":groupeur", poste: p, type: "groupeur", role: "groupeur", x: xFin, z, ligne: p.lignes[0], texte: "", profondeur, decor: true });
      return largeur;
    }
    if (p.type === "si") {
      const { conditions, sinon } = voiesDe(p);
      const mc = conditions.map((v) => mesurerListe(v.postes)), ms = mesurerListe(sinon.postes);
      const largeur = Math.max(ms.largeur, ...mc.map((v) => v.largeur));
      const xCorps = x + conditions.length * PORTE, xFin = xCorps + largeur + PAS / 2;
      // le rail principal traverse les trieurs ; après eux : le else, ou le rail nu
      sortie.tapis.push({ de: [x, z], a: [xCorps, z] });
      sortie.zones.push({ x1: x - 0.2, z1: z - 1.1, x2: xFin + 0.4, z2: z + ms.bas + 1.1, type: "si", profondeur: profondeur + 1 });
      if (sinon.directe) {
        sortie.tapis.push({ de: [xCorps, z], a: [xFin, z] });
        sortie.voies.push({ x: xCorps, z, libelle: "aucune condition vraie : tout droit", couleur: "directe" });
      } else {
        sortie.voies.push({ x: xCorps, z, libelle: "sinon (else)", couleur: "sinon" });
        placerListe(sinon.postes, sinon.corps, xCorps, z, profondeur + 1, { bloc: p, voie: sinon.k }, boucle);
        if (!finitVoie(sinon.postes)) sortie.tapis.push({ de: [xCorps + ms.largeur, z], a: [xFin, z] });
      }
      // les voies des conditions, vers le fond : la dernière (elif) au plus près, celle du if au plus loin
      let bord = z - ms.haut;
      const zv = [];
      for (let k = conditions.length - 1; k >= 0; k--) { zv[k] = bord - ECART_VOIE - mc[k].bas; bord = zv[k] - mc[k].haut; }
      conditions.forEach((v, k) => {
        const xp = x + PORTE / 2 + k * PORTE;
        sortie.machines.push({ ...base, id: k === 0 ? p.id : `${p.id}:elif${k}`, ligne: p.entetes[k], texte: texteDe(p.entetes[k]),
          role: "trieur", voie: k, condition: p.params.conditions[k], x: xp, z });
        sortie.tapis.push({ de: [xp, z], par: [[xp, zv[k]]], a: [xCorps, zv[k]], derive: true });
        sortie.zones.push({ x1: xp - 0.8, z1: zv[k] - mc[k].haut - 0.9, x2: xFin + 0.4, z2: zv[k] + mc[k].bas + 0.9, type: "si", profondeur: profondeur + 1 });
        placerListe(v.postes, v.corps, xCorps, zv[k], profondeur + 1, { bloc: p, voie: k }, boucle);
        // la voie se rebranche sur le rail principal, sauf si elle s'arrête (return, break, continue)
        if (!finitVoie(v.postes)) sortie.tapis.push({ de: [xCorps + mc[k].largeur, zv[k]], par: [[xFin, zv[k]]], a: [xFin, z] });
      });
      sortie.machines.push({ id: p.id + ":groupeur", poste: p, type: "groupeur", role: "groupeur", x: xFin, z, ligne: p.lignes[0], texte: "", profondeur, decor: true });
      return conditions.length * PORTE + largeur + PAS;
    }
    if (p.type === "pour" || p.type === "tantque") {
      const c = mesurerListe(p.branches[0]);
      const xFin = x + PAS + c.largeur;
      const zHaut = z - c.haut - ECART_VOIE, zBas = z + c.bas + ECART_VOIE;
      sortie.machines.push({ ...base, role: "boucle", x: x + PAS / 2, z });
      sortie.zones.push({ x1: x + PAS - 0.4, z1: z - c.haut - 0.8, x2: xFin + 0.4, z2: z + c.bas + 0.8, type: "boucle", profondeur: profondeur + 1 });
      // l'anneau : le corps, puis le retour à la machine de boucle par le fond
      sortie.tapis.push({ de: [xFin, z], par: [[xFin, zHaut], [x + PAS / 2, zHaut]], a: [x + PAS / 2, z], retour: true });
      // la sortie de boucle : par l'avant, jusqu'à la suite
      sortie.tapis.push({ de: [x + PAS / 2, z], par: [[x + PAS / 2, zBas], [xFin + PAS / 2, zBas]], a: [xFin + PAS / 2, z], fin: true });
      if (p.type === "pour") {
        // la caisse de sortie : elle reçoit une bouteille par tour, et repart pleine quand la boucle est finie
        sortie.machines.push({ id: p.id + ":collecteur", poste: p, type: "collecteur", role: "collecteur", x: (x + PAS / 2 + xFin + PAS / 2) / 2, z: zBas, ligne: p.lignes[0], texte: "", profondeur, decor: true });
      }
      sortie.voies.push({ x: x + PAS, z, libelle: p.type === "pour" ? "un élément par tour" : "condition vraie : un tour de plus", couleur: "boucle" });
      sortie.voies.push({ x: x + PAS, z: zBas, libelle: p.type === "pour" ? "plus d'élément : on sort" : "condition fausse : on sort", couleur: "directe" });
      placerListe(p.branches[0], p.corps ? p.corps[0] : null, x + PAS, z, profondeur + 1, { bloc: p, voie: 0 }, { entree: [x + PAS / 2, z], sortie: [xFin + PAS / 2, zBas] });
      return PAS + c.largeur + PAS;
    }
    const saut = sautDe(p);
    if (saut) {
      sortie.machines.push({ ...base, type: saut === "break" ? "sortir" : "suivant", role: "machine", x: x + PAS / 2, z });
      // break : un tube aérien vers la sortie de la boucle ; continue : vers son entrée (le tour suivant)
      if (boucle) sortie.sauts.push({ de: [x + PAS / 2, z], a: saut === "break" ? boucle.sortie : boucle.entree, genre: saut });
      return PAS;
    }
    sortie.machines.push({ ...base, role: p.type === "renvoyer" ? "quai" : "machine", x: x + PAS / 2, z });
    return PAS;
  }

  // Le programme principal se range en rangs : chaque rang se lit de gauche à droite, le tapis revient à la ligne.
  // Les modules (def) ne sont pas sur la ligne : définir une fonction ne la fait pas tourner. Ils ont leur bâtiment, devant.
  function placerRacine(postes, corps) {
    const rangs = [[]]; let w = 0;
    // les éléments de la ligne : les instructions (avec leur rang dans postes, pour les « + »), ou les ateliers des sections
    let elements = postes.map((p, i) => [p, i]).filter(([p]) => p.type !== "module");
    const sections = sectionsDe(postes, code);
    sortie.sections = sections || [];
    if (sections) {
      elements = [];
      for (const x of sections) {
        if (sectionsOuvertes.has(x.id)) elements.push([{ type: "enseigne", id: "enseigne:" + x.id, section: x, lignes: [x.debut, x.debut] }, null], ...x.elements);
        else elements.push([{ type: "section", id: "section:" + x.id, section: x, lignes: [x.debut, x.fin] }, null]);
      }
    }
    elements.forEach(([p, i]) => {
      const l = mesurerPoste(p).largeur;
      if (rangs[rangs.length - 1].length && w + l > LARGEUR_RANG) { rangs.push([]); w = 0; }
      rangs[rangs.length - 1].push([p, i]); w += l;
    });
    let z = 0, largeur = PAS, haut = 0, fin = { x: PAS / 2, z: 0 }, index = 0, precedent = null;
    rangs.forEach((rang, r) => {
      const m = mesurerListe(rang.map(([p]) => p));
      if (r === 0) haut = m.haut;
      else {
        z = precedent.z + precedent.m.bas + ECART_VOIE + 3 + m.haut;
        const zRetour = precedent.z + precedent.m.bas + 2.5;
        sortie.tapis.push({ de: [precedent.m.largeur, precedent.z], par: [[precedent.m.largeur + 1, precedent.z], [precedent.m.largeur + 1, zRetour], [-1, zRetour], [-1, z]], a: [0, z] });
      }
      sortie.tapis.push({ de: [0, z], a: [m.largeur, z] });
      let cx = 0;
      rang.forEach(([p, i]) => {
        if (i !== null) sortie.fentes.push({ x: cx, z, cible: { postes, corps, index: i, contexte: { racine: true } } });
        cx += placerPoste(p, cx, z, 0); index++;
      });
      largeur = Math.max(largeur, m.largeur + 1);
      fin = { x: index ? cx : PAS / 2, z };
      precedent = { z, m };
    });
    const dernier = postes.filter((p) => p.type !== "module").pop();
    if (!dernier || dernier.type !== "renvoyer") sortie.fentes.push({ x: fin.x, z: fin.z, cible: { postes, corps, index: postes.length, contexte: { racine: true } } });
    return { largeur, haut, bas: precedent ? precedent.z + precedent.m.bas : 0, fin };
  }

  const m = placerRacine(analyse.postes, analyse.corps);
  sortie.stations.push({ role: "entree", x: -PAS, z: 0, texte: fonction ? `${fonction.nom}(${(analyse.parametres || fonction.parametres || []).join(", ")})` : "Départ" });
  sortie.tapis.push({ de: [-PAS, 0], a: [0, 0] });
  const principaux = analyse.postes.filter((p) => p.type !== "module");
  const finit = principaux.length && principaux[principaux.length - 1].type === "renvoyer";
  if (!finit) {
    sortie.stations.push({ role: "fin", x: m.fin.x + PAS / 2, z: m.fin.z, texte: fonction ? "Fin sans return : None" : "Fin du programme" });
    sortie.tapis.push({ de: [m.fin.x, m.fin.z], a: [m.fin.x + PAS / 2, m.fin.z] });
  }
  sortie.etendue = { x1: -PAS - 3, x2: m.largeur + PAS, z1: -m.haut - 2, z2: m.bas + 2 };
  // le parc de stockage : un contenant par variable, en rang derrière la ligne, du côté du départ
  // un grand programme : le parc ne montre que les variables des sections ouvertes, 30 au plus (les autres restent dans l'onglet Bacs)
  let variables = variablesDe(analyse, fonction);
  if (sortie.sections && sortie.sections.length) {
    const ouvertes = sortie.sections.filter((x) => sectionsOuvertes.has(x.id)).flatMap((x) => x.elements.map(([p]) => p));
    const noms = new Set(variablesDe({ postes: ouvertes }).map((v) => v.nom));
    variables = variables.filter((v) => noms.has(v.nom));
  }
  sortie.parcReste = Math.max(0, variables.length - 30);
  variables = variables.slice(0, 30);
  // le parc s'intercale entre la ligne et les cuves du décor : l'étendue recule d'autant
  const zParc = sortie.etendue.z1 - 3.6;
  sortie.parc = variables.map((v, i) => ({ ...v, x: -PAS + i * ECART_BACS, z: zParc }));
  if (sortie.parc.length) sortie.etendue.z1 -= 2.4;
  if (sortie.parc.length) sortie.etendue.x2 = Math.max(sortie.etendue.x2, sortie.parc[sortie.parc.length - 1].x + 2);
  const tousModules = [];
  const chercher = (postes) => postes.forEach((p) => { if (p.type === "module") tousModules.push(p); if (p.branches) p.branches.forEach(chercher); });
  chercher(analyse.postes); chercher(analyse.modules || []);
  placerModules(tousModules, m.bas + 7);
  return sortie;

  // ---- les modules (def) : un bâtiment par fonction, devant la ligne ; dedans, sa propre ligne et son propre parc ----
  // Tout ce qui est à l'intérieur porte module: nom (la scène le cache quand le bâtiment est fermé).
  // Fermé, un module n'occupe que sa halle compacte (4,6 x 3,6) et son intérieur n'est pas disposé : les lignes de la fonction
  // renvoient au bâtiment. Ouvert, il prend la place de sa ligne et de son parc. Les modules se rangent en rangées.
  function placerModules(modules, zHaut) {
    const largeurMax = Math.max(40, sortie.etendue.x2 - sortie.etendue.x1);
    let x = -PAS, z = zHaut, profondeurRang = 0;
    modules.forEach((p) => {
      const nom = p.params.nom, corpsListe = p.branches[0], ouvert = modulesOuverts.has(nom);
      const c = mesurerListe(corpsListe);
      const vars = variablesDe({ postes: corpsListe, parametres: p.params.parametres });
      const largeur = ouvert ? Math.max(PAS + c.largeur + PAS, vars.length * ECART_BACS + 1, 6) : 4.6 - 1.2;
      const profondeur = ouvert ? 1.6 + 2.8 + c.haut + c.bas + 2.2 : 3.6;
      if (x > -PAS && x + largeur > -PAS + largeurMax) { x = -PAS; z += profondeurRang + 4; profondeurRang = 0; }
      const zParc = z + 1.6, z0 = ouvert ? zParc + 2.8 + c.haut : z + 2.4, zBas = z + profondeur;
      const xe = x + PAS / 2;
      if (ouvert) {
        const debut = { machines: sortie.machines.length, tapis: sortie.tapis.length, fentes: sortie.fentes.length, zones: sortie.zones.length, voies: sortie.voies.length, sauts: sortie.sauts.length, stations: sortie.stations.length };
        sortie.stations.push({ role: "entree-module", x: xe, z: z0, texte: `${nom}(${p.params.parametres.join(", ")})` });
        sortie.tapis.push({ de: [xe, z0], a: [x + PAS, z0] });
        placerListe(corpsListe, p.corps ? p.corps[0] : null, x + PAS, z0, 1, { bloc: p, voie: 0 }, null);
        if (!finitVoie(corpsListe)) {
          sortie.stations.push({ role: "fin", x: x + PAS + c.largeur + PAS / 2, z: z0, texte: "Fin sans return : None" });
          sortie.tapis.push({ de: [x + PAS + c.largeur, z0], a: [x + PAS + c.largeur + PAS / 2, z0] });
        }
        for (const cle of Object.keys(debut)) sortie[cle].slice(debut[cle]).forEach((o) => { o.module = nom; });
        sortie.parcs[nom] = vars.map((v, i) => ({ ...v, x: x + 1.2 + i * ECART_BACS, z: zParc, module: nom }));
      }
      const boite = { x1: x - 0.6, x2: x + largeur + 0.6, z1: z, z2: zBas };
      sortie.machines.push({ id: p.id, poste: p, type: "module", role: "module", nom, ouvert, parametres: p.params.parametres, ligne: p.lignes[0],
        lignes: p.lignes, texte: `def ${nom}(${p.params.parametres.join(", ")}):`, x: (boite.x1 + boite.x2) / 2, z: (boite.z1 + boite.z2) / 2, boite, entree: [xe, z0] });
      sortie.etendue.z2 = Math.max(sortie.etendue.z2, zBas + 2);
      sortie.etendue.x2 = Math.max(sortie.etendue.x2, boite.x2 + 2);
      x += largeur + 4; profondeurRang = Math.max(profondeurRang, profondeur);
    });
    // les appels : une machine dont la ligne appelle une de ces fonctions devient un poste d'appel, relié au module par un tube
    const noms = modules.map((p) => p.params.nom);
    if (!noms.length) return;
    const motif = new RegExp(`(?<![\\w.])(${noms.join("|")})\\s*\\(`);
    for (const m of sortie.machines) {
      if (m.role === "module" || m.decor || !m.texte) continue;
      const trouve = m.texte.match(motif); if (!trouve) continue;
      const module = sortie.machines.find((x) => x.role === "module" && x.nom === trouve[1]);
      m.appel = trouve[1];
      sortie.liaisons.push({ de: [m.x, m.z], a: module.entree, nom: trouve[1], depuis: m.id, module: m.module || null });
    }
  }
}
