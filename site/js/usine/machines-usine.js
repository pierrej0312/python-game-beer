// Les machines de la brasserie, d'après les planches « Python Brewery » du formateur (20/11/2026) :
// cuivre, aluminium brossé et laiton (le formateur ne veut pas de vert), un écran à icône sur chaque machine, des bouteilles partout.
// Chaque machine rejoue son geste en boucle au repos (userData.cycle), comme dans Satisfactory : on voit ce qu'elle fait.
// Chaque machine est un groupe three.js posé au sol (y = 0), d'emprise 1,6 x 1,6, avec :
// - userData.corps : une boîte invisible, la cible des clics et du survol ;
// - userData.travail(t, info) : la pose de la machine à l'instant t (0 à 1) d'un cycle de travail ;
//   info.prend (trieur : la condition est vraie), info.vrai (while : encore un tour), info.dedans (for : encore un élément) ;
// - userData.repos(ms) : son mouvement au repos, discret ;
// - userData.surbrillance(oui) : la bande de couleur s'allume au survol ;
// - userData.hautVoyant : la hauteur du voyant d'état (0 : pas de voyant).
// Pas de code ici : l'étiquette (la ligne Python) est posée par la scène.
import * as THREE from "three";
import { RoundedBoxGeometry } from "../../vendor/three/addons/RoundedBoxGeometry.js";

const vague = (t) => Math.sin(Math.PI * t);                 // 0 -> 1 -> 0 sur un cycle
const lisse = (t) => t * t * (3 - 2 * t);
const borne = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));

// ---- les matières, partagées ----
const M = {
  acier: new THREE.MeshStandardMaterial({ color: 0x9aa1aa, metalness: 0.85, roughness: 0.32 }),
  acierSombre: new THREE.MeshStandardMaterial({ color: 0x5c626c, metalness: 0.8, roughness: 0.4 }),
  inox: new THREE.MeshStandardMaterial({ color: 0xd3d8de, metalness: 0.9, roughness: 0.2 }),
  // « teal » garde son nom dans le code, mais c'est désormais de l'aluminium brossé (choix du formateur du 20/11 : pas de vert)
  teal: new THREE.MeshStandardMaterial({ color: 0xc3c9d0, metalness: 0.88, roughness: 0.3 }),
  tealClair: new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.85, roughness: 0.3 }),       // laiton
  sombre: new THREE.MeshStandardMaterial({ color: 0x23272e, metalness: 0.4, roughness: 0.55 }),
  cuivre: new THREE.MeshStandardMaterial({ color: 0xc27a3e, metalness: 0.9, roughness: 0.28 }),
  caoutchouc: new THREE.MeshStandardMaterial({ color: 0x1b1d22, roughness: 0.9 }),
  bois: new THREE.MeshStandardMaterial({ color: 0xb98049, roughness: 0.85 }),
  verre: new THREE.MeshStandardMaterial({ color: 0xbfe6ff, metalness: 0.1, roughness: 0.04, transparent: true, opacity: 0.22, depthWrite: false }),
  biere: new THREE.MeshStandardMaterial({ color: 0x8a4a12, metalness: 0.1, roughness: 0.15, emissive: 0x2a1200, emissiveIntensity: 0.6 }),
  mousse: new THREE.MeshStandardMaterial({ color: 0xf0d9a0, roughness: 0.6 }),
  capsule: new THREE.MeshStandardMaterial({ color: 0xd8b04a, metalness: 0.7, roughness: 0.35 }),
  papier: new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.9, side: THREE.DoubleSide }),
  jaune: new THREE.MeshStandardMaterial({ color: 0xf2b134, roughness: 0.5 }),
  rouge: new THREE.MeshStandardMaterial({ color: 0xd9443a, roughness: 0.5 }),
  orange: new THREE.MeshStandardMaterial({ color: 0xff8a2a, emissive: 0xff6a00, emissiveIntensity: 0.8, roughness: 0.4 }),
  cible: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
};
const ROUGE = 0xff3b30, VERT = 0x2fe07a, CYAN = 0xffd9a0;
const lampe = (couleur) => new THREE.MeshStandardMaterial({ color: couleur, emissive: couleur, emissiveIntensity: 1.2, roughness: 0.3 });

// ---- les écrans à icône : une texture dessinée par icône, partagée ----
const ICONES = new Map();
function icone(nom, encre = "#ffd27a") {
  const cle = nom + encre;
  if (ICONES.has(cle)) return ICONES.get(cle);
  const t = document.createElement("canvas"); t.width = t.height = 128;
  const c = t.getContext("2d");
  c.fillStyle = "#0d1a20"; c.fillRect(0, 0, 128, 128);
  c.strokeStyle = "#2a4a52"; c.lineWidth = 6; c.strokeRect(3, 3, 122, 122);
  c.strokeStyle = encre; c.fillStyle = encre; c.lineWidth = 9; c.lineCap = "round"; c.lineJoin = "round";
  c.textAlign = "center"; c.textBaseline = "middle";
  const ligne = (...p) => { c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.stroke(); };
  const texte = (s, taille = 64) => { c.font = `700 ${taille}px "Barlow", "Segoe UI", sans-serif`; c.fillText(s, 64, 68); };
  switch (nom) {
    case "plus": ligne(64, 30, 64, 98); ligne(30, 64, 98, 64); break;
    case "moins": ligne(30, 64, 98, 64); break;
    case "fleche": ligne(28, 64, 96, 64); ligne(74, 42, 96, 64, 74, 86); break;
    case "retour": c.beginPath(); c.arc(64, 70, 28, Math.PI * 1.05, Math.PI * 0.05, false); c.stroke(); ligne(28, 44, 36, 72, 60, 62); break;
    case "boucle": c.beginPath(); c.arc(64, 64, 30, 0.3, Math.PI * 1.7); c.stroke(); ligne(84, 22, 92, 46, 68, 48); break;
    case "loupe": c.beginPath(); c.arc(56, 56, 24, 0, Math.PI * 2); c.stroke(); ligne(74, 74, 98, 98); break;
    case "alerte": ligne(64, 26, 100, 96, 28, 96, 64, 26); c.lineWidth = 8; ligne(64, 50, 64, 74); c.fillRect(60, 82, 8, 8); break;
    case "ticket": c.lineWidth = 6; c.strokeRect(36, 24, 56, 80); for (const y of [44, 60, 76]) ligne(46, y, 82, y); break;
    case "copie": c.lineWidth = 7; c.strokeRect(30, 40, 44, 54); c.strokeRect(54, 24, 44, 54); break;
    case "tri": for (const [x, h] of [[38, 24], [64, 44], [90, 64]]) ligne(x, 96, x, 96 - h); break;
    case "ensemble": c.lineWidth = 8; c.beginPath(); c.arc(50, 64, 26, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(78, 64, 26, 0, Math.PI * 2); c.stroke(); break;
    case "croix": ligne(38, 38, 90, 90); ligne(90, 38, 38, 90); break;
    case "et": texte("and", 46); break;
    case "ou": texte("or", 50); break;
    case "non": texte("not", 46); break;
    case "si": texte("?", 76); break;
    case "calcul": texte("+ − × ÷", 30); break;
    case "egal": ligne(34, 52, 94, 52); ligne(34, 76, 94, 76); break;
    default: texte(nom, 40);
  }
  const tex = new THREE.CanvasTexture(t); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.3 });
  ICONES.set(cle, mat);
  return mat;
}
// Un écran à icône, encadré, face à la caméra (+z). Son matériau est propre à la machine (il peut s'allumer seul).
function ecran(g, nom, taille, x, y, z, encre) {
  boite(g, taille + 0.08, taille + 0.08, 0.06, M.sombre, x, y, z - 0.02);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(taille, taille), icone(nom, encre).clone()); p.position.set(x, y, z + 0.015); g.add(p); return p;
}
// Les numéros des cases (0, 1, 2…), comme sur les planches : chiffres noirs sur plaque crème.
const NUMEROS = [];
function numero(i) {
  if (!NUMEROS[i]) {
    const t = document.createElement("canvas"); t.width = 64; t.height = 48; const c = t.getContext("2d");
    c.fillStyle = "#efe6d2"; c.fillRect(0, 0, 64, 48); c.fillStyle = "#1d1d1d"; c.font = '700 34px "Barlow", sans-serif'; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(String(i), 32, 26);
    const tex = new THREE.CanvasTexture(t); tex.colorSpace = THREE.SRGBColorSpace;
    NUMEROS[i] = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 });
  }
  return NUMEROS[i];
}

// ---- petites aides de construction ----
function boite(g, w, h, d, mat, x, y, z, r = 0) {
  const m = new THREE.Mesh(r ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
}
function cylindre(g, rh, rb, h, mat, x, y, z, seg = 20) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rh, rb, h, seg), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
}
const courbe = (points) => new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, "catmullrom", 0.1);
function tube(g, points, r, mat) { const m = new THREE.Mesh(new THREE.TubeGeometry(courbe(points), 24, r, 8, false), mat); m.castShadow = true; g.add(m); return m; }
// Une bouteille de bière (hauteur 0,37), posée sur son fond. Géométries partagées (marquées : la scène ne les libère pas).
const GEO_BOUTEILLE = [[0.075, 0.075, 0.22, 0.11, 12], [0.03, 0.072, 0.08, 0.26, 10], [0.03, 0.03, 0.05, 0.32, 8], [0.034, 0.034, 0.02, 0.355, 8]]
  .map(([rh, rb, h, y, seg]) => { const geo = new THREE.CylinderGeometry(rh, rb, h, seg); geo.translate(0, y, 0); geo.userData.partage = true; return geo; });
export function bouteille(echelle = 1) {
  const b = new THREE.Group();
  GEO_BOUTEILLE.forEach((geo, i) => { const m = new THREE.Mesh(geo, i === 3 ? M.capsule : M.biere); m.castShadow = i === 0; b.add(m); });
  b.scale.setScalar(echelle);
  return b;
}
// Un tronçon de tapis de machine : bande sombre entre deux rails d'acier.
function tapisMachine(g, long, x, y, z, larg = 0.55) {
  boite(g, long, 0.06, larg, M.caoutchouc, x, y, z);
  for (const s of [-1, 1]) boite(g, long, 0.12, 0.05, M.acier, x, y + 0.02, z + s * (larg / 2 + 0.02));
}

// Le socle commun : dalle d'acier, coins bleu-vert, et une bande de la couleur de la famille (elle s'allume au survol).
function socle(g, couleur) {
  boite(g, 1.6, 0.12, 1.6, M.acierSombre, 0, 0.06, 0, 0.04);
  for (const [x, z] of [[-0.74, -0.74], [0.74, -0.74], [-0.74, 0.74], [0.74, 0.74]]) boite(g, 0.16, 0.16, 0.16, M.cuivre, x, 0.08, z, 0.03);
  const bande = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.03, 0.08), new THREE.MeshStandardMaterial({ color: couleur, emissive: couleur, emissiveIntensity: 0.25, roughness: 0.5 }));
  bande.position.set(0, 0.125, 0.78); g.add(bande);
  g.userData.surbrillance = (oui) => { bande.material.emissiveIntensity = oui ? 1.4 : 0.25; bande.scale.y = oui ? 2 : 1; };
}

// Un portique de rayonnage : cases numérotées, deux montants, une poutre, un chariot qui court sur la poutre.
function portique(g, { icone: nom, encre = "#6ee7f0", cases = 5 } = {}) {
  boite(g, 1.4, 0.14, 0.6, M.acier, 0, 0.2, 0.1, 0.02);
  const pas = 1.2 / cases, xCase = (i) => -0.6 + pas / 2 + i * pas;
  for (let i = 0; i < cases; i++) {
    boite(g, pas - 0.04, 0.05, 0.5, M.sombre, xCase(i), 0.29, 0.1);
    const n = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.12), numero(i)); n.position.set(xCase(i), 0.2, 0.405); g.add(n);
  }
  for (const x of [-0.72, 0.72]) { boite(g, 0.12, 1.25, 0.12, M.cuivre, x, 0.82, -0.25, 0.03); boite(g, 0.16, 0.08, 0.5, M.acierSombre, x, 0.2, -0.05); }
  boite(g, 1.6, 0.14, 0.16, M.acier, 0, 1.45, -0.25, 0.03);
  tube(g, [[-0.72, 1.2, -0.33], [-0.72, 1.55, -0.4], [0.72, 1.55, -0.4], [0.72, 1.2, -0.33]], 0.025, M.cuivre);
  const chariot = new THREE.Group(); chariot.position.set(0, 1.32, -0.1); g.add(chariot);
  boite(chariot, 0.28, 0.24, 0.3, M.teal, 0, 0, 0, 0.04);
  const ec = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.17), icone(nom, encre)); ec.position.set(0, 0.02, 0.155); chariot.add(ec);
  const tige = new THREE.Group(); chariot.add(tige);
  cylindre(tige, 0.03, 0.03, 0.45, M.inox, 0, -0.3, 0.1, 8);
  const pince = new THREE.Group(); pince.position.set(0, -0.55, 0.1); tige.add(pince);
  boite(pince, 0.16, 0.05, 0.1, M.sombre, 0, 0, 0);
  boite(pince, 0.03, 0.12, 0.03, M.acier, -0.06, -0.07, 0); boite(pince, 0.03, 0.12, 0.03, M.acier, 0.06, -0.07, 0);
  return { chariot, tige, pince, xCase };
}
function rangee(g, p, n, echelles = null) {
  return Array.from({ length: n }, (_, i) => { const b = bouteille(echelles ? echelles[i] : 0.95); b.position.set(p.xCase(i), 0.31, 0.1); g.add(b); return b; });
}

// ---------------------------------------------------------------- les modèles

// Étiqueteuse (nom = valeur) : un bras bleu-vert prend la bouteille et la range au fond, dans le contenant de la variable.
function etiqueteuse(g) {
  tapisMachine(g, 1.4, 0, 0.3, 0.35);
  const b0 = bouteille(); b0.position.set(0.15, 0.34, 0.35); g.add(b0);
  cylindre(g, 0.24, 0.28, 0.2, M.sombre, -0.3, 0.22, -0.35, 20);
  const epaule = new THREE.Group(); epaule.position.set(-0.3, 0.34, -0.35); g.add(epaule);
  cylindre(epaule, 0.2, 0.22, 0.16, M.teal, 0, 0.06, 0, 18);
  const bras1 = new THREE.Group(); bras1.position.y = 0.14; epaule.add(bras1);
  boite(bras1, 0.13, 0.7, 0.13, M.teal, 0, 0.34, 0, 0.04);
  const coude = new THREE.Group(); coude.position.y = 0.7; bras1.add(coude);
  coude.add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), M.acier));
  boite(coude, 0.55, 0.1, 0.1, M.teal, 0.27, 0, 0, 0.03);
  const pince = new THREE.Group(); pince.position.x = 0.56; coude.add(pince);
  boite(pince, 0.07, 0.08, 0.18, M.sombre, 0, 0, 0);
  boite(pince, 0.03, 0.14, 0.03, M.acier, 0, -0.1, 0.06); boite(pince, 0.03, 0.14, 0.03, M.acier, 0, -0.1, -0.06);
  const tenue = bouteille(0.9); tenue.position.set(0, -0.46, 0); tenue.visible = false; pince.add(tenue);
  bras1.rotation.z = -0.3; coude.rotation.z = -0.7;
  boite(g, 0.08, 0.55, 0.08, M.acier, 0.5, 0.32, -0.5);
  ecran(g, "egal", 0.3, 0.5, 0.68, -0.44, "#ffc857");
  g.userData.hautVoyant = 1.55;
  g.userData.travail = (t) => {
    // le bras se penche sur la bouteille, la saisit, pivote vers le fond (le parc), puis revient
    const prise = borne(t, 0, 0.3), pivot = lisse(borne(t, 0.3, 0.7)), retour = lisse(borne(t, 0.78, 1));
    epaule.rotation.y = -0.75 + (0.75 + Math.PI / 2) * pivot - (0.75 + Math.PI / 2) * retour;
    coude.rotation.z = -0.7 - 0.45 * vague(prise) - 0.3 * vague(borne(t, 0.6, 0.8));
    tenue.visible = t > 0.28 && t < 0.72; b0.visible = t < 0.28 || t > 0.9;
  };
  g.userData.repos = (ms) => { epaule.rotation.y = -0.75 + 0.08 * Math.sin(ms * 0.0007 + g.userData.phase); coude.rotation.z = -0.7; tenue.visible = false; b0.visible = true; };
}

// Calculatrice (calcul) : une cuve de cuivre à hublot, un clavier + − × ÷, deux afficheurs d'entrée et un de résultat.
function calculatrice(g) {
  cylindre(g, 0.5, 0.55, 0.75, M.cuivre, 0, 0.55, -0.1, 28);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.cuivre); dome.position.set(0, 0.92, -0.1); dome.castShadow = true; g.add(dome);
  const couvercle = cylindre(g, 0.12, 0.14, 0.12, M.cuivre, 0, 1.47, -0.1, 14);
  const hublot = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), M.verre); hublot.position.set(0, 0.72, 0.41); g.add(hublot);
  const liquide = new THREE.Mesh(new THREE.CircleGeometry(0.17, 24, Math.PI, Math.PI), M.biere); liquide.position.set(0, 0.72, 0.4); g.add(liquide);
  boite(g, 0.66, 0.24, 0.06, M.sombre, 0, 0.42, 0.42);
  const clavier = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.2), icone("calcul", "#ffc857")); clavier.position.set(0, 0.42, 0.455); g.add(clavier);
  for (const x of [-0.6, 0.6]) { boite(g, 0.26, 0.2, 0.06, lampe(0x7a3a0a), x, 0.62, 0.3); tube(g, [[x, 0.62, 0.25], [x * 0.9, 0.85, 0.0], [x * 0.55, 0.9, -0.1]], 0.035, M.cuivre); }
  const resultat = boite(g, 0.34, 0.16, 0.05, lampe(0xff9a2a), 0, 0.2, 0.66); resultat.material = resultat.material.clone();
  g.userData.hautVoyant = 1.7;
  g.userData.travail = (t) => {
    couvercle.position.y = 1.47 + 0.06 * vague(t) * Math.abs(Math.sin(t * 30));
    liquide.rotation.z = Math.sin(t * 20) * 0.3 * vague(t);
    resultat.material.emissiveIntensity = t > 0.6 ? 2.2 : 0.3 + Math.abs(Math.sin(t * 40));
  };
  g.userData.repos = () => { resultat.material.emissiveIntensity = 0.8; couvercle.position.y = 1.47; liquide.rotation.z = 0; };
}

// Chargeur (append) et Inséreuse (remplacer une case) : le chariot apporte une bouteille et la pose dans une case.
function chargeur(g, inserer) {
  const p = portique(g, { icone: inserer ? "fleche" : "plus", encre: "#ffc857" });
  const cases = rangee(g, p, inserer ? 5 : 4);
  const neuve = bouteille(0.95); p.pince.add(neuve); neuve.position.set(0, -0.42, 0);
  const vise = inserer ? 1 : 4, depart = -0.95;
  g.userData.hautVoyant = 1.75;
  g.userData.travail = (t) => {
    const aller = lisse(borne(t, 0, 0.4)), pose = vague(borne(t, 0.4, 0.8)), retour = lisse(borne(t, 0.8, 1));
    p.chariot.position.x = depart + (p.xCase(vise) - depart) * aller * (1 - retour);
    p.tige.position.y = -0.22 * pose;
    neuve.visible = t < 0.6;
    if (inserer) cases[1].visible = t > 0.6 || t < 0.45;
  };
  g.userData.repos = (ms) => { p.chariot.position.x = 0.12 * Math.sin(ms * 0.0005 + g.userData.phase); p.tige.position.y = 0; neuve.visible = true; if (inserer) cases[1].visible = true; };
}

// Extracteur (remove, pop) : le chariot soulève une bouteille et la jette dans le bac rouge, à droite.
function extracteur(g) {
  const p = portique(g, { icone: "moins", encre: "#ff8a7a" });
  const cases = rangee(g, p, 5);
  boite(g, 0.42, 0.3, 0.42, M.rouge, 0.55, 0.28, 0.6, 0.03);
  boite(g, 0.36, 0.02, 0.36, M.sombre, 0.55, 0.43, 0.6);
  const tenue = bouteille(0.95); tenue.position.set(0, -0.42, 0); tenue.visible = false; p.pince.add(tenue);
  g.userData.hautVoyant = 1.75;
  g.userData.travail = (t) => {
    const monte = vague(borne(t, 0, 0.35)), deplace = lisse(borne(t, 0.3, 0.75));
    p.chariot.position.x = p.xCase(2) + (0.55 - p.xCase(2)) * deplace;
    p.chariot.position.z = -0.1 + 0.7 * deplace * (1 - borne(t, 0.85, 1));
    p.tige.position.y = -0.22 * monte;
    cases[2].visible = t < 0.18 || t > 0.98;
    tenue.visible = t >= 0.18 && t < 0.8;
  };
  g.userData.repos = () => { p.chariot.position.set(p.xCase(2), 1.32, -0.1); p.tige.position.y = 0; tenue.visible = false; cases[2].visible = true; };
}

// Scanner (lire une case, une tranche, len, in) : la tête balaie les bouteilles d'un faisceau bleu.
function scanneur(g) {
  const p = portique(g, { icone: "loupe" });
  rangee(g, p, 5);
  p.tige.visible = false;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.95, 20, 1, true), new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  cone.position.set(0, -0.6, 0.15); p.chariot.add(cone); cone.visible = false;
  g.userData.hautVoyant = 1.75;
  g.userData.travail = (t) => { p.chariot.position.x = -0.6 + 1.2 * vague(t); cone.visible = t > 0.05 && t < 0.95; cone.material.opacity = 0.18 + 0.1 * Math.sin(t * 50); };
  g.userData.repos = () => { cone.visible = false; };
}

// Copieur trié (sorted) : le chariot lit et range une copie par taille. Trieur de rayon (sort) : le rayon lui-même est réordonné.
function copieur(g, surPlace) {
  const p = portique(g, { icone: surPlace ? "tri" : "copie", encre: "#ffc857" });
  const hauteurs = [0.8, 1.15, 0.9, 1.05, 0.95], triees = [...hauteurs].sort((a, b) => a - b);
  const bs = rangee(g, p, 5, hauteurs);
  p.tige.visible = !surPlace;
  g.userData.hautVoyant = 1.75;
  g.userData.travail = (t) => {
    p.chariot.position.x = -0.6 + 1.2 * vague(t);
    const k = lisse(borne(t, 0.2, 0.8));
    bs.forEach((b, i) => b.scale.setScalar(hauteurs[i] + (triees[i] - hauteurs[i]) * k));
  };
  g.userData.repos = () => { bs.forEach((b, i) => b.scale.setScalar(hauteurs[i])); };
}

// Rayonnage (créer une liste) : des cases numérotées 0, 1, 2… et une case « + » au bout ; les cases s'allument tour à tour.
function rayonnage(g) {
  boite(g, 1.5, 0.12, 0.5, M.acier, 0, 0.2, 0.1, 0.02);
  boite(g, 1.5, 0.9, 0.06, M.acierSombre, 0, 0.7, -0.17);
  const voyants = [];
  for (let i = 0; i < 5; i++) {
    const x = -0.6 + i * 0.3;
    if (i < 4) { boite(g, 0.04, 0.85, 0.42, M.teal, x + 0.15, 0.7, 0.05); const n = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.13), numero(i)); n.position.set(x, 1.05, -0.13); g.add(n); }
    const v = boite(g, 0.22, 0.03, 0.3, lampe(0x2a4a52), x, 0.27, 0.08); voyants.push(v);
  }
  const plus = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), icone("plus", "#ffc857")); plus.position.set(0.6, 0.85, -0.13); g.add(plus);
  boite(g, 1.6, 0.1, 0.5, M.teal, 0, 1.2, 0.05, 0.03);
  g.userData.hautVoyant = 1.45;
  const allumer = (v, on) => { v.material.color.setHex(on ? 0xffc857 : 0x2a4a52); v.material.emissive.setHex(on ? 0xffb020 : 0x2a4a52); };
  g.userData.travail = (t) => voyants.forEach((v, i) => allumer(v, t * 5 > i));
  g.userData.repos = () => voyants.forEach((v) => allumer(v, false));
}

// Vitrine scellée (tuple) : une caisse de verre aux cases numérotées, fermée par un cadenas. Ouverte : décomposer un tuple.
function vitrine(g, ouvre) {
  boite(g, 1.3, 0.22, 0.8, M.teal, 0, 0.24, 0, 0.04);
  for (let i = 0; i < 3; i++) {
    const x = -0.4 + i * 0.4;
    cylindre(g, 0.13, 0.13, 0.1, M.acier, x, 0.4, 0, 16);
    const b = bouteille(); b.position.set(x, 0.45, 0); g.add(b);
    const n = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.12), numero(i)); n.position.set(x, 0.24, 0.405); g.add(n);
  }
  const capot = new THREE.Group(); capot.position.y = 0.35; g.add(capot);
  boite(capot, 1.26, 0.7, 0.76, M.verre, 0, 0.36, 0).castShadow = false;
  for (const [x, z] of [[-0.62, -0.37], [0.62, -0.37], [-0.62, 0.37], [0.62, 0.37]]) boite(capot, 0.05, 0.72, 0.05, M.acier, x, 0.36, z);
  boite(capot, 1.3, 0.05, 0.8, M.acier, 0, 0.72, 0);
  const cadenas = new THREE.Group(); cadenas.position.set(0, 0.2, 0.44); g.add(cadenas);
  boite(cadenas, 0.2, 0.16, 0.06, M.jaune, 0, 0, 0, 0.02);
  const anse = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 6, 12, Math.PI), M.acier); anse.position.y = 0.08; cadenas.add(anse);
  g.userData.hautVoyant = 1.35;
  g.userData.travail = (t) => {
    if (ouvre) { const k = vague(t); capot.position.y = 0.35 + 0.5 * k; anse.position.y = 0.08 + 0.05 * k; }
    else { const k = 1 - lisse(borne(t, 0, 0.6)); capot.position.y = 0.35 + 0.5 * k; anse.position.y = 0.08 + 0.06 * k; }
  };
  g.userData.repos = () => { capot.position.y = 0.35; anse.position.y = 0.08; };
}

// Casiers (dictionnaire, get) : une armoire de casiers étiquetés ; le bras à loupe ouvre le bon casier.
function casiers(g) {
  boite(g, 1.0, 1.25, 0.6, M.acierSombre, 0.25, 0.75, -0.2, 0.03);
  const portes = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) {
    const pivot = new THREE.Group(); pivot.position.set(0.25 - 0.47 + c * 0.47, 1.15 - r * 0.38, 0.11); g.add(pivot);
    boite(pivot, 0.44, 0.34, 0.04, M.teal, 0.22, 0, 0, 0.02);
    boite(pivot, 0.22, 0.08, 0.01, M.mousse, 0.22, 0.05, 0.025);
    cylindre(pivot, 0.025, 0.025, 0.03, M.capsule, 0.22, -0.07, 0.03, 8).rotation.x = Math.PI / 2;
    portes.push(pivot);
  }
  boite(g, 0.5, 0.05, 0.08, lampe(VERT), 0.25, 1.4, 0.0);
  cylindre(g, 0.18, 0.22, 0.18, M.sombre, -0.55, 0.21, 0.4, 16);
  const bras = new THREE.Group(); bras.position.set(-0.55, 0.3, 0.4); g.add(bras);
  boite(bras, 0.1, 0.6, 0.1, M.teal, 0, 0.3, 0, 0.03);
  const avant = new THREE.Group(); avant.position.y = 0.6; bras.add(avant);
  boite(avant, 0.42, 0.08, 0.08, M.teal, 0.2, 0, 0, 0.02);
  ecran(avant, "loupe", 0.16, 0.44, 0.0, 0.05);
  const porte = portes[2];
  g.userData.hautVoyant = 1.6;
  g.userData.travail = (t) => { porte.rotation.y = -1.2 * vague(t); bras.rotation.y = -0.6 * vague(t); avant.rotation.z = -0.3 * vague(t); };
  g.userData.repos = (ms) => { bras.rotation.y = 0.1 * Math.sin(ms * 0.0006 + g.userData.phase); porte.rotation.y = 0; avant.rotation.z = 0; };
}

// Cuve à capsules (set, add) : la cuve tourne ; un doublon glisse sur la goulotte de rejet, vers la croix rouge.
function ensembles(g) {
  for (const [x, z] of [[-0.32, -0.42], [0.32, -0.42], [-0.32, 0.22], [0.32, 0.22]]) cylindre(g, 0.05, 0.06, 0.45, M.acier, x, 0.34, z, 8);
  const cuve = new THREE.Group(); cuve.position.set(0, 0.6, -0.1); g.add(cuve);
  const paroi = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.42, 0.42, 28, 1, true), M.inox.clone()); paroi.material.side = THREE.DoubleSide; paroi.position.y = 0.2; paroi.castShadow = true; cuve.add(paroi);
  cylindre(cuve, 0.42, 0.42, 0.04, M.sombre, 0, 0, 0, 28);
  const capsules = new THREE.Group(); cuve.add(capsules);
  for (let i = 0; i < 14; i++) { const a = i * 2.4, r = 0.12 + (i % 4) * 0.1; const c = cylindre(capsules, 0.07, 0.07, 0.025, i % 3 ? M.capsule : M.tealClair, Math.cos(a) * r, 0.05 + (i % 2) * 0.03, Math.sin(a) * r, 12); c.rotation.set(0.2 * (i % 3), 0, 0.15 * (i % 2)); }
  ecran(g, "ensemble", 0.3, -0.25, 0.62, 0.55);
  const goulotte = boite(g, 0.24, 0.04, 0.6, M.acier, 0.5, 0.42, 0.35); goulotte.rotation.x = 0.35;
  boite(g, 0.32, 0.22, 0.12, M.rouge, 0.5, 0.15, 0.68, 0.03);
  const croix = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), icone("croix", "#ffffff")); croix.position.set(0.5, 0.15, 0.745); g.add(croix);
  const rejet = cylindre(g, 0.07, 0.07, 0.025, M.capsule, 0.5, 0.55, 0.12, 12); rejet.visible = false;
  g.userData.hautVoyant = 1.4;
  g.userData.travail = (t) => {
    capsules.rotation.y = t * Math.PI * 2;
    rejet.visible = t > 0.4 && t < 0.95;
    const k = borne(t, 0.4, 0.95); rejet.position.set(0.5, 0.55 - 0.35 * k, 0.12 + 0.5 * k);
  };
  g.userData.repos = (ms) => { capsules.rotation.y = ms * 0.0003; rejet.visible = false; };
}

// Trieur (if, elif) : un portique bleu-vert à écran sur le rail principal. Condition vraie : voyant vert, le bras d'aiguillage
// pousse la bouteille vers sa voie, au fond. Fausse : voyant rouge, la bouteille continue tout droit.
// Les modules du panneau montrent la logique de la condition : and, or, not.
function trieur(g, m) {
  tapisMachine(g, 1.6, 0, 0.3, 0.1, 0.6);
  for (const x of [-0.65, 0.65]) boite(g, 0.08, 0.26, 0.08, M.acier, x, 0.15, 0.1);
  for (const z of [-0.32, 0.52]) boite(g, 0.16, 1.3, 0.16, M.cuivre, -0.15, 0.85, z, 0.04);
  boite(g, 0.24, 0.32, 1.05, M.teal, -0.15, 1.58, 0.1, 0.05);
  const condition = (m && m.condition) || "";
  const logique = [...condition.matchAll(/\b(and|or|not)\b/g)].map((x) => ({ and: "et", or: "ou", not: "non" })[x[1]]);
  const modules = (logique.length ? logique : ["si"]).slice(0, 3);
  // le panneau de la condition, face à la caméra : un module par opérateur logique
  boite(g, 0.32 * modules.length + 0.14, 0.38, 0.06, M.acierSombre, -0.15, 1.58, 0.66, 0.02);
  modules.forEach((nom, i) => ecran(g, nom, 0.26, -0.15 + (i - (modules.length - 1) / 2) * 0.32, 1.58, 0.7, "#ffc857"));
  const voyant = new THREE.Mesh(new THREE.SphereGeometry(0.08, 14, 10), lampe(VERT)); voyant.position.set(-0.15, 1.82, 0.1); g.add(voyant);
  cylindre(g, 0.08, 0.08, 0.05, M.sombre, -0.15, 1.76, 0.1, 12);
  const pivot = new THREE.Group(); pivot.position.set(0.35, 0.42, 0.42); g.add(pivot);
  cylindre(pivot, 0.06, 0.06, 0.18, M.sombre, 0, 0, 0, 12);
  boite(pivot, 0.62, 0.14, 0.04, M.orange, -0.3, 0, 0, 0.02);
  const passe = bouteille(); passe.visible = false; g.add(passe);
  g.userData.hautVoyant = 0;
  const couleur = (c) => { voyant.material.color.setHex(c); voyant.material.emissive.setHex(c); };
  g.userData.travail = (t, info = {}) => {
    const prend = !!info.prend;
    couleur(t < 0.25 ? 0xffc857 : prend ? VERT : ROUGE);
    voyant.material.emissiveIntensity = 1.2 + 1.5 * vague(borne(t, 0.2, 0.7));
    passe.visible = t < 0.95;
    const k = lisse(borne(t, 0, 0.9));
    if (prend) { pivot.rotation.y = 0.9 * vague(borne(t, 0.3, 1)); passe.position.set(-0.6 + 0.9 * Math.min(1, k * 1.6), 0.34, 0.1 - 0.8 * borne(t, 0.45, 0.9)); }
    else { pivot.rotation.y = 0; passe.position.set(-0.6 + 1.3 * k, 0.34, 0.1); }
  };
  g.userData.repos = (ms) => { couleur(VERT); voyant.material.emissiveIntensity = 0.7 + 0.3 * Math.sin(ms * 0.003 + g.userData.phase); passe.visible = false; pivot.rotation.y = 0; };
}

// Distributeur (for) : la tourelle prend les bouteilles de la caisse d'entrée et les envoie une par une ; flèches orange en couronne.
function distributeur(g) {
  boite(g, 0.5, 0.06, 0.5, M.bois, -0.52, 0.16, 0.42);
  for (const [x, z, w, d] of [[-0.52, 0.18, 0.5, 0.04], [-0.52, 0.66, 0.5, 0.04], [-0.76, 0.42, 0.04, 0.5], [-0.28, 0.42, 0.04, 0.5]]) boite(g, w, 0.2, d, M.bois, x, 0.27, z);
  for (let i = 0; i < 4; i++) { const b = bouteille(0.85); b.position.set(-0.62 + (i % 2) * 0.2, 0.19, 0.32 + Math.floor(i / 2) * 0.2); g.add(b); }
  cylindre(g, 0.55, 0.6, 0.3, M.acierSombre, 0.15, 0.27, -0.2, 28);
  const plateau = new THREE.Group(); plateau.position.set(0.15, 0.44, -0.2); g.add(plateau);
  cylindre(plateau, 0.55, 0.55, 0.05, M.inox, 0, 0, 0, 28);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const b = bouteille(0.9); b.position.set(Math.cos(a) * 0.42, 0.03, Math.sin(a) * 0.42); plateau.add(b); }
  cylindre(g, 0.18, 0.2, 0.55, M.inox, 0.15, 0.75, -0.2, 18);
  cylindre(g, 0.45, 0.45, 0.08, M.inox, 0.15, 1.05, -0.2, 28);
  const fleches = new THREE.Group(); fleches.position.set(0.15, 1.12, -0.2); g.add(fleches);
  for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.035, 6, 16, 1.4), M.orange); f.rotation.set(Math.PI / 2, 0, (i / 3) * Math.PI * 2); fleches.add(f); }
  let cran = 0;
  g.userData.hautVoyant = 1.35;
  g.userData.travail = (t, info = {}) => {
    const c = info.repos ? info.cran : cran;
    fleches.rotation.y = -(c + t) * 1.2;
    if (info.dedans === false) return;
    plateau.rotation.y = -(c + lisse(t)) * (Math.PI / 4);
    if (t >= 1 && !info.repos) cran++;
  };
  g.userData.repos = () => {};
}

// Caisse de sortie (fin d'un for) : elle reçoit une bouteille par tour, puis repart pleine.
function collecteur(g) {
  boite(g, 0.9, 0.3, 0.7, M.acier, 0, 0.15, 0, 0.03);
  boite(g, 0.8, 0.06, 0.6, M.bois, 0, 0.33, 0);
  for (const [x, z, w, d] of [[0, -0.28, 0.8, 0.04], [0, 0.28, 0.8, 0.04], [-0.38, 0, 0.04, 0.6], [0.38, 0, 0.04, 0.6]]) boite(g, w, 0.24, d, M.bois, x, 0.46, z);
  const contenu = new THREE.Group(); contenu.position.y = 0.36; g.add(contenu);
  g.userData.remplir = (k) => {
    contenu.clear();
    for (let i = 0; i < Math.min(12, k); i++) { const b = bouteille(0.8); b.position.set(-0.3 + (i % 4) * 0.2, 0, -0.15 + Math.floor(i / 4) * 0.15); contenu.add(b); }
  };
  g.userData.hautVoyant = 0;
  g.userData.travail = (t) => { contenu.position.y = 0.36 + 0.05 * vague(t); };
  g.userData.repos = () => {};
}

// Cuve à boucle (while) : la bouteille fait le tour de la cuve tant que la condition est vraie.
// Gyrophare rouge : l'aiguillage est fermé, encore un tour. Vert : il s'ouvre, la bouteille sort.
function cuveBoucle(g) {
  const piste = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.09, 6, 36), M.caoutchouc); piste.rotation.x = Math.PI / 2; piste.position.y = 0.26; g.add(piste);
  const bord = new THREE.Mesh(new THREE.TorusGeometry(0.69, 0.025, 6, 36), M.acier); bord.rotation.x = Math.PI / 2; bord.position.y = 0.3; g.add(bord);
  const tourne = new THREE.Group(); tourne.position.y = 0.3; g.add(tourne);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; const b = bouteille(0.8); b.position.set(Math.cos(a) * 0.58, 0, Math.sin(a) * 0.58); tourne.add(b); }
  for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.03, 4, 8, 0.5), M.orange); f.rotation.set(Math.PI / 2, 0, (i / 4) * Math.PI * 2 + 0.4); f.position.y = 0.33; g.add(f); }
  cylindre(g, 0.3, 0.3, 0.7, M.inox, 0, 0.75, 0, 24);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.inox); dome.position.y = 1.1; g.add(dome);
  const hublot = new THREE.Mesh(new THREE.CircleGeometry(0.14, 20), M.biere); hublot.position.set(0, 0.75, 0.305); g.add(hublot);
  tube(g, [[0, 1.38, 0], [0, 1.55, 0], [-0.5, 1.55, 0], [-0.62, 1.2, 0], [-0.62, 0.5, 0]], 0.04, M.cuivre);
  boite(g, 0.28, 0.4, 0.2, M.sombre, 0.55, 0.5, 0.62, 0.03);
  const gyro = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.18, 14), lampe(ROUGE)); gyro.position.set(0.55, 0.8, 0.62); g.add(gyro);
  const aiguillage = new THREE.Group(); aiguillage.position.set(0.25, 0.34, 0.55); g.add(aiguillage);
  boite(aiguillage, 0.06, 0.12, 0.45, M.jaune, 0, 0, -0.2, 0.02);
  let angle = 0;
  g.userData.hautVoyant = 0;
  const couleur = (c) => { gyro.material.color.setHex(c); gyro.material.emissive.setHex(c); };
  g.userData.travail = (t, info = {}) => {
    const encore = info.vrai !== false;
    couleur(encore ? ROUGE : VERT);
    gyro.material.emissiveIntensity = 1.4 + 1.4 * Math.abs(Math.sin(t * 18));
    angle += 0.05; tourne.rotation.y = -angle;
    aiguillage.rotation.y = encore ? 0 : -1.1 * lisse(borne(t, 0, 0.5));
  };
  g.userData.repos = (ms) => { couleur(ROUGE); gyro.material.emissiveIntensity = 0.6; tourne.rotation.y = -angle - ms * 0.0004; aiguillage.rotation.y = 0; };
}

// Imprimante (print) : l'écran s'allume, une feuille imprimée sort de la fente, se détache et tombe dans le bac.
let PAGE = null;
function matPage() {
  if (PAGE) return PAGE;
  const t = document.createElement("canvas"); t.width = 128; t.height = 176; const c = t.getContext("2d");
  c.fillStyle = "#f6f2e8"; c.fillRect(0, 0, 128, 176);
  c.fillStyle = "#3a3a3a"; for (let i = 0; i < 9; i++) c.fillRect(14, 18 + i * 14, i % 3 === 2 ? 60 : 96, 5);
  c.strokeStyle = "#8a5a22"; c.lineWidth = 5; c.strokeRect(80, 128, 30, 34); c.beginPath(); c.arc(112, 145, 9, -1.4, 1.4); c.stroke();
  const tex = new THREE.CanvasTexture(t); tex.colorSpace = THREE.SRGBColorSpace;
  PAGE = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, side: THREE.DoubleSide });
  return PAGE;
}
function imprimante(g) {
  boite(g, 0.9, 0.95, 0.7, M.acier, 0, 0.6, -0.2, 0.06);
  boite(g, 0.94, 0.12, 0.74, M.cuivre, 0, 1.1, -0.2, 0.04);
  const ec = ecran(g, "ticket", 0.36, 0, 0.82, 0.16);
  boite(g, 0.66, 0.08, 0.14, M.sombre, 0, 0.42, 0.18);
  // la feuille : elle sort de la fente (en haut), puis tombe à plat dans le bac (devant)
  const feuille = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.68), matPage()); feuille.geometry.translate(0, -0.34, 0); g.add(feuille);
  const bac = new THREE.Group(); bac.position.set(0, 0.16, 0.55); g.add(bac);
  boite(bac, 0.7, 0.04, 0.6, M.acierSombre, 0, 0, 0);
  for (const [x, z, w, d] of [[0, -0.3, 0.7, 0.03], [0, 0.3, 0.7, 0.03], [-0.35, 0, 0.03, 0.6], [0.35, 0, 0.03, 0.6]]) boite(bac, w, 0.1, d, M.cuivre, x, 0.05, z);
  const pile = new THREE.Group(); bac.add(pile);
  for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), matPage()); f.rotation.x = -Math.PI / 2; f.rotation.z = (i - 1) * 0.12; f.position.y = 0.03 + i * 0.008; pile.add(f); }
  const voyant = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), lampe(VERT)); voyant.position.set(0.34, 1.02, 0.16); g.add(voyant);
  g.userData.hautVoyant = 1.45;
  const poser = (t) => {
    const sort = lisse(borne(t, 0.1, 0.6)), chute = lisse(borne(t, 0.65, 0.95));
    feuille.visible = t > 0.08 && t < 0.98;
    // sortie : la feuille descend de la fente, presque verticale ; chute : elle bascule à plat dans le bac
    feuille.scale.y = Math.max(0.02, sort);
    feuille.position.set(0, 0.46 - 0.05 * chute + (0.16 - 0.46) * chute, 0.24 + 0.32 * chute);
    feuille.rotation.x = -0.25 - (Math.PI / 2 - 0.25) * chute;
    ec.material.emissiveIntensity = 0.55 + 1.2 * vague(borne(t, 0, 0.6));
    voyant.material.emissiveIntensity = t < 0.6 ? 2.5 : 1.2;
  };
  g.userData.travail = poser;
  g.userData.repos = () => { feuille.visible = false; ec.material.emissiveIntensity = 0.55; };
}

// Retour (return) : la commande entre dans le sas, remonte le tube de verre, la flèche de retour s'allume.
function retour(g) {
  boite(g, 0.85, 0.7, 0.75, M.acier, 0.25, 0.45, 0, 0.05);
  boite(g, 0.89, 0.1, 0.79, M.teal, 0.25, 0.85, 0, 0.03);
  for (const z of [-0.4, 0.4]) boite(g, 0.3, 0.06, 0.08, M.jaune, 0.25, 0.15, z);
  const ec = ecran(g, "retour", 0.34, 0.25, 0.5, 0.38, "#ffd27a");
  boite(g, 0.5, 0.22, 0.5, M.acierSombre, -0.45, 0.22, 0.1, 0.04);
  const points = [[-0.45, 0.33, 0.1], [-0.45, 1.25, 0.1], [-0.2, 1.55, 0.05], [0.2, 1.55, 0.0], [0.25, 0.9, 0.0]];
  tube(g, points, 0.13, M.verre).castShadow = false;
  const chemin = courbe(points);
  const colis = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), M.capsule); colis.visible = false; g.add(colis);
  g.userData.hautVoyant = 1.75;
  g.userData.travail = (t) => { colis.visible = t < 0.95; colis.position.copy(chemin.getPoint(lisse(t))); ec.material.emissiveIntensity = 0.55 + 1.2 * borne(t, 0.6, 1); };
  g.userData.repos = () => { colis.visible = false; ec.material.emissiveIntensity = 0.55; };
}

// Arrêt de boucle (break) : le levier tombe, le gyrophare rouge s'allume ; la bouteille quitte la boucle par le tube aérien.
function arret(g) {
  tapisMachine(g, 1.5, 0, 0.3, 0.35);
  boite(g, 0.55, 0.85, 0.45, M.acier, 0, 0.55, -0.3, 0.05);
  for (const y of [0.3, 0.8]) boite(g, 0.56, 0.06, 0.02, M.jaune, 0, y, -0.07);
  ecran(g, "alerte", 0.26, 0, 0.56, -0.05, "#ffc857");
  const gyro = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.18, 14), lampe(ROUGE)); gyro.position.set(0, 1.07, -0.3); g.add(gyro);
  const levier = new THREE.Group(); levier.position.set(0.3, 0.85, -0.3); g.add(levier);
  cylindre(levier, 0.03, 0.03, 0.5, M.acier, 0, 0.25, 0, 8);
  const pommeau = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), M.rouge); pommeau.position.y = 0.52; levier.add(pommeau);
  levier.rotation.z = -0.5;
  g.userData.hautVoyant = 0;
  g.userData.travail = (t) => { levier.rotation.z = -0.5 + 1.3 * lisse(borne(t, 0, 0.3)); gyro.material.emissiveIntensity = 1 + 2.5 * Math.abs(Math.sin(t * 20)); };
  g.userData.repos = () => { levier.rotation.z = -0.5; gyro.material.emissiveIntensity = 0.4; };
}

// Tremplin (continue) : la bouteille saute le reste du tour et repart au début de la boucle.
function tremplin(g) {
  const points = [[-0.7, 0.3, 0.1], [-0.2, 0.75, 0.1], [0.3, 0.9, 0.1], [0.7, 0.75, 0.1]];
  tube(g, points, 0.06, M.acier);
  for (const x of [-0.3, 0.2, 0.6]) boite(g, 0.08, 0.7, 0.08, M.acierSombre, x, 0.4, 0.1);
  boite(g, 0.8, 0.5, 0.08, M.teal, 0.1, 0.42, -0.25, 0.03);
  ecran(g, "boucle", 0.3, 0.1, 0.45, -0.2);
  const capsule = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.03, 12), M.capsule); capsule.visible = false; g.add(capsule);
  const chemin = courbe([[-0.7, 0.4, 0.1], [-0.2, 0.85, 0.1], [0.3, 1.0, 0.1], [0.8, 1.6, 0.1]]);
  g.userData.hautVoyant = 0;
  g.userData.travail = (t) => { capsule.visible = t < 0.95; capsule.position.copy(chemin.getPoint(t)); capsule.rotation.z = t * 8; };
  g.userData.repos = () => { capsule.visible = false; };
}

// Plaque « pass » : un tapis qui ne fait rien, plaque vierge.
function plaque(g) {
  tapisMachine(g, 1.4, 0, 0.3, 0.05, 0.7);
  for (const x of [-0.6, 0.6]) boite(g, 0.1, 0.26, 0.6, M.teal, x, 0.15, 0.05);
  boite(g, 0.6, 0.18, 0.03, M.acier, 0, 0.18, 0.42);
  g.userData.hautVoyant = 0;
  g.userData.travail = () => {}; g.userData.repos = () => {};
}

// Jonction (fin d'un if) : les voies se rebranchent sur le rail principal.
function jonction(g) {
  cylindre(g, 0.36, 0.4, 0.18, M.teal, 0, 0.12, 0, 6);
  const ec = new THREE.Mesh(new THREE.CircleGeometry(0.22, 6), icone("fleche")); ec.rotation.x = -Math.PI / 2; ec.position.y = 0.215; g.add(ec);
  g.userData.hautVoyant = 0;
  g.userData.travail = () => {}; g.userData.repos = () => {};
}

// Établi (une ligne que l'usine ne représente pas encore) : elle tourne, sans machine dédiée.
function etabli(g) {
  boite(g, 1.2, 0.08, 0.8, M.bois, 0, 0.82, 0);
  for (const [x, z] of [[-0.52, -0.32], [0.52, -0.32], [-0.52, 0.32], [0.52, 0.32]]) boite(g, 0.08, 0.78, 0.08, M.acierSombre, x, 0.43, z);
  const caisse = boite(g, 0.5, 0.26, 0.3, M.teal, -0.2, 0.99, 0, 0.03);
  const cle = boite(g, 0.42, 0.04, 0.06, M.acier, 0.3, 0.88, 0.1); cle.rotation.y = 0.4;
  g.userData.hautVoyant = 1.4;
  g.userData.travail = (t) => { caisse.position.y = 0.99 + 0.08 * vague(t); cle.rotation.y = 0.4 + 2 * t; };
  g.userData.repos = () => {};
}

// Livraison (import) : une palette de caisses estampillées arrive par le monte-charge ; la bibliothèque est à disposition.
function livraison(g) {
  boite(g, 1.3, 0.1, 1.0, M.bois, -0.1, 0.17, 0.1);
  const caisses = new THREE.Group(); caisses.position.set(-0.1, 0.22, 0.1); g.add(caisses);
  for (const [x, y, z] of [[-0.3, 0, -0.2], [0.3, 0, -0.2], [-0.3, 0, 0.25], [0.3, 0, 0.25], [0, 0.42, 0]]) boite(caisses, 0.5, 0.4, 0.42, M.bois, x, y + 0.2, z, 0.02);
  for (const x of [-0.72, 0.62]) boite(g, 0.1, 1.9, 0.1, M.cuivre, x, 1.0, -0.45, 0.02);
  boite(g, 1.45, 0.12, 0.14, M.cuivre, -0.05, 1.95, -0.45, 0.03);
  const crochet = new THREE.Group(); crochet.position.set(-0.1, 1.88, -0.2); g.add(crochet);
  cylindre(crochet, 0.015, 0.015, 0.8, M.acierSombre, 0, -0.4, 0, 6);
  ecran(g, "import", 0.34, 0.45, 1.3, -0.36);
  g.userData.hautVoyant = 2.15;
  g.userData.travail = (t) => { caisses.position.y = 0.22 + 1.2 * (1 - lisse(borne(t, 0, 0.7))); crochet.children[0].scale.y = 0.4 + (1 - lisse(borne(t, 0, 0.7))) * 1.2; };
  g.userData.repos = () => { caisses.position.y = 0.22; };
}

// Sas (try, with, match, class…) : un portique à volet. La partie qui s'exécute ouvre son sas : le volet remonte.
// L'icône dit le genre : try (alerte), with (porte), match (aiguillage), class (plan), for/while (boucle).
function sas(g, m) {
  for (const x of [-0.55, 0.55]) boite(g, 0.16, 1.5, 0.5, M.cuivre, x, 0.85, 0, 0.04);
  boite(g, 1.4, 0.26, 0.56, M.teal, 0, 1.68, 0, 0.05);
  const volet = boite(g, 0.94, 1.2, 0.06, M.acierSombre, 0, 0.8, 0.0);
  for (let k = 0; k < 5; k++) boite(volet, 0.96, 0.02, 0.08, M.acier, 0, -0.5 + k * 0.25, 0);
  tapisMachine(g, 1.6, 0, 0.3, 0.1, 0.55);
  const genre = (m && m.genre) || "try";
  const nom = { try: "alerte", with: "porte", match: "si", class: "plan", for: "boucle", while: "boucle" }[genre] || "si";
  ecran(g, nom === "porte" ? "with" : nom === "plan" ? "class" : nom, 0.3, 0, 1.68, 0.3);
  g.userData.hautVoyant = 1.95;
  g.userData.travail = (t) => { const k = vague(t); volet.position.y = 0.8 + 0.9 * k; volet.scale.y = 1 - 0.7 * k; };
  g.userData.repos = () => { volet.position.y = 0.8; volet.scale.y = 1; };
}

// Atelier fermé (une section du programme, repliée) : un bâtiment d'aluminium au toit de cuivre ; ses machines sont dedans.
// Un clic l'ouvre : ses machines reprennent leur place sur la ligne.
function atelier(g) {
  boite(g, 1.4, 0.95, 1.2, M.teal, 0, 0.6, -0.05, 0.05);
  for (const [x, z] of [[-0.7, -0.65], [0.7, -0.65], [-0.7, 0.55], [0.7, 0.55]]) boite(g, 0.1, 1.0, 0.1, M.cuivre, x, 0.6, z, 0.02);
  const toit = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 1.5, 3, 1), M.cuivre); toit.rotation.set(0, 0, Math.PI / 2); toit.rotation.y = Math.PI / 2;
  toit.scale.set(1, 1, 0.55); toit.position.set(0, 1.25, -0.05); toit.castShadow = true; g.add(toit);
  boite(g, 0.5, 0.7, 0.05, M.sombre, -0.35, 0.45, 0.56);
  const ec = ecran(g, "≡", 0.32, 0.35, 0.65, 0.57);
  for (let i = 0; i < 3; i++) { const b = bouteille(0.8); b.position.set(0.15 + i * 0.18, 0.13, 0.75); g.add(b); }
  g.userData.hautVoyant = 1.85;
  g.userData.travail = (t) => { ec.material.emissiveIntensity = 0.55 + vague(t); };
  g.userData.repos = () => { ec.material.emissiveIntensity = 0.55; };
}

// Enseigne (une section ouverte) : un panneau sur deux montants ; un clic replie la section.
function enseigne(g) {
  for (const x of [-0.5, 0.5]) boite(g, 0.08, 1.4, 0.08, M.cuivre, x, 0.75, 0, 0.02);
  boite(g, 1.2, 0.5, 0.06, M.teal, 0, 1.3, 0, 0.03);
  ecran(g, "▾", 0.3, -0.38, 1.3, 0.04);
  g.userData.hautVoyant = 0;
  g.userData.travail = () => {}; g.userData.repos = () => {};
}

// Poste d'appel (une ligne qui appelle une fonction du programme) : une maquette du module, reliée à lui par un tube.
function appel(g) {
  boite(g, 1.2, 0.85, 1.0, M.teal, 0, 0.55, -0.1, 0.06);
  for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.4], [0.6, 0.4]]) boite(g, 0.1, 0.9, 0.1, M.cuivre, x, 0.55, z, 0.02);
  boite(g, 1.3, 0.1, 1.1, M.acierSombre, 0, 1.02, -0.1, 0.03);
  const cheminee = cylindre(g, 0.12, 0.16, 0.25, M.cuivre, 0.25, 1.2, -0.2, 14);
  const ec = ecran(g, "f( )", 0.36, 0, 0.6, 0.42, "#ffd27a");
  boite(g, 0.3, 0.3, 0.3, M.cuivre, 0.72, 0.5, 0.2, 0.04);
  g.userData.hautVoyant = 1.45;
  g.userData.travail = (t) => { cheminee.scale.y = 1 + 0.4 * vague(t); ec.material.emissiveIntensity = 0.55 + vague(t); };
  g.userData.repos = () => { cheminee.scale.y = 1; ec.material.emissiveIntensity = 0.55; };
}

// Le bâtiment d'un module (def) : une halle bleu-vert rivetée, arêtes de cuivre, cheminée sur le toit (planche du formateur).
// Fermé, c'est un bâtiment compact : on voit la façade, le nom, la boîte d'entrée. Ouvert, il s'agrandit jusqu'à son emprise,
// le toit se soulève et s'efface, la façade se rabat : dedans, la ligne de la fonction et ses variables.
// Le groupe est posé au coin avant gauche de l'emprise { x1, x2, z1, z2 } : ce coin ne bouge pas quand le bâtiment s'agrandit.
export const MODULE_FERME = { L: 4.6, P: 3.6 };
export function fabriquerModule(boite, couleur) {
  const g = new THREE.Group();
  const L = boite.x2 - boite.x1, P = boite.z2 - boite.z1, H = 2.3, e = 0.16;
  g.userData.modele = "module";
  const coque = new THREE.Group(); g.add(coque);           // mise à l'échelle : compacte fermée, entière ouverte
  const b = (w, h, d, mat, x, y, z, r) => boite_(coque, w, h, d, mat, x, y, z, r);
  const teal = M.teal.clone(), cuivre = M.cuivre.clone();
  const tealToit = M.teal.clone(); tealToit.transparent = true;
  const cuivreToit = M.cuivre.clone(); cuivreToit.transparent = true;
  b(L, 0.08, P, M.acierSombre, L / 2, 0.04, -P / 2);
  b(L, H, e, teal, L / 2, H / 2, -P + e / 2);
  for (const x of [e / 2, L - e / 2]) b(e, H, P, teal, x, H / 2, -P / 2);
  for (const x of [0, L]) for (const z of [-P, 0]) b(0.22, H + 0.1, 0.22, cuivre, x, H / 2, z, 0.04);
  b(L + 0.2, 0.14, 0.24, cuivre, L / 2, H, -P);
  // la façade, qui se rabat vers l'avant
  const facade = new THREE.Group(); coque.add(facade);
  boite_(facade, L, H, e, teal, L / 2, H / 2, -e / 2);
  boite_(facade, L + 0.1, 0.14, 0.2, cuivre, L / 2, H, 0);
  boite_(facade, L + 0.1, 0.14, 0.2, cuivre, L / 2, 0.1, 0);
  // le toit, qui se soulève et s'efface
  const toit = new THREE.Group(); toit.position.set(0, H, -P); coque.add(toit);
  boite_(toit, L + 0.3, 0.22, P + 0.3, tealToit, L / 2, 0.11, P / 2, 0.05);
  for (const z of [0.06, P + 0.24]) boite_(toit, L + 0.34, 0.08, 0.12, cuivreToit, L / 2, 0.24, z);
  // ce qui ne se déforme pas : la porte, les lampes, la cheminée, posées sur la façade compacte
  const fixe = new THREE.Group(); g.add(fixe);
  const { L: Lc } = MODULE_FERME;
  boite_(fixe, 1.0, 1.4, 0.08, M.sombre, Lc - 1.0, 0.75, 0.06, 0.03);
  for (const x of [0.5, Lc - 1.8]) { const l = cylindre(fixe, 0.11, 0.11, 0.42, lampe(0xffb347), x, 1.6, 0.16, 12); l.material.emissiveIntensity = 1.6; }
  const cheminee = new THREE.Group(); g.add(cheminee);
  cylindre(cheminee, 0.32, 0.42, 0.5, cuivreToit, 0, 0.25, 0, 18);
  cylindre(cheminee, 0.4, 0.4, 0.1, cuivreToit, 0, 0.53, 0, 18);
  const bande = boite_(g, 2.6, 0.04, 0.1, new THREE.MeshStandardMaterial({ color: couleur, emissive: couleur, emissiveIntensity: 0.3 }), Lc / 2, 0.12, 0.16);
  // la boîte d'entrée (les paramètres), contre le flanc gauche ; elle ne bouge pas
  boite_(g, 0.7, 0.9, 0.5, M.cuivre, -0.45, 0.55, -1.2, 0.05);
  boite_(g, 0.58, 0.42, 0.06, M.sombre, -0.45, 0.67, -0.93);
  const cible = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), M.cible); cible.castShadow = false; g.add(cible);
  g.userData.corps = cible;
  g.userData.hautVoyant = 0;
  g.userData.entree = new THREE.Vector3(-0.45, 1.25, -0.9);          // au-dessus de la boîte d'entrée (pour l'afficheur)
  g.userData.surbrillance = (oui) => { bande.material.emissiveIntensity = oui ? 1.4 : 0.3; };
  // k : 0 fermé (compact), 1 ouvert (emprise entière). Renvoie la largeur et la profondeur visibles.
  g.userData.ouvrir = (k) => {
    const l = MODULE_FERME.L + (L - MODULE_FERME.L) * k, p = MODULE_FERME.P + (P - MODULE_FERME.P) * k;
    coque.scale.set(l / L, 1, p / P);
    toit.position.y = H + 1.2 * k; toit.rotation.x = -0.35 * k;
    tealToit.opacity = cuivreToit.opacity = 1 - 0.88 * k; tealToit.depthWrite = cuivreToit.depthWrite = k < 0.5;
    facade.rotation.x = 1.5 * k;
    fixe.visible = k < 0.3;
    cheminee.position.set(l * 0.7, H + 0.2 + 1.2 * k, -p / 2); cheminee.visible = k < 0.6;
    cible.scale.set(l, H + 0.3, p); cible.position.set(l / 2, (H + 0.3) / 2, -p / 2);
    return { l, p };
  };
  g.userData.ouvrir(0);
  g.userData.travail = () => {}; g.userData.repos = () => {};
  return g;
}
const boite_ = boite;

// ---------------------------------------------------------------- catalogue

// Le nom de chaque machine (barre de construction, réglage, inspecteur).
export const NOMS = {
  etiqueteuse: "Étiqueteuse", calculatrice: "Calculatrice", rayonnage: "Rayonnage", chargeur: "Chargeur", inserer: "Inséreuse",
  extracteur: "Extracteur", scanneur: "Scanner", copieur: "Copieur trié", trieurRayon: "Trieur de rayon", vitrine: "Vitrine scellée",
  ouvreuse: "Vitrine (ouverture)", casiers: "Casiers", ensembles: "Cuve à capsules", trieur: "Trieur", distributeur: "Distributeur",
  collecteur: "Caisse de sortie", cuveBoucle: "Cuve à boucle", imprimante: "Imprimante", retour: "Retour", arret: "Arrêt de boucle",
  tremplin: "Tremplin", plaque: "Plaque pass", jonction: "Jonction", etabli: "Établi", appel: "Poste d'appel", module: "Module",
  livraison: "Livraison (import)", sas: "Sas", atelier: "Atelier (section)", enseigne: "Enseigne",
};

const MODELE = {
  variable: "etiqueteuse", calcul: "calculatrice",
  creer_liste: "rayonnage", ajouter: "chargeur", remplacer_case: "inserer", retirer: "extracteur",
  lire_case: "scanneur", tranche: "scanneur", longueur: "scanneur", contient: "scanneur", trier_copie: "copieur", trier_sur_place: "trieurRayon",
  creer_tuple: "vitrine", decomposer: "ouvreuse",
  creer_dict: "casiers", lire_cle: "casiers", lire_get: "casiers", ecrire_cle: "casiers",
  creer_set: "ensembles", ajouter_set: "ensembles",
  si: "trieur", pour: "distributeur", collecteur: "collecteur", tantque: "cuveBoucle", afficher: "imprimante", renvoyer: "retour",
  sortir: "arret", suivant: "tremplin", passer: "plaque", groupeur: "jonction", appel: "appel",
  importer: "livraison", bloc: "sas", partie: "sas", section: "atelier", enseigne: "enseigne",
};
export const modeleDe = (type) => MODELE[type] || "etabli";

const FABRIQUES = {
  etiqueteuse, calculatrice, rayonnage, chargeur: (g) => chargeur(g, false), inserer: (g) => chargeur(g, true), extracteur, scanneur,
  copieur: (g) => copieur(g, false), trieurRayon: (g) => copieur(g, true), vitrine: (g) => vitrine(g, false), ouvreuse: (g) => vitrine(g, true),
  casiers, ensembles, trieur, distributeur, collecteur, cuveBoucle, imprimante, retour, arret, tremplin, plaque, jonction, etabli, appel, livraison, sas, atelier, enseigne,
};
const SANS_SOCLE = new Set(["jonction", "plaque", "collecteur", "enseigne"]);

// Construit la machine d'une instruction. couleur : la couleur de sa famille (bande du socle). m : la machine de la disposition.
export function fabriquerMachine(type, couleur, m = null) {
  const g = new THREE.Group();
  const modele = modeleDe(type);
  g.userData.phase = Math.random() * 6;
  g.userData.modele = modele;
  if (!SANS_SOCLE.has(modele)) socle(g, couleur);
  else g.userData.surbrillance = () => {};
  FABRIQUES[modele](g, m);
  // au repos, la machine rejoue son geste en boucle, plus lentement ; chacune a son propre décalage
  const periode = 3200 + (g.userData.phase % 1) * 1400;
  let tour = 0;
  g.userData.cycle = (ms) => {
    const brut = (ms + g.userData.phase * 1000) / periode, t = brut % 1, n = Math.floor(brut);
    if (n !== tour) tour = n;
    if (t < 0.6) g.userData.travail(t / 0.6, { prend: tour % 2 === 0, vrai: tour % 3 !== 2, dedans: true, cran: tour, repos: true });
    else g.userData.repos(ms);
  };
  const petit = SANS_SOCLE.has(modele);
  const cible = new THREE.Mesh(new THREE.BoxGeometry(1.6, petit ? 0.8 : 1.8, 1.6), M.cible);
  cible.position.y = petit ? 0.4 : 0.9; cible.castShadow = false; g.add(cible);
  g.userData.corps = cible;
  return g;
}
