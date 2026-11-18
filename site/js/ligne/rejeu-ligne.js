// Jeu 2 : transforme la trace d'exécution (lignes exécutées, une par une) en étapes que la scène rejoue.
// Une étape = un objet (bouteille ou casier) qui arrive à une pièce, avec l'état de la bouteille après le passage.
// Module sans DOM : il se teste avec Node.
import { PIECES } from "./modele.js";

const CORPS = new Set(["corps", "controle", "detecteur", "casier-ajout", "def", "pass"]);

export function etatsInitiaux(niveau) {
  const etats = new Map();
  for (const [source, liste] of Object.entries(niveau.donnees)) {
    for (const b of liste) {
      // les champs « _ » sont des réglages du niveau (dose, cible), invisibles pour le stagiaire
      const visible = Object.fromEntries(Object.entries(b).filter(([c]) => !c.startsWith("_")));
      etats.set(`${source}:${b.numero}`, { ...visible });
    }
  }
  return etats;
}

export function construireEtapes(plateau, gen, resultat, niveau) {
  const trace = resultat.trace || [];
  const pieceDe = (l) => gen.pieces[l - 1] || null;
  const roleDe = (l) => gen.roles[l - 1] || null;
  const etapes = [];
  const vus = new Set();
  // première instruction après la ligne l (les commentaires seuls ne s'exécutent pas)
  const premiereApres = (l) => { let k = l + 1; while (k <= gen.roles.length && (roleDe(k) === "commentaire" || roleDe(k) === "trappe")) k++; return k; };
  const initiaux = etatsInitiaux(niveau);
  let machineCourante = null, courant = null, sorties = 0, initFaite = false;

  // pièces en aval d'une mise en casiers : ce sont des casiers qui y circulent
  const avalCasiers = new Map();
  for (const p of plateau.pieces.filter((q) => q.type === "casiers")) {
    let id = plateau.suivant(p.id, "pleins");
    while (id && !avalCasiers.has(id)) { avalCasiers.set(id, p.id); id = plateau.suivant(id, "suite"); }
  }
  const carrousels = new Map();      // id de mise en casiers -> { bouteilles: [clés], numero de casier }

  const derniere = () => etapes[etapes.length - 1];
  const ajouter = (e) => {
    const d = derniere();
    if (d && d.type === "piece" && e.type === "piece" && d.piece === e.piece && d.cle === e.cle) { Object.assign(d, e, { lignes: [...d.lignes, ...e.lignes] }); return d; }
    etapes.push(e); return e;
  };

  for (let i = 0; i < trace.length; i++) {
    const ev = trace[i], role = roleDe(ev.l);
    let pid = pieceDe(ev.l);
    if (role === "def") { pid = machineCourante; if (!pid) continue; }
    if (!pid) continue;
    const p = plateau.piece(pid);
    if (!p) continue;

    if (role === "init") {
      if (initFaite) continue;
      initFaite = true;
      const etiquettes = [];
      for (const q of plateau.pieces) {
        if (q.type === "compteur") etiquettes.push([q.id, `${q.params.nom} = 0`]);
        if (q.type === "casiers") etiquettes.push([q.id, `Casiers de ${q.params.taille} · 0`]);
      }
      etapes.push({ type: "init", etiquettes, lignes: [ev.l] });
      continue;
    }
    if (role === "source") {
      const suivant = trace[i + 1];
      if (suivant && suivant.b && CORPS.has(roleDe(suivant.l)) && !vus.has(suivant.b)) {
        vus.add(suivant.b); courant = suivant.b;
        etapes.push({ type: "apparition", piece: pid, cle: suivant.b, etat: { ...(initiaux.get(suivant.b) || {}) }, lignes: [ev.l] });
      }
      continue;
    }
    if (role === "print") { etapes.push({ type: "print", piece: pid, texte: `print(${p.params.bac}) : ${resultat.sortie[sorties] ?? ""}`, lignes: [ev.l] }); sorties += 1; continue; }
    if (role === "casier-test" || role === "casier-vider" || role === "else" || role === "pass" || role === "trappe") continue;

    if (role === "casier-ajout") {
      const c = carrousels.get(pid) || { bouteilles: [], numero: 0 };
      carrousels.set(pid, c);
      c.bouteilles.push(ev.b);
      ajouter({ type: "piece", piece: pid, cle: ev.b, rang: c.bouteilles.length - 1, etiquette: `Casiers de ${p.params.taille} · ${c.bouteilles.length}`, lignes: [ev.l] });
      if (c.bouteilles.length >= p.params.taille) {
        // le casier plein part : la ligne suivante (if len(...) == taille) est vraie
        c.numero += 1;
        const cleCasier = `casier:${pid}:${c.numero}`;
        etapes.push({ type: "casier", piece: pid, cle: cleCasier, taille: p.params.taille, bouteilles: c.bouteilles.splice(0), texteEtiquette: `Casiers de ${p.params.taille} · 0`, lignes: [ev.l] });
      }
      continue;
    }

    // une pièce du corps de la boucle
    if (p.type === "machine") machineCourante = pid;
    const casiers = avalCasiers.get(pid);
    const cle = casiers ? `casier:${casiers}:${carrousels.get(casiers)?.numero || 0}` : ev.b;
    if (!cle) continue;
    courant = cle;
    const etape = { type: "piece", piece: pid, cle, lignes: [ev.l] };
    if (p.type === "compteur") etape.etiquette = `${p.params.nom} = ${(Number(ev.v?.[p.params.nom]) || 0) + 1}`;
    if (p.type === "controle" || p.type === "detecteur") {
      // condition vraie : la ligne exécutée juste après est la première du bloc (if ou while)
      const suivant = trace[i + 1];
      etape.vrai = Boolean(suivant && suivant.l === premiereApres(ev.l));
      const cond = `${p.params.champ} ${p.params.comparateur} ${p.params.champ === "volume_cl" ? p.params.valeur : JSON.stringify(p.params.valeur)}`;
      etape.etiquette = p.type === "controle" ? `${cond} : ${etape.vrai ? "oui" : "non"}` : `${cond} : ${etape.vrai ? "encore un tour" : "sortie"}`;
    }
    if (role === "def") etape.type = "piece";
    ajouter(etape);
  }

  // l'erreur : la bouteille s'arrête sur la pièce qui l'a refusée
  if (resultat.erreur && resultat.erreur.ligne) {
    let pid = pieceDe(resultat.erreur.ligne);
    if (roleDe(resultat.erreur.ligne) === "def") pid = machineCourante;
    if (pid && courant) etapes.push({ type: "erreur", piece: pid, cle: courant, lignes: [resultat.erreur.ligne] });
  }

  // états des bouteilles : chaque geste de machine du journal s'applique à l'étape de sa bouteille sur sa pièce
  const pieceDuGeste = (j) => { const r = roleDe(j.ligne); return r === "def" ? "machine" : pieceDe(j.ligne); };
  const etapesParCle = new Map();
  for (const e of etapes) if (e.cle && (e.type === "piece" || e.type === "erreur")) { if (!etapesParCle.has(e.cle)) etapesParCle.set(e.cle, []); etapesParCle.get(e.cle).push(e); }
  const curseur = new Map();
  for (const j of resultat.journal || []) {
    if (!j.cle || !["remplir", "capsuler", "etiqueter"].includes(j.action)) continue;
    const liste = etapesParCle.get(j.cle) || [];
    let k = curseur.get(j.cle) || 0;
    const cible = pieceDuGeste(j);
    // une machine fait plusieurs gestes au même passage ; une pièce simple, un geste par passage (l'anneau repasse plusieurs fois)
    const convient = (e) => (cible === "machine" ? plateau.piece(e.piece)?.type === "machine" && !(e.gestes || []).some((g) => g.action === j.action) : e.piece === cible);
    while (k < liste.length && !convient(liste[k])) k++;
    if (k < liste.length) { (liste[k].gestes ||= []).push(j); curseur.set(j.cle, cible === "machine" ? k : k + 1); }
  }
  for (const [cle, liste] of etapesParCle) {
    const etat = { ...(initiaux.get(cle) || {}) };
    for (const e of liste) {
      for (const g of e.gestes || []) {
        if (g.action === "remplir") etat.volume_cl = g.volume_cl;
        if (g.action === "capsuler") etat.capsule = true;
        if (g.action === "etiqueter") etat.etiquette = g.etiquette;
      }
      if (!cle.startsWith("casier:")) e.etat = { ...etat };
    }
  }

  // la trappe : un objet dont le chemin s'arrête sans quai, sans benne et sans carrousel tombe au bout de son tapis
  const derniereDe = new Map(), enErreur = new Set();
  etapes.forEach((e, k) => {
    if (!e.cle) return;
    if (e.type === "erreur") enErreur.add(e.cle);
    if (e.type === "apparition" || e.type === "piece" || e.type === "casier") derniereDe.set(e.cle, k);
  });
  const chutes = [];
  for (const [cle, k] of derniereDe) {
    if (enErreur.has(cle)) continue;
    if (resultat.traceTronquee && k === etapes.length - 1) continue;
    const e = etapes[k], p = plateau.piece(e.piece);
    if (!p) continue;
    if (e.type === "piece" && ["quai", "rebut", "casiers"].includes(p.type)) continue;
    let sortie = "suite";
    if (e.type === "casier") sortie = "pleins";
    else if (p.type === "controle") sortie = e.vrai ? "oui" : "non";
    else if (p.type === "detecteur") sortie = e.vrai ? "encore" : "sortie";
    chutes.push([k, { type: "chute", piece: p.id, sortie, cle, etat: e.etat ? { ...e.etat } : undefined, lignes: e.lignes }]);
  }
  for (const [k, c] of chutes.sort((a, b) => b[0] - a[0])) etapes.splice(k + 1, 0, c);
  return etapes;
}

// Pièce à allumer et ligne à surligner pour une étape.
export function ligneDe(etape) { return etape.lignes && etape.lignes.length ? etape.lignes[0] : null; }

// Description d'une étape, pour le mode sans 3D et la légende.
export function decrireEtape(e, plateau) {
  const p = e.piece ? plateau.piece(e.piece) : null, nom = p ? PIECES[p.type].nom : "";
  const plusieursSources = plateau.pieces.filter((q) => PIECES[q.type].source).length > 1;
  const objet = e.cle && e.cle.startsWith("casier:") ? `Casier ${e.cle.split(":")[2]}` : e.cle ? `Bouteille ${e.cle.split(":")[1]}${plusieursSources && e.cle.startsWith("C") ? " de la cuve " + e.cle.split(":")[0] : ""}` : "";
  switch (e.type) {
    case "init": return "Les bacs partent de 0.";
    case "apparition": return `${objet} sort ${p.type === "cuve" ? "de la cuve " + p.params.cuve : "du stock"}.`;
    case "casier": return `Casier ${e.cle.split(":")[2]} plein : il quitte le carrousel.`;
    case "print": return `Tableau de bord : ${e.texte.split(" : ").slice(1).join(" : ")}`;
    case "erreur": return `${objet} : ${nom.toLowerCase()} s'arrête sur une erreur.`;
    case "chute": return `${objet} tombe dans la trappe : aucun tapis ne la mène plus loin.`.replace("la mène", objet.startsWith("Casier") ? "le mène" : "la mène");
    default: {
      if (!p) return objet;
      if (p.type === "quai") return `${objet} monte dans le camion du quai ${p.params.quai}.`;
      if (p.type === "rebut") return `${objet} tombe dans la benne du rebut.`;
      if (p.type === "controle") return `${objet} passe au contrôle : ${e.etiquette}.`;
      if (p.type === "detecteur") return `${objet} passe au détecteur : ${e.etiquette}.`;
      if (p.type === "compteur") return `${objet} passe par le bac : ${e.etiquette}.`;
      if (p.type === "casiers") return `${objet} entre dans le carrousel : ${e.etiquette.split(" · ")[1]} bouteille(s).`;
      if (p.type === "machine") return `${objet} passe dans votre machine ${plateau.machine.nom}.`;
      return `${objet} passe à ${PIECES[p.type].art}.`;
    }
  }
}
