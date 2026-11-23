// Le tournoi du championnat des robots, sur le poste du formateur : importe les robots (export CSV du
// formulaire Netlify « robot-championnat », fichiers .py, ou collage), lance le tournoi dans le navigateur (même moteur que
// VS Code), affiche le classement et le bilan par génération, rejoue chaque combat en 3D, exporte les journaux en CSV
// (analyse avec pandas au J4, réentraînement des robots 2 et 3 au J5).
import { PilotePython } from "../commun/python.js";
import * as progression from "../commun/progression.js";
import * as sons from "../commun/sons.js";
import { creerRing } from "./ring.js";
import { listeStyles, styleParDefaut, remplirChoix } from "./styles.js";

const CLE = "jeux-python.tournoi-robots.v1";
const $ = (id) => document.getElementById(id);
const creer = (balise, classe, texte) => { const e = document.createElement(balise); if (classe) e.className = classe; if (texte !== undefined) e.textContent = texte; return e; };
const NOM_GEN = { 1: "1 · règles à la main", 2: "2 · machine learning", 3: "3 · réseau de neurones", "entraînement": "entraînement" };

const memoire = (() => { try { return JSON.parse(localStorage.getItem(CLE)) || {}; } catch { return {}; } })();
memoire.robots = memoire.robots || [];
const sauver = () => { try { localStorage.setItem(CLE, JSON.stringify({ robots: memoire.robots, references: memoire.references, manche: memoire.manche })); } catch { /* plein ou privé */ } };
const etat = { resultat: null, regles: null, onglet: "classement", combat: -1, styles: [{ id: "simple", nom: "Simple" }] };
// le modèle 3D d'un robot : celui choisi à l'envoi, sinon un style tiré de son nom
const styleDe = (nom) => memoire.robots.find((r) => r.nom === nom)?.modele || styleParDefaut(nom, etat.styles);

const pilote = new PilotePython((nom) => {
  const e = $("etat-python");
  if (nom === "pret") { e.textContent = "Python est prêt"; e.className = "etat-python pret"; }
  if (nom === "echec") { e.textContent = "Python n'a pas pu se charger. Rechargez la page."; e.className = "etat-python echec"; }
});
const ring = creerRing($("vue"), { qualite: progression.reglage("qualite") === "basse" ? "basse" : "haute" });

// ---------- lecture d'un CSV (guillemets, retours à la ligne dans un champ, séparateur , ou ;) ----------
function lireCSV(texte) {
  const premiere = texte.split(/\r?\n/, 1)[0];
  const sep = (premiere.match(/;/g) || []).length > (premiere.match(/,/g) || []).length ? ";" : ",";
  const lignes = []; let ligne = [], champ = "", guillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (guillemets) {
      if (c === '"' && texte[i + 1] === '"') { champ += '"'; i++; }
      else if (c === '"') guillemets = false;
      else champ += c;
    } else if (c === '"') guillemets = true;
    else if (c === sep) { ligne.push(champ); champ = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && texte[i + 1] === "\n") i++;
      ligne.push(champ); champ = ""; if (ligne.some((x) => x !== "")) lignes.push(ligne); ligne = [];
    } else champ += c;
  }
  if (champ !== "" || ligne.length) { ligne.push(champ); lignes.push(ligne); }
  const entete = (lignes.shift() || []).map((x) => x.trim().toLowerCase());
  return lignes.map((l) => Object.fromEntries(entete.map((n, i) => [n, l[i] ?? ""])));
}

// ---------- la liste des robots ----------
const nomRobot = (binome, generation) => `${binome.trim()} · g${generation}`;
function ajouter(binome, generation, code, source, modele = "") {
  const nom = nomRobot(binome, generation);
  const i = memoire.robots.findIndex((r) => r.nom === nom);
  const robot = { nom, binome: binome.trim(), generation: String(generation), code, source, modele: modele || (i >= 0 ? memoire.robots[i].modele : "") };
  if (i >= 0) memoire.robots[i] = robot; else memoire.robots.push(robot);
}
function dessinerListe() {
  const z = $("liste-robots"); z.innerHTML = "";
  if (!memoire.robots.length) { z.append(creer("p", "vide", "Aucun robot : importez l'export du formulaire Netlify, des fichiers .py, ou collez un robot.")); return; }
  const ecartes = new Map((etat.resultat?.ecartes || []).map((e) => [e.nom, e]));
  for (const r of memoire.robots) {
    const e = ecartes.get(r.nom);
    const ligne = creer("div", "robot" + (e ? " ecarte" : ""));
    ligne.append(creer("span", "", e ? `${r.nom} : écarté, ${e.message}${e.ligne ? ` (ligne ${e.ligne})` : ""}` : r.nom));
    const sel = creer("select"); for (const g of ["1", "2", "3"]) { const o = creer("option", "", `génération ${g}`); o.value = g; sel.append(o); }
    sel.value = r.generation;
    sel.addEventListener("change", () => { const code = r.code; memoire.robots = memoire.robots.filter((x) => x !== r); ajouter(r.binome, sel.value, code, r.source, r.modele); sauver(); dessinerListe(); });
    const style = creer("select"); style.title = "Le modèle 3D de ce robot";
    remplirChoix(style, etat.styles, r.modele || styleParDefaut(r.nom, etat.styles));
    style.addEventListener("change", () => { r.modele = style.value; sauver(); });
    const x = creer("button", "", "×"); x.title = "Retirer ce robot"; x.addEventListener("click", () => { memoire.robots = memoire.robots.filter((y) => y !== r); sauver(); dessinerListe(); });
    ligne.append(sel, style, x); z.append(ligne);
  }
}

async function importerCSV(fichier) {
  const lignes = lireCSV(await fichier.text());
  const col = (l, ...noms) => { for (const n of noms) if (l[n] !== undefined) return l[n]; return undefined; };
  // si l'export a une date d'envoi, le dernier envoi d'un binôme pour une génération l'emporte
  const date = (l) => col(l, "created_at", "date", "submitted_at") || "";
  lignes.sort((a, b) => date(a).localeCompare(date(b)));
  let n = 0, ignores = 0;
  for (const l of lignes) {
    const binome = col(l, "binome", "binôme"), code = col(l, "code"), g = col(l, "generation", "génération") || "1";
    if (!binome || !code || !/def\s+strategie/.test(code)) { ignores++; continue; }
    ajouter(binome, ["1", "2", "3"].includes(g.trim()) ? g.trim() : "1", code, "netlify", (col(l, "modele", "modèle") || "").trim()); n++;
  }
  sauver(); dessinerListe();
  message(`${n} envoi(s) lu(s) dans ${fichier.name}${ignores ? `, ${ignores} ligne(s) sans binôme ou sans fonction strategie ignorée(s)` : ""}. Pour un même binôme et une même génération, le dernier envoi est gardé.`);
}
async function importerPy(fichiers) {
  for (const f of fichiers) {
    const code = await f.text(), base = f.name.replace(/\.py$/i, "");
    const m = base.match(/^(.*?)[_ -]g([123])$/i);
    const g = m ? m[2] : (/génération 3|generation 3|CERVEAU/.test(code) ? "3" : /génération 2|generation 2/.test(code) ? "2" : "1");
    ajouter(m ? m[1].replace(/_/g, " ") : base.replace(/_/g, " "), g, code, "fichier");
  }
  sauver(); dessinerListe();
  message(`${fichiers.length} fichier(s) ajouté(s). Vérifiez la génération de chacun dans la liste.`);
}
function message(texte) { const p = $("panneau"); p.innerHTML = ""; p.append(creer("p", "", texte)); }

// ---------- le tournoi ----------
async function lancer() {
  if (!memoire.robots.length && !$("case-references").checked) { message("Ajoutez au moins deux robots, ou cochez « Robots d'entraînement »."); return; }
  const b = $("bouton-tournoi"); b.disabled = true;
  const n = memoire.robots.length + ($("case-references").checked ? 5 : 0);
  message(`Tournoi en cours : ${n} robots, ${n * (n - 1)} combats…`);
  const debut = performance.now();
  try {
    const r = await pilote.combat("tournoi", [memoire.robots.map(({ nom, code, generation }) => ({ nom, code, generation })), $("case-references").checked], 180000);
    if (r.erreur) { message(`Le tournoi s'est arrêté : ${r.erreur.message}`); return; }
    etat.resultat = r; etat.duree = Math.round((performance.now() - debut) / 100) / 10;
    // les combats, regroupés par combat_id, pour le rejeu
    etat.journaux = new Map();
    for (const l of r.journal) { if (!etat.journaux.has(l.combat_id)) etat.journaux.set(l.combat_id, []); etat.journaux.get(l.combat_id).push(l); }
    remplirRencontres(); dessinerListe(); afficher("classement"); sons.jouer("victoire");
  } finally { b.disabled = false; }
}

function remplirRencontres() {
  const s = $("choix-rencontre"); s.innerHTML = ""; s.disabled = false;
  etat.resultat.rencontres.forEach((r, i) => {
    const issue = r.vainqueur === "egalite" ? "égalité" : `gagné par ${r.vainqueur === "a" ? r.a : r.b}`;
    const o = creer("option", "", `${i + 1}. ${r.a} contre ${r.b} : ${issue}${r.fin === "ko" ? " par K.-O." : ""} (${r.duree.toFixed(1)} s)`); o.value = String(i); s.append(o);
  });
  ["bouton-rejouer", "bouton-precedent", "bouton-suivant"].forEach((id) => { $(id).disabled = false; });
}
async function rejouer(i) {
  const r = etat.resultat?.rencontres[i]; if (!r) return;
  etat.combat = i; $("choix-rencontre").value = String(i);
  await ring.choisirRobots({ a: styleDe(r.a), b: styleDe(r.b) });
  await ring.rejouer(etat.journaux.get(r.combat_id), r.a, r.b);
}

function afficher(nom) {
  etat.onglet = nom;
  for (const o of document.querySelectorAll(".onglet")) o.setAttribute("aria-selected", String(o.dataset.onglet === nom));
  const p = $("panneau"); p.innerHTML = ""; const r = etat.resultat;
  if (!r) { p.append(creer("p", "vide", "Ajoutez les robots, puis « Lancer le tournoi ». Le calcul se fait dans ce navigateur, avec le même moteur que VS Code.")); return; }
  if (nom === "classement") {
    p.append(creer("p", "", `${r.classement.length} robots, ${r.rencontres.length} combats, calculés en ${etat.duree} s.${r.ecartes.length ? ` ${r.ecartes.length} robot(s) écarté(s) : voir la liste.` : ""}`));
    const t = creer("table", "tours"), tete = creer("tr");
    ["Rang", "Robot", "Génération", "Points", "V", "N", "D", "K.-O."].forEach((x) => tete.append(creer("th", "", x))); t.append(tete);
    r.classement.forEach((c, i) => {
      const tr = creer("tr");
      tr.append(creer("td", "", String(i + 1)), creer("td", "", c.nom), creer("td", "", NOM_GEN[c.generation] || c.generation), creer("td", "", String(c.points)),
        creer("td", "", String(c.v)), creer("td", "", String(c.n)), creer("td", "", String(c.d)), creer("td", "", String(c.ko)));
      tr.title = "Cliquez : rejouer son premier combat";
      tr.addEventListener("click", () => rejouer(r.rencontres.findIndex((x) => x.a === c.nom || x.b === c.nom)));
      t.append(tr);
    });
    p.append(t);
  } else if (nom === "generations") {
    const gen = Object.fromEntries(r.classement.map((c) => [c.nom, c.generation]));
    const gens = [...new Set(r.classement.map((c) => c.generation))].sort();
    const bilan = {};                       // bilan[x][y] : victoires, nuls, défaites de la génération x contre la génération y
    for (const g of gens) { bilan[g] = {}; for (const h of gens) bilan[g][h] = { v: 0, n: 0, d: 0 }; }
    for (const m of r.rencontres) {
      const ga = gen[m.a], gb = gen[m.b];
      if (ga === gb) continue;
      if (m.vainqueur === "egalite") { bilan[ga][gb].n++; bilan[gb][ga].n++; }
      else { const [g, pe] = m.vainqueur === "a" ? [ga, gb] : [gb, ga]; bilan[g][pe].v++; bilan[pe][g].d++; }
    }
    p.append(creer("p", "", "Chaque case : victoires, nuls et défaites des robots de la ligne contre ceux de la colonne. Les combats entre robots d'une même génération ne comptent pas ici."));
    const t = creer("table", "tours matrice"), tete = creer("tr"); tete.append(creer("th", "", ""));
    gens.forEach((g) => tete.append(creer("th", "", NOM_GEN[g] || g))); t.append(tete);
    for (const g of gens) {
      const tr = creer("tr"); tr.append(creer("th", "", NOM_GEN[g] || g));
      for (const h of gens) { const b = bilan[g][h]; tr.append(creer("td", g === h ? "vide" : b.v > b.d ? "gagne" : b.v < b.d ? "perdu" : "", g === h ? "·" : `${b.v} / ${b.n} / ${b.d}`)); }
      t.append(tr);
    }
    p.append(t);
    const moyennes = gens.map((g) => { const cs = r.classement.filter((c) => c.generation === g); return `${NOM_GEN[g] || g} : ${(cs.reduce((s, c) => s + c.points, 0) / cs.length).toFixed(1)} points en moyenne (${cs.length} robot(s))`; });
    const ul = creer("ul"); moyennes.forEach((m) => ul.append(creer("li", "", m))); p.append(ul);
  } else if (nom === "exports") {
    const champ = creer("label", "champ"); champ.append(creer("span", "", "Nom de la manche (début des noms de fichiers)"));
    const entree = creer("input"); entree.type = "text"; entree.value = memoire.manche || "manche1"; entree.addEventListener("input", () => { memoire.manche = entree.value.trim() || "manche1"; sauver(); });
    champ.append(entree); p.append(champ);
    const bj = creer("button", "bouton principal", `Journal des combats (${r.journal.length} instants)`);
    bj.addEventListener("click", () => telecharger(`${memoire.manche || "manche1"}_journal.csv`, Object.keys(r.journal[0] || {}), r.journal.map((l) => Object.values(l))));
    const bd = creer("button", "bouton", `Décisions des robots (${r.decisions.length} lignes)`);
    bd.addEventListener("click", () => telecharger(`${memoire.manche || "manche1"}_decisions.csv`, r.colonnesDecisions, r.decisions));
    const rangee = creer("div", "envoi"); rangee.append(bj, bd); p.append(rangee);
    p.append(creer("p", "vide", "Journal : une ligne par instant et par combat, mêmes colonnes que moteur.py (analyse avec pandas au J4). Décisions : une ligne par décision d'un robot, mêmes colonnes que decisions.csv (réentraîner le robot 2). Séparateur « ; », encodage UTF-8."));
  }
}

function telecharger(nom, colonnes, lignes) {
  const champ = (v) => { const s = v === null || v === undefined ? "" : String(v === true ? "True" : v === false ? "False" : v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const texte = [colonnes.join(";"), ...lignes.map((l) => l.map(champ).join(";"))].join("\n") + "\n";
  const a = creer("a"); a.href = URL.createObjectURL(new Blob([texte], { type: "text/csv;charset=utf-8" })); a.download = nom; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------- démarrage ----------
async function demarrer() {
  $("choix-affichage").value = progression.reglage("qualite") === "basse" ? "basse" : "haute";
  $("choix-affichage").addEventListener("change", (ev) => { progression.reglage("qualite", ev.target.value); location.reload(); });
  $("case-references").checked = memoire.references !== false;
  $("case-references").addEventListener("change", (ev) => { memoire.references = ev.target.checked; sauver(); });
  $("fichier-csv").addEventListener("change", (ev) => { if (ev.target.files[0]) importerCSV(ev.target.files[0]); ev.target.value = ""; });
  $("fichier-py").addEventListener("change", (ev) => { if (ev.target.files.length) importerPy([...ev.target.files]); ev.target.value = ""; });
  $("bouton-coller").addEventListener("click", () => { $("zone-coller").hidden = !$("zone-coller").hidden; });
  $("bouton-ajouter").addEventListener("click", () => {
    const nom = $("coller-nom").value.trim(), code = $("coller-code").value;
    if (!nom || !code.trim()) { message("Indiquez le nom du binôme et collez son code."); return; }
    ajouter(nom, $("coller-generation").value, code, "collage"); sauver(); dessinerListe();
    $("coller-nom").value = ""; $("coller-code").value = ""; $("zone-coller").hidden = true;
  });
  $("bouton-tournoi").addEventListener("click", lancer);
  $("bouton-rejouer").addEventListener("click", () => rejouer(Number($("choix-rencontre").value)));
  $("choix-rencontre").addEventListener("change", (ev) => rejouer(Number(ev.target.value)));
  $("bouton-precedent").addEventListener("click", () => rejouer(Math.max(0, etat.combat - 1)));
  $("bouton-suivant").addEventListener("click", () => rejouer(Math.min(etat.resultat.rencontres.length - 1, etat.combat + 1)));
  $("bouton-pause").addEventListener("click", (ev) => { const b = ev.currentTarget, oui = b.getAttribute("aria-pressed") !== "true"; b.setAttribute("aria-pressed", String(oui)); ring.pause(oui); });
  $("bouton-rapide").addEventListener("click", (ev) => { const b = ev.currentTarget, oui = b.getAttribute("aria-pressed") !== "true"; b.setAttribute("aria-pressed", String(oui)); ring.vitesse(oui ? 2 : 1); });
  for (const o of document.querySelectorAll(".onglet")) o.addEventListener("click", () => afficher(o.dataset.onglet));
  document.addEventListener("pointerdown", () => sons.reveiller(), { once: true });
  etat.styles = await listeStyles();
  dessinerListe(); afficher("classement");
  await pilote.pret;
  etat.regles = await pilote.combat("regles", []);
}
demarrer();
window.tournoi = { etat, memoire, ajouter, lancer, rejouer, lireCSV, dessinerListe };
