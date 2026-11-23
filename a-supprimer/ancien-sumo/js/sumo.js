// Le sumo des robots, atelier de stratégie : le stagiaire écrit strategie(etat), la fait combattre contre les robots
// d'entraînement (moteur Python dans le navigateur, le même que dans VS Code), revoit le combat en 3D et l'envoie au tournoi.
import { PilotePython } from "../commun/python.js";
import { creerEditeur } from "../commun/editeur.js";
import * as progression from "../commun/progression.js";
import * as sons from "../commun/sons.js";
import { envoyer } from "../commun/resultat.js";
import { creerArene } from "./arene.js";
import { MODELES, GENERATIONS } from "./modeles.js";

const CLE = "jeux-python.sumo.v1";
const $ = (id) => document.getElementById(id);
const creer = (balise, classe, texte) => { const e = document.createElement(balise); if (classe) e.className = classe; if (texte !== undefined) e.textContent = texte; return e; };
const SANS_3D = progression.reglage("sumoSans3d") === true;

const memoire = (() => { try { return JSON.parse(localStorage.getItem(CLE)) || {}; } catch { return {}; } })();
memoire.codes = memoire.codes || {};
const sauver = () => { try { localStorage.setItem(CLE, JSON.stringify(memoire)); } catch { /* navigation privée : rien n'est gardé */ } };

const etat = { generation: Number(memoire.generation) || 1, combat: null, bilan: null, regles: null, onglet: "combat", tourAffiche: null };
const pilote = new PilotePython((nom) => {
  const e = $("etat-python");
  if (nom === "pret") { e.textContent = "Python est prêt"; e.className = "etat-python pret"; }
  if (nom === "echec") { e.textContent = "Python n'a pas pu se charger. Rechargez la page."; e.className = "etat-python echec"; }
});

let arene = null;
if (!SANS_3D) arene = creerArene($("vue"), { qualite: progression.reglage("qualite") === "basse" ? "basse" : "haute" });
else { $("vue").classList.add("sans-3d"); $("vue").append(creer("p", "vide", "Sans 3D : le combat se lit dans le tableau des tours, onglet Combat.")); }

const editeur = creerEditeur($("editeur"), { texte: memoire.codes[etat.generation] ?? MODELES[etat.generation], libelle: "Code de votre robot",
  surChangement: (texte) => { memoire.codes[etat.generation] = texte; sauver(); }, surExecuter: () => combattre() });

function choisirGeneration(g) {
  etat.generation = g; memoire.generation = g; sauver();
  $("choix-generation").value = String(g);
  editeur.ecrire(memoire.codes[g] ?? MODELES[g]);
  $("lien-labo").hidden = g !== 3;
  $("nom-fichier").textContent = g === 1 ? "strategie.py" : `robot${g}.py`;
}

// ---------- combats ----------
const robot = () => ({ nom: memoire.binome || "votre robot", code: editeur.lire() });
function signalerErreur(e) {
  etat.combat = null;
  if (e.ligne) editeur.surligner(e.ligne);
  afficher("combat", { erreur: e });
  sons.jouer("alerte");
}

async function combattre() {
  if (arene && arene.enCours()) arene.arreter();
  editeur.surligner(null);
  const adversaire = { nom: $("choix-adversaire").value, reference: true }, moi = robot(), cote = $("choix-cote").value;
  const [a, b] = cote === "a" ? [moi, adversaire] : [adversaire, moi];
  $("bouton-combat").disabled = true;
  try {
    const r = await pilote.sumo("combat", [a, b]);
    if (r.erreur) { signalerErreur(r.erreur); return; }
    etat.combat = { ...r, nomA: a.nom, nomB: b.nom, cote };
    afficher("combat");
    rejouer();
  } finally { $("bouton-combat").disabled = false; }
}

async function rejouer() {
  if (!etat.combat || !arene) return;
  $("bouton-rejouer").disabled = false; $("bouton-pause").disabled = false;
  arene.charger({ journal: etat.combat.journal, nomA: etat.combat.nomA, nomB: etat.combat.nomB }, etat.regles);
  await arene.jouer();
}

async function faireBilan() {
  editeur.surligner(null);
  $("bouton-bilan").disabled = true;
  try {
    const r = await pilote.sumo("bilan", [robot()], 20000);
    if (r.erreur) { signalerErreur(r.erreur); return; }
    etat.bilan = r; afficher("bilan");
    sons.jouer(r.victoires >= r.combats / 2 ? "reussi" : "neutre");
  } finally { $("bouton-bilan").disabled = false; }
}

// ---------- le panneau ----------
const ACTIONS = { avancer: "avance", reculer: "recule", pousser: "pousse", ancrer: "s'ancre", recharger: "recharge" };
function texteAction(l, c) {
  if (l[`valide_${c}`]) return ACTIONS[l[`action_${c}`]] || l[`action_${c}`];
  const r = l[`raison_${c}`] || "";
  if (r.startsWith("exception:")) return `plante (${r.slice(10)})`;
  if (r === "energie_insuffisante") return `${l[`action_${c}`]} refusé : pas assez d'énergie`;
  if (r === "action_inconnue") return `« ${l[`action_${c}`]} » : action inconnue`;
  if (r.startsWith("pas_une_chaine")) return `ne renvoie pas une action (${r.split(":")[1]})`;
  return r;
}
function plateforme(l) {
  const n = (etat.regles && etat.regles.TAILLE_PLATEFORME) || 9, cases = Array(n).fill("·");
  if (l.position_a >= 0 && l.position_a < n) cases[l.position_a] = "A";
  if (l.position_b >= 0 && l.position_b < n) cases[l.position_b] = "B";
  return `${l.position_a < 0 ? "x" : " "}[${cases.join(" ")}]${l.position_b >= n ? "x" : " "}`;
}

function afficher(nom, extra = {}) {
  etat.onglet = nom;
  for (const o of document.querySelectorAll(".onglet")) o.setAttribute("aria-selected", String(o.dataset.onglet === nom));
  const p = $("panneau"); p.innerHTML = ""; $("resume").textContent = "";
  if (nom === "combat") {
    if (extra.erreur) {
      const e = extra.erreur;
      p.append(creer("p", "erreur", `Votre robot ne se charge pas${e.ligne ? ` (ligne ${e.ligne})` : ""} : ${e.message}`));
      return;
    }
    const c = etat.combat;
    if (!c) { p.append(creer("p", "vide", "Choisissez un adversaire, puis « Combattre » (Ctrl+Entrée). Le combat se rejoue sur le quai, et ici tour par tour.")); return; }
    const vous = c.cote, noms = { a: c.nomA, b: c.nomB };
    const issue = c.vainqueur === "egalite" ? "Égalité" : c.vainqueur === vous ? "Vous gagnez" : "Vous perdez";
    $("resume").textContent = `${issue} en ${c.journal.length} tour(s)`;
    const refus = (c.refus && c.refus[vous]) || [];
    if (refus.length) p.append(creer("p", "erreur", `Votre robot a perdu ${refus.length} tour(s) : ${texteAction(c.journal[refus[0].tour - 1], vous)} au tour ${refus[0].tour}.`));
    const table = creer("table", "tours");
    const tete = creer("tr"); ["Tour", "Quai", "Énergie A / B", `A : ${noms.a}`, `B : ${noms.b}`].forEach((t) => tete.append(creer("th", "", t))); table.append(tete);
    c.journal.forEach((l, i) => {
      const tr = creer("tr", (l.valide_a ? "" : "refus-a ") + (l.valide_b ? "" : "refus-b"));
      tr.append(creer("td", "", String(l.tour)), creer("td", "code", plateforme(l)), creer("td", "", `${l.energie_a} / ${l.energie_b}`),
        creer("td", l.valide_a ? "" : "refus", texteAction(l, "a")), creer("td", l.valide_b ? "" : "refus", texteAction(l, "b")));
      tr.title = "Cliquez : le quai montre ce tour";
      tr.addEventListener("click", () => { if (arene) arene.allerAuTour(i); });
      table.append(tr);
    });
    p.append(table);
    const fin = c.journal[c.journal.length - 1];
    p.append(creer("p", "fin-combat", fin.vainqueur === "egalite" ? "Égalité." : `Victoire de ${noms[fin.vainqueur]} : ${fin.fin === "sortie" ? "l'autre est sorti du quai" : "le plus proche du centre après le dernier tour"}.`));
  } else if (nom === "bilan") {
    const b = etat.bilan;
    if (!b) { p.append(creer("p", "vide", "« Bilan contre les cinq » : votre robot affronte chaque robot d'entraînement deux fois, en A puis en B (10 combats).")); return; }
    $("resume").textContent = `${b.victoires} victoire(s) sur ${b.combats}`;
    const table = creer("table", "tours");
    const tete = creer("tr"); ["Adversaire", "Vous en A", "Vous en B"].forEach((t) => tete.append(creer("th", "", t))); table.append(tete);
    for (const l of b.lignes) {
      const tr = creer("tr");
      tr.append(creer("td", "", l.adversaire), creer("td", l.enA === "gagné" ? "gagne" : l.enA === "perdu" ? "perdu" : "", `${l.enA} (${l.toursA} tours)`),
        creer("td", l.enB === "gagné" ? "gagne" : l.enB === "perdu" ? "perdu" : "", `${l.enB} (${l.toursB} tours)`));
      table.append(tr);
    }
    p.append(table, creer("p", "vide", "Pour revoir un combat : choisissez l'adversaire et le côté en bas de l'arène, puis « Combattre »."));
  } else if (nom === "regles") {
    p.append(creer("pre", "regles", etat.texteRegles || "Chargement des règles…"));
  } else if (nom === "envoyer") {
    const f = creer("div", "envoi");
    const champ = creer("label", "champ"); champ.append(creer("span", "", "Binôme (vos prénoms)"));
    const entree = creer("input"); entree.type = "text"; entree.value = memoire.binome || ""; entree.maxLength = 40; entree.id = "champ-binome";
    entree.addEventListener("input", () => { memoire.binome = entree.value.trim(); sauver(); });
    champ.append(entree);
    const bouton = creer("button", "bouton principal", `Envoyer au tournoi (${GENERATIONS[etat.generation].toLowerCase()})`); bouton.type = "button";
    const statut = creer("p", "statut");
    bouton.addEventListener("click", async () => {
      if (!memoire.binome) { statut.textContent = "Indiquez d'abord vos prénoms."; return; }
      bouton.disabled = true; statut.textContent = "Vérification du robot…";
      const verif = await pilote.sumo("combat", [robot(), { nom: "foncer", reference: true }]);
      if (verif.erreur) { statut.textContent = `Le robot ne se charge pas : ${verif.erreur.message}. Corrigez-le avant de l'envoyer.`; bouton.disabled = false; return; }
      try {
        await envoyer({ binome: memoire.binome, generation: String(etat.generation), code: editeur.lire() }, "strategie-sumo");
        statut.textContent = `Envoyé : ${memoire.binome}, génération ${etat.generation}. Vous pouvez le renvoyer : le formateur garde le dernier envoi.`;
        sons.jouer("reussi");
      } catch (e) {
        statut.textContent = "L'envoi n'a pas abouti (réseau, ou page ouverte hors du site en ligne). Téléchargez le fichier et envoyez-le par le canal de la classe.";
      } finally { bouton.disabled = false; }
    });
    const telecharger = creer("button", "bouton", "Télécharger le fichier .py"); telecharger.type = "button";
    telecharger.addEventListener("click", () => {
      const nom = `${(memoire.binome || "robot").normalize("NFD").replace(/[^\w-]+/g, "_")}_g${etat.generation}.py`;
      const lien = creer("a"); lien.href = URL.createObjectURL(new Blob([editeur.lire()], { type: "text/x-python" })); lien.download = nom; lien.click();
      setTimeout(() => URL.revokeObjectURL(lien.href), 2000);
    });
    f.append(champ, creer("div", "rangee", ""), statut);
    f.querySelector(".rangee").append(bouton, telecharger);
    p.append(f);
  }
}

// ---------- démarrage ----------
async function demarrer() {
  $("choix-generation").value = String(etat.generation); choisirGeneration(etat.generation);
  $("choix-affichage").value = SANS_3D ? "texte" : progression.reglage("qualite") === "basse" ? "basse" : "haute";
  $("choix-affichage").addEventListener("change", (ev) => {
    const v = ev.target.value;
    progression.reglage("sumoSans3d", v === "texte"); if (v !== "texte") progression.reglage("qualite", v);
    location.reload();
  });
  $("choix-generation").addEventListener("change", (ev) => choisirGeneration(Number(ev.target.value)));
  $("bouton-modele").addEventListener("click", () => { editeur.ecrire(MODELES[etat.generation]); });
  $("bouton-combat").addEventListener("click", combattre);
  $("bouton-bilan").addEventListener("click", faireBilan);
  $("bouton-rejouer").addEventListener("click", rejouer);
  $("bouton-pause").addEventListener("click", (ev) => { const b = ev.currentTarget, oui = b.getAttribute("aria-pressed") !== "true"; b.setAttribute("aria-pressed", String(oui)); arene?.pause(oui); });
  $("bouton-rapide").addEventListener("click", (ev) => { const b = ev.currentTarget, oui = b.getAttribute("aria-pressed") !== "true"; b.setAttribute("aria-pressed", String(oui)); arene?.rapide(oui); });
  for (const o of document.querySelectorAll(".onglet")) o.addEventListener("click", () => afficher(o.dataset.onglet));
  document.addEventListener("pointerdown", () => sons.reveiller(), { once: true });
  afficher("combat");
  try { etat.texteRegles = await (await fetch("python/sumo/regles.py")).text(); } catch { /* l'onglet le dira */ }
  await pilote.pret;
  etat.regles = await pilote.sumo("regles", []);
}
demarrer();
window.sumo = { etat, combattre, faireBilan, editeur, choisirGeneration };
