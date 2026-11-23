// Le championnat des robots : jouer au clavier (moteur JavaScript, en temps réel), programmer son robot (moteur Python,
// le même que dans VS Code), revoir un combat (combat.json écrit par combat.py), s'inscrire au tournoi.
import { PilotePython } from "../commun/python.js";
import { creerEditeur } from "../commun/editeur.js";
import * as progression from "../commun/progression.js";
import * as sons from "../commun/sons.js";
import { envoyer } from "../commun/resultat.js";
import { creerRing } from "./ring.js";
import { creerCombat, cout } from "./moteur.js";
import { adversaires, DESCRIPTIONS } from "./robots.js";
import { R } from "./regles.js";
import { caracteristiques, COLONNES_DECISIONS } from "./apprentissage.js";
import { MODELES, GENERATIONS } from "./modeles.js";
import { listeStyles, styleParDefaut, remplirChoix } from "./styles.js";
import { creerSelection } from "./selection.js";

const CLE = "jeux-python.championnat.v1", CLE_JOUES = "jeux-python.combats-joues.v1";
const $ = (id) => document.getElementById(id);
const creer = (balise, classe, texte) => { const e = document.createElement(balise); if (classe) e.className = classe; if (texte !== undefined) e.textContent = texte; return e; };
const lire = (cle, defaut) => { try { return JSON.parse(localStorage.getItem(cle)) ?? defaut; } catch { return defaut; } };
const ecrire = (cle, v) => { try { localStorage.setItem(cle, JSON.stringify(v)); return true; } catch { return false; } };

const memoire = lire(CLE, {}); memoire.codes = memoire.codes || {};
const sauver = () => ecrire(CLE, memoire);
const etat = { generation: Number(memoire.generation) || 1, dernier: null, enJeu: false, styles: [{ id: "simple", nom: "Simple" }] };
// les modèles 3D des deux robots : le vôtre (choix en haut du ring), et un style tiré du nom pour l'adversaire
const styleAdverse = (nom) => styleParDefaut(nom, etat.styles, memoire.style);
const habiller = (nomA, nomB, cote = "a") => ring.choisirRobots(cote === "a" ? { a: memoire.style, b: styleAdverse(nomB) } : { a: styleAdverse(nomA), b: memoire.style });

const pilote = new PilotePython((nom) => {
  const e = $("etat-python");
  if (nom === "pret") { e.textContent = "Python est prêt"; e.className = "etat-python pret"; }
  if (nom === "echec") { e.textContent = "Python n'a pas pu se charger. Rechargez la page."; e.className = "etat-python echec"; }
});
const ring = creerRing($("vue"), { qualite: progression.reglage("qualite") === "basse" ? "basse" : "haute" });
const editeur = creerEditeur($("editeur"), { texte: memoire.codes[etat.generation] ?? MODELES[etat.generation], libelle: "Code de votre robot",
  surChangement: (t) => { memoire.codes[etat.generation] = t; sauver(); }, surExecuter: () => combatCode() });

// ---------- jouer au clavier ----------
const touches = new Set();
let tampon = null;                                // le dernier coup demandé, gardé 300 ms le temps que le robot soit libre
const COUPS_TOUCHES = { j: "direct", k: "crochet", l: "coup_bas", m: "projection", ";": "projection", i: "special", " ": "esquive" };
function toucheVersAction(e) { const k = e.key.toLowerCase(); return COUPS_TOUCHES[k] || null; }
document.addEventListener("keydown", (e) => {
  if (!etat.enJeu) return;
  const k = e.key.toLowerCase();
  if (["arrowright", "arrowleft", "arrowdown", "arrowup", " "].includes(k)) e.preventDefault();
  touches.add(k);
  const a = toucheVersAction(e);
  if (a && !e.repeat) tampon = { action: a, jusqua: performance.now() + 300 };
});
document.addEventListener("keyup", (e) => touches.delete(e.key.toLowerCase()));
window.addEventListener("blur", () => touches.clear());

function joueur(etatCombat) {
  const t = performance.now();
  if (tampon && t <= tampon.jusqua) {
    const a = tampon.action; tampon = null;
    if (cout(a) <= etatCombat.moi.energie) return a;
    ring.annonce("PAS ASSEZ D'ÉNERGIE", 0.6);
  }
  if (touches.has("arrowup") || touches.has("z") || touches.has("w")) return "garde";
  if (touches.has("arrowdown") || touches.has("s")) return "garde_basse";
  if (touches.has("arrowright") || touches.has("d")) return "avancer";
  if (touches.has("arrowleft") || touches.has("q") || touches.has("a")) return "reculer";
  return "attendre";
}

async function jouer() {
  if (etat.enJeu) return;
  const nomAdv = $("choix-adversaire-jeu").value, adv = adversaires()[nomAdv];
  const decisions = [];                           // ce que le joueur a vu et fait : données pour le machine learning
  const strategieJoueur = (e) => { const a = joueur(e); decisions.push([e.tick, caracteristiques(e), a]); return a; };
  const nom = memoire.binome || "Vous";
  const c = creerCombat(strategieJoueur, adv, nom, nomAdv, `joueur-${Date.now()}`);
  ring.arreter(); await habiller(nom, nomAdv); ring.reinitialiser(nom, nomAdv);
  $("vue").focus(); sons.reveiller();
  $("bouton-jouer").disabled = true; $("resultat-jeu").innerHTML = "";
  for (const n of ["3", "2", "1"]) { ring.annonce(n, 0.8); await new Promise((ok) => setTimeout(ok, 750)); }
  ring.annonce("COMBAT !", 0.9);
  etat.enJeu = true; touches.clear(); tampon = null;
  // le combat avance au rythme de l'horloge (10 instants par seconde), même si l'image est lente sur un poste faible
  await new Promise((ok) => {
    const pas = 1000 / R.TICKS_PAR_SECONDE, debut = performance.now();
    const minuterie = setInterval(() => {
      const cible = Math.floor((performance.now() - debut) / pas);
      for (let n = 0; n < 4 && c.tick < cible && !c.vainqueur; n++) ring.montrer(c.instant(), pas);
      if (c.vainqueur) { clearInterval(minuterie); ok(); }
    }, pas / 2);
  });
  etat.enJeu = false; $("bouton-jouer").disabled = false;
  etat.dernier = { journal: c.journal, nomA: nom, nomB: nomAdv }; $("bouton-rejouer").disabled = false;
  // enregistrer les décisions du joueur (issue connue à la fin)
  const issue = c.vainqueur === "a" ? "gagne" : c.vainqueur === "b" ? "perdu" : "egalite";
  const lignes = decisions.map(([tick, k, a]) => [c.id, tick, nom, nomAdv, ...k, a, true, issue, c.fin, 1]);
  const joues = lire(CLE_JOUES, []); joues.push({ id: c.id, adversaire: nomAdv, issue, fin: c.fin, lignes });
  while (joues.length > 60) joues.shift();
  const garde = ecrire(CLE_JOUES, joues);
  const f = c.journal.at(-1), r = $("resultat-jeu"), bloc = creer("div", "resultat");
  bloc.append(creer("strong", "", issue === "gagne" ? "Victoire !" : issue === "perdu" ? "Défaite." : "Égalité."),
    creer("p", "", `${c.fin === "ko" ? "K.-O." : "Fin du temps"} après ${(f.tick / R.TICKS_PAR_SECONDE).toFixed(1)} s · vie ${f.vie_a} contre ${f.vie_b}.`),
    creer("p", "", garde ? `Combat enregistré : ${joues.length} combat(s) joué(s) sur ce poste, ${joues.reduce((s, j) => s + j.lignes.length, 0)} décisions.` : "Combat non enregistré (navigation privée ?)."));
  const telecharger = creer("button", "bouton", "Télécharger mes combats (.csv)"); telecharger.type = "button";
  telecharger.addEventListener("click", () => {
    const toutes = lire(CLE_JOUES, []).flatMap((j) => j.lignes);
    fichier(`combats_joues_${(memoire.binome || "joueur").normalize("NFD").replace(/[^\w-]+/g, "_")}.csv`,
      [COLONNES_DECISIONS.join(";"), ...toutes.map((l) => l.map((v) => (v === true ? "True" : v === false ? "False" : v)).join(";"))].join("\n") + "\n", "text/csv");
  });
  bloc.append(telecharger); r.append(bloc);
}

// ---------- programmer ----------
function choisirGeneration(g) {
  etat.generation = g; memoire.generation = g; sauver();
  $("choix-generation").value = String(g); editeur.ecrire(memoire.codes[g] ?? MODELES[g]);
  $("lien-labo").hidden = g !== 3;
}
const monRobot = () => ({ nom: memoire.binome || "votre robot", code: editeur.lire() });
function erreurRobot(e) {
  if (e.ligne) editeur.surligner(e.ligne);
  const p = $("panneau-code"); p.innerHTML = ""; p.append(creer("p", "erreur", `Votre robot ne se charge pas${e.ligne ? ` (ligne ${e.ligne})` : ""} : ${e.message}`));
  sons.jouer("alerte");
}
async function combatCode(nomAdv = $("choix-adversaire-code").value, cote = "a") {
  editeur.surligner(null);
  const moi = monRobot(), adv = { nom: nomAdv, reference: true };
  const [a, b] = cote === "a" ? [moi, adv] : [adv, moi];
  $("bouton-combat-code").disabled = true;
  try {
    const r = await pilote.combat("combat", [a, b], 20000);
    if (r.erreur) { erreurRobot(r.erreur); return; }
    const p = $("panneau-code"); p.innerHTML = "";
    const f = r.journal.at(-1), vous = cote;
    const issue = r.vainqueur === "egalite" ? "Égalité" : r.vainqueur === vous ? "Victoire" : "Défaite";
    p.append(creer("p", "resultat", `${issue} contre ${nomAdv} (${r.fin === "ko" ? "K.-O." : "fin du temps"}, ${(f.tick / 10).toFixed(1)} s, vie ${vous === "a" ? f.vie_a : f.vie_b} contre ${vous === "a" ? f.vie_b : f.vie_a}).`));
    const refus = (r.refus && r.refus[vous]) || [];
    if (refus.length) p.append(creer("p", "erreur", `${refus.length} décision(s) refusée(s), la première à ${(refus[0].tick / 10).toFixed(1)} s : « ${refus[0].decision} » (${refus[0].raison}).`));
    etat.dernier = { journal: r.journal, nomA: a.nom, nomB: b.nom, cote }; $("bouton-rejouer").disabled = false;
    await habiller(a.nom, b.nom, cote);
    ring.rejouer(r.journal, a.nom, b.nom);
  } finally { $("bouton-combat-code").disabled = false; }
}
async function bilan() {
  editeur.surligner(null);
  $("bouton-bilan").disabled = true;
  const p = $("panneau-code"); p.innerHTML = ""; p.append(creer("p", "", "Douze combats en cours…"));
  try {
    const r = await pilote.combat("bilan", [monRobot()], 30000);
    if (r.erreur) { erreurRobot(r.erreur); return; }
    p.innerHTML = ""; p.append(creer("p", "resultat", `${r.victoires} victoire(s) sur ${r.combats}. Cliquez sur une ligne pour revoir le combat.`));
    const t = creer("table", "tours"), tete = creer("tr"); ["Adversaire", "Vous en A", "Vous en B"].forEach((x) => tete.append(creer("th", "", x))); t.append(tete);
    for (const l of r.lignes) {
      const tr = creer("tr", "cliquable");
      const cell = (res, vie, fin) => creer("td", res === "gagné" ? "gagne" : res === "perdu" ? "perdu" : "", `${res} (${vie[0]} à ${vie[1]}${fin === "ko" ? ", K.-O." : ""})`);
      const ca = cell(l.enA, l.vieA, l.finA), cb = cell(l.enB, l.vieB, l.finB);
      ca.addEventListener("click", () => combatCode(l.adversaire, "a")); cb.addEventListener("click", () => combatCode(l.adversaire, "b"));
      tr.append(creer("td", "", l.adversaire), ca, cb); t.append(tr);
    }
    p.append(t);
    sons.jouer(r.victoires >= r.combats / 2 ? "reussi" : "neutre");
  } finally { $("bouton-bilan").disabled = false; }
}

// ---------- revoir, envoyer ----------
async function revoirFichier(f) {
  const z = $("infos-rejeu"); z.innerHTML = "";
  try {
    const d = JSON.parse(await f.text());
    if (!Array.isArray(d.journal) || !d.journal.length || d.journal[0].vie_a === undefined) throw new Error("ce fichier n'est pas un combat du championnat");
    z.append(creer("p", "resultat", `${d.nomA} contre ${d.nomB} : ${d.journal.length} instants.`));
    etat.dernier = { journal: d.journal, nomA: d.nomA, nomB: d.nomB }; $("bouton-rejouer").disabled = false;
    await habiller(d.nomA, d.nomB);
    ring.rejouer(d.journal, d.nomA, d.nomB);
  } catch (e) { z.append(creer("p", "erreur", `Impossible de lire ${f.name} : ${e.message}.`)); }
}
function fichier(nom, contenu, type) {
  const a = creer("a"); a.href = URL.createObjectURL(new Blob([contenu], { type })); a.download = nom; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
async function inscrire() {
  const s = $("statut-envoi");
  if (!memoire.binome) { s.textContent = "Indiquez d'abord vos prénoms."; return; }
  $("bouton-envoyer").disabled = true; s.textContent = "Vérification du robot…";
  try {
    const v = await pilote.combat("combat", [monRobot(), { nom: "boxeur", reference: true }], 20000);
    if (v.erreur) { s.textContent = `Le robot ne se charge pas : ${v.erreur.message}. Corrigez-le avant de l'envoyer.`; return; }
    await envoyer({ binome: memoire.binome, generation: String(etat.generation), modele: memoire.style || "", code: editeur.lire() }, "robot-championnat");
    s.textContent = `Inscrit : ${memoire.binome}, ${GENERATIONS[etat.generation].toLowerCase()}.`; sons.jouer("reussi");
  } catch {
    s.textContent = "L'envoi n'a pas abouti (réseau, ou page ouverte hors du site en ligne). Téléchargez le fichier et envoyez-le par le canal de la classe.";
  } finally { $("bouton-envoyer").disabled = false; }
}

// ---------- démarrage ----------
function onglet(nom) {
  for (const o of document.querySelectorAll(".onglet")) o.setAttribute("aria-selected", String(o.dataset.onglet === nom));
  for (const v of document.querySelectorAll(".vue-onglet")) v.hidden = v.dataset.vue !== nom;
}
async function demarrer() {
  for (const id of ["choix-adversaire-jeu", "choix-adversaire-code"]) {
    for (const n of Object.keys(adversaires())) { const o = creer("option", "", `${n} · ${DESCRIPTIONS[n]}`); o.value = n; $(id).append(o); }
  }
  $("choix-affichage").value = progression.reglage("qualite") === "basse" ? "basse" : "haute";
  $("choix-affichage").addEventListener("change", (e) => { progression.reglage("qualite", e.target.value); location.reload(); });
  for (const o of document.querySelectorAll(".onglet")) o.addEventListener("click", () => onglet(o.dataset.onglet));
  $("bouton-jouer").addEventListener("click", jouer);
  $("choix-generation").value = String(etat.generation); choisirGeneration(etat.generation);
  $("choix-generation").addEventListener("change", (e) => choisirGeneration(Number(e.target.value)));
  $("bouton-modele").addEventListener("click", () => editeur.ecrire(MODELES[etat.generation]));
  $("bouton-combat-code").addEventListener("click", () => combatCode());
  $("bouton-bilan").addEventListener("click", bilan);
  $("fichier-rejeu").addEventListener("change", (e) => { if (e.target.files[0]) revoirFichier(e.target.files[0]); e.target.value = ""; });
  $("champ-binome").value = memoire.binome || "";
  $("champ-binome").addEventListener("input", (e) => { memoire.binome = e.target.value.trim(); sauver(); });
  $("bouton-envoyer").addEventListener("click", inscrire);
  $("bouton-telecharger").addEventListener("click", () => fichier(`${(memoire.binome || "robot").normalize("NFD").replace(/[^\w-]+/g, "_")}_g${etat.generation}.py`, editeur.lire(), "text/x-python"));
  $("bouton-rejouer").addEventListener("click", async () => { if (etat.dernier) { await habiller(etat.dernier.nomA, etat.dernier.nomB, etat.dernier.cote || "a"); ring.rejouer(etat.dernier.journal, etat.dernier.nomA, etat.dernier.nomB); } });
  $("bouton-pause").addEventListener("click", (e) => { const b = e.currentTarget, oui = b.getAttribute("aria-pressed") !== "true"; b.setAttribute("aria-pressed", String(oui)); ring.pause(oui); });
  $("bouton-vitesse").addEventListener("click", (e) => { const b = e.currentTarget, oui = b.getAttribute("aria-pressed") !== "true"; b.setAttribute("aria-pressed", String(oui)); ring.vitesse(oui ? 2 : 1); });
  $("bouton-camera").addEventListener("click", () => ring.recentrer());
  document.addEventListener("pointerdown", () => sons.reveiller(), { once: true });
  if (location.hash === "#programmer") onglet("programmer");
  // le style de votre robot : le premier du catalogue par défaut
  etat.styles = await listeStyles();
  memoire.style = remplirChoix($("choix-style"), etat.styles, memoire.style); sauver();
  const nomStyle = () => { $("nom-style").textContent = etat.styles.find((x) => x.id === memoire.style)?.nom || "?"; };
  nomStyle();
  const selection = creerSelection({ styles: etat.styles, actuel: memoire.style, choisir: (id) => { $("choix-style").value = id; $("choix-style").dispatchEvent(new Event("change")); } });
  $("bouton-selection").addEventListener("click", () => { if (!etat.enJeu) selection.ouvrir(); });
  $("choix-style").addEventListener("change", async (e) => {
    memoire.style = e.target.value; sauver(); nomStyle();
    const d = etat.dernier || etat.demo;                // on revoit le dernier combat (ou l'aperçu) avec le nouveau robot
    if (!etat.enJeu && d) { await habiller(d.nomA, d.nomB, d.cote || "a"); ring.rejouer(d.journal, d.nomA, d.nomB); }
  });
  // un aperçu : deux robots d'entraînement s'affrontent en attendant
  const demo = creerCombat(adversaires().boxeur, adversaires().mur, "boxeur", "mur");
  while (demo.instant()) { /* calcul complet */ }
  etat.demo = { journal: demo.journal, nomA: "boxeur", nomB: "mur" };
  await habiller("boxeur", "mur");
  ring.rejouer(demo.journal, "boxeur", "mur");
}
demarrer();
window.championnat = { etat, ring, jouer, combatCode, bilan, editeur, touches };
