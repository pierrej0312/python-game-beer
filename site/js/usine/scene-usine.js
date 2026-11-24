// L'usine de la Fonderie : la scène 3D, en vue isométrique.
// Elle dessine une disposition (disposition.js), réagit au survol et aux clics (machines, fentes « + »),
// et rejoue l'exécution : un fût roule de machine en machine, chaque machine s'allume quand sa ligne tourne.
import * as THREE from "three";
import { OrbitControls } from "../../vendor/three/addons/OrbitControls.js";
import { RoundedBoxGeometry } from "../../vendor/three/addons/RoundedBoxGeometry.js";
import * as sons from "../commun/sons.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { creerDecor } from "./decor-usine.js";
import { fabriquerMachine, fabriquerModule, bouteille, MODULE_FERME } from "./machines-usine.js";
import { creerParc } from "./stock-usine.js";
import { EffectComposer } from "../../vendor/three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "../../vendor/three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "../../vendor/three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "../../vendor/three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "../../vendor/three/addons/postprocessing/OutputPass.js";
import { HorizontalTiltShiftShader } from "../../vendor/three/addons/shaders/HorizontalTiltShiftShader.js";
import { VerticalTiltShiftShader } from "../../vendor/three/addons/shaders/VerticalTiltShiftShader.js";
import { VignetteShader } from "../../vendor/three/addons/shaders/VignetteShader.js";
const CALQUE_ETIQUETTES = 1;
const ECHELLE = 1.4;              // les machines sont agrandies : on les reconnaît sans zoomer      // les étiquettes sont dessinées après les effets : jamais floues, jamais éblouies

const COULEURS = {
  variable: 0x4fc4a0, liste: 0xf5b82e, tuple: 0xef8a6a, dict: 0xf39ac0, set: 0x9be08a,
  condition: 0xc9a3f5, boucle: 0x5ad1e0, sortie: 0x8fb3ff, libre: 0x9aa0ad, quai: 0x23ab67,
};
const FAMILLE = {
  variable: "variable", calcul: "variable", creer_liste: "liste", ajouter: "liste", retirer: "liste", lire_case: "liste", tranche: "liste",
  longueur: "liste", contient: "liste", trier_copie: "liste", trier_sur_place: "liste", remplacer_case: "liste", creer_tuple: "tuple",
  decomposer: "tuple", creer_dict: "dict", lire_cle: "dict", lire_get: "dict", ecrire_cle: "dict", creer_set: "set", ajouter_set: "set",
  si: "condition", pour: "boucle", tantque: "boucle", afficher: "sortie", renvoyer: "quai", code_libre: "libre", groupeur: "condition",
  bloc: "condition", partie: "condition", importer: "libre",
};
export const familleDe = (type) => FAMILLE[type] || "libre";
const SOL = 0x2b2d35, TAPIS = 0x3b3f4a, ACCENT = 0xffc857;
const POLICE_CODE = '600 28px "JetBrains Mono", Consolas, monospace';
const POLICE_TEXTE = '600 26px "Barlow", "Segoe UI", sans-serif';

const lisse = (t) => t * t * (3 - 2 * t);
const rebond = (t) => { const c = 1.70158, c3 = c + 1; return 1 + c3 * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

// ---- étiquettes : du texte dessiné sur une toile, toujours face à la caméra ----
function etiquette(texte, { code = true, fond = "#ffffff", encre = "#1d1638", liseré = null, echelle = 0.0085 } = {}) {
  const toile = document.createElement("canvas"), c = toile.getContext("2d");
  c.font = code ? POLICE_CODE : POLICE_TEXTE;
  const w = Math.ceil(c.measureText(texte).width) + 36 + (liseré ? 10 : 0), h = 52;
  toile.width = w; toile.height = h;
  c.font = code ? POLICE_CODE : POLICE_TEXTE;
  c.fillStyle = fond; c.beginPath(); c.roundRect(2, 2, w - 4, h - 4, 12); c.fill();
  if (liseré) { c.fillStyle = liseré; c.beginPath(); c.roundRect(2, 2, 10, h - 4, [12, 0, 0, 12]); c.fill(); }
  c.fillStyle = encre; c.textBaseline = "middle"; c.fillText(texte, 18 + (liseré ? 6 : 0), h / 2 + 1);
  const tex = new THREE.CanvasTexture(toile); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, toneMapped: false }));
  sprite.layers.set(CALQUE_ETIQUETTES);
  sprite.scale.set(w * echelle, h * echelle, 1);
  sprite.renderOrder = 10;
  sprite.userData.pixels = { w, h, facteur: echelle / 0.0085 };     // taille constante à l'écran (voir tailleEtiquettes)
  return sprite;
}

// ---- la texture des tapis : des chevrons qui avancent ----
function textureTapis() {
  const toile = document.createElement("canvas"); toile.width = 128; toile.height = 64;
  const c = toile.getContext("2d");
  c.fillStyle = "#3b3f4a"; c.fillRect(0, 0, 128, 64);
  c.strokeStyle = "#5a6070"; c.lineWidth = 3;
  for (let x = 0; x < 128; x += 8) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 64); c.stroke(); }
  c.fillStyle = "#ffc857"; c.globalAlpha = 0.85;
  c.beginPath(); c.moveTo(50, 14); c.lineTo(78, 32); c.lineTo(50, 50); c.lineTo(60, 32); c.closePath(); c.fill();
  const tex = new THREE.CanvasTexture(toile); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function creerSceneUsine(conteneur, { surFente = () => {}, surMachine = () => {}, surVide = () => {}, surSurvol = () => {}, surModule = null, qualite = "haute" } = {}) {
  const haute = qualite === "haute";
  const rendu = new THREE.WebGLRenderer({ antialias: true });
  rendu.setPixelRatio(Math.min(window.devicePixelRatio || 1, haute ? 2 : 1));
  rendu.outputColorSpace = THREE.SRGBColorSpace;
  rendu.toneMapping = THREE.ACESFilmicToneMapping; rendu.toneMappingExposure = 0.95;
  rendu.shadowMap.enabled = haute; rendu.shadowMap.type = THREE.VSMShadowMap;      // ombres douces
  conteneur.appendChild(rendu.domElement);
  rendu.domElement.classList.add("toile-usine");

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1b1c22);
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, -200, 400);
  let azimut = 1.42, azimutVise = azimut;           // vue de trois quarts : la ligne se lit de gauche à droite, comme le code
  const ELEVATION = 0.64;                           // vue de trois quarts : on voit la face des cuves et des machines
  const controles = new OrbitControls(camera, rendu.domElement);
  controles.enableRotate = false; controles.screenSpacePanning = true; controles.zoomToCursor = true;
  controles.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  controles.minZoom = 0.08; controles.maxZoom = 4;
  camera.layers.enable(CALQUE_ETIQUETTES);   // pour viser les fentes « + » (sprites) avec le rayon

  // ---- les effets (graphismes complets) : éclat des lumières, mise au point sur la ligne, vignettage ----
  let effets = null;
  if (haute) {
    const composeur = new EffectComposer(rendu);
    composeur.addPass(new RenderPass(scene, camera));
    const eclat = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.22, 0.4, 0.93);   // seules les vraies lumières brillent
    composeur.addPass(eclat);
    const flouH = new ShaderPass(HorizontalTiltShiftShader), flouV = new ShaderPass(VerticalTiltShiftShader);
    composeur.addPass(flouH); composeur.addPass(flouV);
    const vignette = new ShaderPass(VignetteShader); vignette.uniforms.offset.value = 0.95; vignette.uniforms.darkness.value = 1.15;
    composeur.addPass(vignette);
    composeur.addPass(new OutputPass());
    effets = { composeur, flouH, flouV, eclat };
  }

  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x30323c, 0.9));
  const soleil = new THREE.DirectionalLight(0xffe2b8, 2.0);      // la lumière des verrières, chaude
  soleil.position.set(-12, 24, 10); soleil.castShadow = true;
  soleil.shadow.mapSize.set(haute ? 2048 : 1024, haute ? 2048 : 1024); soleil.shadow.radius = 5; soleil.shadow.blurSamples = 10; soleil.shadow.bias = -0.0005;
  Object.assign(soleil.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 90 });
  scene.add(soleil, soleil.target);

  const sol = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x17181d, roughness: 0.95 }));
  sol.rotation.x = -Math.PI / 2; sol.position.y = -0.01; sol.receiveShadow = true; scene.add(sol);
  // les reflets des métaux : un environnement d'atelier, calculé une fois
  const pmrem = new THREE.PMREMGenerator(rendu);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  let leDecor = null;

  const texTapis = textureTapis();
  const matTapis = new THREE.MeshStandardMaterial({ map: texTapis, roughness: 0.8 });
  const matBord = new THREE.MeshStandardMaterial({ color: 0x1f2128, roughness: 0.6, metalness: 0.3 });

  let groupe = new THREE.Group(); scene.add(groupe);
  let parent = groupe;            // où poser ce qu'on construit : l'usine, ou l'intérieur d'un module
  // les modules (def) : nom -> { g (le bâtiment), interieur (groupe), ouvert, k (0 fermé, 1 ouvert), parc, afficheur }
  const modules = new Map(), ouverts = new Set(), kModules = new Map();
  const dans = (o, f) => {
    if (o.module && !ouverts.has(o.module)) return;          // module fermé : son intérieur n'est pas construit
    parent = o.module && modules.has(o.module) ? modules.get(o.module).interieur : groupe; f(o); parent = groupe;
  };
  let cliquables = [], machines = new Map(), fentes = [], survol = null, outil = false, cles = new Set();
  const animations = [];
  // la bouteille qui suit le programme, de machine en machine (plus grande que les autres : on la suit des yeux)
  const fut = bouteille(1.7); fut.visible = false; scene.add(fut);
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 24), new THREE.MeshBasicMaterial({ color: 0xffc857, transparent: true, opacity: 0.8, depthWrite: false }));
  halo.rotation.x = -Math.PI / 2; halo.position.y = 0.02; fut.add(halo);
  let bulle = null;
  let enMarche = false;
  const parc = creerParc();
  let valeursStock = {};          // les dernières valeurs connues des variables : gardées d'un dessin à l'autre
  let valeursModules = {};        // de même pour les variables locales de chaque module

  function anime(duree, pas, fin) { return new Promise((ok) => animations.push({ t: 0, duree, pas, fin: () => { fin && fin(); ok(); } })); }

  // ---- effets : poussière à la pose, étincelles au travail ----
  const geoGrain = new THREE.SphereGeometry(0.08, 6, 4);
  function particules(x, y, z, n, couleur, vitesse, duree, gravite) {
    const mat = new THREE.MeshBasicMaterial({ color: couleur, transparent: true });
    const grains = [];
    for (let i = 0; i < n; i++) {
      const g = new THREE.Mesh(geoGrain, mat); g.position.set(x, y, z);
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      g.userData.v = new THREE.Vector3(Math.cos(a) * vitesse * (0.6 + Math.random() * 0.6), vitesse * (0.4 + Math.random()), Math.sin(a) * vitesse * (0.6 + Math.random() * 0.6));
      scene.add(g); grains.push(g);
    }
    anime(duree, (t) => {
      grains.forEach((g) => { g.position.addScaledVector(g.userData.v, 0.016); g.userData.v.y -= gravite * 0.016; g.scale.setScalar(1 + t); });
      mat.opacity = 1 - t;
    }, () => { grains.forEach((g) => scene.remove(g)); mat.dispose(); });
  }
  const poussiere = (x, z) => { particules(x, 0.15, z, 14, 0xb8a98f, 2.2, 600, 2); sons.jouer("choc"); };
  const etincelles = (x, z) => particules(x, 1.0, z, 8, 0xffc857, 3, 380, 9);

  // ---- l'hologramme : la machine à poser suit la souris sur les « + » ----
  // l'hologramme : la machine choisie, en verre bleu, suit la souris sur les « + »
  const fantome = new THREE.Group(); fantome.visible = false; scene.add(fantome);
  const matHolo = new THREE.MeshBasicMaterial({ color: 0x5ad1e0, transparent: true, opacity: 0.32, depthWrite: false });
  function preparerFantome(type, m = null) {
    fantome.clear();
    if (!type) return;
    const modele = fabriquerMachine(type, 0x5ad1e0, m); modele.scale.setScalar(ECHELLE);
    modele.userData.corps.visible = false;
    modele.traverse((o) => { if (o.isMesh && o !== modele.userData.corps) { o.material = matHolo; o.castShadow = false; } });
    fantome.add(modele);
  }
  function montrerFantome(f) { if (!f || !outil) { fantome.visible = false; return; } fantome.position.set(f.x, 0, f.z); fantome.visible = true; }

  // ---- l'usine vivante : des caisses roulent sur les tapis, même à l'arrêt ----
  let caisses = [];

  function semerCaisses(segments) {
    caisses = [];
    segments.forEach((seg, i) => {
      const long = Math.hypot(seg.b[0] - seg.a[0], seg.b[1] - seg.a[1]); if (long < 7) return;
      const n = Math.floor(long / 7);
      for (let k = 0; k < n; k++) {
        const c = bouteille(1.1);
        c.userData = { seg, long, d: (k / n) * long };
        groupe.add(c); caisses.push(c);
      }
    });
  }

  // ---- la livraison : le camion vient chercher les fûts au bout de la ligne ----
  async function livrer(x, z, etoiles = 1) {
    const camion = new THREE.Group();
    const caisse = new THREE.Mesh(new RoundedBoxGeometry(2.6, 1.3, 1.5, 2, 0.08), new THREE.MeshStandardMaterial({ color: 0x2e1a6e, roughness: 0.6 }));
    caisse.position.set(-0.4, 1.05, 0); caisse.castShadow = true;
    const cabine = new THREE.Mesh(new RoundedBoxGeometry(1.0, 1.0, 1.5, 2, 0.08), new THREE.MeshStandardMaterial({ color: 0x23ab67, roughness: 0.5 }));
    cabine.position.set(1.45, 0.9, 0); cabine.castShadow = true;
    const vitre = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshStandardMaterial({ color: 0x9cd6ff, metalness: 0.4, roughness: 0.1 }));
    vitre.rotation.y = Math.PI / 2; vitre.position.set(1.96, 1.1, 0);
    camion.add(caisse, cabine, vitre);
    for (const [rx, rz] of [[-1.2, 0.75], [-1.2, -0.75], [1.4, 0.75], [1.4, -0.75]]) {
      const roue = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 16), matBord); roue.rotation.x = Math.PI / 2; roue.position.set(rx, 0.32, rz); camion.add(roue);
    }
    const zc = z + 2.6; camion.position.set(x - 12, 0, zc); scene.add(camion);
    await anime(900, (t) => { camion.position.x = x - 12 + 12 * lisse(t); });
    for (let i = 0; i < 3; i++) { etincelles(x, zc); sons.jouer("clic"); await anime(160, () => {}); }
    sons.jouer(etoiles >= 3 ? "victoire" : "reussi");
    particules(x, 2.4, zc, 26, 0xffc857, 3.5, 900, 3);
    await anime(1100, (t) => { camion.position.x = x + 14 * t * t; });
    scene.remove(camion);
  }

  // ---- construction ----
  let reserveTapis = new Map(), tapisPoses = new Map();
  function tapis(de, a, retour = false) {
    const [x1, z1] = de, [x2, z2] = a;
    const long = Math.hypot(x2 - x1, z2 - z1);
    if (long < 0.01) return;
    const cle = `${x1},${z1},${x2},${z2},${retour}`;
    const dispo = reserveTapis.get(cle);
    if (dispo && dispo.length) { const paire = dispo.pop(); paire.forEach((o) => { o.parent && o.parent.remove(o); parent.add(o); }); poserTapis(cle, paire); return; }
    const g = new THREE.BoxGeometry(long + 0.7, 0.1, 0.7);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (long + 0.7) / 1.4);
    const m = new THREE.Mesh(g, retour ? matTapis.clone() : matTapis);
    if (retour) m.material.color.set(0x9adbe6);
    m.position.set((x1 + x2) / 2, 0.06, (z1 + z2) / 2);
    m.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    m.receiveShadow = true;
    parent.add(m);
    const bord = new THREE.Mesh(new THREE.BoxGeometry(long + 0.8, 0.08, 0.84), matBord);
    bord.position.copy(m.position); bord.position.y = 0.03; bord.rotation.y = m.rotation.y; parent.add(bord);
    poserTapis(cle, [m, bord]);
  }
  function poserTapis(cle, paire) { if (!tapisPoses.has(cle)) tapisPoses.set(cle, []); tapisPoses.get(cle).push(paire); }

  function chemin(t) { const pts = [t.de, ...(t.par || []), t.a]; for (let i = 0; i + 1 < pts.length; i++) tapis(pts[i], pts[i + 1], t.retour); }

  function batiment(m) {
    const g = fabriquerModule(m.boite, 0x7dffe0);
    g.position.set(m.boite.x1, 0, m.boite.z2);                      // le coin avant gauche : il ne bouge pas à l'ouverture
    const interieur = new THREE.Group(); groupe.add(interieur);
    const nom = etiquette(m.nom, { code: true, fond: "#efe6d2", encre: "#1d1d1d", liseré: "#c27a3e", echelle: 0.011 });
    nom.userData.pixels.facteur = 1.3; groupe.add(nom);
    const corps = g.userData.corps; corps.userData = { machine: m, batiment: m.nom }; cliquables.push(corps);
    const mod = { g, interieur, nom, k: kModules.get(m.nom) ?? (ouverts.has(m.nom) ? 1 : 0), parc: creerParc(), afficheur: null, machine: m };
    interieur.add(mod.parc.groupe);
    modules.set(m.nom, mod);
    machines.set(m.id, g);
    groupe.add(g);
    afficherEntrees(m.nom, null);
  }
  // L'afficheur de la boîte d'entrée : les valeurs reçues par les paramètres (ou leurs noms, avant la marche).
  function afficherEntrees(nom, etat) {
    const mod = modules.get(nom); if (!mod) return;
    if (mod.afficheur) mod.g.remove(mod.afficheur);
    const ps = mod.machine.parametres;
    const texte = etat ? ps.map((p) => `${p} = ${etat[p] ? texteValeurCourt(etat[p]) : "?"}`).join(", ") : ps.join(", ") || "( )";
    mod.afficheur = etiquette(texte.length > 30 ? texte.slice(0, 29) + "…" : texte, { fond: "#2a1a08", encre: "#ffb347" });
    mod.afficheur.position.copy(mod.g.userData.entree); mod.afficheur.position.y += 0.5; mod.g.add(mod.afficheur); etiquettes.push(mod.afficheur);
  }
  const texteValeurCourt = (e) => { const t = e.t === "str" ? `"${e.v}"` : e.v !== undefined && !Array.isArray(e.v) ? String(e.v) : e.t; return t.length > 14 ? t.slice(0, 13) + "…" : t; };
  // Ouvre ou ferme un module : le toit se relève, la façade se rabat, la ligne intérieure apparaît.
  function ouvrirModule(nom, oui) {
    const mod = modules.get(nom); if (!mod) return false;
    const avant = ouverts.has(nom);
    if (oui) ouverts.add(nom); else ouverts.delete(nom);
    if (avant !== oui) { if (surModule) surModule(nom, oui); else redessiner(); }
    return oui;
  }
  const moduleOuvert = (nom) => ouverts.has(nom);

  // La clé d'une machine : tout ce qui change son aspect. Une machine de même clé au dessin précédent est réemployée telle quelle.
  const cleMachine = (m) => JSON.stringify([m.type, m.role, m.texte, m.x, m.z, m.module || "", m.appel || "", m.condition || "", m.genre || "", m.partie ?? "", m.voie ?? "", !!m.decor]);
  let reserve = new Map();          // clé -> machines du dessin précédent, en attente de réemploi
  function machine(m, nouvelle) {
    if (m.role === "module") { batiment(m); return; }
    const fam = m.role === "quai" ? "quai" : familleDe(m.type);
    const couleur = COULEURS[fam] ?? COULEURS.libre;
    const cle = cleMachine(m), dispo = reserve.get(cle);
    if (dispo && dispo.length) {
      const g = dispo.pop();
      g.parent && g.parent.remove(g);
      g.userData.corps.userData = { machine: m, module: m.module || null };
      if (!m.decor) cliquables.push(g.userData.corps);
      machines.set(m.id, g); parent.add(g);
      return;
    }
    const g = fabriquerMachine(m.role === "groupeur" ? "groupeur" : m.appel ? "appel" : m.type, couleur, m);
    g.position.set(m.x, 0, m.z);
    g.userData.echelle = ECHELLE; g.scale.setScalar(ECHELLE); g.userData.cle = cle; g.userData.famille = couleur;
    g.traverse((o) => { if (o.isMesh && o !== g.userData.corps) o.castShadow = o.castShadow && haute; });
    // le voyant : vert au repos, il respire doucement ; jaune quand la machine travaille
    if (g.userData.hautVoyant) {
      const voyant = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), new THREE.MeshStandardMaterial({ color: 0x23ab67, emissive: 0x23ab67, emissiveIntensity: 1 }));
      voyant.position.set(0.62, g.userData.hautVoyant, 0.62); g.add(voyant); g.userData.voyant = voyant;
    }
    if (m.texte) {
      const e = etiquette(m.texte.length > 18 ? m.texte.slice(0, 17) + "…" : m.texte, { liseré: "#" + couleur.toString(16).padStart(6, "0") });
      e.userData.niveau = "code";
      // une machine sur deux porte son étiquette plus haut : deux voisines ne se cachent pas
      const decale = Math.round(m.x / 4.4) % 2 ? 0.9 : 0;
      // l'étiquette est fille de la machine agrandie : on compense, pour qu'elle garde la taille des autres
      e.userData.pixels.facteur /= ECHELLE;
      e.position.set(0, Math.max(1.45, (g.userData.hautVoyant || 1) + 0.35) + decale / ECHELLE, 0); g.add(e); g.userData.etiquette = e;
    }
    const corps = g.userData.corps;
    corps.userData = { machine: m, module: m.module || null };
    if (!m.decor) cliquables.push(corps);
    machines.set(m.id, g);
    parent.add(g);
    if (nouvelle) {
      // la machine descend de l'hologramme et se pose : un choc, un nuage de poussière
      g.position.y = 3.2; g.scale.setScalar(0.85 * ECHELLE);
      anime(420, (t) => { g.position.y = 3.2 * (1 - t * t); g.scale.setScalar((0.85 + 0.15 * t) * ECHELLE); },
        () => { g.position.y = 0; poussiere(m.x, m.z); anime(220, (t) => g.scale.set(ECHELLE * (1 + 0.12 * Math.sin(Math.PI * t)), ECHELLE * (1 - 0.1 * Math.sin(Math.PI * t)), ECHELLE * (1 + 0.12 * Math.sin(Math.PI * t)))); });
    }
  }

  function station(s) {
    const g = new THREE.Group(); g.position.set(s.x, 0, s.z);
    const entree = s.role === "entree" || s.role === "entree-module" || s.role === "entree-essais";
    const annexe = s.role === "entree-module" || s.role === "entree-essais";
    const quai = new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.35, 1.8, 3, 0.08), new THREE.MeshStandardMaterial({ color: annexe ? 0x1f7f80 : entree ? 0x5b4a8a : 0x4a4f5c, roughness: 0.6 }));
    quai.position.y = 0.2; quai.castShadow = quai.receiveShadow = true; g.add(quai);
    if (s.role === "entree") for (let i = 0; i < 3; i++) {
      const caisse = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.42, 0.42, 2, 0.05), new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.8 }));
      caisse.position.set(-0.4 + i * 0.4, 0.58, -0.45 + (i % 2) * 0.3); caisse.castShadow = true; g.add(caisse);
    }
    const e = etiquette(s.texte, { code: entree && s.role !== "entree-essais", fond: annexe ? "#155c5d" : entree ? "#2e1a6e" : "#3a3d48", encre: "#ffffff" });
    e.position.set(0, 1.35, 0); g.add(e);
    parent.add(g);
  }

  function fente(f) {
    const g = new THREE.Group(); g.position.set(f.x, 0.16, f.z);
    const disque = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 24), new THREE.MeshStandardMaterial({ color: ACCENT, emissive: ACCENT, emissiveIntensity: 0.35, roughness: 0.4 }));
    g.add(disque);
    const plus = etiquette("+", { code: false, fond: "#ffc857", encre: "#1c1e23", echelle: 0.0085 });
    plus.position.y = 0.45; plus.userData.pixels.facteur = 0.9; g.add(plus);
    disque.userData = { fente: f, module: f.module || null };
    g.userData.disque = disque;
    cliquables.push(disque);
    fentes.push(g);
    parent.add(g);
  }

  function zone(z) {
    const couleur = z.type === "si" ? 0xc9a3f5 : z.type === "bloc" ? 0xffb347 : 0x5ad1e0;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(z.x2 - z.x1, z.z2 - z.z1), new THREE.MeshStandardMaterial({ color: couleur, transparent: true, opacity: 0.1 + 0.04 * z.profondeur, roughness: 1, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set((z.x1 + z.x2) / 2, 0.004 + 0.002 * z.profondeur, (z.z1 + z.z2) / 2);
    parent.add(m);
    const bord = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(z.x2 - z.x1, z.z2 - z.z1)), new THREE.LineBasicMaterial({ color: couleur, transparent: true, opacity: 0.55 }));
    bord.rotation.x = -Math.PI / 2; bord.position.copy(m.position); parent.add(bord);
  }

  // break, continue : un tube de verre aérien, de la machine vers la sortie (break) ou l'entrée (continue) de la boucle
  let sauts = [];
  const matTubeSaut = new THREE.MeshStandardMaterial({ color: 0xbfe6ff, roughness: 0.05, transparent: true, opacity: 0.28, depthWrite: false });
  function saut(sa) {
    const [x1, z1] = sa.de, [x2, z2] = sa.a, haut = 3.2 + Math.hypot(x2 - x1, z2 - z1) * 0.12;
    const courbe = new THREE.CatmullRomCurve3([new THREE.Vector3(x1 + 0.3, 1.1, z1), new THREE.Vector3(x1 + 0.6, haut, z1), new THREE.Vector3(x2, haut, z2), new THREE.Vector3(x2, 0.6, z2)], false, "catmullrom", 0.2);
    const verre = new THREE.Mesh(new THREE.TubeGeometry(courbe, 48, 0.16, 10, false), matTubeSaut); parent.add(verre);
    const fil = new THREE.Mesh(new THREE.TubeGeometry(courbe, 48, 0.035, 6, false), new THREE.MeshStandardMaterial({ color: sa.genre === "break" ? 0xff6a5a : 0x6ee7f0, emissive: sa.genre === "break" ? 0xff3b30 : 0x6ee7f0, emissiveIntensity: 0.6 }));
    parent.add(fil);
    for (const k of [0.25, 0.5, 0.75]) {
      const fleche = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 10), fil.material);
      fleche.position.copy(courbe.getPoint(k)); fleche.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), courbe.getTangent(k)); parent.add(fleche);
    }
    sauts.push({ ...sa, courbe });
  }
  // La bouteille file dans le tube du break ou du continue posé en (x, z).
  async function filer(x, z, duree = 600) {
    const sa = sauts.find((u) => Math.abs(u.de[0] - x) < 0.01 && Math.abs(u.de[1] - z) < 0.01); if (!sa) return;
    fut.visible = true;
    await anime(duree, (t) => { fut.position.copy(sa.courbe.getPoint(lisse(t))); fut.position.y -= 0.2; });
    fut.position.set(sa.a[0], 0.12, sa.a[1]);
  }

  // Les appels : un tube lumineux, du poste d'appel jusqu'à la boîte d'entrée du module (la bouteille y voyage, aller et retour).
  let liaisons = [];
  const matLiaison = new THREE.MeshStandardMaterial({ color: 0x7dffe0, emissive: 0x2fe0c0, emissiveIntensity: 0.9, transparent: true, opacity: 0.55, depthWrite: false });
  function liaison(li) {
    const mod = modules.get(li.nom); if (!mod) return;
    const e = mod.g.userData.entree.clone().add(mod.g.position);
    const [x1, z1] = li.de, haut = 2.6;
    const pts = [new THREE.Vector3(x1 + 0.6, 1.0, z1 + 0.6), new THREE.Vector3(x1 + 0.6, haut, z1 + 0.9), new THREE.Vector3(e.x - 1.2, haut, e.z), new THREE.Vector3(e.x - 0.4, 1.0, e.z)];
    const courbe = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.15);
    const tubeM = new THREE.Mesh(new THREE.TubeGeometry(courbe, 60, 0.11, 10, false), matLiaison); groupe.add(tubeM);
    liaisons.push({ ...li, courbe });
  }
  // La bouteille voyage dans le tube d'appel : aller (vers le module), retour (vers le poste d'appel).
  async function voyager(depuis, sens, duree = 700) {
    const li = liaisons.find((x) => x.depuis === depuis); if (!li) return;
    fut.visible = true;
    await anime(duree, (t) => { const k = lisse(t); fut.position.copy(li.courbe.getPoint(sens === "aller" ? k : 1 - k)); fut.position.y -= 0.25; });
  }

  function voie(v) {
    const fonds = { vrai: "#23ab67", sinon: "#7a5cc4", directe: "#4a4f5c", boucle: "#2a9aab" };
    const e = etiquette(v.libelle.length > 34 ? v.libelle.slice(0, 33) + "…" : v.libelle, { code: false, fond: fonds[v.couleur] || "#4a4f5c", encre: "#ffffff", echelle: 0.008 });
    // sous le tapis, à gauche de la première machine : il ne la cache pas
    e.userData.niveau = "detail"; e.center.set(1, 0.5);
    e.position.set(v.x + 0.6, 0.3, v.z + 1.05); parent.add(e);
  }

  // Redessine toute l'usine. Les machines nouvelles (inconnues au dessin précédent) apparaissent avec un rebond.
  // Redessine l'usine. Ce qui n'a pas changé est réemployé (machines, tapis, décor) : modifier une ligne ne reconstruit
  // que ses machines. L'intérieur d'un module n'est construit que s'il est ouvert.
  let derniere = null, cleDecor = "";
  function construire(d, { cadrer: recadrer = false } = {}) {
    derniere = d;
    const ancien = groupe;
    reserve = new Map();
    for (const g of machines.values()) if (g.userData.cle) { if (!reserve.has(g.userData.cle)) reserve.set(g.userData.cle, []); reserve.get(g.userData.cle).push(g); }
    reserveTapis = tapisPoses; tapisPoses = new Map();
    groupe = new THREE.Group(); scene.add(groupe);
    cliquables = []; machines = new Map(); fentes = []; survol = null; modules.clear(); parent = groupe;
    const anciennes = cles; cles = new Set();
    // les bâtiments d'abord : leur intérieur reçoit ce qui suit
    d.machines.filter((m) => m.role === "module").forEach((m) => machine(m));
    for (const nom of [...ouverts]) if (!modules.has(nom)) ouverts.delete(nom);
    d.zones.forEach((o) => dans(o, zone));
    d.tapis.forEach((o) => dans(o, chemin));
    d.stations.forEach((o) => dans(o, station));
    let nouvelles = 0;
    d.machines.filter((m) => m.role !== "module").forEach((m) => {
      const cle = `${m.type}|${m.texte}|${m.role}`; cles.add(cle);
      const neuve = anciennes.size > 0 && !anciennes.has(cle);
      if (neuve) nouvelles++;
      dans(m, (x) => machine(x, neuve));
    });
    d.fentes.forEach((o) => dans(o, fente));
    d.voies.forEach((o) => dans(o, voie));
    sauts = []; (d.sauts || []).forEach((o) => dans(o, saut));
    liaisons = []; (d.liaisons || []).filter((li) => !li.module || ouverts.has(li.module)).forEach(liaison);
    for (const [nom, mod] of modules) if (ouverts.has(nom)) mod.parc.disposer((d.parcs || {})[nom] || [], valeursModules[nom] || {});
    parc.disposer(d.parc || [], valeursStock); groupe.add(parc.groupe);
    const dep = d.stations.find((x) => x.role === "entree") || { x: -5, z: 0 };
    const cle = JSON.stringify([d.etendue, dep.x, dep.z]);
    if (leDecor && cle === cleDecor) { ancien.remove(leDecor.groupe); groupe.add(leDecor.groupe); }
    else { leDecor = creerDecor(d.etendue, { qualite, depart: { x: dep.x, z: dep.z } }); groupe.add(leDecor.groupe); cleDecor = cle; }
    const segments = [];
    d.tapis.filter((t) => !t.module).forEach((t) => { const pts = [t.de, ...(t.par || []), t.a]; for (let i = 0; i + 1 < pts.length; i++) segments.push({ a: pts[i], b: pts[i + 1] }); });
    semerCaisses(segments);
    construireLod();
    majFentes();
    // l'ancien dessin part, sauf ce qui a été réemployé (déjà déplacé dans le nouveau)
    scene.remove(ancien);
    ancien.traverse((o) => { if (o.geometry && !o.geometry.userData.partage) o.geometry.dispose(); });
    reserve = new Map(); reserveTapis = new Map();
    collecterEtiquettes();
    if (recadrer) cadrer(d.etendue);
    return nouvelles;
  }
  // Ouvrir ou fermer un module redessine l'usine : son intérieur n'existe que s'il est ouvert.
  function redessiner() { if (derniere) construire(derniere); }

  // ---- niveau de détail : de loin, une boîte par machine, toutes dessinées d'un coup (une seule instance) ----
  const SEUIL_LOD = 0.34;
  let lod = null;
  const geoLod = new THREE.BoxGeometry(1.6 * ECHELLE, 1.3 * ECHELLE, 1.6 * ECHELLE); geoLod.translate(0, 0.65 * ECHELLE, 0); geoLod.userData.partage = true;
  const matLod = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.3 });
  function construireLod() {
    const liste = [...machines.values()].filter((g) => g.userData.cle);
    lod = new THREE.InstancedMesh(geoLod, matLod, Math.max(1, liste.length));
    const mat = new THREE.Matrix4(), couleur = new THREE.Color();
    liste.forEach((g, i) => {
      mat.makeTranslation(g.position.x, 0, g.position.z); lod.setMatrixAt(i, mat);
      lod.setColorAt(i, couleur.setHex(g.userData.famille || 0x9aa0ad).lerp(new THREE.Color(0xb87333), 0.35));
    });
    lod.count = liste.length; lod.visible = false;
    groupe.add(lod);
  }

  // ---- ce qui est à l'écran : seules ces machines s'animent et se recalculent ----
  const frustum = new THREE.Frustum(), projection = new THREE.Matrix4(), sphere = new THREE.Sphere(new THREE.Vector3(), 2.4);
  let compteImages = 0, loin = false;
  function majVisibles() {
    camera.updateMatrixWorld();
    projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(projection);
    loin = camera.zoom < SEUIL_LOD;
    if (lod) lod.visible = loin;
    if (leDecor) leDecor.groupe.visible = !loin;         // de très loin, le décor (cuves, tuyaux, lampes) s'efface
    machines.forEach((g) => {
      if (!g.userData.cle) return;
      sphere.center.set(g.position.x, 1, g.position.z);
      const ecran = !loin && frustum.intersectsSphere(sphere);
      if (ecran !== g.userData.ecran) {
        g.userData.ecran = ecran; g.visible = ecran; g.matrixWorldAutoUpdate = ecran;
        if (ecran) g.updateMatrixWorld(true);
      }
    });
  }

  // ---- caméra ----
  let cible = new THREE.Vector3();
  function placerCamera() {
    const dist = 60;
    camera.position.set(cible.x + dist * Math.cos(ELEVATION) * Math.cos(azimut), cible.y + dist * Math.sin(ELEVATION), cible.z + dist * Math.cos(ELEVATION) * Math.sin(azimut));
    controles.target.copy(cible); camera.lookAt(cible);
  }
  // Cadre toute l'usine : les coins de son étendue, projetés dans la vue, doivent tenir dans l'écran.
  function cadrer(e) {
    cible = new THREE.Vector3((e.x1 + e.x2) / 2, 0, (e.z1 + e.z2) / 2);
    placerCamera(); camera.updateMatrixWorld();
    let x1 = Infinity, x2 = -Infinity, y1 = Infinity, y2 = -Infinity;
    // le cadre montre la ligne et, au fond, le bas des cuves : on voit qu'on est dans la brasserie
    // marges serrées : la ligne et le parc remplissent l'écran, le décor (cuves, murs) déborde autour
    // à gauche, 2 m de plus qu'avant le 23/11 : l'enseigne du bâtiment (nom de la fonction et ses paramètres) n'est plus coupée
    const coins = [[e.x1 - 1, e.z1 - 1.5, 3.6], [e.x2 - 1, e.z1 - 1.5, 3.6], [e.x1 - 1, e.z2, 0], [e.x2 - 1, e.z2, 0]];
    for (const [x, z, y] of coins) {
      const v = new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse);
      x1 = Math.min(x1, v.x); x2 = Math.max(x2, v.x); y1 = Math.min(y1, v.y); y2 = Math.max(y2, v.y);
    }
    const zoom = 0.97 * Math.min((camera.right - camera.left) / (x2 - x1), (camera.top - camera.bottom) / (y2 - y1));
    camera.zoom = Math.min(3, Math.max(0.08, zoom));
    // centre la vue sur le cadre tel qu'on le voit, pas sur son centre au sol
    // la cible se projette au centre de la vue (0, 0 en coordonnées caméra) : on la décale vers le centre du cadre
    const decalage = new THREE.Vector3((x1 + x2) / 2, (y1 + y2) / 2, 0).applyQuaternion(camera.quaternion);
    cible.add(decalage); placerCamera();
    camera.updateProjectionMatrix(); controles.update();
  }
  // Cadre une emprise au sol (l'intérieur d'un module), sans la marge du décor.
  function cadrerBoite(b) {
    cible = new THREE.Vector3((b.x1 + b.x2) / 2, 0, (b.z1 + b.z2) / 2); placerCamera(); camera.updateMatrixWorld();
    let x1 = Infinity, x2 = -Infinity, y1 = Infinity, y2 = -Infinity;
    for (const [x, z, y] of [[b.x1 - 1.5, b.z1, 2.6], [b.x2 + 1, b.z1, 2.6], [b.x1 - 1.5, b.z2, 0], [b.x2 + 1, b.z2, 0]]) {
      const v = new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse);
      x1 = Math.min(x1, v.x); x2 = Math.max(x2, v.x); y1 = Math.min(y1, v.y); y2 = Math.max(y2, v.y);
    }
    camera.zoom = Math.min(3, Math.max(0.3, 0.92 * Math.min((camera.right - camera.left) / (x2 - x1), (camera.top - camera.bottom) / (y2 - y1))));
    cible.add(new THREE.Vector3((x1 + x2) / 2, (y1 + y2) / 2, 0).applyQuaternion(camera.quaternion)); placerCamera();
    camera.updateProjectionMatrix(); controles.update();
  }
  function tourner(sens) { azimutVise += sens * Math.PI / 2; }
  // Amène la vue en douceur sur un point du sol, au zoom voulu.
  function viser(x, z, zoom = 1.4) {
    const de = cible.clone(), z0 = camera.zoom, a = new THREE.Vector3(x, 0, z);
    return anime(450, (t) => { const k = lisse(t); cible = de.clone().lerp(a, k); placerCamera(); camera.zoom = z0 + (zoom - z0) * k; camera.updateProjectionMatrix(); controles.update(); });
  }
  // Fait clignoter une machine (sa bande de famille), pour la retrouver d'un coup d'œil.
  function signaler(id) {
    const g = machines.get(id); if (!g) return;
    anime(1400, (t) => g.userData.surbrillance(Math.sin(t * Math.PI * 6) > 0), () => g.userData.surbrillance(false));
  }
  // Approche la vue d'un point du sol (zoom : 1 = vue normale, plus grand = plus près).
  function regarder(x, z, zoom = 2) { cible = new THREE.Vector3(x, 0, z); placerCamera(); camera.zoom = zoom; camera.updateProjectionMatrix(); controles.update(); }

  function redimensionner() {
    const w = conteneur.clientWidth, h = conteneur.clientHeight;
    if (!w || !h) return;
    rendu.setSize(w, h, false);
    if (effets) {
      effets.composeur.setSize(w, h);
      effets.flouH.uniforms.h.value = 1.3 / w; effets.flouV.uniforms.v.value = 1.3 / h;
    }
    const demi = 10;
    camera.left = -demi * w / h; camera.right = demi * w / h; camera.top = demi; camera.bottom = -demi;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(redimensionner).observe(conteneur);

  // ---- survol et clics ----
  const rayon = new THREE.Raycaster(), souris = new THREE.Vector2();
  let appui = null;
  function viser(ev) {
    const r = rendu.domElement.getBoundingClientRect();
    souris.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    rayon.setFromCamera(souris, camera);
    // un module fermé cache son intérieur ; ouvert, son bâtiment ne fait plus écran
    const actifs = cliquables.filter((o) => (o.userData.module ? ouverts.has(o.userData.module) : true) && !(o.userData.batiment && ouverts.has(o.userData.batiment)));
    const touche = rayon.intersectObjects(actifs, false)[0];
    return touche ? touche.object : null;
  }
  rendu.domElement.addEventListener("pointerdown", (ev) => { appui = { x: ev.clientX, y: ev.clientY }; });
  rendu.domElement.addEventListener("pointermove", (ev) => {
    const o = viser(ev);
    if (o !== survol) {
      if (survol && survol.userData.fente) survol.parent.scale.setScalar(1);
      if (survol && survol.userData.machine) machines.get(survol.userData.machine.id)?.userData.surbrillance(false);
      survol = o;
      if (o && o.userData.fente) o.parent.scale.setScalar(1.35);
      montrerFantome(o && o.userData.fente ? o.userData.fente : null);
      if (o && o.userData.machine) { machines.get(o.userData.machine.id)?.userData.surbrillance(true); surSurvol(o.userData.machine); }
      rendu.domElement.style.cursor = o ? "pointer" : "grab";
    }
  });
  rendu.domElement.addEventListener("pointerup", (ev) => {
    if (!appui || Math.hypot(ev.clientX - appui.x, ev.clientY - appui.y) > 5) { appui = null; return; }
    appui = null;
    const o = viser(ev);
    if (o && o.userData.fente) surFente(o.userData.fente, ev);
    else if (o && o.userData.machine) surMachine(o.userData.machine, ev);
    else surVide(ev);
  });

  function majFentes() { fentes.forEach((f) => { f.userData.disque.material.emissiveIntensity = outil ? 0.9 : 0.35; }); }
  function choisirOutil(type, m = null) { outil = !!type; preparerFantome(type, m); majFentes(); if (!type) fantome.visible = false; }

  // Position à l'écran d'un point du sol, pour poser un champ HTML au-dessus d'une machine.
  function projeter(x, z, y = 1.6) {
    const v = new THREE.Vector3(x, y, z).project(camera), r = rendu.domElement.getBoundingClientRect();
    return { left: (v.x + 1) / 2 * r.width, top: (1 - v.y) / 2 * r.height };
  }

  // ---- rejeu ----
  // La machine travaille : son geste propre (le bras pivote, la sonde descend, le rideau remonte…), le voyant passe au jaune.
  function allumer(id, info = {}) {
    const g = machines.get(id); if (!g) return Promise.resolve();
    g.userData.travail_en_cours = performance.now();
    const duree = info.duree || 520;
    if (info.etincelles !== false && g.userData.modele !== "groupeur") etincelles(g.position.x, g.position.z);
    const ech = g.userData.echelle || 1;
    if (ech !== 1) anime(220, (t) => { g.scale.setScalar(ech * (1 + 0.06 * Math.sin(Math.PI * t))); });
    return anime(duree, (t) => g.userData.travail(t, info));
  }
  // Un objet vole d'un point à un autre, en cloche : de la machine vers son contenant (écrire), ou l'inverse (lire).
  const geoColis = new RoundedBoxGeometry(0.26, 0.2, 0.26, 2, 0.04);
  function voler(de, a, couleur, duree) {
    const colis = new THREE.Mesh(geoColis, new THREE.MeshStandardMaterial({ color: couleur, emissive: couleur, emissiveIntensity: 0.35, roughness: 0.5 }));
    scene.add(colis);
    const haut = Math.max(de.y, a.y) + 1.6 + de.distanceTo(a) * 0.12;
    return anime(duree, (t) => {
      const k = lisse(t);
      colis.position.set(de.x + (a.x - de.x) * k, de.y + (a.y - de.y) * k + 4 * (haut - Math.max(de.y, a.y)) * t * (1 - t), de.z + (a.z - de.z) * k);
      colis.rotation.y = t * 4;
    }, () => { scene.remove(colis); colis.material.dispose(); });
  }
  function pointMachine(id) { const g = machines.get(id); return g ? new THREE.Vector3(g.position.x, 1.5, g.position.z) : null; }
  async function prelever(nom, id, duree = 320, module = null) {
    const p = parcDe(module), de = p.position(nom), a = pointMachine(id); if (!de || !a) return;
    p.sauter(nom); await voler(de, a, 0x5ad1e0, duree);
  }
  async function deposer(id, nom, duree = 320, module = null) {
    const de = pointMachine(id), a = parcDe(module).position(nom); if (!de || !a) return;
    await voler(de, a, 0xffc857, duree);
  }
  // L'état des variables, contenant par contenant. anime : pendant la marche (les objets nouveaux poussent).
  function majStock(etat, anime = false, module = null) {
    if (module) { const mod = modules.get(module); if (!mod) return []; valeursModules[module] = { ...etat }; const r = mod.parc.maj(etat, anime); if (r.length) collecterEtiquettes(); return r; }
    valeursStock = { ...etat }; const r = parc.maj(etat, anime); if (r.length) collecterEtiquettes(); return r;
  }
  const parcDe = (module) => (module && modules.has(module) ? modules.get(module).parc : parc);
  const connaitStock = (nom, module = null) => parcDe(module).connait(nom);
  // Les valeurs de départ (au prochain dessin) : celles du premier cas de test, ou rien pour un programme.
  function reinitialiserStock(etat) { valeursStock = { ...etat }; valeursModules = {}; }
  function montrerBulle(id, texte, erreur = false) {
    if (bulle) { groupe.remove(bulle); bulle = null; }
    const g = machines.get(id); if (!g || !texte) return;
    bulle = etiquette(texte.length > 46 ? texte.slice(0, 45) + "…" : texte, { fond: erreur ? "#ee434b" : "#ffc857", encre: "#1c1e23", echelle: 0.012 });
    bulle.position.set(g.position.x, 3.0, g.position.z); groupe.add(bulle); etiquettes.push(bulle);
  }
  function cacherBulle() { if (bulle) { groupe.remove(bulle); bulle = null; } }
  // Le fût roule jusqu'à la machine, par un chemin en équerre (le long des tapis).
  async function amenerFut(id, duree = 420) {
    const g = machines.get(id); if (!g) return;
    const de = fut.visible ? fut.position.clone() : new THREE.Vector3(g.position.x - 2, 0.12, g.position.z);
    const a = new THREE.Vector3(g.position.x - 1.15 * (g.userData.echelle || 1), 0.12, g.position.z);       // à l'entrée de la machine, sur le tapis
    fut.visible = true;
    const coude = new THREE.Vector3(Math.abs(a.z - de.z) > 0.1 ? de.x : a.x, 0.12, de.z);
    const l1 = de.distanceTo(coude), l2 = coude.distanceTo(a), l = l1 + l2 || 1;
    await anime(duree, (t) => {
      const s = lisse(t) * l;
      if (s <= l1) fut.position.lerpVectors(de, coude, l1 ? s / l1 : 1); else fut.position.lerpVectors(coude, a, l2 ? (s - l1) / l2 : 1);
      fut.position.y = 0.12 + Math.abs(Math.sin(t * Math.PI)) * 0.12;
      fut.rotation.z = 0.12 * Math.sin(t * Math.PI * 6) * (1 - t);
    });
  }
  function cacherFut() { fut.visible = false; }

  // Les étiquettes gardent presque la même taille à l'écran, quel que soit le zoom ; de loin, elles rapetissent un peu
  // et les détails s'effacent (niveau de détail), pour que la vue d'ensemble reste lisible :
  // - « detail » (libellés des voies) : visibles d'assez près ;
  // - « code » (la ligne de chaque machine) : effacées seulement de très loin ;
  // - « nom » / « valeur » (plaques du parc) : de loin le nom seul, de près le nom et la valeur.
  const PIXELS_ECRAN = 0.48;          // une étiquette de 52 px de haut sur la toile en fait environ 29 à l'écran
  const SEUILS = { detail: 0.95, code: 0.5, valeur: 1.05 };
  let etiquettes = [];
  function collecterEtiquettes() { etiquettes = []; scene.traverse((o) => { if (o.isSprite && o.userData.pixels) etiquettes.push(o); }); }
  function tailleEtiquettes() {
    const h = rendu.domElement.clientHeight || 600, z = camera.zoom;
    const unite = (camera.top - camera.bottom) / z / h, reduit = Math.min(1, Math.max(0.62, z / 1.3));
    etiquettes.forEach((o) => {
      const p = o.userData.pixels;
      if (!o.parent) return;
      const n = o.userData.niveau;
      if (n === "nom") o.visible = z < SEUILS.valeur;
      else if (n) o.visible = z >= SEUILS[n];
      const k = unite * PIXELS_ECRAN * p.facteur * reduit;
      o.scale.set(p.w * k, p.h * k, 1);
    });
  }
  const zoomActuel = () => camera.zoom;

  // ---- boucle de rendu ----
  let avant = performance.now();
  function boucle(maintenant) {
    // les animations suivent l'horloge, pas le nombre d'images : sur un poste lent, elles gardent leur durée
    const dt = Math.min(300, maintenant - avant); avant = maintenant;
    texTapis.offset.x -= dt * 0.0009;
    if (Math.abs(azimutVise - azimut) > 0.001) { azimut += (azimutVise - azimut) * Math.min(1, dt * 0.012); cible.copy(controles.target); placerCamera(); }
    for (let i = animations.length - 1; i >= 0; i--) {
      const a = animations[i]; a.t += dt; const t = Math.min(1, a.t / a.duree); a.pas(t);
      if (t >= 1) { animations.splice(i, 1); a.fin(); }
    }
    if (compteImages++ % 6 === 0) majVisibles();
    machines.forEach((g) => {
      if (g.userData.cle && !g.userData.ecran) return;
      const travaille = g.userData.travail_en_cours && maintenant - g.userData.travail_en_cours < 700;
      // au repos, chaque machine rejoue son geste ; pendant la marche, seule celle qui travaille bouge
      if (!travaille) (enMarche || !g.userData.cycle ? g.userData.repos : g.userData.cycle)(maintenant);
      const v = g.userData.voyant; if (!v) return;
      v.material.emissive.setHex(travaille ? 0xffc857 : 0x23ab67); v.material.color.setHex(travaille ? 0xffc857 : 0x23ab67);
      v.material.emissiveIntensity = travaille ? 2 : 0.6 + 0.4 * Math.sin(maintenant * 0.003 + g.userData.phase);
    });
    for (const c of caisses) {
      const u = c.userData; u.d = (u.d + dt * 0.0011) % u.long;
      const k = u.d / u.long;
      c.position.set(u.seg.a[0] + (u.seg.b[0] - u.seg.a[0]) * k, 0.11, u.seg.a[1] + (u.seg.b[1] - u.seg.a[1]) * k);
    }
    tailleEtiquettes();
    soleil.position.set(controles.target.x - 10, 22, controles.target.z - 16); soleil.target.position.copy(controles.target);
    if (leDecor) leDecor.animer(maintenant, dt);
    parc.animer(maintenant, dt);
    for (const [nom, mod] of modules) {
      const vise = ouverts.has(nom) ? 1 : 0;
      if (Math.abs(mod.k - vise) > 0.001) mod.k += (vise - mod.k) * Math.min(1, dt * 0.006);
      kModules.set(nom, mod.k);
      const { l } = mod.g.userData.ouvrir(lisse(Math.min(1, Math.max(0, mod.k))));
      mod.nom.position.set(mod.g.position.x + l / 2, 2.95, mod.g.position.z + 0.2);
      mod.interieur.visible = mod.k > 0.15;
      mod.parc.animer(maintenant, dt);
    }
    controles.update();
    if (effets) {
      // la mise au point suit la ligne de production : la cible de la caméra est au centre de l'écran
      const y = new THREE.Vector3().copy(controles.target).project(camera).y * 0.5 + 0.5;
      effets.flouH.uniforms.r.value = y; effets.flouV.uniforms.r.value = y;
      camera.layers.set(0); effets.composeur.render(dt / 1000);
      // les étiquettes par-dessus ; sans le fond de la scène, qui effacerait l'image (un fond uni force l'effacement)
      const fond = scene.background; scene.background = null;
      rendu.autoClear = false; rendu.clearDepth();
      camera.layers.set(CALQUE_ETIQUETTES); rendu.render(scene, camera);
      rendu.autoClear = true; camera.layers.enable(0); scene.background = fond;
    } else rendu.render(scene, camera);
    requestAnimationFrame(boucle);
  }
  redimensionner(); placerCamera(); requestAnimationFrame(boucle);

  return { construire, cadrer, cadrerBoite, tourner, regarder, viser, signaler, choisirOutil, projeter, allumer, montrerBulle, cacherBulle, amenerFut, cacherFut, livrer,
    majStock, connaitStock, reinitialiserStock, prelever, deposer, filer, voyager, ouvrirModule, moduleOuvert, afficherEntrees,
    machine: (id) => machines.get(id), zoomActuel, redessiner,
    stats: () => { let objets = 0; scene.traverse(() => objets++); return { dessins: rendu.info.render.calls, triangles: rendu.info.render.triangles, objets, machines: machines.size }; }, marche: (oui) => { enMarche = oui; },
    positionMachine: (id) => { const g = machines.get(id); return g ? { x: g.position.x, z: g.position.z } : null; } };
}
