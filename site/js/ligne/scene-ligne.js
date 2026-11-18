// Jeu 2 : le hall de production en vue isométrique (05-jeu2-builder.md § 4 et § 7).
// Caméra orthographique (Three.js r187 : OrthographicCamera(left, right, top, bottom, near, far), updateProjectionMatrix()).
// La scène dessine le plateau, signale la case survolée, et rejoue l'exécution étape par étape.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { creerMatieres, PAL } from "../commun/materiaux.js";
import { creerEffets, CALME } from "../commun/effets.js";
import { POLICE } from "../commun/textures.js";
import * as sons from "../commun/sons.js";
import { GRILLE, PIECES, LIBELLES_SORTIES } from "./modele.js";
import { conditionTexte } from "./generateur.js";

// ----- Réglages -----
const VUE = { direction: [1, 1.05, 1], marge: 0.02 };          // direction de la caméra vers le hall (vue isométrique)
const EXPOSITION = 1.2;
const LUMIERES = { ciel: 0xdfe6ff, sol: 0x40301f, hemisphere: 1.25, soleil: 0xfff0dc, soleilIntensite: 2.4 };
const TAPIS = { hauteur: 0.34, largeur: 0.46, vitesse: 0.9 };    // vitesse : défilement des chevrons, cases par seconde
const ETIQUETTE = { hauteur: 0.4, y: 1.55 };                    // étiquettes au-dessus des pièces
const DUREE_PAS = 0.42;                                         // secondes pour aller d'une pièce à la suivante, vitesse 1
const TAILLE_BOUTEILLE = 1.6;                                   // les bouteilles sont agrandies pour rester visibles en vue isométrique
const MUR_H = 2.6;
const CAMION = { recul: 0.12, plateau: 0.82, cabine: 0.36, largeur: 0.72 };   // camion à quai, garé au-delà du bord est du hall
const ROUTE = 1.35;                                                         // largeur de la voie des camions, à l'est du hall
const TRAPPE = { rayon: 0.3, profondeur: 0.7, decalage: 0.14 };   // decalage : centre du trou après le centre de la dernière case
const COULEURS_BIERES = { "La Coulée": 0xffc857, "Le Laitier": 0xfff3e0, "La Braise": 0xf2746b, "Le Crassier": 0x6b4a3a, "L'Étincelle": 0x4fc4a0 };
const QUAIS = { Q1: "cafés", Q2: "magasins", Q3: "particuliers", Q4: "événements" };

const douceur = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
export const versMonde = (x, z) => new THREE.Vector3(x - (GRILLE.colonnes - 1) / 2, 0, z - (GRILLE.rangees - 1) / 2);

export function creerSceneLigne(conteneur, { qualite = "haute", surCase = () => {} } = {}) {
  const haute = qualite === "haute";
  const rendu = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  rendu.setPixelRatio(Math.min(window.devicePixelRatio || 1, haute ? 2 : 1));
  rendu.outputColorSpace = THREE.SRGBColorSpace;
  rendu.toneMapping = THREE.ACESFilmicToneMapping;
  rendu.toneMappingExposure = EXPOSITION;
  rendu.shadowMap.enabled = haute;
  rendu.shadowMap.type = THREE.PCFShadowMap;
  conteneur.appendChild(rendu.domElement);
  rendu.domElement.setAttribute("aria-label", "Vue 3D du hall de production : plateau de la ligne");
  rendu.domElement.style.touchAction = "none";

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PAL.fond);
  const environnement = new THREE.PMREMGenerator(rendu);
  scene.environment = environnement.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = haute ? 0.55 : 0.4;
  const camera = new THREE.OrthographicCamera(-10, 10, 6, -6, 0.1, 200);
  const dir = new THREE.Vector3(...VUE.direction).normalize();
  camera.position.copy(dir.clone().multiplyScalar(60));
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.HemisphereLight(LUMIERES.ciel, LUMIERES.sol, LUMIERES.hemisphere));
  const soleil = new THREE.DirectionalLight(LUMIERES.soleil, LUMIERES.soleilIntensite);
  soleil.position.set(6, 14, 9); scene.add(soleil, soleil.target);
  if (haute) {
    soleil.castShadow = true; soleil.shadow.mapSize.set(2048, 2048); soleil.shadow.bias = -0.0004; soleil.shadow.normalBias = 0.03;
    Object.assign(soleil.shadow.camera, { left: -9, right: 9, top: 7, bottom: -7, near: 2, far: 40 }); soleil.shadow.camera.updateProjectionMatrix();
  }

  const M = creerMatieres(qualite);
  const effets = creerEffets(scene, camera, haute);
  const L = GRILLE.colonnes, P = GRILLE.rangees;
  const ombre = (m) => { m.castShadow = haute; m.receiveShadow = haute; return m; };
  const boite = (l, h, p, matiere, x, y, z, parent) => { const m = ombre(new THREE.Mesh(new THREE.BoxGeometry(l, h, p), matiere)); m.position.set(x, y, z); parent.add(m); return m; };
  const cylindre = (rh, rb, h, matiere, x, y, z, parent, segments = 20) => { const m = ombre(new THREE.Mesh(new THREE.CylinderGeometry(rh, rb, h, segments), matiere)); m.position.set(x, y, z); parent.add(m); return m; };

  // --- le hall : socle, sol quadrillé, deux murs ---
  const hall = new THREE.Group(); scene.add(hall);
  boite(L + 0.8, 0.6, P + 0.8, M.socle, 0, -0.31, 0, hall);
  boite(L + 0.84, 0.06, 0.06, M.bandeau_orange, 0, -0.18, P / 2 + 0.41, hall);
  boite(0.06, 0.06, P + 0.84, M.bandeau_orange, L / 2 + 0.41, -0.18, 0, hall);
  const sol = new THREE.Mesh(new THREE.PlaneGeometry(L, P), M.image(texGrille(L, P), 0.85));
  sol.rotation.x = -Math.PI / 2; sol.position.y = 0.002; sol.receiveShadow = haute; hall.add(sol);
  boite(L + 0.8, MUR_H, 0.3, M.peinture_metal, 0, MUR_H / 2, -P / 2 - 0.25, hall);
  boite(0.3, MUR_H, P + 0.5, M.peinture_metal, -L / 2 - 0.25, MUR_H / 2, -0.15, hall);
  boite(L, 0.06, 0.06, M.bandeau_orange, 0, 2.1, -P / 2 - 0.08, hall);
  boite(0.06, 0.06, P, M.bandeau_orange, -L / 2 - 0.08, 2.1, 0, hall);
  for (let i = 0; i < 5; i++) boite(1.3, 0.42, 0.05, M.verre_fenetre, -4.6 + i * 2.3, 1.55, -P / 2 - 0.08, hall);
  // la voie des camions : en contrebas, le long du bord est (les quais y ouvrent sur le plateau d'un camion)
  boite(ROUTE, 0.06, P + 0.8, M.caoutchouc, L / 2 + 0.4 + ROUTE / 2, -0.58, 0, hall);
  for (let i = 0; i < 6; i++) boite(0.05, 0.005, 0.5, M.plastique_mat, L / 2 + 0.4 + ROUTE * 0.82, -0.547, -P / 2 + 0.6 + i * 1.4, hall);

  // case survolée et tracé en cours
  const survol = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.94), new THREE.MeshBasicMaterial({ color: PAL.accent, transparent: true, opacity: 0.35, depthWrite: false }));
  survol.rotation.x = -Math.PI / 2; survol.position.y = 0.01; survol.visible = false; scene.add(survol);

  const plateauGroupe = new THREE.Group(); scene.add(plateauGroupe);
  const rejeuGroupe = new THREE.Group(); scene.add(rejeuGroupe);
  const texTapis = texChevrons();

  // --- interaction : la souris est ramenée sur le sol, en case ---
  const rayon = new THREE.Raycaster(), souris = new THREE.Vector2(), planSol = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), point = new THREE.Vector3();
  const caseSous = (e) => {
    const r = rendu.domElement.getBoundingClientRect();
    souris.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    rayon.setFromCamera(souris, camera);
    if (!rayon.ray.intersectPlane(planSol, point)) return null;
    const x = Math.round(point.x + (L - 1) / 2), z = Math.round(point.z + (P - 1) / 2);
    return x >= 0 && z >= 0 && x < L && z < P ? [x, z] : null;
  };
  let appuye = false;
  rendu.domElement.addEventListener("pointerdown", (e) => { const c = caseSous(e); if (!c) return; appuye = true; rendu.domElement.setPointerCapture(e.pointerId); surCase("appui", c[0], c[1], e); });
  rendu.domElement.addEventListener("pointermove", (e) => {
    const c = caseSous(e);
    survol.visible = Boolean(c);
    if (c) { survol.position.copy(versMonde(c[0], c[1])).setY(0.012); surCase(appuye ? "glisse" : "survol", c[0], c[1], e); }
  });
  rendu.domElement.addEventListener("pointerup", (e) => { const c = caseSous(e); appuye = false; surCase("relache", c ? c[0] : null, c ? c[1] : null, e); });
  rendu.domElement.addEventListener("pointerleave", () => { survol.visible = false; });

  // --- boucle de rendu ---
  const S = { vitesse: 1, enPause: false, sauter: false, vivant: true, images: 0, lent: 0, surLenteur: null, calme: CALME };
  let animations = [], dernier = performance.now(), cumul = 0, compte = 0;
  const lueurs = [];                                 // pièces qui s'illuminent un instant
  function animer(duree, pas) {
    return new Promise((fin) => {
      if (S.sauter || duree <= 0) { pas(1); fin(); return; }
      animations.push({ t: 0, duree, pas, fin });
    });
  }
  function image(maintenant) {
    if (!S.vivant) return;
    requestAnimationFrame(image);
    const reel = Math.min(0.1, (maintenant - dernier) / 1000); dernier = maintenant;
    cumul += reel; compte += 1;
    if (cumul >= 1) { S.images = Math.round(compte / cumul); S.lent = S.images < 25 ? S.lent + cumul : 0; cumul = 0; compte = 0; if (S.lent >= 5 && S.surLenteur) { S.lent = 0; S.surLenteur(S.images); } }
    const dt = S.enPause ? 0 : reel * S.vitesse;
    const enCours = animations; animations = [];
    for (const a of enCours) { a.t += dt; const k = S.sauter ? 1 : Math.min(1, a.t / a.duree); a.pas(k); if (k >= 1) a.fin(); else animations.push(a); }
    if (!CALME && !S.enPause) texTapis.offset.x -= reel * TAPIS.vitesse * (S.enLigne ? 1 : 0.35);
    for (let i = lueurs.length - 1; i >= 0; i--) { const l = lueurs[i]; l.t += reel; const k = Math.min(1, l.t / l.duree); l.matiere.emissiveIntensity = l.base + (1 - k) * l.force; if (k >= 1) { l.matiere.emissiveIntensity = l.base; lueurs.splice(i, 1); } }
    clignoter(maintenant);
    effets.maj(reel);
    rendu.render(scene, camera);
  }

  function ajuster() {
    const l = conteneur.clientWidth || 800, h = conteneur.clientHeight || 600;
    rendu.setSize(l, h, false);
    rendu.domElement.style.width = "100%"; rendu.domElement.style.height = "100%";
    // cadrage : tout le hall (socle et murs) tient dans la vue, quelle que soit la forme de la fenêtre
    camera.updateMatrixWorld();
    const inv = camera.matrixWorldInverse, b = new THREE.Box3();
    for (const x of [-L / 2 - 0.5, L / 2 + 0.4 + ROUTE]) for (const y of [-0.6, MUR_H * 0.8]) for (const z of [-P / 2 - 0.5, P / 2 + 0.5]) b.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(inv));
    let largeur = b.max.x - b.min.x, hauteur = b.max.y - b.min.y;
    largeur *= 1 + VUE.marge; hauteur *= 1 + VUE.marge;
    if (largeur / hauteur < l / h) largeur = hauteur * (l / h); else hauteur = largeur / (l / h);
    const cx = (b.max.x + b.min.x) / 2, cy = (b.max.y + b.min.y) / 2;
    Object.assign(camera, { left: cx - largeur / 2, right: cx + largeur / 2, top: cy + hauteur / 2, bottom: cy - hauteur / 2 });
    camera.updateProjectionMatrix();
  }
  const observateur = new ResizeObserver(ajuster); observateur.observe(conteneur); ajuster();
  requestAnimationFrame(image);

  // ---------- dessin du plateau ----------
  let objets = new Map();       // id de pièce -> { groupe, etiquette, lueur }
  let probleme = new Set(), selection = null;
  const ecrireEtiquette = (id, texte, etat = null) => { const o = objets.get(id); if (o) o.etiquette.ecrire(texte, etat); };

  function vider(groupe) {
    for (const enfant of [...groupe.children]) {
      groupe.remove(enfant);
      enfant.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.userData.propre) { if (o.material.map && o.material.map !== texTapis) o.material.map.dispose(); o.material.dispose(); } });
    }
  }

  function dessiner(plateau, { selection: sel = null, problemes = [], trace = null } = {}) {
    vider(plateauGroupe);
    objets = new Map();
    selection = sel; probleme = new Set(problemes.map((p) => p.id));
    for (const p of plateau.pieces) {
      const o = modelePiece(p, plateau);
      o.groupe.position.copy(versMonde(p.x, p.z));
      plateauGroupe.add(o.groupe);
      objets.set(p.id, o);
      if (p.id === sel) anneau(o.groupe, PAL.accent);
      if (probleme.has(p.id)) o.anneauErreur = anneau(o.groupe, PAL.erreur);
    }
    for (const t of plateau.tapis) dessinerTapis(plateau, t, false);
    if (trace) dessinerTapis(plateau, { de: trace.de, sortie: trace.sortie, vers: null, cases: trace.cases }, true);
  }

  function anneau(parent, couleur) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.44, 0.5, 32), new THREE.MeshBasicMaterial({ color: couleur, transparent: true, opacity: 0.95, depthWrite: false }));
    m.userData.propre = true; m.rotation.x = -Math.PI / 2; m.position.y = 0.015; parent.add(m); return m;
  }

  function clignoter(t) {
    const on = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t / 160));
    for (const o of objets.values()) if (o.anneauErreur) o.anneauErreur.material.opacity = CALME ? 0.95 : on;
  }

  function points(plateau, t) {
    const de = plateau.piece(t.de), vers = t.vers ? plateau.piece(t.vers) : null;
    const pts = [versMonde(de.x, de.z), ...t.cases.map(([x, z]) => versMonde(x, z))];
    if (vers) pts.push(versMonde(vers.x, vers.z));
    return pts;
  }

  function dessinerTapis(plateau, t, apercu) {
    const pts = points(plateau, t);
    const groupe = new THREE.Group(); groupe.userData.tapis = t.id; plateauGroupe.add(groupe);
    const bande = apercu ? new THREE.MeshStandardMaterial({ color: PAL.accent, emissive: PAL.accent, emissiveIntensity: 0.5, transparent: true, opacity: 0.75 })
      : new THREE.MeshStandardMaterial({ color: 0xffffff, map: texTapis, roughness: 0.9 });
    bande.userData = {};
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], longueur = a.distanceTo(b);
      // le tapis s'arrête au bord des pièces ; un tapis ouvert s'arrête avant la trappe, sur sa dernière case
      const debut = i === 0 ? 0.42 : 0, fin = i === pts.length - 2 ? (t.vers ? 0.42 : t.ouvert && !apercu ? 0.2 : 0) : 0;
      const l = longueur - debut - fin; if (l <= 0.02) continue;
      const d = b.clone().sub(a).normalize(), milieu = a.clone().addScaledVector(d, debut + l / 2);
      const segment = new THREE.Mesh(new THREE.BoxGeometry(l + 0.02, 0.07, TAPIS.largeur), bande);
      segment.position.set(milieu.x, TAPIS.hauteur, milieu.z); segment.rotation.y = -Math.atan2(d.z, d.x);
      ombre(segment); groupe.add(segment);
      for (const s of [-1, 1]) {
        const bord = new THREE.Mesh(new THREE.BoxGeometry(l + 0.02, 0.1, 0.04), M.acier_brosse);
        bord.position.set(0, 0.04, s * (TAPIS.largeur / 2 + 0.02)); segment.add(bord);
      }
    }
    if (t.ouvert && !apercu && pts.length >= 2) groupe.add(trappe(pts[pts.length - 2], pts[pts.length - 1]));
    t.cases.forEach(([x, z], i) => {
      if (t.ouvert && !apercu && i === t.cases.length - 1) return;   // la dernière case d'un tapis ouvert est au-dessus de la trappe : pas de pieds
      const c = versMonde(x, z);
      for (const s of [-1, 1]) { const pied = cylindre(0.025, 0.025, TAPIS.hauteur, M.peinture_sombre, c.x + s * 0.18, TAPIS.hauteur / 2, c.z + s * 0.18, groupe, 6); pied.castShadow = false; }
    });
    const libelle = LIBELLES_SORTIES[t.sortie];
    if (libelle && pts.length >= 2) {
      const a = pts[0], b = pts[1], d = b.clone().sub(a).normalize();
      const e = creerEtiquette(libelle, { petite: true, couleur: t.sortie === "oui" || t.sortie === "sortie" ? "#4fc4a0" : t.sortie === "non" ? "#f2746b" : "#ffc857" });
      e.sprite.position.set(a.x + d.x * 0.85, 0.75, a.z + d.z * 0.85); groupe.add(e.sprite);
    }
  }

  // La trappe : un trou noir dans le sol, juste après la dernière case d'un tapis qui ne mène nulle part.
  function trappe(avant, fin, ephemere = false) {
    const d = fin.clone().sub(avant).normalize();
    const g = new THREE.Group(); g.position.set(fin.x + d.x * TRAPPE.decalage, 0, fin.z + d.z * TRAPPE.decalage); g.userData.trappe = true;
    const bord = new THREE.Mesh(new THREE.RingGeometry(TRAPPE.rayon, TRAPPE.rayon + 0.07, 32), new THREE.MeshBasicMaterial({ color: PAL.erreur, transparent: true, opacity: 0.9, depthWrite: false }));
    bord.rotation.x = -Math.PI / 2; bord.position.y = 0.012; bord.userData.propre = true; g.add(bord);
    const trou = new THREE.Mesh(new THREE.CircleGeometry(TRAPPE.rayon, 32), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    trou.rotation.x = -Math.PI / 2; trou.position.y = 0.014; trou.userData.propre = true; g.add(trou);
    if (ephemere) g.userData.ephemere = true;
    return g;
  }

  // ---------- les pièces ----------
  function modelePiece(p, plateau) {
    const g = new THREE.Group(); g.userData.piece = p.id;
    const lueur = M.led(0x3a3f48, 0.4); lueur.userData = {};
    let bras = null;
    const base = () => boite(0.82, 0.12, 0.82, M.peinture_sombre, 0, 0.06, 0, g);
    switch (p.type) {
      case "cuve": {
        cylindre(0.38, 0.38, 1.25, M.inox, 0, 0.85, 0, g, 28);
        cylindre(0.38, 0.12, 0.3, M.inox, 0, 1.62, 0, g, 28);
        cylindre(0.12, 0.38, 0.22, M.acier_brosse, 0, 0.11, 0, g, 20);
        for (const [x, z] of [[0.3, 0.3], [-0.3, 0.3], [0.3, -0.3], [-0.3, -0.3]]) cylindre(0.03, 0.03, 0.3, M.peinture_sombre, x, 0.15, z, g, 6);
        boite(0.34, 0.2, 0.03, lueur, 0, 0.95, 0.39, g);
        break;
      }
      case "stock": {
        boite(0.86, 0.12, 0.86, M.bois_palette, 0, 0.06, 0, g);
        for (const [x, z, y] of [[-0.2, -0.2, 0.3], [0.2, -0.2, 0.3], [-0.2, 0.2, 0.3], [0.2, 0.2, 0.3], [0, 0, 0.66]]) boite(0.36, 0.34, 0.36, M.carton, x, y, z, g);
        boite(0.2, 0.06, 0.02, lueur, 0, 0.3, 0.39, g);
        break;
      }
      case "remplisseuse": {
        base(); boite(0.72, 0.5, 0.6, M.peinture_metal, 0, 0.37, 0, g);
        cylindre(0.2, 0.2, 0.42, M.inox, 0, 0.83, -0.06, g, 20);
        cylindre(0.03, 0.03, 0.22, M.acier_brosse, 0, 0.6, 0.2, g, 8);
        boite(0.72, 0.05, 0.6, M.peinture_orange, 0, 0.64, 0, g);
        boite(0.24, 0.08, 0.02, lueur, 0.2, 0.42, 0.31, g);
        break;
      }
      case "capsuleuse": {
        base(); boite(0.72, 0.46, 0.6, M.peinture_metal, 0, 0.35, 0, g);
        boite(0.16, 0.6, 0.16, M.acier_brosse, 0, 0.88, 0.05, g);
        cylindre(0.17, 0.12, 0.22, M.peinture_orange, 0, 1.25, 0.05, g, 18);
        boite(0.24, 0.08, 0.02, lueur, 0.2, 0.42, 0.31, g);
        break;
      }
      case "etiqueteuse": {
        base(); boite(0.72, 0.46, 0.6, M.peinture_metal, 0, 0.35, 0, g);
        const rouleau = cylindre(0.16, 0.16, 0.34, M.plastique_mat, 0, 0.78, 0, g, 18); rouleau.rotation.z = Math.PI / 2;
        const couleur = COULEURS_BIERES[p.params.biere] || 0xbfc4cc;
        const bandeau = cylindre(0.165, 0.165, 0.1, M.couleur(couleur, 0.5), 0, 0.78, 0, g, 18); bandeau.rotation.z = Math.PI / 2; bandeau.material.userData = {}; bandeau.userData.propre = true;
        boite(0.24, 0.08, 0.02, lueur, 0.2, 0.42, 0.31, g);
        break;
      }
      case "compteur": {
        boite(0.66, 0.06, 0.56, M.peinture_jaune, 0, 0.5, 0, g);
        for (const [l, p2, x, z] of [[0.66, 0.04, 0, 0.26], [0.66, 0.04, 0, -0.26], [0.04, 0.56, 0.31, 0], [0.04, 0.56, -0.31, 0]]) boite(l, 0.22, p2, M.peinture_jaune, x, 0.62, z, g);
        for (const [x, z] of [[0.28, 0.22], [-0.28, 0.22], [0.28, -0.22], [-0.28, -0.22]]) cylindre(0.025, 0.025, 0.48, M.peinture_sombre, x, 0.24, z, g, 6);
        boite(0.3, 0.1, 0.02, lueur, 0, 0.62, 0.29, g);
        break;
      }
      case "controle": {
        base();
        for (const x of [-0.34, 0.34]) boite(0.08, 1.0, 0.08, M.peinture_metal, x, 0.62, 0, g);
        boite(0.76, 0.14, 0.16, M.peinture_metal, 0, 1.16, 0, g);
        boite(0.5, 0.08, 0.02, lueur, 0, 1.16, 0.09, g);
        const capteur = cylindre(0.05, 0.05, 0.18, M.peinture_orange, 0, 1.0, 0, g, 10); capteur.castShadow = false;
        bras = brasAiguillage(g);
        break;
      }
      case "detecteur": {
        // portique surmonté d'un anneau : la bouteille repasse ici à chaque tour
        base();
        for (const x of [-0.34, 0.34]) boite(0.08, 1.0, 0.08, M.peinture_metal, x, 0.62, 0, g);
        boite(0.76, 0.14, 0.16, M.peinture_metal, 0, 1.16, 0, g);
        boite(0.5, 0.08, 0.02, lueur, 0, 1.16, 0.09, g);
        const tour = ombre(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.045, 10, 32), M.peinture_orange));
        tour.position.set(0, 1.48, 0); tour.rotation.y = Math.PI / 4; g.add(tour);
        const fleche = ombre(new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 12), M.peinture_orange));
        fleche.position.set(0.14, 1.62, -0.14); fleche.rotation.set(0, Math.PI / 4, -Math.PI / 2); g.add(fleche);
        const capteur = cylindre(0.05, 0.05, 0.18, M.peinture_jaune, 0, 1.0, 0, g, 10); capteur.castShadow = false;
        bras = brasAiguillage(g);
        break;
      }
      case "casiers": {
        cylindre(0.42, 0.44, 0.3, M.peinture_metal, 0, 0.15, 0, g, 28);
        cylindre(0.38, 0.38, 0.05, M.inox, 0, 0.33, 0, g, 28);
        boite(0.42, 0.26, 0.3, M.peinture_jaune, 0.05, 0.49, 0.05, g);
        boite(0.3, 0.07, 0.02, lueur, 0, 0.2, 0.43, g);
        break;
      }
      case "machine": {
        base(); boite(0.84, 0.62, 0.66, M.peinture_metal, 0, 0.43, 0, g);
        const etapes = plateau.machine.etapes;
        etapes.forEach((e, i) => boite(0.2, 0.18, 0.2, e === "remplir" ? M.inox : e === "capsuler" ? M.peinture_orange : M.plastique_mat, -0.25 + i * 0.25, 0.84, 0, g));
        boite(0.4, 0.08, 0.02, lueur, 0, 0.5, 0.34, g);
        break;
      }
      case "tableau": {
        cylindre(0.04, 0.05, 0.9, M.peinture_sombre, 0, 0.45, 0, g, 8);
        const ecran = boite(0.8, 0.5, 0.06, M.peinture_sombre, 0, 1.05, 0, g); ecran.rotation.y = Math.PI / 4;
        const face = boite(0.7, 0.4, 0.02, lueur, 0, 1.05, 0.03, g); face.rotation.y = Math.PI / 4; face.position.set(0.025, 1.05, 0.025);
        break;
      }
      case "quai": {
        // le quai : une plaque de niveau rayée, et un camion à plateau garé contre le bord du hall
        const sol2 = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.92), M.danger); sol2.rotation.x = -Math.PI / 2; sol2.position.y = 0.008; sol2.receiveShadow = haute; g.add(sol2);
        for (const z of [-0.42, 0.42]) boite(0.06, 0.9, 0.06, M.peinture_jaune, 0.44, 0.45, z, g);
        boite(0.06, 0.08, 0.9, M.peinture_jaune, 0.44, 0.92, 0, g);
        boite(0.04, 0.12, 0.5, lueur, 0.46, 0.76, 0, g);
        const camion = new THREE.Group(); g.add(camion);
        const x0 = 0.5 + CAMION.recul, sol = -0.55, roue = 0.13;
        boite(CAMION.plateau, 0.06, CAMION.largeur, M.bois_palette, x0 + CAMION.plateau / 2, -0.03, 0, camion);                                   // plateau, au niveau du hall
        boite(CAMION.plateau, 0.12, 0.05, M.peinture_orange, x0 + CAMION.plateau / 2, 0.06, CAMION.largeur / 2, camion);                        // ridelles
        boite(CAMION.plateau, 0.12, 0.05, M.peinture_orange, x0 + CAMION.plateau / 2, 0.06, -CAMION.largeur / 2, camion);
        boite(0.05, 0.3, CAMION.largeur, M.peinture_orange, x0 + CAMION.plateau, 0.13, 0, camion);
        boite(CAMION.plateau + CAMION.cabine, 0.1, 0.3, M.peinture_sombre, x0 + (CAMION.plateau + CAMION.cabine) / 2, -0.12, 0, camion); // châssis
        const xc = x0 + CAMION.plateau + CAMION.cabine / 2 + 0.02;
        boite(CAMION.cabine, 0.5, CAMION.largeur, M.peinture_claire, xc, 0.12, 0, camion);                                                        // cabine
        boite(0.02, 0.2, CAMION.largeur * 0.8, M.verre_fenetre, xc + CAMION.cabine / 2 + 0.005, 0.24, 0, camion);
        for (const x of [x0 + 0.18, x0 + CAMION.plateau * 0.75, xc]) for (const z of [-1, 1]) {
          const r = cylindre(roue, roue, 0.08, M.caoutchouc, x, sol + 0.03 + roue, z * (CAMION.largeur / 2 - 0.02), camion, 14); r.rotation.x = Math.PI / 2;
        }
        break;
      }
      case "rebut": {
        // la benne : un caisson évasé, ouvert en haut, intérieur sombre
        const benne = ombre(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.36, 0.5, 4, 1, true), M.peinture_rouge));
        benne.material = M.peinture_rouge; benne.position.y = 0.3; benne.rotation.y = Math.PI / 4; g.add(benne);
        const fond = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), M.peinture_sombre); fond.rotation.x = -Math.PI / 2; fond.position.y = 0.07; g.add(fond);
        const interieur = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.34, 0.48, 4, 1, true), new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.9, side: THREE.BackSide }));
        interieur.userData.propre = true; interieur.position.y = 0.3; interieur.rotation.y = Math.PI / 4; g.add(interieur);
        for (const z of [-0.36, 0.36]) boite(0.5, 0.05, 0.05, M.peinture_sombre, 0, 0.55, z, g);
        boite(0.2, 0.06, 0.02, lueur, 0, 0.3, 0.3, g);
        break;
      }
      default: base();
    }
    const etiquette = creerEtiquette(texteEtiquette(p, plateau));
    etiquette.sprite.position.y = p.type === "cuve" ? 2.0 : p.type === "detecteur" ? 1.9 : ETIQUETTE.y;
    g.add(etiquette.sprite);
    return { groupe: g, etiquette, lueur, bras };
  }

  // bras d'aiguillage, à hauteur de tapis : il pivote vers la sortie que prend la bouteille
  function brasAiguillage(g) {
    const pivot = new THREE.Group(); pivot.position.set(0, TAPIS.hauteur + 0.06, 0); g.add(pivot);
    boite(0.42, 0.08, 0.06, M.peinture_jaune, 0.21, 0, 0, pivot);
    cylindre(0.06, 0.06, 0.12, M.peinture_sombre, 0, 0, 0, pivot, 12);
    return pivot;
  }

  function texteEtiquette(p, plateau) {
    const q = p.params;
    switch (p.type) {
      case "cuve": return `Cuve ${q.cuve}`;
      case "stock": return "Stock";
      case "etiqueteuse": return q.biere ? `Étiqueteuse · ${q.biere}` : "Étiqueteuse · à régler";
      case "compteur": return `${q.nom || "?"} = 0`;
      case "controle": return q.valeur === null || q.valeur === undefined ? "Contrôle · à régler" : conditionTexte(q).replace('bouteille["', "").replace('"]', "");
      case "detecteur": return q.valeur === null || q.valeur === undefined ? "Boucle · à régler" : "Boucle · " + conditionTexte(q).replace('bouteille["', "").replace('"]', "");
      case "casiers": return `Casiers de ${q.taille} · 0`;
      case "machine": return `${plateau.machine.nom}()${q.biere ? " · " + q.biere : ""}`;
      case "tableau": return q.bac ? `print(${q.bac})` : "Tableau · à régler";
      case "quai": return `${q.quai} · ${QUAIS[q.quai] || ""} · 0`;
      case "rebut": return "Benne · 0";
      default: return PIECES[p.type].nom;
    }
  }

  // Étiquette : texte clair sur fond sombre, toujours tournée vers la caméra.
  function creerEtiquette(texte, { petite = false, couleur = "#f28c1e" } = {}) {
    const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
    const materiau = new THREE.SpriteMaterial({ depthTest: false, toneMapped: false, transparent: true });
    const sprite = new THREE.Sprite(materiau); sprite.renderOrder = 4; sprite.userData.propre = true;
    const hauteurMonde = petite ? ETIQUETTE.hauteur * 0.8 : ETIQUETTE.hauteur;
    const ecrire = (t, etat = null) => {
      const taille = 44, h = 72; ctx.font = `700 ${taille}px ${POLICE}`;
      const l = Math.ceil(ctx.measureText(t).width) + 44 + (etat === null ? 0 : 52);
      canvas.width = l; canvas.height = h;
      ctx.font = `700 ${taille}px ${POLICE}`;
      const bord = etat === true ? "#4fc4a0" : etat === false ? "#f2746b" : couleur;
      ctx.fillStyle = "rgba(14,20,32,0.92)"; arrondi(ctx, 2, 2, l - 4, h - 4, 14); ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = bord; arrondi(ctx, 2, 2, l - 4, h - 4, 14); ctx.stroke();
      ctx.fillStyle = "#eaf2ff"; ctx.textBaseline = "middle"; ctx.fillText(t, 22, h / 2 + 2);
      if (etat !== null) {
        const cx = l - 38, cy = h / 2; ctx.fillStyle = bord; ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#0e1420"; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.beginPath();
        if (etat) { ctx.moveTo(cx - 9, cy); ctx.lineTo(cx - 2, cy + 8); ctx.lineTo(cx + 10, cy - 8); } else { ctx.moveTo(cx - 8, cy - 8); ctx.lineTo(cx + 8, cy + 8); ctx.moveTo(cx + 8, cy - 8); ctx.lineTo(cx - 8, cy + 8); }
        ctx.stroke();
      }
      // la taille du dessin change avec le texte : une nouvelle texture à chaque fois (une texture ne change pas de dimensions)
      if (materiau.map) materiau.map.dispose();
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
      materiau.map = texture; materiau.needsUpdate = true;
      sprite.scale.set(hauteurMonde * (l / h), hauteurMonde, 1);
    };
    ecrire(texte);
    return { sprite, ecrire };
  }

  // ---------- rejeu de l'exécution ----------
  const items = new Map();       // clé de bouteille ou de casier -> { objet, piece }
  const compteurs = new Map();   // id de quai ou de rebut -> nombre reçu
  let plateauCourant = null;

  function preparerRejeu(plateau) {
    plateauCourant = plateau;
    vider(rejeuGroupe); items.clear(); compteurs.clear();
    S.enLigne = false;
    for (const p of plateau.pieces) ecrireEtiquette(p.id, texteEtiquette(p, plateau));
  }

  function bouteilleModele(etat) {
    const g = new THREE.Group();
    const verre = new THREE.MeshStandardMaterial({ color: 0xbfd8d0, roughness: 0.15, metalness: 0.0, transparent: true, opacity: 0.55 });
    const corps = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.3, 14), verre); corps.position.y = 0.15; g.add(corps);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.08, 0.12, 12), verre); col.position.y = 0.36; g.add(col);
    const liquide = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.28, 14), new THREE.MeshStandardMaterial({ color: 0xffc857, roughness: 0.3 }));
    liquide.visible = false; g.add(liquide);
    const capsule = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 12), M.peinture_orange); capsule.position.y = 0.44; capsule.visible = false; g.add(capsule);
    const etiquette = new THREE.Mesh(new THREE.CylinderGeometry(0.093, 0.093, 0.11, 14, 1, true), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, side: THREE.DoubleSide }));
    etiquette.position.y = 0.15; etiquette.visible = false; g.add(etiquette);
    g.traverse((o) => { o.castShadow = haute; o.userData.propre = true; });
    g.userData = { corps, liquide, capsule, etiquette, verre };
    g.scale.setScalar(TAILLE_BOUTEILLE);
    appliquerEtat(g, etat);
    return g;
  }

  function appliquerEtat(g, etat) {
    const u = g.userData;
    const plein = Math.max(0, Math.min(1, (etat.volume_cl || 0) / 33));
    u.liquide.visible = plein > 0;
    u.liquide.scale.y = Math.max(0.05, plein); u.liquide.position.y = 0.01 + 0.14 * u.liquide.scale.y;
    u.liquide.material.color.setHex(COULEURS_BIERES[etat.biere] || 0xffc857);
    u.capsule.visible = Boolean(etat.capsule);
    u.etiquette.visible = Boolean(etat.etiquette);
    if (etat.etiquette) u.etiquette.material.color.setHex(COULEURS_BIERES[etat.etiquette] || 0xffffff);
  }

  function casierModele(n) {
    const g = new THREE.Group();
    const caisse = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.24, 0.42), M.peinture_jaune); caisse.position.y = 0.12; caisse.castShadow = haute; g.add(caisse);
    for (let i = 0; i < Math.min(n, 24); i++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 8), M.couleur(0x5a3412, 0.25)); b.userData.propre = true; b.material.userData = {};
      b.position.set(-0.22 + (i % 6) * 0.088, 0.3, -0.13 + Math.floor(i / 6) * 0.088); g.add(b);
    }
    return g;
  }

  const centre = (id) => { const p = plateauCourant.piece(id); return versMonde(p.x, p.z); };
  const hauteurSur = (id) => { const p = plateauCourant.piece(id); return PIECES[p.type].puits ? 0.08 : TAPIS.hauteur + 0.04; };

  function chemin(de, vers) {
    const t = plateauCourant.tapis.find((u) => u.de === de && u.vers === vers);
    if (!t) return [centre(de), centre(vers)];
    return points(plateauCourant, t);
  }

  function allumer(id, couleur = 0xffc857, force = 3) {
    const o = objets.get(id); if (!o) return;
    o.lueur.emissive.setHex(couleur);
    lueurs.push({ matiere: o.lueur, base: 0.6, force, t: 0, duree: 0.6 });
  }

  // Joue une étape (rejeu-ligne.js) : l'objet va de sa pièce précédente à la pièce de l'étape, puis la pièce agit.
  async function jouerEtape(e, facteur = 1) {
    S.enLigne = true;
    const duree = DUREE_PAS * facteur;
    if (e.type === "init") { for (const [id, texte] of e.etiquettes) ecrireEtiquette(id, texte); return; }
    if (e.type === "print") { ecrireEtiquette(e.piece, e.texte, true); allumer(e.piece, PAL.reussite); sons.jouer("clic"); await animer(duree, () => {}); return; }
    if (e.type === "apparition") {
      const objet = bouteilleModele(e.etat); const c = centre(e.piece);
      objet.position.set(c.x, hauteurSur(e.piece) + 0.6, c.z); rejeuGroupe.add(objet);
      items.set(e.cle, { objet, piece: e.piece });
      allumer(e.piece);
      await animer(duree * 0.6, (k) => { objet.position.y = TAPIS.hauteur + 0.04 + 0.6 * (1 - douceur(k)); });
      return;
    }
    if (e.type === "casier") {                        // un casier plein quitte le carrousel
      const objet = casierModele(e.taille); const c = centre(e.piece);
      objet.position.set(c.x, TAPIS.hauteur + 0.05, c.z); rejeuGroupe.add(objet);
      items.set(e.cle, { objet, piece: e.piece });
      for (const cleB of e.bouteilles) { const it = items.get(cleB); if (it) { rejeuGroupe.remove(it.objet); items.delete(cleB); } }
      ecrireEtiquette(e.piece, e.texteEtiquette);
      allumer(e.piece, PAL.reussite); sons.jouer("clic");
      await animer(duree * 0.6, () => {});
      return;
    }
    if (e.type === "chute") { await chute(e, duree); return; }
    const it = items.get(e.cle);
    if (it && it.piece !== e.piece) {
      const pts = chemin(it.piece, e.piece).map((v) => v.clone());
      const yDepart = it.objet.position.y, yArrivee = hauteurSur(e.piece);
      const longueurs = []; let total = 0;
      for (let i = 0; i < pts.length - 1; i++) { const d = pts[i].distanceTo(pts[i + 1]); longueurs.push(d); total += d; }
      const dureeTrajet = duree * Math.max(0.5, Math.min(2.2, total / 2.2));
      await animer(dureeTrajet, (k) => {
        let reste = k * total, i = 0;
        while (i < longueurs.length - 1 && reste > longueurs[i]) { reste -= longueurs[i]; i++; }
        const f = longueurs[i] ? Math.min(1, reste / longueurs[i]) : 1;
        it.objet.position.lerpVectors(pts[i], pts[i + 1], f);
        it.objet.position.y = k > 0.85 ? yDepart + (yArrivee - yDepart) * ((k - 0.85) / 0.15) : yDepart;
      });
      it.piece = e.piece;
    }
    if (!it) return;
    // la pièce agit
    if (e.etat && !it.objet.userData.casier) appliquerEtat(it.objet, e.etat);
    if (e.etiquette !== undefined) ecrireEtiquette(e.piece, e.etiquette, e.etatEtiquette ?? null);
    if (e.type === "erreur") {
      allumer(e.piece, PAL.erreur, 4); effets.pastille(it.objet.position.x, 1.4, it.objet.position.z, false); effets.secouer(0.05); sons.jouer("rate");
      await animer(duree * 2, (k) => { it.objet.position.x += Math.sin(k * 40) * 0.006; });
      return;
    }
    const p = plateauCourant.piece(e.piece);
    if (p.type === "quai" || p.type === "rebut") {
      compteurs.set(p.id, (compteurs.get(p.id) || 0) + 1);
      ecrireEtiquette(p.id, p.type === "quai" ? `${p.params.quai} · ${QUAIS[p.params.quai] || ""} · ${compteurs.get(p.id)}` : `Benne · ${compteurs.get(p.id)}`);
      allumer(p.id, p.type === "quai" ? PAL.reussite : PAL.erreur);
      sons.jouer(p.type === "quai" ? "neutre" : "rate");
      const o = it.objet; items.delete(e.cle);
      const n = compteurs.get(p.id) - 1, c = centre(p.id), depart = o.position.clone(), s0 = o.scale.x;
      if (p.type === "quai") {
        // chargée sur le plateau du camion, en rangs serrés
        const echelle = (o.userData.casier ? 0.5 : 0.55) * (o.userData.casier ? 1 : TAILLE_BOUTEILLE);
        const x = c.x + 0.5 + CAMION.recul + 0.1 + (Math.floor(n / 5) % 5) * 0.15, z = c.z - 0.28 + (n % 5) * 0.14, y = 0.0 + Math.floor(n / 25) * 0.24;
        await animer(duree * 0.6, (k) => {
          o.position.lerpVectors(depart, new THREE.Vector3(x, y, z), douceur(k)); o.position.y += Math.sin(Math.PI * k) * 0.35;
          o.scale.setScalar(s0 + (echelle - s0) * k);
        });
      } else {
        // jetée dans la benne : elle disparaît au fond
        await animer(duree * 0.6, (k) => {
          o.position.lerpVectors(depart, new THREE.Vector3(c.x, 0.1, c.z), k); o.position.y += Math.sin(Math.PI * k) * 0.45;
          o.scale.setScalar(s0 * (1 - 0.6 * k));
        });
        rejeuGroupe.remove(o);
      }
      return;
    }
    if (p.type === "casiers") { it.objet.position.copy(centre(p.id)).setY(0.4); it.objet.position.x += ((e.rang || 0) % 6) * 0.04 - 0.1; }
    if (p.type === "controle" || p.type === "detecteur") {
      const sortie = p.type === "controle" ? (e.vrai ? "oui" : "non") : (e.vrai ? "encore" : "sortie");
      aiguiller(p.id, sortie);
      allumer(e.piece, p.type === "controle" ? (e.vrai ? PAL.reussite : PAL.erreur) : (e.vrai ? 0xffc857 : PAL.reussite));
    } else allumer(e.piece, 0xffc857);
    if (["remplisseuse", "capsuleuse", "etiqueteuse", "machine"].includes(p.type)) sons.jouer("clic");
    await animer(duree * 0.35, () => {});
  }

  // Le bras d'aiguillage d'un contrôle ou d'un détecteur pivote vers le tapis de la sortie prise.
  function aiguiller(id, sortie) {
    const o = objets.get(id); if (!o || !o.bras) return;
    const t = plateauCourant.tapis.find((u) => u.de === id && u.sortie === sortie);
    if (!t) return;
    const pts = points(plateauCourant, t), d = pts[1].clone().sub(pts[0]);
    const cible = -Math.atan2(d.z, d.x), depart = o.bras.rotation.y;
    let ecart = cible - depart; while (ecart > Math.PI) ecart -= 2 * Math.PI; while (ecart < -Math.PI) ecart += 2 * Math.PI;
    animer(DUREE_PAS * 0.25, (k) => { o.bras.rotation.y = depart + ecart * douceur(k); });
  }

  // La bouteille (ou le casier) suit le tapis ouvert jusqu'au bout, puis tombe dans la trappe.
  // Sans tapis sur la sortie, elle tombe dans une trappe qui s'ouvre au pied de la pièce.
  async function chute(e, duree) {
    const it = items.get(e.cle); if (!it) return;
    const o = it.objet, t = plateauCourant.tapis.find((u) => u.de === e.piece && u.sortie === e.sortie);
    let fin, avant, provisoire = null;
    if (t) {
      const pts = points(plateauCourant, t);
      if (it.piece === e.piece) {
        const longueurs = []; let total = 0;
        for (let i = 0; i < pts.length - 1; i++) { const d = pts[i].distanceTo(pts[i + 1]); longueurs.push(d); total += d; }
        const y = o.position.y;
        await animer(duree * Math.max(0.5, Math.min(2.2, total / 2.2)), (k) => {
          let reste = k * total, i = 0;
          while (i < longueurs.length - 1 && reste > longueurs[i]) { reste -= longueurs[i]; i++; }
          o.position.lerpVectors(pts[i], pts[i + 1], longueurs[i] ? Math.min(1, reste / longueurs[i]) : 1); o.position.y = y;
        });
      }
      avant = pts[pts.length - 2]; fin = pts[pts.length - 1];
    } else {
      // pas de tapis : la trappe s'ouvre juste devant la pièce, côté est
      avant = centre(e.piece); fin = avant.clone().add(new THREE.Vector3(0.56, 0, 0));
      provisoire = trappe(avant, fin, true); rejeuGroupe.add(provisoire);
    }
    const d = fin.clone().sub(avant).normalize(), bord = new THREE.Vector3(fin.x + d.x * TRAPPE.decalage, o.position.y, fin.z + d.z * TRAPPE.decalage);
    const depart = o.position.clone(), s0 = o.scale.x;
    allumer(e.piece, PAL.erreur, 2); sons.jouer("rate");
    await animer(duree * 0.9, (k) => {
      if (k < 0.35) o.position.lerpVectors(depart, bord, k / 0.35);
      else { const f = (k - 0.35) / 0.65; o.position.set(bord.x, depart.y - (depart.y + TRAPPE.profondeur) * f * f, bord.z); o.scale.setScalar(s0 * (1 - 0.75 * f)); o.rotation.z = f * 1.2; }
    });
    rejeuGroupe.remove(o); items.delete(e.cle);
    if (provisoire) rejeuGroupe.remove(provisoire);
  }

  function terminer({ reussi }) {
    S.enLigne = false;
    if (reussi) {
      for (const o of objets.values()) lueurs.push({ matiere: o.lueur, base: 0.6, force: 2.5, t: 0, duree: 1.2 });
      const q = plateauCourant.pieces.find((p) => p.type === "quai");
      if (q) { const c = centre(q.id); effets.confettis(c.x, 1.2, c.z); }
      sons.jouer("victoire");
    } else sons.jouer("alerte");
  }

  function detruire() {
    S.vivant = false; observateur.disconnect(); environnement.dispose(); rendu.dispose();
    if (rendu.domElement.parentNode) rendu.domElement.parentNode.removeChild(rendu.domElement);
  }

  return Object.assign(S, { dessiner, preparerRejeu, jouerEtape, terminer, detruire, allumer, ecrireEtiquette, rendu, camera });
}

// ---------- textures dessinées ----------
function arrondi(ctx, x, y, l, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + l, y, x + l, y + h, r); ctx.arcTo(x + l, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + l, y, r); ctx.closePath();
}

function texGrille(L, P) {
  const px = 64, c = document.createElement("canvas"); c.width = L * px; c.height = P * px;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#4a4e57"; ctx.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 2500; i++) { ctx.fillStyle = `rgba(${Math.random() < 0.5 ? "255,255,255" : "0,0,0"},0.05)`; ctx.fillRect(Math.random() * c.width, Math.random() * c.height, 2, 2); }
  ctx.strokeStyle = "rgba(255,255,255,0.13)"; ctx.lineWidth = 2;
  for (let x = 0; x <= L; x++) { ctx.beginPath(); ctx.moveTo(x * px, 0); ctx.lineTo(x * px, c.height); ctx.stroke(); }
  for (let z = 0; z <= P; z++) { ctx.beginPath(); ctx.moveTo(0, z * px); ctx.lineTo(c.width, z * px); ctx.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function texChevrons() {
  const c = document.createElement("canvas"); c.width = 128; c.height = 64;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#1b1c20"; ctx.fillRect(0, 0, 128, 64);
  ctx.strokeStyle = "#f5b82e"; ctx.lineWidth = 7; ctx.lineCap = "round";
  for (const x0 of [20, 84]) { ctx.beginPath(); ctx.moveTo(x0, 14); ctx.lineTo(x0 + 18, 32); ctx.lineTo(x0, 50); ctx.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(1, 1);
  return t;
}
