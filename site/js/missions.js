// Jeu 1 : les missions. Carte des séries, écran de mission, exécution, rejeu, étoiles, indices, envoi des résultats.
import * as progression from "./commun/progression.js";
import { PilotePython } from "./commun/python.js";
import { creerEditeur } from "./commun/editeur.js";
import { creerRejeu, VITESSES } from "./commun/rejeu.js";
import { creerVueTexte, decrire } from "./commun/sans3d.js";
import * as sons from "./commun/sons.js";
import { envoyer } from "./commun/resultat.js";

// Les missions marquées « atelier » dans l'index (séries 3 à 6) se jouent dans atelier.html : hall ou Python au choix.
const lienAtelier = (id) => "atelier.html" + location.search + "#mission=" + id;

// ----- Réglages (modifiables par le formateur) -----
const ECHECS_AVANT_INDICE = [2, 4];        // exécutions en échec avant l'indice 1, puis l'indice 2
const ESSAIS_A_REVOIR = 5;                 // au-delà, une mission sans étoile 1 est signalée « à revoir » dans l'envoi
const TOUT_OUVERT = new URLSearchParams(location.search).has("formateur");   // ?formateur=1 : confort de démonstration, pas une sécurité

const $ = (id) => document.getElementById(id);
const etat = { index: null, cache: new Map(), mission: null, tests: "", depart: "", scene: null, texte: null, editeur: null, rejeu: null,
  resultat: null, onglet: "tests", occupe: false, indicesVus: 0 };

// ---------- Python ----------
const pilote = new PilotePython((nom) => {
  const e = $("etat-python");
  if (nom === "pret") { e.textContent = "Python est prêt"; e.className = "etat-python pret"; }
  if (nom === "chargement") { e.textContent = "Préparation de Python…"; e.className = "etat-python"; }
  if (nom === "echec") { e.textContent = "Python n'a pas pu se charger sur ce poste. Rechargez la page ; si le problème continue, prévenez le formateur."; e.className = "etat-python echec"; }
});

// ---------- petits outils d'affichage ----------
function creer(balise, classe, texte) { const e = document.createElement(balise); if (classe) e.className = classe; if (texte !== undefined) e.textContent = texte; return e; }

function dessinerEtoiles(conteneur, etoiles) {
  conteneur.innerHTML = "";
  etoiles.forEach((gagnee) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("class", "etoile" + (gagnee ? " gagnee" : "")); svg.setAttribute("aria-hidden", "true");
    const chemin = document.createElementNS("http://www.w3.org/2000/svg", "path");
    chemin.setAttribute("d", "M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z");
    svg.appendChild(chemin); conteneur.appendChild(svg);
  });
  conteneur.setAttribute("aria-label", `${etoiles.filter(Boolean).length} étoile(s) sur 3`);
}

const missionsDeLaSerie = (n) => etat.index.missions.filter((m) => m.serie === n);
const serieReussie = (n) => missionsDeLaSerie(n).filter((m) => !m.bonus).every((m) => progression.fiche(m.id).etoiles[0]);
const serieOuverte = (n) => TOUT_OUVERT || n === 1 || serieReussie(n - 1);

// ---------- carte ----------
function afficherCarte() {
  if (etat.rejeu) etat.rejeu.arreter();
  $("vue-mission").hidden = true; $("vue-carte").hidden = false;
  document.title = "Les missions de la Brasserie de la Fonderie";
  const p = progression.lire();
  $("bouton-qualite").textContent = "Qualité : " + (p.qualite === "basse" ? "basse" : "haute");
  $("bouton-sans3d").textContent = p.sans3d ? "Mode : sans 3D" : "Mode : 3D";
  const zone = $("series"); zone.innerHTML = "";
  for (const serie of etat.index.series) {
    const ouverte = serieOuverte(serie.numero), missions = missionsDeLaSerie(serie.numero);
    const colonne = creer("section", "serie" + (ouverte ? "" : " fermee"));
    colonne.append(creer("div", "serie-numero", "SÉRIE " + serie.numero), creer("h2", "", serie.titre));
    const gagnees = missions.reduce((s, m) => s + progression.fiche(m.id).etoiles.filter(Boolean).length, 0);
    colonne.append(creer("div", "serie-etat", ouverte ? `${gagnees} étoile(s) sur ${missions.length * 3}` : `S'ouvre quand la série ${serie.numero - 1} est réussie`));
    for (const m of missions) {
      const bouton = creer("button", "carte-mission" + (m.surprise ? " surprise" : ""));
      bouton.type = "button"; bouton.disabled = !ouverte;
      const numero = creer("span", "mission-numero", `Mission ${m.serie}.${m.numero}`);
      if (m.surprise) numero.append(creer("span", "badge", "Contrôle surprise"));
      if (m.bonus) numero.append(creer("span", "badge bonus", "Bonus"));
      const etoiles = creer("span", "etoiles"); dessinerEtoiles(etoiles, progression.fiche(m.id).etoiles);
      bouton.append(numero, creer("span", "mission-titre", m.titre), etoiles);
      if (m.atelier) bouton.classList.add("atelier");
      bouton.addEventListener("click", () => { if (m.atelier) location.href = lienAtelier(m.id); else location.hash = "mission=" + m.id; });
      colonne.append(bouton);
    }
    zone.append(colonne);
  }
}

// ---------- scène ou journal en texte ----------
async function preparerVue() {
  const p = progression.lire(), vue = $("vue");
  if (etat.scene || etat.texte) return;
  if (!p.sans3d) {
    try {
      const { creerScene } = await import("./commun/scene.js");
      etat.scene = creerScene(vue, { qualite: p.qualite === "basse" ? "basse" : "haute" });
      etat.scene.surLenteur = () => avis("L'affichage est lent sur ce poste.", "Passer en qualité basse", () => { progression.reglage("qualite", "basse"); changerVue(); });
    } catch (erreur) {
      console.warn("La 3D n'a pas pu démarrer : passage au journal en texte.", erreur);
      etat.scene = null;
    }
  }
  if (!etat.scene) {
    const zone = creer("div"); zone.style.height = "100%"; vue.prepend(zone);
    etat.texte = creerVueTexte(zone); etat.zoneTexte = zone; $("legende").hidden = true;
  } else { $("legende").hidden = false; }
  etat.rejeu = creerRejeu({ scene: etat.scene, texte: etat.texte, surAction: legende, surFin: finDuRejeu });
  etat.rejeu.vitesse(VITESSES[$("bouton-vitesse").getAttribute("aria-pressed") === "true" ? 1 : 0]);
}

function detruireVue() {
  if (etat.rejeu) etat.rejeu.arreter();
  if (etat.scene) etat.scene.detruire();
  if (etat.zoneTexte) etat.zoneTexte.remove();
  etat.scene = null; etat.texte = null; etat.zoneTexte = null; etat.rejeu = null;
}

async function changerVue() {
  detruireVue();
  if (etat.mission) { await preparerVue(); etat.rejeu.preparer(etat.mission, etat.resultat ? etat.resultat.journal : [], null); }
}

function avis(texte, libelle, action) {
  const ancien = document.querySelector(".avis"); if (ancien) ancien.remove();
  const bandeau = creer("div", "avis"); bandeau.setAttribute("role", "status");
  bandeau.append(creer("span", "", texte));
  if (libelle) { const b = creer("button", "bouton", libelle); b.type = "button"; b.addEventListener("click", () => { bandeau.remove(); action(); }); bandeau.append(b); }
  const fermer = creer("button", "bouton discret", "Fermer"); fermer.type = "button"; fermer.addEventListener("click", () => bandeau.remove()); bandeau.append(fermer);
  $("vue").append(bandeau);
}

function legende(action, numero, total) {
  const zone = $("legende");
  if (!action) { zone.textContent = total ? `${total} action(s) à rejouer.` : "Exécutez votre code : le préparateur rejoue ce qu'il produit."; zone.classList.remove("echec"); etat.editeur && etat.editeur.surligner(null); return; }
  zone.textContent = `Action ${numero} sur ${total} : ${decrire(action)}`;
  zone.classList.toggle("echec", !action.ok);
  if (etat.editeur) etat.editeur.surligner(action.ligne);
}

// ---------- écran de mission ----------
async function chargerMission(id) {
  if (!etat.cache.has(id)) {
    const base = `missions/${id}/`;
    const [mission, depart, tests] = await Promise.all([
      fetch(base + "mission.json").then((r) => r.json()), fetch(base + "depart.py").then((r) => r.text()), fetch(base + "tests.py").then((r) => r.text())]);
    etat.cache.set(id, { mission, depart, tests });
  }
  return etat.cache.get(id);
}

async function ouvrirMission(id) {
  const fiche = etat.index.missions.find((m) => m.id === id);
  if (!fiche || !serieOuverte(fiche.serie)) { location.hash = ""; return; }
  if (fiche.atelier) { location.replace(lienAtelier(id)); return; }
  const { mission, depart, tests } = await chargerMission(id);
  Object.assign(etat, { mission, depart, tests, resultat: null, onglet: "tests" });
  $("vue-carte").hidden = true; $("vue-mission").hidden = false;
  const bilan = document.querySelector(".bilan"); if (bilan) bilan.remove();
  document.title = `Mission ${mission.serie}.${mission.numero} · ${mission.titre}`;
  $("mission-id").textContent = `MISSION ${mission.serie}.${mission.numero}`;
  $("mission-surtitre").textContent = `Série ${mission.serie} · ${etat.index.series.find((s) => s.numero === mission.serie).titre}` + (mission.surprise ? " · Contrôle surprise" : "") + (mission.bonus ? " · Bonus" : "");
  $("mission-titre").textContent = mission.titre;
  $("mission-enonce").textContent = mission.enonce;
  $("nom-fichier").textContent = id.replace(/^\d+\.\d+-/, "").replace(/-/g, "_") + ".py";
  const sauve = progression.fiche(id);
  if (!etat.editeur) etat.editeur = creerEditeur($("editeur"), { surChangement: (code) => etat.mission && progression.sauverCode(etat.mission.id, code), surExecuter: executer });
  etat.editeur.ecrire(sauve.code || depart);
  etat.indicesVus = indicesDebloques();
  majObjectifs();
  afficherOnglet("tests");
  await preparerVue();
  etat.rejeu.preparer(mission, [], null);
}

function majObjectifs() {
  const m = etat.mission, f = progression.fiche(m.id);
  dessinerEtoiles($("mission-etoiles"), f.etoiles);
  const liste = $("mission-objectifs"); liste.innerHTML = "";
  [m.etoiles.description1, m.etoiles.description2, m.etoiles.description3].forEach((texte, i) => {
    const li = creer("li", f.etoiles[i] ? "gagnee" : "");
    const marque = creer("span", "etoiles"); dessinerEtoiles(marque, [f.etoiles[i]]); marque.removeAttribute("aria-label");
    li.append(marque, creer("span", "", `Étoile ${i + 1}${f.etoiles[i] ? " gagnée" : ""} : ${texte}`));
    liste.append(li);
  });
}

const indicesDebloques = () => { const e = progression.fiche(etat.mission.id).echecs || 0; return ECHECS_AVANT_INDICE.filter((seuil) => e >= seuil).length; };

function afficherOnglet(nom) {
  etat.onglet = nom;
  for (const b of document.querySelectorAll(".onglet")) { b.setAttribute("aria-selected", String(b.dataset.onglet === nom)); if (b.dataset.onglet === nom) b.classList.remove("nouveau"); }
  const panneau = $("panneau"); panneau.innerHTML = "";
  const r = etat.resultat;
  if (nom === "tests") {
    if (!r) { panneau.append(creer("p", "vide", `Exécutez votre code pour lancer les tests. Réussi si : ${etat.mission.reussiSi.charAt(0).toLowerCase() + etat.mission.reussiSi.slice(1)}`)); $("resume-tests").textContent = ""; return; }
    for (const t of r.tests) {
      const ligne = creer("div", "test " + (t.ok ? "ok" : "echec"));
      const texte = creer("div"); texte.append(t.libelle);
      if (t.groupe !== "visible") texte.append(creer("span", "groupe", t.groupe === "bonus" ? "Bonus" : "Contrôle surprise"));
      if (!t.ok && t.message) texte.append(creer("span", "detail", t.message));
      ligne.append(creer("span", "marque", t.ok ? "OK" : "ÉCHEC"), texte);
      panneau.append(ligne);
    }
    if (!r.tests.length) panneau.append(creer("p", "vide", "Aucun test n'a pu tourner : regardez l'onglet Erreur."));
  } else if (nom === "sortie") {
    if (r && r.sortie.length) { const pre = creer("pre", "sortie", r.sortie.join("\n")); panneau.append(pre); }
    else panneau.append(creer("p", "vide", "Ce que votre code affiche avec print() apparaît ici."));
  } else if (nom === "erreur") {
    if (r && r.erreur) {
      const e = r.erreur;
      panneau.append(creer("p", "erreur-original", e.messageOriginal + (e.ligne ? `  (ligne ${e.ligne})` : "")), creer("p", "erreur-explication", e.explication), creer("p", "erreur-conseil", e.conseil));
    } else panneau.append(creer("p", "vide", "Aucune erreur. Si Python s'arrête sur une erreur, elle est expliquée ici."));
  } else {
    const n = indicesDebloques();
    if (!n) panneau.append(creer("p", "vide", `Le premier indice s'ouvre après ${ECHECS_AVANT_INDICE[0]} exécutions avec un test en échec.`));
    etat.mission.indices.slice(0, n).forEach((texte, i) => panneau.append(creer("p", "indice", `Indice ${i + 1}. ${texte}`)));
    if (n === 1 && etat.mission.indices.length > 1) panneau.append(creer("p", "vide", "Un second indice s'ouvre si les tests échouent encore."));
    etat.indicesVus = n;
  }
}

function majResume() {
  const r = etat.resultat; if (!r) return;
  const visibles = r.tests.filter((t) => t.groupe === "visible"), bonus = r.tests.filter((t) => t.groupe === "bonus"), caches = r.tests.filter((t) => t.groupe === "cache");
  let texte = `${visibles.filter((t) => t.ok).length} test(s) sur ${visibles.length}`;
  if (bonus.length) texte += ` · bonus : ${bonus.filter((t) => t.ok).length} sur ${bonus.length}`;
  if (caches.length) texte += ` · surprise : ${caches.filter((t) => t.ok).length} sur ${caches.length}`;
  $("resume-tests").textContent = texte;
}

// ---------- exécution ----------
async function executer() {
  if (etat.occupe || !etat.mission) return;
  etat.occupe = true; sons.reveiller();
  const bouton = $("bouton-executer"); bouton.textContent = "Exécution…";
  const bilan = document.querySelector(".bilan"); if (bilan) bilan.remove();
  const mission = etat.mission, code = etat.editeur.lire();
  try {
    const r = await pilote.executer(mission, code, etat.tests);
    if (etat.mission !== mission) return;
    etat.resultat = r;
    progression.noterResultat(mission.id, r.etoiles, code);
    majObjectifs(); majResume();
    afficherOnglet(r.erreur ? "erreur" : "tests");
    if (indicesDebloques() > etat.indicesVus) document.querySelector('.onglet[data-onglet="indice"]').classList.add("nouveau");
    etat.rejeuTermine = false;
    etat.rejeu.preparer(mission, r.journal, { reussi: r.etoiles[0], erreur: Boolean(r.erreur) });
    etat.rejeu.lancer();
  } catch (erreur) {
    console.error(erreur);
    etat.resultat = { tests: [], sortie: [], journal: [], etoiles: [false, false, false], erreur: { messageOriginal: String(erreur.message || erreur), ligne: null,
      explication: "Le moteur du jeu a rencontré un problème : ce n'est pas votre code.", conseil: "Rechargez la page. Si le problème continue, prévenez le formateur." } };
    afficherOnglet("erreur");
  } finally { etat.occupe = false; bouton.textContent = "Exécuter"; }
}

// ---------- bilan de fin de rejeu ----------
function finDuRejeu(bilan) {
  etat.rejeuTermine = true;
  const r = etat.resultat, m = etat.mission;
  if (bilan && r && r.erreur) {            // Python s'est arrêté : on le dit sous la scène et on montre la ligne en cause
    const zone = $("legende");
    zone.textContent = "Python s'est arrêté sur une erreur" + (r.erreur.ligne ? `, ligne ${r.erreur.ligne}` : "") + " : l'onglet Erreur l'explique.";
    zone.classList.add("echec");
    if (r.erreur.ligne) etat.editeur.surligner(r.erreur.ligne);
  }
  if (!bilan || !r || !r.etoiles[0]) return;
  sons.jouer("etoile");
  const regle = m.etoiles, carte = creer("div", "bilan-carte"), fond = creer("div", "bilan");
  carte.setAttribute("role", "dialog"); carte.setAttribute("aria-label", "Mission réussie");
  const etoiles = creer("div", "etoiles"); dessinerEtoiles(etoiles, r.etoiles);
  carte.append(creer("h2", "", "Mission réussie"), etoiles);
  const unite = regle.critere === "actions" ? "actions" : "lignes";
  carte.append(creer("p", "", r.etoiles[1] ? `Étoile 2 gagnée : ${r.mesureEtoile2} ${unite}, l'objectif était ${regle.max} ou moins.`
    : `Étoile 2 à gagner : ${r.mesureEtoile2} ${unite}, l'objectif est ${regle.max} ou moins.`));
  carte.append(creer("p", "", r.etoiles[2] ? "Étoile 3 gagnée : le test bonus passe." : "Étoile 3 à gagner : le test bonus ne passe pas encore."));
  const caches = r.tests.filter((t) => t.groupe === "cache");
  if (caches.length) carte.append(creer("p", "", caches.every((t) => t.ok) ? "Contrôle surprise : réussi." : "Contrôle surprise : pas encore. Regardez le test marqué « Contrôle surprise »."));
  const liste = etat.index.missions, rang = liste.findIndex((x) => x.id === m.id), suivante = liste[rang + 1];
  const finSerie = serieReussie(m.serie) && (!suivante || suivante.serie !== m.serie || suivante.bonus);
  if (finSerie) {
    const gagnees = missionsDeLaSerie(m.serie).reduce((s, x) => s + progression.fiche(x.id).etoiles.filter(Boolean).length, 0);
    carte.append(creer("p", "", `Série ${m.serie} réussie : ${gagnees} étoile(s) sur ${missionsDeLaSerie(m.serie).length * 3}.`));
    const prochaine = etat.index.series.find((s) => s.numero === m.serie + 1);
    if (prochaine) carte.append(creer("p", "", `Série ${prochaine.numero} ouverte. ${prochaine.outil}`));
    carte.append(creer("p", "", "Le même exercice vous attend dans VS Code si le formateur l'a prévu."));
  }
  const actions = creer("div", "bilan-actions");
  const ameliorer = creer("button", "bouton", "Améliorer"); ameliorer.type = "button"; ameliorer.addEventListener("click", () => { fond.remove(); etat.editeur.focus(); });
  actions.append(ameliorer);
  if (suivante && serieOuverte(suivante.serie)) { const b = creer("button", "bouton principal", "Mission suivante"); b.type = "button"; b.addEventListener("click", () => { location.hash = "mission=" + suivante.id; }); actions.append(b); }
  else { const b = creer("button", "bouton principal", "Retour à la carte"); b.type = "button"; b.addEventListener("click", () => { location.hash = ""; }); actions.append(b); }
  carte.append(actions); fond.append(carte); $("vue").append(fond);
  (actions.querySelector(".principal") || ameliorer).focus();
}

// ---------- envoi des résultats ----------
async function envoyerResultats() {
  const p = progression.lire(), message = $("message-carte");
  if (!p.pseudo) { message.textContent = "Indiquez un prénom ou un pseudo sur la page d'accueil avant d'envoyer vos résultats."; return; }
  const fiches = etat.index.missions.map((m) => ({ m, f: progression.fiche(m.id) }));
  const reussies = fiches.filter((x) => x.f.etoiles[0]);
  const champs = {
    pseudo: p.pseudo, date: new Date().toISOString().slice(0, 19),
    serie_max_atteinte: String(reussies.reduce((s, x) => Math.max(s, x.m.serie), 0)),
    missions_reussies: String(reussies.length),
    etoiles_total: String(fiches.reduce((s, x) => s + x.f.etoiles.filter(Boolean).length, 0)),
    missions_a_revoir: fiches.filter((x) => !x.f.etoiles[0] && x.f.essais > ESSAIS_A_REVOIR).map((x) => x.m.id).join(", "),
    mode: p.sans3d ? "sans 3D" : "3D", qualite: p.qualite || "haute",
  };
  message.textContent = "Envoi en cours…";
  try { await envoyer(champs); message.textContent = "Résultat envoyé."; }
  catch (erreur) { message.textContent = "L'envoi n'a pas fonctionné. Réessayez ; si le problème continue, prévenez le formateur."; console.warn(erreur); }
}

// ---------- boutons à confirmation (sans fenêtre du navigateur) ----------
function avecConfirmation(bouton, libelle, action) {
  let arme = false, minuterie = null;
  bouton.addEventListener("click", () => {
    if (!arme) { arme = true; bouton.textContent = "Confirmer ?"; bouton.classList.add("danger"); minuterie = setTimeout(() => { arme = false; bouton.textContent = libelle; bouton.classList.remove("danger"); }, 4000); return; }
    clearTimeout(minuterie); arme = false; bouton.textContent = libelle; bouton.classList.remove("danger"); action();
  });
}

// ---------- branchements ----------
function basculer(bouton, action) { bouton.addEventListener("click", () => { const actif = bouton.getAttribute("aria-pressed") !== "true"; bouton.setAttribute("aria-pressed", String(actif)); action(actif); }); }

function brancher() {
  $("bouton-carte").addEventListener("click", () => { location.hash = ""; });
  $("bouton-executer").addEventListener("click", executer);
  $("bouton-rejouer").addEventListener("click", () => { sons.reveiller(); if (etat.resultat) etat.rejeu.rejouer(); else legende(null, 0, 0); });
  $("bouton-pas").addEventListener("click", pasAPas);
  basculer($("bouton-pause"), (actif) => etat.rejeu && etat.rejeu.pause(actif));
  basculer($("bouton-vitesse"), (actif) => etat.rejeu && etat.rejeu.vitesse(VITESSES[actif ? 1 : 0]));
  basculer($("bouton-son"), (actif) => { sons.activer(actif); progression.reglage("son", actif); });
  if (progression.reglage("son") === false) { $("bouton-son").setAttribute("aria-pressed", "false"); sons.activer(false); }
  $("bouton-agrandir").addEventListener("click", () => etat.editeur && etat.editeur.agrandir());
  avecConfirmation($("bouton-depart"), "Revenir au code de départ", () => { etat.editeur.ecrire(etat.depart); progression.sauverCode(etat.mission.id, etat.depart); });
  avecConfirmation($("bouton-zero"), "Recommencer à zéro", () => { const p = progression.lire(), garde = { pseudo: p.pseudo, qualite: p.qualite, sans3d: p.sans3d, son: p.son }; progression.toutEffacer(); Object.entries(garde).forEach(([c, v]) => progression.reglage(c, v)); afficherCarte(); $("message-carte").textContent = "La progression est remise à zéro."; });
  $("bouton-envoyer").addEventListener("click", envoyerResultats);
  $("bouton-qualite").addEventListener("click", () => { progression.reglage("qualite", progression.reglage("qualite") === "basse" ? "haute" : "basse"); detruireVue(); afficherCarte(); });
  $("bouton-sans3d").addEventListener("click", () => { progression.reglage("sans3d", !progression.reglage("sans3d")); detruireVue(); afficherCarte(); });
  for (const b of document.querySelectorAll(".onglet")) b.addEventListener("click", () => afficherOnglet(b.dataset.onglet));
  document.addEventListener("keydown", (e) => {
    if ($("vue-mission").hidden) return;
    if (e.key === "F10") { e.preventDefault(); pasAPas(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); executer(); return; }
    const dansEditeur = e.target.closest && e.target.closest("#editeur, input, textarea");
    if (dansEditeur || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "m" || e.key === "M") $("bouton-son").click();
    if (e.key === "p" || e.key === "P") $("bouton-pause").click();
  });
  window.addEventListener("hashchange", naviguer);
}

function pasAPas() {
  sons.reveiller();
  if (!etat.resultat) { legende(null, 0, 0); $("legende").textContent = "Exécutez d'abord votre code : le pas à pas rejoue ses actions une par une."; return; }
  const bilan = document.querySelector(".bilan"); if (bilan) bilan.remove();
  etat.rejeu.pas();
}

function naviguer() {
  const m = location.hash.match(/^#mission=(.+)$/);
  if (m) ouvrirMission(decodeURIComponent(m[1])); else afficherCarte();
}

async function demarrer() {
  etat.index = await fetch("missions/index.json").then((r) => r.json());
  brancher();
  naviguer();
  window.jeu = { etat, pilote, executer };          // accès pour le contrôle qualité automatique
}

demarrer();
