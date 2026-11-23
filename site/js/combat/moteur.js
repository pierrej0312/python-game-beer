// Le moteur du championnat, en JavaScript : traduction ligne à ligne de moteur.py, pour jouer au clavier et pour
// entraîner le robot 3 par renforcement (des milliers de combats en quelques secondes). Le tournoi et VS Code
// utilisent moteur.py ; qa/verifie_moteur_combat.py vérifie que les deux donnent le même journal, instant par instant.
import { R } from "./regles.js";

const PHASES_COUP = ["preparation", "frappe", "recuperation"];
const VISIBLE = { avance: "avancer", recul: "reculer", garde: "garde", garde_basse: "garde_basse", esquive: "esquive", sonne: "sonne" };
const div = (a, b) => Math.floor(a / b);

class Robot {
  constructor(position) {
    this.position = position; this.vie = R.VIE; this.energie = R.ENERGIE_DEPART;
    this.phase = "libre"; this.coup = null; this.reste = 0; this.pasEsquive = 0; this.dernierCoup = null; this.nouveauSonne = false;
  }
  actionVisible() { return PHASES_COUP.includes(this.phase) ? this.coup : VISIBLE[this.phase] || "rien"; }
}

export function etatPour(moi, autre, cote, tick) {
  const bord = cote === "a" ? moi.position : R.RING - moi.position;
  const bordAutre = cote === "a" ? R.RING - autre.position : autre.position;
  return {
    tick, temps: tick / R.TICKS_PAR_SECONDE, distance: Math.abs(autre.position - moi.position),
    moi: { vie: moi.vie, energie: moi.energie, bord_derriere: bord },
    adversaire: { vie: autre.vie, energie: autre.energie, bord_derriere: bordAutre, action: autre.actionVisible(),
      phase: autre.phase !== "attente" ? autre.phase : "libre",
      reste: ["preparation", "recuperation", "sonne"].includes(autre.phase) ? autre.reste : 0 },
    dernier_coup_adversaire: autre.dernierCoup,
  };
}

export const cout = (action) => (R.COUPS[action] ? R.COUPS[action].energie : action === "esquive" ? R.ESQUIVE.energie : 0);

function choisir(strategie, etat) {
  let action;
  // etat est construit neuf à chaque instant pour chaque robot : le modifier ne change rien au combat (pas besoin de copie)
  try { action = strategie(etat); } catch (e) { return [null, false, `exception:${e.name}: ${e.message}`.slice(0, 120)]; }
  if (typeof action !== "string") return [String(action).slice(0, 30), false, `pas_une_chaine:${typeof action}`];
  if (!R.ACTIONS.includes(action)) return [action.slice(0, 30), false, "action_inconnue"];
  if (cout(action) > etat.moi.energie) return [action, false, "energie_insuffisante"];
  return [action, true, ""];
}

function demarrer(robot, action) {
  if (R.COUPS[action]) {
    robot.energie -= R.COUPS[action].energie;
    robot.phase = "preparation"; robot.coup = action; robot.reste = R.COUPS[action].preparation; robot.dernierCoup = action;
  } else if (action === "esquive") {
    robot.energie -= R.ESQUIVE.energie;
    robot.phase = "esquive"; robot.coup = null; robot.reste = R.ESQUIVE.duree; robot.pasEsquive = 0;
  } else { robot.phase = { attendre: "attente", avancer: "avance", reculer: "recul", garde: "garde", garde_basse: "garde_basse" }[action]; robot.coup = null; }
}

function ecarter(a, b, priorite) {
  a.position = Math.max(0, Math.min(R.RING, a.position));
  b.position = Math.max(0, Math.min(R.RING, b.position));
  const manque = R.CONTACT - (b.position - a.position);
  if (manque > 0) {
    if (priorite === "a") b.position += manque;
    else if (priorite === "b") a.position -= manque;
    else { a.position -= div(manque, 2); b.position += manque - div(manque, 2); }
    if (a.position < 0) { b.position -= a.position; a.position = 0; }
    if (b.position > R.RING) { a.position -= b.position - R.RING; b.position = R.RING; }
  }
}

// Un combat qu'on fait avancer instant par instant : pour le jeu au clavier, la stratégie d'un côté peut être un joueur.
export function creerCombat(strategieA, strategieB, nomA = "A", nomB = "B", combatId = null) {
  const a = new Robot(R.DEPART_A), b = new Robot(R.DEPART_B);
  const c = { a, b, tick: 0, journal: [], vainqueur: null, fin: null, id: combatId || `${nomA}-vs-${nomB}` };
  c.instant = () => {
    if (c.vainqueur) return null;
    const tick = ++c.tick;
    const etats = { a: etatPour(a, b, "a", tick), b: etatPour(b, a, "b", tick) };
    const decisions = {};
    for (const [cote, robot, strategie] of [["a", a, strategieA], ["b", b, strategieB]]) {
      robot.nouveauSonne = false;
      if (["libre", "avance", "recul", "garde", "garde_basse", "attente"].includes(robot.phase)) {
        const [action, valide, raison] = choisir(strategie, etats[cote]);
        decisions[cote] = [action, valide, raison];
        if (valide) demarrer(robot, action); else { robot.phase = "attente"; robot.coup = null; }
      } else decisions[cote] = ["", true, ""];
      if (robot.phase === "esquive") robot.pasEsquive += 1;
    }
    for (const [robot, sens] of [[a, 1], [b, -1]]) {
      if (robot.phase === "avance") robot.position += sens * R.AVANCE;
      else if (robot.phase === "recul") robot.position -= sens * R.RECUL;
      else if (robot.phase === "esquive") robot.position -= sens * R.ESQUIVE.recul;
    }
    ecarter(a, b, null);
    const distance = b.position - a.position;
    const effets = { a: "", b: "" }, degats = { a: 0, b: 0 }, coups = [];
    for (const [cote, robot, cible] of [["a", a, b], ["b", b, a]]) {
      if (robot.phase !== "frappe") continue;
      const k = R.COUPS[robot.coup];
      if (distance > k.portee) effets[cote] = "rate";
      else if (cible.phase === "esquive" && cible.pasEsquive <= 3) effets[cote] = "esquive";
      else if ((R.BLOQUE_PAR[cible.phase] || []).includes(robot.coup)) {
        coups.push([cote, cible, div(k.degats, R.GARDE_DIVISE), R.GARDE_SONNE, 10]); effets[cote] = "bloque";
      } else {
        let d = k.degats;
        if (cible.phase === "preparation" || cible.phase === "recuperation") { d = div(d * R.CONTRE[0], R.CONTRE[1]); effets[cote] = "contre"; }
        else effets[cote] = "touche";
        coups.push([cote, cible, d, k.sonne, k.recul]);
      }
    }
    for (const [cote, cible, d, sonne, recul] of coups) {
      cible.vie = Math.max(0, cible.vie - d); degats[cote] = d;
      cible.phase = "sonne"; cible.coup = null; cible.reste = sonne; cible.nouveauSonne = true;
      cible.position += cible === a ? -recul : recul;
      ecarter(a, b, cible === a ? "b" : "a");
    }
    const vus = { a: [a.actionVisible(), a.phase], b: [b.actionVisible(), b.phase] };
    for (const robot of [a, b]) {
      if (robot.nouveauSonne) { /* sonné à cet instant : le compte commence au suivant */ }
      else if (robot.phase === "preparation") { robot.reste -= 1; if (robot.reste === 0) robot.phase = "frappe"; }
      else if (robot.phase === "frappe") { robot.phase = "recuperation"; robot.reste = R.COUPS[robot.coup].recuperation; }
      else if (["recuperation", "sonne", "esquive"].includes(robot.phase)) { robot.reste -= 1; if (robot.reste === 0) { robot.phase = "libre"; robot.coup = null; } }
      robot.energie = Math.min(R.ENERGIE_MAX, robot.energie + R.RECUPERATION_ENERGIE);
    }
    if (a.vie === 0 || b.vie === 0) { c.vainqueur = a.vie === 0 && b.vie === 0 ? "egalite" : b.vie === 0 ? "a" : "b"; c.fin = "ko"; }
    else if (tick === R.DUREE_MAX) { c.vainqueur = a.vie > b.vie ? "a" : b.vie > a.vie ? "b" : "egalite"; c.fin = "temps"; }
    const ligne = { combat_id: c.id, tick, robot_a: nomA, robot_b: nomB };
    for (const [cote, robot] of [["a", a], ["b", b]]) {
      const [action, valide, raison] = decisions[cote];
      Object.assign(ligne, { [`decision_${cote}`]: action || "", [`valide_${cote}`]: valide, [`raison_${cote}`]: raison,
        [`action_${cote}`]: vus[cote][0], [`phase_${cote}`]: vus[cote][1], [`position_${cote}`]: robot.position,
        [`vie_${cote}`]: robot.vie, [`energie_${cote}`]: robot.energie, [`effet_${cote}`]: effets[cote], [`degats_${cote}`]: degats[cote] });
    }
    Object.assign(ligne, { distance: b.position - a.position, vainqueur: c.vainqueur || "", fin: c.fin || "" });
    c.journal.push(ligne);
    return ligne;
  };
  return c;
}

export function combattre(strategieA, strategieB, nomA = "A", nomB = "B", combatId = null) {
  const c = creerCombat(strategieA, strategieB, nomA, nomB, combatId);
  while (c.instant()) { /* jusqu'au K.-O. ou à la fin du temps */ }
  return { vainqueur: c.vainqueur, fin: c.fin, journal: c.journal };
}
