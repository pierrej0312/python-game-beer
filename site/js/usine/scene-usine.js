// L'usine de la Fonderie : la scène 3D, en vue isométrique.
// Elle dessine une disposition (disposition.js), réagit au survol et aux clics (machines, fentes « + »),
// et rejoue l'exécution : un fût roule de machine en machine, chaque machine s'allume quand sa ligne tourne.
import * as THREE from "three";
import { OrbitControls } from "../../vendor/three/addons/OrbitControls.js";
import { RoundedBoxGeometry } from "../../vendor/three/addons/RoundedBoxGeometry.js";

const COULEURS = {
  variable: 0x4fc4a0, liste: 0xf5b82e, tuple: 0xef8a6a, dict: 0xf39ac0, set: 0x9be08a,
  condition: 0xc9a3f5, boucle: 0x5ad1e0, sortie: 0x8fb3ff, libre: 0x9aa0ad, quai: 0x23ab67,
};
const FAMILLE = {
  variable: "variable", calcul: "variable", creer_liste: "liste", ajouter: "liste", retirer: "liste", lire_case: "liste", tranche: "liste",
  longueur: "liste", contient: "liste", trier_copie: "liste", trier_sur_place: "liste", remplacer_case: "liste", creer_tuple: "tuple",
  decomposer: "tuple", creer_dict: "dict", lire_cle: "dict", lire_get: "dict", ecrire_cle: "dict", creer_set: "set", ajouter_set: "set",
  si: "condition", pour: "boucle", tantque: "boucle", afficher: "sortie", renvoyer: "quai", code_libre: "libre", groupeur: "condition",
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
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
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

export function creerSceneUsine(conteneur, { surFente = () => {}, surMachine = () => {}, surVide = () => {}, surSurvol = () => {} } = {}) {
  const rendu = new THREE.WebGLRenderer({ antialias: true });
  rendu.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  rendu.outputColorSpace = THREE.SRGBColorSpace;
  rendu.shadowMap.enabled = true; rendu.shadowMap.type = THREE.PCFShadowMap;
  conteneur.appendChild(rendu.domElement);
  rendu.domElement.classList.add("toile-usine");

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1b1c22);
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, -200, 400);
  let azimut = 1.42, azimutVise = azimut;           // vue de trois quarts : la ligne se lit de gauche à droite, comme le code
  const ELEVATION = 0.78;                           // vue plongeante : les rangs ne se cachent pas
  const controles = new OrbitControls(camera, rendu.domElement);
  controles.enableRotate = false; controles.screenSpacePanning = true; controles.zoomToCursor = true;
  controles.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  controles.minZoom = 0.3; controles.maxZoom = 4;

  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x30323c, 1.4));
  const soleil = new THREE.DirectionalLight(0xffffff, 2.2);
  soleil.position.set(-12, 24, 10); soleil.castShadow = true;
  soleil.shadow.mapSize.set(2048, 2048);
  Object.assign(soleil.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 80 });
  scene.add(soleil, soleil.target);

  const sol = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: SOL, roughness: 0.95 }));
  sol.rotation.x = -Math.PI / 2; sol.receiveShadow = true; scene.add(sol);
  const grille = new THREE.GridHelper(400, 200, 0x34373f, 0x30323a); grille.position.y = 0.002; scene.add(grille);

  const texTapis = textureTapis();
  const matTapis = new THREE.MeshStandardMaterial({ map: texTapis, roughness: 0.8 });
  const matBord = new THREE.MeshStandardMaterial({ color: 0x1f2128, roughness: 0.6, metalness: 0.3 });
  const geoMachine = new RoundedBoxGeometry(1.35, 0.9, 1.35, 4, 0.14);
  const geoFut = new THREE.CylinderGeometry(0.28, 0.28, 0.5, 24);
  const matFut = new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.7, roughness: 0.35 });

  let groupe = new THREE.Group(); scene.add(groupe);
  let cliquables = [], machines = new Map(), fentes = [], survol = null, outil = false, cles = new Set();
  const animations = [];
  const fut = new THREE.Mesh(geoFut, matFut); fut.castShadow = true; fut.visible = false; scene.add(fut);
  const cercles = new THREE.Group(); fut.add(cercles);
  for (const y of [-0.17, 0.17]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.285, 0.03, 8, 24), matBord); r.rotation.x = Math.PI / 2; r.position.y = y; cercles.add(r); }
  let bulle = null;

  function anime(duree, pas, fin) { return new Promise((ok) => animations.push({ t: 0, duree, pas, fin: () => { fin && fin(); ok(); } })); }

  // ---- construction ----
  function tapis(de, a, retour = false) {
    const [x1, z1] = de, [x2, z2] = a;
    const long = Math.hypot(x2 - x1, z2 - z1);
    if (long < 0.01) return;
    const g = new THREE.BoxGeometry(long + 0.7, 0.1, 0.7);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (long + 0.7) / 1.4);
    const m = new THREE.Mesh(g, retour ? matTapis.clone() : matTapis);
    if (retour) m.material.color.set(0x9adbe6);
    m.position.set((x1 + x2) / 2, 0.06, (z1 + z2) / 2);
    m.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    m.receiveShadow = true;
    groupe.add(m);
    const bord = new THREE.Mesh(new THREE.BoxGeometry(long + 0.8, 0.08, 0.84), matBord);
    bord.position.copy(m.position); bord.position.y = 0.03; bord.rotation.y = m.rotation.y; groupe.add(bord);
  }

  function chemin(t) { const pts = [t.de, ...(t.par || []), t.a]; for (let i = 0; i + 1 < pts.length; i++) tapis(pts[i], pts[i + 1], t.retour); }

  function machine(m, nouvelle) {
    const fam = m.role === "quai" ? "quai" : familleDe(m.type);
    const couleur = COULEURS[fam] ?? COULEURS.libre;
    const g = new THREE.Group(); g.position.set(m.x, 0, m.z);
    let corps;
    if (m.role === "repartiteur") {
      corps = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 0.9, 6), new THREE.MeshStandardMaterial({ color: couleur, roughness: 0.45 }));
      corps.position.y = 0.55;
    } else if (m.role === "carrousel") {
      corps = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.7, 32), new THREE.MeshStandardMaterial({ color: couleur, roughness: 0.4 }));
      corps.position.y = 0.45;
      const anneau = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.08, 10, 32), matBord); anneau.rotation.x = Math.PI / 2; anneau.position.y = 0.42;
      corps.add(anneau); g.userData.tourne = corps;
    } else if (m.role === "groupeur") {
      corps = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.45, 6), new THREE.MeshStandardMaterial({ color: couleur, roughness: 0.6 }));
      corps.position.y = 0.3;
    } else if (m.role === "quai") {
      corps = new THREE.Mesh(new RoundedBoxGeometry(1.7, 0.5, 1.7, 3, 0.1), new THREE.MeshStandardMaterial({ color: couleur, roughness: 0.5 }));
      corps.position.y = 0.3;
      const fleche = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.6, 3), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      fleche.rotation.z = -Math.PI / 2; fleche.position.set(0.1, 0.42, 0); corps.add(fleche);
    } else {
      corps = new THREE.Mesh(geoMachine, new THREE.MeshStandardMaterial({ color: couleur, roughness: 0.45 }));
      corps.position.y = 0.55;
      const plaque = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 1.0), new THREE.MeshStandardMaterial({ color: 0x1f2128, roughness: 0.4 }));
      plaque.position.y = 0.46; corps.add(plaque);
    }
    corps.castShadow = true; corps.receiveShadow = true;
    g.add(corps);
    if (m.texte) {
      const e = etiquette(m.texte.length > 18 ? m.texte.slice(0, 17) + "…" : m.texte, { liseré: "#" + couleur.toString(16).padStart(6, "0") });
      // une machine sur deux porte son étiquette plus haut : deux voisines ne se cachent pas
      const decale = Math.round(m.x / 5) % 2 ? 0.9 : 0;
      e.position.set(0, (m.role === "quai" ? 1.25 : 1.45) + decale, 0); g.add(e); g.userData.etiquette = e;
    }
    corps.userData = { machine: m };
    g.userData.corps = corps;
    cliquables.push(corps);
    machines.set(m.id, g);
    groupe.add(g);
    if (nouvelle) { g.scale.setScalar(0.01); anime(380, (t) => g.scale.setScalar(Math.max(0.01, rebond(t)))); }
  }

  function station(s) {
    const g = new THREE.Group(); g.position.set(s.x, 0, s.z);
    const quai = new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.35, 1.8, 3, 0.08), new THREE.MeshStandardMaterial({ color: s.role === "entree" ? 0x5b4a8a : 0x4a4f5c, roughness: 0.6 }));
    quai.position.y = 0.2; quai.castShadow = quai.receiveShadow = true; g.add(quai);
    if (s.role === "entree") for (let i = 0; i < 3; i++) {
      const caisse = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.42, 0.42, 2, 0.05), new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.8 }));
      caisse.position.set(-0.4 + i * 0.4, 0.58, -0.45 + (i % 2) * 0.3); caisse.castShadow = true; g.add(caisse);
    }
    const e = etiquette(s.texte, { code: s.role === "entree", fond: s.role === "entree" ? "#2e1a6e" : "#3a3d48", encre: "#ffffff" });
    e.position.set(0, 1.35, 0); g.add(e);
    groupe.add(g);
  }

  function fente(f) {
    const g = new THREE.Group(); g.position.set(f.x, 0.16, f.z);
    const disque = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 24), new THREE.MeshStandardMaterial({ color: ACCENT, emissive: ACCENT, emissiveIntensity: 0.35, roughness: 0.4 }));
    g.add(disque);
    const plus = etiquette("+", { code: false, fond: "#ffc857", encre: "#1c1e23", echelle: 0.0085 });
    plus.position.y = 0.45; plus.userData.pixels.facteur = 0.9; g.add(plus);
    disque.userData = { fente: f };
    g.userData.disque = disque;
    cliquables.push(disque);
    fentes.push(g);
    groupe.add(g);
  }

  function zone(z) {
    const couleur = z.type === "si" ? 0xc9a3f5 : 0x5ad1e0;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(z.x2 - z.x1, z.z2 - z.z1), new THREE.MeshStandardMaterial({ color: couleur, transparent: true, opacity: 0.1 + 0.04 * z.profondeur, roughness: 1, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set((z.x1 + z.x2) / 2, 0.004 + 0.002 * z.profondeur, (z.z1 + z.z2) / 2);
    groupe.add(m);
    const bord = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(z.x2 - z.x1, z.z2 - z.z1)), new THREE.LineBasicMaterial({ color: couleur, transparent: true, opacity: 0.55 }));
    bord.rotation.x = -Math.PI / 2; bord.position.copy(m.position); groupe.add(bord);
  }

  function voie(v) {
    const fonds = { vrai: "#23ab67", sinon: "#7a5cc4", directe: "#4a4f5c", boucle: "#2a9aab" };
    const e = etiquette(v.libelle.length > 30 ? v.libelle.slice(0, 29) + "…" : v.libelle, { code: false, fond: fonds[v.couleur] || "#4a4f5c", encre: "#ffffff", echelle: 0.008 });
    e.position.set(v.x + 0.2 + e.scale.x / 2, 0.5, v.z + 0.75); groupe.add(e);
  }

  // Redessine toute l'usine. Les machines nouvelles (inconnues au dessin précédent) apparaissent avec un rebond.
  function construire(d, { cadrer: recadrer = false } = {}) {
    scene.remove(groupe); groupe.traverse((o) => { if (o.geometry && o.geometry !== geoMachine && o.geometry !== geoFut) o.geometry.dispose(); });
    groupe = new THREE.Group(); scene.add(groupe);
    cliquables = []; machines = new Map(); fentes = []; survol = null;
    const anciennes = cles; cles = new Set();
    d.zones.forEach(zone);
    d.tapis.forEach(chemin);
    d.stations.forEach(station);
    let nouvelles = 0;
    d.machines.forEach((m) => {
      const cle = `${m.type}|${m.texte}|${m.role}`; cles.add(cle);
      const neuve = anciennes.size > 0 && !anciennes.has(cle);
      if (neuve) nouvelles++;
      machine(m, neuve);
    });
    d.fentes.forEach(fente);
    d.voies.forEach(voie);
    majFentes();
    if (recadrer) cadrer(d.etendue);
    return nouvelles;
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
    for (const [x, z] of [[e.x1, e.z1], [e.x2, e.z1], [e.x1, e.z2], [e.x2, e.z2]]) for (const y of [0, 2.6]) {
      const v = new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse);
      x1 = Math.min(x1, v.x); x2 = Math.max(x2, v.x); y1 = Math.min(y1, v.y); y2 = Math.max(y2, v.y);
    }
    const zoom = 0.94 * Math.min((camera.right - camera.left) / (x2 - x1), (camera.top - camera.bottom) / (y2 - y1));
    camera.zoom = Math.min(3, Math.max(0.3, zoom));
    camera.updateProjectionMatrix(); controles.update();
  }
  function tourner(sens) { azimutVise += sens * Math.PI / 2; }

  function redimensionner() {
    const w = conteneur.clientWidth, h = conteneur.clientHeight;
    if (!w || !h) return;
    rendu.setSize(w, h, false);
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
    const touche = rayon.intersectObjects(cliquables, false)[0];
    return touche ? touche.object : null;
  }
  rendu.domElement.addEventListener("pointerdown", (ev) => { appui = { x: ev.clientX, y: ev.clientY }; });
  rendu.domElement.addEventListener("pointermove", (ev) => {
    const o = viser(ev);
    if (o !== survol) {
      if (survol && survol.userData.fente) survol.parent.scale.setScalar(1);
      if (survol && survol.userData.machine) survol.material.emissive?.setHex(0x000000);
      survol = o;
      if (o && o.userData.fente) o.parent.scale.setScalar(1.35);
      if (o && o.userData.machine) { o.material.emissive?.setHex(0x333333); surSurvol(o.userData.machine); }
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
  function choisirOutil(oui) { outil = oui; majFentes(); }

  // Position à l'écran d'un point du sol, pour poser un champ HTML au-dessus d'une machine.
  function projeter(x, z, y = 1.6) {
    const v = new THREE.Vector3(x, y, z).project(camera), r = rendu.domElement.getBoundingClientRect();
    return { left: (v.x + 1) / 2 * r.width, top: (1 - v.y) / 2 * r.height };
  }

  // ---- rejeu ----
  function allumer(id, couleur = 0xffc857) {
    const g = machines.get(id); if (!g) return;
    const c = g.userData.corps; if (!c.material.emissive) return;
    c.material.emissive.setHex(couleur);
    anime(650, (t) => { c.material.emissiveIntensity = 1 - lisse(t); }, () => { c.material.emissive.setHex(0x000000); c.material.emissiveIntensity = 1; });
    anime(260, (t) => { g.scale.setScalar(1 + 0.12 * Math.sin(Math.PI * t)); });
  }
  function montrerBulle(id, texte, erreur = false) {
    if (bulle) { groupe.remove(bulle); bulle = null; }
    const g = machines.get(id); if (!g || !texte) return;
    bulle = etiquette(texte.length > 46 ? texte.slice(0, 45) + "…" : texte, { fond: erreur ? "#ee434b" : "#ffc857", encre: "#1c1e23", echelle: 0.012 });
    bulle.position.set(g.position.x, 2.35, g.position.z); groupe.add(bulle);
  }
  function cacherBulle() { if (bulle) { groupe.remove(bulle); bulle = null; } }
  // Le fût roule jusqu'à la machine, par un chemin en équerre (le long des tapis).
  async function amenerFut(id, duree = 420) {
    const g = machines.get(id); if (!g) return;
    const de = fut.visible ? fut.position.clone() : new THREE.Vector3(g.position.x - 2, 0.37, g.position.z);
    const a = new THREE.Vector3(g.position.x, 0.37, g.position.z);
    fut.visible = true;
    const coude = new THREE.Vector3(Math.abs(a.z - de.z) > 0.1 ? de.x : a.x, 0.37, de.z);
    const l1 = de.distanceTo(coude), l2 = coude.distanceTo(a), l = l1 + l2 || 1;
    await anime(duree, (t) => {
      const s = lisse(t) * l;
      if (s <= l1) fut.position.lerpVectors(de, coude, l1 ? s / l1 : 1); else fut.position.lerpVectors(coude, a, l2 ? (s - l1) / l2 : 1);
      fut.position.y = 0.37 + Math.abs(Math.sin(t * Math.PI)) * 0.25;
      fut.rotation.z = -s * 1.4;
    });
  }
  function cacherFut() { fut.visible = false; }

  // Les étiquettes gardent la même taille à l'écran, quel que soit le zoom : lisibles de loin comme de près.
  const PIXELS_ECRAN = 0.48;          // une étiquette de 52 px de haut sur la toile en fait environ 29 à l'écran
  function tailleEtiquettes() {
    const h = rendu.domElement.clientHeight || 600;
    const unite = (camera.top - camera.bottom) / camera.zoom / h;
    scene.traverse((o) => {
      const p = o.isSprite && o.userData.pixels; if (!p) return;
      const k = unite * PIXELS_ECRAN * p.facteur;
      o.scale.set(p.w * k, p.h * k, 1);
    });
  }

  // ---- boucle de rendu ----
  let avant = performance.now();
  function boucle(maintenant) {
    const dt = Math.min(64, maintenant - avant); avant = maintenant;
    texTapis.offset.x -= dt * 0.0009;
    if (Math.abs(azimutVise - azimut) > 0.001) { azimut += (azimutVise - azimut) * Math.min(1, dt * 0.012); cible.copy(controles.target); placerCamera(); }
    for (let i = animations.length - 1; i >= 0; i--) {
      const a = animations[i]; a.t += dt; const t = Math.min(1, a.t / a.duree); a.pas(t);
      if (t >= 1) { animations.splice(i, 1); a.fin(); }
    }
    machines.forEach((g) => { if (g.userData.tourne) g.userData.tourne.rotation.y += dt * 0.0012; });
    tailleEtiquettes();
    soleil.position.set(controles.target.x - 12, 24, controles.target.z + 10); soleil.target.position.copy(controles.target);
    controles.update();
    rendu.render(scene, camera);
    requestAnimationFrame(boucle);
  }
  redimensionner(); placerCamera(); requestAnimationFrame(boucle);

  return { construire, cadrer, tourner, choisirOutil, projeter, allumer, montrerBulle, cacherBulle, amenerFut, cacherFut,
    positionMachine: (id) => { const g = machines.get(id); return g ? { x: g.position.x, z: g.position.z } : null; } };
}
