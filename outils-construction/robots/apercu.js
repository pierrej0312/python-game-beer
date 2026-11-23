// Aperçu d'un modèle (glb, fbx, obj) : vues de face et de profil, et chiffres utiles avant Mixamo. Outil de construction.
import * as THREE from "three";
import { GLTFLoader } from "./three/loaders/GLTFLoader.js";
import { FBXLoader } from "./three/loaders/FBXLoader.js";
import { OBJLoader } from "./three/loaders/OBJLoader.js";
import { MTLLoader } from "./three/loaders/MTLLoader.js";

const rendu = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
rendu.setSize(512, 640); rendu.outputColorSpace = THREE.SRGBColorSpace; document.body.append(rendu.domElement);

export async function charger(url) {
  const ext = url.split(".").pop().toLowerCase();
  if (ext === "glb" || ext === "gltf") { const g = await new GLTFLoader().loadAsync(url); return { racine: g.scene, animations: g.animations }; }
  if (ext === "fbx") { const o = await new FBXLoader().loadAsync(url); return { racine: o, animations: o.animations }; }
  if (ext === "obj") {
    const dossier = url.slice(0, url.lastIndexOf("/") + 1), mtl = url.replace(/\.obj$/i, ".mtl");
    const l = new OBJLoader();
    try { const m = await new MTLLoader().setPath(dossier).loadAsync(mtl.slice(dossier.length)); m.preload(); l.setMaterials(m); } catch { /* sans .mtl */ }
    const o = await l.loadAsync(url); return { racine: o, animations: [] };
  }
  throw new Error("format inconnu " + ext);
}

window.apercu = async (url) => {
  const { racine, animations } = await charger(url);
  racine.updateMatrixWorld(true);
  let tri = 0, maillages = 0, os = 0, textures = 0, peaux = 0; const noms = new Set();
  racine.traverse((o) => {
    if (o.isMesh) { maillages++; const g = o.geometry; tri += (g.index ? g.index.count : g.attributes.position.count) / 3; if (o.isSkinnedMesh) peaux++;
      for (const m of [].concat(o.material)) { if (m && m.map) { textures++; } if (m) noms.add(m.name); } }
    if (o.isBone) os++;
  });
  const boite = new THREE.Box3().setFromObject(racine), t = boite.getSize(new THREE.Vector3()), c = boite.getCenter(new THREE.Vector3());
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x2b2d36);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444455, 2.2)); const d = new THREE.DirectionalLight(0xffffff, 2.5); d.position.set(2, 4, 5); scene.add(d);
  scene.add(racine);
  const vues = {};
  const h = Math.max(t.x, t.y, t.z);
  for (const [nom, dir] of [["face", new THREE.Vector3(0, 0, 1)], ["profil", new THREE.Vector3(1, 0, 0)], ["dessus", new THREE.Vector3(0, 1, 0.001)]]) {
    const cam = new THREE.PerspectiveCamera(30, 512 / 640, h / 100, h * 20);
    cam.position.copy(c).addScaledVector(dir, h * 2.4); cam.lookAt(c);
    rendu.render(scene, cam); vues[nom] = rendu.domElement.toDataURL("image/jpeg", 0.85);
  }
  return { vues, tri: Math.round(tri), maillages, os, peaux, textures, materiaux: [...noms].slice(0, 12), taille: [t.x, t.y, t.z].map((v) => +v.toFixed(3)), centre: [c.x, c.y, c.z].map((v) => +v.toFixed(3)), animations: animations.map((a) => a.name) };
};
window.pret = true;

// ---------- préparer un robot pour le rigging automatique de Mixamo ----------
// Un seul maillage statique en pose de repos (squelette d'origine retiré), sans accessoire, centré, pieds au sol, face
// vers +z, 180 unités de haut ; allégé au-dessus de maxTri triangles. Sortie : OBJ + MTL + textures de couleur (PNG).
import { SimplifyModifier } from "./three/utils/SimplifyModifier.js";

const propre = (s) => (s || "materiau").replace(/[^\w-]+/g, "_");

async function imageEnPNG(texture, max = 2048) {
  const img = texture.image; if (!img) return null;
  const l = img.width || img.videoWidth, h = img.height || img.videoHeight; if (!l || !h) return null;
  const k = Math.min(1, max / Math.max(l, h));
  const c = document.createElement("canvas"); c.width = Math.round(l * k); c.height = Math.round(h * k);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/png");
}

window.preparer = async (url, { retirer = [], rotation = [0, 0, 0], hauteur = 180, maxTri = 60000, textures = {}, poseRepos = true, animation = null, instant = 0 } = {}) => {
  const { racine, animations } = await charger(url);
  // textures livrées à part : { nomDuMateriau: url de l'image de couleur }
  for (const [mat, src] of Object.entries(textures)) {
    const t = await new THREE.TextureLoader().loadAsync(src); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false;
    racine.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) if (m && m.name === mat) { m.map = t; m.needsUpdate = true; } });
  }
  if (poseRepos) racine.traverse((o) => { if (o.isSkinnedMesh) o.skeleton.pose(); });     // la pose de repos du modèle (souvent un T)
  if (window._zeroOs) racine.traverse((o) => { if (o.isBone && /link|joint/i.test(o.name)) o.quaternion.identity(); });
  if (animation) {                                   // ou un instant d'une de ses animations
    const clip = animations.find((c) => c.name === animation), mel = new THREE.AnimationMixer(racine);
    const a = mel.clipAction(clip); a.play(); a.time = instant; mel.update(0);
  }
  racine.updateMatrixWorld(true);
  const exclus = (o) => retirer.some((r) => new RegExp(r, "i").test(o.name) || [].concat(o.material).some((m) => m && new RegExp(r, "i").test(m.name)));
  const morceaux = [];                               // { geometrie (monde), materiaux, groupes }
  const v = new THREE.Vector3();
  racine.traverse((o) => {
    if (!o.isMesh || !o.visible || exclus(o)) return;
    let g = o.geometry.clone();
    if (o.isSkinnedMesh) {                            // la peau « cuite » dans la pose de repos
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); o.applyBoneTransform(i, v); p.setXYZ(i, v.x, v.y, v.z); }
      g.applyMatrix4(o.matrixWorld);
      ["skinIndex", "skinWeight"].forEach((a) => g.deleteAttribute(a));
    } else g.applyMatrix4(o.matrixWorld);
    for (const a of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(a)) g.deleteAttribute(a);
    g.morphAttributes = {};
    morceaux.push({ g, materiaux: [].concat(o.material), groupes: g.groups.length ? g.groups : [{ start: 0, count: g.index ? g.index.count : g.attributes.position.count, materialIndex: 0 }] });
  });
  // orientation, taille, position
  const rot = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rotation.map((d) => THREE.MathUtils.degToRad(d))));
  morceaux.forEach((m) => m.g.applyMatrix4(rot));
  const boite = new THREE.Box3(); morceaux.forEach((m) => { m.g.computeBoundingBox(); boite.union(m.g.boundingBox); });
  const t = boite.getSize(new THREE.Vector3()), c = boite.getCenter(new THREE.Vector3()), k = hauteur / t.y;
  const place = new THREE.Matrix4().makeScale(k, k, k).multiply(new THREE.Matrix4().makeTranslation(-c.x, -boite.min.y, -c.z));
  morceaux.forEach((m) => m.g.applyMatrix4(place));
  // allègement (meshoptimizer), proportionnel à chaque morceau
  let total = 0; morceaux.forEach((m) => { total += (m.g.index ? m.g.index.count : m.g.attributes.position.count) / 3; });
  const avant = total;
  if (total > maxTri) {
    const simp = new SimplifyModifier(), part = maxTri / total;
    for (const m of morceaux) {
      if (m.groupes.length > 1) continue;            // un morceau à plusieurs matériaux n'est pas allégé (groupes)
      const n = m.g.attributes.position.count, cible = Math.max(12, Math.floor(n * part));
      try { m.g = await simp.modify(m.g, n - cible); m.groupes = [{ start: 0, count: m.g.index ? m.g.index.count : m.g.attributes.position.count, materialIndex: 0 }]; } catch (e) { console.warn("allègement impossible", e); }
    }
    total = 0; morceaux.forEach((m) => { total += (m.g.index ? m.g.index.count : m.g.attributes.position.count) / 3; });
  }
  // OBJ + MTL
  const lignes = ["# Préparé pour Mixamo (outil de construction du championnat)", "mtllib robot.mtl"], mats = new Map();
  let base = 1;
  for (const [i, m] of morceaux.entries()) {
    const g = m.g; if (!g.attributes.normal) g.computeVertexNormals();
    const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
    lignes.push(`o morceau_${i}`);
    for (let j = 0; j < p.count; j++) lignes.push(`v ${p.getX(j).toFixed(4)} ${p.getY(j).toFixed(4)} ${p.getZ(j).toFixed(4)}`);
    if (uv) for (let j = 0; j < uv.count; j++) lignes.push(`vt ${uv.getX(j).toFixed(5)} ${(1 - uv.getY(j)).toFixed(5)}`);
    for (let j = 0; j < n.count; j++) lignes.push(`vn ${n.getX(j).toFixed(4)} ${n.getY(j).toFixed(4)} ${n.getZ(j).toFixed(4)}`);
    const idx = g.index ? g.index.array : null;
    for (const gr of m.groupes) {
      const mat = m.materiaux[gr.materialIndex] || m.materiaux[0];
      const nom = propre(mat && mat.name); mats.set(nom, mat);
      lignes.push(`usemtl ${nom}`);
      for (let f = gr.start; f < gr.start + gr.count; f += 3) {
        const s = [0, 1, 2].map((d) => (idx ? idx[f + d] : f + d) + base);
        lignes.push("f " + s.map((x) => (uv ? `${x}/${x}/${x}` : `${x}//${x}`)).join(" "));
      }
    }
    base += p.count;
  }
  const mtl = [], images = {};
  for (const [nom, mat] of mats) {
    mtl.push(`newmtl ${nom}`);
    const col = mat && mat.color ? mat.color : new THREE.Color(0.8, 0.8, 0.8);
    mtl.push(`Kd ${col.r.toFixed(4)} ${col.g.toFixed(4)} ${col.b.toFixed(4)}`, "Ka 0 0 0", "d 1");
    if (mat && mat.map) { const png = await imageEnPNG(mat.map); if (png) { images[`${nom}.png`] = png; mtl.push(`map_Kd ${nom}.png`); } }
    mtl.push("");
  }
  // aperçu du résultat
  const apercuScene = new THREE.Scene(); apercuScene.background = new THREE.Color(0x2b2d36);
  apercuScene.add(new THREE.HemisphereLight(0xffffff, 0x444455, 2.2));
  for (const m of morceaux) apercuScene.add(new THREE.Mesh(m.g, m.materiaux.length > 1 ? m.materiaux : m.materiaux[0]));
  const cam = new THREE.PerspectiveCamera(30, 512 / 640, 1, 5000); cam.position.set(0, hauteur / 2, hauteur * 2.6); cam.lookAt(0, hauteur / 2, 0);
  rendu.render(apercuScene, cam); const face = rendu.domElement.toDataURL("image/jpeg", 0.85);
  cam.position.set(hauteur * 2.6, hauteur / 2, 0); cam.lookAt(0, hauteur / 2, 0); rendu.render(apercuScene, cam);
  const profil = rendu.domElement.toDataURL("image/jpeg", 0.85);
  return { obj: lignes.join("\n") + "\n", mtl: mtl.join("\n"), images, face, profil, triangles: Math.round(total), avant: Math.round(avant), morceaux: morceaux.length };
};
