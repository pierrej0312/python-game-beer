// Le labo des neurones, mode Combat (J5, robot 3) : le réseau apprend à combattre par renforcement. Il ne voit aucun
// exemple ; il joue contre les six robots d'entraînement, et chaque génération garde la direction qui fait gagner.
// On voit le réseau se redessiner et la courbe des victoires monter ; on exporte le cerveau pour robot3.py.
import { R } from "./regles.js";
import { CARACTERISTIQUES } from "./apprentissage.js";
import { exporterCerveau } from "./renforcement.js";
import { MODELES } from "./modeles.js";

const $ = (id) => document.getElementById(id);
const creer = (balise, classe, texte) => { const e = document.createElement(balise); if (classe) e.className = classe; if (texte !== undefined) e.textContent = texte; return e; };
const NOMS = ["distance", "ma vie", "sa vie", "mon énergie", "son énergie", "cordes derrière moi", "cordes derrière lui",
  "il prépare", "il frappe", "il récupère", "garde haute", "garde basse", "il est sonné", "instants restants",
  "son coup : direct", "crochet", "coup bas", "projection", "spécial"];
const etat = { cachees: [16], tailles: null, poids: null, courbe: [], enCours: false, pause: false, onglet: "essai", bilan: null, meilleur: 0 };
let worker = null;

function nouveau() {
  if (worker) worker.terminate();
  worker = new Worker(new URL("./entraineur-worker.js", import.meta.url), { type: "module" });
  etat.courbe = []; etat.bilan = null;
  return new Promise((ok) => {
    worker.onmessage = (e) => { if (e.data.type === "pret") { etat.tailles = e.data.tailles; etat.poids = e.data.poids; dessinerReseau(); dessinerCourbe(); chiffres(); afficher(etat.onglet); ok(); } };
    worker.postMessage({ type: "init", cachees: etat.cachees });
  });
}
const demander = (message, type) => new Promise((ok) => { worker.onmessage = (e) => { if (e.data.type === type) ok(e.data); }; worker.postMessage(message); });

// ---------- le dessin du réseau ----------
let zones = [];
function couches() {
  const t = etat.tailles, res = []; let k = 0;
  for (let l = 1; l < t.length; l++) { const c = []; for (let j = 0; j < t[l]; j++) { c.push(etat.poids.slice(k, k + t[l - 1])); k += t[l - 1] + 1; } res.push(c); }
  return res;
}
function dessinerReseau() {
  const c = $("dessin-reseau"), ctx = c.getContext("2d"), r = window.devicePixelRatio || 1, l = c.clientWidth, h = c.clientHeight;
  c.width = l * r; c.height = h * r; ctx.setTransform(r, 0, 0, r, 0, 0); ctx.fillStyle = "#131419"; ctx.fillRect(0, 0, l, h);
  if (!etat.tailles) return;
  const t = etat.tailles, n = t.length, X = (k) => 150 + (k * (l - 290)) / (n - 1);
  const Y = (k, i) => { const esp = Math.min(40, (h - 90) / Math.max(1, t[k])); return h / 2 + 10 - ((t[k] - 1) * esp) / 2 + i * esp; };
  const cs = couches(), maxi = Math.max(0.001, ...cs.flatMap((cc) => cc.flatMap((ne) => ne.map(Math.abs))));
  cs.forEach((couche, k) => couche.forEach((ne, j) => ne.forEach((p, i) => {
    ctx.strokeStyle = p >= 0 ? `rgba(242,140,30,${0.08 + 0.9 * Math.abs(p) / maxi})` : `rgba(80,160,255,${0.08 + 0.9 * Math.abs(p) / maxi})`;
    ctx.lineWidth = 0.3 + 3.5 * Math.abs(p) / maxi; ctx.beginPath(); ctx.moveTo(X(k), Y(k, i)); ctx.lineTo(X(k + 1), Y(k + 1, j)); ctx.stroke();
  })));
  zones = [];
  ctx.font = "12px Barlow, sans-serif";
  t.forEach((taille, k) => {
    for (let i = 0; i < taille; i++) { ctx.beginPath(); ctx.arc(X(k), Y(k, i), taille > 14 ? 6 : 8, 0, Math.PI * 2); ctx.fillStyle = k === 0 ? "#2e2a4a" : k === n - 1 ? "#1f4d36" : "#3a3d48"; ctx.fill(); ctx.strokeStyle = "#e8e3d6"; ctx.lineWidth = 1.2; ctx.stroke(); }
    ctx.fillStyle = "#cfd3dc";
    if (k === 0) { ctx.textAlign = "right"; NOMS.forEach((nom, i) => ctx.fillText(nom, X(k) - 14, Y(k, i) + 4)); }
    else if (k === n - 1) { ctx.textAlign = "left"; R.ACTIONS.forEach((a, i) => ctx.fillText(a, X(k) + 14, Y(k, i) + 4)); }
    else { ctx.textAlign = "center"; ctx.fillText(`${taille} neurones`, X(k), 46); zones.push({ k: k - 1, x1: X(k) - 30, x2: X(k) + 30 }); }
  });
}
function dessinerCourbe() {
  const c = $("courbe"), ctx = c.getContext("2d"), r = window.devicePixelRatio || 1, l = c.clientWidth, h = c.clientHeight;
  c.width = l * r; c.height = h * r; ctx.setTransform(r, 0, 0, r, 0, 0); ctx.clearRect(0, 0, l, h);
  ctx.strokeStyle = "#dad6e8"; ctx.beginPath(); ctx.moveTo(36, 8); ctx.lineTo(36, h - 22); ctx.lineTo(l - 6, h - 22); ctx.stroke();
  ctx.fillStyle = "#3a3a48"; ctx.font = "12px Barlow, sans-serif";
  const Y = (v) => (h - 22) - (v / 12) * (h - 34);
  for (const v of [0, 6, 12]) ctx.fillText(String(v), 14, Y(v) + 4);
  ctx.fillText("victoires sur 12", 42, 14); ctx.fillText("générations", l - 70, h - 6);
  const pts = etat.courbe; if (pts.length < 1) return;
  const Xp = (i) => 36 + ((i + 1) * (l - 46)) / Math.max(pts.length, 10);
  ctx.strokeStyle = "#c27a3e"; ctx.lineWidth = 1.5; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(Xp(i), Y(p.moyenne)) : ctx.moveTo(Xp(i), Y(p.moyenne))));
  ctx.stroke();
  ctx.strokeStyle = "#17824C"; ctx.lineWidth = 2.5; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(Xp(i), Y(p.victoires)) : ctx.moveTo(Xp(i), Y(p.victoires)))); ctx.stroke();
  ctx.fillStyle = "#17824C"; ctx.fillText("le réseau", 130, 14); ctx.fillStyle = "#c27a3e"; ctx.fillText("ses variantes", 196, 14);
}
function chiffres() {
  const z = $("chiffres"); z.innerHTML = "";
  if (!etat.tailles) return;
  const der = etat.courbe.at(-1);
  z.append(creer("div", "", `Réseau : ${etat.tailles.join(" → ")}`), creer("div", "", `${etat.poids.length} poids et biais`), creer("div", "", `${etat.courbe.length} génération(s)`));
  if (der) { const b = creer("div"); b.append(creer("strong", "", `${der.victoires} victoires sur ${der.combats}`), document.createTextNode(` (${(der.duree / 1000).toFixed(1)} s par génération)`)); z.append(b); }
}

// ---------- entraîner ----------
async function entrainer() {
  if (etat.enCours) return;
  etat.enCours = true; etat.pause = false; $("bouton-entrainer").disabled = true; $("bouton-pause").disabled = false;
  const total = Number($("choix-epoques").value);
  try {
    for (let g = 0; g < total; g++) {
      while (etat.pause) await new Promise((ok) => setTimeout(ok, 100));
      const s = await demander({ type: "generation" }, "generation");
      etat.poids = s.poids; etat.courbe.push(s);
      dessinerReseau(); dessinerCourbe(); chiffres();
    }
  } finally { etat.enCours = false; $("bouton-entrainer").disabled = false; $("bouton-pause").disabled = true; etat.bilan = null; afficher(etat.onglet); }
}
const codeRobot = () => MODELES[3].replace("CERVEAU = None", exporterCerveau({ tailles: etat.tailles, poids: etat.poids }));

function afficher(nom) {
  etat.onglet = nom;
  for (const o of document.querySelectorAll(".onglet")) o.setAttribute("aria-selected", String(o.dataset.onglet === nom));
  const p = $("panneau"); p.innerHTML = "";
  if (nom === "essai") {
    const b = creer("button", "bouton principal", "Combattre les six robots d'entraînement"); b.type = "button";
    b.addEventListener("click", async () => { b.disabled = true; etat.bilan = (await demander({ type: "bilan" }, "bilan")).lignes; afficher("essai"); });
    p.append(b);
    if (!etat.courbe.length) p.append(creer("p", "vide", "Un réseau neuf joue presque au hasard : entraînez-le, puis faites-le combattre."));
    if (etat.bilan) {
      const t = creer("table", "tours"), tete = creer("tr"); ["Adversaire", "En A", "En B"].forEach((x) => tete.append(creer("th", "", x))); t.append(tete);
      for (const l of etat.bilan) {
        const tr = creer("tr"), cell = (res, v) => creer("td", res === "gagné" ? "gagne" : res === "perdu" ? "perdu" : "", `${res} (${v[0]} à ${v[1]})`);
        tr.append(creer("td", "", l.adversaire), cell(l.enA, l.vieA), cell(l.enB, l.vieB)); t.append(tr);
      }
      p.append(t);
    }
    const voir = creer("button", "bouton", "Le voir combattre dans l'arène"); voir.type = "button"; voir.addEventListener("click", ouvrirArene); p.append(voir);
  } else {
    const zone = creer("textarea", "cerveau"); zone.readOnly = true; zone.value = exporterCerveau({ tailles: etat.tailles, poids: etat.poids });
    const copier = creer("button", "bouton principal", "Copier le cerveau"); copier.type = "button";
    copier.addEventListener("click", async () => { zone.select(); try { await navigator.clipboard.writeText(zone.value); } catch { document.execCommand("copy"); } copier.textContent = "Copié"; });
    const ouvrir = creer("button", "bouton", "Ouvrir dans l'arène (génération 3)"); ouvrir.type = "button"; ouvrir.addEventListener("click", ouvrirArene);
    const rangee = creer("div", "envoi"); rangee.append(copier, ouvrir);
    p.append(creer("p", "", "Collez cette ligne à la place de « CERVEAU = None » dans votre robot de génération 3 (onglet Programmer de l'arène, ou robot3.py dans VS Code)."), zone, rangee);
  }
}
function ouvrirArene() {
  try {
    const cle = "jeux-python.championnat.v1", m = JSON.parse(localStorage.getItem(cle)) || {};
    m.codes = m.codes || {}; m.codes[3] = codeRobot(); m.generation = 3; localStorage.setItem(cle, JSON.stringify(m));
  } catch { /* navigation privée */ }
  location.href = "robots.html#programmer";
}

export async function demarrerCombat() {
  $("surtitre").textContent = "Robot 3 · réseau de neurones"; $("titre").textContent = "Apprendre à combattre, en combattant";
  $("texte-donnees").textContent = "Aucun exemple à imiter : à chaque génération, le labo essaie 24 variantes du réseau ; chacune affronte les six robots d'entraînement (en A puis en B), et le réseau avance vers les variantes qui ont gagné. Entrées : les 19 nombres que voit le robot ; sorties : une note par action, le robot joue la mieux notée qu'il peut payer. Cette méthode s'appelle une stratégie d'évolution : le réseau n'apprend pas ici par rétropropagation.";
  $("legende-reseau").textContent = "Poids positif : orange · poids négatif : bleu · épaisseur : force du poids.";
  $("ajout-decisions").hidden = true; $("etat-python").hidden = true;
  for (const o of document.querySelectorAll(".onglet")) o.hidden = !["essai", "cerveau"].includes(o.dataset.onglet);
  document.querySelector('.onglet[data-onglet="essai"]').textContent = "Combattre";
  $("choix-epoques").innerHTML = "<option>10</option><option selected>30</option><option>60</option>";
  $("choix-epoques").parentElement.firstChild.textContent = "Générations ";
  $("choix-taux").closest("label").hidden = true;
  await nouveau();
  $("bouton-entrainer").addEventListener("click", entrainer);
  $("bouton-pause").addEventListener("click", () => { etat.pause = !etat.pause; $("bouton-pause").textContent = etat.pause ? "Reprendre" : "Pause"; });
  $("bouton-zero").addEventListener("click", () => { if (!etat.enCours) nouveau(); });
  $("couche-plus").addEventListener("click", () => { if (!etat.enCours && etat.cachees.length < 3) { etat.cachees.push(8); nouveau(); } });
  $("couche-moins").addEventListener("click", () => { if (!etat.enCours && etat.cachees.length) { etat.cachees.pop(); nouveau(); } });
  $("dessin-reseau").addEventListener("click", (ev) => {
    if (etat.enCours) return;
    const x = ev.clientX - ev.currentTarget.getBoundingClientRect().left, z = zones.find((c) => x >= c.x1 && x <= c.x2); if (!z) return;
    etat.cachees[z.k] = Math.max(1, Math.min(24, etat.cachees[z.k] + (ev.shiftKey ? -1 : 1))); nouveau();
  });
  for (const o of document.querySelectorAll(".onglet")) o.addEventListener("click", () => afficher(o.dataset.onglet));
  new ResizeObserver(() => { dessinerReseau(); dessinerCourbe(); }).observe(document.body);
}
