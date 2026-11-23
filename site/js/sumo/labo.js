// Le labo des neurones, mode Sumo (J5, robot 3) : les couches se règlent à la souris, le réseau s'entraîne sous les yeux
// (il se redessine à chaque époque, la courbe d'erreur descend), puis le robot est essayé contre les robots d'entraînement
// (moteur Python du jeu) et son cerveau exporté pour la stratégie de génération 3.
// Mode Ventes (J5 matin, à côté du notebook MLPRegressor) : le même réseau prévoit les fûts vendus par semaine à partir de
// l'indice de la semaine et de la colonne fetes (données du self study, même découpage que train_test_split(random_state=27)) ;
// on compare son erreur à celle de la droite (régression linéaire) et sa prévision des fêtes de décembre.
import { PilotePython } from "../commun/python.js";
import { creerReseau, epoque, exactitude, erreurMoyenne, exporterCerveau, preparer, predire, predireNombre } from "./reseau.js";
const MODELES = {};                                  // l'ancien mode sumo (retiré) : plus de modèles à charger

const $ = (id) => document.getElementById(id);
const creer = (balise, classe, texte) => { const e = document.createElement(balise); if (classe) e.className = classe; if (texte !== undefined) e.textContent = texte; return e; };
const MAX_COUCHES = 4, MAX_NEURONES = 16;
const NOMS_ENTREES = ["distance", "énergie (moi)", "énergie (adversaire)", "bord derrière moi", "bord derrière lui", "il a poussé"];

// modes : combat (par défaut, robot 3 du championnat : js/combat/labo-combat.js), ventes, sumo (l'ancien jeu, plus proposé)
const MODE = (() => { const m = new URLSearchParams(location.search).get("mode"); return m === "ventes" ? m : "combat"; })();
const VENTES = MODE === "ventes";
// Python seulement pour l'ancien mode Sumo (essai du robot contre les robots d'entraînement)
const pilote = MODE !== "sumo" ? null : new PilotePython((nom) => {
  const e = $("etat-python");
  if (nom === "pret") { e.textContent = "Python est prêt"; e.className = "etat-python pret"; }
  if (nom === "echec") { e.textContent = "Python n'a pas pu se charger. Rechargez la page."; e.className = "etat-python echec"; }
});
const etat = { cachees: VENTES ? [8] : [8, 6], reseau: null, ventes: null, donnees: null, actions: [], lignes: [], courbe: [], enCours: false, pause: false, onglet: "essai", essai: null };


function nouveauReseau() {
  etat.reseau = VENTES ? creerReseau([2, ...etat.cachees, 1], 2026, "nombre") : creerReseau([6, ...etat.cachees, etat.actions.length || 5]);
  etat.courbe = []; etat.essai = null;
  dessinerReseau(); dessinerCourbe(); chiffres(); afficher(etat.onglet);
}

// ---------- le dessin du réseau ----------
let zonesCouches = [];
function dessinerReseau() {
  const c = $("dessin-reseau"), ctx = c.getContext("2d"), r = window.devicePixelRatio || 1;
  const l = c.clientWidth, h = c.clientHeight; c.width = l * r; c.height = h * r; ctx.setTransform(r, 0, 0, r, 0, 0);
  ctx.fillStyle = "#131419"; ctx.fillRect(0, 0, l, h);
  const tailles = VENTES ? [2, ...etat.cachees, 1] : [6, ...etat.cachees, etat.actions.length || 5], n = tailles.length;
  const entrees = VENTES ? ["semaine (indice)", "fêtes (0 ou 1)"] : NOMS_ENTREES, sorties = VENTES ? ["fûts"] : etat.actions.length ? etat.actions : ["", "", "", "", ""];
  const x = (k) => 120 + (k * (l - 260)) / (n - 1);
  const y = (k, i) => { const t = tailles[k], esp = Math.min(46, (h - 80) / Math.max(1, t)); return h / 2 - ((t - 1) * esp) / 2 + i * esp; };
  // les poids
  const couches = etat.reseau ? etat.reseau.couches : [];
  const maxi = Math.max(0.001, ...couches.flatMap((cc) => cc.flatMap((ne) => ne.poids.map(Math.abs))));
  couches.forEach((couche, k) => couche.forEach((ne, j) => ne.poids.forEach((p, i) => {
    ctx.strokeStyle = p >= 0 ? `rgba(242,140,30,${0.15 + 0.85 * Math.abs(p) / maxi})` : `rgba(80,160,255,${0.15 + 0.85 * Math.abs(p) / maxi})`;
    ctx.lineWidth = 0.4 + 4 * Math.abs(p) / maxi;
    ctx.beginPath(); ctx.moveTo(x(k), y(k, i)); ctx.lineTo(x(k + 1), y(k + 1, j)); ctx.stroke();
  })));
  // les neurones
  zonesCouches = [];
  tailles.forEach((t, k) => {
    for (let i = 0; i < t; i++) {
      ctx.beginPath(); ctx.arc(x(k), y(k, i), 11, 0, Math.PI * 2);
      ctx.fillStyle = k === 0 ? "#2e2a4a" : k === n - 1 ? "#1f4d36" : "#3a3d48"; ctx.fill();
      ctx.strokeStyle = "#e8e3d6"; ctx.lineWidth = 1.5; ctx.stroke();
    }
    ctx.fillStyle = "#cfd3dc"; ctx.font = "13px Barlow, sans-serif"; ctx.textAlign = k === 0 ? "right" : k === n - 1 ? "left" : "center";
    if (k === 0) entrees.forEach((nom, i) => ctx.fillText(nom, x(k) - 18, y(k, i) + 4));
    else if (k === n - 1) sorties.forEach((a, i) => ctx.fillText(a, x(k) + 18, y(k, i) + 4));
    else {
      ctx.fillText(`${t} neurone${t > 1 ? "s" : ""}`, x(k), 46);
      zonesCouches.push({ k: k - 1, x1: x(k) - 30, x2: x(k) + 30 });
    }
  });
  ctx.textAlign = "center"; ctx.fillStyle = "#f5b82e"; ctx.fillText("entrées", x(0), h - 14); ctx.fillText(VENTES ? "sortie" : "actions", x(n - 1), h - 14);
}

// ---------- la courbe et les chiffres ----------
function dessinerCourbe() {
  const c = $("courbe"), ctx = c.getContext("2d"), r = window.devicePixelRatio || 1;
  const l = c.clientWidth, h = c.clientHeight; c.width = l * r; c.height = h * r; ctx.setTransform(r, 0, 0, r, 0, 0);
  ctx.clearRect(0, 0, l, h);
  ctx.strokeStyle = "#dad6e8"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(36, 8); ctx.lineTo(36, h - 22); ctx.lineTo(l - 6, h - 22); ctx.stroke();
  ctx.fillStyle = "#3a3a48"; ctx.font = "12px Barlow, sans-serif"; ctx.fillText("erreur", 2, 14); ctx.fillText("époques", l - 52, h - 6);
  const pts = etat.courbe; if (pts.length < 2) return;
  const maxi = Math.max(...pts.map((p) => Math.max(p.ent, p.test))), mini = 0;
  const X = (i) => 36 + (i * (l - 46)) / (pts.length - 1), Y = (v) => (h - 22) - ((v - mini) / (maxi - mini || 1)) * (h - 34);
  for (const [cle, couleur] of [["ent", "#17824C"], ["test", "#c27a3e"]]) {
    ctx.strokeStyle = couleur; ctx.lineWidth = 2; ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(X(i), Y(p[cle])) : ctx.moveTo(X(i), Y(p[cle])))); ctx.stroke();
  }
  ctx.fillStyle = "#17824C"; ctx.fillText("entraînement", 44, 14); ctx.fillStyle = "#c27a3e"; ctx.fillText("test", 130, 14);
}
function chiffres() {
  const z = $("chiffres"); z.innerHTML = "";
  if (!etat.donnees) { z.textContent = "Chargement des données…"; return; }
  const der = etat.courbe.at(-1);
  const params = etat.reseau.couches.reduce((s, c) => s + c.length * (c[0].poids.length + 1), 0);
  z.append(creer("div", "", `Réseau : ${VENTES ? 2 : 6} → ${etat.cachees.join(" → ") || "aucune couche cachée"} → ${VENTES ? 1 : etat.actions.length}`),
    creer("div", "", `${params} poids et biais`), creer("div", "", `${etat.courbe.length} époque(s)`));
  if (der && VENTES) {
    const b = creer("div"); b.append(document.createTextNode("Erreur moyenne sur le test : "), creer("strong", "", `${der.exact.toFixed(1).replace(".", ",")} fûts`), document.createTextNode(` (droite : ${etat.ventes.droite.mae.toFixed(1).replace(".", ",")})`)); z.append(b);
  } else if (der) {
    const b = creer("div"); b.append(creer("strong", "", `${Math.round(der.exact * 100)} %`), document.createTextNode(" de bonnes réponses sur les données de test")); z.append(b);
  }
}

// ---------- l'entraînement : quelques époques par image, la page reste fluide ----------
async function entrainer() {
  if (etat.enCours || !etat.donnees) return;
  etat.enCours = true; etat.pause = false;
  $("bouton-entrainer").disabled = true; $("bouton-pause").disabled = false;
  const total = Number($("choix-epoques").value), taux = Number($("choix-taux").value);
  try {
    for (let e = 0; e < total; e++) {
      while (etat.pause) await new Promise((ok) => setTimeout(ok, 100));
      const ent = epoque(etat.reseau, etat.donnees.entrainement, { taux });
      etat.courbe.push({ ent, test: erreurMoyenne(etat.reseau, etat.donnees.test), exact: VENTES ? maeVentes() : exactitude(etat.reseau, etat.donnees.test) });
      const tous = VENTES ? Math.max(1, Math.floor(total / 60)) : 2;           // en mode Ventes, une époque dure moins d'une milliseconde
      if (e % tous === tous - 1 || e === total - 1) {
        dessinerReseau(); dessinerCourbe(); chiffres(); if (VENTES && etat.onglet === "prevision") dessinerPrevision();
        await new Promise((ok) => requestAnimationFrame(ok));
      }
    }
  } finally {
    etat.enCours = false; $("bouton-entrainer").disabled = false; $("bouton-pause").disabled = true;
    etat.essai = null; afficher(etat.onglet);
  }
}

// ---------- essayer et exporter ----------
const codeRobot = () => MODELES[3].replace("CERVEAU = None", exporterCerveau(etat.reseau, etat.actions));
async function essayer() {
  const p = $("panneau"); p.innerHTML = ""; p.append(creer("p", "", "Le robot affronte les cinq robots d'entraînement, en A puis en B…"));
  const r = await pilote.sumo("bilan", [{ nom: "robot 3", code: codeRobot() }], 30000);
  etat.essai = r; afficher("essai");
}
function afficher(nom) {
  etat.onglet = nom;
  for (const o of document.querySelectorAll(".onglet")) o.setAttribute("aria-selected", String(o.dataset.onglet === nom));
  const p = $("panneau"); p.innerHTML = "";
  if (nom === "prevision") {
    const c = creer("canvas", "prevision"); c.id = "dessin-prevision"; c.setAttribute("aria-label", "Fûts vendus par semaine, la courbe du réseau et la droite");
    p.append(c, creer("div", "texte-prevision")); p.querySelector(".texte-prevision").id = "texte-prevision";
    requestAnimationFrame(dessinerPrevision);
  } else if (nom === "essai") {
    const b = creer("button", "bouton principal", "Essayer contre les robots d'entraînement"); b.type = "button"; b.addEventListener("click", essayer);
    p.append(b);
    if (!etat.courbe.length) p.append(creer("p", "vide", "Un réseau non entraîné joue presque au hasard : entraînez-le d'abord, puis essayez-le."));
    const r = etat.essai;
    if (r && r.erreur) p.append(creer("p", "erreur", r.erreur.message));
    else if (r) {
      p.append(creer("p", "", `${r.victoires} victoire(s) sur ${r.combats}.`));
      const t = creer("table", "tours"), tete = creer("tr"); ["Adversaire", "En A", "En B"].forEach((x) => tete.append(creer("th", "", x))); t.append(tete);
      for (const l of r.lignes) { const tr = creer("tr"); tr.append(creer("td", "", l.adversaire), creer("td", l.enA === "gagné" ? "gagne" : l.enA === "perdu" ? "perdu" : "", l.enA), creer("td", l.enB === "gagné" ? "gagne" : l.enB === "perdu" ? "perdu" : "", l.enB)); t.append(tr); }
      p.append(t);
    }
  } else {
    const zone = creer("textarea", "cerveau"); zone.readOnly = true; zone.value = exporterCerveau(etat.reseau, etat.actions);
    const copier = creer("button", "bouton principal", "Copier le cerveau"); copier.type = "button";
    copier.addEventListener("click", async () => { zone.select(); try { await navigator.clipboard.writeText(zone.value); copier.textContent = "Copié"; } catch { document.execCommand("copy"); copier.textContent = "Copié"; } });
    const ouvrir = creer("button", "bouton", "Ouvrir dans l'atelier (génération 3)"); ouvrir.type = "button";
    ouvrir.addEventListener("click", () => {
      try {
        const cle = "jeux-python.sumo.v1", m = JSON.parse(localStorage.getItem(cle)) || {};
        m.codes = m.codes || {}; m.codes[3] = codeRobot(); m.generation = 3; localStorage.setItem(cle, JSON.stringify(m));
      } catch { /* navigation privée */ }
      location.href = "sumo.html";
    });
    const rangee = creer("div", "envoi"); rangee.append(copier, ouvrir);
    p.append(creer("p", "", "Collez cette ligne à la place de « CERVEAU = None » dans votre robot de génération 3 (atelier du sumo, ou robot3.py dans VS Code)."), zone, rangee);
  }
}


// ---------- mode Ventes ----------
// les entrées mises à l'échelle avec la moyenne et l'écart-type de l'entraînement (comme StandardScaler) ; la sortie reste en fûts
function preparerVentes(d) {
  const ent = d.lignes.filter((l) => !l[3]), test = d.lignes.filter((l) => l[3]);
  const moy = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const ech = [0, 1].map((j) => { const v = ent.map((l) => l[j]), m = moy(v); return { m, s: Math.sqrt(moy(v.map((x) => (x - m) ** 2))) || 1 }; });
  const X = (l) => [0, 1].map((j) => (l[j] - ech[j].m) / ech[j].s);
  // la droite : régression linéaire sur l'entraînement (moindres carrés, équations normales à 3 inconnues)
  const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], B = [0, 0, 0];
  for (const l of ent) { const v = [1, l[0], l[1]]; for (let i = 0; i < 3; i++) { B[i] += v[i] * l[2]; for (let j = 0; j < 3; j++) A[i][j] += v[i] * v[j]; } }
  for (let i = 0; i < 3; i++) {                     // élimination de Gauss
    const piv = A[i][i];
    for (let j = i + 1; j < 3; j++) { const f = A[j][i] / piv; for (let k = i; k < 3; k++) A[j][k] -= f * A[i][k]; B[j] -= f * B[i]; }
  }
  const coef = [0, 0, 0];
  for (let i = 2; i >= 0; i--) coef[i] = (B[i] - [0, 1, 2].filter((k) => k > i).reduce((s, k) => s + A[i][k] * coef[k], 0)) / A[i][i];
  const droite = (l) => coef[0] + coef[1] * l[0] + coef[2] * l[1];
  const mae = moy(test.map((l) => Math.abs(droite(l) - l[2])));
  return { d, ent, test, X, droite: { f: droite, mae, coef }, donnees: { entrainement: ent.map((l) => ({ x: X(l), y: l[2], poids: 1 })), test: test.map((l) => ({ x: X(l), y: l[2], poids: 1 })) } };
}
const prevoir = (l) => predireNombre(etat.reseau, etat.ventes.X(l));
function maeVentes() { const t = etat.ventes.test; return t.reduce((s, l) => s + Math.abs(prevoir(l) - l[2]), 0) / t.length; }

function dessinerPrevision() {
  const c = $("dessin-prevision"); if (!c || !etat.ventes) return;
  const ctx = c.getContext("2d"), r = window.devicePixelRatio || 1, l = c.clientWidth, h = c.clientHeight;
  c.width = l * r; c.height = h * r; ctx.setTransform(r, 0, 0, r, 0, 0); ctx.clearRect(0, 0, l, h);
  const v = etat.ventes, toutes = [...v.d.lignes, ...v.d.decembre.map((x) => [...x, null, 2])];
  const prevs = toutes.map((x) => prevoir(x)), drt = toutes.map((x) => v.droite.f(x));
  const maxi = Math.max(40, ...v.d.lignes.map((x) => x[2]), ...prevs, ...drt), mini = Math.min(0, ...prevs);
  const X = (i) => 40 + (i * (l - 56)) / 55, Y = (q) => h - 26 - ((q - mini) / (maxi - mini)) * (h - 40);
  ctx.fillStyle = "rgba(242,184,46,0.14)"; ctx.fillRect(X(51.5), 6, X(55.5) - X(51.5), h - 32);                      // décembre 2026 : jamais vu
  ctx.strokeStyle = "#dad6e8"; ctx.beginPath(); ctx.moveTo(40, 6); ctx.lineTo(40, h - 26); ctx.lineTo(l - 10, h - 26); ctx.stroke();
  if (mini < 0) { ctx.strokeStyle = "#a3262d"; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(40, Y(0)); ctx.lineTo(l - 10, Y(0)); ctx.stroke(); ctx.setLineDash([]); }
  ctx.fillStyle = "#3a3a48"; ctx.font = "12px Barlow, sans-serif";
  for (let q = 0; q <= maxi; q += 10) ctx.fillText(String(q), 8, Y(q) + 4);
  ctx.fillText("semaines depuis le 01/12/2025", l / 2 - 70, h - 8); ctx.textAlign = "right"; ctx.fillText("déc. 2026", l - 12, 18); ctx.textAlign = "left";
  const tracer = (vals, couleur, pointilles) => { ctx.strokeStyle = couleur; ctx.lineWidth = 2; ctx.setLineDash(pointilles ? [6, 4] : []); ctx.beginPath(); vals.forEach((q, i) => (i ? ctx.lineTo(X(toutes[i][0]), Y(q)) : ctx.moveTo(X(toutes[i][0]), Y(q)))); ctx.stroke(); ctx.setLineDash([]); };
  tracer(drt, "#5e5a72", true); tracer(prevs, "#c27a3e", false);
  for (const x of v.d.lignes) {
    ctx.beginPath(); ctx.arc(X(x[0]), Y(x[2]), 3.5, 0, Math.PI * 2);
    if (x[3]) { ctx.strokeStyle = "#17824C"; ctx.lineWidth = 2; ctx.stroke(); } else { ctx.fillStyle = "#17824C"; ctx.fill(); }
  }
  const t = $("texte-prevision"); if (!t) return;
  const somme = (vals) => vals.slice(-4).reduce((a, b) => a + b, 0), fr = (n) => Math.round(n).toLocaleString("fr-BE");
  t.innerHTML = "";
  t.append(creer("p", "", "Points pleins : semaines d'entraînement ; points vides : semaines de test. Courbe orange : le réseau ; tirets : la droite (régression linéaire). Zone jaune : les quatre semaines des fêtes 2026, que personne n'a vues."));
  t.append(creer("p", "", `Fêtes 2026 : ${fr(somme(prevs))} fûts selon le réseau, ${fr(somme(drt))} selon la droite (fêtes 2025 : ${v.d.lignes.slice(0, 4).reduce((s, x) => s + x[2], 0)} fûts vendus).`));
  if (Math.min(...prevs.slice(-4)) < 0) t.append(creer("p", "erreur", "Le réseau prévoit des fûts négatifs en décembre : il prolonge ses courbes au-delà des semaines qu'il a vues. Une prévision hors des données se vérifie toujours."));
}

// ---------- les données ----------
function ajouterDecisionsCSV(texte) {
  const lignes = texte.trim().split(/\r?\n/), tete = lignes.shift().split(";");
  const col = (n) => tete.indexOf(n), cles = ["distance", "energie_moi", "energie_adversaire", "bord_moi", "bord_adversaire", "adversaire_a_pousse"];
  if (cles.some((k) => col(k) < 0) || col("action") < 0 || col("issue") < 0) throw new Error("Ce fichier n'a pas les colonnes d'un fichier de décisions (export « Décisions des robots » du tournoi).");
  const compte = new Map(); let n = 0;
  for (const l of lignes) {
    const v = l.split(";");
    if (v[col("issue")] !== "gagne" || v[col("valide")] !== "True") continue;
    const y = etat.actions.indexOf(v[col("action")]); if (y < 0) continue;
    const cle = [...cles.map((k) => Number(v[col(k)])), y].join(","); compte.set(cle, (compte.get(cle) || 0) + 1); n++;
  }
  for (const [cle, k] of compte) etat.lignes.push([...cle.split(",").map(Number), k]);
  etat.donnees = preparer(etat.lignes);
  return n;
}

async function demarrer() {
  $("choix-mode").value = MODE;
  $("choix-mode").addEventListener("change", (ev) => { location.search = ev.target.value === "ventes" ? "?mode=ventes" : ""; });
  if (MODE === "combat") { const m = await import("../combat/labo-combat.js"); await m.demarrerCombat(); return; }
  if (VENTES) {
    const d = await (await fetch("sumo/ventes-hebdo.json")).json();
    etat.ventes = preparerVentes(d); etat.donnees = etat.ventes.donnees; etat.onglet = "prevision";
    $("surtitre").textContent = "J5 · réseau de neurones"; $("titre").textContent = "Prévoir les fûts de la semaine";
    $("texte-donnees").textContent = `Les données : les fûts vendus chaque semaine du 01/12/2025 au 22/11/2026 (${d.lignes.length} semaines, données du self study). Entrées : l'indice de la semaine et la colonne fetes (1 pour les quatre semaines des fêtes) ; sortie : le nombre de fûts. ${d.lignes.filter((l) => l[3]).length} semaines gardées pour le test, comme train_test_split(test_size=0.25, random_state=27).`;
    $("legende-reseau").textContent = "Poids positif : orange · poids négatif : bleu · épaisseur : force du poids. Entrées mises à l'échelle (comme StandardScaler) ; la sortie est en fûts.";
    $("ajout-decisions").hidden = true; $("etat-python").hidden = true;
    for (const o of document.querySelectorAll(".onglet")) o.hidden = o.dataset.onglet !== "prevision";
    const ep = $("choix-epoques"); ep.innerHTML = "<option>100</option><option selected>300</option><option>1000</option>";
  } else {
    const d = await (await fetch("sumo/decisions-gagnants.json")).json();
    etat.actions = d.actions; etat.lignes = d.lignes; etat.donnees = preparer(d.lignes);
    $("texte-donnees").textContent = `Les données : ${d.decisions} décisions des robots gagnants (${d.lignes.length} situations différentes), tirées de ${d.combats.toLocaleString("fr-BE")} combats entre les robots d'entraînement. Entrée : six nombres ; sortie : l'action jouée. Un quart des situations est gardé de côté pour le test.`;
  }
  nouveauReseau();
  $("bouton-entrainer").addEventListener("click", entrainer);
  $("bouton-pause").addEventListener("click", () => { etat.pause = !etat.pause; $("bouton-pause").textContent = etat.pause ? "Reprendre" : "Pause"; });
  $("bouton-zero").addEventListener("click", () => { if (!etat.enCours) nouveauReseau(); });
  $("couche-plus").addEventListener("click", () => { if (!etat.enCours && etat.cachees.length < MAX_COUCHES) { etat.cachees.push(6); nouveauReseau(); } });
  $("couche-moins").addEventListener("click", () => { if (!etat.enCours && etat.cachees.length) { etat.cachees.pop(); nouveauReseau(); } });
  $("dessin-reseau").addEventListener("click", (ev) => {
    if (etat.enCours) return;
    const r = ev.currentTarget.getBoundingClientRect(), x = ev.clientX - r.left;
    const z = zonesCouches.find((c) => x >= c.x1 && x <= c.x2); if (!z) return;
    etat.cachees[z.k] = Math.max(1, Math.min(MAX_NEURONES, etat.cachees[z.k] + (ev.shiftKey ? -1 : 1)));
    nouveauReseau();
  });
  $("fichier-decisions").addEventListener("change", async (ev) => {
    const f = ev.target.files[0]; ev.target.value = ""; if (!f) return;
    try { const n = ajouterDecisionsCSV(await f.text()); $("texte-donnees").textContent += ` Ajouté : ${n} décisions gagnantes de ${f.name}.`; nouveauReseau(); }
    catch (e) { $("panneau").prepend(creer("p", "erreur", e.message)); }
  });
  for (const o of document.querySelectorAll(".onglet")) o.addEventListener("click", () => afficher(o.dataset.onglet));
  new ResizeObserver(() => { dessinerReseau(); dessinerCourbe(); if (VENTES) dessinerPrevision(); }).observe(document.body);
}
demarrer();
window.labo = { etat, entrainer, predire };
