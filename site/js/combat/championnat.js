// Le championnat de la classe, sur le poste du formateur : inscription des étudiants (leurs robots 1, 2 et 3, le notebook
// du robot 2, le modèle 3D choisi, le robot qui concourt), tirage au sort, arbre à élimination directe, matchs lancés un
// par un et rejoués en 3D, jusqu'à la finale. Tout est gardé sur ce poste (localStorage) et se sauvegarde en .json.
//
// Règles du match : un seul combat ; le côté (A ou B) est tiré au sort ; égalité aux points : tirage au sort ;
// un robot dont le code plante pendant le combat (exception, boucle sans fin) perd par forfait ;
// un robot dont le code ne se charge pas perd par forfait. Le code des robots est figé au tirage : modifier une
// inscription ensuite ne change pas un match déjà joué ni à jouer.
import { PilotePython } from "../commun/python.js";
import * as progression from "../commun/progression.js";
import * as sons from "../commun/sons.js";
import { creerRing } from "./ring.js";
import { listeStyles, remplirChoix, styleParDefaut } from "./styles.js";

const CLE = "jeux-python.championnat-classe.v1";
const $ = (id) => document.getElementById(id);
const creer = (balise, classe, texte) => { const e = document.createElement(balise); if (classe) e.className = classe; if (texte !== undefined) e.textContent = texte; return e; };
const NOM_GEN = { 1: "Robot 1 · règles", 2: "Robot 2 · arbre", 3: "Robot 3 · réseau" };

const lire = () => { try { return JSON.parse(localStorage.getItem(CLE)) || {}; } catch { return {}; } };
const memoire = Object.assign({ etudiants: [], tableau: null }, lire());
const sauver = () => {
  try { localStorage.setItem(CLE, JSON.stringify({ etudiants: memoire.etudiants, tableau: memoire.tableau })); return true; }
  catch { $("info-match").textContent = "Sauvegarde impossible sur ce poste (mémoire pleine ?) : pensez à « Sauvegarder (.json) »."; return false; }
};
const etat = { styles: [{ id: "simple", nom: "Simple" }], enCours: false, vue: "arbre", verifs: {} };

const pilote = new PilotePython((nom) => {
  const e = $("etat-python");
  if (nom === "pret") { e.textContent = "Python est prêt"; e.className = "etat-python pret"; majBoutons(); }
  if (nom === "echec") { e.textContent = "Python n'a pas pu se charger. Rechargez la page."; e.className = "etat-python echec"; }
});
const ring = creerRing($("vue"), { qualite: progression.reglage("qualite") === "basse" ? "basse" : "haute" });

// un tirage au sort honnête (générateur du navigateur)
const hasard = () => { const t = new Uint32Array(1); crypto.getRandomValues(t); return t[0] / 2 ** 32; };
const melanger = (liste) => { const l = [...liste]; for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(hasard() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; } return l; };
const ident = () => Math.random().toString(36).slice(2, 10);

// ---------- les inscriptions ----------
function etudiant(nom) {
  const n = nom.trim().replace(/\s+/g, " ");
  let e = memoire.etudiants.find((x) => x.nom.toLowerCase() === n.toLowerCase());
  if (!e) { e = { id: ident(), nom: n, style: styleParDefaut(n, etat.styles), engage: "1", robots: {} }; memoire.etudiants.push(e); }
  return e;
}
const robotEngage = (e) => e.robots[e.engage];
const pret = (e) => !!(robotEngage(e) && robotEngage(e).code && robotEngage(e).code.includes("def strategie"));

// un notebook garde ses cellules, sans les sorties (images, tableaux) : plus léger, et on peut le relancer
function nettoyerNotebook(texte) {
  try {
    const nb = JSON.parse(texte);
    for (const c of nb.cells || []) { if (c.cell_type === "code") { c.outputs = []; c.execution_count = null; } }
    return JSON.stringify(nb);
  } catch { return null; }
}

async function deposer(e, generation, fichier) {
  const texte = await fichier.text();
  if (fichier.name.toLowerCase().endsWith(".ipynb")) {
    const nb = nettoyerNotebook(texte);
    if (!nb) { alerte(`${fichier.name} : ce n'est pas un notebook lisible.`); return; }
    e.robots[generation] = Object.assign(e.robots[generation] || {}, { notebook: { nom: fichier.name, contenu: nb } });
  } else {
    e.robots[generation] = Object.assign(e.robots[generation] || {}, { code: texte, fichier: fichier.name, date: new Date().toISOString() });
    delete etat.verifs[e.id + generation];
  }
  sauver(); dessinerListe();
}

const alerte = (texte) => { $("info-match").textContent = texte; };

function telecharger(nom, contenu, type = "text/plain") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([contenu], { type })); a.download = nom; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function dessinerListe() {
  const z = $("liste-etudiants"); z.innerHTML = "";
  const fige = !!memoire.tableau;
  for (const e of memoire.etudiants) {
    const carte = creer("article", "etudiant" + (pret(e) ? "" : " incomplet"));
    const tete = creer("div", "tete-etudiant");
    const nom = creer("strong", "", e.nom);
    const style = creer("select"); style.title = "Le modèle 3D de son robot"; style.setAttribute("aria-label", `Modèle 3D de ${e.nom}`);
    remplirChoix(style, etat.styles, e.style);
    style.addEventListener("change", () => { e.style = style.value; sauver(); });
    const engage = creer("select"); engage.title = "Le robot qui concourt"; engage.setAttribute("aria-label", `Robot engagé par ${e.nom}`);
    for (const g of ["1", "2", "3"]) { const o = creer("option", "", `concourt : robot ${g}`); o.value = g; engage.append(o); }
    engage.value = e.engage;
    engage.addEventListener("change", () => { e.engage = engage.value; sauver(); dessinerListe(); });
    const retirer = creer("button", "retirer", "×"); retirer.type = "button"; retirer.title = `Retirer ${e.nom}`; retirer.disabled = fige;
    retirer.addEventListener("click", () => { if (confirm(`Retirer ${e.nom} et ses robots ?`)) { memoire.etudiants = memoire.etudiants.filter((x) => x !== e); sauver(); dessinerListe(); } });
    tete.append(nom, style, engage, retirer);
    carte.append(tete);

    const robots = creer("div", "robots-etudiant");
    for (const g of ["1", "2", "3"]) {
      const r = e.robots[g] || {};
      const ligne = creer("div", "emplacement" + (e.engage === g ? " engage" : ""));
      ligne.append(creer("span", "gen", NOM_GEN[g]));
      const info = creer("span", "fichier", r.code ? `${r.fichier || "code collé"} · ${r.code.split("\n").length} lignes` : "aucun fichier");
      if (r.notebook) info.textContent += ` · ${r.notebook.nom}`;
      const v = etat.verifs[e.id + g];
      if (v) info.append(creer("span", "verif " + (v.ok ? "ok" : "ko"), v.texte));
      const depot = creer("label", "petit-bouton", g === "2" ? ".py / .ipynb" : ".py");
      const champ = document.createElement("input"); champ.type = "file"; champ.hidden = true; champ.multiple = g === "2";
      champ.accept = g === "2" ? ".py,.ipynb" : ".py";
      champ.addEventListener("change", async () => { for (const f of champ.files) await deposer(e, g, f); });
      depot.append(champ);
      const coller = creer("button", "petit-bouton", "Coller"); coller.type = "button";
      coller.addEventListener("click", () => {
        const code = prompt(`Code du robot ${g} de ${e.nom} (tout le fichier) :`, r.code || "");
        if (code !== null) { e.robots[g] = Object.assign(e.robots[g] || {}, { code, fichier: "code collé", date: new Date().toISOString() }); delete etat.verifs[e.id + g]; sauver(); dessinerListe(); }
      });
      ligne.append(info, depot, coller);
      if (r.code) {
        const tel = creer("button", "petit-bouton", "↓"); tel.type = "button"; tel.title = "Télécharger ce fichier";
        tel.addEventListener("click", () => { telecharger(r.fichier && r.fichier.endsWith(".py") ? r.fichier : `robot${g}_${e.nom.replace(/\W+/g, "_")}.py`, r.code); if (r.notebook) telecharger(r.notebook.nom, r.notebook.contenu, "application/json"); });
        ligne.append(tel);
      }
      robots.append(ligne);
    }
    carte.append(robots);
    z.append(carte);
  }
  if (!memoire.etudiants.length) z.append(creer("p", "vide", "Aucun inscrit. Ajoutez les étudiants un par un, ou importez les envois du formulaire « robot-championnat » (le champ binôme = le nom de l'étudiant)."));
  const prets = memoire.etudiants.filter(pret).length;
  $("compte-inscrits").textContent = `${memoire.etudiants.length} inscrit(s), ${prets} prêt(s) à concourir`;
  majBoutons();
}

// ---------- vérifier un robot : il combat les six robots d'entraînement ----------
async function verifier(e, g = e.engage) {
  const r = e.robots[g];
  if (!r || !r.code) return;
  const b = await pilote.combat("bilan", [{ nom: e.nom, code: r.code }], 30000);
  etat.verifs[e.id + g] = b.erreur ? { ok: false, texte: ` · erreur${b.erreur.ligne ? " ligne " + b.erreur.ligne : ""} : ${b.erreur.message}` }
    : { ok: true, texte: ` · ${b.victoires}/${b.combats} victoires`, titre: "contre les six robots d'entraînement" };
}

// ---------- le tirage au sort et l'arbre ----------
const NOMS_TOURS = (n) => (n === 1 ? "Finale" : n === 2 ? "Demi-finales" : n === 4 ? "Quarts de finale" : n === 8 ? "Huitièmes de finale" : n === 16 ? "Seizièmes de finale" : `Tour à ${2 * n}`);

async function tirer() {
  const inscrits = memoire.etudiants.filter(pret);
  if (inscrits.length < 2) { alerte("Il faut au moins deux étudiants avec un robot engagé."); return; }
  const ordre = melanger(inscrits);
  let taille = 1; while (taille < ordre.length) taille *= 2;
  const nbMatchs = taille / 2, exempts = taille - ordre.length;
  // les exemptés (qualifiés d'office au premier tour) sont répartis dans l'arbre : un match sur deux
  const places = [...Array(nbMatchs).keys()].filter((i) => i % 2 === 0).concat([...Array(nbMatchs).keys()].filter((i) => i % 2 === 1)).slice(0, exempts);
  const participants = {};
  for (const e of ordre) participants[e.id] = { nom: e.nom, style: e.style, generation: e.engage, code: robotEngage(e).code };
  const tours = [];
  let file = ordre.map((e) => e.id);
  const premier = [];
  for (let i = 0; i < nbMatchs; i++) {
    if (places.includes(i)) premier.push({ a: file.shift(), b: null, vainqueur: null, exempt: true });
    else premier.push({ a: file.shift(), b: file.shift(), vainqueur: null });
  }
  for (const m of premier) if (m.exempt) m.vainqueur = m.a;
  tours.push(premier);
  for (let n = nbMatchs / 2; n >= 1; n /= 2) tours.push(Array.from({ length: n }, () => ({ a: null, b: null, vainqueur: null })));
  memoire.tableau = { date: new Date().toISOString(), participants, ordre: ordre.map((e) => e.id), tours, champion: null };
  propager(); sauver();
  montrer("arbre");
  // le tirage se dévoile nom par nom
  etat.devoile = 0;
  for (let i = 1; i <= ordre.length; i++) { etat.devoile = i; dessinerArbre(); sons.jouer?.("clic"); await new Promise((ok) => setTimeout(ok, 220)); }
  etat.devoile = null; dessinerArbre(); dessinerListe();
  alerte(`Tirage fait : ${ordre.length} participants${exempts ? `, ${exempts} qualifié(s) d'office au premier tour` : ""}.`);
}

// les gagnants montent au tour suivant
function propager() {
  const t = memoire.tableau.tours;
  for (let r = 1; r < t.length; r++) {
    t[r].forEach((m, k) => {
      const a = t[r - 1][2 * k].vainqueur, b = t[r - 1][2 * k + 1].vainqueur;
      if (m.a !== a || m.b !== b) { m.a = a; m.b = b; if (!m.joue) m.vainqueur = null; }
    });
  }
  const finale = t[t.length - 1][0];
  memoire.tableau.champion = finale.vainqueur || null;
}

function prochainMatch() {
  if (!memoire.tableau) return null;
  for (const [r, tour] of memoire.tableau.tours.entries())
    for (const [k, m] of tour.entries()) if (!m.vainqueur && m.a && m.b) return { r, k, m };
  return null;
}

function dessinerArbre() {
  const z = $("arbre"); z.innerHTML = "";
  const T = memoire.tableau;
  if (!T) {
    z.append(creer("div", "arbre-vide", "Inscrivez les étudiants, vérifiez leurs robots, puis « Tirer au sort ». L'arbre du championnat apparaîtra ici."));
    return;
  }
  const visible = (id) => etat.devoile == null || T.ordre.indexOf(id) < etat.devoile;
  const prochain = prochainMatch();
  const grille = creer("div", "arbre-grille"); grille.style.setProperty("--tours", T.tours.length + 1);
  T.tours.forEach((tour, r) => {
    const col = creer("div", "tour");
    col.append(creer("h2", "", NOMS_TOURS(tour.length)));
    const matchs = creer("div", "matchs");
    tour.forEach((m, k) => {
      const carte = creer("div", "match" + (m.exempt ? " exempt" : "") + (prochain && prochain.r === r && prochain.k === k ? " prochain" : "") + (m.vainqueur && !m.exempt ? " joue" : ""));
      for (const c of ["a", "b"]) {
        const id = m[c], p = id && T.participants[id];
        const ligne = creer("div", "joueur" + (m.vainqueur && id === m.vainqueur ? " gagne" : m.vainqueur && id ? " perd" : ""));
        if (p && visible(id)) {
          ligne.append(creer("span", "nom", p.nom), creer("span", "gen", `g${p.generation}`));
          if (m.vie && m.vie[id] != null) ligne.append(creer("span", "score", String(m.vie[id])));
        } else ligne.append(creer("span", "nom attente", m.exempt && c === "b" ? "qualifié d'office" : r === 0 && etat.devoile != null ? "…" : "—"));
        carte.append(ligne);
      }
      if (m.detail) carte.append(creer("div", "detail", m.detail));
      if (m.a && m.b && !m.exempt) {
        const b = creer("button", "petit-bouton", m.vainqueur ? "Revoir" : "Lancer"); b.type = "button";
        b.disabled = etat.enCours || (!m.vainqueur && !(prochain && prochain.r === r && prochain.k === k)) || !pilotePret();
        b.addEventListener("click", () => jouerMatch(r, k));
        carte.append(b);
      }
      matchs.append(carte);
    });
    col.append(matchs); grille.append(col);
  });
  const fin = creer("div", "tour champion-col");
  fin.append(creer("h2", "", "Champion"));
  const champ = creer("div", "champion" + (T.champion ? " sacre" : ""));
  champ.append(creer("span", "coupe", "★"), creer("span", "nom", T.champion ? T.participants[T.champion].nom : "?"));
  if (T.champion) champ.append(creer("span", "gen", `avec son robot ${T.participants[T.champion].generation}`));
  fin.append(champ); grille.append(fin);
  z.append(grille);
}

const pilotePret = () => $("etat-python").classList.contains("pret");

// ---------- un match : calculé dans le moteur Python, puis rejoué en 3D ----------
async function jouerMatch(r, k) {
  const T = memoire.tableau, m = T.tours[r][k];
  if (etat.enCours || !m.a || !m.b) return;
  etat.enCours = true; majBoutons(); dessinerArbre();
  try { await deroulerMatch(T, r, k, m); }
  catch (e) { console.error(e); alerte(`Le match n'a pas pu se dérouler : ${e.message}. Relancez-le.`); }
  finally { etat.enCours = false; montrer("arbre"); majBoutons(); dessinerArbre(); }
}

async function deroulerMatch(T, r, k, m) {
  const revoir = !!m.vainqueur;
  if (!m.cote) m.cote = hasard() < 0.5 ? "ab" : "ba";            // qui est en A : tiré au sort une fois
  const [idA, idB] = m.cote === "ab" ? [m.a, m.b] : [m.b, m.a];
  const pA = T.participants[idA], pB = T.participants[idB];
  alerte(`${NOMS_TOURS(T.tours[r].length)} : ${pA.nom} contre ${pB.nom}…`);
  const res = await pilote.combat("combat", [{ nom: pA.nom, code: pA.code }, { nom: pB.nom, code: pB.code }], 30000);
  montrer("ring");
  await ring.choisirRobots({ a: pA.style, b: pB.style });
  if (res.erreur) {
    // un robot dont le code ne se charge pas perd par forfait (les deux : tirage au sort)
    const fautif = res.erreur.robot === "a" ? idA : idB;
    if (!revoir) { m.vainqueur = fautif === idA ? idB : idA; m.detail = `forfait de ${T.participants[fautif].nom} : ${res.erreur.message}`; }
    ring.reinitialiser(pA.nom, pB.nom); ring.annonce("FORFAIT", 2.5);
  } else {
    const fini = await ring.rejouer(res.journal, pA.nom, pB.nom);
    if (!revoir) {
      const v = res.vainqueur === "a" ? idA : res.vainqueur === "b" ? idB : null;
      const der = res.journal[res.journal.length - 1];
      m.vie = { [idA]: der.vie_a, [idB]: der.vie_b };
      // un code qui plante pendant le combat (exception, boucle sans fin) perd par forfait, même s'il n'a pas perdu au combat
      const plantes = (c) => (res.refus?.[c] || []).filter((x) => String(x.raison).startsWith("exception:"));
      const pa = plantes("a"), pb = plantes("b");
      if (pa.length !== pb.length) {
        const fautif = pa.length > pb.length ? idA : idB, ex = (pa.length > pb.length ? pa : pb)[0];
        m.vainqueur = fautif === idA ? idB : idA;
        m.detail = `forfait de ${T.participants[fautif].nom} : son code plante (${String(ex.raison).slice(10, 70)})`;
      } else if (v) { m.vainqueur = v; m.detail = res.fin === "ko" ? "par K.-O." : "aux points"; }
      else { m.vainqueur = hasard() < 0.5 ? idA : idB; m.detail = `égalité (${der.vie_a} - ${der.vie_b}), tirage au sort`; }
      m.joue = true;
    }
    if (fini) await new Promise((ok) => setTimeout(ok, 2200));
  }
  if (!revoir) {
    propager(); sauver();
    if (T.champion) {
      ring.annonce(`CHAMPION : ${T.participants[T.champion].nom.toUpperCase()}`, 5, "victoire"); sons.jouer?.("victoire");
      await new Promise((ok) => setTimeout(ok, 3500));
    }
  }
  const p = prochainMatch();
  alerte(T.champion ? `Champion de la classe : ${T.participants[T.champion].nom}.` : p ? `Prochain match : ${T.participants[p.m.a].nom} contre ${T.participants[p.m.b].nom}.` : "");
}

// ---------- vues, boutons, imports ----------
function montrer(vue) {
  etat.vue = vue;
  $("vue").hidden = vue !== "ring"; $("arbre").hidden = vue !== "arbre";
  $("voir-ring").setAttribute("aria-pressed", String(vue === "ring")); $("voir-arbre").setAttribute("aria-pressed", String(vue === "arbre"));
  if (vue === "ring") window.dispatchEvent(new Event("resize"));
}

function majBoutons() {
  const fige = !!memoire.tableau;
  $("bouton-tirage").disabled = fige || memoire.etudiants.filter(pret).length < 2;
  $("bouton-annuler").hidden = !fige;
  $("bouton-prochain").disabled = !prochainMatch() || etat.enCours || !pilotePret();
  $("bouton-verifier").disabled = !pilotePret() || etat.enCours;
}

function lireCSV(texte) {
  const premiere = texte.split(/\r?\n/, 1)[0];
  const sep = (premiere.match(/;/g) || []).length > (premiere.match(/,/g) || []).length ? ";" : ",";
  const lignes = []; let ligne = [], champ = "", guillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (guillemets) { if (c === '"' && texte[i + 1] === '"') { champ += '"'; i++; } else if (c === '"') guillemets = false; else champ += c; }
    else if (c === '"') guillemets = true;
    else if (c === sep) { ligne.push(champ); champ = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && texte[i + 1] === "\n") i++; ligne.push(champ); champ = ""; if (ligne.some((x) => x !== "")) lignes.push(ligne); ligne = []; }
    else champ += c;
  }
  if (champ !== "" || ligne.length) { ligne.push(champ); lignes.push(ligne); }
  const entete = (lignes.shift() || []).map((x) => x.trim().toLowerCase());
  return lignes.map((l) => Object.fromEntries(entete.map((n, i) => [n, l[i] ?? ""])));
}

async function demarrer() {
  etat.styles = await listeStyles();
  $("choix-affichage").value = progression.reglage("qualite") === "basse" ? "basse" : "haute";
  $("choix-affichage").addEventListener("change", (ev) => { progression.reglage("qualite", ev.target.value); location.reload(); });
  $("voir-arbre").addEventListener("click", () => montrer("arbre"));
  $("voir-ring").addEventListener("click", () => montrer("ring"));
  $("bouton-pause").addEventListener("click", (ev) => { const b = ev.currentTarget, oui = b.getAttribute("aria-pressed") !== "true"; b.setAttribute("aria-pressed", String(oui)); ring.pause(oui); });
  $("bouton-rapide").addEventListener("click", (ev) => { const b = ev.currentTarget, oui = b.getAttribute("aria-pressed") !== "true"; b.setAttribute("aria-pressed", String(oui)); ring.vitesse(oui ? 2 : 1); });
  $("form-etudiant").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const n = $("nom-etudiant").value.trim(); if (!n) return;
    etudiant(n); $("nom-etudiant").value = ""; sauver(); dessinerListe(); $("nom-etudiant").focus();
  });
  $("fichier-csv").addEventListener("change", async (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    const lignes = lireCSV(await f.text()); let n = 0;
    const col = (l, ...noms) => { for (const k of noms) if (l[k] !== undefined) return l[k]; return ""; };
    for (const l of lignes) {
      const nom = col(l, "binome", "binôme", "nom").trim(), code = col(l, "code"), g = col(l, "generation", "génération").trim();
      if (!nom || !code.includes("def strategie") || !["1", "2", "3"].includes(g)) continue;
      const e = etudiant(nom);
      e.robots[g] = { code, fichier: "envoi Netlify", date: col(l, "created_at", "date") || new Date().toISOString() };
      const modele = col(l, "modele", "modèle").trim(); if (modele) e.style = modele;
      if (!robotEngage(e)) e.engage = g;
      n++;
    }
    sauver(); dessinerListe(); alerte(`${n} robot(s) importé(s) depuis ${f.name}.`); ev.target.value = "";
  });
  $("bouton-exporter").addEventListener("click", () => telecharger(`championnat-classe-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ version: 1, etudiants: memoire.etudiants, tableau: memoire.tableau }, null, 1), "application/json"));
  $("fichier-json").addEventListener("change", async (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!Array.isArray(d.etudiants)) throw new Error("pas de liste d'étudiants");
      if (!confirm(`Remplacer les inscriptions de ce poste par celles de ${f.name} ?`)) return;
      memoire.etudiants = d.etudiants; memoire.tableau = d.tableau || null; sauver(); dessinerListe(); dessinerArbre(); alerte(`Repris depuis ${f.name}.`);
    } catch (e) { alerte(`${f.name} : fichier illisible (${e.message}).`); }
    ev.target.value = "";
  });
  $("bouton-verifier").addEventListener("click", async () => {
    etat.enCours = true; majBoutons();
    let i = 0;
    for (const e of memoire.etudiants) {
      i++; alerte(`Vérification ${i}/${memoire.etudiants.length} : ${e.nom}…`);
      for (const g of ["1", "2", "3"]) if (e.robots[g]?.code) await verifier(e, g);
      dessinerListe();
    }
    etat.enCours = false; majBoutons(); alerte("Vérification terminée : un robot en erreur perdra ses matchs par forfait.");
  });
  $("bouton-tirage").addEventListener("click", tirer);
  $("bouton-annuler").addEventListener("click", () => {
    if (!confirm("Effacer l'arbre et tous les résultats, puis refaire un tirage ?")) return;
    memoire.tableau = null; sauver(); dessinerListe(); dessinerArbre(); alerte("Tableau effacé : les inscriptions sont gardées.");
  });
  $("bouton-prochain").addEventListener("click", () => { const p = prochainMatch(); if (p) jouerMatch(p.r, p.k); });
  document.addEventListener("pointerdown", () => sons.reveiller?.(), { once: true });
  dessinerListe(); dessinerArbre(); montrer("arbre");
  const p = prochainMatch(), T = memoire.tableau;
  if (T) alerte(T.champion ? `Champion de la classe : ${T.participants[T.champion].nom}.` : p ? `Prochain match : ${T.participants[p.m.a].nom} contre ${T.participants[p.m.b].nom}.` : "");
  await pilote.pret; majBoutons(); dessinerArbre();
}

window.championnatClasse = { memoire, etat, ring, pilote, tirer, jouerMatch, prochainMatch, etudiant, sauver, dessinerListe };
demarrer();
