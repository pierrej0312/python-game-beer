// Textures dessinées par le code (canvas) : aucune image importée, donc aucune licence, et les
// textures affichent les données du jeu (01-direction-artistique.md § 5).
import * as THREE from "three";

// ----- Réglages -----
export const POLICE = '"Barlow", "Segoe UI", Arial, sans-serif';
export const BIERES = {                     // fiche du fil rouge : code, nom, couleur
  B01: { nom: "La Coulée", couleur: "#ffc857" },
  B02: { nom: "Le Laitier", couleur: "#fff3e0" },
  B03: { nom: "La Braise", couleur: "#f2746b" },
  B04: { nom: "Le Crassier", couleur: "#6b4a3a" },
  B05: { nom: "L'Étincelle", couleur: "#4fc4a0" },
};
export const QUAIS = { Q1: "Cafés", Q2: "Magasins", Q3: "Particuliers", Q4: "Événements", R: "Rebut" };

const cache = new Map();

function toile(largeur, hauteur) {
  const c = document.createElement("canvas");
  c.width = largeur; c.height = hauteur;
  return [c, c.getContext("2d")];
}

function enTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Générateur pseudo-aléatoire à graine fixe : une même texture est toujours identique.
export function alea(graine) {
  let etat = graine >>> 0;
  return () => { etat = (etat * 1664525 + 1013904223) >>> 0; return etat / 4294967296; };
}

function grain(ctx, largeur, hauteur, graine, force, taille = 2) {
  const hasard = alea(graine);
  for (let i = 0; i < (largeur * hauteur) / (taille * taille * 6); i++) {
    const v = hasard();
    ctx.fillStyle = v > 0.5 ? `rgba(255,255,255,${force * (v - 0.5)})` : `rgba(0,0,0,${force * (0.5 - v)})`;
    ctx.fillRect(hasard() * largeur, hasard() * hauteur, taille, taille);
  }
}

function coche(ctx, x, y, taille, ok) {
  ctx.lineWidth = taille * 0.18; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.strokeStyle = "#ffffff";
  ctx.beginPath();
  if (ok) { ctx.moveTo(x - taille * 0.4, y); ctx.lineTo(x - taille * 0.1, y + taille * 0.3); ctx.lineTo(x + taille * 0.42, y - taille * 0.32); }
  else { ctx.moveTo(x - taille * 0.32, y - taille * 0.32); ctx.lineTo(x + taille * 0.32, y + taille * 0.32); ctx.moveTo(x + taille * 0.32, y - taille * 0.32); ctx.lineTo(x - taille * 0.32, y + taille * 0.32); }
  ctx.stroke();
}

function memo(cle, fabrique) {
  if (!cache.has(cle)) cache.set(cle, fabrique());
  return cache.get(cle);
}

// Sol de l'entrepôt : béton sombre, dalles, allée jaune, zones des quais. 100 pixels par mètre.
export function texSol(largeurM, profondeurM, zones) {
  return memo("sol", () => {
    const e = 100, [c, ctx] = toile(largeurM * e, profondeurM * e);
    ctx.fillStyle = "#3b3e46"; ctx.fillRect(0, 0, c.width, c.height);
    grain(ctx, c.width, c.height, 7, 0.16, 3);
    ctx.strokeStyle = "rgba(0,0,0,0.22)"; ctx.lineWidth = 2;
    for (let x = 0; x <= c.width; x += 2 * e) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, c.height); ctx.stroke(); }
    for (let y = 0; y <= c.height; y += 2 * e) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(c.width, y); ctx.stroke(); }
    const X = (m) => (m + largeurM / 2) * e, Z = (m) => (m + profondeurM / 2) * e;
    // allée principale : deux lignes jaunes
    ctx.strokeStyle = "#f5b82e"; ctx.lineWidth = 9;
    for (const z of zones.allee) { ctx.beginPath(); ctx.moveTo(X(-7.2), Z(z)); ctx.lineTo(X(5.4), Z(z)); ctx.stroke(); }
    // zones de dépose : cadre hachuré et nom peint au sol
    for (const zone of zones.depots) {
      const x = X(zone.x - zone.l / 2), z = Z(zone.z - zone.p / 2), l = zone.l * e, p = zone.p * e;
      ctx.save(); ctx.beginPath(); ctx.rect(x, z, l, p); ctx.clip();
      ctx.fillStyle = "#2c2e35"; ctx.fillRect(x, z, l, p);
      ctx.strokeStyle = zone.couleur; ctx.lineWidth = 14;
      for (let d = -p; d < l + p; d += 44) { ctx.beginPath(); ctx.moveTo(x + d, z); ctx.lineTo(x + d - p, z + p); ctx.stroke(); }
      ctx.fillStyle = "#2c2e35"; ctx.fillRect(x + 16, z + 16, l - 32, p - 32);
      ctx.restore();
      ctx.strokeStyle = zone.couleur; ctx.lineWidth = 6; ctx.strokeRect(x + 3, z + 3, l - 6, p - 6);
      if (zone.texte) {
        ctx.save(); ctx.translate(X(zone.x), Z(zone.z)); ctx.rotate(zone.rotation || 0);
        ctx.fillStyle = zone.couleur; ctx.font = `700 ${zone.taille || 64}px ${POLICE}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(zone.texte, 0, 4); ctx.restore();
      }
    }
    return enTexture(c);
  });
}

// Mur en panneaux nervurés.
export function texMur() {
  return memo("mur", () => {
    const [c, ctx] = toile(512, 512);
    ctx.fillStyle = "#30333b"; ctx.fillRect(0, 0, 512, 512);
    for (let x = 0; x < 512; x += 32) {
      ctx.fillStyle = "rgba(255,255,255,0.045)"; ctx.fillRect(x, 0, 3, 512);
      ctx.fillStyle = "rgba(0,0,0,0.22)"; ctx.fillRect(x + 29, 0, 3, 512);
    }
    ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(0, 250, 512, 4);
    grain(ctx, 512, 512, 11, 0.08, 2);
    const t = enTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  });
}

// Carton kraft avec bande adhésive et étiquette (bière, code).
export function texCaisse(codeBiere, identifiant) {
  return memo("caisse-" + codeBiere + identifiant, () => {
    const [c, ctx] = toile(256, 256), b = BIERES[codeBiere] || { nom: "", couleur: "#ffffff" };
    ctx.fillStyle = "#c89a63"; ctx.fillRect(0, 0, 256, 256);
    grain(ctx, 256, 256, 3, 0.12, 2);
    ctx.fillStyle = "rgba(240,220,180,0.55)"; ctx.fillRect(0, 108, 256, 40);
    ctx.fillStyle = "#fff8ec"; ctx.fillRect(34, 150, 188, 84);
    ctx.fillStyle = b.couleur; ctx.fillRect(34, 150, 188, 18);
    ctx.fillStyle = "#2b2350"; ctx.font = `700 26px ${POLICE}`; ctx.textAlign = "center";
    ctx.fillText(b.nom, 128, 198);
    ctx.font = `600 18px ${POLICE}`; ctx.fillText(identifiant, 128, 224);
    return enTexture(c);
  });
}

// Bande d'un fût : couleur et nom de la bière, contenance.
export function texBandeFut(codeBiere) {
  return memo("fut-" + codeBiere, () => {
    const [c, ctx] = toile(512, 128), b = BIERES[codeBiere] || { nom: "", couleur: "#cccccc" };
    ctx.fillStyle = b.couleur; ctx.fillRect(0, 0, 512, 128);
    const sombre = ["B04"].includes(codeBiere);
    ctx.fillStyle = sombre ? "#fff3e0" : "#2b2350"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const x of [128, 384]) {
      ctx.font = `700 40px ${POLICE}`; ctx.fillText(b.nom, x, 52);
      ctx.font = `600 26px ${POLICE}`; ctx.fillText(codeBiere + " · 20 L", x, 96);
    }
    return enTexture(c);
  });
}

// Panneau d'un quai : son code et sa destination.
export function texPanneauQuai(code) {
  return memo("quai-" + code, () => {
    const [c, ctx] = toile(512, 192), rebut = code === "R";
    ctx.fillStyle = rebut ? "#b8433c" : "#f28c1e"; ctx.fillRect(0, 0, 512, 192);
    ctx.fillStyle = "#1d1f24"; ctx.fillRect(10, 10, 492, 172);
    ctx.fillStyle = rebut ? "#f2746b" : "#ffc857"; ctx.font = `700 104px ${POLICE}`; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(code, 34, 100);
    ctx.fillStyle = "#fff3e0"; ctx.font = `600 46px ${POLICE}`;
    ctx.fillText(QUAIS[code], rebut ? 130 : 200, 102);
    return enTexture(c);
  });
}

// Écran : texte clair sur fond sombre, bordure et symbole selon l'état (null, true = réussi, false = raté).
export function dessinerEcran(canvas, texte, etat, { tailleMax = 86, lignesMax = 3 } = {}) {
  const ctx = canvas.getContext("2d"), l = canvas.width, h = canvas.height;
  ctx.fillStyle = "#0e1420"; ctx.fillRect(0, 0, l, h);
  const couleur = etat === true ? "#4fc4a0" : etat === false ? "#f2746b" : "#f28c1e";
  ctx.strokeStyle = couleur; ctx.lineWidth = Math.round(h * 0.05); ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, l - ctx.lineWidth, h - ctx.lineWidth);
  const marge = h * 0.14, place = etat === null || etat === undefined ? l - 2 * marge : l - 2 * marge - h * 0.42;
  let taille = tailleMax, lignes = [];
  for (; taille >= 18; taille -= 4) {
    ctx.font = `700 ${taille}px ${POLICE}`;
    lignes = []; let courante = "";
    for (const mot of String(texte).split(" ")) {
      const essai = courante ? courante + " " + mot : mot;
      if (ctx.measureText(essai).width > place && courante) { lignes.push(courante); courante = mot; } else courante = essai;
    }
    if (courante) lignes.push(courante);
    if (lignes.length <= lignesMax && lignes.every((x) => ctx.measureText(x).width <= place) && lignes.length * taille * 1.2 <= h - 2 * marge) break;
  }
  ctx.fillStyle = "#eaf2ff"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  const y0 = h / 2 - ((lignes.length - 1) * taille * 1.2) / 2;
  lignes.forEach((x, i) => ctx.fillText(x, marge, y0 + i * taille * 1.2));
  if (etat === true || etat === false) {
    const r = h * 0.2, cx = l - marge - r, cy = h / 2;
    ctx.fillStyle = couleur; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    coche(ctx, cx, cy, r * 1.5, etat);
  }
}

export function creerEcran(largeur, hauteur) {
  const [c] = toile(largeur, hauteur);
  const texture = enTexture(c);
  const ecrire = (texte, etat, options) => { dessinerEcran(c, texte, etat, options); texture.needsUpdate = true; };
  ecrire("", null);
  return { texture, ecrire };
}

// Pastille flottante : coche sur fond vert, croix sur fond rouge (jamais la couleur seule).
export function texSymbole(ok) {
  return memo("symbole-" + ok, () => {
    const [c, ctx] = toile(128, 128);
    ctx.fillStyle = ok ? "#4fc4a0" : "#f2746b"; ctx.beginPath(); ctx.arc(64, 64, 58, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(64, 64, 55, 0, Math.PI * 2); ctx.stroke();
    coche(ctx, 64, 64, 84, ok);
    return enTexture(c);
  });
}

// Bandes de danger jaunes et noires.
export function texDanger() {
  return memo("danger", () => {
    const [c, ctx] = toile(128, 128);
    ctx.fillStyle = "#f5b82e"; ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = "#1d1f24"; ctx.lineWidth = 22;
    for (let d = -128; d < 256; d += 64) { ctx.beginPath(); ctx.moveTo(d, 0); ctx.lineTo(d + 128, 128); ctx.stroke(); }
    const t = enTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  });
}

// Bois des palettes et des plateaux.
export function texBois() {
  return memo("bois", () => {
    const [c, ctx] = toile(256, 256);
    ctx.fillStyle = "#c58d57"; ctx.fillRect(0, 0, 256, 256);
    const hasard = alea(5);
    for (let y = 0; y < 256; y += 32) {
      ctx.fillStyle = `rgba(0,0,0,${0.05 + hasard() * 0.1})`; ctx.fillRect(0, y, 256, 30);
      ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(0, y + 30, 256, 2);
    }
    grain(ctx, 256, 256, 9, 0.1, 2);
    const t = enTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  });
}
