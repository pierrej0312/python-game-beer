// L'usine de la Fonderie : mise en page d'un programme en ligne de production.
// Le stagiaire ne place rien : chaque instruction est une machine, posée de gauche à droite dans l'ordre du code ;
// un if est un répartiteur dont chaque voie est une ligne parallèle ; une boucle est un carrousel avec son anneau.
// Entrée : l'analyse Python (atelier.analyser : postes, corps) et le texte du code. Sortie : machines, tapis, fentes
// (points « + » où insérer une machine), zones au sol. Module sans DOM ni three.js : il se teste seul.

export const PAS = 5;            // une machine occupe PAS unités le long de la ligne
export const ECART_VOIE = 2;     // écart minimal entre deux voies parallèles
export const LARGEUR_RANG = 15;  // au-delà, le programme passe au rang suivant, comme une ligne de texte

// ---- mesure : largeur et débords d'une liste, avant de la placer ----
function mesurerListe(postes) {
  let largeur = 0, haut = 0, bas = 0;
  for (const p of postes) {
    const m = mesurerPoste(p);
    largeur += m.largeur; haut = Math.max(haut, m.haut); bas = Math.max(bas, m.bas);
  }
  return { largeur: Math.max(largeur, PAS), haut, bas };
}

function voiesDe(p) {
  // les voies d'un répartiteur : une par condition, « sinon », et une voie directe si le if n'a pas de else
  const voies = p.branches.map((b, k) => ({ postes: b, corps: p.corps ? p.corps[k] : null, k }));
  if (!p.params.sinon) voies.push({ postes: [], corps: null, k: voies.length, directe: true });
  return voies;
}

function mesurerPoste(p) {
  if (p.type === "si") {
    const voies = voiesDe(p).map((v) => mesurerListe(v.postes));
    const largeur = PAS + Math.max(...voies.map((v) => v.largeur)) + PAS;
    let bas = voies[0].bas;
    for (let k = 1; k < voies.length; k++) bas += ECART_VOIE + voies[k].haut + voies[k].bas;
    return { largeur, haut: voies[0].haut, bas };
  }
  if (p.type === "pour" || p.type === "tantque") {
    const c = mesurerListe(p.branches[0]);
    return { largeur: PAS + c.largeur + PAS, haut: c.haut + ECART_VOIE, bas: c.bas + ECART_VOIE };
  }
  return { largeur: PAS, haut: 0, bas: 0 };
}

// ---- placement ----
export function disposer(analyse, code, { fonction = null } = {}) {
  const lignes = code.split("\n");
  const texteDe = (n) => (lignes[n - 1] || "").trim();
  const sortie = { machines: [], tapis: [], fentes: [], zones: [], voies: [], stations: [] };

  function placerListe(postes, corps, x, z, profondeur, contexte) {
    const m = mesurerListe(postes);
    sortie.tapis.push({ de: [x, z], a: [x + m.largeur, z] });
    let cx = x;
    postes.forEach((p, i) => {
      sortie.fentes.push({ x: cx, z, cible: { postes, corps, index: i, contexte } });
      cx += placerPoste(p, cx, z, profondeur);
    });
    const dernier = postes[postes.length - 1];
    // pas de fente après un return : une machine posée là ne tournerait jamais
    if (!dernier || dernier.type !== "renvoyer") {
      sortie.fentes.push({ x: postes.length ? cx : x + PAS / 2, z, cible: { postes, corps, index: postes.length, contexte } });
    }
    return m;
  }

  function placerPoste(p, x, z, profondeur) {
    const base = { id: p.id, poste: p, type: p.type, ligne: p.lignes[0], texte: texteDe(p.lignes[0]), profondeur };
    if (p.type === "si") {
      const voies = voiesDe(p), mesures = voies.map((v) => mesurerListe(v.postes));
      const largeur = Math.max(...mesures.map((v) => v.largeur));
      const xFin = x + PAS + largeur + PAS / 2;
      sortie.machines.push({ ...base, role: "repartiteur", x: x + PAS / 2, z, voies: voies.length });
      let zv = z;
      voies.forEach((v, k) => {
        if (k > 0) zv += mesures[k - 1].bas + ECART_VOIE + mesures[k].haut;
        const libelle = v.directe ? "aucune condition vraie" : k < p.params.conditions.length ? (k === 0 ? "si " : "sinon si ") + p.params.conditions[k] : "sinon";
        sortie.voies.push({ x: x + PAS, z: zv, libelle, couleur: v.directe ? "directe" : k < p.params.conditions.length ? "vrai" : "sinon" });
        // la voie part du répartiteur et rejoint le groupeur
        sortie.tapis.push({ de: [x + PAS / 2, z], par: [[x + PAS / 2, zv]], a: [x + PAS, zv] });
        sortie.tapis.push({ de: [x + PAS + largeur, zv], par: [[xFin, zv]], a: [xFin, z] });
        sortie.zones.push({ x1: x + PAS - 0.4, z1: zv - mesures[k].haut - 0.8, x2: x + PAS + largeur + 0.4, z2: zv + mesures[k].bas + 0.8, type: "si", profondeur: profondeur + 1 });
        if (v.directe) sortie.tapis.push({ de: [x + PAS, zv], a: [x + PAS + largeur, zv] });
        else placerListe(v.postes, v.corps, x + PAS, zv, profondeur + 1, { bloc: p, voie: k });
      });
      sortie.machines.push({ id: p.id + ":groupeur", poste: p, type: "groupeur", role: "groupeur", x: xFin, z, ligne: p.lignes[0], texte: "", profondeur });
      return PAS + largeur + PAS;
    }
    if (p.type === "pour" || p.type === "tantque") {
      const c = mesurerListe(p.branches[0]);
      const xFin = x + PAS + c.largeur;
      const zHaut = z - c.haut - ECART_VOIE, zBas = z + c.bas + ECART_VOIE;
      sortie.machines.push({ ...base, role: "carrousel", x: x + PAS / 2, z });
      sortie.zones.push({ x1: x + PAS - 0.4, z1: z - c.haut - 0.8, x2: xFin + 0.4, z2: z + c.bas + 0.8, type: "boucle", profondeur: profondeur + 1 });
      // l'anneau : le corps, puis le retour au carrousel par le haut
      sortie.tapis.push({ de: [xFin, z], par: [[xFin, zHaut], [x + PAS / 2, zHaut]], a: [x + PAS / 2, z], retour: true });
      // la sortie de boucle : par le bas, jusqu'à la suite
      sortie.tapis.push({ de: [x + PAS / 2, z], par: [[x + PAS / 2, zBas], [xFin + PAS / 2, zBas]], a: [xFin + PAS / 2, z], fin: true });
      sortie.voies.push({ x: x + PAS, z, libelle: p.type === "pour" ? "à chaque tour" : "tant que vrai", couleur: "boucle" });
      sortie.voies.push({ x: x + PAS, z: zBas, libelle: p.type === "pour" ? "fini" : "faux : on sort", couleur: "directe" });
      placerListe(p.branches[0], p.corps ? p.corps[0] : null, x + PAS, z, profondeur + 1, { bloc: p, voie: 0 });
      return PAS + c.largeur + PAS;
    }
    sortie.machines.push({ ...base, role: p.type === "renvoyer" ? "quai" : "machine", x: x + PAS / 2, z });
    return PAS;
  }

  // Le programme principal se range en rangs : chaque rang se lit de gauche à droite, le tapis revient à la ligne.
  function placerRacine(postes, corps) {
    const rangs = [[]]; let w = 0;
    for (const p of postes) {
      const l = mesurerPoste(p).largeur;
      if (rangs[rangs.length - 1].length && w + l > LARGEUR_RANG) { rangs.push([]); w = 0; }
      rangs[rangs.length - 1].push(p); w += l;
    }
    let z = 0, largeur = PAS, haut = 0, fin = { x: PAS / 2, z: 0 }, index = 0, precedent = null;
    rangs.forEach((rang, r) => {
      const m = mesurerListe(rang);
      if (r === 0) haut = m.haut;
      else {
        z = precedent.z + precedent.m.bas + ECART_VOIE + 3 + m.haut;
        const zRetour = precedent.z + precedent.m.bas + 2.5;
        sortie.tapis.push({ de: [precedent.m.largeur, precedent.z], par: [[precedent.m.largeur + 1, precedent.z], [precedent.m.largeur + 1, zRetour], [-1, zRetour], [-1, z]], a: [0, z] });
      }
      sortie.tapis.push({ de: [0, z], a: [m.largeur, z] });
      let cx = 0;
      rang.forEach((p) => {
        sortie.fentes.push({ x: cx, z, cible: { postes, corps, index, contexte: { racine: true } } });
        cx += placerPoste(p, cx, z, 0); index++;
      });
      largeur = Math.max(largeur, m.largeur + 1);
      fin = { x: postes.length ? cx : PAS / 2, z };
      precedent = { z, m };
    });
    const dernier = postes[postes.length - 1];
    if (!dernier || dernier.type !== "renvoyer") sortie.fentes.push({ x: fin.x, z: fin.z, cible: { postes, corps, index: postes.length, contexte: { racine: true } } });
    return { largeur, haut, bas: precedent ? precedent.z + precedent.m.bas : 0, fin };
  }

  const m = placerRacine(analyse.postes, analyse.corps);
  sortie.stations.push({ role: "entree", x: -PAS, z: 0, texte: fonction ? `${fonction.nom}(${(analyse.parametres || fonction.parametres || []).join(", ")})` : "Départ" });
  sortie.tapis.push({ de: [-PAS, 0], a: [0, 0] });
  const finit = analyse.postes.length && analyse.postes[analyse.postes.length - 1].type === "renvoyer";
  if (!finit) {
    sortie.stations.push({ role: "fin", x: m.fin.x + PAS / 2, z: m.fin.z, texte: fonction ? "Fin sans return : None" : "Fin du programme" });
    sortie.tapis.push({ de: [m.fin.x, m.fin.z], a: [m.fin.x + PAS / 2, m.fin.z] });
  }
  sortie.etendue = { x1: -PAS - 3, x2: m.largeur + PAS, z1: -m.haut - 2, z2: m.bas + 2 };
  return sortie;
}
