// Le ring du championnat, au milieu du hall de brassage (décor de l'usine) : tapis, poteaux, cordes, projecteurs,
// deux robots de combat, effets des coups et panneau de bord façon jeu de combat (vie, énergie, chrono, annonces).
// Il ne calcule rien : il montre les lignes du journal du combat (moteur.py ou moteur.js), instant par instant.
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
import { fabriquerRobot } from "./robot3d.js";
import { chargerRobot } from "./robot-modele.js";
import { creerEffetsCombat } from "./effets-combat.js";
import { R } from "./regles.js";
import * as sons from "../commun/sons.js";

const SOL = 0.7;                                   // hauteur du tapis
const X = (cm) => (cm - R.RING / 2) / 100;          // position du moteur (cm) → mètres, centre du ring en 0
export const COULEURS = { a: 0xd9822b, b: 0x3f7fb8 };   // cuivre, bleu acier
const ANNONCES = { contre: "CONTRE !", bloque: "BLOQUÉ", esquive: "ESQUIVÉ" };

function toile(l, h, dessin) {
  const c = document.createElement("canvas"); c.width = l; c.height = h;
  dessin(c.getContext("2d"), l, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

function fabriquerRing(scene, ombres) {
  const g = new THREE.Group(); scene.add(g);
  const tapis = toile(1024, 1024, (c, l, h) => {
    c.fillStyle = "#2a2c34"; c.fillRect(0, 0, l, h);
    for (let i = 0; i < 6000; i++) { c.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`; c.fillRect(Math.random() * l, Math.random() * h, 2, 2); }
    c.strokeStyle = "#c27a3e"; c.lineWidth = 14; c.strokeRect(40, 40, l - 80, h - 80);
    c.beginPath(); c.arc(l / 2, h / 2, 190, 0, Math.PI * 2); c.lineWidth = 10; c.stroke();
    c.fillStyle = "rgba(242,184,46,0.85)"; c.font = "bold 92px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText("FONDERIE", l / 2, h / 2 - 20);
    c.font = "bold 38px sans-serif"; c.fillStyle = "rgba(255,255,255,0.7)"; c.fillText("CHAMPIONNAT DES ROBOTS", l / 2, h / 2 + 60);
  });
  const jupe = toile(1024, 128, (c, l, h) => {
    c.fillStyle = "#1b1c22"; c.fillRect(0, 0, l, h);
    c.fillStyle = "#c27a3e"; c.fillRect(0, 0, l, 8); c.fillRect(0, h - 8, l, 8);
    c.fillStyle = "#f2b82e"; c.font = "bold 60px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText("CHAMPIONNAT DES ROBOTS · BRASSERIE DE LA FONDERIE", l / 2, h / 2);
  });
  const L = 12.2;
  const socle = new THREE.Mesh(new THREE.BoxGeometry(L, SOL, L),
    [new THREE.MeshStandardMaterial({ map: jupe }), new THREE.MeshStandardMaterial({ map: jupe }),
      new THREE.MeshStandardMaterial({ map: tapis, roughness: 0.85 }), new THREE.MeshStandardMaterial({ color: 0x111111 }),
      new THREE.MeshStandardMaterial({ map: jupe }), new THREE.MeshStandardMaterial({ map: jupe })]);
  socle.position.y = SOL / 2; socle.receiveShadow = ombres; g.add(socle);
  const acier = new THREE.MeshStandardMaterial({ color: 0xcfd4dc, metalness: 0.95, roughness: 0.2 });
  const cuivre = new THREE.MeshStandardMaterial({ color: 0xc27a3e, metalness: 0.7, roughness: 0.3 });
  const coin = L / 2 - 0.35;
  for (const [x, z] of [[-coin, -coin], [coin, -coin], [-coin, coin], [coin, coin]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 1.7, 16), acier); p.position.set(x, SOL + 0.85, z); p.castShadow = ombres; g.add(p);
    const t = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.4, 0.34, 2, 0.06), new THREE.MeshStandardMaterial({ color: x < 0 ? 0xd9822b : 0x3f7fb8, roughness: 0.5 }));
    t.position.set(x, SOL + 1.2, z); g.add(t);
  }
  for (const h of [0.55, 1.0, 1.45]) {
    // pas de cordes du côté de la caméra : elles passeraient devant les robots
    for (const [x1, z1, x2, z2] of [[-coin, -coin, coin, -coin], [-coin, -coin, -coin, coin], [coin, -coin, coin, coin]]) {
      const lg = Math.hypot(x2 - x1, z2 - z1);
      const corde = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, lg, 8), h === 1.0 ? acier : cuivre);
      corde.position.set((x1 + x2) / 2, SOL + h, (z1 + z2) / 2);
      corde.rotation.set(z1 === z2 ? 0 : Math.PI / 2, 0, z1 === z2 ? Math.PI / 2 : 0);
      g.add(corde);
    }
  }
  // marches et fûts autour du ring
  const fut = new THREE.MeshStandardMaterial({ color: 0xdfe3ea, metalness: 0.95, roughness: 0.2 });
  for (const [x, z] of [[-7.4, -3], [-7.6, -1.9], [-7.3, 2.6], [7.5, -2.8], [7.3, 2.2], [7.6, 3.2]]) {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.9, 24), fut); f.position.set(x, 0.45, z); f.castShadow = ombres; g.add(f);
  }
  return g;
}

// ---------- les étincelles, le bouclier, les textes qui sautent ----------
function creerEffets(scene) {
  const n = 80, geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), vit = new Float32Array(n * 3), vie = new Float32Array(n);
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffd27a, size: 0.09, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  points.frustumCulled = false; scene.add(points);
  const bouclier = new THREE.Mesh(new THREE.CircleGeometry(0.75, 6), new THREE.MeshBasicMaterial({ color: 0x6fd8ff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  bouclier.rotation.y = Math.PI / 2; scene.add(bouclier);
  const eclair = new THREE.PointLight(0xffe0a0, 0, 6, 1.5); scene.add(eclair);
  let suivant = 0;
  return {
    etincelles(x, y, nombre = 24, force = 1) {
      for (let i = 0; i < nombre; i++) {
        const k = suivant++ % n;
        pos.set([x, y, (Math.random() - 0.5) * 0.3], k * 3);
        vit.set([(Math.random() - 0.5) * 6 * force, Math.random() * 4 * force, (Math.random() - 0.5) * 5 * force], k * 3);
        vie[k] = 0.45 + Math.random() * 0.3;
      }
      eclair.position.set(x, y, 0.6); eclair.intensity = 25 * force;
    },
    bouclier(x, y) { bouclier.position.set(x, y, 0); bouclier.material.opacity = 0.75; },
    anime(dt) {
      for (let k = 0; k < n; k++) {
        if (vie[k] <= 0) { pos[k * 3 + 1] = -50; continue; }
        vie[k] -= dt; vit[k * 3 + 1] -= 9 * dt;
        for (let j = 0; j < 3; j++) pos[k * 3 + j] += vit[k * 3 + j] * dt;
      }
      geo.attributes.position.needsUpdate = true;
      bouclier.material.opacity = Math.max(0, bouclier.material.opacity - dt * 3);
      eclair.intensity = Math.max(0, eclair.intensity - dt * 120);
    },
  };
}

export function creerRing(conteneur, { qualite = "haute" } = {}) {
  const haute = qualite === "haute";
  const rendu = new THREE.WebGLRenderer({ antialias: true });
  rendu.setPixelRatio(Math.min(window.devicePixelRatio || 1, haute ? 2 : 1));
  rendu.outputColorSpace = THREE.SRGBColorSpace; rendu.toneMapping = THREE.ACESFilmicToneMapping; rendu.toneMappingExposure = 0.95;
  rendu.shadowMap.enabled = haute; rendu.shadowMap.type = THREE.VSMShadowMap;
  conteneur.appendChild(rendu.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x15161b);
  scene.fog = new THREE.Fog(0x15161b, 26, 60);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 300); camera.position.set(0, 3.2, 11);
  const controles = new OrbitControls(camera, rendu.domElement);
  controles.enableDamping = true; controles.enablePan = false; controles.minDistance = 5; controles.maxDistance = 30; controles.maxPolarAngle = 1.45;
  let composeur = null;
  if (haute) {
    composeur = new EffectComposer(rendu); composeur.addPass(new RenderPass(scene, camera));
    composeur.addPass(new UnrealBloomPass(new THREE.Vector2(512, 512), 0.55, 0.45, 0.82));
    const v = new ShaderPass(VignetteShader); v.uniforms.offset.value = 0.95; v.uniforms.darkness.value = 1.3; composeur.addPass(v);
    composeur.addPass(new OutputPass());
  }
  scene.add(new THREE.HemisphereLight(0xfff0dc, 0x2a2c34, 0.55));
  const soleil = new THREE.DirectionalLight(0xffe2b8, 1.2); soleil.position.set(-8, 18, 10); soleil.castShadow = haute;
  soleil.shadow.mapSize.set(2048, 2048); soleil.shadow.radius = 5; soleil.shadow.blurSamples = 10; soleil.shadow.bias = -0.0005;
  Object.assign(soleil.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 50 }); scene.add(soleil);
  // les projecteurs au-dessus du ring
  for (const [x, couleur] of [[-3, 0xffd6a0], [3, 0xcfe4ff], [0, 0xffffff]]) {
    const s = new THREE.SpotLight(couleur, haute ? 140 : 70, 30, 0.45, 0.5, 1.2); s.position.set(x, 11, 3); s.target.position.set(x * 0.4, SOL, 0);
    s.castShadow = haute && x === 0; scene.add(s, s.target);
  }
  const pmrem = new THREE.PMREMGenerator(rendu);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.6;
  const decor = creerDecor({ x1: -8.5, x2: 8.5, z1: -7, z2: 3 }, { qualite, depart: { x: -12, z: 6 } });
  scene.add(decor.groupe);
  fabriquerRing(scene, haute);
  const effets = creerEffets(scene);
  const fx = creerEffetsCombat(scene, { haute });

  const robots = { a: fabriquerRobot(COULEURS.a, { qualite }), b: fabriquerRobot(COULEURS.b, { qualite }) };
  robots.a.id = robots.b.id = "simple";
  scene.add(robots.a.objet, robots.b.objet);

  // ---------- le panneau de bord ----------
  const hud = document.createElement("div"); hud.className = "ring-hud";
  hud.innerHTML = `<div class="barre a"><div class="nom" data-r="nomA"></div><div class="vie"><span data-r="vieA"></span><i data-r="degatA"></i></div><div class="energie"><span data-r="enA"></span></div></div>
    <div class="chrono" data-r="chrono">60</div>
    <div class="barre b"><div class="nom" data-r="nomB"></div><div class="vie"><span data-r="vieB"></span><i data-r="degatB"></i></div><div class="energie"><span data-r="enB"></span></div></div>
    <div class="annonce" data-r="annonce"></div><div class="petite a" data-r="petiteA"></div><div class="petite b" data-r="petiteB"></div>`;
  conteneur.appendChild(hud);
  const H = Object.fromEntries([...hud.querySelectorAll("[data-r]")].map((e) => [e.dataset.r, e]));
  let annonceJusqua = 0;
  function annonce(texte, duree = 1.4, classe = "") {
    H.annonce.textContent = texte; H.annonce.className = "annonce visible " + classe; annonceJusqua = performance.now() + duree * 1000;
  }
  function petite(cote, texte) {
    const e = cote === "a" ? H.petiteA : H.petiteB; e.textContent = texte; e.classList.remove("visible"); void e.offsetWidth; e.classList.add("visible");
  }
  function barres(l) {
    for (const c of ["a", "b"]) {
      const C = c.toUpperCase();
      H[`vie${C}`].style.width = `${l[`vie_${c}`]}%`;
      H[`en${C}`].style.width = `${l[`energie_${c}`]}%`;
      robots[c].energie(l[`energie_${c}`]);
    }
    H.chrono.textContent = String(Math.max(0, Math.ceil((R.DUREE_MAX - l.tick) / R.TICKS_PAR_SECONDE)));
  }
  // la barre rouge qui suit la vie avec un temps de retard (comme dans les jeux de combat)
  const retard = { a: 100, b: 100 };

  // ---------- montrer une ligne du journal ----------
  const etat = { avant: null, ligne: null, debut: 0, duree: 100, fini: null, secousse: 0, ralenti: 1 };
  const dans = { a: { phase: "", depuis: 0 }, b: { phase: "", depuis: 0 } };
  function montrer(l, dureeMs = 1000 / R.TICKS_PAR_SECONDE) {
    etat.avant = etat.ligne || l; etat.ligne = l; etat.debut = performance.now(); etat.duree = dureeMs;
    for (const c of ["a", "b"]) {
      const phase = l[`phase_${c}`], action = l[`action_${c}`], robot = robots[c];
      const sens = c === "a" ? 1 : -1;
      if (robot.phase) robot.phase(phase, action, dureeMs);
      else if (phase === "preparation") robot.pose(`${action}_preparation`, 9);
      else if (phase === "frappe") robot.pose(`${action}_frappe`, 32);
      else if (phase === "recuperation") robot.pose("base", 5);
      else if (phase === "garde") robot.pose("garde", 18);
      else if (phase === "garde_basse") robot.pose("garde_basse", 18);
      else if (phase === "avance") robot.pose("base", 10, 1);
      else if (phase === "recul") robot.pose("base", 10, -1);
      else if (phase === "esquive") robot.pose("esquive", 16, -0.6);
      else if (phase === "sonne") robot.pose("sonne", 14);
      else robot.pose("base", 8);
      // les effets des coups
      const effet = l[`effet_${c}`], autre = c === "a" ? "b" : "a";
      const xc = X(l[`position_${autre}`]) - sens * 0.35;
      if ((effet === "touche" || effet === "contre" || effet === "bloque") && robots[autre].reaction) robots[autre].reaction(effet === "bloque" ? "bloque" : action === "projection" ? "projete" : effet === "contre" || action === "crochet" || action === "special" ? "touche_fort" : "touche");
      // les effets liés au moment du coup
      const hauteur = { coup_bas: 0.35, projection: 1.3, special: 1.9 }[action] ?? 1.75;
      if (phase === "preparation" && action === "special" && dans[c].phase !== "preparation")
        fx.aura(robot.objet, COULEURS[c], (R.COUPS.special.preparation * dureeMs) / 1000);
      if (phase === "frappe") fx.trainee(X(l[`position_${c}`]) + sens * 0.3, X(l[`position_${autre}`]) - sens * 0.2, SOL + hauteur, COULEURS[c], effet === "rate" ? 0.03 : 0.07);
      if (effet === "touche" || effet === "contre") {
        fx.flash(robots[autre].objet, effet === "contre" ? 1.5 : 1);
        if (action === "special") fx.onde(X(l[`position_${autre}`]), SOL);
        if (action === "projection") { fx.poussiere(X(l[`position_${autre}`]), SOL); fx.onde(X(l[`position_${autre}`]), SOL, 0xd8c8a8); }
      }
      if (action === "coup_bas" && (effet === "touche" || effet === "contre" || effet === "bloque")) fx.poussiere(X(l[`position_${autre}`]), SOL);
      if (phase === "sonne" && Math.random() < 0.5) fx.arcs(X(l[`position_${c}`]), SOL + 2.0);
      dans[c].phase = phase;
      if (effet === "touche" || effet === "contre") {
        const force = { direct: 0.7, crochet: 1.1, coup_bas: 0.9, projection: 1.0, special: 1.6 }[action] || 1;
        effets.etincelles(xc, SOL + (action === "special" ? 1.9 : action === "projection" ? 1.3 : action === "coup_bas" ? 0.35 : 1.75), effet === "contre" ? 36 : 22, force);
        etat.secousse = Math.max(etat.secousse, 0.06 * force * (effet === "contre" ? 1.5 : 1));
        sons.impact(force * (effet === "contre" ? 1.2 : 1));
        if (effet === "contre") petite(c, "CONTRE !");
        if (action === "special") annonce("COUP SPÉCIAL !", 1.0, "special");
      } else if (effet === "bloque") { effets.bouclier(xc, SOL + (action === "coup_bas" || action === "projection" ? 0.6 : 1.6)); petite(autre, ANNONCES.bloque); sons.impact(0.5, true); }
      else if (effet === "esquive") petite(autre, ANNONCES.esquive);
    }
    barres(l);
    if (l.vainqueur) finir(l);
  }
  function finir(l) {
    const noms = { a: H.nomA.textContent, b: H.nomB.textContent };
    etat.fini = l;
    if (l.fin === "ko") { annonce("K.-O. !", 2.4, "ko"); etat.ralenti = 0.35; setTimeout(() => { etat.ralenti = 1; }, 1600); }
    else annonce("TEMPS !", 1.6);
    sons.jouer("victoire");
    setTimeout(() => {
      if (l.vainqueur === "egalite") annonce("ÉGALITÉ", 4);
      else annonce(`VICTOIRE DE ${noms[l.vainqueur].toUpperCase()}`, 5, "victoire");
      for (const c of ["a", "b"]) {
        if (l.vainqueur === c) robots[c].pose("victoire", 6);
        else if (l[`vie_${c}`] === 0) { robots[c].pose("ko", 5); robots[c].eteindre(true); }
        else if (l.vainqueur && robots[c].fin) robots[c].fin("defaite");                  // battu aux points
      }
    }, 1500);
  }
  function reinitialiser(nomA, nomB) {
    H.nomA.textContent = nomA; H.nomB.textContent = nomB;
    etat.avant = etat.ligne = etat.fini = null; etat.ralenti = 1;
    for (const c of ["a", "b"]) {
      if (robots[c].entree) robots[c].entree(); else robots[c].pose("garde", 20);
      robots[c].eteindre(false); retard[c] = 100; robots[c].objet.rotation.set(0, c === "a" ? 0 : Math.PI, 0);
    }
    robots.a.objet.position.set(X(R.DEPART_A), SOL, 0); robots.b.objet.position.set(X(R.DEPART_B), SOL, 0);
    barres({ tick: 0, vie_a: R.VIE, vie_b: R.VIE, energie_a: R.ENERGIE_DEPART, energie_b: R.ENERGIE_DEPART });
    H.annonce.className = "annonce";
  }

  // ---------- la boucle d'affichage ----------
  let derniere = performance.now(), vivant = true;
  const viseCam = new THREE.Vector3(0, SOL + 1.4, 0);
  let suiviCamera = true;
  controles.addEventListener("start", () => { suiviCamera = false; });
  function boucle(t) {
    if (!vivant) return;
    requestAnimationFrame(boucle);
    const dt = Math.min(0.05, (t - derniere) / 1000) * etat.ralenti; derniere = t;
    if (etat.ligne) {
      const k = Math.min(1, (t - etat.debut) / etat.duree);
      for (const c of ["a", "b"]) {
        const x0 = X(etat.avant[`position_${c}`]), x1 = X(etat.ligne[`position_${c}`]);
        robots[c].objet.position.x = x0 + (x1 - x0) * k;
      }
    }
    for (const c of ["a", "b"]) {
      robots[c].anime(dt);
      // le robot K.-O. bascule et tombe
      if (etat.fini && etat.fini.fin === "ko" && etat.fini[`vie_${c}`] === 0 && !robots[c].animee) {
        const o = robots[c].objet; o.rotation.z += ((c === "a" ? 1 : 1) * 1.35 - o.rotation.z) * Math.min(1, dt * 3);
        o.position.y += (SOL + 0.25 - o.position.y) * Math.min(1, dt * 3);
      }
      const vie = etat.ligne ? etat.ligne[`vie_${c}`] : 100;
      retard[c] += (vie - retard[c]) * Math.min(1, dt * 2.5);
      H[c === "a" ? "degatA" : "degatB"].style.width = `${retard[c]}%`;
    }
    effets.anime(dt); fx.anime(dt);
    if (etat.fini && etat.fini.fin === "ko") {           // le robot K.-O. fume
      etat.fumee = (etat.fumee || 0) - dt;
      if (etat.fumee <= 0) { etat.fumee = 0.3; for (const c of ["a", "b"]) if (etat.fini[`vie_${c}`] === 0) fx.fumee(robots[c].objet.position.x, SOL + 1.2); }
    }
    if (performance.now() > annonceJusqua) H.annonce.classList.remove("visible");
    // la caméra suit le combat (tant qu'on ne l'a pas tournée à la souris)
    const xa = robots.a.objet.position.x, xb = robots.b.objet.position.x, milieu = (xa + xb) / 2, ecart = Math.abs(xb - xa);
    if (suiviCamera) {
      viseCam.set(milieu, SOL + 1.35, 0);
      const voulu = new THREE.Vector3(milieu * 0.85, SOL + 2.3, 7.4 + ecart * 0.75);
      camera.position.lerp(voulu, Math.min(1, dt * 2.5));
      controles.target.lerp(viseCam, Math.min(1, dt * 3));
    }
    if (etat.secousse > 0) {
      camera.position.x += (Math.random() - 0.5) * etat.secousse; camera.position.y += (Math.random() - 0.5) * etat.secousse;
      etat.secousse = Math.max(0, etat.secousse - dt * 0.5);
    }
    decor.animer(t, dt * 1000);
    controles.update();
    if (composeur) composeur.render(); else rendu.render(scene, camera);
  }
  function redimensionner() {
    const l = conteneur.clientWidth || 800, h = conteneur.clientHeight || 500;
    rendu.setSize(l, h, false); camera.aspect = l / h; camera.updateProjectionMatrix(); if (composeur) composeur.setSize(l, h);
  }
  const obs = new ResizeObserver(redimensionner); obs.observe(conteneur); redimensionner();
  reinitialiser("A", "B");
  requestAnimationFrame(boucle);

  // ---------- rejouer un journal entier ----------
  let arret = false, pause = false, vitesse = 1;
  async function rejouer(journal, nomA, nomB) {
    arret = true; await new Promise((ok) => setTimeout(ok, 30)); arret = false;
    reinitialiser(nomA, nomB);
    annonce("COMBAT !", 1.2);
    await new Promise((ok) => setTimeout(ok, 900));
    // au rythme de l'horloge : sur un poste lent, des instants sont montrés ensemble plutôt que le combat ralentisse
    let i = 0, horloge = 0, avant = performance.now();
    while (i < journal.length) {
      await new Promise((ok) => setTimeout(ok, 40));
      if (arret) return false;
      const maintenant = performance.now();
      if (!pause) horloge += (maintenant - avant) * vitesse * etat.ralenti;
      avant = maintenant;
      const d = 1000 / R.TICKS_PAR_SECONDE;
      for (let n = 0; n < 4 && i < journal.length && (i + 1) * d <= horloge; n++) montrer(journal[i++], d / vitesse);
    }
    return true;
  }

  // ---------- changer de robots (catalogue robots/catalogue.json ; « simple » = le robot en formes simples) ----------
  async function choisirRobots(ids) {
    for (const c of ["a", "b"]) {
      let id = ids[c] || "simple";
      if (id === robots[c].id) continue;
      let nouveau;
      try { nouveau = id === "simple" ? fabriquerRobot(COULEURS[c], { qualite }) : await chargerRobot(id, COULEURS[c], { qualite }); }
      catch (e) { console.warn("robot non chargé, robot simple à la place :", e); id = "simple"; nouveau = fabriquerRobot(COULEURS[c], { qualite }); }
      nouveau.id = id;
      const ancien = robots[c];
      nouveau.objet.position.copy(ancien.objet.position); nouveau.objet.rotation.copy(ancien.objet.rotation);
      scene.remove(ancien.objet); if (ancien.detruire) ancien.detruire(); fx.oublier(ancien.objet); scene.add(nouveau.objet);
      robots[c] = nouveau;
    }
  }

  return {
    reinitialiser, montrer, annonce, rejouer, choisirRobots, robots,
    arreter() { arret = true; },
    pause(oui) { pause = oui; },
    vitesse(v) { vitesse = v; },
    recentrer() { suiviCamera = true; },
    detruire() { vivant = false; obs.disconnect(); rendu.dispose(); conteneur.innerHTML = ""; },
  };
}
