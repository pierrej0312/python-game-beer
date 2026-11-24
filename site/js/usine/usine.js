// L'usine de la Fonderie : contrôleur de la page (prototype du 20/11/2026, voir CONCEPTION-usine.md).
// Le code est la référence. Construire (poser, régler, retirer, déplacer une machine) modifie le code ;
// écrire le code redessine l'usine. « Mettre en marche » exécute le code et fait rouler un fût de machine en machine.
import * as progression from "../commun/progression.js";
import { PilotePython } from "../commun/python.js";
import { creerEditeur } from "../commun/editeur.js";
import * as sons from "../commun/sons.js";
import { texteValeur } from "../commun/valeurs.js";
import { disposer } from "./disposition.js";
import { GABARITS, CATEGORIES, gabaritsDe, inserer, lireLigne, remplacerLigne, retirer, deplacer, numeroter, ajouterElif, ajouterSinon, retirerVoie, enteteVoie } from "./code.js";
import { creerSceneUsine, familleDe } from "./scene-usine.js";
import { vignette } from "./vignettes-usine.js";

const DELAI_ANALYSE_MS = 400;
const COULEUR_FAMILLE = { variable: "#4fc4a0", liste: "#f5b82e", tuple: "#ef8a6a", dict: "#f39ac0", set: "#9be08a", condition: "#c9a3f5", boucle: "#5ad1e0", sortie: "#8fb3ff", quai: "#23ab67", fonction: "#ffb347", fichier: "#c27a3e" };
const $ = (id) => document.getElementById(id);
const creer = (balise, classe, texte) => { const e = document.createElement(balise); if (classe) e.className = classe; if (texte !== undefined) e.textContent = texte; return e; };
// Deux façons de jouer (décidé le 20/11/2026) : l'usine en 3D (graphismes complets ou légers), ou le code seul, sans 3D,
// pour qui préfère écrire ou pour un poste trop lent. Même réglage que la carte des missions (« sans3d »).
const CODE_SEUL = Boolean(progression.reglage("sans3d"));
// En code seul, pas de scène 3D : chaque appel à la scène ne fait rien (et ne coûte rien).
const sceneVide = () => new Proxy({}, { get: (_, cle) => (cle === "then" ? undefined : () => undefined) });
const etat = { mission: null, tests: "", analyse: null, disposition: null, syntaxe: null, outil: null, reglage: null, resultat: null,
  enMarche: false, arret: false, rapide: false, historique: [], position: -1, ignorer: false, casCourant: 0, sectionsOuvertes: new Set(), modulesOuverts: new Set() };

const pilote = new PilotePython((nom) => {
  const e = $("etat-python");
  if (nom === "pret") { e.textContent = "Python est prêt"; e.className = "etat-python pret"; }
  if (nom === "chargement") { e.textContent = "Préparation de Python…"; e.className = "etat-python"; }
  if (nom === "echec") { e.textContent = "Python n'a pas pu se charger. Rechargez la page."; e.className = "etat-python echec"; }
});

function legende(texte, echec = false) { const z = $("legende"); z.textContent = texte; z.classList.toggle("echec", echec); }
const idProgression = () => etat.mission.id;

function dessinerEtoiles(conteneur, liste) {
  conteneur.innerHTML = "";
  liste.forEach((gagnee) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("class", "etoile" + (gagnee ? " gagnee" : "")); svg.setAttribute("aria-hidden", "true");
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", "M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z");
    svg.append(p); conteneur.append(svg);
  });
}

// ---------- chargement ----------
async function demarrer() {
  const index = await (await fetch("missions/index.json")).json();
  const voulu = new URLSearchParams(location.hash.slice(1)).get("mission") || "4.4-file-commandes";
  const fiche = index.missions.find((m) => m.id === voulu && m.atelier);
  if (!fiche) { legende(`Mission inconnue : ${voulu}.`, true); return; }
  etat.mission = await (await fetch(`atelier/missions/${fiche.id}/mission.json`)).json();
  etat.tests = await (await fetch(`atelier/missions/${fiche.id}/tests.py`)).text();
  const m = etat.mission, serie = index.series.find((x) => x.numero === m.serie);
  document.title = `L'usine · Mission ${m.serie}.${m.numero}`;
  $("mission-id").textContent = `MISSION ${m.serie}.${m.numero}`;
  $("mission-surtitre").textContent = `Série ${m.serie} · ${serie ? serie.titre : m.notion}` + (m.bonus ? " · Bonus" : "");
  $("mission-titre").textContent = m.titre;
  $("mission-enonce").textContent = m.enonce;
  if (m.exemple) { $("mission-exemple").textContent = m.exemple; $("mission-exemple").hidden = false; }
  // le plan de construction (machines à poser) : replié, et inutile en mode code seul
  if (m.construire && !CODE_SEUL) { $("mission-plan-texte").textContent = m.construire; $("mission-plan").hidden = false; }
  $("bouton-carte").href = "missions.html" + location.search;
  $("nom-fichier").textContent = m.fonction ? `${m.fonction.nom}.py` : "programme.py";
  $("bouton-lancer").textContent = m.fonction ? "Mettre en marche (tests)" : "Mettre en marche";
  const code = progression.fiche(idProgression()).code ?? m.depart ?? "";
  etat.editeur = creerEditeur($("editeur"), { texte: code, surChangement: () => { if (!etat.ignorer) planifierAnalyse(); }, surExecuter: () => lancer(),
    surCurseur: (l) => { clearTimeout(etat.minuterieCurseur); etat.minuterieCurseur = setTimeout(() => allerALaLigne(l), 180); }, libelle: "Code Python" });
  if (CODE_SEUL) preparerCodeSeul();
  etat.scene = CODE_SEUL ? sceneVide() : creerSceneUsine($("vue"), { qualite: progression.reglage("qualite") === "basse" ? "basse" : "haute", surFente, surMachine, surVide,
    surModule: (nom, ouvert) => { if (ouvert) etat.modulesOuverts.add(nom); else etat.modulesOuverts.delete(nom); redessiner(); }, surSurvol: (m) => { if (!etat.enMarche && m.texte) legende(`Ligne ${m.ligne} : ${m.texte}  (clic : régler)`); } });
  construireBarre();
  majObjectifs(); afficherOnglet("tests");
  memoriser();
  legende(CODE_SEUL ? "Écrivez le code, puis « Exécuter » (Ctrl+Entrée) lance les tests. F8 exécute jusqu'à la ligne du curseur : l'onglet Variables montre les valeurs à ce moment."
    : "Choisissez une machine en bas (ou touches 1 à 9), puis cliquez sur un « + » jaune du convoyeur. Cliquez sur une machine pour la régler. Glissez pour vous déplacer, molette pour zoomer.");
  installerClavier();
  await analyser({ cadrer: true });
  memoriser();
}

// Code seul : l'éditeur prend la place de l'usine, à gauche ; à droite, l'énoncé et les tests ont toute la hauteur.
function preparerCodeSeul() {
  document.body.classList.add("mode-code");
  $("vue").append(document.querySelector(".zone-editeur"));
  document.querySelector(".info-code").textContent = "code seul : l'usine est masquée (menu d'affichage, en haut)";
  document.querySelector('.onglet[data-onglet="donnees"]').textContent = "Variables";
  $("bouton-lancer").textContent = "Exécuter (tests)";
  $("bouton-curseur").textContent = "Jusqu'au curseur (F8)";
}

// ---------- analyse : le code redessine l'usine ----------
let minuterie = null;
function planifierAnalyse() { clearTimeout(minuterie); minuterie = setTimeout(() => analyser(), DELAI_ANALYSE_MS); }

async function analyser({ cadrer = false } = {}) {
  const code = etat.editeur.lire();
  let a;
  try { a = await pilote.analyserAtelier(code, etat.mission.fonction || null, true); } catch { return null; }
  if (!a.ok) {
    etat.syntaxe = a.erreur;
    $("bandeau").hidden = false; $("bandeau").classList.remove("info");
    $("bandeau").textContent = a.erreur.horsFonction ? `Ligne ${a.erreur.ligne} : ${a.erreur.message}. L'usine attend que le code soit corrigé.`
      : `Ligne ${a.erreur.ligne} : Python ne comprend pas encore cette ligne (${a.erreur.message}). L'usine attend que le code soit corrigé.`;
    return a;
  }
  etat.syntaxe = null;
  const avert = a.avertissements && a.avertissements[0];
  $("bandeau").hidden = !avert; $("bandeau").classList.toggle("info", !!(avert && avert.essais));
  if (avert) $("bandeau").textContent = (avert.essais ? "" : "Attention : ") + avert.message;
  numeroter(a.postes); if (a.modules) numeroter(a.modules, "annexe"); if (a.essais) numeroter(a.essais, "essai");
  etat.analyse = a;
  const avant = etat.disposition && etat.disposition.etendue;
  etat.disposition = disposer(a, code, { fonction: etat.mission.fonction || null, sectionsOuvertes: etat.sectionsOuvertes, modulesOuverts: etat.modulesOuverts });
  const e = etat.disposition.etendue;
  // l'usine grandit (ou rétrécit) : la vue suit, pour que la ligne reste entière à l'écran
  const change = !avant || avant.x2 !== e.x2 || avant.z1 !== e.z1 || avant.z2 !== e.z2;
  // le parc montre les valeurs de départ, sauf si le code n'a pas changé depuis la dernière marche (il garde alors l'état final)
  if (code !== etat.codeMarche) etat.scene.reinitialiserStock(etatInitial());
  const neuves = etat.scene.construire(etat.disposition, { cadrer: cadrer || change });
  progression.sauverCode(idProgression(), code);
  return a;
}

// Les variables au départ : pour une fonction, ses paramètres reçoivent les valeurs du premier cas de test.
function encoder(v, type = null) {
  if (v === null || v === undefined) return { t: "None" };
  if (typeof v === "boolean") return { t: "bool", v };
  if (typeof v === "number") return { t: Number.isInteger(v) ? "int" : "float", v };
  if (typeof v === "string") return { t: "str", v };
  if (Array.isArray(v)) return { t: type === "tuple" ? "tuple" : type === "set" ? "set" : "list", v: v.map((x) => encoder(x)), n: v.length };
  // un tuple dans un cas de test s'écrit {"__tuple__": [...]} (le JSON n'a pas de tuple) : c'est un tuple, pas un dictionnaire
  if (Object.keys(v).length === 1 && Array.isArray(v.__tuple__)) return { t: "tuple", v: v.__tuple__.map((x) => encoder(x)), n: v.__tuple__.length };
  return { t: "dict", v: Object.entries(v).map(([k, x]) => [encoder(k), encoder(x)]), n: Object.keys(v).length };
}
function etatInitial() {
  const f = etat.mission.fonction, cas = etat.mission.cas && etat.mission.cas[0];
  if (!f || !cas || !cas.args) return {};
  return Object.fromEntries(f.parametres.filter((n, i) => i < cas.args.length).map((n, i) => [n, encoder(cas.args[i], f.types && f.types[n])]));
}

// Écrit un nouveau code (venu de l'usine) dans l'éditeur, puis redessine.
async function ecrireCode(code, { cadrer = false } = {}) {
  etat.ignorer = true; etat.editeur.ecrire(code); etat.ignorer = false;
  const a = await analyser({ cadrer });
  memoriser();
  return a;
}

// ---------- annuler, rétablir ----------
function memoriser() {
  const code = etat.editeur.lire(), h = etat.historique;
  if (h[etat.position] === code) return;
  h.splice(etat.position + 1); h.push(code); if (h.length > 100) h.shift();
  etat.position = h.length - 1; majHistorique();
}
function majHistorique() { $("bouton-annuler").disabled = etat.position <= 0; $("bouton-retablir").disabled = etat.position >= etat.historique.length - 1; }
async function revenir(sens) {
  const i = etat.position + sens; if (i < 0 || i >= etat.historique.length) return;
  etat.position = i; fermerReglage(); fermerPalette();
  etat.ignorer = true; etat.editeur.ecrire(etat.historique[i]); etat.ignorer = false;
  await analyser(); majHistorique();
}

// ---------- la barre de construction ----------
// ---------- la barre de construction et le menu « Ajouter » (à la Blender) ----------
// La barre montre les catégories ; un clic (ou la touche 1 à 8) ouvre le menu : les catégories à gauche, leurs machines
// à droite, chacune avec la vignette de son modèle 3D. Maj+A ouvre le même menu sous la souris ; un « + » aussi.
const imageDe = (id) => { const g = GABARITS[id]; return vignette(g.modele || id, g.genre ? { genre: g.genre } : null); };
function construireBarre() {
  const barre = $("barre-construction"); barre.innerHTML = "";
  etat.gabarits = gabaritsDe(etat.mission.palette, etat.mission.fonction);
  etat.categories = CATEGORIES.map((c) => ({ ...c, machines: c.machines.filter((id) => etat.gabarits.includes(id)) })).filter((c) => c.machines.length);
  etat.categories.forEach((c, i) => {
    const b = creer("button", "categorie-bouton"); b.type = "button"; b.dataset.categorie = c.id; b.title = c.nom;
    const img = creer("img"); img.alt = ""; img.src = imageDe(c.machines[0]);
    b.append(img, creer("span", "nom", c.nom), creer("span", "nombre", `${c.machines.length} machine${c.machines.length > 1 ? "s" : ""}`));
    if (i < 8) b.append(creer("span", "touche", String(i + 1)));
    b.addEventListener("click", () => {
      const r = b.getBoundingClientRect(), v = $("vue").getBoundingClientRect();
      ouvrirMenu({ x: r.left - v.left, y: v.height - 8, depuisBas: true, categorie: c.id });
    });
    barre.append(b);
  });
  // séries 6 à 8 : jusqu'à 8 catégories ; la barre se resserre pour qu'elles tiennent toutes sur un écran de 1366 px
  barre.classList.toggle("serree", etat.categories.length > 5);
  $("outil-actif")?.remove();
  const outil = creer("div", "outil-actif"); outil.id = "outil-actif"; outil.hidden = true; $("vue").append(outil);
}

// Le menu « Ajouter ». x, y : position dans la vue ; fente : si le menu vient d'un « + », la machine choisie y est posée.
function ouvrirMenu({ x, y, fente = null, categorie = null, depuisBas = false }) {
  const p = $("palette"); p.innerHTML = ""; p.className = "palette menu-ajout";
  const gauche = creer("div", "menu-categories"), droite = creer("div", "menu-machines");
  p.append(gauche, droite);
  etat.menu = { fente, categorie: categorie || etat.categories[0]?.id };
  const montrer = (id) => {
    etat.menu.categorie = id;
    for (const e of gauche.children) e.setAttribute("aria-current", String(e.dataset.categorie === id));
    droite.innerHTML = "";
    const c = etat.categories.find((x) => x.id === id);
    droite.append(creer("div", "menu-titre", c.nom));
    c.machines.forEach((mid, i) => {
      const g = GABARITS[mid], carte = creer("button", "carte-machine"); carte.type = "button"; carte.setAttribute("role", "menuitem");
      carte.style.setProperty("--famille", COULEUR_FAMILLE[g.famille] || "#9aa0ad");
      const img = creer("img"); img.alt = ""; img.src = imageDe(mid);
      const texte = creer("span", "texte");
      texte.append(creer("span", "nom", g.nom), creer("span", "python", g.lignes[0].replace(/[⟦⟧]/g, "")), creer("span", "aide", g.aide || ""));
      carte.append(img, texte);
      if (i < 9) carte.append(creer("span", "touche", String(i + 1)));
      carte.addEventListener("click", () => choisirDansMenu(mid));
      droite.append(carte);
    });
  };
  etat.categories.forEach((c) => {
    const b = creer("button", "menu-categorie"); b.type = "button"; b.dataset.categorie = c.id;
    const img = creer("img"); img.alt = ""; img.src = imageDe(c.machines[0]);
    b.append(img, creer("span", "", c.nom));
    b.addEventListener("mouseenter", () => montrer(c.id));
    b.addEventListener("click", () => montrer(c.id));
    gauche.append(b);
  });
  montrer(etat.menu.categorie);
  p.hidden = false;
  const v = $("vue").getBoundingClientRect(), r = p.getBoundingClientRect();
  p.style.left = Math.max(6, Math.min(x, v.width - r.width - 6)) + "px";
  p.style.top = (depuisBas ? Math.max(6, y - r.height) : Math.max(6, Math.min(y, v.height - r.height - 6))) + "px";
  droite.querySelector("button")?.focus();
}
function choisirDansMenu(id) {
  const fente = etat.menu && etat.menu.fente;
  fermerPalette();
  if (fente) poser(fente, id); else choisirOutil(id);
}
function fermerPalette() { $("palette").hidden = true; etat.menu = null; }
function ouvrirPalette(fente, ev) {
  const r = $("vue").getBoundingClientRect();
  ouvrirMenu({ x: ev.clientX - r.left + 8, y: ev.clientY - r.top + 8, fente });
}

function choisirOutil(id) {
  etat.outil = id;
  const g = id && GABARITS[id];
  etat.scene.choisirOutil(id ? (g.modele || id) : null, g && g.genre ? { genre: g.genre } : null);
  const o = $("outil-actif");
  if (o) {
    o.hidden = !id; o.innerHTML = "";
    if (id) { const img = creer("img"); img.alt = ""; img.src = imageDe(id); o.append(img, creer("span", "", `${g.nom} : cliquez sur un « + »`), creer("span", "touche", "Échap")); }
  }
  for (const b of document.querySelectorAll(".categorie-bouton")) b.setAttribute("aria-pressed", String(!!id && etat.categories.find((c) => c.id === b.dataset.categorie)?.machines.includes(id)));
  if (id) legende(`${g.nom} : cliquez sur un « + » jaune du convoyeur pour la poser. Échap pour poser l'outil.`);
}

// ---------- construire ----------
function bloque() {
  if (etat.enMarche) { legende("L'usine tourne : arrêtez-la avant de construire."); return true; }
  if (etat.syntaxe) { legende(`Corrigez d'abord la ligne ${etat.syntaxe.ligne} du code : l'usine reprend dès que Python la comprend.`, true); return true; }
  return false;
}

function surFente(fente, ev) {
  if (bloque()) return;
  fermerReglage();
  if (etat.outil) { poser(fente, etat.outil); return; }
  ouvrirPalette(fente, ev);
}

async function poser(fente, idGabarit) {
  fermerPalette();
  const r = inserer(etat.editeur.lire(), fente.cible, idGabarit);
  const a = await ecrireCode(r.code);
  if (!a || !a.ok) return;
  const m = etat.disposition.machines.find((x) => x.ligne === r.ligne && !x.decor);
  if (m) ouvrirReglage(m, { selection: [r.debut, r.fin], neuve: true });
}


// Naviguer depuis le code : la vue va à la machine de la ligne du curseur (en ouvrant sa section ou son module au besoin).
function allerALaLigne(l) {
  if (CODE_SEUL) return;
  if (etat.enMarche || !etat.disposition || etat.syntaxe) return;
  let m = machineDeLigne(l);
  if (m && m.role === "section") { basculerSection(m.section, true); m = machineDeLigne(l); }
  if (!m) return;
  if (m.module && !etat.scene.moduleOuvert(m.module)) etat.scene.ouvrirModule(m.module, true);
  etat.scene.viser(m.x, m.z, Math.max(etat.scene.zoomActuel(), 1.3));
  etat.scene.signaler(m.id);
}

// Redessine l'usine avec la même analyse (une section ouverte ou fermée) : rien n'est réexécuté.
function redessiner() {
  if (!etat.analyse) return;
  etat.disposition = disposer(etat.analyse, etat.editeur.lire(), { fonction: etat.mission.fonction || null, sectionsOuvertes: etat.sectionsOuvertes, modulesOuverts: etat.modulesOuverts });
  etat.scene.construire(etat.disposition);
}
function basculerSection(id, ouvrir) {
  if (ouvrir) etat.sectionsOuvertes.add(id); else etat.sectionsOuvertes.delete(id);
  redessiner();
}

// Un module (def) : un clic l'ouvre et la vue entre dedans ; Échap ou « Tout voir » en ressort.
function entrerModule(m) {
  etat.scene.ouvrirModule(m.nom, true); fermerReglage();
  const ouvert = etat.disposition.machines.find((x) => x.role === "module" && x.nom === m.nom);
  etat.scene.cadrerBoite((ouvert || m).boite);
  legende(`Dans le module ${m.nom} : sa propre ligne, ses propres variables (au fond). Les « + » ajoutent une machine dans la fonction. Échap pour ressortir.`);
}
function sortirModules() {
  const ouverts = etat.disposition.machines.filter((x) => x.role === "module" && etat.scene.moduleOuvert(x.nom));
  ouverts.forEach((x) => etat.scene.ouvrirModule(x.nom, false));
  return ouverts.length > 0;
}
function surMachine(m) {
  if (bloque()) return;
  fermerPalette();
  if (m.role === "module") { entrerModule(m); return; }
  if (m.role === "section") { basculerSection(m.section, true); legende(`Atelier ouvert : ${m.texte}. Cliquez sur son enseigne pour le replier.`); return; }
  if (m.role === "enseigne") { basculerSection(m.section, false); return; }
  ouvrirReglage(m.role === "groupeur" ? etat.disposition.machines.find((x) => x.id === m.poste.id) : m);
}
function surVide() { fermerPalette(); fermerReglage(); }

// Le réglage : la ligne de la machine, éditée sur place, au-dessus d'elle.
function ouvrirReglage(m, { selection = null, neuve = false } = {}) {
  const boite = $("reglage"), champ = $("champ-ligne");
  etat.reglage = { machine: m, neuve };
  const pos = etat.scene.projeter(m.x, m.z, 2.2);
  boite.style.left = pos.left + "px"; boite.style.top = pos.top + "px";
  $("reglage-titre").textContent = `${nomMachine(m)} · ligne ${m.ligne}`;
  boite.querySelector(".erreur")?.remove();
  champ.value = lireLigne(etat.editeur.lire(), m.ligne);
  boite.hidden = false; champ.focus();
  voiesDuRepartiteur(m);
  // la boîte ne sort pas de la vue : trop haute, elle passe sous la machine
  const vue = $("vue").getBoundingClientRect(), r = boite.getBoundingClientRect();
  if (r.top < vue.top + 4) boite.style.top = (etat.scene.projeter(m.x, m.z, 0).top + r.height + 24) + "px";
  const r2 = boite.getBoundingClientRect();
  if (r2.left < vue.left + 4) boite.style.left = (parseFloat(boite.style.left) + vue.left + 4 - r2.left) + "px";
  if (r2.right > vue.right - 4) boite.style.left = (parseFloat(boite.style.left) - (r2.right - vue.right + 4)) + "px";
  if (selection && selection[0] >= 0) champ.setSelectionRange(selection[0], selection[1]); else champ.select();
  etat.editeur.surligner(m.ligne);
}
function fermerReglage() { $("reglage").hidden = true; etat.reglage = null; etat.editeur.surligner(null); }

// Un répartiteur se règle voie par voie : chaque condition (if, elif) a son champ ; on ajoute une voie elif ou la voie sinon.
function voiesDuRepartiteur(m) {
  $("reglage").querySelector(".voies")?.remove();
  if (m.type !== "si") return;
  const p = m.poste, code = etat.editeur.lire(), boite = creer("div", "voies");
  p.branches.forEach((b, k) => {
    const ligne = creer("div", "voie");
    const n = p.params.conditions.length;
    if (k === 0) { ligne.append(creer("span", "nom-voie", "voie 1 : la condition ci-dessus")); }
    else if (k < n) {
      const champ = creer("input", "code"); champ.type = "text"; champ.spellcheck = false; champ.value = lireLigne(code, p.entetes[k]);
      champ.setAttribute("aria-label", `Condition de la voie ${k + 1} (elif)`);
      champ.addEventListener("keydown", async (ev) => {
        if (ev.key !== "Enter") return; ev.preventDefault();
        const a = await ecrireCode(remplacerLigne(etat.editeur.lire(), p.entetes[k], champ.value));
        if (a && a.ok) rouvrir(m.ligne); else legende("Python ne comprend pas cette condition : elle doit s'écrire elif condition:", true);
      });
      ligne.append(creer("span", "nom-voie", `voie ${k + 1}`), champ);
    } else ligne.append(creer("span", "nom-voie", `voie ${k + 1} : sinon (else), quand aucune condition n'est vraie`));
    if (k > 0) {
      const x = creer("button", "bouton-voie", "Retirer"); x.type = "button"; x.title = `Retirer la voie ${k + 1} et son contenu`;
      x.addEventListener("click", async () => { const c = retirerVoie(etat.editeur.lire(), p, k); if (c) { await ecrireCode(c); rouvrir(m.ligne); } });
      ligne.append(x);
    }
    boite.append(ligne);
  });
  const actions = creer("div", "actions-voies");
  const elif = creer("button", "bouton-voie", "+ voie elif"); elif.type = "button";
  elif.addEventListener("click", async () => { const r = ajouterElif(etat.editeur.lire(), p); await ecrireCode(r.code); rouvrir(m.ligne, r.ligne); });
  actions.append(elif);
  if (!p.params.sinon) {
    const sinon = creer("button", "bouton-voie", "+ voie sinon (else)"); sinon.type = "button";
    sinon.addEventListener("click", async () => { const r = ajouterSinon(etat.editeur.lire(), p); await ecrireCode(r.code); rouvrir(m.ligne); });
    actions.append(sinon);
  }
  boite.append(actions);
  $("reglage").append(boite);
  $("reglage-aide").textContent = "Entrée : valider · Échap : fermer · une voie par condition, testées dans l'ordre";
}

// Rouvre le réglage du répartiteur après une modification (sa ligne n'a pas bougé) ; met le curseur sur la voie neuve.
function rouvrir(ligne, ligneNeuve = null) {
  const m = etat.disposition.machines.find((x) => x.ligne === ligne && x.type === "si");
  if (!m) { fermerReglage(); return; }
  ouvrirReglage(m);
  if (ligneNeuve) {
    const champ = [...$("reglage").querySelectorAll(".voies input")].find((c) => c.value.startsWith("elif condition"));
    if (champ) { champ.focus(); champ.setSelectionRange(5, 14); }
  }
}

function nomMachine(m) {
  const noms = { si: "Trieur", pour: "Distributeur", tantque: "Cuve à boucle", renvoyer: "Retour", afficher: "Imprimante", code_libre: "Établi",
    bloc: "Sas", partie: "Sas", importer: "Livraison", module: "Module", sortir: "Arrêt de boucle", suivant: "Tremplin", passer: "Plaque pass" };
  if (m.appel) return "Poste d'appel";
  return noms[m.type] || GABARITS[m.type]?.nom || "Machine";
}

async function validerReglage() {
  const r = etat.reglage; if (!r) return;
  const texte = $("champ-ligne").value;
  if (!texte.trim()) { await retirerMachine(r.machine); return; }
  const ancien = etat.editeur.lire();
  const a = await ecrireCode(remplacerLigne(ancien, r.machine.ligne, texte));
  if (a && !a.ok) {
    const e = creer("div", "erreur", `Python ne comprend pas cette ligne : ${a.erreur.message}.`);
    $("reglage").querySelector(".erreur")?.remove(); $("reglage").append(e); $("champ-ligne").focus();
    return;
  }
  sons.jouer("clic"); fermerReglage();
}

function cibleDe(poste) { return etat.disposition.fentes.map((f) => f.cible).find((c) => c.postes.includes(poste)); }

async function retirerMachine(m) {
  const poste = m.poste, cible = cibleDe(poste);
  fermerReglage();
  await ecrireCode(retirer(etat.editeur.lire(), poste, cible));
  sons.jouer("choc"); legende(`Machine retirée : sa ligne a disparu du code. Annuler : Ctrl+Z.`);
}

async function deplacerMachine(m, sens) {
  const cible = cibleDe(m.poste); if (!cible) return;
  const code = deplacer(etat.editeur.lire(), cible.postes, cible.postes.indexOf(m.poste), sens);
  if (!code) return;
  const ligne = m.ligne;
  fermerReglage(); await ecrireCode(code);
  legende(sens < 0 ? "Machine avancée d'un poste : elle tourne plus tôt." : "Machine reculée d'un poste : elle tourne plus tard.");
  const autre = etat.disposition.machines.find((x) => x.texte === m.texte && x.type === m.type && x.ligne !== ligne) || etat.disposition.machines.find((x) => x.texte === m.texte && x.type === m.type);
  if (autre) ouvrirReglage(autre);
}

// ---------- mettre en marche ----------
function etoilesDe(r) {
  if (r.erreur) return [false, false, false];
  const vis = r.tests.filter((t) => t.groupe === "visible"), bon = r.tests.filter((t) => t.groupe === "bonus");
  const e1 = vis.length > 0 && vis.every((t) => t.ok);
  // étoile 2 : la notion de la série est utilisée (vérifiée en Python, atelier.notion_ok) ; plus de limite d'instructions
  return [e1, e1 && r.notionOk !== false, e1 && bon.length > 0 && bon.every((t) => t.ok)];
}

// Une solution juste qui contourne la notion de la mission : on le dit, sans la refuser.
function messageNotion(etoiles) {
  const n = etat.mission.etoiles.notion;
  if (!etoiles[0] || etoiles[1] || !n) return "";
  return `Juste, et la commande est livrée. Cette mission entraîne une notion précise : ${n.texte.charAt(0).toLowerCase() + n.texte.slice(1)}. Refaites-la ainsi pour l'étoile 2.`;
}

async function lancer({ jusqua = null } = {}) {
  if (etat.enMarche) return;
  etat.jusqua = jusqua;
  fermerReglage(); fermerPalette(); choisirOutil(null);
  const a = await analyser();
  if (!a || !a.ok) { legende("Le code ne s'analyse pas : corrigez la ligne signalée, puis remettez en marche.", true); sons.jouer("alerte"); return; }
  etat.codeMarche = etat.editeur.lire();
  etat.enMarche = true; etat.arret = false; etat.scene.marche(true); $("bouton-arret").disabled = false; $("bouton-lancer").disabled = true;
  try {
    const r = await pilote.executerAtelier(etat.mission, etat.editeur.lire(), etat.tests);
    etat.resultat = r;
    const etoiles = etoilesDe(r);
    progression.noterResultat(idProgression(), etoiles, etat.editeur.lire());
    majObjectifs(); afficherOnglet("tests");
    let x = r;
    if (r.mode === "fonction") {
      const rangs = r.cas.map((c, i) => i), faux = rangs.find((i) => !r.cas[i].ok && r.cas[i].groupe === "visible") ?? rangs.find((i) => !r.cas[i].ok);
      etat.casCourant = faux ?? 0; x = r.cas[etat.casCourant] || { trace: [], sortie: [] };
      legende(`Le fût porte le cas ${etat.casCourant + 1} : ${r.cas[etat.casCourant]?.appel || ""}`);
    }
    const arrete = await rejouer(x);
    const vis = r.tests.filter((t) => t.groupe === "visible");
    if (arrete) { /* arrêt à la ligne du curseur : la légende le dit, la livraison attendra la marche complète */ }
    else if (etoiles[0]) {
      legende(messageNotion(etoiles) || `Commande livrée : ${vis.length} test(s) sur ${vis.length}. Étoiles : ${etoiles.filter(Boolean).length} sur 3.`);
      const d = etat.disposition, bout = d.stations.find((x) => x.role === "fin") || d.machines.find((x) => x.role === "quai") || { x: d.etendue.x2 - 3, z: 0 };
      await etat.scene.livrer(bout.x, bout.z, etoiles.filter(Boolean).length);
    }
    else if (r.erreur || (x && x.erreur)) {
      sons.jouer("rate");
      const err = (x && x.erreur) || r.erreur;
      if (err) { legende(`Ligne ${err.ligne} : ${err.explication || err.messageOriginal}`, true); etat.ligneErreur = err.ligne; }
    }
    else { sons.jouer("rate"); legende(`Livraison refusée : ${vis.filter((t) => t.ok).length} test(s) sur ${vis.length}. L'onglet Tests dit ce qui manque.`, true); }
  } finally {
    etat.enMarche = false; etat.jusqua = null; etat.scene.marche(false); $("bouton-arret").disabled = true; $("bouton-lancer").disabled = false;
    etat.scene.cacherBulle(); etat.editeur.surligner(etat.ligneErreur || null); etat.ligneErreur = null;
  }
}

function machineDeLigne(l) {
  const ms = etat.disposition.machines.filter((m) => m.role !== "groupeur" && m.role !== "collecteur" && m.role !== "enseigne");
  // la ligne def : Python enregistre la fonction (le bâtiment s'allume), elle ne tourne pas encore
  return ms.find((m) => m.ligne === l) || ms.find((m) => m.poste && m.poste.entetes && m.poste.entetes.includes(l))
    // la ligne est dans une section repliée : l'atelier travaille pour elle
    || ms.find((m) => m.role === "section" && l >= m.lignes[0] && l <= m.lignes[1])
    || ms.find((m) => m.role === "module" && !m.ouvert && l >= m.lignes[0] && l <= m.lignes[1]);
}

// Les variables que lit une ligne : les noms qu'elle cite, connus du parc, et que la ligne ne modifie pas.
const MOTS = new Set(["for", "in", "if", "elif", "else", "while", "not", "and", "or", "return", "print", "len", "sorted", "True", "False", "None", "is", "range", "enumerate"]);
function lecturesDe(texte, changes, module = null) {
  const sans = (texte || "").replace(/#.*$/, "").replace(/(["'])(?:\\.|(?!\1).)*\1/g, '""');
  const noms = new Set((sans.match(/(?<![.\w])[A-Za-z_]\w*/g) || []).filter((n) => !MOTS.has(n) && !changes.includes(n) && etat.scene.connaitStock(n, module)));
  return [...noms].slice(0, 3);
}
// La voie que prend le fût à la sortie d'une trieuse : celle de la branche où il entre, sinon la voie directe.
function voieChoisie(p, suivant) {
  const k = p.branches.findIndex((b) => b.length && suivant && suivant.l >= b[0].lignes[0] && suivant.l <= b[b.length - 1].lignes[1]);
  return k >= 0 ? k : p.branches.length;
}

// Ce que la machine montre en travaillant : le trieur prend-il la bouteille ? la boucle refait-elle un tour ?
const dansBloc = (liste, l) => !!l && liste.length > 0 && l >= liste[0].lignes[0] && l <= liste[liste.length - 1].lignes[1];
function infoTravail(m, suivant, tours) {
  const p = m.poste, l = suivant && suivant.l;
  if (m.type === "si") return { prend: voieChoisie(p, suivant) === m.voie };
  if (m.type === "pour" || m.type === "tantque") {
    const dedans = dansBloc(p.branches[0], l);
    if (dedans) tours[m.id] = (tours[m.id] || 0) + 1;
    return { dedans, vrai: dedans };
  }
  return {};
}

// Le rejeu suit la bouteille de machine en machine. Quand le programme appelle une de ses fonctions, la bouteille prend
// le tube d'appel, le module s'ouvre, elle parcourt la ligne intérieure (ses variables sont celles du module), puis revient
// par le même tube au poste d'appel, qui range le résultat dans le parc.
const ACCELERE = 30;                  // au-delà, le rejeu passe tout seul en rapide (un lot de 16 commandes durait plus de 5 minutes)
const LIMITE_ANIMEE = 250;             // au-delà, le rejeu passe d'un coup (un programme de 2000 lignes peut faire des milliers d'étapes)
async function rejouer(x) {
  const trace = x.trace || []; let sortie = 0;
  const lignes = (etat.codeMarche || "").split("\n");
  const tours = {};                      // tours de chaque boucle, pour la caisse de sortie des for
  const appels = [];                     // pile des appels en cours : { m (poste d'appel), changes, apres }
  etat.disposition.machines.filter((m) => m.role === "collecteur").forEach((m) => etat.scene.machine(m.id)?.userData.remplir(0));
  const principal = (ev) => !ev.f;
  // l'état du programme principal après la ligne k : celui de la prochaine ligne du programme principal
  // l'état de la ligne k une fois faite : celui de la prochaine ligne du même cadre (le programme, ou la même fonction)
  // (dans une fonction : on s'arrête si l'on revient chez l'appelant, la fonction est alors finie)
  const suivantDe = (k, f, appelant) => {
    for (let i = k + 1; i < trace.length; i++) {
      const g = trace[i].f || null;
      if (g === f) return trace[i].etat;
      if (f && g === appelant) break;
    }
    return f ? trace[k].etat : x.etatFinal || trace[k].etat;
  };
  let avant = trace.find(principal)?.etat || {};
  etat.scene.majStock(avant, false);
  // « Jusqu'au curseur » : avance sans animation jusqu'au premier passage sur la ligne visée, puis s'arrête là
  const cibleK = etat.jusqua ? trace.findIndex((e) => e.l === etat.jusqua) : -1;
  const etats = {};                      // pendant l'avance rapide : le dernier état de chaque parc, posé une fois à l'arrivée
  // une boucle sans fin : quelques tours suffisent à la voir tourner, la suite passe d'un coup
  const sansFin = x.erreur && x.erreur.type === "BoucleSansFin", limite = sansFin ? 40 : LIMITE_ANIMEE;
  if (etat.jusqua && cibleK < 0) legende(`La ligne ${etat.jusqua} n'est jamais exécutée avec ces données : la marche continue jusqu'au bout.`, true);
  for (let k = 0; k < trace.length; k++) {
    if (etat.arret) break;
    const ev = trace[k], suivant = trace[k + 1], vite = etat.rapide || k >= ACCELERE, module = ev.f || null;
    if (k === ACCELERE && !etat.rapide && cibleK < 0 && !CODE_SEUL && trace.length > ACCELERE + 10) legende("Programme long : la suite passe en rapide. « Jusqu'au curseur » (F8) montre n'importe quelle ligne en détail.");
    if (k === limite && cibleK < 0 && !CODE_SEUL) legende(sansFin ? "La boucle tourne sans fin : sa condition ne devient jamais fausse. La suite passe d'un coup." : `Programme long : les ${LIMITE_ANIMEE} premières étapes sont animées, la suite passe d'un coup. « Jusqu'au curseur » (F8) montre n'importe quelle ligne.`);
    if (k < cibleK || (cibleK < 0 && (k >= limite || CODE_SEUL))) {
      // avance rapide : seuls les parcs et la pile des appels suivent
      const m0 = machineDeLigne(ev.l), appelle0 = m0 && m0.appel && suivant && suivant.f === m0.appel;
      const top = appels[appels.length - 1];
      if (module && top && top.cible === module && !top.entre) top.entre = true;
      const apres0 = suivantDe(k, module, top ? top.module : null);
      if (appelle0) appels.push({ m: m0, changes: [], apres: apres0, cible: m0.appel, entre: false, module });
      else etats[module || ""] = apres0;
      const som = appels[appels.length - 1];
      if (module && !appelle0 && som && som.cible === module && som.entre && (!suivant || (suivant.f || null) !== module)) { appels.pop(); etats[som.module || ""] = som.apres; }
      if (!module) avant = apres0;
      continue;
    }
    if (k === cibleK) {
      const m0 = machineDeLigne(ev.l);
      for (const [f, e] of Object.entries(etats)) if (!f) etat.scene.majStock(e, false);
      for (const [f, e] of Object.entries(etats)) if (f && f !== module) { etat.scene.majStock(e, false, f); }
      if (module) { etat.scene.ouvrirModule(module, true); etat.scene.majStock(ev.etat, false, module); etat.scene.afficherEntrees(module, ev.etat); }
      etat.editeur.surligner(ev.l); etat.ligneErreur = ev.l;      // la ligne d'arrêt reste marquée dans le code
      if (m0) { etat.scene.viser(m0.x, m0.z, 1.5); await etat.scene.amenerFut(m0.id, 300); etat.scene.montrerBulle(m0.id, `arrêt ici : ligne ${ev.l}`); }
      majDonnees(module ? avant : ev.etat, avant);
      legende(CODE_SEUL ? `Arrêt à la ligne ${ev.l}, avant qu'elle s'exécute. L'onglet Variables montre les valeurs à ce moment. « Exécuter » déroule tout.`
        : `Arrêt à la ligne ${ev.l}, avant qu'elle s'exécute. L'onglet Bacs montre les variables à ce moment. « Mettre en marche » déroule tout.`);
      etat.scene.cacherFut();
      return true;
    }
    // l'état après cette ligne, dans son propre parc (le programme, ou le module)
    const apres = suivantDe(k, module, appels.length ? appels[appels.length - 1].module : null);
    const m = machineDeLigne(ev.l);
    etat.editeur.surligner(ev.l);
    if (m && m.role === "module") {
      etat.scene.allumer(m.id, { etincelles: false });
      legende(`Ligne ${ev.l} : Python enregistre la fonction ${m.nom}. Elle tournera quand le programme l'appellera.`);
      await new Promise((ok) => setTimeout(ok, vite ? 150 : 700));
      continue;
    }
    // entrée dans un module : la bouteille prend le tube d'appel, le module s'ouvre, ses paramètres s'affichent
    const enCours = appels[appels.length - 1];
    if (module && enCours && enCours.cible === module && !enCours.entre) {
      const appel = enCours; appel.entre = true;
      etat.scene.ouvrirModule(module, true);
      etat.scene.afficherEntrees(module, ev.etat);
      etat.scene.majStock(ev.etat, false, module);
      await etat.scene.voyager(appel.m.id, "aller", vite ? 300 : 800);
    }
    const changes = Object.keys(apres).filter((n) => JSON.stringify(apres[n]) !== JSON.stringify(ev.etat[n]) && etat.scene.connaitStock(n, module));
    // un appel : le résultat n'arrive qu'au retour de la fonction
    const appelle = m && m.appel && suivant && suivant.f === m.appel;
    if (m) {
      await etat.scene.amenerFut(m.id, vite ? 160 : 380);
      if (!vite) await Promise.all(lecturesDe(lignes[ev.l - 1], changes, module).map((n) => etat.scene.prelever(n, m.id, 300, module)));
      const info = infoTravail(m, suivant, tours);
      info.duree = vite ? 260 : 950;
      const travail = etat.scene.allumer(m.id, info);
      etat.scene.montrerBulle(m.id, appelle ? `appel de ${m.appel}(…)` : bulleDe(m, ev, apres, x, suivant, () => x.sortie[sortie++]));
      await travail;
      if (m.type === "sortir" || m.type === "suivant") await etat.scene.filer(m.x, m.z, vite ? 250 : 650);
      if (m.type === "pour") {
        const caisse = etat.scene.machine(m.poste.id + ":collecteur");
        if (caisse) { caisse.userData.remplir(info.dedans ? tours[m.id] - 1 : tours[m.id]); if (!info.dedans) etat.scene.allumer(m.poste.id + ":collecteur", { etincelles: false }); }
      }
      if (appelle) appels.push({ m, changes, apres, cible: m.appel, entre: false, module });
      else if (!vite) await Promise.all(changes.map((n) => etat.scene.deposer(m.id, n, 320, module)));
    }
    if (!appelle) etat.scene.majStock(apres, true, module);
    if (!module) { majDonnees(apres, avant); avant = apres; }
    if (k === trace.length - 1 && x.erreur) {
      if (m) etat.scene.montrerBulle(m.id, `${x.erreur.type} : la machine s'arrête`, true);
      legende(`Ligne ${x.erreur.ligne} : ${x.erreur.explication || x.erreur.messageOriginal}`, true);
    }
    // sortie d'un module : la bouteille revient par le tube ; le poste d'appel range le résultat dans le parc du programme
    const sommet = appels[appels.length - 1];
    if (module && !appelle && sommet && sommet.cible === module && sommet.entre && (!suivant || (suivant.f || null) !== module)) {
      const appel = appels.pop();
      if (ev.retour) etat.scene.montrerBulle(m ? m.id : appel.m.id, `renvoie ${texteValeur(ev.retour, true)}`);
      await new Promise((ok) => setTimeout(ok, vite ? 80 : 450));
      await etat.scene.voyager(appel.m.id, "retour", vite ? 300 : 800);
      await etat.scene.amenerFut(appel.m.id, vite ? 120 : 250);
      etat.scene.montrerBulle(appel.m.id, appel.changes.length ? appel.changes.slice(0, 2).map((n) => `${n} = ${texteValeur(appel.apres[n], true)}`).join(" ; ") : (ev.retour ? `résultat : ${texteValeur(ev.retour, true)}` : ""));
      if (!vite) await Promise.all(appel.changes.map((n) => etat.scene.deposer(appel.m.id, n, 320, appel.module)));
      etat.scene.majStock(appel.apres, true, appel.module);
    }
    await new Promise((ok) => setTimeout(ok, vite ? 80 : 220));
  }
  // après une avance rapide jusqu'au bout : les parcs prennent leur dernier état
  for (const [f, e] of Object.entries(etats)) etat.scene.majStock(e, false, f || null);
  if (etats[""]) majDonnees(etats[""], avant);
  if (x.cas && !etat.arret) {
    legende(`Cas ${etat.casCourant + 1} : renvoie ${texteValeur(x.cas.retour)} ${x.cas.ok ? "(juste)" : `(attendu : ${texteValeur(x.cas.attendu)})`}.`, !x.cas.ok);
  }
  etat.scene.cacherFut();
}

function bulleDe(m, ev, apres, x, suivant, prochaineSortie) {
  const p = m.poste;
  if (m.type === "afficher") return "écran : " + (prochaineSortie() ?? "");
  if (m.type === "si") {
    const prend = voieChoisie(p, suivant) === m.voie, n = p.params.conditions.length;
    if (prend) return `${m.condition} : vrai, la bouteille prend la voie`;
    if (m.voie < n - 1) return `${m.condition} : faux, trieur suivant`;
    return `${m.condition} : faux, ` + (p.params.sinon ? "voie sinon (else)" : "tout droit");
  }
  if (m.type === "importer") return `bibliothèque livrée : ${p.params.noms.join(", ")}`;
  if (m.role === "sas") {
    const genre = m.genre, entete = (p.params.entetes[m.partie] || "").replace(/:$/, "");
    if (genre === "try") return m.partie === 0 ? "try : on essaie" : entete.startsWith("except") ? `erreur attrapée : ${entete}` : entete.startsWith("finally") ? "finally : toujours exécuté" : "else : aucune erreur";
    if (genre === "with") return `with : ${entete.replace(/^with\s+/, "")}`;
    if (genre === "match") return entete;
    return entete;
  }
  if (m.type === "sortir") return "break : on sort de la boucle";
  if (m.type === "suivant") return "continue : tour suivant";
  if (m.type === "passer") return "pass : rien à faire";
  if (m.type === "pour" || m.type === "tantque") {
    const dedans = suivant && p.branches[0].length && suivant.l >= p.branches[0][0].lignes[0] && suivant.l <= p.branches[0][p.branches[0].length - 1].lignes[1];
    if (!dedans) return m.type === "pour" ? "plus d'élément : la caisse repart" : "condition fausse : l'aiguillage s'ouvre";
    if (m.type === "pour") return p.params.variable.split(",").map((v) => `${v.trim()} = ${texteValeur(apres[v.trim()], true)}`).join(", ");
    return `${p.params.condition} : vrai`;
  }
  if (m.type === "renvoyer") return ev.retour ? `return ${texteValeur(ev.retour, true)}` : x.cas ? `return ${texteValeur(x.cas.retour, true)}` : "return";
  const changes = Object.keys(apres).filter((n) => JSON.stringify(apres[n]) !== JSON.stringify(ev.etat[n]));
  return changes.slice(0, 2).map((n) => `${n} = ${texteValeur(apres[n], true)}`).join(" ; ");
}

function majDonnees(apres, avant) {
  etat.donnees = { apres, avant };
  if (document.querySelector('.onglet[aria-selected="true"]')?.dataset.onglet === "donnees") afficherOnglet("donnees");
}

// ---------- panneau ----------
function majObjectifs() {
  const m = etat.mission, f = progression.fiche(idProgression()), e = m.etoiles;
  dessinerEtoiles($("mission-etoiles"), f.etoiles);
  const liste = $("mission-objectifs"); liste.innerHTML = "";
  [e.description1, e.description2, e.description3].forEach((texte, i) => {
    const li = creer("li", f.etoiles[i] ? "gagnee" : ""), marque = creer("span", "etoiles"); dessinerEtoiles(marque, [f.etoiles[i]]);
    li.append(marque, creer("span", "", `Étoile ${i + 1} : ${texte}`)); liste.append(li);
  });
}

function afficherOnglet(nom) {
  for (const o of document.querySelectorAll(".onglet")) o.setAttribute("aria-selected", String(o.dataset.onglet === nom));
  const panneau = $("panneau"); panneau.innerHTML = ""; const r = etat.resultat;
  if (nom === "tests") {
    if (!r || !r.tests) panneau.append(creer("p", "vide", "Mettez l'usine en marche : les tests vérifient ce qui arrive au bout de la ligne."));
    else {
      for (const t of r.tests) {
        const ligne = creer("div", "test " + (t.ok ? "ok" : "echec")), texte = creer("span", "texte", t.libelle);
        if (t.groupe === "bonus") texte.append(creer("span", "groupe", "étoile 3"));
        if (!t.ok && t.message) texte.append(creer("span", "detail", t.message));
        ligne.append(creer("span", "marque", t.ok ? "OK" : "ÉCHEC"), texte); panneau.append(ligne);
      }
      const err = r.erreur || (r.mode !== "fonction" && r.erreur);
      if (err) panneau.append(creer("p", "detail", `${err.messageOriginal || err.type} (ligne ${err.ligne})`));
    }
  } else if (nom === "donnees") {
    const d = etat.donnees;
    if (!d) { panneau.append(creer("p", "vide", "Les bacs de l'usine : chaque variable et sa valeur, mises à jour pendant la marche.")); return; }
    const table = creer("table", "donnees");
    for (const [n, v] of Object.entries(d.apres)) {
      const tr = creer("tr", JSON.stringify(v) !== JSON.stringify(d.avant[n]) ? "change" : "");
      tr.append(creer("td", "", n), creer("td", "", texteValeur(v))); table.append(tr);
    }
    panneau.append(table);
  } else {
    const x = r && (r.mode === "fonction" ? r.cas[etat.casCourant] : r);
    const casSortie = x && x.sortie && x.sortie.length ? x.sortie.join("\n") : null;
    if (r && r.essais) {
      // vos essais (mission à fonction) : ce que le script sous la fonction a écrit, après les cas de test, sans note
      const e = r.essais, lignes = [...e.sortie];
      if (e.erreur) lignes.push(`Ligne ${e.erreur.ligne} : ${e.erreur.messageOriginal}`);
      panneau.append(creer("p", "", "Vos essais (non notés) :"), creer("pre", "ecran", lignes.length ? lignes.join("\n") : "(vos essais n'ont rien affiché)"));
      if (casSortie) panneau.append(creer("p", "", `Pendant le cas ${etat.casCourant + 1} :`), creer("pre", "ecran", casSortie));
    } else panneau.append(creer("pre", "ecran", casSortie || "L'écran affiche ici ce que les print() écrivent."));
  }
  if (r && r.tests) {
    const v = r.tests.filter((t) => t.groupe === "visible");
    $("resume-tests").textContent = `${v.filter((t) => t.ok).length} test(s) sur ${v.length}`;
  }
}

// ---------- clavier et boutons ----------
function installerClavier() {
  $("bouton-lancer").addEventListener("click", () => lancer());
  $("bouton-arret").addEventListener("click", () => { etat.arret = true; });
  $("bouton-curseur").addEventListener("click", () => lancer({ jusqua: etat.editeur.ligneCurseur() }));
  $("bouton-vitesse").addEventListener("click", () => { etat.rapide = !etat.rapide; $("bouton-vitesse").setAttribute("aria-pressed", String(etat.rapide)); });
  $("bouton-annuler").addEventListener("click", () => revenir(-1));
  $("bouton-retablir").addEventListener("click", () => revenir(1));
  $("bouton-tourner").addEventListener("click", () => etat.scene.tourner(1));
  // affichage : l'usine en graphismes complets ou légers, ou le code seul (mêmes réglages que la carte des missions)
  const choix = $("choix-affichage");
  choix.value = CODE_SEUL ? "code" : progression.reglage("qualite") === "basse" ? "basse" : "haute";
  choix.addEventListener("change", () => {
    if (choix.value === "code") progression.reglage("sans3d", true);
    else { progression.reglage("sans3d", false); progression.reglage("qualite", choix.value); }
    location.reload();
  });
  $("bouton-cadrer").addEventListener("click", () => { if (!etat.disposition) return; if (!etat.enMarche) sortirModules(); etat.scene.cadrer(etat.disposition.etendue); });
  for (const o of document.querySelectorAll(".onglet")) o.addEventListener("click", () => afficherOnglet(o.dataset.onglet));
  $("champ-ligne").addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") { ev.preventDefault(); validerReglage(); }
    else if (ev.key === "Escape") { ev.preventDefault(); fermerReglage(); }
    else if (ev.key === "Delete" && !$("champ-ligne").value) { ev.preventDefault(); retirerMachine(etat.reglage.machine); }
    else if (ev.altKey && (ev.key === "ArrowLeft" || ev.key === "ArrowRight")) { ev.preventDefault(); deplacerMachine(etat.reglage.machine, ev.key === "ArrowLeft" ? -1 : 1); }
  });
  document.addEventListener("keydown", (ev) => {
    const dansChamp = ev.target.closest && (ev.target.closest(".cm-editor") || ev.target.tagName === "INPUT");
    if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") { ev.preventDefault(); lancer(); return; }
    if (ev.key === "F8") { ev.preventDefault(); lancer({ jusqua: etat.editeur.ligneCurseur() }); return; }
    if (dansChamp || CODE_SEUL) return;
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z") { ev.preventDefault(); revenir(-1); return; }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "y") { ev.preventDefault(); revenir(1); return; }
    if (ev.key === "Escape") {
      choisirOutil(null); fermerPalette(); fermerReglage(); legende("");
      if (!etat.enMarche && sortirModules()) etat.scene.cadrer(etat.disposition.etendue);
      return;
    }
    // le menu ouvert : 1 à 9 choisit une machine, flèches haut et bas changent de catégorie
    if (etat.menu) {
      const c = etat.categories.find((x) => x.id === etat.menu.categorie), i = etat.categories.indexOf(c);
      if (/^[1-9]$/.test(ev.key) && c.machines[Number(ev.key) - 1]) { ev.preventDefault(); choisirDansMenu(c.machines[Number(ev.key) - 1]); return; }
      if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
        ev.preventDefault();
        const suivante = etat.categories[(i + (ev.key === "ArrowDown" ? 1 : etat.categories.length - 1)) % etat.categories.length];
        $("palette").querySelector(`.menu-categorie[data-categorie="${suivante.id}"]`)?.click();
        $("palette").querySelector(".carte-machine")?.focus();
        return;
      }
    }
    if (ev.shiftKey && ev.key.toLowerCase() === "a") {
      ev.preventDefault();
      const v = $("vue").getBoundingClientRect();
      ouvrirMenu({ x: (etat.souris?.x ?? v.width / 2) , y: (etat.souris?.y ?? v.height / 2) });
      return;
    }
    if (/^[1-8]$/.test(ev.key) && etat.categories[Number(ev.key) - 1]) { document.querySelectorAll(".categorie-bouton")[Number(ev.key) - 1]?.click(); return; }
    if (ev.key.toLowerCase() === "q") etat.scene.tourner(-1);
    if (ev.key.toLowerCase() === "e") etat.scene.tourner(1);
    if (ev.key.toLowerCase() === "f" && etat.disposition) etat.scene.cadrer(etat.disposition.etendue);
  });
  document.addEventListener("pointerdown", () => sons.reveiller(), { once: true });
  $("vue").addEventListener("pointermove", (ev) => { const v = $("vue").getBoundingClientRect(); etat.souris = { x: ev.clientX - v.left, y: ev.clientY - v.top }; });
}

window.addEventListener("hashchange", () => location.reload());
demarrer();
window.usine = { etat, analyser, lancer, poser, ecrireCode, ouvrirReglage, allerALaLigne, basculerSection };
