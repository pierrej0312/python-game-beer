// Conversion FBX (Mixamo) → glTF binaire (.glb), dans le navigateur, avec les outils de three.js (FBXLoader, GLTFExporter).
// Appelée par faire_robots.py. Les FBX bruts ne sont jamais publiés : seuls les .glb produits vont dans le site.
import * as THREE from "three";
import { FBXLoader } from "./three/loaders/FBXLoader.js";
import { GLTFExporter } from "./three/exporters/GLTFExporter.js";
import { mergeVertices } from "./three/utils/BufferGeometryUtils.js";

const fbx = new FBXLoader();
const exporteur = new GLTFExporter();
const enBase64 = (tampon) => { const o = new Uint8Array(tampon); let s = ""; for (let i = 0; i < o.length; i += 0x8000) s += String.fromCharCode(...o.subarray(i, i + 0x8000)); return btoa(s); };
const exporter = (objet, animations = []) => exporteur.parseAsync(objet, { binary: true, animations, onlyVisible: false });
const trouver = (racine, motif) => { let r = null; racine.traverse((o) => { if (!r && o.isBone && motif.test(o.name)) r = o; }); return r; };

// Un robot : le modèle et son squelette, sans animation (les animations viennent du jeu partagé).
window.robotGLB = async (url, texture = null) => {
  const objet = await fbx.loadAsync(url);
  objet.animations = [];
  // Le FBX renvoyé par Mixamo ne référence souvent aucune texture (ou un chemin de l'ordinateur d'origine, introuvable) :
  // on pose l'image livrée à côté, sur le même dépliage UV. texture = une image pour tout le robot, ou
  // { nom du matériau : image } quand le modèle a plusieurs textures (ex. Optimus : torse et jambes).
  const valide = (t) => t && t.image && (t.image.width || t.image.data);
  objet.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) if (m) for (const k of ["map", "normalMap", "specularMap", "bumpMap", "emissiveMap", "alphaMap"]) if (m[k] && !valide(m[k])) m[k] = null; });
  // Squelettes en double (ex. Mechagodzilla : une copie des os par pièce, rangée sous l'os des hanches) : les animations
  // ne trouvent qu'une copie par nom et le reste du robot resterait en T. Les copies ont la même position que l'original :
  // on rattache chaque pièce au squelette principal, puis on retire les copies.
  objet.updateMatrixWorld(true);
  let racineOs = null; objet.traverse((o) => { if (!racineOs && o.isBone && !o.parent?.isBone) racineOs = o; });
  if (racineOs) {
    const canon = {}; const visiter = (b) => { canon[b.name] = b; for (const c of b.children) if (c.isBone && !(c.name in canon)) visiter(c); }; visiter(racineOs);
    const garder = new Set(Object.values(canon)); let rattaches = 0;
    objet.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      const os = o.skeleton.bones.map((b) => canon[b.name] || b);
      if (os.some((b, i) => b !== o.skeleton.bones[i])) { o.bind(new THREE.Skeleton(os, o.skeleton.boneInverses), o.bindMatrix); rattaches++; }
    });
    if (rattaches) {
      const doublons = []; objet.traverse((o) => { if (o.isBone && !garder.has(o) && garder.has(o.parent)) doublons.push(o); });
      doublons.forEach((d) => d.parent.remove(d));
      console.log(`squelette unifié : ${rattaches} pièce(s) rattachée(s), ${doublons.length} copie(s) retirée(s)`);
    }
  }
  // UV hors du carré [0,1] (ex. Mechagodzilla : v entre -1 et 0, reste d'une conversion glTF → FBX) : on les ramène
  // dans le carré, sinon la texture « colle au bord » et le robot sort uni et sombre
  objet.traverse((o) => {
    const uv = o.isMesh && o.geometry.attributes.uv; if (!uv) return;
    let mu = Infinity, mv = Infinity, xu = -Infinity, xv = -Infinity;
    for (let i = 0; i < uv.count; i++) { mu = Math.min(mu, uv.getX(i)); mv = Math.min(mv, uv.getY(i)); xu = Math.max(xu, uv.getX(i)); xv = Math.max(xv, uv.getY(i)); }
    const du = mu < 0 || xu > 1 ? -Math.floor(mu) : 0, dv = mv < 0 || xv > 1 ? -Math.floor(mv) : 0;
    if ((du || dv) && xu + du <= 1.001 && xv + dv <= 1.001) { for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + du, uv.getY(i) + dv); uv.needsUpdate = true; }
  });
  if (texture) {
    let deja = false; objet.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) if (m && valide(m.map)) deja = true; });
    if (!deja) {
      const charge = new Map(), lire = async (u) => { if (!charge.has(u)) { const t = await new THREE.TextureLoader().loadAsync(u); t.colorSpace = THREE.SRGBColorSpace; t.flipY = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; charge.set(u, t); } return charge.get(u); };
      const pour = (nom) => (typeof texture === "string" ? texture : texture[nom] ?? texture["*"]);   // "*" : tous les autres matériaux
      const maillages = []; objet.traverse((o) => { if (o.isMesh) maillages.push(o); });
      for (const o of maillages) {
        const liste = [];
        for (const m of [].concat(o.material)) {
          const u = pour(m?.name);
          if (!u) { console.warn(`pas de texture pour le matériau ${m?.name}`); liste.push(m); continue; }
          liste.push(new THREE.MeshStandardMaterial({ map: await lire(u), metalness: 0.6, roughness: 0.45, name: m?.name || "robot" }));
        }
        o.material = Array.isArray(o.material) ? liste : liste[0];
      }
    }
  }
  // le chargeur FBX donne des sommets non partagés (3 par triangle) : on fusionne les sommets identiques, fichier 2 à 4 fois plus léger
  objet.traverse((o) => { if (o.isMesh && !o.geometry.index) o.geometry = mergeVertices(o.geometry, 1e-5); });
  let maillages = 0, os = 0, textures = 0;
  objet.traverse((o) => {
    if (o.isMesh) { maillages++; for (const m of [].concat(o.material)) if (m && m.map) textures++; }
    if (o.isBone) os++;
  });
  const boite = new THREE.Box3().setFromObject(objet);
  const glb = await exporter(objet);
  return { glb: enBase64(glb), maillages, os, textures, hauteur: boite.getSize(new THREE.Vector3()).y, hanches: trouver(objet, /hips/i)?.name || null };
};

// Le jeu d'animations : le squelette du premier fichier et toutes les animations, chacune renommée comme son fichier.
// Pour chaque animation, l'instant où une main ou un pied va le plus loin vers l'avant : le moment du coup (« impact »).
window.animationsGLB = async (liste) => {
  const clips = [], impacts = {};
  let squelette = null;
  for (const { url, nom } of liste) {
    const objet = await fbx.loadAsync(url);
    if (!objet.animations.length) continue;
    const clip = objet.animations[0]; clip.name = nom;
    if (!squelette) squelette = objet;
    clips.push(clip);
  }
  if (!squelette) throw new Error("aucune animation trouvée");
  squelette.traverse((o) => { if (o.isMesh) o.visible = false; });
  const hanches = trouver(squelette, /hips/i);
  const bouts = [/righthand$/i, /lefthand$/i, /rightfoot$/i, /leftfoot$/i].map((m) => trouver(squelette, m)).filter(Boolean);
  const melangeur = new THREE.AnimationMixer(squelette);
  const p = new THREE.Vector3(), h = new THREE.Vector3();
  for (const clip of clips) {
    melangeur.stopAllAction();
    const a = melangeur.clipAction(clip); a.play();
    let meilleur = -Infinity, quand = 0;
    for (let t = 0; t <= clip.duration * 0.8; t += 1 / 30) {
      a.time = t; melangeur.update(0); squelette.updateMatrixWorld(true);
      if (!hanches) break;
      hanches.getWorldPosition(h);
      for (const b of bouts) { b.getWorldPosition(p); if (p.z - h.z > meilleur) { meilleur = p.z - h.z; quand = t; } }
    }
    impacts[clip.name] = Math.round(quand * 100) / 100;
    a.stop();
  }
  // le squelette seul : on retire les maillages du fichier (le robot vient de son propre fichier)
  const aRetirer = []; squelette.traverse((o) => { if (o.isMesh) aRetirer.push(o); });
  for (const m of aRetirer) m.parent.remove(m);
  const glb = await exporter(squelette, clips);
  return { glb: enBase64(glb), animations: clips.map((c) => ({ nom: c.name, duree: Math.round(c.duration * 100) / 100, impact: impacts[c.name] })) };
};
window.pret = true;
