// Jeu 2 : la ligne de production. Carte des niveaux, construction du plateau, Python généré, exécution, rejeu, étoiles.
import * as progression from "../commun/progression.js";
import { PilotePython } from "../commun/python.js";
import { creerEditeur } from "../commun/editeur.js";
import * as sons from "../commun/sons.js";
import { envoyer } from "../commun/resultat.js";
import { Plateau, PIECES, CHAMPS, COMPARATEURS, TAILLES_CASIER, ETAPES_MACHINE, LIBELLES_SORTIES, verifierNom, Art } from "./modele.js";
import { generer } from "./generateur.js";
import { etoiles, mesure } from "./etoiles.js";
import { construireEtapes, decrireEtape, ligneDe } from "./rejeu-ligne.js";
import { creerVue2D } from "./vue2d.js";

// ----- Réglages (modifiables par le formateur) -----
const ECHECS_AVANT_INDICE = [2, 4];                  // lancements en échec avant l'indice 1, puis l'indice 2
const ESSAIS_A_REVOIR = 5;                           // au-delà, un niveau sans étoile 1 est signalé « à revoir » dans l'envoi
const ACCELERATION = [[3, 1], [6, 0.5], [Infinity, 0.16]];   // [jusqu'à la bouteille n, facteur de durée] : les premières bouteilles vont lentement
const FACTEUR_RAPIDE = 0.33;
const FORMULAIRE = "resultat-ligne";
const TOUT_OUVERT = new URLSearchParams(location.search).has("formateur");

const $ = (id) => document.getElementById(id);
const etat = { index: null, cache: new Map(), niveau: null, tests: "", plateau: null, outil: "selection", selection: null, vue: null,
  editeur: null, generation: null, resultat: null, etoilesDernieres: null, etapes: [], curseur: 0, enCours: false, rapide: false, rejeuTermine: false, indicesVus: 0, occupe: false };

const pilote = new PilotePython((nom) => {
  const e = $("etat-python");
  if (nom === "pret") { e.textContent = "Python est prêt"; e.className = "etat-python pret"; }
  if (nom === "chargement") { e.textContent = "Préparation de Python…"; e.className = "etat-python"; }
  if (nom === "echec") { e.textContent = "Python n'a pas pu se charger sur ce poste. Rechargez la page ; si le problème continue, prévenez le formateur."; e.className = "etat-python echec"; }
});

function creer(balise, classe, texte) { const e = document.createElement(balise); if (classe) e.className = classe; if (texte !== undefined) e.textContent = texte; return e; }

function dessinerEtoiles(conteneur, liste) {
  conteneur.innerHTML = "";
  liste.forEach((gagnee) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("class", "etoile" + (gagnee ? " gagnee" : "")); svg.setAttribute("aria-hidden", "true");
    const chemin = document.createElementNS("http://www.w3.org/2000/svg", "path");
    chemin.setAttribute("d", "M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z");
    svg.appendChild(chemin); conteneur.appendChild(svg);
  });
  conteneur.setAttribute("aria-label", `${liste.filter(Boolean).length} étoile(s) sur 3`);
}

const ouvert = (numero) => TOUT_OUVERT || numero === 1 || progression.fiche("ligne-" + (numero - 1)).etoiles[0];

// ---------- carte des niveaux ----------
function afficherCarte() {
  arreterRejeu();
  $("vue-niveau").hidden = true; $("vue-carte").hidden = false;
  document.title = "La ligne de production de la Brasserie de la Fonderie";
  const p = progression.lire();
  $("bouton-qualite").textContent = "Qualité : " + (p.qualite === "basse" ? "basse" : "haute");
  $("bouton-sans3d").textContent = p.sans3d ? "Mode : sans 3D" : "Mode : 3D";
  const zone = $("niveaux"); zone.innerHTML = "";
  for (const n of etat.index.niveaux) {
    const b = creer("button", "carte-niveau"); b.type = "button"; b.disabled = !ouvert(n.numero);
    const e = creer("span", "etoiles"); dessinerEtoiles(e, progression.fiche(n.id).etoiles);
    b.append(creer("span", "niveau-numero", "Niveau " + n.numero), creer("span", "niveau-titre", n.titre), creer("span", "niveau-notion", n.notion), e);
    if (b.disabled) b.append(creer("span", "niveau-ferme", `S'ouvre quand le niveau ${n.numero - 1} est réussi`));
    b.addEventListener("click", () => { location.hash = "niveau=" + n.id; });
    zone.append(b);
  }
}

// ---------- ouverture d'un niveau ----------
async function chargerNiveau(id) {
  if (!etat.cache.has(id)) {
    const base = `ligne/niveaux/${id}/`;
    const [niveau, tests] = await Promise.all([fetch(base + "niveau.json").then((r) => r.json()), fetch(base + "tests.py").then((r) => r.text())]);
    etat.cache.set(id, { niveau, tests });
  }
  return etat.cache.get(id);
}

async function ouvrirNiveau(id) {
  const fiche = etat.index.niveaux.find((n) => n.id === id);
  if (!fiche || !ouvert(fiche.numero)) { location.hash = ""; return; }
  arreterRejeu();
  const { niveau, tests } = await chargerNiveau(id);
  const sauve = progression.fiche(id).code;
  let graphe = null;
  try { graphe = sauve ? JSON.parse(sauve) : null; } catch (e) { graphe = null; }
  Object.assign(etat, { niveau, tests, plateau: new Plateau(niveau, graphe), outil: "selection", selection: null, resultat: null, etapes: [], curseur: 0, rejeuTermine: false });
  $("vue-carte").hidden = true; $("vue-niveau").hidden = false;
  document.querySelector(".bilan")?.remove();
  document.title = `Niveau ${niveau.numero} · ${niveau.titre}`;
  $("niveau-id").textContent = "NIVEAU " + niveau.numero;
  $("niveau-surtitre").textContent = `Niveau ${niveau.numero} · ${niveau.notion}`;
  $("niveau-titre").textContent = niveau.titre;
  $("niveau-enonce").textContent = niveau.enonce;
  if (!etat.editeur) etat.editeur = creerEditeur($("editeur"), { lectureSeule: true, libelle: "Python de votre ligne, en lecture seule", surExecuter: lancer });
  etat.indicesVus = indicesDebloques();
  construirePalette();
  await preparerVue();
  etat.onglet = "tests";
  majTout();
  legende(`Choisissez une pièce dans la barre au-dessus du hall, puis cliquez sur une case libre. Réussi si : ${niveau.reussiSi}`);
}

async function preparerVue() {
  const p = progression.lire();
  if (etat.vue) return;
  const surCase = (type, x, z, e) => interagir(type, x, z, e);
  if (!p.sans3d) {
    try {
      const { creerSceneLigne } = await import("./scene-ligne.js");
      etat.vue = creerSceneLigne($("vue"), { qualite: p.qualite === "basse" ? "basse" : "haute", surCase });
      etat.vue.surLenteur = () => avis("L'affichage est lent sur ce poste.", "Passer en qualité basse", () => { progression.reglage("qualite", "basse"); changerVue(); });
      etat.mode3d = true;
    } catch (erreur) { console.warn("La 3D n'a pas pu démarrer : passage au plateau sans 3D.", erreur); etat.vue = null; }
  }
  if (!etat.vue) { etat.vue = creerVue2D($("vue"), { surCase }); etat.mode3d = false; }
  etat.vue.vitesse = 1;
}

function detruireVue() { arreterRejeu(); if (etat.vue) etat.vue.detruire(); etat.vue = null; }
async function changerVue() { detruireVue(); if (etat.niveau) { await preparerVue(); majTout(); } }

function avis(texte, libelle, action) {
  document.querySelector(".avis")?.remove();
  const bandeau = creer("div", "avis"); bandeau.setAttribute("role", "status");
  bandeau.append(creer("span", "", texte));
  if (libelle) { const b = creer("button", "bouton", libelle); b.type = "button"; b.addEventListener("click", () => { bandeau.remove(); action(); }); bandeau.append(b); }
  const fermer = creer("button", "bouton discret", "Fermer"); fermer.type = "button"; fermer.addEventListener("click", () => bandeau.remove()); bandeau.append(fermer);
  $("vue").append(bandeau);
}

function legende(texte, echec = false) { const z = $("legende"); z.textContent = texte; z.classList.toggle("echec", echec); }

// ---------- palette d'outils ----------
const OUTILS = [["selection", "Choisir", "Cliquez sur une pièce pour la régler"], ["tapis", "Tapis", "Appuyez sur une pièce, glissez case par case, relâchez sur la pièce suivante"], ["retirer", "Retirer", "Cliquez sur une pièce ou un tapis pour le retirer"]];

function construirePalette() {
  const zone = $("palette"); zone.innerHTML = "";
  const groupe = (titre) => { const g = creer("div", "groupe-outils"); g.append(creer("span", "titre-groupe", titre)); zone.append(g); return g; };
  const g1 = groupe("Outils");
  for (const [id, nom, aide] of OUTILS) g1.append(boutonOutil(id, nom, aide));
  const g2 = groupe("Pièces");
  for (const type of etat.niveau.palette) g2.append(boutonOutil(type, PIECES[type].nom, `En Python : ${PIECES[type].python}`));
  if (etat.niveau.palette.includes("machine")) {
    const b = creer("button", "bouton outil machine-def", "Créer la machine"); b.type = "button";
    b.addEventListener("click", ouvrirMachine); g2.append(b);
  }
}

function boutonOutil(id, nom, aide) {
  const b = creer("button", "bouton outil", nom); b.type = "button"; b.dataset.outil = id; b.title = aide;
  b.setAttribute("aria-pressed", String(etat.outil === id));
  b.addEventListener("click", () => choisirOutil(id));
  return b;
}

function choisirOutil(id) {
  etat.outil = id; etat.plateau.annulerTrace();
  for (const b of document.querySelectorAll("#palette [data-outil]")) b.setAttribute("aria-pressed", String(b.dataset.outil === id));
  const aides = { selection: "Cliquez sur une pièce pour la régler.", tapis: "Appuyez sur la pièce de départ, glissez case par case, relâchez sur la pièce d'arrivée. Relâché ailleurs, le tapis reste ouvert : une trappe au bout. Échap annule.", retirer: "Cliquez sur une pièce ou un morceau de tapis pour le retirer." };
  legende(aides[id] || `Cliquez sur une case libre pour poser : ${PIECES[id].art}. En Python : ${PIECES[id].python}.`);
  dessiner();
}

// ---------- interactions avec le plateau ----------
let derniereCase = null, aGlisse = false;
function interagir(type, x, z) {
  if (etat.enCours) { if (type === "appui") legende("La ligne tourne : attendez la fin du rejeu, ou cliquez sur Pause."); return; }
  const pl = etat.plateau;
  if (type === "survol") return;
  if (etat.outil === "tapis") {
    if (type === "appui") {
      aGlisse = false;
      const fin = pl.trace && pl.trace.cases.length ? pl.trace.cases[pl.trace.cases.length - 1] : null;
      // un deuxième clic sur la dernière case : le tapis reste ouvert
      if (fin && fin[0] === x && fin[1] === z) { ouvert(); return; }
      if (pl.trace) { reponse(pl.ajouter(x, z)); }
      else { const r = pl.commencer(x, z); if (r.erreur) legende(r.erreur, true); else { derniereCase = [x, z]; legende(`Tapis depuis ${PIECES[pl.piece(r.trace.de).type].art}${LIBELLES_SORTIES[r.trace.sortie] ? ` (sortie « ${LIBELLES_SORTIES[r.trace.sortie]} »)` : ""} : glissez jusqu'à la pièce suivante. Pour un tapis ouvert, relâchez sur une case vide.`); dessiner(); } }
      return;
    }
    if (type === "glisse" && pl.trace) {
      if (derniereCase && derniereCase[0] === x && derniereCase[1] === z) return;
      // souris rapide : on comble les cases sautées en ligne droite (d'abord en x, puis en z)
      const depart = pl.trace.cases.length ? pl.trace.cases[pl.trace.cases.length - 1] : pl.trace.depart;
      const pas = [];
      let [cx, cz] = depart;
      while (cx !== x) { cx += Math.sign(x - cx); pas.push([cx, cz]); }
      while (cz !== z) { cz += Math.sign(z - cz); pas.push([cx, cz]); }
      for (const [a, b] of pas) { const r = pl.ajouter(a, b); if (r.erreur) { legende(r.erreur, true); break; } if (r.tapis) { fin(r); return; } aGlisse = true; }
      derniereCase = [x, z]; dessiner();
      return;
    }
    if (type === "relache" && pl.trace) {
      // glissé puis relâché sur une case vide : le tapis s'arrête là, ouvert
      if (aGlisse && pl.trace.cases.length) { aGlisse = false; ouvert(); return; }
      if (pl.trace.cases.length) legende("Continuez le tapis case par case jusqu'à une pièce. Un deuxième clic sur la dernière case le laisse ouvert ; Échap l'annule.");
      dessiner();
    }
    return;
  }
  if (type !== "appui") return;
  if (etat.outil === "retirer") { const r = pl.supprimer(x, z); if (r.erreur) legende(r.erreur, true); else { sons.jouer("clic"); if (r.supprime.id === etat.selection) etat.selection = null; majTout(); } return; }
  if (etat.outil === "selection") { const p = pl.pieceEn(x, z); etat.selection = p ? p.id : null; if (p) etat.onglet = "piece"; majTout(); if (p) legende(`${PIECES[p.type].nom} : en Python, ${PIECES[p.type].python}. Ses réglages sont dans l'onglet Pièce.`); return; }
  const r = pl.poser(etat.outil, x, z);
  if (r.erreur) { legende(r.erreur, true); return; }
  sons.jouer("clic"); etat.selection = r.piece.id; if (PIECES[r.piece.type].reglages) etat.onglet = "piece"; majTout();
  legende(`${PIECES[r.piece.type].nom} posée. Reliez-la avec l'outil Tapis${PIECES[r.piece.type].reglages ? " ; ses réglages sont dans l'onglet Pièce" : ""}.`);

  function reponse(r) { if (r.erreur) legende(r.erreur, true); else if (r.tapis) fin(r); else dessiner(); }
  function fin() { sons.jouer("clic"); legende("Tapis posé. Le code à droite suit le nouveau chemin des bouteilles."); majTout(); }
  function ouvert() {
    const r = pl.terminerOuvert();
    if (r.erreur) { legende(r.erreur, true); return; }
    sons.jouer("clic"); majTout();
    legende("Tapis ouvert posé : au bout, une trappe. Les bouteilles qui le prennent y tomberont. Pour le prolonger, retirez-le et retracez-le.");
  }
}

// ---------- tout remettre à jour après un changement du plateau ----------
function dessiner() {
  if (!etat.vue || !etat.plateau) return;
  etat.vue.dessiner(etat.plateau, { selection: etat.selection, problemes: etat.problemesAffiches || [], trace: etat.plateau.trace });
}

function majTout() {
  const pl = etat.plateau;
  etat.resultat = null; etat.etapes = []; etat.curseur = 0;
  progression.sauverCode(etat.niveau.id, JSON.stringify(pl.exporter()));
  etat.problemes = pl.valider();
  etat.problemesAffiches = etat.afficherProblemes ? etat.problemes.filter((q) => q.bloquant) : [];
  etat.generation = generer(pl);
  etat.editeur.ecrire(etat.generation.code);
  dessiner();
  majObjectifs();
  afficherOnglet(etat.onglet || "tests");
}

function majObjectifs() {
  const n = etat.niveau, f = progression.fiche(n.id), e = n.etoiles;
  dessinerEtoiles($("niveau-etoiles"), f.etoiles);
  const liste = $("niveau-objectifs"); liste.innerHTML = "";
  [e.description1, e.description2, e.description3].forEach((texte, i) => {
    const li = creer("li", f.etoiles[i] ? "gagnee" : "");
    const marque = creer("span", "etoiles"); dessinerEtoiles(marque, [f.etoiles[i]]); marque.removeAttribute("aria-label");
    li.append(marque, creer("span", "", `Étoile ${i + 1}${f.etoiles[i] ? " gagnée" : ""} : ${texte}`));
    liste.append(li);
  });
  const m = mesure(n, etat.plateau);
  $("mesure").textContent = e.critere === "pieces" ? `Pièces posées : ${m} (étoile 2 : ${e.max} au plus)` : `Cases de tapis : ${m} (étoile 2 : ${e.max} au plus)`;
  $("mesure").classList.toggle("depasse", m > e.max);
}

// ---------- réglages de la pièce choisie ----------
// Les réglages s'affichent dans l'onglet « Pièce » : un cadre posé sur le hall cacherait des cases du plateau.
function majReglages() {
  if (etat.onglet === "piece") afficherOnglet("piece");
}

function dessinerReglages(zone) {
  zone.classList.add("reglages");
  const p = etat.selection ? etat.plateau.piece(etat.selection) : null;
  if (!p) { zone.append(creer("p", "vide", "Choisissez l'outil « Choisir », puis cliquez sur une pièce du hall pour la régler.")); return; }
  const c = PIECES[p.type], n = etat.niveau;
  zone.append(creer("h2", "", c.nom), creer("p", "python", `En Python : ${c.python}`));
  const choix = (libelle, valeurs, actuelle, surChoix, texteDe = (v) => String(v)) => {
    const l = creer("label", "reglage"); l.append(creer("span", "", libelle));
    const s = document.createElement("select");
    if (actuelle === null || actuelle === undefined || actuelle === "") { const o = creer("option", "", "Choisir…"); o.value = ""; o.disabled = true; o.selected = true; s.append(o); }
    for (const v of valeurs) { const o = creer("option", "", texteDe(v)); o.value = JSON.stringify(v); if (v === actuelle) o.selected = true; s.append(o); }
    s.addEventListener("change", () => { surChoix(JSON.parse(s.value)); });
    l.append(s); zone.append(l); return s;
  };
  if (p.type === "etiqueteuse" || (p.type === "machine" && etat.plateau.machine.etapes.includes("etiqueter")))
    choix("Bière à étiqueter", n.bieres, p.params.biere, (v) => { etat.plateau.regler(p.id, { biere: v }); majTout(); });
  if (p.type === "compteur") {
    const l = creer("label", "reglage"); l.append(creer("span", "", "Nom du bac (nom de variable)"));
    const champ = document.createElement("input"); champ.type = "text"; champ.value = p.params.nom || ""; champ.maxLength = 30; champ.autocomplete = "off"; champ.spellcheck = false;
    const message = creer("p", "message-erreur");
    champ.addEventListener("input", () => { message.textContent = verifierNom(champ.value.trim()) || ""; });
    champ.addEventListener("change", () => { etat.plateau.regler(p.id, { nom: champ.value.trim() }); majTout(); });
    l.append(champ); zone.append(l, message);
    message.textContent = verifierNom(p.params.nom) || "";
  }
  if (p.type === "controle" || p.type === "detecteur") {
    const champs = n.champs || Object.keys(CHAMPS);
    choix("Ce qu'on mesure", champs, p.params.champ, (v) => { etat.plateau.regler(p.id, { champ: v, valeur: null, comparateur: v === "biere" ? "==" : p.params.comparateur }); majTout(); }, (v) => `${CHAMPS[v]} : bouteille["${v}"]`);
    const comparateurs = p.params.champ === "biere" ? ["==", "!="] : COMPARATEURS;
    choix("Comparaison", comparateurs, p.params.comparateur, (v) => { etat.plateau.regler(p.id, { comparateur: v }); majTout(); });
    choix("Valeur", (n.valeurs || {})[p.params.champ] || [], p.params.valeur, (v) => { etat.plateau.regler(p.id, { valeur: v }); majTout(); });
    zone.append(creer("p", "aide", p.type === "controle" ? "Sortie « oui » : la condition est vraie (if). Sortie « non » : elle est fausse (else)."
      : "Sortie « encore un tour » : la condition est vraie, la bouteille refait le tour de l'anneau (while). Sortie « sortie » : elle est fausse, la bouteille quitte l'anneau."));
  }
  if (p.type === "casiers") choix("Bouteilles par casier", TAILLES_CASIER, p.params.taille, (v) => { etat.plateau.regler(p.id, { taille: v }); majTout(); });
  if (p.type === "tableau") {
    const bacs = etat.plateau.bacs();
    if (!bacs.length) zone.append(creer("p", "aide", "Posez d'abord un bac compteur : le tableau de bord affiche sa valeur."));
    else choix("Bac à afficher", bacs, p.params.bac, (v) => { etat.plateau.regler(p.id, { bac: v }); majTout(); });
  }
  if (p.type === "machine") zone.append(creer("p", "aide", `Étapes : ${etat.plateau.machine.etapes.map((e) => ETAPES_MACHINE[e]).join(", ") || "aucune"}. Pour les changer : « Créer la machine ».`));
  if (p.type === "cuve") zone.append(creer("p", "aide", `Cuve ${p.params.cuve} : ${n.donnees[p.params.cuve]?.length || 0} bouteilles de ${n.donnees[p.params.cuve]?.[0]?.biere || ""}.`));
  if (p.type === "stock") zone.append(creer("p", "aide", `${n.donnees.stock?.length || 0} bouteilles attendent ici.`));
  const problemes = etat.problemes.filter((q) => q.id === p.id);
  for (const q of problemes) zone.append(creer("p", q.bloquant ? "message-erreur" : "message-avertissement", q.message));
  if (!p.fixe) {
    const b = creer("button", "bouton discret", "Retirer cette pièce"); b.type = "button";
    b.addEventListener("click", () => { etat.plateau.supprimer(p.x, p.z); etat.selection = null; majTout(); });
    zone.append(b);
  } else zone.append(creer("p", "aide", "Cette pièce fait partie du niveau."));
}

// ---------- la machine (niveau 6) ----------
function ouvrirMachine() {
  const d = $("dialogue-machine"), m = etat.plateau.machine;
  $("machine-nom").value = m.nom; $("machine-erreur").textContent = "";
  const zone = $("machine-etapes"); zone.innerHTML = "";
  for (let i = 0; i < 3; i++) {
    const l = creer("label", "reglage"); l.append(creer("span", "", `Étape ${i + 1}`));
    const s = document.createElement("select"); s.dataset.etape = i;
    for (const [v, t] of [["", "aucune"], ...Object.entries(ETAPES_MACHINE)]) { const o = creer("option", "", t); o.value = v; if ((m.etapes[i] || "") === v) o.selected = true; s.append(o); }
    l.append(s); zone.append(l);
  }
  d.hidden = false; $("machine-nom").focus();
}

function validerMachine() {
  const nom = $("machine-nom").value.trim(), erreur = verifierNom(nom);
  const etapes = [...document.querySelectorAll("#machine-etapes select")].map((s) => s.value).filter(Boolean);
  if (erreur) { $("machine-erreur").textContent = erreur.replace("au bac", "à la machine").replace("nom de variable", "nom de fonction").replace("nb_bouteilles", "conditionner"); return; }
  if (new Set(etapes).size !== etapes.length) { $("machine-erreur").textContent = "Chaque étape ne s'utilise qu'une fois dans la machine."; return; }
  if (!etapes.length) { $("machine-erreur").textContent = "Choisissez au moins une étape."; return; }
  etat.plateau.machine = { nom, etapes };
  $("dialogue-machine").hidden = true;
  majTout();
  legende(`Machine ${nom} enregistrée. Posez-la avec la pièce « Votre machine ».`);
}

// ---------- onglets ----------
const indicesDebloques = () => { const e = progression.fiche(etat.niveau.id).echecs || 0; return ECHECS_AVANT_INDICE.filter((s) => e >= s).length; };

function afficherOnglet(nom) {
  etat.onglet = nom;
  for (const b of document.querySelectorAll(".onglet")) { b.setAttribute("aria-selected", String(b.dataset.onglet === nom)); if (b.dataset.onglet === nom) b.classList.remove("nouveau"); }
  const panneau = $("panneau"); panneau.innerHTML = "";
  const r = etat.resultat;
  panneau.classList.remove("reglages");
  if (nom === "piece") { dessinerReglages(panneau); majResume(); return; }
  if (nom === "tests") {
    if (!r) { panneau.append(creer("p", "vide", `Lancez la ligne pour passer les tests. Réussi si ${etat.niveau.reussiSi}`)); $("resume-tests").textContent = ""; return; }
    for (const t of r.tests) {
      const ligne = creer("div", "test " + (t.ok ? "ok" : "echec"));
      const texte = creer("div"); texte.append(t.libelle);
      if (t.groupe === "bonus") texte.append(creer("span", "groupe", "Brassin du lendemain"));
      if (!t.ok && t.message) texte.append(creer("span", "detail", t.message));
      ligne.append(creer("span", "marque", t.ok ? "OK" : "ÉCHEC"), texte); panneau.append(ligne);
    }
    if (!r.tests.length) panneau.append(creer("p", "vide", "Aucun test n'a pu tourner : regardez l'onglet Problèmes."));
  } else if (nom === "sortie") {
    if (r && r.sortie.length) panneau.append(creer("pre", "sortie", r.sortie.join("\n")));
    else panneau.append(creer("p", "vide", "Le tableau de bord affiche ici ce que le print() de votre ligne écrit."));
  } else if (nom === "problemes") {
    const liste = etat.problemes;
    if (r && r.erreur) panneau.append(creer("p", "erreur-original", r.erreur.messageOriginal + (r.erreur.ligne ? `  (ligne ${r.erreur.ligne})` : "")), creer("p", "erreur-conseil", r.erreur.conseil));
    if (!liste.length && !(r && r.erreur)) panneau.append(creer("p", "vide", "Aucun problème : la ligne peut tourner."));
    // d'abord ce qui empêche la ligne de démarrer, puis les remarques (la ligne tourne, des bouteilles tomberont)
    if (liste.some((q) => !q.bloquant)) panneau.append(creer("p", "aide", "En jaune : la ligne démarre quand même, mais des bouteilles tomberont dans une trappe."));
    for (const q of [...liste.filter((x) => x.bloquant), ...liste.filter((x) => !x.bloquant)]) {
      const b = creer("button", q.bloquant ? "probleme" : "probleme avertissement", q.message); b.type = "button";
      b.addEventListener("click", () => { if (q.id) { etat.selection = q.id; dessiner(); afficherOnglet("piece"); } });
      panneau.append(b);
    }
  } else {
    const n = indicesDebloques();
    if (!n) panneau.append(creer("p", "vide", `Le premier indice s'ouvre après ${ECHECS_AVANT_INDICE[0]} lancements sans l'étoile 1.`));
    etat.niveau.indices.slice(0, n).forEach((t, i) => panneau.append(creer("p", "indice", `Indice ${i + 1}. ${t}`)));
    etat.indicesVus = n;
  }
  majResume();
}

function majResume() {
  const r = etat.resultat;
  const nb = etat.problemes ? etat.problemes.length : 0;
  const onglet = document.querySelector('.onglet[data-onglet="problemes"]');
  onglet.textContent = nb ? `Problèmes (${nb})` : "Problèmes";
  if (!r) { $("resume-tests").textContent = ""; return; }
  const v = r.tests.filter((t) => t.groupe === "visible"), b = r.tests.filter((t) => t.groupe === "bonus");
  $("resume-tests").textContent = `${v.filter((t) => t.ok).length} test(s) sur ${v.length}` + (b.length ? ` · lendemain : ${b.filter((t) => t.ok).length} sur ${b.length}` : "");
}

// ---------- lancer la ligne ----------
async function lancer({ pasAPas = false } = {}) {
  if (etat.occupe || !etat.niveau) return;
  arreterRejeu();
  document.querySelector(".bilan")?.remove();
  const pl = etat.plateau;
  pl.annulerTrace();
  etat.problemes = pl.valider();
  const bloquants = etat.problemes.filter((q) => q.bloquant);
  if (bloquants.length) {
    etat.afficherProblemes = true; etat.problemesAffiches = bloquants;
    dessiner(); afficherOnglet("problemes");
    legende(`La ligne ne peut pas démarrer : ${bloquants.length} problème(s), entourés en rouge sur le plateau. Le détail est dans l'onglet Problèmes.`, true);
    sons.jouer("alerte");
    return;
  }
  etat.afficherProblemes = false; etat.problemesAffiches = [];
  etat.occupe = true; sons.reveiller();
  const bouton = $("bouton-lancer"); bouton.textContent = "La ligne démarre…";
  try {
    const g = generer(pl); etat.generation = g;
    const r = await pilote.executerLigne(etat.niveau, g.code, etat.tests, g.suivre);
    etat.resultat = r;
    const e = etoiles(etat.niveau, pl, r);
    etat.etoilesDernieres = e;
    progression.noterResultat(etat.niveau.id, e, JSON.stringify(pl.exporter()));
    etat.etapes = construireEtapes(pl, g, r, etat.niveau);
    etat.curseur = 0; etat.rejeuTermine = false;
    majObjectifs();
    afficherOnglet(r.erreur ? "problemes" : "tests");
    if (indicesDebloques() > etat.indicesVus) document.querySelector('.onglet[data-onglet="indice"]').classList.add("nouveau");
    etat.vue.preparerRejeu(pl);
    etat.occupe = false; bouton.textContent = "Lancer la ligne";
    if (!etat.etapes.length) { finRejeu(); return; }
    if (pasAPas) { await pas(); return; }
    rejouer();
  } catch (erreur) {
    console.error(erreur);
    etat.resultat = { tests: [], sortie: [], trace: [], erreur: { messageOriginal: String(erreur.message || erreur), ligne: null, conseil: "Le moteur du jeu a rencontré un problème, ce n'est pas votre ligne. Rechargez la page ; si le problème continue, prévenez le formateur." } };
    afficherOnglet("problemes");
  } finally { etat.occupe = false; bouton.textContent = "Lancer la ligne"; }
}

function facteur(n) {
  for (const [jusque, f] of ACCELERATION) if (n <= jusque) return f * (etat.rapide ? FACTEUR_RAPIDE : 1);
  return 1;
}

let jeton = 0;
async function rejouer() {
  if (!etat.etapes.length) { legende("Lancez d'abord la ligne : le rejeu suit l'exécution de son code."); return; }
  const mon = ++jeton;
  document.querySelector(".bilan")?.remove();
  etat.vue.preparerRejeu(etat.plateau);
  etat.vue.sauter = false;
  etat.enCours = true; etat.rejeuTermine = false;
  let bouteilles = 0;
  for (etat.curseur = 0; etat.curseur < etat.etapes.length; etat.curseur++) {
    if (mon !== jeton) return;
    const e = etat.etapes[etat.curseur];
    if (e.type === "apparition") bouteilles += 1;
    montrer(e);
    await etat.vue.jouerEtape(e, facteur(bouteilles));
  }
  if (mon !== jeton) return;
  finRejeu();
}

async function pas() {
  if (etat.enCours) { jeton++; etat.enCours = false; }
  if (!etat.etapes.length) { await lancer({ pasAPas: true }); return; }
  if (etat.curseur >= etat.etapes.length) { etat.vue.preparerRejeu(etat.plateau); etat.curseur = 0; }
  if (etat.curseur === 0) { document.querySelector(".bilan")?.remove(); etat.vue.preparerRejeu(etat.plateau); }
  const e = etat.etapes[etat.curseur];
  montrer(e);
  etat.curseur += 1;
  etat.enCours = true;
  await etat.vue.jouerEtape(e, 1);
  etat.enCours = false;
  if (etat.curseur >= etat.etapes.length) finRejeu();
}

function montrer(e) {
  const l = ligneDe(e);
  etat.editeur.surligner(l);
  legende(`Étape ${etat.curseur + 1} sur ${etat.etapes.length}${l ? ", ligne " + l : ""} : ${decrireEtape(e, etat.plateau)}`, e.type === "erreur");
}

function arreterRejeu() { jeton++; etat.enCours = false; if (etat.vue) etat.vue.sauter = false; }

function finRejeu() {
  etat.enCours = false; etat.rejeuTermine = true;
  const r = etat.resultat, e = etat.etoilesDernieres || [false, false, false];
  etat.vue.terminer({ reussi: Boolean(r && !r.erreur && e[0]) });
  if (r && r.erreur) {
    legende(`La ligne s'est arrêtée${r.erreur.ligne ? " ligne " + r.erreur.ligne : ""} : ${r.erreur.messageOriginal}`, true);
    if (r.erreur.ligne) etat.editeur.surligner(r.erreur.ligne);
    return;
  }
  etat.editeur.surligner(null);
  const chutes = etat.etapes.filter((x) => x.type === "chute").length;
  const trappe = chutes ? ` ${chutes === 1 ? "Une bouteille est tombée" : chutes + " bouteilles sont tombées"} dans la trappe.` : "";
  if (!e[0]) { legende("La ligne a tourné jusqu'au bout, mais des tests échouent : regardez l'onglet Tests." + trappe, true); return; }
  bilan(e);
}

function bilan(e) {
  const n = etat.niveau, fond = creer("div", "bilan"), carte = creer("div", "bilan-carte");
  carte.setAttribute("role", "dialog"); carte.setAttribute("aria-label", "Ligne réussie");
  const etoilesZone = creer("div", "etoiles"); dessinerEtoiles(etoilesZone, e);
  carte.append(creer("h2", "", "La ligne tourne"), etoilesZone);
  const m = mesure(n, etat.plateau), unite = n.etoiles.critere === "pieces" ? "pièces posées" : "cases de tapis";
  carte.append(creer("p", "", e[1] ? `Étoile 2 gagnée : ${m} ${unite}, l'objectif était ${n.etoiles.max} ou moins.` : `Étoile 2 à gagner : ${m} ${unite}, l'objectif est ${n.etoiles.max} ou moins.`));
  carte.append(creer("p", "", e[2] ? "Étoile 3 gagnée : le brassin du lendemain passe aussi." : "Étoile 3 à gagner : le brassin du lendemain ne passe pas encore. Regardez le test « Brassin du lendemain »."));
  const actions = creer("div", "bilan-actions");
  const ameliorer = creer("button", "bouton", "Améliorer"); ameliorer.type = "button"; ameliorer.addEventListener("click", () => fond.remove()); actions.append(ameliorer);
  const suivant = etat.index.niveaux.find((x) => x.numero === n.numero + 1);
  const b = creer("button", "bouton principal", suivant ? "Niveau suivant" : "Retour à la carte"); b.type = "button";
  b.addEventListener("click", () => { location.hash = suivant ? "niveau=" + suivant.id : ""; }); actions.append(b);
  carte.append(actions); fond.append(carte); $("vue").append(fond);
  b.focus();
  sons.jouer("etoile");
}

// ---------- envoi des résultats ----------
async function envoyerResultats() {
  const p = progression.lire(), message = $("message-carte");
  if (!p.pseudo) { message.textContent = "Indiquez un prénom ou un pseudo sur la page d'accueil avant d'envoyer vos résultats."; return; }
  const fiches = etat.index.niveaux.map((n) => ({ n, f: progression.fiche(n.id) }));
  const reussis = fiches.filter((x) => x.f.etoiles[0]);
  const champs = {
    pseudo: p.pseudo, date: new Date().toISOString().slice(0, 19),
    niveau_max_atteint: String(reussis.reduce((s, x) => Math.max(s, x.n.numero), 0)),
    niveaux_reussis: String(reussis.length),
    etoiles_total: String(fiches.reduce((s, x) => s + x.f.etoiles.filter(Boolean).length, 0)),
    niveaux_a_revoir: fiches.filter((x) => !x.f.etoiles[0] && x.f.essais > ESSAIS_A_REVOIR).map((x) => x.n.id).join(", "),
    mode: p.sans3d ? "sans 3D" : "3D", qualite: p.qualite || "haute",
  };
  message.textContent = "Envoi en cours…";
  try { await envoyer(champs, FORMULAIRE); message.textContent = "Résultat envoyé."; }
  catch (e) { message.textContent = "L'envoi n'a pas fonctionné. Réessayez ; si le problème continue, prévenez le formateur."; console.warn(e); }
}

// ---------- branchements ----------
function avecConfirmation(bouton, libelle, action) {
  let arme = false, minuterie = null;
  bouton.addEventListener("click", () => {
    if (!arme) { arme = true; bouton.textContent = "Confirmer ?"; bouton.classList.add("danger"); minuterie = setTimeout(() => { arme = false; bouton.textContent = libelle; bouton.classList.remove("danger"); }, 4000); return; }
    clearTimeout(minuterie); arme = false; bouton.textContent = libelle; bouton.classList.remove("danger"); action();
  });
}
function basculer(bouton, action) { bouton.addEventListener("click", () => { const actif = bouton.getAttribute("aria-pressed") !== "true"; bouton.setAttribute("aria-pressed", String(actif)); action(actif); }); }

function brancher() {
  $("bouton-carte").addEventListener("click", () => { location.hash = ""; });
  $("bouton-lancer").addEventListener("click", () => lancer());
  $("bouton-rejouer").addEventListener("click", () => { sons.reveiller(); rejouer(); });
  $("bouton-pas").addEventListener("click", () => { sons.reveiller(); pas(); });
  basculer($("bouton-pause"), (actif) => { if (etat.vue) etat.vue.enPause = actif; });
  basculer($("bouton-vitesse"), (actif) => { etat.rapide = actif; });
  basculer($("bouton-son"), (actif) => { sons.activer(actif); progression.reglage("son", actif); });
  if (progression.reglage("son") === false) { $("bouton-son").setAttribute("aria-pressed", "false"); sons.activer(false); }
  $("bouton-agrandir").addEventListener("click", () => etat.editeur && etat.editeur.agrandir());
  avecConfirmation($("bouton-depart"), "Plateau de départ", () => { arreterRejeu(); etat.plateau = new Plateau(etat.niveau); etat.selection = null; majTout(); legende("Le plateau est revenu à son état de départ."); });
  $("bouton-envoyer").addEventListener("click", envoyerResultats);
  $("bouton-qualite").addEventListener("click", () => { progression.reglage("qualite", progression.reglage("qualite") === "basse" ? "haute" : "basse"); detruireVue(); afficherCarte(); });
  $("bouton-sans3d").addEventListener("click", () => { progression.reglage("sans3d", !progression.reglage("sans3d")); detruireVue(); afficherCarte(); });
  for (const b of document.querySelectorAll(".onglet")) b.addEventListener("click", () => afficherOnglet(b.dataset.onglet));
  $("machine-annuler").addEventListener("click", () => { $("dialogue-machine").hidden = true; });
  $("machine-valider").addEventListener("click", validerMachine);
  document.addEventListener("keydown", (e) => {
    if ($("vue-niveau").hidden) return;
    if (!$("dialogue-machine").hidden) { if (e.key === "Escape") $("dialogue-machine").hidden = true; return; }
    if (e.key === "F10") { e.preventDefault(); pas(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); lancer(); return; }
    if (e.target.closest && e.target.closest("input, select, textarea, .cm-editor")) return;
    if (e.key === "Escape") { if (etat.plateau.trace) { etat.plateau.annulerTrace(); legende("Tapis annulé."); dessiner(); } else { etat.selection = null; majReglages(); dessiner(); } return; }
    if ((e.key === "Delete" || e.key === "Backspace") && etat.selection) { const p = etat.plateau.piece(etat.selection); if (p && !p.fixe) { etat.plateau.supprimer(p.x, p.z); etat.selection = null; majTout(); } return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "m" || e.key === "M") $("bouton-son").click();
    if (e.key === "p" || e.key === "P") $("bouton-pause").click();
  });
  window.addEventListener("hashchange", naviguer);
}

function naviguer() {
  const m = location.hash.match(/^#niveau=(.+)$/);
  if (m) ouvrirNiveau(decodeURIComponent(m[1])); else afficherCarte();
}

async function demarrer() {
  etat.index = await fetch("ligne/niveaux/index.json").then((r) => r.json());
  brancher();
  naviguer();
  window.jeu = { etat, pilote, lancer, rejouer, pas, Plateau, majTout };      // accès pour le contrôle qualité automatique
}

demarrer();
