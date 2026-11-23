// Atelier de construction (missions des séries 3 à 6) : contrôleur de la page.
// Le hall et le code se suivent dans les deux sens :
// - poser, régler, déplacer, retirer un poste réécrit le code ;
// - écrire le code redessine le hall (analyse Python, atelier.analyser).
// Lancer : le code est exécuté ligne par ligne, la scène rejoue chaque ligne sur les données.
import * as progression from "../commun/progression.js";
import { PilotePython } from "../commun/python.js";
import { creerEditeur } from "../commun/editeur.js";
import * as sons from "../commun/sons.js";
import { PIECES, CATEGORIES, GRILLE, ligneDe, nomsCrees, nomsDeBoucle } from "./catalogue.js";
import { PlateauAtelier } from "./plateau.js";
import { creerSceneAtelier, texteValeur } from "./scene-atelier.js";
import { creerVue2DAtelier } from "./vue2d-atelier.js";
import { creerBarre } from "./barre.js";
import { ouvrirBulle } from "./bulle.js";

// ----- Réglages (modifiables par le formateur) -----
const ECHECS_AVANT_INDICE = [2, 4];
const VITESSE_RAPIDE = 2.5;             // bouton « Rejeu rapide »
const DELAI_ANALYSE_MS = 500;          // après la dernière frappe dans l'éditeur, le hall se redessine
const DELAI_APERCU_MS = 300; 
const MAX_ETAPES_BOUCLE = 40;          // boucle sans fin : le rejeu montre les premiers tours, puis l'arrêt          // après un changement, les données du mur se mettent à jour

const $ = (id) => document.getElementById(id);
const etat = { mission: null, tests: "", plateau: new PlateauAtelier(), editeur: null, scene: null, barre: null, choix: { outil: "choisir" }, selection: null, ancre: null,
  resultat: null, etoiles: null, etapes: [], curseur: 0, casCourant: 0, enCours: false, occupe: false, ignorer: false, glisse: null, onglet: "tests", apercu: {}, syntaxe: null, avertissement: null };
const pilote = new PilotePython((nom) => {
  const e = $("etat-python");
  if (nom === "pret") { e.textContent = "Python est prêt"; e.className = "etat-python pret"; planifierApercu(); }
  if (nom === "chargement") { e.textContent = "Préparation de Python…"; e.className = "etat-python"; }
  if (nom === "echec") { e.textContent = "Python n'a pas pu se charger. Rechargez la page."; e.className = "etat-python echec"; }
});

function creer(balise, classe, texte) { const e = document.createElement(balise); if (classe) e.className = classe; if (texte !== undefined) e.textContent = texte; return e; }
function legende(texte, echec = false) { const z = $("legende"); z.textContent = texte; z.classList.toggle("echec", echec); }
// la progression est celle de la carte des missions : même identifiant que la mission
const idProgression = () => etat.mission.id;
const TOUT_OUVERT = new URLSearchParams(location.search).has("formateur");   // ?formateur=1 : confort de démonstration, pas une sécurité
const libelleLancer = () => (etat.mission && etat.mission.fonction ? "Lancer les tests" : "Lancer le programme");
const urlCarte = () => "missions.html" + location.search;
const lienMission = (m) => (m.atelier ? "atelier.html" : "missions.html") + location.search + "#mission=" + m.id;
const missionsDeLaSerie = (n) => etat.index.missions.filter((m) => m.serie === n);
const serieReussie = (n) => missionsDeLaSerie(n).filter((m) => !m.bonus).every((m) => progression.fiche(m.id).etoiles[0]);
const serieOuverte = (n) => TOUT_OUVERT || n === 1 || serieReussie(n - 1);

function dessinerEtoiles(conteneur, liste) {
  conteneur.innerHTML = "";
  liste.forEach((gagnee) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("class", "etoile" + (gagnee ? " gagnee" : "")); svg.setAttribute("aria-hidden", "true");
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", "M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z");
    svg.append(p); conteneur.append(svg);
  });
  conteneur.setAttribute("aria-label", `${liste.filter(Boolean).length} étoile(s) sur 3`);
}

// ---------- chargement ----------
async function demarrer() {
  // la carte des missions et l'atelier partagent un index : séries, ordre des missions, ouverture des séries
  etat.index = await (await fetch("missions/index.json")).json();
  const voulu = new URLSearchParams(location.hash.slice(1)).get("mission");
  const choisie = etat.index.missions.find((m) => m.id === voulu && m.atelier);
  if (!choisie || !serieOuverte(choisie.serie)) { location.replace(urlCarte()); return; }
  etat.fiche = choisie;
  etat.mission = await (await fetch(`atelier/missions/${choisie.id}/mission.json`)).json();
  etat.tests = await (await fetch(`atelier/missions/${choisie.id}/tests.py`)).text();
  const m = etat.mission, serie = etat.index.series.find((x) => x.numero === m.serie);
  document.title = `Mission ${m.serie}.${m.numero} · ${m.titre}`;
  $("mission-id").textContent = `MISSION ${m.serie}.${m.numero}`;
  $("mission-surtitre").textContent = `Série ${m.serie} · ${serie ? serie.titre : m.notion}` + (m.surprise ? " · Contrôle surprise" : "") + (m.bonus ? " · Bonus" : "");
  $("bouton-carte").href = urlCarte();
  $("bouton-lancer").textContent = libelleLancer();
  $("mission-titre").textContent = m.titre;
  $("mission-enonce").textContent = m.enonce;
  if (m.exemple) { $("mission-exemple").textContent = m.exemple; $("mission-exemple").hidden = false; }
  etat.plateau = new PlateauAtelier(m.fonction || null);
  $("nom-fichier").textContent = m.fonction ? `${m.fonction.nom}.py` : "commandes.py";
  const f = progression.fiche(idProgression());
  const code = f.code ?? m.depart ?? "";
  etat.editeur = creerEditeur($("editeur"), { texte: code, surChangement: (t) => { if (!etat.ignorer) planifierAnalyse(t); }, surExecuter: () => lancer(), libelle: "Code Python du programme" });
  const bandeau = creer("div", "bandeau-code"); bandeau.id = "bandeau-code"; $("editeur").before(bandeau);
  // la 3D, sauf si le stagiaire a choisi « sans 3D » ou si le poste ne sait pas l'afficher : alors le hall en cases et un journal
  if (!progression.reglage("sans3d")) {
    try { etat.scene = creerSceneAtelier($("vue"), { qualite: progression.reglage("qualite") === "basse" ? "basse" : "haute", surCase: interagir }); }
    catch (erreur) { console.warn("La 3D n'a pas pu démarrer : passage au hall en cases.", erreur); etat.scene = null; }
  }
  if (!etat.scene) etat.scene = creerVue2DAtelier($("vue"), { surCase: interagir, decrire: (e) => decrire(e) });
  $("bouton-mode").textContent = etat.scene.sansTroisD ? "Sans 3D" : "3D";
  $("bouton-mode").setAttribute("aria-label", `Mode d'affichage : ${etat.scene.sansTroisD ? "sans 3D" : "3D"}. Changer de mode`);
  etat.barre = creerBarre($("barre-outils"), $("info-bulle"), {
    palette: m.palette,
    typesPresents: () => new Set([...etat.plateau.variablesAvant().values(), ...Object.values(etat.apercu).map((e) => e.t), ...etat.plateau.postes.map((p) => p.type)]),
    surChoix: choisir,
  });
  majObjectifs();
  if (code.trim()) {
    const a = await pilote.analyserAtelier(code, etat.mission.fonction);
    if (a.ok) { etat.plateau.depuisAnalyse(a.postes); etat.plateau.importerPlaces(f.places); etat.plateau.importerRoutes(f.routes); }
  }
  etat.historique = []; etat.position = -1; memoriser();
  dessiner(); afficherOnglet("tests"); planifierApercu();
  legende("Choisissez une pièce dans la barre de gauche (survolez une icône pour son nom), puis cliquez sur une case du hall. Vous pouvez aussi écrire le Python à droite.");
  installerCommandes();
}

function sauver() {
  const f = progression.fiche(idProgression());
  f.places = etat.plateau.exporterPlaces();
  f.routes = etat.plateau.exporterRoutes();
  progression.sauverCode(idProgression(), etat.editeur.lire());
  memoriser();
}

// ---------- annuler, rétablir : le hall et le code reviennent ensemble ----------
const HISTORIQUE_MAX = 80;
const photo = () => ({ code: etat.editeur.lire(), places: etat.plateau.exporterPlaces(), routes: etat.plateau.exporterRoutes() });
function memoriser() {
  if (etat.restauration || !etat.historique) return;
  const p = photo(), h = etat.historique, dernier = h[etat.position];
  if (dernier && JSON.stringify(dernier) === JSON.stringify(p)) return;
  h.splice(etat.position + 1); h.push(p);
  if (h.length > HISTORIQUE_MAX) h.shift();
  etat.position = h.length - 1; majHistorique();
}
async function revenirA(i) {
  const p = etat.historique[i];
  if (!p || etat.enCours) return;
  etat.position = i; etat.restauration = true;
  try {
    const a = await pilote.analyserAtelier(p.code, etat.mission.fonction);
    etat.ignorer = true; etat.editeur.ecrire(p.code); etat.ignorer = false;
    if (a.ok) { etat.plateau.depuisAnalyse(a.postes); etat.plateau.importerPlaces(p.places, true); etat.plateau.importerRoutes(p.routes); etat.syntaxe = null; $("bandeau-code").textContent = ""; }
    etat.selection = null; etat.resultat = null; etat.etapes = []; arreterRejeu(); document.querySelector(".bulle")?.remove();
    dessiner(); sauver(); planifierApercu();
    if (etat.onglet === "piece") afficherOnglet("piece");
  } finally { etat.restauration = false; majHistorique(); }
}
const annuler = () => { if (etat.position > 0) { revenirA(etat.position - 1); legende("Dernière modification annulée (Ctrl+Z). Rétablir : Ctrl+Y."); } };
const retablir = () => { if (etat.position < etat.historique.length - 1) { revenirA(etat.position + 1); legende("Modification rétablie."); } };
function majHistorique() {
  $("bouton-annuler").disabled = etat.position <= 0;
  $("bouton-retablir").disabled = etat.position >= etat.historique.length - 1;
}

// ---------- hall et code ----------
function dessiner(fantome = null) {
  const x = execCourante(), poseDansBloc = etat.choix.piece && !["elif", "else"].includes(etat.choix.piece);
  etat.emplacements = poseDansBloc ? etat.plateau.emplacements() : [];
  etat.scene.dessiner(etat.plateau, { selection: etat.selection, fantome, trace: etat.plateau.trace, emplacements: etat.emplacements,
    problemes: x?.erreur?.ligne ? [posteDeLigne(x.erreur.ligne)?.id].filter(Boolean) : [] });
  majMesure();
}

// Le hall a changé : le code est réécrit à partir des postes.
function apresChangementHall() {
  const code = etat.plateau.code();
  etat.ignorer = true; etat.editeur.ecrire(code); etat.ignorer = false;
  const perdu = etat.plateau.apresRetour();
  etat.avertissement = perdu ? `la ligne ${perdu.lignes[0]} ne sera jamais exécutée : elle vient après return, qui fait sortir de la fonction. Placez-la avant le return.` : null;
  $("bandeau-code").textContent = texteAvertissement(); etat.syntaxe = null;
  etat.resultat = null; etat.etapes = [];
  dessiner(); sauver(); planifierApercu();
  if (etat.onglet === "piece") afficherOnglet("piece");
}

// Le code a changé : le hall se redessine quand le stagiaire s'arrête de taper.
let minuterieAnalyse = null;
function planifierAnalyse(texte) {
  clearTimeout(minuterieAnalyse);
  minuterieAnalyse = setTimeout(async () => {
    const a = await pilote.analyserAtelier(texte, etat.mission.fonction);
    if (texte !== etat.editeur.lire()) return;
    if (!a.ok) {
      etat.syntaxe = a.erreur;
      $("bandeau-code").textContent = a.erreur.horsFonction
        ? `Ligne ${a.erreur.ligne} : ${a.erreur.message}. Le hall attend que le code soit corrigé.`
        : `Ligne ${a.erreur.ligne} : Python ne comprend pas encore cette ligne (${a.erreur.message}). Le hall attend que le code soit corrigé.`;
      return;
    }
    etat.avertissement = a.avertissements && a.avertissements.length ? a.avertissements[0].message : null;
    etat.syntaxe = null; $("bandeau-code").textContent = texteAvertissement();
    etat.plateau.depuisAnalyse(a.postes);
    if (etat.selection && !etat.plateau.poste(etat.selection)) etat.selection = null;
    etat.resultat = null; etat.etapes = [];
    dessiner(); sauver(); planifierApercu();
  }, DELAI_ANALYSE_MS);
}

// Un avertissement sans erreur : une ligne qui ne sera jamais exécutée.
function texteAvertissement() { return etat.avertissement ? `Attention, ${etat.avertissement}` : ""; }

// Les données du mur : le programme est exécuté sans être rejoué, pour montrer ce qu'il construit.
let minuterieApercu = null;
function planifierApercu() {
  clearTimeout(minuterieApercu);
  minuterieApercu = setTimeout(async () => {
    if (!etat.mission || etat.enCours || etat.syntaxe) return;
    try {
      const r = await pilote.executerAtelier(etat.mission, etat.editeur.lire(), "");
      if (etat.enCours) return;
      // fonction : le mur montre le premier cas de test
      const vue = r.mode === "fonction" ? (r.cas[0] || { etatFinal: {}, erreur: r.erreur }) : r;
      etat.apercu = vue.etatFinal || {};
      etat.scene.construireDonnees(etat.apercu);
      // le programme s'arrête avant la fin : les données du mur sont celles du moment de l'arrêt
      $("bandeau-code").textContent = vue.erreur && !etat.syntaxe ? `${r.mode === "fonction" ? "Avec le premier cas de test, le programme" : "Le programme"} s'arrête ligne ${vue.erreur.ligne} (${vue.erreur.type}) : le mur montre les données à ce moment-là. Lancez-le pour voir pourquoi.` : texteAvertissement();
    } catch (e) { /* Python en cours de chargement : l'aperçu attendra */ }
  }, DELAI_APERCU_MS);
}

function majMesure() {
  const n = etat.plateau.postes.length;
  $("mesure").textContent = `Postes : ${n}`;
}

function majObjectifs() {
  const m = etat.mission, f = progression.fiche(idProgression()), e = m.etoiles;
  dessinerEtoiles($("mission-etoiles"), f.etoiles);
  const liste = $("mission-objectifs"); liste.innerHTML = "";
  [e.description1, e.description2, e.description3].forEach((texte, i) => {
    const li = creer("li", f.etoiles[i] ? "gagnee" : "");
    const marque = creer("span", "etoiles"); dessinerEtoiles(marque, [f.etoiles[i]]); marque.removeAttribute("aria-label");
    li.append(marque, creer("span", "", `Étoile ${i + 1}${f.etoiles[i] ? " gagnée" : ""} : ${texte}`));
    liste.append(li);
  });
}

// ---------- barre d'outils et interactions avec le hall ----------
function choisir(choix) {
  if (choix.action === "ranger") { etat.plateau.ranger(); dessiner(); sauver(); legende("Les postes sont rangés dans l'ordre du programme."); return; }
  etat.choix = choix; etat.plateau.annulerTrace(); dessiner();
  if (choix.piece && !["elif", "else"].includes(choix.piece)) {
    legende(`${PIECES[choix.piece].nom} (${PIECES[choix.piece].python}) : cliquez sur une case libre, le poste va ${etat.ancre ? "juste après le poste choisi" : "à la fin du programme"} ; sur un emplacement « + », il va dans ce bloc.`);
    return;
  }
  if (choix.outil === "tapis") legende("Tapis : appuyez sur un poste (ou sur le début du programme), glissez case par case, relâchez sur le poste qui doit venir juste après. Échap annule.");
  else if (choix.piece) legende(`${PIECES[choix.piece].nom} (${PIECES[choix.piece].python}) : cliquez sur un contrôle qualité (if) déjà posé.`);
  else if (choix.outil === "detruire") legende("Marteau : cliquez sur un poste pour le détruire, ou sur un tapis tracé à la main pour qu'il redevienne automatique.");
  else legende("Cliquez sur un poste ou sur une donnée contre le mur pour changer son nom ou son contenu ; glissez un poste pour le déplacer.");
}

function interagir(type, x, z) {
  if (etat.enCours) return;
  // le code ne s'analyse pas : modifier le hall réécrirait le code et effacerait la ligne en cours de correction
  if (etat.syntaxe && type !== "survol") {
    if (type === "appui") legende(`Corrigez d'abord la ligne ${etat.syntaxe.ligne} du code : le hall reprend dès que Python la comprend.`, true);
    return;
  }
  // une bulle ouverte : un clic ailleurs dans le hall la ferme sans enregistrer (et ne pose pas un poste neuf)
  const ouverte = document.querySelector(".bulle");
  if (ouverte) { if (type !== "appui") return; ouverte.querySelector(".actions .bouton:not(.principal)").click(); }
  const pl = etat.plateau, poste = x === null ? null : pl.posteEn(x, z);
  if (etat.choix.piece === "elif" || etat.choix.piece === "else") {
    if (type !== "appui" || x === null) return;
    const outil = etat.choix.piece;
    if (!poste || poste.type !== "si") { legende(`Cliquez sur un contrôle qualité (if) déjà posé : ${outil === "elif" ? "il reçoit une condition de plus" : "il reçoit une voie « sinon »"}.`, true); return; }
    if (outil === "else" && !pl.ajouterSinon(poste.id)) { legende("Ce contrôle a déjà une voie « sinon ».", true); return; }
    if (outil === "elif") pl.ajouterElif(poste.id, "");
    sons.jouer("clic"); etat.selection = poste.id; etat.barre.choisir({ outil: "choisir" });
    if (outil === "elif") { dessiner(); ouvrirBullePoste(pl.poste(poste.id), false, true); }
    else { apresChangementHall(); legende("Voie « sinon » ajoutée : posez ses postes sur l'emplacement « + sinon » (une pièce en main)."); }
    return;
  }
  if (etat.choix.piece) {
    if (type === "survol") { dessiner({ x, z, libre: pl.libre(x, z) }); return; }
    if (type !== "appui") return;
    // un emplacement de bloc : la pièce va dans cette branche ; ailleurs, après le poste choisi
    const emplacement = (etat.emplacements || []).find((e) => e.x === x && e.z === z);
    // ancre : le poste choisi à la main ; sans ancre, le poste va à la fin du programme
    const cible = emplacement ? { dans: emplacement.bloc, branche: emplacement.branche } : etat.ancre ? { apres: etat.ancre } : null;
    const r = pl.poser(etat.choix.piece, x, z, cible);
    if (r.erreur) { legende(r.erreur, true); return; }
    sons.jouer("clic");
    etat.selection = r.poste.id;
    if (!emplacement && etat.ancre) etat.ancre = r.poste.id;
    // une pièce choisie dans le sous-menu « Tuple » vise d'abord une caisse plombée
    const variables = pl.variablesAvant(r.poste.id);
    for (const champ of ["source", "cible"]) if (champ in r.poste.params) {
      const voulu = etat.choix.type || (r.poste.type === "decomposer" ? "tuple" : "list");
      const candidat = [...variables].reverse().find(([, t]) => t === voulu);
      if (candidat) r.poste.params[champ] = candidat[0];
    }
    etat.barre.choisir({ outil: "choisir" });
    dessiner();
    ouvrirBullePoste(r.poste, true);
    return;
  }
  if (etat.choix.outil === "detruire") {
    if (type !== "appui" || x === null) return;
    if (poste) {
      pl.supprimer(poste.id); if (etat.selection === poste.id) etat.selection = null;
      sons.jouer("choc"); apresChangementHall(); legende("Poste détruit : sa ligne a disparu du code.");
      return;
    }
    const t = pl.tapisEn(x, z);
    if (t && t.manuel) { pl.oublierRoute(t); sons.jouer("choc"); dessiner(); sauver(); legende("Ce tapis redevient automatique. L'ordre du programme ne change pas."); }
    else if (t) legende("Ce tapis est tracé automatiquement : il suit l'ordre du programme. Pour changer l'ordre, tracez un tapis avec l'outil Tapis, ou détruisez un poste.");
    else if (z < GRILLE.stockage && etat.scene.donneeEn(x, z)) legende(`Pour retirer ${etat.scene.donneeEn(x, z)}, détruisez le poste qui le crée.`);
    return;
  }
  if (etat.choix.outil === "tapis") {
    if (type === "appui") {
      const r = pl.commencer(x, z);
      if (r.erreur) { legende(r.erreur, true); return; }
      etat.derniereCase = [x, z]; dessiner();
      legende("Glissez case par case jusqu'au poste qui doit s'exécuter juste après. Revenir en arrière efface la dernière case.");
      return;
    }
    if (type === "glisse" && pl.trace && x !== null) {
      if (etat.derniereCase && etat.derniereCase[0] === x && etat.derniereCase[1] === z) return;
      // souris rapide : les cases sautées sont comblées en ligne droite (d'abord en x, puis en z)
      const dernier = pl.trace.cases.length ? pl.trace.cases[pl.trace.cases.length - 1] : pl.trace.depart;
      let [cx, cz] = dernier; const pas = [];
      while (cx !== x) { cx += Math.sign(x - cx); pas.push([cx, cz]); }
      while (cz !== z) { cz += Math.sign(z - cz); pas.push([cx, cz]); }
      for (const [a, b] of pas) {
        const r = pl.ajouter(a, b);
        if (r.erreur) { legende(r.erreur, true); break; }
        if (r.tapis) { finTapis(r); return; }
      }
      etat.derniereCase = [x, z]; dessiner();
      return;
    }
    if (type === "relache" && pl.trace) {
      if (poste && poste.id !== pl.trace.de && pl.trace.cases.length) { const r = pl.ajouter(x, z); if (r.tapis) { finTapis(r); return; } }
      pl.annulerTrace(); dessiner();
      legende("Tapis non posé : il doit finir sur un poste. Recommencez depuis un poste.", true);
    }
    return;
  }
  // outil Choisir : un clic ouvre la bulle (nom et contenu), glisser déplace le poste
  if (type === "appui") {
    etat.selection = poste ? poste.id : null; etat.ancre = etat.selection;
    etat.glisse = poste ? { id: poste.id, bouge: false } : null;
    dessiner();
    if (poste) { etat.onglet = "piece"; afficherOnglet("piece"); }
    else if (x !== null && z < GRILLE.stockage) {
      // une donnée contre le mur : la bulle du poste qui la crée
      const nom = etat.scene.donneeEn(x, z);
      const createur = nom && [...pl.postes].reverse().find((p) => ["creer_liste", "creer_tuple", "variable"].includes(p.type) && nomsCrees(p).some(([n]) => n === nom));
      if (createur) { etat.selection = createur.id; dessiner(); ouvrirBullePoste(createur, false); }
      else if (nom) legende(`${nom} est créé par un calcul (tranche, len…) : changez le poste qui le calcule.`);
    }
    return;
  }
  if (type === "glisse" && etat.glisse && x !== null) {
    if (pl.deplacer(etat.glisse.id, x, z)) { etat.glisse.bouge = true; dessiner(); }
    return;
  }
  if (type === "relache" && etat.glisse) {
    const g = etat.glisse; etat.glisse = null;
    if (g.bouge) { sauver(); legende("Poste déplacé. L'ordre du programme ne change pas : pour le changer, tracez un tapis (outil Tapis)."); }
    else if (pl.poste(g.id)) ouvrirBullePoste(pl.poste(g.id), false);
    return;
  }
  if (type === "double" && poste && !document.querySelector(".bulle")) ouvrirBullePoste(poste, false);
}

function finTapis(r) {
  sons.jouer("clic");
  legende(r.deplace ? `Tapis posé : ${PIECES[r.arrivee.type].nom} s'exécute maintenant juste après. Le code a changé d'ordre.` : "Tapis posé : l'ordre du programme ne change pas, seul le chemin du tapis change.");
  apresChangementHall();
}

const nouveau_ = (nouveau, ancien) => !nouveau || !ancien ? false : nouveau !== ancien;
const posteNumero = (p) => `Poste ${etat.plateau.index(p.id) + 1} · ${PIECES[p.type].nom}`;

function ouvrirBullePoste(poste, nouveau, elifNeuf = false) {
  const ancre = etat.scene.projeter(poste.x, poste.z);
  ouvrirBulle($("vue"), {
    poste, ancre, nouveau, variables: etat.plateau.variablesAvant(poste.id),
    surValider: (params) => {
      // un nom changé à la création : les postes suivants qui le lisent suivent
      const ancien = poste.params.nom, nouveau = params.nom;
      etat.plateau.regler(poste.id, params);
      const suivis = !nouveau_(nouveau, ancien) ? 0 : etat.plateau.renommer(poste.id, ancien, nouveau);
      apresChangementHall();
      legende(`${posteNumero(poste)} : ${ligneDe(etat.plateau.poste(poste.id))}${suivis ? ` · ${suivis} poste(s) suivant(s) utilisent maintenant ${nouveau}` : ""}`);
    },
    surAnnuler: () => {
      if (nouveau) { etat.plateau.supprimer(poste.id); etat.selection = null; legende("Poste non posé."); }
      if (elifNeuf) { const p = etat.plateau.poste(poste.id); const q = structuredClone(p.params); q.conditions.pop(); q._origines = q.conditions.map((_, k) => k); etat.plateau.regler(p.id, q); }
      dessiner();
    },
  });
}

// ---------- lancer, rejouer ----------
function posteDeLigne(l) { return etat.plateau.posteDeLigne(l); }

// L'exécution rejouée : le programme, ou le cas de test choisi d'une fonction.
function execCourante() {
  const r = etat.resultat; if (!r) return null;
  if (r.mode !== "fonction") return r;
  const c = r.cas && r.cas[etat.casCourant];
  return c ? { trace: c.trace, etatFinal: c.etatFinal, erreur: c.erreur, sortie: c.sortie, cas: c } : { trace: [], etatFinal: {}, erreur: r.erreur, sortie: [] };
}

function etoilesDe(r) {
  if (r.erreur) return [false, false, false];
  const vis = r.tests.filter((t) => t.groupe === "visible"), bon = r.tests.filter((t) => t.groupe === "bonus");
  const e1 = vis.length > 0 && vis.every((t) => t.ok);
  // étoile 2 : la notion de la série est utilisée (vérifiée en Python, atelier.notion_ok)
  return [e1, e1 && r.notionOk !== false, e1 && bon.length > 0 && bon.every((t) => t.ok)];
}

function construireEtapes(x) {
  const etapes = []; let sortie = 0;
  if (!x) return etapes;
  const tours = new Map();
  x.trace.forEach((ev, k) => {
    const p = posteDeLigne(ev.l), suivant = x.trace[k + 1];
    const e = { poste: p ? p.id : null, ligne: ev.l, avant: ev.etat, apres: suivant ? suivant.etat : x.etatFinal };
    if (k === x.trace.length - 1 && x.erreur && x.erreur.ligne === ev.l) { e.erreur = x.erreur; e.apres = ev.etat; }
    if (p && p.type === "afficher" && !e.erreur) e.affiche = x.sortie[sortie++];
    // un bloc : quelle voie le chariot prend
    if (p && p.branches && !e.erreur) {
      const voie = suivant ? etat.plateau.brancheDeLigne(p, suivant.l) : -1;
      if (p.type === "si") {
        const j = (p.entetes || []).indexOf(ev.l), cond = p.params.conditions[j] ?? p.params.conditions[0];
        e.vrai = voie === j; e.decision = `${cond} : ${e.vrai ? "vrai" : "faux"}`;
      } else if (p.type === "pour") {
        const n = (tours.get(p.id) || 0) + 1;
        e.vrai = voie === 0;
        if (e.vrai) { tours.set(p.id, n); e.decision = `tour ${n} : ${p.params.variable} = ${nomsDeBoucle(p.params.variable).map((v) => texteValeur(e.apres[v], true)).join(", ")}`; } else e.decision = `fini (${n - 1} tour${n - 1 > 1 ? "s" : ""})`;
      } else {
        e.vrai = voie === 0; e.decision = `${p.params.condition} : ${e.vrai ? "vrai" : "faux"}`;
      }
    }
    if (p && p.type === "renvoyer" && x.cas && !e.erreur) { e.retour = texteValeur(x.cas.retour); e.retourOk = x.cas.ok; }
    etapes.push(e);
  });
  // boucle sans fin : quelques tours suffisent à la voir tourner ; la dernière étape montre l'arrêt
  if (x.erreur && x.erreur.type === "BoucleSansFin") {
    const garde = etapes.slice(0, MAX_ETAPES_BOUCLE);
    const p = posteDeLigne(x.erreur.ligne);
    garde.push({ poste: p ? p.id : null, ligne: x.erreur.ligne, avant: garde.length ? garde[garde.length - 1].apres : {}, apres: garde.length ? garde[garde.length - 1].apres : {}, erreur: x.erreur });
    return garde;
  }
  return etapes;
}

// Le menu des cas rejoués (mission à fonction) : un cas par ligne, juste ou faux.
function majChoixCas() {
  const s = $("choix-cas"), r = etat.resultat;
  if (!s) return;
  s.hidden = !(r && r.mode === "fonction" && r.cas && r.cas.length);
  if (s.hidden) return;
  s.innerHTML = "";
  r.cas.forEach((c, i) => { const o = creer("option", "", `Cas ${i + 1}${c.groupe === "bonus" ? " (étoile 3)" : c.groupe === "cache" ? " (contrôle surprise)" : ""} · ${c.appel} · ${c.ok ? "juste" : "faux"}`); o.value = String(i); s.append(o); });
  s.value = String(etat.casCourant);
}

async function lancer({ pasAPas = false } = {}) {
  if (etat.occupe) return;
  document.querySelector(".bulle")?.remove(); document.querySelector(".bilan")?.remove();
  arreterRejeu();
  const code = etat.editeur.lire();
  if (!code.trim()) { legende("Le programme est vide : posez un premier poste, par exemple un rayonnage (icône Liste).", true); return; }
  etat.occupe = true; $("bouton-lancer").textContent = etat.mission.fonction ? "Les tests tournent…" : "Le programme démarre…";
  try {
    const a = await pilote.analyserAtelier(code, etat.mission.fonction);
    if (!a.ok) {
      etat.resultat = a.erreur.horsFonction
        ? { erreur: { type: "Retrait", ligne: a.erreur.ligne, messageOriginal: "Ligne hors de la fonction", explication: `La ligne ${a.erreur.ligne} n'est plus dans la fonction : elle commence au bord gauche.`, conseil: "Ajoutez 4 espaces au début de la ligne : en Python, c'est le retrait qui dit qu'une ligne appartient à la fonction." }, tests: [], sortie: [] }
        : { erreur: { type: "SyntaxError", ligne: a.erreur.ligne, messageOriginal: `SyntaxError: ${a.erreur.message}`, explication: "Python ne comprend pas cette ligne.", conseil: "Regardez la ligne indiquée et celle d'avant : guillemets, crochets, parenthèses, virgules." }, tests: [], sortie: [] };
      afficherOnglet("problemes"); legende(a.erreur.horsFonction ? `Ligne ${a.erreur.ligne} : la ligne est sortie de la fonction. Ajoutez 4 espaces au début de la ligne.` : `Ligne ${a.erreur.ligne} : Python ne comprend pas cette ligne. Le détail est dans l'onglet Problèmes.`, true); sons.jouer("alerte");
      return;
    }
    etat.plateau.depuisAnalyse(a.postes);
    etat.plateau.code();      // numéros de ligne de chaque poste, comme dans le code exécuté
    etat.plateau.depuisAnalyse(a.postes);
    const r = await pilote.executerAtelier(etat.mission, code, etat.tests);
    etat.resultat = r; etat.etoiles = etoilesDe(r);
    // cas rejoué : le premier qui échoue (les cas visibles d'abord), sinon le premier
    if (r.mode === "fonction") {
      const rangs = r.cas.map((c, i) => i), faux = [...rangs.filter((i) => r.cas[i].groupe === "visible"), ...rangs.filter((i) => r.cas[i].groupe !== "visible")].find((i) => !r.cas[i].ok);
      etat.casCourant = faux ?? 0;
    }
    majChoixCas();
    progression.noterResultat(idProgression(), etat.etoiles, code); sauver();
    etat.etapes = construireEtapes(execCourante()); etat.curseur = 0;
    majObjectifs(); dessiner();
    afficherOnglet(execCourante()?.erreur ? "problemes" : "tests");
    etat.scene.preparerRejeu(etat.plateau, etatInitial());
  } finally { etat.occupe = false; $("bouton-lancer").textContent = libelleLancer(); }
  if (!etat.etapes.length) { finRejeu(); return; }
  if (pasAPas) { await pas(); return; }
  rejouer();
}

// Au départ du rejeu : rien pour un programme ; pour une fonction, les paramètres livrés à la réception.
function etatInitial() { const x = execCourante(); return x && x.cas && x.trace.length ? x.trace[0].etat : {}; }

let jeton = 0;
function arreterRejeu() { jeton++; etat.enCours = false; }

async function rejouer() {
  if (!etat.etapes.length) { legende("Lancez d'abord le programme."); return; }
  const mon = ++jeton;
  document.querySelector(".bilan")?.remove();
  etat.scene.preparerRejeu(etat.plateau, etatInitial()); etat.curseur = 0; etat.enCours = true;
  while (etat.curseur < etat.etapes.length && mon === jeton) {
    const e = etat.etapes[etat.curseur]; montrer(e); etat.curseur += 1;
    await etat.scene.jouerEtape(e, 1);
  }
  if (mon === jeton) finRejeu();
}

async function pas() {
  if (etat.enCours) arreterRejeu();
  if (!etat.etapes.length) { await lancer({ pasAPas: true }); return; }
  if (etat.curseur >= etat.etapes.length || etat.curseur === 0) { etat.scene.preparerRejeu(etat.plateau, etatInitial()); etat.curseur = 0; document.querySelector(".bilan")?.remove(); }
  const e = etat.etapes[etat.curseur]; montrer(e); etat.curseur += 1;
  etat.enCours = true; await etat.scene.jouerEtape(e, 1); etat.enCours = false;
  if (etat.curseur >= etat.etapes.length) finRejeu();
}

function montrer(e) {
  etat.editeur.surligner(e.ligne);
  legende(`Étape ${etat.curseur + 1} sur ${etat.etapes.length}, ligne ${e.ligne} : ${decrire(e)}`, Boolean(e.erreur));
}

// Ce que fait une étape, en clair, et pour une erreur ce qui s'est passé sur la donnée.
function decrire(e) {
  const p = etat.plateau.poste(e.poste);
  if (!p) return "code libre.";
  const q = p.params, ligne = ligneDe(p).split("\n")[0];
  if (e.erreur) {
    const d = e.avant[q.source || q.cible], n = d ? d.n : null;
    if (e.erreur.type === "IndexError" && n !== null) return `IndexError : la case ${q.indice} n'existe pas. ${q.source || q.cible} a ${n} case${n > 1 ? "s" : ""}, numérotées de 0 à ${n - 1} (ou de -1 à -${n}).`;
    if (e.erreur.type === "ValueError" && p.type === "retirer") return `ValueError : ${ligne} cherche une valeur qui n'est pas sur le rayonnage. Vérifiez l'orthographe, ou testez avec in avant de retirer.`;
    if ((e.erreur.type === "TypeError" || e.erreur.type === "AttributeError") && d && d.t === "tuple") return `${e.erreur.type} : ${q.cible || q.source} est une caisse plombée (tuple). On la lit, on ne la modifie pas.`;
    return `${e.erreur.messageOriginal}. ${e.erreur.explication}`;
  }
  if (p.type === "afficher") return `${ligne} affiche ${e.affiche ?? ""}`;
  if (e.decision) return `${PIECES[p.type].nom} : ${e.decision}`;
  if (p.type === "renvoyer" && e.retour !== undefined) return `return ${p.params.expression} : la fonction renvoie ${e.retour}${e.retourOk === false ? ", ce n'est pas le résultat attendu" : ""}.`;
  return `${PIECES[p.type].nom} : ${ligne}`;
}

async function finRejeu() {
  etat.enCours = false;
  const r = etat.resultat, e = etat.etoiles || [false, false, false], x = execCourante();
  if (x && x.cas && !x.erreur && !etat.etapes.some((t) => t.retour !== undefined)) await etat.scene.finFonction(texteValeur(x.cas.retour), x.cas.ok);
  etat.scene.terminer({ reussi: Boolean(r && !r.erreur && e[0]) });
  etat.scene.construireDonnees(x?.etatFinal || etat.apercu);
  if (x && x.erreur) {
    const etape = etat.etapes[etat.etapes.length - 1];
    const quoi = x.cas ? `${x.cas.appel} s'arrête` : "Le programme s'est arrêté";
    legende(`${quoi} ligne ${x.erreur.ligne} : ${etape && etape.erreur ? decrire(etape) : x.erreur.explication || x.erreur.messageOriginal}`, true);
    etat.editeur.surligner(x.erreur.ligne); dessiner();
    return;
  }
  etat.editeur.surligner(null);
  if (x && x.cas && !x.cas.ok) { legende(`Cas ${etat.casCourant + 1} : ${x.cas.message} Choisissez un autre cas dans le menu pour le rejouer.`, true); return; }
  if (!e[0]) {
    legende(r && r.mode === "fonction" ? `Ce cas est juste, mais d'autres échouent : choisissez-les dans le menu des cas, ou regardez l'onglet Tests.` : "Le programme a tourné jusqu'au bout, mais des tests échouent : regardez l'onglet Tests.", true);
    return;
  }
  bilan(e);
}

function bilan(e) {
  const fond = creer("div", "bilan"), carte = creer("div", "bilan-carte");
  carte.setAttribute("role", "dialog"); carte.setAttribute("aria-label", "Mission réussie");
  const z = creer("div", "etoiles"); dessinerEtoiles(z, e);
  carte.append(creer("h2", "", etat.mission.fonction ? "La fonction passe les tests" : "Le programme tourne"), z);
  carte.append(creer("p", "", e[1] ? "Étoile 2 gagnée." : `Étoile 2 à gagner : ${etat.mission.etoiles.description2}. La solution est juste, mais cette mission entraîne cette notion-là.`));
  carte.append(creer("p", "", e[2] ? "Étoile 3 gagnée." : `Étoile 3 à gagner : ${etat.mission.etoiles.description3}.`));
  const r = etat.resultat, caches = (r && r.tests ? r.tests : []).filter((t) => t.groupe === "cache");
  if (caches.length) carte.append(creer("p", "", caches.every((t) => t.ok) ? "Contrôle surprise : réussi." : "Contrôle surprise : pas encore. Regardez le cas marqué « Contrôle surprise »."));
  const m = etat.mission, liste = etat.index.missions, rang = liste.findIndex((x) => x.id === m.id), suivante = liste[rang + 1];
  if (serieReussie(m.serie) && (!suivante || suivante.serie !== m.serie || suivante.bonus)) {
    const gagnees = missionsDeLaSerie(m.serie).reduce((s, x) => s + progression.fiche(x.id).etoiles.filter(Boolean).length, 0);
    carte.append(creer("p", "", `Série ${m.serie} réussie : ${gagnees} étoile(s) sur ${missionsDeLaSerie(m.serie).length * 3}.`));
    const prochaine = etat.index.series.find((s) => s.numero === m.serie + 1);
    if (prochaine) carte.append(creer("p", "", `Série ${prochaine.numero} ouverte. ${prochaine.outil}`));
  }
  const actions = creer("div", "bilan-actions");
  const ameliorer = creer("button", "bouton", "Améliorer"); ameliorer.type = "button"; ameliorer.addEventListener("click", () => fond.remove());
  actions.append(ameliorer);
  const b = creer("a", "bouton principal");
  if (suivante && serieOuverte(suivante.serie)) { b.textContent = "Mission suivante"; b.href = lienMission(suivante); }
  else { b.textContent = "Retour à la carte"; b.href = urlCarte(); }
  actions.append(b); carte.append(actions); fond.append(carte); $("vue").append(fond); b.focus();
  sons.jouer("etoile");
}

// ---------- onglets ----------
function afficherOnglet(nom) {
  etat.onglet = nom;
  for (const o of document.querySelectorAll(".onglet")) { o.setAttribute("aria-selected", String(o.dataset.onglet === nom)); if (o.dataset.onglet === nom) o.classList.remove("nouveau"); }
  const panneau = $("panneau"); panneau.innerHTML = ""; panneau.className = "panneau"; const r = etat.resultat;
  if (nom === "piece") ficheDuPoste(panneau);
  else if (nom === "tests") {
    if (!r || !r.tests) { panneau.append(creer("p", "vide", "Lancez le programme : les tests vérifient les données à la fin, et ce que le tableau de bord affiche.")); }
    else {
      for (const t of r.tests) {
        const ligne = creer("div", "test " + (t.ok ? "ok" : "echec")), texte = creer("span", "texte", t.libelle);
        if (t.groupe === "bonus") texte.append(creer("span", "badge-bonus", " ÉTOILE 3"));
        if (!t.ok && t.message) texte.append(creer("span", "detail", t.message));
        ligne.append(creer("span", "marque", t.ok ? "OK" : "ÉCHEC"), texte); panneau.append(ligne);
      }
      if (!r.tests.length) panneau.append(creer("p", "vide", "Aucun test n'a pu tourner : regardez l'onglet Problèmes."));
    }
  } else if (nom === "sortie") {
    if (r && r.sortie && r.sortie.length) panneau.append(creer("pre", "sortie", r.sortie.join("\n")));
    else panneau.append(creer("p", "vide", "Le tableau de bord affiche ici ce que les print() du programme écrivent."));
  } else if (nom === "problemes") {
    const x = execCourante(), err = x && x.erreur;
    if (err) {
      const etape = etat.etapes.find((t) => t.erreur);
      if (x.cas) panneau.append(creer("p", "erreur-conseil", `Cas ${etat.casCourant + 1} : ${x.cas.appel}`));
      panneau.append(creer("p", "erreur-original", err.messageOriginal + (err.ligne ? `  (ligne ${err.ligne})` : "")));
      if (etape) panneau.append(creer("p", "erreur-conseil", decrire(etape)));
      else if (err.explication) panneau.append(creer("p", "erreur-conseil", err.explication));
      panneau.append(creer("p", "erreur-conseil", err.conseil));
    } else panneau.append(creer("p", "vide", "Aucun problème."));
  } else {
    const echecs = progression.fiche(idProgression()).echecs || 0, n = ECHECS_AVANT_INDICE.filter((s) => echecs >= s).length;
    if (!n) panneau.append(creer("p", "vide", `Le premier indice s'ouvre après ${ECHECS_AVANT_INDICE[0]} lancements sans l'étoile 1.`));
    etat.mission.indices.slice(0, n).forEach((t, i) => panneau.append(creer("p", "indice", `Indice ${i + 1}. ${t}`)));
  }
  if (r && r.tests) {
    const v = r.tests.filter((t) => t.groupe === "visible"), b = r.tests.filter((t) => t.groupe === "bonus");
    $("resume-tests").textContent = `${v.filter((t) => t.ok).length} test(s) sur ${v.length}` + (b.length ? ` · étoile 3 : ${b.filter((t) => t.ok).length} sur ${b.length}` : "");
  } else $("resume-tests").textContent = "";
}

function ficheDuPoste(zone) {
  zone.classList.add("reglages", "fiche-piece");
  const p = etat.selection ? etat.plateau.poste(etat.selection) : null;
  if (!p) { zone.append(creer("p", "vide", "Cliquez sur un poste du hall (outil Choisir) : sa fiche s'affiche ici. Survolez une icône de la barre pour connaître une pièce avant de la poser.")); return; }
  const c = PIECES[p.type], cat = CATEGORIES[c.categorie];
  zone.style.setProperty("--couleur", cat.couleur);
  // les boutons d'abord : le panneau est bas, la description peut défiler
  const actions = creer("div", "actions");
  const bouton = (texte, f) => { const b = creer("button", "bouton", texte); b.type = "button"; b.addEventListener("click", f); actions.append(b); };
  if (p.type !== "code_libre") bouton("Modifier", () => ouvrirBullePoste(p, false));
  bouton("Plus tôt", () => { if (etat.plateau.decaler(p.id, -1)) apresChangementHall(); });
  bouton("Plus tard", () => { if (etat.plateau.decaler(p.id, 1)) apresChangementHall(); });
  bouton("Détruire", () => { etat.plateau.supprimer(p.id); etat.selection = null; apresChangementHall(); });
  zone.append(creer("h2", "", `${posteNumero(p)}`), actions, creer("span", "categorie", `${cat.nom}${cat.python ? " · " + cat.python : ""} · ${c.nature}`));
  zone.append(creer("p", "ligne-code", ligneDe(p)), creer("p", "aide", c.aide));
}

// ---------- commandes ----------
function installerCommandes() {
  $("bouton-lancer").addEventListener("click", () => lancer());
  $("bouton-rejouer").addEventListener("click", () => rejouer());
  $("bouton-pas").addEventListener("click", () => pas());
  $("bouton-pause").addEventListener("click", () => { const b = $("bouton-pause"), p = b.getAttribute("aria-pressed") !== "true"; b.setAttribute("aria-pressed", String(p)); etat.scene.enPause = p; });
  $("bouton-son").addEventListener("click", () => { const b = $("bouton-son"), a = b.getAttribute("aria-pressed") !== "true"; b.setAttribute("aria-pressed", String(a)); sons.activer(a); progression.reglage("son", a); });
  if (progression.reglage("son") === false) { $("bouton-son").setAttribute("aria-pressed", "false"); sons.activer(false); }
  $("bouton-agrandir").addEventListener("click", () => etat.editeur.agrandir && etat.editeur.agrandir());
  $("bouton-annuler").addEventListener("click", annuler);
  $("bouton-mode").addEventListener("click", () => { sauver(); progression.reglage("sans3d", !etat.scene.sansTroisD); location.reload(); });
  $("bouton-retablir").addEventListener("click", retablir);
  $("bouton-vitesse").addEventListener("click", () => {
    const b = $("bouton-vitesse"), rapide = b.getAttribute("aria-pressed") !== "true";
    b.setAttribute("aria-pressed", String(rapide)); etat.scene.vitesse = rapide ? VITESSE_RAPIDE : 1; progression.reglage("rejeuRapide", rapide);
  });
  if (progression.reglage("rejeuRapide")) $("bouton-vitesse").click();
  for (const o of document.querySelectorAll(".onglet")) o.addEventListener("click", () => afficherOnglet(o.dataset.onglet));
  $("choix-cas").addEventListener("change", () => {
    etat.casCourant = Number($("choix-cas").value); arreterRejeu(); document.querySelector(".bilan")?.remove();
    etat.etapes = construireEtapes(execCourante()); etat.curseur = 0; dessiner(); rejouer();
  });
  document.addEventListener("keydown", (e) => {
    const dansSaisie = ["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName) || e.target.closest?.(".cm-editor");
    if (e.key === "F10") { e.preventDefault(); pas(); return; }
    if (e.ctrlKey && e.key === "Enter") { e.preventDefault(); lancer(); return; }
    if (dansSaisie || document.querySelector(".bulle")) return;
    // Ctrl+Z dans l'éditeur : l'annulation de l'éditeur ; dans le hall : celle du hall et du code ensemble
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === "z" || e.key === "Z")) { e.preventDefault(); annuler(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y" || (e.shiftKey && (e.key === "z" || e.key === "Z")))) { e.preventDefault(); retablir(); return; }
    if (e.key === "Escape") { etat.barre.fermerSousMenu(); if (etat.plateau.trace) { etat.plateau.annulerTrace(); dessiner(); legende("Tapis annulé."); } else { etat.barre.choisir({ outil: "choisir" }); dessiner(); } }
    if ((e.key === "Delete" || e.key === "Backspace") && etat.selection) { etat.plateau.supprimer(etat.selection); etat.selection = null; apresChangementHall(); }
    if (e.key === "p" || e.key === "P") $("bouton-pause").click();
    if (e.key === "m" || e.key === "M") $("bouton-son").click();
  });
}

window.jeu = { etat, pilote, lancer, rejouer, pas, PlateauAtelier, apresChangementHall, planifierAnalyse };
window.addEventListener("hashchange", () => location.reload());   // « Mission suivante » d'une mission d'atelier à l'autre
demarrer();
