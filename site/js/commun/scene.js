// Scène 3D du jeu des missions : rendu, lumières, caméra, objets de la mission, et les gestes du préparateur.
// Le rejeu (rejeu.js) appelle jouerAction() pour chaque action du journal produit par Python.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { creerMatieres, PAL } from "./materiaux.js";
import { creerDecor, LIEUX, ALLEE_Z } from "./decor.js";
import { creerPersonnage } from "./personnage.js";
import { creerEffets, CALME } from "./effets.js";
import { creerEcran } from "./textures.js";
import * as sons from "./sons.js";

// ----- Réglages -----
const CAMERA = { champ: 27, distance: 28.5, azimut: 0.72, elevation: 0.62, cible: [0.1, 0.7, -0.1], formatReference: 1.5 };   // vue de trois quarts, en plongée
const LIMITES = { azimut: 0.55, elevationMin: 0.35, elevationMax: 1.0, distanceMin: 17, distanceMax: 40 };
const VITESSE_MARCHE = 3.4;                 // mètres par seconde
const EXPOSITION = 1.22;
const LUMIERES = { ciel: 0xdfe6ff, solReflet: 0x40301f, hemisphere: 1.15, soleil: 0xfff0dc, soleilIntensite: 2.6, chaude: 26 };
const GRILLE = { x0: -4.0, z0: -3.0, pas: 0.9 };          // repère des cases pour avancer() et tourner()
const CAP = { nord: Math.PI, est: Math.PI / 2, sud: 0, ouest: -Math.PI / 2 };
const ETIQUETTE = { largeur: 2.0, hauteur: 0.58, auDessus: 0.45 };   // étiquette collée sur l'objet porté (toujours tournée vers la caméra)
const BOUTEILLES_MAX = 60;                  // au-delà, le chariot est plein : le compteur donne le nombre exact

const douceur = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
const rebond = (k) => 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2);

export function creerScene(conteneur, { qualite = "haute" } = {}) {
  const haute = qualite === "haute";
  const rendu = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  rendu.setPixelRatio(Math.min(window.devicePixelRatio || 1, haute ? 2 : 1));
  rendu.outputColorSpace = THREE.SRGBColorSpace;
  rendu.toneMapping = THREE.ACESFilmicToneMapping;
  rendu.toneMappingExposure = EXPOSITION;
  rendu.shadowMap.enabled = haute;
  rendu.shadowMap.type = THREE.PCFShadowMap;
  conteneur.appendChild(rendu.domElement);
  rendu.domElement.setAttribute("aria-label", "Vue 3D de l'entrepôt de la brasserie");

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PAL.fond);
  const environnement = new THREE.PMREMGenerator(rendu);
  scene.environment = environnement.fromScene(new RoomEnvironment(), 0.04).texture;   // reflets du métal
  scene.environmentIntensity = haute ? 0.55 : 0.4;

  const camera = new THREE.PerspectiveCamera(CAMERA.champ, 1, 0.5, 120);
  const cible = new THREE.Vector3(...CAMERA.cible);
  const placer = (azimut, elevation, distance) => camera.position.set(
    cible.x + distance * Math.cos(elevation) * Math.sin(azimut), cible.y + distance * Math.sin(elevation), cible.z + distance * Math.cos(elevation) * Math.cos(azimut));
  placer(CAMERA.azimut, CAMERA.elevation, CAMERA.distance);
  const controles = new OrbitControls(camera, rendu.domElement);
  controles.target.copy(cible); controles.enablePan = false; controles.enableDamping = true;
  controles.minAzimuthAngle = CAMERA.azimut - LIMITES.azimut; controles.maxAzimuthAngle = CAMERA.azimut + LIMITES.azimut;
  controles.minPolarAngle = Math.PI / 2 - LIMITES.elevationMax; controles.maxPolarAngle = Math.PI / 2 - LIMITES.elevationMin;
  controles.minDistance = LIMITES.distanceMin; controles.maxDistance = LIMITES.distanceMax;
  controles.update();

  // --- lumières : un ciel, un soleil qui porte les ombres, deux lueurs chaudes (qualité haute) ---
  scene.add(new THREE.HemisphereLight(LUMIERES.ciel, LUMIERES.solReflet, LUMIERES.hemisphere));
  const soleil = new THREE.DirectionalLight(LUMIERES.soleil, LUMIERES.soleilIntensite);
  soleil.position.set(9, 16, 11); soleil.target.position.set(0, 0, 0); scene.add(soleil, soleil.target);
  if (haute) {
    soleil.castShadow = true; soleil.shadow.mapSize.set(2048, 2048); soleil.shadow.radius = 5; soleil.shadow.bias = -0.0004; soleil.shadow.normalBias = 0.03;
    Object.assign(soleil.shadow.camera, { left: -11, right: 11, top: 9, bottom: -9, near: 2, far: 45 }); soleil.shadow.camera.updateProjectionMatrix();
    for (const [x, y, z] of [[-6.5, 2.6, -3.2], [3.6, 2.4, -3.4]]) { const l = new THREE.PointLight(PAL.lueurChaude, LUMIERES.chaude, 9, 2); l.position.set(x, y, z); scene.add(l); }
  }

  const M = creerMatieres(qualite);
  const D = creerDecor(scene, M, qualite);
  const perso = creerPersonnage(M, haute);
  scene.add(perso.racine);
  const effets = creerEffets(scene, camera, haute);

  // --- boucle de rendu et animations ---
  const S = { vitesse: 1, enPause: false, sauter: false, vivant: true, images: 0, lent: 0, surLenteur: null };
  let animations = [];
  let neons = 0, gyro = 0, dernier = performance.now(), cumul = 0, compte = 0;
  const pulsations = [];

  function animer(duree, pas) {
    return new Promise((fin) => {
      if (S.sauter || duree <= 0) { pas(1); fin(); return; }
      animations.push({ t: 0, duree, pas, fin });
    });
  }
  const attendre = (duree) => animer(duree, () => {});

  function image(maintenant) {
    if (!S.vivant) return;
    requestAnimationFrame(image);
    const reel = Math.min(0.1, (maintenant - dernier) / 1000); dernier = maintenant;
    cumul += reel; compte += 1;
    if (cumul >= 1) { S.images = Math.round(compte / cumul); S.lent = S.images < 25 ? S.lent + cumul : 0; cumul = 0; compte = 0; if (S.lent >= 5 && S.surLenteur) { S.lent = 0; S.surLenteur(S.images); } }
    const dt = S.enPause ? 0 : reel * S.vitesse;
    const enCours = animations; animations = [];
    for (const a of enCours) {
      a.t += dt;
      const k = S.sauter ? 1 : Math.min(1, a.t / a.duree);
      a.pas(k);
      if (k >= 1) a.fin(); else animations.push(a);
    }
    perso.maj(dt);
    effets.maj(reel);
    for (let i = pulsations.length - 1; i >= 0; i--) { const p = pulsations[i]; p.t += reel; const k = Math.min(1, p.t / p.duree); p.pas(k); if (k >= 1) pulsations.splice(i, 1); }
    M.neon.emissiveIntensity = 2.2 + neons * 2.5;
    if (gyro > 0) { gyro = Math.max(0, gyro - reel); const on = Math.sin(maintenant / 70) > 0 ? 1 : 0.15; D.gyrophare.lampe.material.emissiveIntensity = 3 * on; D.gyrophare.lumiere.intensity = haute ? 60 * on : 0; if (gyro === 0) { D.gyrophare.lampe.material.emissiveIntensity = 0.3; D.gyrophare.lumiere.intensity = 0; } }
    controles.update();
    rendu.render(scene, camera);
  }

  function ajuster() {
    const l = conteneur.clientWidth || 800, h = conteneur.clientHeight || 600;
    rendu.setSize(l, h, false);
    rendu.domElement.style.width = "100%"; rendu.domElement.style.height = "100%";
    camera.aspect = l / h;
    // Fenêtre plus étroite que le format de référence : on élargit le champ pour garder toute la largeur de l'entrepôt.
    const demi = Math.tan(THREE.MathUtils.degToRad(CAMERA.champ / 2));
    camera.fov = l / h < CAMERA.formatReference ? THREE.MathUtils.radToDeg(2 * Math.atan(demi * CAMERA.formatReference / (l / h))) : CAMERA.champ;
    camera.updateProjectionMatrix();
  }
  const observateur = new ResizeObserver(ajuster); observateur.observe(conteneur); ajuster();
  requestAnimationFrame(image);

  const geoBouteille = { corps: new THREE.CylinderGeometry(0.045, 0.045, 0.18, 10), col: new THREE.CylinderGeometry(0.018, 0.04, 0.07, 8), capsule: new THREE.CylinderGeometry(0.02, 0.02, 0.02, 8) };
  const matBouteille = { verre: M.couleur(0x5a3412, 0.2, 0.05), partielle: M.couleur(0xc98a3c, 0.35, 0.05), capsule: M.peinture_orange };

  // --- gestes du préparateur ---
  const P = perso.racine;
  let porte = null;                        // objet 3D porté
  let auChariot = false;

  function tournerVers(cap) {
    const depart = P.rotation.y;
    let ecart = ((cap - depart + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    if (Math.abs(ecart) < 0.02) return Promise.resolve();
    return animer(0.16, (k) => { P.rotation.y = depart + ecart * douceur(k); });
  }

  async function marcher(x, z) {
    const dx = x - P.position.x, dz = z - P.position.z, distance = Math.hypot(dx, dz);
    if (distance < 0.03) return;
    await tournerVers(Math.atan2(dx, dz));
    const x0 = P.position.x, z0 = P.position.z;
    perso.etat.marche = 1;
    await animer(distance / VITESSE_MARCHE, (k) => { P.position.x = x0 + dx * k; P.position.z = z0 + dz * k; });
    perso.etat.marche = 0;
  }

  // Trajet en trois segments : rejoindre l'allée centrale, la suivre, puis gagner la destination.
  async function aller(x, z, cap) {
    auChariot = false;
    const memeCouloir = Math.abs(P.position.x - x) < 0.05 || (Math.abs(P.position.z - z) < 0.05);
    if (!memeCouloir) { await marcher(P.position.x, ALLEE_Z); await marcher(x, ALLEE_Z); }
    await marcher(x, z);
    if (cap !== undefined) await tournerVers(cap);
  }

  function alerte() { gyro = 1.5; sons.jouer("alerte"); }

  function pulserQuai(quai, ok) {
    const couleur = ok ? PAL.reussite : PAL.erreur;
    quai.led.material.emissive.setHex(couleur);
    pulsations.push({ t: 0, duree: 0.9, pas: (k) => { const f = Math.sin(Math.PI * Math.min(1, k * 1.4)); quai.led.material.emissiveIntensity = 1.6 + 3 * f; quai.lumiere.color.setHex(couleur); quai.lumiere.intensity = haute ? 30 * f : 0; } });
  }

  async function prendre(a) {
    const objet = D.objets.get(a.objet);
    if (!a.ok || !objet) { alerte(); await perso.special("hausser", 0.7); return; }
    await aller(objet.position.x, LIEUX.tapis.arret, CAP.nord);
    const pose = perso.special("accroupir", 0.42);
    await attendre(0.2);
    perso.main.attach(objet);
    const p0 = objet.position.clone(), q0 = objet.quaternion.clone();
    sons.jouer("clic");
    await animer(0.24, (k) => { const e = rebond(k); objet.position.lerpVectors(p0, new THREE.Vector3(0, -objet.userData.hauteur / 2, 0), e); objet.quaternion.slerpQuaternions(q0, new THREE.Quaternion(), k); });
    perso.etat.porte = true; porte = objet;
    await pose;
  }

  async function livrer(a) {
    const quai = D.quais[a.quai];
    if (!quai || !porte) { alerte(); await perso.special("hausser", 0.7); return; }
    const rebut = a.quai === "R";
    if (rebut) await aller(LIEUX.rebut.x, LIEUX.rebut.arretZ, CAP.sud); else await aller(LIEUX.arretQuaiX, quai.z, CAP.est);
    const objet = porte; porte = null;
    const pose = perso.special("accroupir", 0.4);
    D.dynamiques.attach(objet);
    const n = quai.depots++, rang = n % 4, etage = Math.floor(n / 4);
    const arrivee = new THREE.Vector3(quai.x + (rang % 2 ? 0.3 : -0.3), 0.22 + etage * objet.userData.hauteur, quai.z + (rang < 2 ? -0.2 : 0.3));
    const p0 = objet.position.clone(), q0 = objet.quaternion.clone(), q1 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rebut ? 0.5 : 0, rebut ? 0.35 : 0));
    await animer(0.34, (k) => { const e = douceur(k); objet.position.lerpVectors(p0, arrivee, e); objet.position.y += Math.sin(Math.PI * k) * 0.35; objet.quaternion.slerpQuaternions(q0, q1, e); });
    perso.etat.porte = false;
    pulserQuai(quai, a.ok);
    effets.pastille(quai.x, 3.15, quai.z - 0.65, a.ok);
    if (a.ok) { effets.confettis(arrivee.x, 0.8, arrivee.z); sons.jouer("reussi"); } else { effets.poussiere(arrivee.x, 0.4, arrivee.z); sons.jouer("rate"); effets.secouer(0.08); }
    await animer(0.3, (k) => { const s = a.ok ? 1 - 0.18 * Math.sin(Math.PI * k) : 1; objet.scale.set(1 + (1 - s) * 0.6, s, 1 + (1 - s) * 0.6); if (!a.ok) objet.position.y = arrivee.y + Math.abs(Math.sin(Math.PI * 2 * k)) * 0.12 * (1 - k); });
    await pose;
  }

  async function ecran(a) {
    D.ecran.ecrire(a.texte, a.ok);
    sons.jouer(a.ok ? "neutre" : "rate");
    if (!a.ok) effets.secouer(0.04);
    await attendre(0.75);
  }

  async function controle(a) {
    const lieu = a.lieu;
    if (D.rayons[lieu]) {
      const r = LIEUX.rayons[lieu];
      await aller(LIEUX.arretRayonX, r.z, CAP.ouest);
      D.rayons[lieu].ecran.ecrire(a.texte, a.ok, { tailleMax: 54, lignesMax: 2 });
      effets.pastille(r.x + 1.0, 3.35, r.z, a.ok);
    } else if (D.cuves[lieu]) {
      const c = LIEUX.cuves[lieu];
      await aller(c.x, LIEUX.arretCuveZ, CAP.nord);
      D.cuves[lieu].ecran.ecrire(a.texte, a.ok, { tailleMax: 76, lignesMax: 2 });
      const led = D.cuves[lieu].led.material; led.emissive.setHex(a.ok ? PAL.reussite : PAL.erreur); led.emissiveIntensity = 2.6;
      effets.pastille(c.x, 3.75, c.z + 0.8, a.ok);
    } else if (D.quais[lieu]) {
      const q = D.quais[lieu];
      if (lieu === "R") await aller(LIEUX.rebut.x, LIEUX.rebut.arretZ, CAP.sud); else await aller(LIEUX.arretQuaiX, q.z, CAP.est);
      pulserQuai(q, a.ok);
      effets.pastille(q.x, 3.15, q.z - 0.65, a.ok);
      D.ecran.ecrire(a.texte, a.ok);
    } else { D.ecran.ecrire(a.texte, a.ok); }
    sons.jouer(a.ok ? "reussi" : "rate");
    await perso.special(a.ok ? "accroupir" : "hausser", a.ok ? 0.35 : 0.6);
    await attendre(0.25);
  }

  // Au pupitre, le préparateur colle sur l'objet porté une étiquette : le texte produit par le code du stagiaire.
  async function etiqueter(a) {
    if (!porte) { alerte(); await perso.special("hausser", 0.7); return; }
    await aller(LIEUX.arretPupitre.x, LIEUX.arretPupitre.z, CAP.nord);
    const pose = perso.special("accroupir", 0.45);
    D.ecran.ecrire(a.texte, a.ok);
    const ecranEtiquette = creerEcran(768, 220);
    ecranEtiquette.ecrire(a.texte, a.ok, { tailleMax: 64, lignesMax: 2 });
    const etiquette = new THREE.Sprite(new THREE.SpriteMaterial({ map: ecranEtiquette.texture, depthTest: false, toneMapped: false }));
    etiquette.renderOrder = 5;
    etiquette.position.set(0, porte.userData.hauteur / 2 + ETIQUETTE.auDessus, 0);
    porte.add(etiquette);
    sons.jouer("clic");
    await animer(0.3, (k) => { const e = rebond(k); etiquette.scale.set(ETIQUETTE.largeur * e, ETIQUETTE.hauteur * e, 1); });
    effets.pastille(LIEUX.arretPupitre.x + 0.9, 2.2, LIEUX.arretPupitre.z - 0.6, a.ok);
    if (!a.ok) { sons.jouer("rate"); effets.secouer(0.05); }
    await pose;
    await attendre(0.35);
  }

  // Le préparateur range l'objet porté sur l'étagère du milieu d'un rayon.
  async function ranger(a) {
    const r = LIEUX.rayons[a.rayon];
    if (!r || !porte) { alerte(); await perso.special("hausser", 0.7); return; }
    await aller(LIEUX.arretRayonX, r.z + 0.7, CAP.ouest);
    const objet = porte; porte = null;
    D.dynamiques.attach(objet);
    const arrivee = new THREE.Vector3(r.x + 0.15, 1.18, r.z + 0.7), p0 = objet.position.clone(), q0 = objet.quaternion.clone();
    await animer(0.4, (k) => { const e = douceur(k); objet.position.lerpVectors(p0, arrivee, e); objet.position.y += Math.sin(Math.PI * k) * 0.25; objet.quaternion.slerpQuaternions(q0, new THREE.Quaternion(), e); });
    perso.etat.porte = false;
    if (a.texte) D.rayons[a.rayon].ecran.ecrire(a.texte, a.ok, { tailleMax: 54, lignesMax: 2 });
    effets.pastille(r.x + 1.0, 3.35, r.z, a.ok);
    sons.jouer(a.ok ? "reussi" : "rate");
    if (a.ok) effets.confettis(arrivee.x + 0.3, 1.5, arrivee.z);
    await attendre(0.3);
  }

  // Le préparateur vide le fût porté en bouteilles, rangées sur le chariot : autant que la valeur renvoyée.
  // Une valeur décimale (60.6) donne 60 bouteilles pleines et une à moitié pleine.
  async function embouteiller(a) {
    if (!porte) { alerte(); await perso.special("hausser", 0.7); return; }
    await aller(LIEUX.arretChariot.x, LIEUX.arretChariot.z, CAP.sud);
    auChariot = true;
    const fut = porte; porte = null;
    D.dynamiques.attach(fut);
    const p0 = fut.position.clone(), q0 = fut.quaternion.clone(), pose = new THREE.Vector3(LIEUX.futVide.x, 0.01, LIEUX.futVide.z);
    await animer(0.35, (k) => { const e = douceur(k); fut.position.lerpVectors(p0, pose, e); fut.quaternion.slerpQuaternions(q0, new THREE.Quaternion(), e); });
    perso.etat.porte = false;
    const B = LIEUX.bouteilles, q = Math.max(0, Number(a.quantite) || 0);
    const pleines = Math.min(BOUTEILLES_MAX, Math.floor(q + 1e-9)), reste = q - Math.floor(q + 1e-9);
    const total = pleines + (reste > 0.01 && pleines < BOUTEILLES_MAX ? 1 : 0);
    D.chariot.compteur.ecrire("0", null, { tailleMax: 72, lignesMax: 1 });
    const bouteilles = [];
    for (let i = 0; i < total; i++) {
      const b = new THREE.Group(), partielle = i === pleines;
      const corps = new THREE.Mesh(geoBouteille.corps, partielle ? matBouteille.partielle : matBouteille.verre);
      corps.position.y = 0.09; if (partielle) { corps.scale.y = Math.max(0.2, reste); corps.position.y = 0.09 * corps.scale.y; }
      const col = new THREE.Mesh(geoBouteille.col, matBouteille.verre); col.position.y = 0.21;
      const capsule = new THREE.Mesh(geoBouteille.capsule, matBouteille.capsule); capsule.position.y = 0.27;
      if (!partielle) b.add(col, capsule);
      b.add(corps);
      b.position.set(B.x0 + (i % B.colonnes) * B.pas, B.y, B.z0 + Math.floor(i / B.colonnes) * B.pas);
      b.scale.setScalar(0.001);
      D.dynamiques.add(b); bouteilles.push(b);
    }
    const duree = Math.min(2.2, 0.4 + total * 0.03);
    let montrees = 0;
    await animer(duree, (k) => {
      const n = Math.ceil(k * total);
      for (; montrees < n; montrees++) bouteilles[montrees].scale.setScalar(1);
      if (n % 6 === 0 && n) D.chariot.compteur.ecrire(String(n), null, { tailleMax: 72, lignesMax: 1 });
    });
    bouteilles.forEach((b) => b.scale.setScalar(1));
    D.chariot.compteur.ecrire(a.texte, a.ok, { tailleMax: 64, lignesMax: 1 });
    effets.pastille(LIEUX.chariot.x, 2.0, LIEUX.chariot.z, a.ok);
    if (a.ok) { effets.confettis(LIEUX.chariot.x, 0.9, LIEUX.chariot.z); sons.jouer("reussi"); } else { alerte(); sons.jouer("rate"); }
    await perso.special(a.ok ? "accroupir" : "hausser", 0.5);
  }

  async function charger(a) {
    if (!auChariot) { await aller(LIEUX.arretChariot.x, LIEUX.arretChariot.z, CAP.sud); auChariot = true; }
    if (!a.ok) { alerte(); effets.secouer(0.1); await perso.special("recul", 0.5); return; }
    const fut = D.chariot.reserve.pop();
    const pose = perso.special("accroupir", 0.4);
    if (fut) {
      const i = a.total - 1, p0 = fut.position.clone();
      const arrivee = new THREE.Vector3(LIEUX.chariot.x - 0.7 + Math.floor(i / 2) * 0.52, 0.35, LIEUX.chariot.z + (i % 2 ? 0.26 : -0.26));
      sons.jouer("clic");
      await animer(0.5, (k) => { const e = douceur(k); fut.position.lerpVectors(p0, arrivee, e); fut.position.y = p0.y + (arrivee.y - p0.y) * e + Math.sin(Math.PI * k) * 0.5; fut.rotation.z = -Math.PI * 2 * e; });
      fut.rotation.z = 0;
    }
    D.chariot.compteur.ecrire(`${a.total} / 4`, a.total >= 4 ? true : null, { tailleMax: 72, lignesMax: 1 });
    await pose;
  }

  async function deplacerCase(a) {
    if (a.action === "tourner") { await tournerVers(CAP[a.direction]); return; }
    const x = GRILLE.x0 + a.vers[0] * GRILLE.pas, z = GRILLE.z0 + a.vers[1] * GRILLE.pas;
    if (a.ok) { await marcher(x, z); return; }
    const x0 = P.position.x, z0 = P.position.z;
    await animer(0.14, (k) => { P.position.x = x0 + (x - x0) * 0.35 * k; P.position.z = z0 + (z - z0) * 0.35 * k; });
    effets.secouer(0.14); effets.poussiere(P.position.x, 0.9, P.position.z); sons.jouer("choc"); alerte();
    const recul = perso.special("recul", 0.5);
    await animer(0.3, (k) => { P.position.x = x0 + (x - x0) * 0.35 * (1 - k); P.position.z = z0 + (z - z0) * 0.35 * (1 - k); });
    await recul;
  }

  async function jouerAction(a) {
    switch (a.action) {
      case "prendre": return prendre(a);
      case "livrer": return livrer(a);
      case "ecran": return ecran(a);
      case "controle": return controle(a);
      case "charger": return charger(a);
      case "etiqueter": return etiqueter(a);
      case "ranger": return ranger(a);
      case "embouteiller": return embouteiller(a);
      case "avancer": case "tourner": return deplacerCase(a);
      case "poser": if (porte) { const o = porte; porte = null; D.dynamiques.attach(o); o.position.y = 0.02; perso.etat.porte = false; } return attendre(0.3);
      case "signaler": D.ecran.ecrire(a.texte, false); alerte(); return attendre(0.8);
      case "etourdi": alerte(); sons.jouer("rate"); return perso.special("etourdi", 1.5);
      default: return attendre(0.25);
    }
  }

  async function terminer({ reussi, erreur }) {
    if (erreur) { sons.jouer("neutre"); await perso.special("hausser", 0.8); return; }
    if (!reussi) return;
    sons.jouer("victoire");
    for (const q of Object.values(D.quais)) { q.led.material.emissive.setHex(PAL.reussite); q.led.material.emissiveIntensity = 2.4; }
    effets.confettis(P.position.x, 1.9, P.position.z);
    pulsations.push({ t: 0, duree: 1.5, pas: (k) => { neons = Math.sin(Math.PI * k); } });
    await tournerVers(CAMERA.azimut);
    await perso.special("celebrer", 1.3);
  }

  // Remet la scène dans l'état de départ de la mission.
  function reinitialiser(mission) {
    animations = []; pulsations.length = 0; S.sauter = false; neons = 0; gyro = 0; porte = null; auChariot = false;
    perso.etat.porte = false; perso.etat.marche = 0; perso.etat.special = null;
    while (perso.main.children.length) perso.main.remove(perso.main.children[0]);
    while (D.dynamiques.children.length) D.dynamiques.remove(D.dynamiques.children[0]);
    D.objets.clear();
    P.position.set(LIEUX.depart.x, 0, LIEUX.depart.z); P.rotation.set(0, CAP.est, 0);
    const sceneMission = (mission && mission.scene) || {};
    (sceneMission.objets || []).forEach((o, i) => {
      const g = D.fabriquer(o);
      g.position.set(LIEUX.tapis.x0 + (i % LIEUX.tapis.places) * LIEUX.tapis.pas, LIEUX.tapis.hauteur + 0.01, LIEUX.tapis.z);
      D.dynamiques.add(g); D.objets.set(o.id, g);
    });
    D.chariot.reserve = [];
    const codes = ["B01", "B03", "B05", "B02", "B04"];
    for (let i = 0; i < (sceneMission.futsQuai || 0); i++) {
      const g = D.fabriquer({ id: "QUAI-" + i, type: "fut", biere: codes[i % 5] });
      g.position.set(LIEUX.futsQuai.x0 + (i % 5) * LIEUX.futsQuai.pas, 0.01, LIEUX.futsQuai.z0 + Math.floor(i / 5) * 0.56);
      D.dynamiques.add(g); D.chariot.reserve.unshift(g);
    }
    D.chariot.compteur.ecrire(sceneMission.chariot ? "0 / 4" : "", null, { tailleMax: 72, lignesMax: 1 });
    for (const q of Object.values(D.quais)) { q.depots = 0; q.led.material.emissive.setHex(0x3a3f48); q.led.material.emissiveIntensity = 0.4; q.lumiere.intensity = 0; }
    for (const [nom, c] of Object.entries(D.cuves)) { const t = sceneMission.cuves && sceneMission.cuves[nom]; c.ecran.ecrire(t !== undefined ? "…" : "", null, { tailleMax: 76, lignesMax: 1 }); c.led.material.emissive.setHex(0x3a3f48); c.led.material.emissiveIntensity = 0.4; }
    for (const r of Object.values(D.rayons)) r.ecran.ecrire("", null);
    D.ecran.ecrire(mission ? "Brasserie de la Fonderie" : "", null);
    D.gyrophare.lampe.material.emissiveIntensity = 0.3; D.gyrophare.lumiere.intensity = 0;
  }

  function detruire() {
    S.vivant = false; observateur.disconnect(); controles.dispose(); environnement.dispose(); rendu.dispose();
    if (rendu.domElement.parentNode) rendu.domElement.parentNode.removeChild(rendu.domElement);
  }

  reinitialiser(null);
  return Object.assign(S, { jouerAction, terminer, reinitialiser, detruire, attendre, calme: CALME,
    recadrer: () => { placer(CAMERA.azimut, CAMERA.elevation, CAMERA.distance); controles.target.copy(cible); controles.update(); },
    cadrer: (azimut, elevation, distance) => { placer(azimut, elevation, distance); controles.update(); } });
}
