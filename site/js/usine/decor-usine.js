// L'usine de la Fonderie : le décor du hall de brassage, construit en géométrie (aucun fichier 3D importé).
// Inspiré des références du formateur (20/11/2026) : cuves inox et cuivre avec tuyauterie, jauges, hublots et vannes,
// vapeur qui monte, grandes verrières au fond, fûts, sacs de malt, étagères de bouteilles, établi, plantes de houblon,
// lampes d'atelier suspendues. Tout se place autour de l'étendue de la ligne de production, sans la cacher.
import * as THREE from "three";
import { RoundedBoxGeometry } from "../../vendor/three/addons/RoundedBoxGeometry.js";

// ---------- textures dessinées ----------
function toile(l, h, dessin) {
  const t = document.createElement("canvas"); t.width = l; t.height = h; dessin(t.getContext("2d"), l, h);
  const tex = new THREE.CanvasTexture(t); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; return tex;
}
const alea = (() => { let g = 20261120; return () => ((g = (g * 16807) % 2147483647) / 2147483647); })();   // décor identique à chaque chargement

const texBriques = () => toile(512, 512, (c, l, h) => {
  c.fillStyle = "#3d2a22"; c.fillRect(0, 0, l, h);
  const bh = 32, bl = 64;
  for (let y = 0; y < h; y += bh) for (let x = -bl; x < l; x += bl) {
    const dx = (y / bh) % 2 ? bl / 2 : 0, v = 0.75 + alea() * 0.35;
    c.fillStyle = `rgb(${Math.round(132 * v)},${Math.round(70 * v)},${Math.round(48 * v)})`;
    c.fillRect(x + dx + 2, y + 2, bl - 4, bh - 4);
  }
});
const texCarrelage = () => toile(512, 512, (c, l, h) => {
  c.fillStyle = "#24272e"; c.fillRect(0, 0, l, h);
  const n = 8, p = l / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const v = 0.85 + alea() * 0.2;
    c.fillStyle = `rgb(${Math.round(58 * v)},${Math.round(62 * v)},${Math.round(70 * v)})`;
    c.fillRect(i * p + 2, j * p + 2, p - 4, p - 4);
  }
});
const texJauge = () => toile(128, 128, (c) => {
  c.fillStyle = "#f4f1e8"; c.beginPath(); c.arc(64, 64, 60, 0, Math.PI * 2); c.fill();
  c.strokeStyle = "#1d1638"; c.lineWidth = 3;
  for (let i = 0; i <= 10; i++) { const a = Math.PI * 0.75 + i * Math.PI * 0.15; c.beginPath(); c.moveTo(64 + Math.cos(a) * 44, 64 + Math.sin(a) * 44); c.lineTo(64 + Math.cos(a) * 54, 64 + Math.sin(a) * 54); c.stroke(); }
  c.strokeStyle = "#c2323a"; c.lineWidth = 4; c.beginPath(); c.moveTo(64, 64); c.lineTo(64 + Math.cos(-0.6) * 46, 64 + Math.sin(-0.6) * 46); c.stroke();
  c.fillStyle = "#1d1638"; c.beginPath(); c.arc(64, 64, 6, 0, Math.PI * 2); c.fill();
});
const texTableau = () => toile(512, 256, (c, l, h) => {
  c.fillStyle = "#5a3a22"; c.fillRect(0, 0, l, h); c.fillStyle = "#1f2a24"; c.fillRect(14, 14, l - 28, h - 28);
  c.fillStyle = "#f4f1e8"; c.textAlign = "center";
  c.font = '700 44px "Zen Maru Gothic", "Barlow", sans-serif'; c.fillText("Brasserie de la Fonderie", l / 2, 86);
  c.font = '500 30px "Barlow", sans-serif';
  ["La Coulée · Le Laitier · La Braise", "Le Crassier · L'Étincelle"].forEach((t, i) => c.fillText(t, l / 2, 146 + i * 42));
});
const texVapeur = () => toile(64, 64, (c) => {
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,0.55)"); g.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = g; c.fillRect(0, 0, 64, 64);
});
// Un faisceau : des traînées verticales plus ou moins claires (qui glissent doucement), qui s'éteignent vers le sol.
const texRayon = () => toile(256, 256, (c, l, h) => {
  for (let x = 0; x < l; x += 4) {
    const a = 0.12 + 0.3 * Math.pow(Math.abs(Math.sin(x * 0.045) * Math.sin(x * 0.013 + 1.3)), 0.8);
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, `rgba(255,216,160,${a})`); g.addColorStop(0.7, `rgba(255,216,160,${a * 0.35})`); g.addColorStop(1, "rgba(255,216,160,0)");
    c.fillStyle = g; c.fillRect(x, 0, 4, h);
  }
});
const texTache = () => toile(128, 128, (c) => {
  const g = c.createRadialGradient(64, 64, 8, 64, 64, 64); g.addColorStop(0, "rgba(255,214,150,0.45)"); g.addColorStop(1, "rgba(255,214,150,0)");
  c.fillStyle = g; c.fillRect(0, 0, 128, 128);
});

export function creerDecor(e, { qualite = "haute", depart = { x: -5, z: 0 }, eclat = 1 } = {}) {
  // eclat : multiplie la lumière ajoutée par le décor (rayons, poussière, lampes) ; l'arène le baisse pour laisser les robots lisibles
  const d = new THREE.Group();
  const anim = [];             // ce qui bouge : vapeur, aiguilles
  const M = {
    inox: new THREE.MeshStandardMaterial({ color: 0xdfe3ea, metalness: 0.95, roughness: 0.18 }),
    cuivre: new THREE.MeshStandardMaterial({ color: 0xc87533, metalness: 0.95, roughness: 0.25 }),
    acier: new THREE.MeshStandardMaterial({ color: 0x5b616e, metalness: 0.8, roughness: 0.4 }),
    noir: new THREE.MeshStandardMaterial({ color: 0x1f2128, metalness: 0.5, roughness: 0.5 }),
    rouge: new THREE.MeshStandardMaterial({ color: 0xc2323a, roughness: 0.4 }),
    bois: new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.75 }),
    boisClair: new THREE.MeshStandardMaterial({ color: 0xb98a55, roughness: 0.8 }),
    toile: new THREE.MeshStandardMaterial({ color: 0xd8c9a6, roughness: 0.95 }),
    verreBrun: new THREE.MeshStandardMaterial({ color: 0x6b3510, metalness: 0.2, roughness: 0.15, transparent: true, opacity: 0.92 }),
    feuille: new THREE.MeshStandardMaterial({ color: 0x4f8f3a, roughness: 0.7 }),
    houblon: new THREE.MeshStandardMaterial({ color: 0x9cc65a, roughness: 0.6 }),
    jauge: new THREE.MeshBasicMaterial({ map: texJauge() }),
    alu: new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 0.9, roughness: 0.35 }),
    isolant: new THREE.MeshStandardMaterial({ color: 0xb9bcc2, roughness: 0.85 }),
    tuyauSouple: new THREE.MeshStandardMaterial({ color: 0x7f868f, roughness: 0.7 }),
    vert: new THREE.MeshStandardMaterial({ color: 0x5be03a, roughness: 0.45 }),
    hublot: new THREE.MeshStandardMaterial({ color: 0x2a3b45, metalness: 0.3, roughness: 0.05, emissive: 0xffb45e, emissiveIntensity: 0.25 }),
  };
  const ajouter = (o, x, y, z, parent = d) => { o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };

  const xG = e.x1 - 6, xD = e.x2 + 7, zFond = e.z1 - 9, zAvant = e.z2 + 5;
  const largeur = xD - xG, profondeur = zAvant - zFond;

  // ---------- le hall : sol carrelé brillant, mur de briques, verrières ----------
  const tCar = texCarrelage(); tCar.wrapS = tCar.wrapT = THREE.RepeatWrapping; tCar.repeat.set(largeur / 6, profondeur / 6);
  const sol = new THREE.Mesh(new THREE.PlaneGeometry(largeur + 20, profondeur + 20), new THREE.MeshStandardMaterial({ map: tCar, roughness: 0.32, metalness: 0.25 }));
  sol.rotation.x = -Math.PI / 2; sol.position.set((xG + xD) / 2, 0.001, (zFond + zAvant) / 2); sol.receiveShadow = true; d.add(sol);
  const tBri = texBriques(); tBri.wrapS = tBri.wrapT = THREE.RepeatWrapping; tBri.repeat.set((largeur + 20) / 6, 9 / 6);
  const matMur = new THREE.MeshStandardMaterial({ map: tBri, roughness: 0.9 });
  ajouter(new THREE.Mesh(new THREE.BoxGeometry(largeur + 20, 9, 0.6), matMur), (xG + xD) / 2, 4.5, zFond - 0.3);
  const tBri2 = texBriques(); tBri2.wrapS = tBri2.wrapT = THREE.RepeatWrapping; tBri2.repeat.set((profondeur + 10) / 6, 9 / 6);
  ajouter(new THREE.Mesh(new THREE.BoxGeometry(0.6, 9, profondeur + 10), new THREE.MeshStandardMaterial({ map: tBri2, roughness: 0.9 })), xG - 10, 4.5, (zFond + zAvant) / 2 - 5);
  // les verrières : un quadrillage de carreaux lumineux, et des rayons de soleil qui tombent sur le sol
  const matVitre = new THREE.MeshBasicMaterial({ color: 0xffe2ad }), tRayon = texRayon();
  for (let x = xG + 4; x < xD - 2; x += 9) {
    const cadre = ajouter(new THREE.Mesh(new THREE.BoxGeometry(5.2, 4.2, 0.2), M.noir), x, 5.2, zFond + 0.05); cadre.castShadow = false;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      const v = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.2), matVitre); v.position.set(x - 1.85 + i * 1.23, 3.95 + j * 1.27, zFond + 0.17); d.add(v);
    }
    // le faisceau part de la verrière elle-même et descend vers la salle ; deux voiles légèrement écartés donnent du volume
    const LONG = 6.6, PENTE = -0.75;
    for (const [dz, dx, force] of [[0, 0, 1], [0.35, 0.2, 0.6]]) {
      const geo = new THREE.PlaneGeometry(4.9, LONG); geo.translate(0, -LONG / 2, 0);
      const tex = tRayon.clone(); tex.wrapS = THREE.RepeatWrapping; tex.needsUpdate = true;
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: force });
      const rayon = new THREE.Mesh(geo, mat); rayon.position.set(x + dx, 6.95, zFond + 0.25 + dz); rayon.rotation.x = PENTE; d.add(rayon);
      const phase = x * 0.37 + dz * 5;
      anim.push((t) => { tex.offset.x = t * 0.000012 + phase; mat.opacity = eclat * force * (0.75 + 0.25 * Math.sin(t * 0.0006 + phase)); });
    }
    // la tache de soleil sur le sol, au pied du faisceau
    const tache = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 3.2), new THREE.MeshBasicMaterial({ map: texTache(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    tache.rotation.x = -Math.PI / 2; tache.position.set(x, 0.012, zFond + 0.25 + LONG * Math.sin(-PENTE) - 0.3); d.add(tache);
    anim.push((t) => { tache.material.opacity = eclat * (0.8 + 0.2 * Math.sin(t * 0.0006 + x * 0.37)); });
  }
  // le tableau à la craie et l'horloge
  ajouter(new THREE.Mesh(new THREE.PlaneGeometry(4, 2), new THREE.MeshStandardMaterial({ map: texTableau(), roughness: 0.9 })), xG + 1, 3.4, zFond + 0.02);
  const horloge = ajouter(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.1, 32), M.noir), xD - 3, 7.6, zFond + 0.06); horloge.rotation.x = Math.PI / 2;
  const cadran = new THREE.Mesh(new THREE.CircleGeometry(0.48, 32), M.jauge); cadran.position.set(xD - 3, 7.6, zFond + 0.12); d.add(cadran);

  // ---------- tuyauterie au mur et au plafond ----------
  const tuyau = (de, a, r = 0.09, mat = M.cuivre) => {
    const v = new THREE.Vector3().subVectors(a, de), l = v.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 12), mat);
    m.position.copy(de).addScaledVector(v, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize());
    m.castShadow = true; d.add(m);
    const coude = new THREE.Mesh(new THREE.SphereGeometry(r * 1.25, 12, 8), mat); coude.position.copy(a); d.add(coude);
    return m;
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  tuyau(V(xG - 4, 7.2, zFond + 0.6), V(xD + 4, 7.2, zFond + 0.6), 0.14, M.cuivre);
  tuyau(V(xG - 4, 6.6, zFond + 0.9), V(xD + 4, 6.6, zFond + 0.9), 0.1, M.inox);
  tuyau(V(xG - 4, 8.2, zFond + 1.4), V(xD + 4, 8.2, zFond + 1.4), 0.18, M.acier);
  for (let x = xG; x < xD; x += 4) { const s = ajouter(new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.12), M.noir), x, 7.4, zFond + 0.25); s.castShadow = false; }

  // ---------- les cuves de fermentation : inox, cerclages cuivre, fond conique, hublot, jauge, vannes ----------
  function cuve(x, z, cuivreCorps = false) {
    const c = new THREE.Group(); c.position.set(x, 0, z); d.add(c);
    const corps = cuivreCorps ? M.cuivre : M.inox;
    ajouter(new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 3.4, 40), corps), 0, 3.1, 0, c);
    ajouter(new THREE.Mesh(new THREE.ConeGeometry(1.25, 1.2, 40, 1, true), corps), 0, 0.8, 0, c).rotation.x = Math.PI;
    ajouter(new THREE.Mesh(new THREE.SphereGeometry(1.25, 40, 12, 0, Math.PI * 2, 0, Math.PI / 2), corps), 0, 4.8, 0, c).scale.y = 0.45;
    for (const y of [1.6, 3.1, 4.6]) { const b = ajouter(new THREE.Mesh(new THREE.TorusGeometry(1.27, 0.05, 8, 48), cuivreCorps ? M.inox : M.cuivre), 0, y, 0, c); b.rotation.x = Math.PI / 2; }
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; ajouter(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.4, 8), M.acier), Math.cos(a) * 0.95, 0.7, Math.sin(a) * 0.95, c); }
    // le hublot (trou d'homme) et ses boulons, face à la salle
    const h = ajouter(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 32), M.hublot), 0, 2.6, 1.24, c); h.rotation.x = Math.PI / 2;
    const r = ajouter(new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.06, 8, 32), M.cuivre), 0, 2.6, 1.28, c);
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ajouter(new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), M.acier), Math.cos(a) * 0.44, 2.6 + Math.sin(a) * 0.44, 1.33, c); }
    r.castShadow = false;
    // la jauge de pression, avec son aiguille qui tremble
    const j = ajouter(new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), M.jauge), 0.75, 3.7, 1.0, c); j.rotation.y = 0.65;
    const bague = ajouter(new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.03, 6, 24), M.inox), 0.75, 3.7, 1.0, c); bague.rotation.y = 0.65;
    anim.push((t) => { j.rotation.z = Math.sin(t * 0.0021 + x) * 0.08; });
    // la vanne de soutirage, rouge, sous le cône
    ajouter(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 10), M.inox), 0, 0.15, 0.3, c).rotation.x = Math.PI / 2;
    const volant = ajouter(new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.03, 6, 16), M.rouge), 0, 0.15, 0.62, c);
    // le tuyau qui monte au plafond
    tuyau(V(x + 0.4, 5.3, z), V(x + 0.4, 6.6, z), 0.07, M.inox);
    tuyau(V(x - 0.5, 5.2, z + 0.2), V(x - 0.5, 7.2, zFond + 0.6), 0.06, M.cuivre);
    volant.castShadow = false;
    return c;
  }
  const nCuves = Math.max(3, Math.floor((xD - xG - 6) / 4.2));
  const xCuves = [];
  for (let i = 0; i < nCuves; i++) { const x = xG + 3 + i * 4.2; xCuves.push(x); cuve(x, zFond + 2.4, i % 4 === 1); }
  const zCuves = zFond + 2.4;

  // ---------- la salle de brassage : la cuve d'ébullition en cuivre, à gauche, qui fume ----------
  const marmite = new THREE.Group(); marmite.position.set(xG - 3.5, 0, (zFond + zAvant) / 2 - 2); d.add(marmite);
  ajouter(new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.4, 2.4, 40), M.cuivre), 0, 1.6, 0, marmite);
  ajouter(new THREE.Mesh(new THREE.SphereGeometry(1.6, 40, 14, 0, Math.PI * 2, 0, Math.PI / 2), M.cuivre), 0, 2.8, 0, marmite).scale.y = 0.55;
  ajouter(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 3.2, 16), M.cuivre), 0, 5.2, 0, marmite);
  ajouter(new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.4, 40), M.acier), 0, 0.2, 0, marmite);
  const hublotM = ajouter(new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.08, 28), M.hublot), 1.45, 1.8, 0.6, marmite); hublotM.rotation.set(Math.PI / 2, 0, -1.15);

  // ---------- la tuyauterie : partout, comme dans une vraie brasserie ----------
  const brides = (de, a, pas, r, mat) => {          // les brides (colliers) le long d'une conduite
    const v = new THREE.Vector3().subVectors(a, de), l = v.length(), dir = v.clone().normalize();
    for (let k = pas; k < l; k += pas) {
      const b = new THREE.Mesh(new THREE.TorusGeometry(r * 1.15, r * 0.25, 6, 16), mat);
      b.position.copy(de).addScaledVector(dir, k); b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir); d.add(b);
    }
  };
  const conduite = (points, r, mat, pasBride = 0) => {
    for (let i = 0; i + 1 < points.length; i++) { tuyau(points[i], points[i + 1], r, mat); if (pasBride) brides(points[i], points[i + 1], pasBride, r, mat); }
  };
  const vanne = (p, couleur = M.vert, axe = "x") => {
    const corps = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), M.inox); corps.position.copy(p); d.add(corps);
    const tige = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.22, 6), M.inox); tige.position.copy(p); tige.position.y += 0.15; d.add(tige);
    const poignee = new THREE.Mesh(new THREE.BoxGeometry(axe === "x" ? 0.34 : 0.06, 0.05, axe === "x" ? 0.06 : 0.34), couleur); poignee.position.copy(p); poignee.position.y += 0.27; d.add(poignee);
  };
  const souple = (points, r = 0.07) => {           // un tuyau souple, posé en boucle sur le sol
    const courbe = new THREE.CatmullRomCurve3(points);
    const m = new THREE.Mesh(new THREE.TubeGeometry(courbe, 48, r, 10, false), M.tuyauSouple); m.castShadow = true; d.add(m);
  };

  // 1. le circuit de glycol (refroidissement) : deux conduites isolées au-dessus des cuves, une descente par cuve
  for (const [dz, y] of [[0.9, 5.7], [1.25, 5.95]]) {
    conduite([V(xG - 2, y, zCuves + dz), V(xD + 3, y, zCuves + dz)], 0.07, M.isolant);
    xCuves.forEach((x) => { conduite([V(x + (dz > 1 ? 0.35 : -0.35), y, zCuves + dz), V(x + (dz > 1 ? 0.35 : -0.35), 4.3, zCuves + dz), V(x + (dz > 1 ? 0.35 : -0.35), 4.3, zCuves + 0.95)], 0.04, M.isolant); });
  }
  // 2. le collecteur de bière : une conduite inox au pied des cuves, un piquage par cuve avec sa vanne verte
  // (fin, et collé aux cuves : la ligne de production reste dégagée)
  const zCollecteur = zCuves + 1.5;
  conduite([V(xG - 1, 0.55, zCollecteur), V(xD + 1, 0.55, zCollecteur)], 0.06, M.inox, 1.6);
  xCuves.forEach((x) => {
    conduite([V(x, 0.2, zCuves + 0.65), V(x, 0.2, zCollecteur - 0.4), V(x, 0.55, zCollecteur - 0.4), V(x, 0.55, zCollecteur)], 0.035, M.inox);
    vanne(V(x, 0.55, zCollecteur - 0.2), M.vert, "z");
  });
  // 3. sur la gauche, à l'écart de la ligne : un faisceau de tuyaux fins, à l'horizontale, du fond jusqu'à l'avant ;
  //    l'un d'eux alimente le départ de la ligne (la bière des cuves arrive au quai de chargement)
  const xFaisceau = e.x1 - 1.2;
  [[0.35, M.cuivre], [0.6, M.inox], [0.85, M.cuivre], [1.1, M.alu]].forEach(([y, mat], k) => {
    conduite([V(xG - 1, 0.55 + (k === 0 ? 0 : 0), zCollecteur), V(xFaisceau - k * 0.18, y, zCollecteur), V(xFaisceau - k * 0.18, y, zAvant)], 0.045, mat, 2.2);
  });
  for (let z = zCollecteur + 3; z < zAvant; z += 4) { const support = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, 0.06), M.acier); support.position.set(xFaisceau - 0.27, 0.6, z); d.add(support); }
  conduite([V(xFaisceau, 0.35, depart.z - 1.2), V(depart.x - 0.6, 0.35, depart.z - 1.2), V(depart.x - 0.6, 0.35, depart.z - 0.8)], 0.045, M.cuivre);
  vanne(V(xFaisceau + 0.3, 0.35, depart.z - 1.2), M.rouge, "x");
  // 4. au mur : des lignes de vapeur, d'eau et d'air, avec vannes et jauges
  for (const [y, mat, r] of [[1.8, M.cuivre, 0.08], [2.3, M.inox, 0.06], [2.75, M.acier, 0.1]]) {
    conduite([V(xG - 8, y, zFond + 0.35), V(xD + 6, y, zFond + 0.35)], r, mat, 2.4);
  }
  for (let x = xG - 6; x < xD + 4; x += 5) {
    conduite([V(x, 7.2, zFond + 0.6), V(x, 1.8, zFond + 0.6)], 0.06, M.cuivre);
    vanne(V(x, 3.2, zFond + 0.75), x % 2 ? M.rouge : M.vert);
  }
  // 5. au plafond : les gaines de ventilation en aluminium, annelées, et les chemins de câbles
  // (au fond seulement : au-dessus de la ligne, elles cacheraient les machines)
  conduite([V(xG - 8, 8.4, zFond + 1.6), V(xD + 6, 8.4, zFond + 1.6)], 0.34, M.alu, 0.8);
  conduite([V(xD - 2, 8.4, zFond + 1.6), V(xD - 2, 8.4, zFond + 4.2), V(xD - 2, 6.6, zFond + 4.2)], 0.24, M.alu, 0.6);
  for (const z of [zFond + 3.6]) { const chemin = new THREE.Mesh(new THREE.BoxGeometry(xD - xG + 14, 0.08, 0.5), M.acier); chemin.position.set((xG + xD) / 2, 8.1, z); d.add(chemin); }
  // 6. la salle de brassage : la cheminée de la cuve d'ébullition rejoint le mur, une pompe et ses tuyaux
  conduite([V(marmite.position.x, 6.8, marmite.position.z), V(marmite.position.x, 7.6, marmite.position.z), V(marmite.position.x, 7.6, zFond + 0.6)], 0.2, M.cuivre, 1.2);
  conduite([V(marmite.position.x + 1.5, 0.6, marmite.position.z), V(marmite.position.x + 2.6, 0.6, marmite.position.z), V(marmite.position.x + 2.6, 0.6, zCollecteur), V(xG - 1, 0.55, zCollecteur)], 0.09, M.cuivre);
  const pompe = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.7, 16), M.rouge); pompe.rotation.z = Math.PI / 2; pompe.position.set(marmite.position.x + 2.6, 0.6, marmite.position.z + 1.5); pompe.castShadow = true; d.add(pompe);
  // 7. des tuyaux souples posés au sol, entre les cuves
  for (let i = 1; i < xCuves.length; i += 2) {
    const x = xCuves[i];
    souple([V(x + 0.6, 0.2, zCuves + 0.8), V(x + 1.6, 0.08, zCuves + 1.4), V(x + 1.0, 0.08, zCuves + 1.9), V(x + 1.9, 0.08, zCuves + 1.7), V(x + 2.1, 0.08, zCuves + 1.0)]);
  }
  // 8. les ventilateurs de plafond : ils tournent lentement
  for (const x of [xG + 4, (xG + xD) / 2 + 3]) {
    const v = new THREE.Group(); v.position.set(x, 9.4, zFond + 2.6); v.scale.setScalar(0.7);
    v.add(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.25, 16), M.alu));
    for (let k = 0; k < 5; k++) { const pale = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.04, 0.38), M.alu); pale.position.x = 1.4; const bras = new THREE.Group(); bras.rotation.y = k * Math.PI * 2 / 5; bras.add(pale); v.add(bras); }
    d.add(v); anim.push((t, dt) => { v.rotation.y += dt * 0.0016; });
  }

  // ---------- la vapeur : elle monte des dômes et se dissipe ----------
  const matVapeur = new THREE.SpriteMaterial({ map: texVapeur(), transparent: true, depthWrite: false, opacity: 0.6 });
  const sources = [V(marmite.position.x, 6.8, marmite.position.z), V(xG + 3 + 4.2, 5.4, zFond + 2.4), V(xG + 3 + 4.2 * 3, 5.4, zFond + 2.4)];
  const bouffees = [];
  const nb = qualite === "haute" ? 26 : 8;
  for (let i = 0; i < nb; i++) {
    const s = new THREE.Sprite(matVapeur.clone()); s.userData = { source: sources[i % sources.length], age: alea() * 4000, vie: 3500 + alea() * 1500, dx: (alea() - 0.5) * 0.6 };
    d.add(s); bouffees.push(s);
  }
  anim.push((t, dt) => bouffees.forEach((b) => {
    const u = b.userData; u.age = (u.age + dt) % u.vie; const k = u.age / u.vie;
    b.position.set(u.source.x + u.dx * k * 3, u.source.y + k * 3.2, u.source.z + Math.sin(k * 5 + u.dx * 10) * 0.25);
    const taille = 0.8 + k * 2.4; b.scale.set(taille, taille, 1); b.material.opacity = 0.55 * Math.sin(Math.PI * k);
  }));

  // ---------- la poussière qui flotte dans la lumière des verrières ----------
  if (qualite === "haute") {
    const n = 260, pos = new Float32Array(n * 3), base = [];
    for (let i = 0; i < n; i++) { const p = [xG + alea() * (xD - xG), 0.5 + alea() * 7, zFond + 1 + alea() * (profondeur * 0.55)]; base.push(p); pos.set(p, i * 3); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const grains = new THREE.Points(geo, new THREE.PointsMaterial({ map: texVapeur(), color: 0xffe2b0, size: 4, sizeAttenuation: false, transparent: true, opacity: 0.4 * eclat, depthWrite: false, blending: THREE.AdditiveBlending }));
    d.add(grains);
    anim.push((t) => {
      for (let i = 0; i < n; i++) {
        const b = base[i];
        pos[i * 3] = b[0] + Math.sin(t * 0.00021 + i) * 0.6;
        pos[i * 3 + 1] = b[1] + Math.sin(t * 0.00033 + i * 1.7) * 0.35;
        pos[i * 3 + 2] = b[2] + Math.cos(t * 0.00017 + i * 0.7) * 0.5;
      }
      geo.attributes.position.needsUpdate = true;
    });
  }

  // ---------- les accessoires : fûts en bois, fûts inox, sacs de malt, étagères de bouteilles, établi, houblon ----------
  const profil = []; for (let i = 0; i <= 10; i++) { const y = i / 10; profil.push(new THREE.Vector2(0.42 + 0.08 * Math.sin(Math.PI * y), y * 1.1 - 0.55)); }
  const geoTonneau = new THREE.LatheGeometry(profil, 24);
  function tonneau(x, z, couche = 0, couche_y = 0) {
    const t = ajouter(new THREE.Mesh(geoTonneau, M.bois), x, 0.55 + couche_y, z);
    for (const y of [-0.38, 0.38]) { const c = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.025, 6, 24), M.noir); c.rotation.x = Math.PI / 2; c.position.y = y; t.add(c); }
    return t;
  }
  function futInox(x, z, y = 0) {
    const f = ajouter(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.62, 20), M.inox), x, 0.31 + y, z);
    for (const yy of [-0.24, 0.24]) { const c = new THREE.Mesh(new THREE.TorusGeometry(0.305, 0.03, 6, 20), M.inox); c.rotation.x = Math.PI / 2; c.position.y = yy; f.add(c); }
  }
  function sac(x, z, y = 0, rot = 0) {
    const s = ajouter(new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.38, 0.55, 3, 0.16), M.toile), x, 0.19 + y, z); s.rotation.y = rot;
  }
  function palette(x, z) {
    const p = new THREE.Group(); p.position.set(x, 0, z); d.add(p);
    for (let i = 0; i < 5; i++) ajouter(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 0.22), M.boisClair), 0, 0.17, -0.55 + i * 0.275, p);
    for (const xx of [-0.6, 0, 0.6]) ajouter(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 1.3), M.boisClair), xx, 0.07, 0, p);
    return p;
  }
  // l'étagère de bouteilles brunes (bouteilles instanciées : une seule géométrie)
  function etagere(x, z, rot = 0) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; d.add(g);
    for (const xx of [-1.3, 1.3]) ajouter(new THREE.Mesh(new THREE.BoxGeometry(0.08, 3, 0.6), M.bois), xx, 1.5, 0, g);
    const geoB = new THREE.CylinderGeometry(0.07, 0.08, 0.36, 10), n = 4 * 14;
    const bouteilles = new THREE.InstancedMesh(geoB, M.verreBrun, n); let k = 0; const m4 = new THREE.Matrix4();
    for (let r = 0; r < 4; r++) {
      ajouter(new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.06, 0.6), M.bois), 0, 0.3 + r * 0.8, 0, g);
      for (let i = 0; i < 14; i++) { m4.makeTranslation(-1.17 + i * 0.18, 0.51 + r * 0.8, (alea() - 0.5) * 0.15); bouteilles.setMatrixAt(k++, m4); }
    }
    bouteilles.castShadow = true; g.add(bouteilles);
  }
  function etabli(x, z) {
    const g = new THREE.Group(); g.position.set(x, 0, z); d.add(g);
    ajouter(new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 1), M.boisClair), 0, 0.95, 0, g);
    for (const [a, b] of [[-1.2, -0.4], [1.2, -0.4], [-1.2, 0.4], [1.2, 0.4]]) ajouter(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.1), M.acier), a, 0.45, b, g);
    ajouter(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.5, 16), M.inox), -0.8, 1.26, 0, g);           // un seau de brassage
    ajouter(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.35), M.rouge), 0.7, 1.16, -0.1, g);                  // une caisse à outils
    for (let i = 0; i < 4; i++) ajouter(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.3, 10), M.verreBrun), 0.1 + i * 0.16, 1.16, 0.25, g);
  }
  function houblon(x, z) {
    const pot = ajouter(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.24, 0.5, 16), M.cuivre), x, 0.25, z);
    for (let i = 0; i < 9; i++) {
      const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18 + alea() * 0.1, 0), i % 3 ? M.feuille : M.houblon);
      f.position.set((alea() - 0.5) * 0.5, 0.5 + alea() * 1.1, (alea() - 0.5) * 0.5); f.castShadow = true; pot.add(f);
    }
    ajouter(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 6), M.bois), 0, 1, 0, pot);
  }
  // à gauche : les sacs de malt sur palette, des tonneaux, le houblon
  const pg = palette(xG - 0.5, zAvant - 3);
  for (let i = 0; i < 6; i++) sac(xG - 0.8 + (i % 2) * 0.75, zAvant - 3.3 + (Math.floor(i / 2) % 3) * 0.3, 0.2 + Math.floor(i / 2) * 0.36, (alea() - 0.5) * 0.3);
  tonneau(xG + 1.2, zAvant - 1); tonneau(xG + 2.3, zAvant - 0.6); tonneau(xG + 1.75, zAvant - 0.8, 1, 1.1);
  houblon(xG - 1.5, zFond + 5); houblon(xG - 1.2, zAvant - 6);
  // à droite : l'étagère de bouteilles, les fûts inox empilés, l'établi
  etagere(xD + 1.5, zFond + 4.2, -Math.PI / 2);
  for (let i = 0; i < 8; i++) futInox(xD + 0.2 + (i % 4) * 0.66, zAvant - 2.2 + Math.floor(i / 4) * 0.66);
  for (let i = 0; i < 4; i++) futInox(xD + 0.53 + (i % 3) * 0.66, zAvant - 1.9, 0.62);
  etabli(xD + 1.4, (zFond + zAvant) / 2 + 1);
  houblon(xD + 3, zAvant - 0.2);
  palette(xD + 1.8, zFond + 7.5); for (let i = 0; i < 4; i++) tonneau(xD + 1.5 + (i % 2) * 0.9, zFond + 7.2 + Math.floor(i / 2) * 0.8);

  // ---------- les lampes d'atelier : des suspensions le long du mur, et leur lumière sur la ligne ----------
  const matAbat = new THREE.MeshStandardMaterial({ color: 0x2b2d35, metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide });
  const matAmpoule = new THREE.MeshBasicMaterial({ color: 0xffd59a });
  const lumieres = qualite === "haute" ? 4 : 0;
  for (let i = 0; i < lumieres; i++) {
    const x = xG + 2 + i * (xD - xG - 4) / Math.max(1, lumieres - 1), z = (e.z1 + e.z2) / 2 - 1, y = 7;
    // au-dessus de la ligne, seule la lumière : l'abat-jour vu d'en haut cacherait les machines
    const l = new THREE.PointLight(0xffc98a, 22 * eclat, 14, 1.5); l.position.set(x, y - 0.4, z); d.add(l);
  }

  for (let x = xG + 2; x < xD; x += 6) {
    const abat = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.42, 20, 1, true), matAbat); abat.position.set(x, 6.2, zFond + 4.6); d.add(abat);
    const ampoule = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), matAmpoule); ampoule.position.set(x, 6.02, zFond + 4.6); d.add(ampoule);
    const fil = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 2.2, 4), M.noir); fil.position.set(x, 7.5, zFond + 4.6); d.add(fil);
  }
  return { groupe: d, animer: (t, dt) => anim.forEach((f) => f(t, dt)) };
}
