// L'usine de la Fonderie : contrôleur de la page (prototype du 20/11/2026, voir CONCEPTION-usine.md).
// Le code est la référence. Construire (poser, régler, retirer, déplacer une machine) modifie le code ;
// écrire le code redessine l'usine. « Mettre en marche » exécute le code et fait rouler un fût de machine en machine.
import * as progression from "../commun/progression.js";
import { PilotePython } from "../commun/python.js";
import { creerEditeur } from "../commun/editeur.js";
import * as sons from "../commun/sons.js";
import { texteValeur } from "../atelier/scene-atelier.js";
import { disposer } from "./disposition.js";
import { GABARITS, gabaritsDe, inserer, lireLigne, remplacerLigne, retirer, deplacer, numeroter } from "./code.js";
import { creerSceneUsine, familleDe } from "./scene-usine.js";

const DELAI_ANALYSE_MS = 400;
const COULEUR_FAMILLE = { variable: "#4fc4a0", liste: "#f5b82e", tuple: "#ef8a6a", dict: "#f39ac0", set: "#9be08a", condition: "#c9a3f5", boucle: "#5ad1e0", sortie: "#8fb3ff", quai: "#23ab67" };
const $ = (id) => document.getElementById(id);
const creer = (balise, classe, texte) => { const e = document.createElement(balise); if (classe) e.className = classe; if (texte !== undefined) e.textContent = texte; return e; };
const etat = { mission: null, tests: "", analyse: null, disposition: null, syntaxe: null, outil: null, reglage: null, resultat: null,
  enMarche: false, arret: false, rapide: false, historique: [], position: -1, ignorer: false, casCourant: 0 };

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
  $("bouton-carte").href = "missions.html" + location.search;
  $("lien-atelier").href = "atelier.html" + location.search + "#mission=" + m.id;
  $("nom-fichier").textContent = m.fonction ? `${m.fonction.nom}.py` : "programme.py";
  $("bouton-lancer").textContent = m.fonction ? "Mettre en marche (tests)" : "Mettre en marche";
  const code = progression.fiche(idProgression()).code ?? m.depart ?? "";
  etat.editeur = creerEditeur($("editeur"), { texte: code, surChangement: () => { if (!etat.ignorer) planifierAnalyse(); }, surExecuter: () => lancer(), libelle: "Code Python" });
  etat.scene = creerSceneUsine($("vue"), { surFente, surMachine, surVide, surSurvol: (m) => { if (!etat.enMarche && m.texte) legende(`Ligne ${m.ligne} : ${m.texte}  (clic : régler)`); } });
  construireBarre();
  majObjectifs(); afficherOnglet("tests");
  memoriser();
  legende("Choisissez une machine en bas (ou touches 1 à 9), puis cliquez sur un « + » jaune du convoyeur. Cliquez sur une machine pour la régler. Glissez pour vous déplacer, molette pour zoomer.");
  installerClavier();
  await analyser({ cadrer: true });
  memoriser();
}

// ---------- analyse : le code redessine l'usine ----------
let minuterie = null;
function planifierAnalyse() { clearTimeout(minuterie); minuterie = setTimeout(() => analyser(), DELAI_ANALYSE_MS); }

async function analyser({ cadrer = false } = {}) {
  const code = etat.editeur.lire();
  let a;
  try { a = await pilote.analyserAtelier(code, etat.mission.fonction || null); } catch { return null; }
  if (!a.ok) {
    etat.syntaxe = a.erreur;
    $("bandeau").hidden = false;
    $("bandeau").textContent = a.erreur.horsFonction ? `Ligne ${a.erreur.ligne} : ${a.erreur.message}. L'usine attend que le code soit corrigé.`
      : `Ligne ${a.erreur.ligne} : Python ne comprend pas encore cette ligne (${a.erreur.message}). L'usine attend que le code soit corrigé.`;
    return a;
  }
  etat.syntaxe = null;
  const avert = a.avertissements && a.avertissements[0];
  $("bandeau").hidden = !avert; if (avert) $("bandeau").textContent = "Attention : " + avert.message;
  numeroter(a.postes);
  etat.analyse = a;
  const avant = etat.disposition && etat.disposition.etendue;
  etat.disposition = disposer(a, code, { fonction: etat.mission.fonction || null });
  const e = etat.disposition.etendue;
  // l'usine grandit (ou rétrécit) : la vue suit, pour que la ligne reste entière à l'écran
  const change = !avant || avant.x2 !== e.x2 || avant.z1 !== e.z1 || avant.z2 !== e.z2;
  const neuves = etat.scene.construire(etat.disposition, { cadrer: cadrer || change });
  if (neuves) sons.jouer("clic");
  progression.sauverCode(idProgression(), code);
  return a;
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
function construireBarre() {
  const barre = $("barre-construction"); barre.innerHTML = "";
  etat.gabarits = gabaritsDe(etat.mission.palette, etat.mission.fonction);
  etat.gabarits.forEach((id, i) => {
    const g = GABARITS[id];
    const b = creer("button", "machine-bouton"); b.type = "button"; b.dataset.gabarit = id; b.setAttribute("aria-pressed", "false");
    b.style.setProperty("--famille", COULEUR_FAMILLE[g.famille] || "#9aa0ad");
    b.append(creer("span", "nom", g.nom), creer("span", "python", g.lignes[0].replace(/[⟦⟧]/g, "")));
    if (i < 9) b.append(creer("span", "touche", String(i + 1)));
    b.addEventListener("click", () => choisirOutil(etat.outil === id ? null : id));
    barre.append(b);
  });
}
function choisirOutil(id) {
  etat.outil = id;
  for (const b of document.querySelectorAll(".machine-bouton")) b.setAttribute("aria-pressed", String(b.dataset.gabarit === id));
  etat.scene.choisirOutil(!!id);
  if (id) legende(`${GABARITS[id].nom} : cliquez sur un « + » jaune du convoyeur pour la poser. Échap pour poser l'outil.`);
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
  const m = etat.disposition.machines.find((x) => x.ligne === r.ligne && x.role !== "groupeur");
  if (m) ouvrirReglage(m, { selection: [r.debut, r.fin], neuve: true });
}

function ouvrirPalette(fente, ev) {
  const p = $("palette"); p.innerHTML = "";
  etat.gabarits.forEach((id) => {
    const g = GABARITS[id], b = creer("button"); b.type = "button"; b.setAttribute("role", "menuitem");
    const pastille = creer("span", "pastille"); pastille.style.setProperty("--famille", COULEUR_FAMILLE[g.famille] || "#9aa0ad");
    b.append(pastille, creer("span", "", g.nom), creer("span", "python", g.lignes[0].replace(/[⟦⟧]/g, "").split(" ")[0]));
    b.addEventListener("click", () => poser(fente, id));
    p.append(b);
  });
  const r = $("vue").getBoundingClientRect();
  p.style.left = Math.min(ev.clientX - r.left + 8, r.width - 270) + "px";
  p.style.top = Math.min(ev.clientY - r.top + 8, r.height - 350) + "px";
  p.hidden = false; p.querySelector("button")?.focus();
}
function fermerPalette() { $("palette").hidden = true; }

function surMachine(m) {
  if (bloque()) return;
  fermerPalette();
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
  if (selection && selection[0] >= 0) champ.setSelectionRange(selection[0], selection[1]); else champ.select();
  etat.editeur.surligner(m.ligne);
}
function fermerReglage() { $("reglage").hidden = true; etat.reglage = null; etat.editeur.surligner(null); }

function nomMachine(m) {
  const noms = { si: "Répartiteur", pour: "Carrousel", tantque: "Boucle à capteur", renvoyer: "Quai de sortie", afficher: "Écran", code_libre: "Machine" };
  return noms[m.type] || Object.entries(GABARITS).find(([id]) => id === m.type)?.[1].nom || "Machine";
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
  const nb = (liste) => liste.reduce((n, p) => n + 1 + (p.branches ? p.branches.reduce((s, b) => s + nb(b), 0) : 0), 0);
  return [e1, e1 && nb(etat.analyse.postes) <= etat.mission.etoiles.max, e1 && bon.length > 0 && bon.every((t) => t.ok)];
}

async function lancer() {
  if (etat.enMarche) return;
  fermerReglage(); fermerPalette();
  const a = await analyser();
  if (!a || !a.ok) { legende("Le code ne s'analyse pas : corrigez la ligne signalée, puis remettez en marche.", true); sons.jouer("alerte"); return; }
  etat.enMarche = true; etat.arret = false; $("bouton-arret").disabled = false; $("bouton-lancer").disabled = true;
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
    await rejouer(x);
    const vis = r.tests.filter((t) => t.groupe === "visible");
    if (etoiles[0]) { sons.jouer(etoiles[2] ? "victoire" : "reussi"); legende(`Commande livrée : ${vis.length} test(s) sur ${vis.length}. Étoiles : ${etoiles.filter(Boolean).length} sur 3.`); }
    else if (r.erreur || (x && x.erreur)) { sons.jouer("rate"); }
    else { sons.jouer("rate"); legende(`Livraison refusée : ${vis.filter((t) => t.ok).length} test(s) sur ${vis.length}. L'onglet Tests dit ce qui manque.`, true); }
  } finally {
    etat.enMarche = false; $("bouton-arret").disabled = true; $("bouton-lancer").disabled = false;
    etat.scene.cacherBulle(); etat.editeur.surligner(null);
  }
}

function machineDeLigne(l) {
  const ms = etat.disposition.machines.filter((m) => m.role !== "groupeur");
  return ms.find((m) => m.ligne === l) || ms.find((m) => m.poste && m.poste.entetes && m.poste.entetes.includes(l));
}

async function rejouer(x) {
  const trace = x.trace || []; let sortie = 0, avant = trace.length ? trace[0].etat : {};
  for (let k = 0; k < trace.length; k++) {
    if (etat.arret) break;
    const ev = trace[k], suivant = trace[k + 1], apres = suivant ? suivant.etat : x.etatFinal || ev.etat;
    const m = machineDeLigne(ev.l);
    etat.editeur.surligner(ev.l);
    if (m) {
      await etat.scene.amenerFut(m.id, etat.rapide ? 160 : 420);
      etat.scene.allumer(m.id, m.role === "quai" ? 0x23ab67 : 0xffc857);
      etat.scene.montrerBulle(m.id, bulleDe(m, ev, apres, x, suivant, () => x.sortie[sortie++]));
    }
    majDonnees(apres, avant); avant = apres;
    if (k === trace.length - 1 && x.erreur) {
      if (m) etat.scene.montrerBulle(m.id, `${x.erreur.type} : la machine s'arrête`, true);
      legende(`Ligne ${x.erreur.ligne} : ${x.erreur.explication || x.erreur.messageOriginal}`, true);
    }
    await new Promise((ok) => setTimeout(ok, etat.rapide ? 120 : 480));
  }
  if (x.cas && !etat.arret) {
    legende(`Cas ${etat.casCourant + 1} : renvoie ${texteValeur(x.cas.retour)} ${x.cas.ok ? "(juste)" : `(attendu : ${texteValeur(x.cas.attendu)})`}.`, !x.cas.ok);
  }
  etat.scene.cacherFut();
}

function bulleDe(m, ev, apres, x, suivant, prochaineSortie) {
  const p = m.poste;
  if (m.type === "afficher") return "écran : " + (prochaineSortie() ?? "");
  if (m.type === "si") {
    const k = p.branches.findIndex((b) => b.length && suivant && suivant.l >= b[0].lignes[0] && suivant.l <= b[b.length - 1].lignes[1]);
    if (ev.l !== p.lignes[0] && !p.entetes.includes(ev.l)) return "";
    return k >= 0 ? (k < p.params.conditions.length ? `${p.params.conditions[k]} : vrai` : "aucune condition vraie : sinon") : "aucune voie : le fût continue";
  }
  if (m.type === "pour" || m.type === "tantque") {
    const dedans = suivant && p.branches[0].length && suivant.l >= p.branches[0][0].lignes[0] && suivant.l <= p.branches[0][p.branches[0].length - 1].lignes[1];
    if (!dedans) return "fini : le fût sort de la boucle";
    if (m.type === "pour") return p.params.variable.split(",").map((v) => `${v.trim()} = ${texteValeur(apres[v.trim()], true)}`).join(", ");
    return `${p.params.condition} : vrai`;
  }
  if (m.type === "renvoyer") return x.cas ? `return ${texteValeur(x.cas.retour, true)}` : "return";
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
    panneau.append(creer("pre", "ecran", x && x.sortie && x.sortie.length ? x.sortie.join("\n") : "L'écran affiche ici ce que les print() écrivent."));
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
  $("bouton-vitesse").addEventListener("click", () => { etat.rapide = !etat.rapide; $("bouton-vitesse").setAttribute("aria-pressed", String(etat.rapide)); });
  $("bouton-annuler").addEventListener("click", () => revenir(-1));
  $("bouton-retablir").addEventListener("click", () => revenir(1));
  $("bouton-tourner").addEventListener("click", () => etat.scene.tourner(1));
  $("bouton-cadrer").addEventListener("click", () => etat.disposition && etat.scene.cadrer(etat.disposition.etendue));
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
    if (dansChamp) return;
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z") { ev.preventDefault(); revenir(-1); return; }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "y") { ev.preventDefault(); revenir(1); return; }
    if (ev.key === "Escape") { choisirOutil(null); fermerPalette(); fermerReglage(); legende(""); return; }
    if (/^[1-9]$/.test(ev.key) && etat.gabarits[Number(ev.key) - 1]) { choisirOutil(etat.gabarits[Number(ev.key) - 1]); return; }
    if (ev.key.toLowerCase() === "q") etat.scene.tourner(-1);
    if (ev.key.toLowerCase() === "e") etat.scene.tourner(1);
    if (ev.key.toLowerCase() === "f" && etat.disposition) etat.scene.cadrer(etat.disposition.etendue);
  });
  document.addEventListener("pointerdown", () => sons.reveiller(), { once: true });
}

window.addEventListener("hashchange", () => location.reload());
demarrer();
window.usine = { etat, analyser, lancer, poser, ecrireCode };
