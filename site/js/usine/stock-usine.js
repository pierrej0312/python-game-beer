// Le parc de stockage : chaque variable du programme a son contenant, rangé derrière la ligne (planches « Python Brewery ») :
// - une valeur simple (nombre, texte, booléen) : un casier étiqueté à son nom, l'objet posé dedans ;
// - une liste : un rayonnage de cases numérotées 0, 1, 2… et une case « + » ; un tuple : le même rayonnage sous vitrine cadenassée ;
// - un dictionnaire : une armoire de casiers, la clé écrite sur chaque porte ; un set : une cuve de capsules, sans ordre.
// Les objets parlent du type de chaque élément : bouteille pour un texte (même texte, même capsule), fût pour un nombre,
// jeton pour un booléen. La plaque au-dessus donne le nom, et de près la valeur.
import * as THREE from "three";
import { RoundedBoxGeometry } from "../../vendor/three/addons/RoundedBoxGeometry.js";
import { texteValeur } from "../commun/valeurs.js";

const CALQUE_ETIQUETTES = 1;
const CASES = 8;                                  // cases visibles d'une caisse (4 x 2)
export const ECART_BACS = 3.5;
const ECHELLE_BAC = 1.3;                          // contenants agrandis, comme les machines                    // place d'un contenant dans le parc

const M = {
  inox: new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 0.9, roughness: 0.22 }),
  acier: new THREE.MeshStandardMaterial({ color: 0x8d939c, metalness: 0.8, roughness: 0.35 }),
  sombre: new THREE.MeshStandardMaterial({ color: 0x2a2d35, metalness: 0.4, roughness: 0.55 }),
  bois: new THREE.MeshStandardMaterial({ color: 0xb07a45, roughness: 0.85 }),
  boisClair: new THREE.MeshStandardMaterial({ color: 0xcf9a62, roughness: 0.85 }),
  cuivre: new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.85, roughness: 0.3 }),
  verre: new THREE.MeshStandardMaterial({ color: 0x9cd6ff, roughness: 0.05, transparent: true, opacity: 0.3, depthWrite: false }),
  ambre: new THREE.MeshStandardMaterial({ color: 0xc9781a, roughness: 0.2, metalness: 0.1 }),
  film: new THREE.MeshStandardMaterial({ color: 0xf2f4f8, roughness: 0.2, transparent: true, opacity: 0.42, depthWrite: false }),
  sangle: new THREE.MeshStandardMaterial({ color: 0x8e2a2a, roughness: 0.6 }),
  jaune: new THREE.MeshStandardMaterial({ color: 0xf2b134, roughness: 0.5 }),
  vert: new THREE.MeshStandardMaterial({ color: 0x23ab67, roughness: 0.5 }),
  rouge: new THREE.MeshStandardMaterial({ color: 0xd9443a, roughness: 0.5 }),
  gris: new THREE.MeshStandardMaterial({ color: 0x6d7280, roughness: 0.7 }),
  cadran: new THREE.MeshStandardMaterial({ color: 0xf4efe2, roughness: 0.6 }),
  toile: new THREE.MeshStandardMaterial({ color: 0xd8c9a3, roughness: 0.95 }),
};
// Une capsule par texte : deux bouteilles du même texte ont la même couleur (utile pour repérer un doublon, un « in »).
const CAPSULES = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf1c40f, 0x9b59b6, 0x1abc9c, 0xe67e22, 0xecf0f1];
const matsCapsule = CAPSULES.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, metalness: 0.3 }));
function hachage(texte) { let h = 7; for (const ch of String(texte)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }

export const genreDe = (e) => (!e ? null : e.t === "list" ? "liste" : e.t === "tuple" ? "tuple" : e.t === "dict" ? "dict" : e.t === "set" || e.t === "frozenset" ? "set" : "valeur");

function poser(g, mesh, x, y, z) { mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh); return mesh; }
const boite = (g, w, h, d, mat, x, y, z, r = 0) => poser(g, new THREE.Mesh(r ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d), mat), x, y, z);
const cylindre = (g, rh, rb, h, mat, x, y, z, seg = 20) => poser(g, new THREE.Mesh(new THREE.CylinderGeometry(rh, rb, h, seg), mat), x, y, z);

// ---- la plaque : le nom et la valeur, toujours lisibles (dessinée par-dessus les effets, taille constante à l'écran) ----
function plaque(nom, valeur, couleur) {
  const toile = document.createElement("canvas"), c = toile.getContext("2d");
  const pNom = '700 26px "Barlow", "Segoe UI", sans-serif', pVal = '500 24px "JetBrains Mono", Consolas, monospace';
  c.font = pNom; const lNom = c.measureText(nom).width; c.font = pVal; const lVal = c.measureText(valeur).width;
  const w = Math.ceil(Math.max(lNom, lVal)) + 40, h = 84;
  toile.width = w; toile.height = h;
  c.fillStyle = "rgba(24,26,33,0.92)"; c.beginPath(); c.roundRect(2, 2, w - 4, h - 4, 12); c.fill();
  c.fillStyle = couleur; c.beginPath(); c.roundRect(2, 2, w - 4, 8, [12, 12, 0, 0]); c.fill();
  c.textBaseline = "middle";
  c.font = pNom; c.fillStyle = "#ffffff"; c.fillText(nom, 20, 30);
  c.font = pVal; c.fillStyle = "#ffd98a"; c.fillText(valeur, 20, 60);
  const tex = new THREE.CanvasTexture(toile); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, toneMapped: false }));
  s.layers.set(CALQUE_ETIQUETTES); s.renderOrder = 11;
  s.scale.set(w * 0.0085, h * 0.0085, 1);
  s.userData.pixels = { w, h, facteur: 0.92 };
  return s;
}
function plaqueNom(nom, couleur) {
  const toile = document.createElement("canvas"), c = toile.getContext("2d");
  const police = '700 26px "Barlow", "Segoe UI", sans-serif';
  c.font = police; const w = Math.ceil(c.measureText(nom).width) + 34, h = 46;
  toile.width = w; toile.height = h;
  c.fillStyle = "rgba(24,26,33,0.9)"; c.beginPath(); c.roundRect(2, 2, w - 4, h - 4, 10); c.fill();
  c.fillStyle = couleur; c.beginPath(); c.roundRect(2, 2, 8, h - 4, [10, 0, 0, 10]); c.fill();
  c.font = police; c.fillStyle = "#ffffff"; c.textBaseline = "middle"; c.fillText(nom, 18, h / 2 + 1);
  const tex = new THREE.CanvasTexture(toile); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, toneMapped: false }));
  s.layers.set(CALQUE_ETIQUETTES); s.renderOrder = 11; s.scale.set(w * 0.0085, h * 0.0085, 1);
  s.userData.pixels = { w, h, facteur: 0.85 };
  return s;
}
const COULEUR_GENRE = { valeur: "#4fc4a0", liste: "#f5b82e", tuple: "#ef8a6a", dict: "#f39ac0", set: "#9be08a" };

// ---- les objets rangés dans les caisses ----
function objet(e) {
  const g = new THREE.Group();
  const t = e ? e.t : "None";
  if (t === "str") {
    cylindre(g, 0.075, 0.075, 0.24, M.ambre, 0, 0.12, 0, 10);
    cylindre(g, 0.028, 0.05, 0.09, M.ambre, 0, 0.285, 0, 8);
    cylindre(g, 0.033, 0.033, 0.035, matsCapsule[hachage(e.v) % matsCapsule.length], 0, 0.345, 0, 8);
  } else if (t === "int" || t === "float") {
    cylindre(g, 0.1, 0.1, 0.18, t === "int" ? M.cuivre : M.inox, 0, 0.09, 0, 12);
    for (const y of [0.04, 0.14]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 14), M.sombre); r.rotation.x = Math.PI / 2; r.position.y = y; g.add(r); }
  } else if (t === "bool") {
    cylindre(g, 0.11, 0.11, 0.05, e.v ? M.vert : M.rouge, 0, 0.03, 0, 16);
  } else if (t === "list" || t === "tuple") {
    boite(g, 0.24, 0.14, 0.18, t === "tuple" ? M.film : M.boisClair, 0, 0.07, 0);
  } else if (t === "dict") {
    cylindre(g, 0.09, 0.09, 0.2, M.inox, 0, 0.1, 0, 12);
  } else if (t === "None") {
    cylindre(g, 0.08, 0.08, 0.02, M.gris, 0, 0.01, 0, 12);
  } else {
    poser(g, new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), M.toile), 0, 0.1, 0).scale.y = 0.8;
  }
  return g;
}

// ---------------------------------------------------------------- les contenants

// Les contenants suivent les planches « Python Brewery » : acier, montants de cuivre, plaques crème numérotées.
const TEAL = new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.88, roughness: 0.3 });     // montants de cuivre (pas de vert)
const ACIER_SOMBRE = new THREE.MeshStandardMaterial({ color: 0x5c626c, metalness: 0.8, roughness: 0.4 });
const NUMEROS = [];
const PLAQUES = new Map();
function plaqueTexte(texte, l = 128, h = 48) {
  const cle = `${texte}|${l}|${h}`;
  if (PLAQUES.has(cle)) return PLAQUES.get(cle);
  const t = document.createElement("canvas"); t.width = l; t.height = h; const c = t.getContext("2d");
  c.fillStyle = "#efe6d2"; c.fillRect(0, 0, l, h); c.strokeStyle = "#8a7a5a"; c.lineWidth = 3; c.strokeRect(1.5, 1.5, l - 3, h - 3);
  let taille = Math.round(h * 0.62); c.font = `700 ${taille}px "Barlow", "Segoe UI", sans-serif`;
  while (c.measureText(texte).width > l - 12 && taille > 10) { taille -= 2; c.font = `700 ${taille}px "Barlow", "Segoe UI", sans-serif`; }
  c.fillStyle = "#1d1d1d"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(texte, l / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(t); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 });
  PLAQUES.set(cle, mat);
  return mat;
}
const numero = (i) => (NUMEROS[i] ||= plaqueTexte(String(i), 64, 48));
function plaqueNomPeinte(g, nom, l, x, y, z) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(l, l * 0.3), plaqueTexte(nom, 256, 76)); m.position.set(x, y, z); g.add(m); return m;
}

// Valeur simple : un casier d'acier à montants bleu-vert, son nom sur la plaque, l'objet posé dedans (le « VARIABLE » des planches).
function casier(g, nom) {
  boite(g, 1.3, 0.1, 0.9, ACIER_SOMBRE, 0, 0.05, 0);
  boite(g, 1.1, 0.06, 0.8, M.acier, 0, 0.35, 0);
  boite(g, 1.1, 0.06, 0.8, M.acier, 0, 1.15, 0);
  boite(g, 1.1, 0.8, 0.04, ACIER_SOMBRE, 0, 0.75, -0.38);
  for (const [x, z] of [[-0.55, -0.38], [0.55, -0.38], [-0.55, 0.38], [0.55, 0.38]]) boite(g, 0.08, 1.15, 0.08, TEAL, x, 0.65, z);
  plaqueNomPeinte(g, nom, 0.8, 0, 1.08, 0.42);
  const contenu = new THREE.Group(); contenu.position.set(0, 0.38, 0); g.add(contenu);
  return {
    haut: 1.6,
    remplir(e, avant) {
      contenu.clear();
      if (!e || e.t === "None") return;
      // un texte : une bouteille par tranche de 6 lettres (3 au plus) ; un nombre : un fût ; un booléen : un jeton
      const n = e.t === "str" ? Math.min(3, 1 + Math.floor(e.v.length / 6)) : 1;
      for (let i = 0; i < n; i++) { const o = objet(e); o.scale.setScalar(1.5); o.position.set((i - (n - 1) / 2) * 0.28, 0, 0); if (avant) { o.scale.setScalar(0.01); o.userData.pousse = 0; } contenu.add(o); }
    },
    animer(dt) { contenu.children.forEach((o) => { if (o.userData.pousse !== undefined && o.userData.pousse < 1) { o.userData.pousse = Math.min(1, o.userData.pousse + dt / 260); const k = o.userData.pousse; o.scale.setScalar(1.5 * Math.max(0.01, k + 0.3 * Math.sin(Math.PI * k))); } }); },
  };
}

// Liste : un rayonnage de cases numérotées 0, 1, 2…, et une case « + » au bout, où append pose la suivante.
// Tuple : le même rayonnage sous une vitrine de verre, fermée par un cadenas : on lit, on ne change rien.
function rayon(g, nom, scelle) {
  const L = 2.1, P = 0.7;
  boite(g, L + 0.1, 0.12, P + 0.1, ACIER_SOMBRE, 0, 0.06, 0);
  boite(g, L, 0.06, P, M.acier, 0, 0.3, 0);
  boite(g, L, 0.7, 0.04, ACIER_SOMBRE, 0, 0.65, -P / 2 + 0.02);
  for (const x of [-L / 2, L / 2]) boite(g, 0.08, 1.0, 0.08, TEAL, x, 0.5, P / 2 - 0.04);
  plaqueNomPeinte(g, nom, 0.9, 0, 0.18, P / 2 + 0.06);
  const cases = new THREE.Group(); g.add(cases);
  const contenu = new THREE.Group(); contenu.position.y = 0.33; g.add(contenu);
  if (scelle) {
    boite(g, L + 0.04, 0.72, P + 0.04, M.verre, 0, 0.7, 0).castShadow = false;
    boite(g, L + 0.08, 0.05, P + 0.08, M.acier, 0, 1.07, 0);
    const cadenas = new THREE.Group(); cadenas.position.set(0, 0.95, P / 2 + 0.06); g.add(cadenas);
    boite(cadenas, 0.2, 0.16, 0.06, M.jaune, 0, 0, 0, 0.02);
    const anse = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 6, 12, Math.PI), M.acier); anse.position.y = 0.08; cadenas.add(anse);
  }
  const N = CASES;
  return {
    haut: 1.25,
    remplir(e, avant) {
      contenu.clear(); cases.clear();
      const elements = e && e.v ? e.v : [], n = Math.min(N, elements.length), total = n + (scelle ? 0 : 1);
      const pas = L / Math.max(4, total), x0 = -L / 2 + pas / 2;
      const ancien = avant && avant.v ? avant.v.length : 0;
      for (let i = 0; i < total; i++) {
        const x = x0 + i * pas;
        if (i < n) {
          const plaque = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(0.2, pas * 0.7), 0.14), numero(i)); plaque.position.set(x, 0.85, -P / 2 + 0.05); cases.add(plaque);
          if (i > 0) boite(cases, 0.03, 0.55, P - 0.1, TEAL, x - pas / 2, 0.6, 0);
          const o = objet(elements[i]); o.scale.setScalar(1.25); o.position.set(x, 0, 0.05);
          if (avant && i >= ancien) { o.scale.setScalar(0.01); o.userData.pousse = 0; }
          contenu.add(o);
        } else {
          // la case « + » : en pointillés, c'est là qu'arrive le prochain append
          const cadre = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(pas * 0.8, 0.5, P * 0.7)), new THREE.LineBasicMaterial({ color: 0xffc857 }));
          cadre.position.set(x, 0.6, 0); cases.add(cadre);
          const plus = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), plaqueTexte("+", 48, 48)); plus.position.set(x, 0.85, -P / 2 + 0.05); cases.add(plus);
        }
      }
      if (elements.length > N) { const reste = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.14), plaqueTexte(`+${elements.length - N}`, 96, 40)); reste.position.set(L / 2 - 0.3, 0.18, P / 2 + 0.06); cases.add(reste); }
    },
    animer(dt) { contenu.children.forEach((o) => { if (o.userData.pousse !== undefined && o.userData.pousse < 1) { o.userData.pousse = Math.min(1, o.userData.pousse + dt / 260); const k = o.userData.pousse; o.scale.setScalar(1.25 * Math.max(0.01, k + 0.3 * Math.sin(Math.PI * k))); } }); },
  };
}

// Dictionnaire : une armoire de casiers, une porte par clé, la clé écrite sur l'étiquette de la porte.
function armoire(g, nom) {
  boite(g, 1.5, 1.4, 0.6, ACIER_SOMBRE, 0, 0.78, -0.1, 0.03);
  boite(g, 1.56, 0.08, 0.66, TEAL, 0, 1.5, -0.1);
  plaqueNomPeinte(g, nom, 0.8, 0, 1.62, 0.2).rotation.x = -0.2;
  const portes = new THREE.Group(); g.add(portes);
  return {
    haut: 2.0,
    remplir(e, avant) {
      portes.clear();
      const paires = e && e.v ? e.v.slice(0, 6) : [];
      const anciennes = new Set(avant && avant.v ? avant.v.map(([k]) => JSON.stringify(k)) : []);
      for (let i = 0; i < 6; i++) {
        const r = Math.floor(i / 2), c = i % 2, x = -0.36 + c * 0.72, y = 1.2 - r * 0.42;
        const porte = boite(portes, 0.66, 0.38, 0.04, i < paires.length ? TEAL : ACIER_SOMBRE, x, y, 0.22, 0.02);
        if (i < paires.length) {
          const [k] = paires[i];
          const etiquette = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.14), plaqueTexte(texteValeur(k).replace(/^"|"$/g, ""), 160, 48)); etiquette.position.set(x, y + 0.06, 0.245); portes.add(etiquette);
          cylindre(portes, 0.025, 0.025, 0.03, M.jaune, x, y - 0.1, 0.25, 8).rotation.x = Math.PI / 2;
          if (avant && !anciennes.has(JSON.stringify(k))) { porte.scale.setScalar(0.01); porte.userData.pousse = 0; }
        }
      }
    },
    animer(dt) { portes.children.forEach((o) => { if (o.userData.pousse !== undefined && o.userData.pousse < 1) { o.userData.pousse = Math.min(1, o.userData.pousse + dt / 260); o.scale.setScalar(Math.max(0.01, o.userData.pousse)); } }); },
  };
}

// Set : une cuve d'acier pleine de capsules, sans ordre ; un doublon n'y entre pas (la croix rouge le rappelle).
function cuveCapsules(g, nom) {
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.78; cylindre(g, 0.05, 0.06, 0.5, M.acier, Math.cos(a) * 0.5, 0.25, Math.sin(a) * 0.5, 8); }
  const paroi = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.55, 0.5, 28, 1, true), new THREE.MeshStandardMaterial({ color: 0xd3d8de, metalness: 0.9, roughness: 0.22, side: THREE.DoubleSide }));
  poser(g, paroi, 0, 0.75, 0);
  cylindre(g, 0.55, 0.55, 0.04, M.sombre, 0, 0.5, 0, 28);
  const bague = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.04, 8, 28), TEAL); bague.rotation.x = Math.PI / 2; poser(g, bague, 0, 1.0, 0);
  plaqueNomPeinte(g, nom, 0.75, 0, 0.62, 0.68).rotation.x = -0.25;
  const contenu = new THREE.Group(); contenu.position.y = 0.52; g.add(contenu);
  return {
    haut: 1.45,
    remplir(e) {
      contenu.clear();
      (e && e.v ? e.v.slice(0, 12) : []).forEach((el, i) => {
        const h = hachage(texteValeur(el) + i), a = (h % 628) / 100, r = 0.12 + ((h >> 4) % 40) / 100;
        const cap = poser(contenu, new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 14), matsCapsule[hachage(texteValeur(el)) % matsCapsule.length]), Math.cos(a) * r, 0.03 + (i % 3) * 0.035, Math.sin(a) * r);
        cap.rotation.set(((h >> 2) % 5) * 0.08, 0, ((h >> 5) % 5) * 0.08);
      });
    },
    animer() {},
  };
}

const CONSTRUIRE = { valeur: casier, liste: (g, n) => rayon(g, n, false), tuple: (g, n) => rayon(g, n, true), dict: armoire, set: cuveCapsules };

// ---------------------------------------------------------------- le parc

export function creerParc() {
  const groupe = new THREE.Group();
  const bacs = new Map();          // nom -> { g, genre, modele, plaque, valeur, x, z }
  const sautes = [];

  function construireBac(b) {
    if (b.g) groupe.remove(b.g);
    const g = new THREE.Group(); g.position.set(b.x, 0, b.z);
    const dalle = new THREE.Mesh(new THREE.PlaneGeometry(ECART_BACS - 0.3, 2.2), new THREE.MeshStandardMaterial({ color: 0x24262d, roughness: 0.9 }));
    dalle.rotation.x = -Math.PI / 2; dalle.position.y = 0.006; dalle.receiveShadow = true; g.add(dalle);
    const corps = new THREE.Group(); corps.scale.setScalar(ECHELLE_BAC); g.add(corps);
    b.modele = CONSTRUIRE[b.genre](corps, b.nom);
    b.g = g; groupe.add(g);
    majPlaque(b);
    b.modele.remplir(b.valeur, null);
  }
  // Deux plaques : de loin le nom seul, de près le nom et la valeur (la scène choisit selon le zoom).
  function majPlaque(b) {
    if (b.plaque) b.g.remove(b.plaque, b.plaqueNom);
    const t = b.valeur ? texteValeur(b.valeur) : "pas encore créée";
    b.plaque = plaque(b.nom, t.length > 26 ? t.slice(0, 25) + "…" : t, COULEUR_GENRE[b.genre]);
    b.plaque.userData.niveau = "valeur";
    b.plaqueNom = plaqueNom(b.nom, COULEUR_GENRE[b.genre]);
    b.plaqueNom.userData.niveau = "nom";
    for (const p of [b.plaque, b.plaqueNom]) { p.position.set(0, b.modele.haut * ECHELLE_BAC + 0.45, 0); b.g.add(p); }
  }

  // Range les contenants : liste [{ nom, genre, x, z }] (calculée par disposition.js). Les valeurs connues sont gardées.
  function disposer(liste, valeurs = {}) {
    bacs.clear(); groupe.clear();
    for (const p of liste) {
      const valeur = valeurs[p.nom] ?? null;
      const b = { nom: p.nom, genre: genreDe(valeur) || p.genre || "valeur", x: p.x, z: p.z, valeur, g: null };
      bacs.set(p.nom, b); construireBac(b);
    }
  }

  // Met à jour les contenants avec l'état des variables ({ nom: valeur encodée }). Renvoie les noms qui ont changé.
  // anime : les objets nouveaux poussent dans leur case et le contenant tressaute (pendant la marche).
  function maj(etat, anime = false) {
    const changes = [];
    for (const [nom, b] of bacs) {
      const v = etat[nom] ?? null;
      if (JSON.stringify(v) === JSON.stringify(b.valeur)) continue;
      const ancienne = b.valeur; b.valeur = v; changes.push(nom);
      const genre = genreDe(v) || b.genre;
      if (genre !== b.genre) { b.genre = genre; construireBac(b); }
      else { b.modele.remplir(v, anime ? (ancienne || { v: [] }) : null); majPlaque(b); }
      if (anime) sauter(nom);
    }
    return changes;
  }
  function sauter(nom) { const b = bacs.get(nom); if (b) sautes.push({ b, t: 0 }); }

  function position(nom) { const b = bacs.get(nom); return b ? new THREE.Vector3(b.x, b.modele.haut * ECHELLE_BAC - 0.3, b.z) : null; }
  const connait = (nom) => bacs.has(nom);

  function animer(ms, dt) {
    for (const b of bacs.values()) b.modele.animer(dt);
    for (let i = sautes.length - 1; i >= 0; i--) {
      const s = sautes[i]; s.t = Math.min(1, s.t + dt / 320);
      const k = Math.sin(Math.PI * s.t);
      s.b.g.scale.set(1 + 0.07 * k, 1 - 0.06 * k, 1 + 0.07 * k);
      if (s.t >= 1) { s.b.g.scale.setScalar(1); sautes.splice(i, 1); }
    }
  }

  return { groupe, disposer, maj, position, connait, animer, sauter };
}
