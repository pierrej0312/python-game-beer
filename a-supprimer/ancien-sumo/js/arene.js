// L'arène du sumo : le quai de chargement surélevé, au milieu du hall de brassage de l'usine (même décor),
// et deux robots de manutention. Elle ne construit rien : elle rejoue un combat, tour par tour, à partir de son journal
// (moteur_combat.py, colonnes position_a, energie_a, action_a, valide_a...). Spécification : 04-jeu3-tournoi.md § 6 et § 10.
import * as THREE from "three";
import { OrbitControls } from "../../vendor/three/addons/OrbitControls.js";
import { RoundedBoxGeometry } from "../../vendor/three/addons/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "../../vendor/three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "../../vendor/three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "../../vendor/three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "../../vendor/three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "../../vendor/three/addons/postprocessing/OutputPass.js";
import { VignetteShader } from "../../vendor/three/addons/shaders/VignetteShader.js";
import { creerDecor } from "../usine/decor-usine.js";
import * as sons from "../commun/sons.js";

const CASE = 1.7;                 // largeur d'une case du quai
const HAUT = 0.9;                 // hauteur du quai
const COULEUR_A = 0xd9822b;       // robot A : peinture cuivre
const COULEUR_B = 0x3f7fb8;       // robot B : bleu acier
const NOMS_ACTIONS = { avancer: "avance", reculer: "recule", pousser: "pousse", ancrer: "s'ancre", recharger: "recharge" };
const RAISONS = { energie_insuffisante: "pas assez d'énergie", action_inconnue: "action inconnue" };

const attendre = (ms) => new Promise((ok) => setTimeout(ok, ms));
const lisser = (t) => t * t * (3 - 2 * t);

function toile(l, h, dessin) {
  const c = document.createElement("canvas"); c.width = l; c.height = h;
  dessin(c.getContext("2d"), l, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// ---------- le quai : béton lissé, cases numérotées, bandes jaunes et noires au bord ----------
function texQuai(n) {
  return toile(256 * n, 256, (c, l, h) => {
    c.fillStyle = "#8c8f96"; c.fillRect(0, 0, l, h);
    for (let i = 0; i < 2500; i++) { c.fillStyle = `rgba(${Math.random() < 0.5 ? "0,0,0" : "255,255,255"},${Math.random() * 0.05})`; c.fillRect(Math.random() * l, Math.random() * h, 3, 3); }
    for (let i = 0; i < n; i++) {
      c.strokeStyle = "rgba(30,32,38,0.55)"; c.lineWidth = 4; c.strokeRect(i * 256 + 2, 30, 252, h - 60);
      c.fillStyle = "rgba(255,255,255,0.75)"; c.font = "bold 64px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(String(i), i * 256 + 128, h / 2);
    }
    // bandes de sécurité devant et derrière
    for (const y of [0, h - 26]) for (let x = -26; x < l; x += 52) {
      c.fillStyle = "#f2c230"; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 26, y); c.lineTo(x + 52, y + 26); c.lineTo(x + 26, y + 26); c.fill();
      c.fillStyle = "#1d1e22"; c.beginPath(); c.moveTo(x + 26, y); c.lineTo(x + 52, y); c.lineTo(x + 78, y + 26); c.lineTo(x + 52, y + 26); c.fill();
    }
  });
}
function texBande() {
  return toile(256, 32, (c, l, h) => {
    for (let x = -32; x < l; x += 64) {
      c.fillStyle = "#f2c230"; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 32, 0); c.lineTo(x + 64, h); c.lineTo(x + 32, h); c.fill();
      c.fillStyle = "#1d1e22"; c.beginPath(); c.moveTo(x + 32, 0); c.lineTo(x + 64, 0); c.lineTo(x + 96, h); c.lineTo(x + 64, h); c.fill();
    }
  });
}
function texChenille() {
  const t = toile(64, 256, (c, l, h) => {
    c.fillStyle = "#1c1d21"; c.fillRect(0, 0, l, h);
    for (let y = 0; y < h; y += 16) { c.fillStyle = "#33353c"; c.fillRect(0, y, l, 7); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

// ---------- un robot de manutention : chenilles, châssis peint, mât, plaque de poussée sur vérin, yeux et jauge ----------
function fabriquerRobot(couleur) {
  const g = new THREE.Group();
  const peinture = new THREE.MeshStandardMaterial({ color: couleur, metalness: 0.55, roughness: 0.35 });
  const inox = new THREE.MeshStandardMaterial({ color: 0xdfe3ea, metalness: 0.95, roughness: 0.2 });
  const noir = new THREE.MeshStandardMaterial({ color: 0x22242a, metalness: 0.4, roughness: 0.6 });
  const chenille = new THREE.MeshStandardMaterial({ map: texChenille(), roughness: 0.85 });
  const yeux = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffd27a, emissiveIntensity: 2.2 });
  const ajouter = (o, x, y, z, parent = g) => { o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; };

  for (const z of [-0.48, 0.48]) ajouter(new THREE.Mesh(new RoundedBoxGeometry(1.25, 0.34, 0.26, 3, 0.12), chenille), 0, 0.17, z);
  ajouter(new THREE.Mesh(new RoundedBoxGeometry(1.1, 0.42, 0.78, 3, 0.08), peinture), 0, 0.5, 0);           // châssis
  ajouter(new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.62, 0.66, 3, 0.08), peinture), -0.18, 1.0, 0);      // cabine
  const visiere = ajouter(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.5), noir), 0.14, 1.1, 0);
  const oeilG = ajouter(new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), yeux), 0.18, 1.12, -0.13);
  const oeilD = ajouter(new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), yeux), 0.18, 1.12, 0.13);
  // le mât et la plaque de poussée, montée sur un vérin qui sort pendant la poussée
  ajouter(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 0.08), inox), 0.5, 0.75, -0.3);
  ajouter(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 0.08), inox), 0.5, 0.75, 0.3);
  const verin = ajouter(new THREE.Group(), 0.56, 0.62, 0);
  ajouter(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 12).rotateZ(Math.PI / 2), inox), 0.15, 0, 0, verin);
  const plaque = ajouter(new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.62, 0.86, 2, 0.03), inox), 0.32, 0, 0, verin);
  // la jauge d'énergie, au dos : dix segments
  const segments = [];
  for (let i = 0; i < 10; i++) {
    const m = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, emissive: 0x35d0ff, emissiveIntensity: 0 });
    segments.push(ajouter(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.045, 0.4), m), -0.5, 0.78 + i * 0.058, 0));
  }
  // l'ancrage : quatre pieds qui descendent et un halo au sol
  const pieds = [];
  for (const [x, z] of [[-0.42, -0.3], [-0.42, 0.3], [0.32, -0.3], [0.32, 0.3]]) pieds.push(ajouter(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.3, 10), inox), x, 0.25, z));
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.85, 40), new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  halo.rotation.x = -Math.PI / 2; halo.position.y = 0.02; g.add(halo);
  g.userData = { verin, plaque, segments, pieds, halo, yeux, oeilG, oeilD, visiere, chenille };
  return g;
}

export function creerArene(conteneur, { qualite = "haute", taille = 9 } = {}) {
  const haute = qualite === "haute";
  const rendu = new THREE.WebGLRenderer({ antialias: true });
  rendu.setPixelRatio(Math.min(window.devicePixelRatio || 1, haute ? 2 : 1));
  rendu.outputColorSpace = THREE.SRGBColorSpace;
  rendu.toneMapping = THREE.ACESFilmicToneMapping; rendu.toneMappingExposure = 0.95;
  rendu.shadowMap.enabled = haute; rendu.shadowMap.type = THREE.VSMShadowMap;
  conteneur.appendChild(rendu.domElement);
  rendu.domElement.classList.add("toile-arene");

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1b1c22);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 300);
  camera.position.set(0, 7.2, 13.2);
  const controles = new OrbitControls(camera, rendu.domElement);
  controles.target.set(0, HAUT, 0); controles.enableDamping = true;
  controles.minDistance = 7; controles.maxDistance = 34; controles.maxPolarAngle = 1.35; controles.update();

  let composeur = null;
  if (haute) {
    composeur = new EffectComposer(rendu);
    composeur.addPass(new RenderPass(scene, camera));
    composeur.addPass(new UnrealBloomPass(new THREE.Vector2(512, 512), 0.35, 0.4, 0.88));
    const v = new ShaderPass(VignetteShader); v.uniforms.offset.value = 0.95; v.uniforms.darkness.value = 1.2; composeur.addPass(v);
    composeur.addPass(new OutputPass());
  }

  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x30323c, 0.75));
  const soleil = new THREE.DirectionalLight(0xffe2b8, 1.7);
  soleil.position.set(-10, 20, 12); soleil.castShadow = true;
  soleil.shadow.mapSize.set(haute ? 2048 : 1024, haute ? 2048 : 1024); soleil.shadow.radius = 5; soleil.shadow.blurSamples = 10; soleil.shadow.bias = -0.0005;
  Object.assign(soleil.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 60 });
  scene.add(soleil);
  const pmrem = new THREE.PMREMGenerator(rendu);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  // le hall : le décor de l'usine, autour d'une étendue un peu plus large que le quai
  const demi = (taille * CASE) / 2;
  const decor = creerDecor({ x1: -demi - 2, x2: demi + 2, z1: -3.5, z2: 3 }, { qualite, depart: { x: -demi - 6, z: 4 } });
  scene.add(decor.groupe);

  // le quai
  const xCase = (i) => (i - (taille - 1) / 2) * CASE;
  const quai = new THREE.Mesh(new THREE.BoxGeometry(taille * CASE, HAUT, 2.6),
    [new THREE.MeshStandardMaterial({ map: texBande(), roughness: 0.6 }), new THREE.MeshStandardMaterial({ map: texBande(), roughness: 0.6 }),
      new THREE.MeshStandardMaterial({ map: texQuai(taille), roughness: 0.35, metalness: 0.1 }), new THREE.MeshStandardMaterial({ color: 0x55585f }),
      new THREE.MeshStandardMaterial({ color: 0x6d7078, roughness: 0.8 }), new THREE.MeshStandardMaterial({ color: 0x6d7078, roughness: 0.8 })]);
  quai.position.y = HAUT / 2; quai.receiveShadow = true; quai.castShadow = true; scene.add(quai);
  // fûts et casiers autour du quai : ils roulent quand un robot tombe
  const matFut = new THREE.MeshStandardMaterial({ color: 0xdfe3ea, metalness: 0.95, roughness: 0.2 });
  const matCasier = new THREE.MeshStandardMaterial({ color: 0xc2323a, roughness: 0.55 });
  const futs = [];
  for (const [x, z] of [[-demi - 1.2, -1.4], [-demi - 1.0, 0.2], [demi + 1.1, -1.2], [demi + 1.3, 0.5], [-demi - 2.2, -0.6], [demi + 2.3, -0.4]]) {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.9, 24), matFut); f.position.set(x, 0.45, z); f.castShadow = f.receiveShadow = true;
    f.userData.depart = f.position.clone(); scene.add(f); futs.push(f);
  }
  // des piles de casiers derrière le quai
  for (const x of [-demi + 1.2, -1.5, demi - 1.6]) for (let n = 0; n < 4; n++) {
    const c = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.32, 0.5, 2, 0.04), matCasier);
    c.position.set(x + (n % 2) * 0.75, 0.16 + Math.floor(n / 2) * 0.33, -2.1); c.castShadow = c.receiveShadow = true; scene.add(c);
  }
  // les projecteurs : un par robot ; l'éclair de la poussée
  const projA = new THREE.SpotLight(0xffd6a0, haute ? 60 : 30, 22, 0.32, 0.6, 1.4), projB = new THREE.SpotLight(0xcfe4ff, haute ? 60 : 30, 22, 0.32, 0.6, 1.4);
  projA.position.set(-3, 10, 4); projB.position.set(3, 10, 4); scene.add(projA, projB, projA.target, projB.target);
  const eclair = new THREE.PointLight(0xfff0c0, 0, 7, 1.6); scene.add(eclair);

  const robots = { a: fabriquerRobot(COULEUR_A), b: fabriquerRobot(COULEUR_B) };
  robots.b.rotation.y = Math.PI;              // B regarde vers la gauche
  robots.a.scale.setScalar(1.3); robots.b.scale.setScalar(1.3);
  scene.add(robots.a, robots.b);

  // ---------- le panneau de bord (HTML par-dessus la scène) ----------
  const hud = document.createElement("div"); hud.className = "arene-hud";
  hud.innerHTML = `<div class="arene-tour" data-r="tour"></div>
    <div class="arene-carte a"><div class="nom" data-r="nomA"></div><div class="jauge"><span data-r="jaugeA"></span></div><div class="action" data-r="actionA"></div></div>
    <div class="arene-carte b"><div class="nom" data-r="nomB"></div><div class="jauge"><span data-r="jaugeB"></span></div><div class="action" data-r="actionB"></div></div>
    <div class="arene-fin" data-r="fin" hidden></div>`;
  conteneur.appendChild(hud);
  const R = Object.fromEntries([...hud.querySelectorAll("[data-r]")].map((e) => [e.dataset.r, e]));

  // ---------- état et animation ----------
  let regles = { TAILLE_PLATEFORME: taille, DEPART_A: 3, DEPART_B: 5, ENERGIE_DEPART: 5, ENERGIE_MAX: 10, POUSSEE: 2, POUSSEE_ANCRE: 0, TOURS_MAX: 40 };
  let combat = null, numero = 0, enCours = false, pause = false, arret = false, vitesse = 1;
  const anims = [];                   // fonctions (t) appelées à chaque image ; renvoient true quand elles sont finies
  const animer = (duree, f) => new Promise((ok) => {
    const debut = performance.now();
    anims.push((t) => { const k = Math.min(1, (t - debut) / (duree / vitesse)); f(lisser(k), k); if (k >= 1) { ok(); return true; } return false; });
  });

  function poser(cote, position, energie, { ancre = false } = {}) {
    const r = robots[cote];
    r.position.set(xCase(position), HAUT, 0); r.rotation.set(0, cote === "a" ? 0 : Math.PI, 0);
    r.userData.position = position;
    jauge(cote, energie);
    r.userData.pieds.forEach((p) => { p.position.y = ancre ? 0.05 : 0.25; });
    r.userData.halo.material.opacity = ancre ? 0.8 : 0;
    r.userData.verin.position.x = 0.56;
    r.visible = true;
  }
  function jauge(cote, energie) {
    const max = regles.ENERGIE_MAX;
    robots[cote].userData.segments.forEach((s, i) => { s.material.emissiveIntensity = i < energie ? 2.2 : 0; s.material.emissive.setHex(energie <= 2 ? 0xff5a4a : 0x35d0ff); });
    robots[cote].userData.yeux.emissiveIntensity = energie === 0 ? 0.15 : 2.2;
    R[cote === "a" ? "jaugeA" : "jaugeB"].style.width = `${(100 * energie) / max}%`;
  }
  function texteAction(l, cote) {
    const action = l[`action_${cote}`], valide = l[`valide_${cote}`], raison = l[`raison_${cote}`] || "";
    if (valide) return NOMS_ACTIONS[action] || action;
    if (raison.startsWith("exception:")) return `plante : ${raison.slice(10, 70)}`;
    if (raison.startsWith("pas_une_chaine")) return "ne renvoie pas une action (texte)";
    return `${action ?? "rien"} refusé : ${RAISONS[raison] || raison}`;
  }

  // Résolution d'un tour, comme moteur_combat.py : sert à montrer l'étape intermédiaire (après les déplacements, avant la poussée).
  function resoudre(av, l) {
    const fa = l.valide_a ? l.action_a : null, fb = l.valide_b ? l.action_b : null;
    let va = av.a + ({ avancer: 1, reculer: -1 }[fa] || 0), vb = av.b + ({ avancer: -1, reculer: 1 }[fb] || 0);
    if (va >= vb) {
      if (fa === "avancer") va = av.a;
      if (fb === "avancer") vb = av.b;
      if (va >= vb) { va = av.a; vb = av.b; }
    }
    const contact = vb - va === 1;
    const pa = fa === "pousser" && contact, pb = fb === "pousser" && contact;
    return { deplace: { a: va, b: vb }, pousseur: pa && !pb ? "a" : pb && !pa ? "b" : null, annule: pa && pb };
  }

  async function glisser(cote, versCase, duree) {
    const r = robots[cote], de = r.position.x, a = xCase(versCase), tex = r.userData.chenille.map;
    await animer(duree, (k) => { r.position.x = de + (a - de) * k; tex.offset.y = (de + (a - de) * k) * 0.6 * (cote === "a" ? 1 : -1); });
    r.userData.position = versCase;
  }
  async function pousser(cote, duree) {
    const v = robots[cote].userData.verin;
    await animer(duree * 0.35, (k) => { v.position.x = 0.56 + 0.55 * k; });
    eclair.position.set(robots[cote].position.x + (cote === "a" ? 1.1 : -1.1), HAUT + 0.8, 0); eclair.intensity = 40;
    sons.jouer("choc");
    animer(duree * 0.6, (k) => { eclair.intensity = 40 * (1 - k); v.position.x = 1.11 - 0.55 * k; });
  }
  async function secouer(cote, duree) {
    const r = robots[cote], y0 = r.rotation.y;
    await animer(duree, (k) => { r.rotation.y = y0 + Math.sin(k * Math.PI * 4) * 0.12 * (1 - k); });
    r.rotation.y = y0;
  }
  async function tomber(cote, duree) {
    const r = robots[cote], sens = cote === "a" ? -1 : 1, x0 = r.position.x;
    sons.jouer("rate");
    await animer(duree * 1.4, (k) => {
      r.position.x = x0 + sens * k * 1.6; r.position.y = HAUT - k * k * (HAUT + 0.1);
      r.rotation.z = -sens * k * 1.2 * (cote === "a" ? 1 : -1);
    });
    for (const f of futs) {
      if (Math.sign(f.position.x) !== sens) continue;
      const d = f.userData.depart, dx = sens * (0.8 + Math.random());
      animer(duree * 2, (k) => { f.position.x = d.x + dx * k; f.rotation.x = k * 3; f.rotation.z = Math.PI / 2 * Math.min(1, k * 3); f.position.y = 0.36 + (0.45 - 0.36) * (1 - Math.min(1, k * 3)); });
    }
  }

  async function jouerTour(k) {
    const j = combat.journal, l = j[k];
    const avant = k === 0 ? { a: regles.DEPART_A, b: regles.DEPART_B, ea: regles.ENERGIE_DEPART, eb: regles.ENERGIE_DEPART }
      : { a: j[k - 1].position_a, b: j[k - 1].position_b, ea: j[k - 1].energie_a, eb: j[k - 1].energie_b };
    const D = 900;
    R.tour.textContent = `Tour ${l.tour} sur ${regles.TOURS_MAX}`;
    R.actionA.textContent = texteAction(l, "a"); R.actionB.textContent = texteAction(l, "b");
    R.actionA.classList.toggle("refus", !l.valide_a); R.actionB.classList.toggle("refus", !l.valide_b);
    // 1. les refus et les ancrages
    const refus = [];
    for (const c of ["a", "b"]) if (!l[`valide_${c}`]) refus.push(secouer(c, D * 0.4));
    for (const c of ["a", "b"]) {
      const ancre = l[`ancre_${c}`], u = robots[c].userData;
      if (ancre) animer(D * 0.3, (t) => { u.pieds.forEach((p) => { p.position.y = 0.25 - 0.2 * t; }); u.halo.material.opacity = 0.8 * t; });
      else if (u.halo.material.opacity > 0) animer(D * 0.3, (t) => { u.pieds.forEach((p) => { p.position.y = 0.05 + 0.2 * t; }); u.halo.material.opacity = 0.8 * (1 - t); });
    }
    await Promise.all(refus);
    // 2. les déplacements
    const r = resoudre(avant, l);
    await Promise.all(["a", "b"].map((c) => (r.deplace[c] !== avant[c] ? glisser(c, r.deplace[c], D * 0.4) : null)));
    // 3. la poussée
    const finA = l.position_a, finB = l.position_b;
    if (r.annule) { await Promise.all([pousser("a", D * 0.5), pousser("b", D * 0.5)]); }
    else if (r.pousseur) {
      const cible = r.pousseur === "a" ? "b" : "a", fin = cible === "a" ? finA : finB;
      await pousser(r.pousseur, D * 0.5);
      if (fin !== r.deplace[cible]) await glisser(cible, Math.max(-1, Math.min(taille, fin)), D * 0.4);
      else await secouer(cible, D * 0.3);
    }
    // si le calcul local ne retombe pas sur le journal, le journal a raison
    for (const [c, fin] of [["a", finA], ["b", finB]]) if (robots[c].userData.position !== fin && fin >= 0 && fin < taille) await glisser(c, fin, D * 0.3);
    // 4. l'énergie (recharges et dépenses)
    jauge("a", l.energie_a); jauge("b", l.energie_b);
    // 5. la chute
    const dehors = (p) => p < 0 || p >= taille;
    await Promise.all([dehors(finA) ? tomber("a", D) : null, dehors(finB) ? tomber("b", D) : null]);
    if (l.vainqueur) finir(l);
    else await attendre(D * 0.25 / vitesse);
  }

  function finir(l) {
    const noms = { a: combat.nomA, b: combat.nomB };
    const fin = l.fin === "sortie" ? "un robot est sorti du quai" : `${regles.TOURS_MAX} tours joués, le plus proche du centre l'emporte`;
    R.fin.textContent = l.vainqueur === "egalite" ? `Égalité (${fin})` : `Victoire de ${noms[l.vainqueur]} (${fin})`;
    R.fin.hidden = false;
    if (l.vainqueur !== "egalite") {
      const g = l.vainqueur, p = g === "a" ? "b" : "a";
      (g === "a" ? projA : projB).intensity *= 1.8; (p === "a" ? projA : projB).intensity = 0;
      sons.jouer("victoire");
    }
  }

  // ---------- l'interface publique ----------
  function charger(c, r = null) {
    if (r) regles = { ...regles, ...r };
    combat = c; numero = 0; arret = true;
    anims.length = 0;
    poser("a", regles.DEPART_A, regles.ENERGIE_DEPART); poser("b", regles.DEPART_B, regles.ENERGIE_DEPART);
    for (const f of futs) { f.position.copy(f.userData.depart); f.rotation.set(0, 0, 0); }
    projA.intensity = projB.intensity = haute ? 60 : 30;
    R.nomA.textContent = c.nomA; R.nomB.textContent = c.nomB;
    R.actionA.textContent = R.actionB.textContent = ""; R.fin.hidden = true;
    R.tour.textContent = `Tour 0 sur ${regles.TOURS_MAX}`;
  }
  async function jouer({ depuis = 0 } = {}) {
    if (!combat || enCours) return;
    if (depuis === 0) charger(combat);
    enCours = true; arret = false;
    try {
      for (numero = depuis; numero < combat.journal.length && !arret; numero++) {
        while (pause && !arret) await attendre(100);
        if (arret) break;
        await jouerTour(numero);
      }
    } finally { enCours = false; }
  }
  // Va directement au tour k (sans animation) : la position et l'énergie après ce tour.
  function allerAuTour(k) {
    if (!combat) return;
    arret = true; anims.length = 0;
    const l = combat.journal[Math.max(0, Math.min(k, combat.journal.length - 1))];
    charger(combat);
    const dedans = (p) => Math.max(0, Math.min(taille - 1, p));
    poser("a", dedans(l.position_a), l.energie_a, { ancre: l.ancre_a }); poser("b", dedans(l.position_b), l.energie_b, { ancre: l.ancre_b });
    robots.a.visible = l.position_a >= 0 && l.position_a < taille; robots.b.visible = l.position_b >= 0 && l.position_b < taille;
    R.tour.textContent = `Tour ${l.tour} sur ${regles.TOURS_MAX}`;
    R.actionA.textContent = texteAction(l, "a"); R.actionB.textContent = texteAction(l, "b");
    if (l.vainqueur) finir(l);
    numero = k + 1;
  }

  // ---------- la boucle d'affichage ----------
  let derniere = performance.now(), vivant = true;
  function boucle(t) {
    if (!vivant) return;
    requestAnimationFrame(boucle);
    const dt = t - derniere; derniere = t;
    for (let i = anims.length - 1; i >= 0; i--) if (anims[i](t)) anims.splice(i, 1);
    projA.target.position.copy(robots.a.position); projB.target.position.copy(robots.b.position);
    for (const c of ["a", "b"]) { const u = robots[c].userData; u.halo.rotation.z += dt * 0.002; }
    decor.animer(t, dt);
    controles.update();
    if (composeur) composeur.render(); else rendu.render(scene, camera);
  }
  // le quai entier dans le cadre, quelle que soit la forme de la vue : la caméra recule ou avance sur l'axe de visée
  const VISEE = new THREE.Vector3(0, 0.5, 1).normalize();
  function cadrer(l, h) {
    const largeur = taille * CASE + 1, vfov = THREE.MathUtils.degToRad(camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * (l / h));
    const d = Math.max((largeur / 2) / Math.tan(hfov / 2), 3.5 / Math.tan(vfov / 2));
    camera.position.copy(VISEE).multiplyScalar(d).add(new THREE.Vector3(0, HAUT, 0));
    controles.target.set(0, HAUT, 0); controles.update();
  }
  function redimensionner() {
    const l = conteneur.clientWidth || 800, h = conteneur.clientHeight || 500;
    rendu.setSize(l, h, false); camera.aspect = l / h; camera.updateProjectionMatrix(); cadrer(l, h);
    if (composeur) composeur.setSize(l, h);
  }
  const obs = new ResizeObserver(redimensionner); obs.observe(conteneur); redimensionner();
  requestAnimationFrame(boucle);
  poser("a", regles.DEPART_A, regles.ENERGIE_DEPART); poser("b", regles.DEPART_B, regles.ENERGIE_DEPART);

  return {
    charger, jouer, allerAuTour,
    arreter() { arret = true; },
    pause(oui) { pause = oui; },
    rapide(oui) { vitesse = oui ? 3 : 1; },
    tourCourant: () => numero,
    enCours: () => enCours,
    detruire() { vivant = false; obs.disconnect(); rendu.dispose(); conteneur.innerHTML = ""; },
  };
}
