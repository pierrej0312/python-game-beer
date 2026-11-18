// Atelier de construction : le hall en vue isométrique.
// Contre le mur du fond, les données (rayonnages = listes, caisses plombées = tuples, bacs = variables) ;
// devant, les postes du programme reliés par des tapis, et le chariot de l'exécution qui va de poste en poste.
// Three.js r187 : OrthographicCamera(left, right, top, bottom, near, far) + updateProjectionMatrix() ; Raycaster.setFromCamera (source 86).
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { creerMatieres, PAL } from "../commun/materiaux.js";
import { creerEffets, CALME } from "../commun/effets.js";
import { POLICE } from "../commun/textures.js";
import * as sons from "../commun/sons.js";
import { GRILLE, DEPART, FIN, PIECES, CATEGORIES, ICONES, ligneDe, donneeDe } from "./catalogue.js";

// ----- Réglages -----
const VUE = { direction: [1, 1.05, 1], marge: 0.02 };
const EXPOSITION = 1.2;
const TAPIS = { hauteur: 0.3, largeur: 0.42, vitesse: 0.9 };
const ETIQUETTE = { hauteur: 0.36, y: 1.25 };
const DUREE_PAS = 0.7;                       // secondes par étape du rejeu, vitesse 1
const CAISSE = 0.6;                          // côté d'un carton sur le rayonnage
const TEXTE_MAX = 13;                        // caractères affichés sur un carton
const MUR_H = 2.4;

const douceur = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
const COLLECTIONS = new Set(["list", "tuple", "dict", "set"]);
export const versMonde = (x, z) => new THREE.Vector3(x - (GRILLE.colonnes - 1) / 2, 0, z - (GRILLE.rangees - 1) / 2);

// Texte d'une valeur encodée par atelier.py ({t, v}) : comme Python l'écrit.
export function texteValeur(e, court = false) {
  if (!e) return "?";
  let t;
  switch (e.t) {
    case "str": t = `"${e.v}"`; break;
    case "int": case "float": t = String(e.v); break;
    case "bool": t = e.v ? "True" : "False"; break;
    case "None": t = "None"; break;
    case "list": t = `[${e.v.map((x) => texteValeur(x)).join(", ")}${e.n > e.v.length ? ", …" : ""}]`; break;
    case "tuple": t = `(${e.v.map((x) => texteValeur(x)).join(", ")}${e.v.length === 1 ? "," : ""})`; break;
    case "dict": t = `{${e.v.map(([k, v]) => `${texteValeur(k)}: ${texteValeur(v)}`).join(", ")}${e.n > e.v.length ? ", …" : ""}}`; break;
    case "set": t = e.v.length ? `{${e.v.map((x) => texteValeur(x)).join(", ")}}` : "set()"; break;
    default: t = e.r || e.t;
  }
  return court && t.length > TEXTE_MAX ? t.slice(0, TEXTE_MAX - 1) + "…" : t;
}

export function creerSceneAtelier(conteneur, { qualite = "haute", surCase = () => {} } = {}) {
  const haute = qualite === "haute";
  const rendu = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  rendu.setPixelRatio(Math.min(window.devicePixelRatio || 1, haute ? 2 : 1));
  rendu.outputColorSpace = THREE.SRGBColorSpace;
  rendu.toneMapping = THREE.ACESFilmicToneMapping;
  rendu.toneMappingExposure = EXPOSITION;
  rendu.shadowMap.enabled = haute;
  conteneur.appendChild(rendu.domElement);
  rendu.domElement.setAttribute("aria-label", "Vue 3D de l'atelier : les données contre le mur, les postes du programme devant");
  rendu.domElement.style.touchAction = "none";

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PAL.fond);
  const environnement = new THREE.PMREMGenerator(rendu);
  scene.environment = environnement.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = haute ? 0.55 : 0.4;
  const camera = new THREE.OrthographicCamera(-10, 10, 6, -6, 0.1, 200);
  camera.position.copy(new THREE.Vector3(...VUE.direction).normalize().multiplyScalar(60));
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x40301f, 1.25));
  const soleil = new THREE.DirectionalLight(0xfff0dc, 2.4);
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

  // --- le hall ---
  const hall = new THREE.Group(); scene.add(hall);
  boite(L + 0.8, 0.6, P + 0.8, M.socle, 0, -0.31, 0, hall);
  const sol = new THREE.Mesh(new THREE.PlaneGeometry(L, P), M.image(texSol(L, P), 0.85));
  sol.rotation.x = -Math.PI / 2; sol.position.y = 0.002; sol.receiveShadow = haute; hall.add(sol);
  boite(L + 0.8, MUR_H, 0.3, M.peinture_metal, 0, MUR_H / 2, -P / 2 - 0.25, hall);
  boite(0.3, MUR_H, P + 0.5, M.peinture_metal, -L / 2 - 0.25, MUR_H / 2, -0.15, hall);
  boite(L, 0.06, 0.06, M.bandeau_orange, 0, 2.0, -P / 2 - 0.08, hall);
  boite(0.06, 0.06, P, M.bandeau_orange, -L / 2 - 0.08, 2.0, 0, hall);
  // limite de la zone des données : une ligne jaune au sol
  const limite = versMonde(0, GRILLE.stockage - 0.5);
  boite(L, 0.01, 0.05, M.peinture_jaune, 0, 0.006, limite.z, hall);

  const survol = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.94), new THREE.MeshBasicMaterial({ color: PAL.accent, transparent: true, opacity: 0.35, depthWrite: false }));
  survol.rotation.x = -Math.PI / 2; survol.position.y = 0.01; survol.visible = false; scene.add(survol);

  const plateauGroupe = new THREE.Group(); scene.add(plateauGroupe);
  const donneesGroupe = new THREE.Group(); scene.add(donneesGroupe);
  const rejeuGroupe = new THREE.Group(); scene.add(rejeuGroupe);
  const texTapis = texChevrons();

  // --- souris ramenée sur une case du sol ---
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
    const c = caseSous(e); survol.visible = Boolean(c);
    if (c) { survol.position.copy(versMonde(c[0], c[1])).setY(0.012); surCase(appuye ? "glisse" : "survol", c[0], c[1], e); }
  });
  rendu.domElement.addEventListener("pointerup", (e) => { const c = caseSous(e); appuye = false; surCase("relache", c ? c[0] : null, c ? c[1] : null, e); });
  rendu.domElement.addEventListener("dblclick", (e) => { const c = caseSous(e); if (c) surCase("double", c[0], c[1], e); });
  rendu.domElement.addEventListener("pointerleave", () => { survol.visible = false; });

  // --- boucle de rendu ---
  const S = { vitesse: 1, enPause: false, sauter: false, vivant: true, images: 0, lent: 0, surLenteur: null, calme: CALME };
  let animations = [], dernier = performance.now(), cumul = 0, compte = 0;
  const lueurs = [];
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
    if (!CALME && !S.enPause) texTapis.offset.x -= reel * TAPIS.vitesse * (S.enLigne ? 1 : 0.3);
    for (let i = lueurs.length - 1; i >= 0; i--) { const l = lueurs[i]; l.t += reel; const k = Math.min(1, l.t / l.duree); l.matiere.emissiveIntensity = l.base + (1 - k) * l.force; if (k >= 1) { l.matiere.emissiveIntensity = l.base; lueurs.splice(i, 1); } }
    effets.maj(reel);
    rendu.render(scene, camera);
  }
  function ajuster() {
    const l = conteneur.clientWidth || 800, h = conteneur.clientHeight || 600;
    rendu.setSize(l, h, false);
    rendu.domElement.style.width = "100%"; rendu.domElement.style.height = "100%";
    camera.updateMatrixWorld();
    const inv = camera.matrixWorldInverse, b = new THREE.Box3();
    for (const x of [-L / 2 - 0.5, L / 2 + 0.5]) for (const y of [-0.6, MUR_H * 0.8]) for (const z of [-P / 2 - 0.5, P / 2 + 0.5]) b.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(inv));
    let largeur = (b.max.x - b.min.x) * (1 + VUE.marge), hauteur = (b.max.y - b.min.y) * (1 + VUE.marge);
    if (largeur / hauteur < l / h) largeur = hauteur * (l / h); else hauteur = largeur / (l / h);
    const cx = (b.max.x + b.min.x) / 2, cy = (b.max.y + b.min.y) / 2;
    Object.assign(camera, { left: cx - largeur / 2, right: cx + largeur / 2, top: cy + hauteur / 2, bottom: cy - hauteur / 2 });
    camera.updateProjectionMatrix();
  }
  const observateur = new ResizeObserver(ajuster); observateur.observe(conteneur); ajuster();
  requestAnimationFrame(image);

  // Position à l'écran (pixels dans le conteneur) d'une case : la bulle de saisie s'y accroche.
  function projeter(x, z, y = 0.9) {
    const v = versMonde(x, z).setY(y).project(camera), r = rendu.domElement.getBoundingClientRect();
    return { x: (v.x + 1) / 2 * r.width, y: (1 - v.y) / 2 * r.height };
  }

  function vider(groupe) {
    for (const enfant of [...groupe.children]) {
      groupe.remove(enfant);
      enfant.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.userData.propre) { if (o.material.map && o.material.map !== texTapis) o.material.map.dispose(); o.material.dispose(); } });
    }
  }

  // ---------- les postes ----------
  let objets = new Map(), plateauCourant = null;
  const texIcones = new Map();
  function texIcone(nom, couleur) {
    const cle = nom + couleur;
    if (!texIcones.has(cle)) {
      const c = document.createElement("canvas"); c.width = c.height = 128;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#14171d"; arrondi(ctx, 4, 4, 120, 120, 22); ctx.fill();
      ctx.lineWidth = 6; ctx.strokeStyle = couleur; arrondi(ctx, 4, 4, 120, 120, 22); ctx.stroke();
      ctx.save(); ctx.translate(16, 16); ctx.scale(4, 4); ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#f4f6fb";
      ctx.stroke(new Path2D(ICONES[nom])); ctx.restore();
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      texIcones.set(cle, t);
    }
    return texIcones.get(cle);
  }

  function dessiner(plateau, { selection = null, problemes = [], fantome = null, trace = null, emplacements = [] } = {}) {
    plateauCourant = plateau;
    vider(plateauGroupe); objets = new Map();
    const erreurs = new Set(problemes), f = plateau.fonction;
    // le début : un pupitre (programme) ou un quai de réception où le camion livre les paramètres (fonction)
    objets.set("depart", quai(DEPART, f ? "reception" : "depart", "#4fc4a0", f ? `Réception · ${f.nom}(${f.parametres.join(", ")})` : "Début du programme"));
    objets.set("fin", quai(FIN, f ? "renvoyer" : "fin", "#8fb3ff", f ? "Expédition · return" : "Fin du programme"));

    plateau.postes.forEach((p, i) => {
      const o = modelePoste(p, i);
      o.groupe.position.copy(versMonde(p.x, p.z)); plateauGroupe.add(o.groupe); objets.set(p.id, o);
      if (p.id === selection) anneau(o.groupe, PAL.accent);
      if (erreurs.has(p.id)) anneau(o.groupe, PAL.erreur);
    });
    for (const t of plateau.tapis()) {
      const de = plateau.position(t.de), vers = plateau.position(t.vers);
      if (!t.cases || !de || !vers) continue;
      dessinerTapis([versMonde(...de), ...t.cases.map(([x, z]) => versMonde(x, z)), versMonde(...vers)], { manuel: t.manuel, libelle: t.libelle });
    }
    if (trace) {
      const o = plateau.position(trace.de);
      if (trace.cases.length && o) dessinerTapis([versMonde(...o), ...trace.cases.map(([x, z]) => versMonde(x, z))], { apercu: true });
    }
    // emplacements : où poser dans un bloc (pièce en main)
    for (const e of emplacements) {
      const g = new THREE.Group(); g.position.copy(versMonde(e.x, e.z)); plateauGroupe.add(g);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.86), new THREE.MeshBasicMaterial({ color: 0x8fb3ff, transparent: true, opacity: 0.28, depthWrite: false }));
      m.userData.propre = true; m.rotation.x = -Math.PI / 2; m.position.y = 0.012; g.add(m);
      anneau(g, 0x8fb3ff);
      const t = creerEtiquette(`+ ${e.libelle}`, { petite: true, couleur: "#8fb3ff" }); t.sprite.position.y = 0.55; g.add(t.sprite);
    }
    if (fantome) {
      const g = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.8), new THREE.MeshBasicMaterial({ color: fantome.libre ? PAL.accent : PAL.erreur, transparent: true, opacity: 0.35, depthWrite: false }));
      g.userData.propre = true; g.position.copy(versMonde(fantome.x, fantome.z)).setY(0.25); plateauGroupe.add(g);
    }
  }

  // Un quai (début, réception, fin, expédition) : un pupitre avec son icône.
  function quai(place, icone, couleur, texte) {
    const d = new THREE.Group(); d.position.copy(versMonde(place.x, place.z)); plateauGroupe.add(d);
    boite(0.86, 0.12, 0.86, M.danger || M.peinture_sombre, 0, 0.06, 0, d);
    const pupitre = boite(0.5, 0.7, 0.4, M.peinture_metal, 0, 0.47, 0, d); pupitre.rotation.y = Math.PI / 4;
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ map: texIcone(icone, couleur), toneMapped: false }));
    plaque.rotation.x = -Math.PI / 2; plaque.position.y = 0.83; d.add(plaque);
    const e = creerEtiquette(texte, { couleur, petite: true }); e.sprite.position.y = ETIQUETTE.y; d.add(e.sprite);
    const lueur = M.led(new THREE.Color(couleur).getHex(), 0.4); lueur.userData = {};
    boite(0.3, 0.07, 0.02, lueur, 0, 0.3, 0.22, d);
    return { groupe: d, lueur, etiquette: e, texte };
  }

  function anneau(parent, couleur) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.44, 0.5, 32), new THREE.MeshBasicMaterial({ color: couleur, transparent: true, opacity: 0.95, depthWrite: false }));
    m.userData.propre = true; m.rotation.x = -Math.PI / 2; m.position.y = 0.015; parent.add(m); return m;
  }

  function modelePoste(p, i) {
    const c = PIECES[p.type], couleur = CATEGORIES[c.categorie].couleur;
    const g = new THREE.Group(); g.userData.poste = p.id;
    const lueur = M.led(new THREE.Color(couleur).getHex(), 0.35); lueur.userData = {};
    boite(0.82, 0.12, 0.82, M.peinture_sombre, 0, 0.06, 0, g);
    boite(0.7, 0.42, 0.7, M.peinture_metal, 0, 0.33, 0, g);
    boite(0.72, 0.05, 0.72, M.couleur(new THREE.Color(couleur).getHex(), 0.5), 0, 0.565, 0, g).userData.propre = true;
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.56), new THREE.MeshBasicMaterial({ map: texIcone(c.icone, couleur), toneMapped: false }));
    plaque.rotation.x = -Math.PI / 2; plaque.position.y = 0.595; g.add(plaque);
    boite(0.3, 0.07, 0.02, lueur, 0, 0.3, 0.36, g);
    if (p.branches) {
      // un bloc : un portique au-dessus du poste ; une boucle porte un anneau
      const metal = M.couleur(new THREE.Color(couleur).getHex(), 0.45);
      for (const x of [-0.38, 0.38]) boite(0.07, 0.95, 0.07, metal, x, 0.6, -0.3, g).userData.propre = true;
      boite(0.83, 0.1, 0.1, metal, 0, 1.08, -0.3, g).userData.propre = true;
      if (p.type !== "si") {
        const tore = ombre(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 8, 28), metal)); tore.position.set(0, 1.3, -0.3); tore.rotation.y = Math.PI / 4; g.add(tore);
      }
    }
    // numéro d'ordre (ordre d'exécution) et forme courte de la ligne ; la ligne entière est dans l'éditeur et dans la légende
    const e = creerEtiquette(`${i + 1}. ${court(p)}`, { couleur, code: true, petite: true });
    e.sprite.position.y = ETIQUETTE.y; g.add(e.sprite);
    return { groupe: g, lueur, etiquette: e };
  }

  function court(p) {
    const q = p.params, coupe = (t, n = 16) => (t.length > n ? t.slice(0, n - 1) + "…" : t);
    switch (p.type) {
      case "creer_liste": return `${q.nom || "?"} = [ ]`;
      case "creer_tuple": return `${q.nom || "?"} = ( )`;
      case "variable": return `${q.nom || "?"} = …`;
      case "lire_case": return `${q.dest || "?"} = ${q.source || "?"}[${q.indice}]`;
      case "tranche": return `${q.dest || "?"} = [${q.debut ?? ""}:${q.fin ?? ""}]`;
      case "longueur": return `${q.dest || "?"} = len()`;
      case "contient": return `${q.dest || "?"} = … in`;
      case "trier_copie": return `${q.dest || "?"} = sorted()`;
      case "ajouter": return `${q.cible || "?"}.append`;
      case "retirer": return `${q.cible || "?"}.remove`;
      case "remplacer_case": return `${q.cible || "?"}[${q.indice}] =`;
      case "trier_sur_place": return `${q.cible || "?"}.sort()`;
      case "decomposer": return coupe(`${(q.noms || []).join(", ")} =`);
      case "afficher": return coupe(`print(${q.expression || ""})`, 18);
      case "calcul": return coupe(`${q.nom || "?"} ${q.op || "="} ${q.expression || "…"}`, 18);
      case "renvoyer": return coupe(`return ${q.expression || ""}`, 18);
      case "si": return coupe(`if ${q.conditions[0] || "…"}`, 18) + (q.conditions.length > 1 ? ` +${q.conditions.length - 1}` : "");
      case "pour": return coupe(`for ${q.variable || "?"} in ${q.source || "…"}`, 20);
      case "tantque": return coupe(`while ${q.condition || "…"}`, 20);
      default: return coupe(ligneDe(p).split("\n")[0]);
    }
  }

  function dessinerTapis(pts, { manuel = false, apercu = false, libelle = "" } = {}) {
    const groupe = new THREE.Group(); plateauGroupe.add(groupe);
    const bande = apercu ? new THREE.MeshStandardMaterial({ color: PAL.accent, emissive: PAL.accent, emissiveIntensity: 0.5, transparent: true, opacity: 0.75 })
      : new THREE.MeshStandardMaterial({ color: 0xffffff, map: texTapis, roughness: 0.9 });
    const bordure = manuel ? M.peinture_orange : M.acier_brosse;      // un tapis tracé à la main a des bords orange
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], longueur = a.distanceTo(b);
      const debut = i === 0 ? 0.42 : 0, fin = i === pts.length - 2 && !apercu ? 0.42 : 0;
      const l = longueur - debut - fin; if (l <= 0.02) continue;
      const d = b.clone().sub(a).normalize(), milieu = a.clone().addScaledVector(d, debut + l / 2);
      const segment = ombre(new THREE.Mesh(new THREE.BoxGeometry(l + 0.02, 0.06, TAPIS.largeur), bande));
      segment.position.set(milieu.x, TAPIS.hauteur, milieu.z); segment.rotation.y = -Math.atan2(d.z, d.x); groupe.add(segment);
      for (const s of [-1, 1]) { const bord = new THREE.Mesh(new THREE.BoxGeometry(l + 0.02, 0.09, 0.04), bordure); bord.position.set(0, 0.035, s * (TAPIS.largeur / 2 + 0.02)); segment.add(bord); }
    }
    // la voie d'un bloc (vrai, elif, sinon, un tour, fini) : une étiquette au départ du tapis
    if (libelle && pts.length >= 2) {
      const d = pts[1].clone().sub(pts[0]).normalize();
      const e = creerEtiquette(libelle, { petite: true, couleur: libelle === "sinon" || libelle === "faux" || libelle === "fini" ? "#f2a65a" : "#4fc4a0" });
      e.sprite.position.set(pts[0].x + d.x * 0.62, 0.62, pts[0].z + d.z * 0.62); e.sprite.scale.multiplyScalar(0.8); groupe.add(e.sprite);
    }
    for (const c of pts.slice(1, -1)) for (const s of [-1, 1]) { const pied = cylindre(0.025, 0.025, TAPIS.hauteur, M.peinture_sombre, c.x + s * 0.16, TAPIS.hauteur / 2, c.z + s * 0.16, groupe, 6); pied.castShadow = false; }
  }

  // ---------- les données, contre le mur ----------
  let meubles = new Map();       // nom -> { type, cases: [{ objet, valeur (texte) }], plaque, x0, z }
  let etatAffiche = {};

  // Place de chaque donnée : une rangée par liste ou tuple (si elle tient), les valeurs simples se serrent à droite.
  function disposer(etat) {
    // dans l'ordre de création, de gauche à droite contre le mur (rangée 0) ; quand elle est pleine, rangée 2, puis 1.
    // En vue isométrique, deux rangées voisines se recouvrent à l'écran : on remplit d'abord le mur.
    const libres = Array.from({ length: GRILLE.stockage }, () => 0), places = new Map();
    for (const [nom, e] of Object.entries(etat)) {
      const sequence = COLLECTIONS.has(e.t);
      const largeur = sequence ? Math.min(L, Math.max(2, Math.min(e.v.length, L - 1) + 1)) : 2;
      let r = [0, 2, 1].find((k) => libres[k] + largeur <= L);
      if (r === undefined) r = libres.indexOf(Math.min(...libres));
      places.set(nom, { x0: libres[r], z: r, largeur });
      libres[r] += largeur;
    }
    return places;
  }

  let placesDonnees = new Map();
  // La donnée posée contre le mur à cette case (nom de variable), ou null.
  function donneeEn(x, z) {
    for (const [nom, pl] of placesDonnees) if (z === pl.z && x >= pl.x0 && x < pl.x0 + pl.largeur) return nom;
    return null;
  }

  function construireDonnees(etat) {
    vider(donneesGroupe); meubles = new Map();
    const places = disposer(etat); placesDonnees = places;
    for (const [nom, e] of Object.entries(etat)) meubles.set(nom, construireMeuble(nom, e, places.get(nom)));
    etatAffiche = etat;
  }

  function construireMeuble(nom, e, place) {
    const g = new THREE.Group(); donneesGroupe.add(g);
    const base = versMonde(place.x0, place.z);
    const sequence = COLLECTIONS.has(e.t);
    const n = sequence ? Math.min(e.v.length, place.largeur - 1) : 0;
    // un dictionnaire : chaque case est un tiroir [clé, valeur] ; on montre la valeur, la clé sert d'étiquette
    const valeurDe = (i) => (e.t === "dict" ? e.v[i][1] : e.v[i]);
    const texteDe = (i) => (e.t === "dict" ? `${texteValeur(e.v[i][0])}: ${texteValeur(e.v[i][1])}` : texteValeur(e.v[i]));
    const meuble = { type: e.t, cases: [], x0: place.x0, z: place.z, n, groupe: g };
    // plaque du nom : un panneau sur pied
    const unite = e.t === "dict" ? ["tiroir", "tiroirs"] : e.t === "set" ? ["valeur", "valeurs"] : ["case", "cases"];
    const titre = sequence ? `${nom} · ${e.t} · ${e.n} ${e.n > 1 ? unite[1] : unite[0]}` : `${nom} · ${e.t === "str" ? "str" : e.t}`;
    const couleurs = { tuple: CATEGORIES.tuple.couleur, list: CATEGORIES.liste.couleur, dict: CATEGORIES.dict.couleur, set: CATEGORIES.set.couleur };
    const plaque = creerEtiquette(titre, { couleur: couleurs[e.t] || CATEGORIES.variable.couleur, code: true });
    plaque.sprite.position.set(base.x, sequence ? 1.55 : 1.35, base.z); g.add(plaque.sprite);
    meuble.plaque = plaque;
    if (!sequence) {
      // une valeur simple : un bac étiqueté, la valeur au-dessus
      const bac = new THREE.Group(); bac.position.copy(base); g.add(bac);
      boite(0.62, 0.06, 0.5, M.peinture_jaune, 0, 0.32, 0, bac);
      for (const [l, p2, x, z] of [[0.62, 0.04, 0, 0.23], [0.62, 0.04, 0, -0.23], [0.04, 0.5, 0.29, 0], [0.04, 0.5, -0.29, 0]]) boite(l, 0.16, p2, M.peinture_jaune, x, 0.42, z, bac);
      for (const [x, z] of [[0.26, 0.2], [-0.26, 0.2], [0.26, -0.2], [-0.26, -0.2]]) cylindre(0.025, 0.025, 0.3, M.peinture_sombre, x, 0.15, z, bac, 6);
      const v = creerEtiquette(texteValeur(e, true), { couleur: e.t === "None" ? "#9aa0ad" : "#eaf2ff", valeur: true });
      v.sprite.position.set(base.x, 0.85, base.z); g.add(v.sprite);
      meuble.cases.push({ objet: bac, texte: texteValeur(e), etiquette: v });
      return meuble;
    }
    // rayonnage ou caisse plombée : montants, planches, puis un carton par case
    const debut = versMonde(place.x0 + 1, place.z), fin = versMonde(place.x0 + Math.max(1, n), place.z);
    const longueur = Math.max(1, n) - 0.08, milieuX = (debut.x + fin.x) / 2;
    if (e.t === "list") {
      for (const y of [0.18, 0.95]) boite(longueur + 0.9, 0.05, 0.62, M.bois_palette, milieuX, y, base.z, g);
      for (const x of [debut.x - 0.47, fin.x + 0.47]) for (const dz of [-0.28, 0.28]) boite(0.05, 1.0, 0.05, M.peinture_orange, x, 0.5, base.z + dz, g);
    } else if (e.t === "dict") {
      // l'armoire : un caisson contre le mur, un tiroir par clé
      const bois = M.couleur(0x7a5a8c, 0.6);
      boite(longueur + 0.9, 1.0, 0.18, bois, milieuX, 0.5, base.z - 0.38, g).userData.propre = true;
      boite(longueur + 0.9, 0.06, 0.8, bois, milieuX, 0.06, base.z, g);
    } else if (e.t === "set") {
      // le bac de tri : un grand bac ouvert, sans numéros de place
      const vert = M.couleur(0x3f8a4a, 0.6);
      boite(longueur + 0.9, 0.06, 0.8, vert, milieuX, 0.06, base.z, g).userData.propre = true;
      for (const dz of [-0.4, 0.4]) boite(longueur + 0.9, 0.36, 0.04, vert, milieuX, 0.2, base.z + dz, g);
      for (const x of [debut.x - 0.47, fin.x + 0.47]) boite(0.04, 0.36, 0.8, vert, x, 0.2, base.z, g);
    } else {
      boite(longueur + 0.9, 0.08, 0.7, M.bois_palette, milieuX, 0.12, base.z, g);
      for (const dz of [-0.33, 0.33]) boite(longueur + 0.9, 0.5, 0.04, M.couleur(0x8a4b2c, 0.6), milieuX, 0.4, base.z + dz, g);
      for (let i = 0; i <= n; i++) boite(0.04, 0.5, 0.7, M.couleur(0x8a4b2c, 0.6), debut.x - 0.47 + i, 0.4, base.z, g);
      const fil = cylindre(0.012, 0.012, 0.5, M.acier_brosse, debut.x - 0.47, 0.75, base.z + 0.37, g, 6); fil.rotation.x = Math.PI / 2;
      meuble.plomb = cylindre(0.09, 0.09, 0.04, M.couleur(0xc0392b, 0.4, 0.3), debut.x - 0.47, 0.6, base.z + 0.4, g, 18);
      meuble.plomb.rotation.x = Math.PI / 2; meuble.plomb.material = M.led(0xc0392b, 0.6); meuble.plomb.material.userData = {};
    }
    for (let i = 0; i < n; i++) {
      const c = versMonde(place.x0 + 1 + i, place.z);
      const carton = cartonModele(valeurDe(i), e.t === "tuple");
      // le bac de tri : les valeurs posées en vrac (pas de numéro de place)
      const vrac = e.t === "set" ? ((i * 37) % 7 - 3) * 0.04 : 0;
      carton.position.set(c.x + vrac, e.t === "list" ? 0.2 + CAISSE / 2 : e.t === "dict" ? 0.09 + CAISSE / 2 : e.t === "set" ? 0.09 + CAISSE * 0.4 : 0.16 + CAISSE / 2 - 0.05, c.z - vrac);
      if (e.t === "set") { carton.scale.setScalar(0.8); carton.rotation.y = vrac * 4; }
      g.add(carton);
      // étiquettes en quinconce : une case sur deux plus haut, pour que deux valeurs voisines ne se chevauchent pas
      const v = creerEtiquette(texteValeur(valeurDe(i), true), { valeur: true, petite: true });
      v.sprite.position.set(c.x, (e.t === "list" ? 1.2 : 0.95) + (i % 2) * 0.32, c.z); g.add(v.sprite);
      // sous chaque case : son numéro (liste, tuple) ou sa clé (dictionnaire) ; rien pour un set
      if (e.t !== "set") {
        const ind = creerEtiquette(e.t === "dict" ? texteValeur(e.v[i][0], true) : `${i} | ${i - e.n}`, { petite: true, index: true });
        ind.sprite.position.set(c.x, 0.06, c.z + 0.55); g.add(ind.sprite);
      }
      meuble.cases.push({ objet: carton, texte: texteDe(i), etiquette: v, position: carton.position.clone(), cle: e.t === "dict" ? texteValeur(e.v[i][0]) : null });
    }
    return meuble;
  }

  function cartonModele(valeur, scelle) {
    const g = new THREE.Group();
    const couleur = valeur && valeur.t === "str" ? 0xc89a63 : valeur && (valeur.t === "int" || valeur.t === "float") ? 0x6f9bd1 : 0x9aa0ad;
    const m = new THREE.MeshStandardMaterial({ color: couleur, roughness: 0.85, emissive: 0x000000, emissiveIntensity: 0 });
    const corps = ombre(new THREE.Mesh(new THREE.BoxGeometry(CAISSE, CAISSE * (scelle ? 0.7 : 1), CAISSE), m)); corps.userData.propre = true; g.add(corps);
    const bande = new THREE.Mesh(new THREE.BoxGeometry(CAISSE + 0.01, 0.06, 0.12), M.couleur(0xe8d5a8, 0.7)); g.add(bande);
    g.userData.matiere = m;
    return g;
  }

  // texte d'une clé écrite dans un poste ({type, valeur}) : une variable prend sa valeur dans l'état courant
  function texteCle(cle, etat) {
    if (!cle) return "?";
    if (cle.type === "variable") return texteValeur(etat[cle.valeur]);
    if (cle.type === "texte") return `"${cle.valeur}"`;
    return String(cle.valeur);
  }

  function surligner(nom, indices, couleur = PAL.accent) {
    const m = meubles.get(nom); if (!m) return;
    for (const i of indices) { const c = m.cases[i]; if (c && c.objet.userData.matiere) { c.objet.userData.matiere.emissive.setHex(couleur); c.objet.userData.matiere.emissiveIntensity = 0.55; } }
  }

  // ---------- rejeu ----------
  let chariot = null;
  function preparerRejeu(plateau, etatInitial = {}) {
    plateauCourant = plateau;
    vider(rejeuGroupe);
    chariot = chariotModele(); chariot.position.copy(versMonde(DEPART.x, DEPART.z)).setY(TAPIS.hauteur + 0.03);
    chariot.userData.poste = "depart"; rejeuGroupe.add(chariot);
    construireDonnees(etatInitial);
    const d = objets.get("depart");
    if (d && plateau.fonction) d.etiquette.ecrire(`Réception · ${plateau.fonction.nom}(${plateau.fonction.parametres.map((n) => texteValeur(etatInitial[n], true)).join(", ")})`);
    const f = objets.get("fin"); if (f) f.etiquette.ecrire(f.texte);
    S.enLigne = false;
  }

  function chariotModele() {
    const g = new THREE.Group();
    boite(0.42, 0.1, 0.3, M.peinture_orange, 0, 0.08, 0, g);
    boite(0.42, 0.18, 0.03, M.peinture_orange, 0, 0.2, 0.15, g); boite(0.42, 0.18, 0.03, M.peinture_orange, 0, 0.2, -0.15, g);
    const balise = cylindre(0.05, 0.05, 0.12, M.led(0xffc857, 1.2), 0, 0.3, 0, g, 10); balise.material.userData = {};
    g.userData.balise = balise.material;
    g.traverse((o) => { if (o.isMesh) o.castShadow = haute; });
    return g;
  }

  function allumer(id, couleur = 0xffc857, force = 3) {
    const o = objets.get(id); if (!o) return;
    o.lueur.emissive.setHex(couleur);
    lueurs.push({ matiere: o.lueur, base: 0.35, force, t: 0, duree: 0.7 });
  }

  async function allerA(id, duree) {
    if (!chariot || chariot.userData.poste === id) return;
    const ou = plateauCourant.position(id); if (!ou) return;
    // le tapis qui va du poste du chariot à ce poste, sinon (saut) une courbe par-dessus
    const t = plateauCourant.tapis().find((u) => u.de === chariot.userData.poste && u.vers === id && u.cases);
    const depart = chariot.position.clone(), arrivee = versMonde(...ou).setY(TAPIS.hauteur + 0.03);
    const pts = t ? [depart, ...t.cases.map(([x, z]) => versMonde(x, z).setY(TAPIS.hauteur + 0.03)), arrivee] : [depart, arrivee];
    const longueurs = []; let total = 0;
    for (let i = 0; i < pts.length - 1; i++) { const d = pts[i].distanceTo(pts[i + 1]); longueurs.push(d); total += d; }
    await animer(duree * Math.max(0.4, Math.min(1.4, total / 3)), (k) => {
      let reste = k * total, i = 0;
      while (i < longueurs.length - 1 && reste > longueurs[i]) { reste -= longueurs[i]; i++; }
      chariot.position.lerpVectors(pts[i], pts[i + 1], longueurs[i] ? Math.min(1, reste / longueurs[i]) : 1);
      if (!t) chariot.position.y = TAPIS.hauteur + 0.03 + Math.sin(Math.PI * k) * 0.6;
    });
    chariot.userData.poste = id;
  }

  // Une étape : le chariot va au poste, le poste s'allume, la donnée change sous les yeux.
  async function jouerEtape(e, facteur = 1) {
    S.enLigne = true;
    const duree = DUREE_PAS * facteur;
    const p = plateauCourant.poste(e.poste);
    if (!p) { construireDonnees(e.apres); await animer(duree * 0.3, () => {}); return; }
    await allerA(p.id, duree * 0.6);
    allumer(p.id, e.erreur ? PAL.erreur : CATEGORIES[PIECES[p.type].categorie] ? new THREE.Color(CATEGORIES[PIECES[p.type].categorie].couleur).getHex() : 0xffc857);
    const q = p.params, cible = donneeDe(p), avant = e.avant;
    // la lecture : les cases lues s'allument d'abord
    const source = q.source && avant[q.source];
    const armoire = avant[q.source || q.cible];
    if (armoire && armoire.t === "dict" && q.cle) {
      const cle = texteCle(q.cle, avant), i = armoire.v.findIndex(([k]) => texteValeur(k) === cle);
      if (i >= 0) { surligner(q.source || q.cible, [i]); await animer(duree * 0.4, () => {}); }
    } else if (source && (source.t === "list" || source.t === "tuple")) {
      const n = source.n;
      let indices = [];
      if (p.type === "lire_case") { const i = q.indice < 0 ? n + Number(q.indice) : Number(q.indice); if (i >= 0 && i < n) indices = [i]; }
      if (p.type === "tranche") { const a = q.debut ?? 0, b = q.fin ?? n; const da = a < 0 ? Math.max(0, n + a) : Math.min(a, n), db = b < 0 ? Math.max(0, n + b) : Math.min(b, n); for (let i = da; i < db; i++) indices.push(i); }
      if (["longueur", "trier_copie", "decomposer", "contient"].includes(p.type)) indices = [...Array(Math.min(n, 11)).keys()];
      surligner(q.source, indices);
      if (p.type === "tranche" && q.fin !== null && q.fin !== undefined) {
        const b = q.fin < 0 ? n + q.fin : q.fin;
        if (b >= 0 && b < n) surligner(q.source, [b], PAL.erreur);      // la case de fin, non prise
      }
      await animer(duree * 0.45, () => {});
    }
    if (e.erreur) { await montrerErreur(e, p, duree); return; }
    await transition(avant, e.apres, p, duree);
    if (e.decision) {
      const o = objets.get(p.id); if (o) o.etiquette.ecrire(e.decision.length > 34 ? e.decision.slice(0, 33) + "…" : e.decision, e.vrai);
      sons.jouer("clic");
    }
    if (p.type === "renvoyer" && e.retour !== undefined) {
      await allerA("fin", duree * 0.6);
      const o = objets.get("fin"); if (o) o.etiquette.ecrire(`return → ${e.retour.length > 30 ? e.retour.slice(0, 29) + "…" : e.retour}`, e.retourOk);
      allumer("fin", e.retourOk === false ? PAL.erreur : PAL.reussite, 3); sons.jouer("neutre");
    }
    if (p.type === "afficher" && e.affiche !== undefined) {
      const o = objets.get(p.id); if (o) o.etiquette.ecrire(`print → ${e.affiche.length > 34 ? e.affiche.slice(0, 33) + "…" : e.affiche}`, true);
      sons.jouer("neutre");
    } else if (["ajouter", "retirer", "remplacer_case", "trier_sur_place", "creer_liste", "creer_tuple", "variable", "creer_dict", "creer_set", "ecrire_cle", "ajouter_set"].includes(p.type)) sons.jouer("clic");
    await animer(duree * 0.2, () => {});
    void cible;
  }

  // Passage d'un état des données au suivant : chaque carton qui reste va de son ancienne place à la nouvelle,
  // un carton nouveau vient de la donnée lue (copie) ou tombe d'en haut, un carton retiré se soulève et disparaît.
  async function transition(avant, apres, p, duree) {
    const anciens = new Map();
    for (const [nom, m] of meubles) anciens.set(nom, m.cases.map((c) => ({ texte: c.texte, position: c.objet.getWorldPosition(new THREE.Vector3()), pris: false })));
    const partants = [];
    construireDonnees(apres);
    const mouvements = [];
    const source = p.params.source;
    for (const [nom, m] of meubles) {
      const vieux = anciens.get(nom) || [];
      m.cases.forEach((c) => {
        const fin = c.objet.position.clone();
        let depuis = vieux.find((v) => !v.pris && v.texte === c.texte);
        if (depuis) depuis.pris = true;
        else if (source && anciens.get(source)) depuis = { position: (anciens.get(source).find((v) => v.texte === c.texte) || {}).position };
        const debut = depuis && depuis.position ? depuis.position.clone() : fin.clone().add(new THREE.Vector3(0, 1.4, 0));
        if (!c.objet.parent || debut.distanceTo(fin) < 0.01) return;
        mouvements.push({ objet: c.objet, debut: c.objet.parent.worldToLocal(debut.clone()), fin, nouveau: !depuis });
      });
      for (const v of vieux) if (!v.pris && apres[nom] && (apres[nom].t === "list" || apres[nom].t === "tuple")) partants.push(v);
    }
    // les cartons retirés : une copie se soulève et s'efface
    const fantomes = partants.map((v) => {
      const f = cartonModele({ t: "str" }, false); f.position.copy(v.position); rejeuGroupe.add(f);
      f.traverse((o) => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; o.userData.propre = true; } });
      return f;
    });
    if (!mouvements.length && !fantomes.length) return;
    await animer(duree * 0.7, (k) => {
      const a = douceur(k);
      for (const m of mouvements) { m.objet.position.lerpVectors(m.debut, m.fin, a); if (!m.nouveau) m.objet.position.y += Math.sin(Math.PI * k) * 0.4; }
      for (const f of fantomes) { f.position.y += 0.03; f.traverse((o) => { if (o.material) o.material.opacity = 1 - k; }); }
    });
    for (const f of fantomes) rejeuGroupe.remove(f);
  }

  async function montrerErreur(e, p, duree) {
    const q = p.params, nom = q.source || q.cible, m = meubles.get(nom), type = e.erreur.type;
    sons.jouer("rate"); effets.secouer(0.05);
    if (m && type === "IndexError" && q.indice !== undefined) {
      // la case demandée n'existe pas : un carton rouge, vide, à l'endroit où elle serait
      const n = e.avant[nom]?.n ?? m.n, i = q.indice < 0 ? n + Number(q.indice) : Number(q.indice);
      const fantome = cartonModele(null, false); const c = versMonde(m.x0 + 1 + i, m.z);
      fantome.position.set(c.x, 0.2 + CAISSE / 2, c.z);
      fantome.traverse((o) => { if (o.material) { o.material = new THREE.MeshBasicMaterial({ color: PAL.erreur, transparent: true, opacity: 0.55, wireframe: false }); o.userData.propre = true; } });
      rejeuGroupe.add(fantome);
      const ind = creerEtiquette(`${i} ?`, { petite: true, couleur: "#f2746b" }); ind.sprite.position.set(c.x, 1.25, c.z); rejeuGroupe.add(ind.sprite);
    } else if (m && type === "KeyError") {
      // le tiroir demandé n'existe pas : un tiroir rouge, vide, au bout de l'armoire
      const c = versMonde(m.x0 + 1 + m.n, m.z);
      const fantome = cartonModele(null, false); fantome.position.set(c.x, 0.09 + CAISSE / 2, c.z);
      fantome.traverse((o) => { if (o.material) { o.material = new THREE.MeshBasicMaterial({ color: PAL.erreur, transparent: true, opacity: 0.55 }); o.userData.propre = true; } });
      rejeuGroupe.add(fantome);
      const ind = creerEtiquette(`${texteCle(q.cle, e.avant)} ?`, { petite: true, couleur: "#f2746b" }); ind.sprite.position.set(c.x, 1.25, c.z); rejeuGroupe.add(ind.sprite);
    } else if (m && type === "ValueError") {
      surligner(nom, [...m.cases.keys()], PAL.erreur);
    } else if (m && m.plomb && (type === "TypeError" || type === "AttributeError")) {
      lueurs.push({ matiere: m.plomb.material, base: 0.6, force: 4, t: 0, duree: 1.4 });
    }
    allumer(p.id, PAL.erreur, 4);
    const o = objets.get(p.id); if (o) effets.pastille(o.groupe.position.x, 1.2, o.groupe.position.z, false);
    await animer(duree * 1.6, (k) => { if (chariot) chariot.position.x += Math.sin(k * 40) * 0.004; });
  }

  async function finFonction(retour, ok) {
    if (!chariot || chariot.userData.poste === "fin") return;
    await allerA("fin", DUREE_PAS * 0.6);
    const o = objets.get("fin"); if (o) o.etiquette.ecrire(`fin → ${retour}`, ok);
    allumer("fin", ok ? PAL.reussite : PAL.erreur, 3);
  }

  function terminer({ reussi }) {
    S.enLigne = false;
    if (reussi) { const c = versMonde(L - 2, P - 2); effets.confettis(c.x, 1.2, c.z); sons.jouer("victoire"); } else sons.jouer("alerte");
  }

  function detruire() {
    S.vivant = false; observateur.disconnect(); environnement.dispose(); rendu.dispose();
    if (rendu.domElement.parentNode) rendu.domElement.parentNode.removeChild(rendu.domElement);
  }

  // Étiquette : texte clair sur fond sombre, toujours tournée vers la caméra.
  function creerEtiquette(texte, { petite = false, couleur = "#f28c1e", code = false, valeur = false, index = false } = {}) {
    const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
    const materiau = new THREE.SpriteMaterial({ depthTest: false, toneMapped: false, transparent: true });
    const sprite = new THREE.Sprite(materiau); sprite.renderOrder = 4; sprite.userData.propre = true;
    const hauteurMonde = (index ? 0.8 : petite ? 0.78 : 1) * ETIQUETTE.hauteur;
    const police = code || valeur ? "'JetBrains Mono', Consolas, monospace" : POLICE;
    const ecrire = (t, etat = null) => {
      const taille = 44, h = 72; ctx.font = `700 ${taille}px ${police}`;
      const l = Math.ceil(ctx.measureText(t).width) + 44;
      canvas.width = l; canvas.height = h; ctx.font = `700 ${taille}px ${police}`;
      const bord = etat === true ? "#4fc4a0" : etat === false ? "#f2746b" : couleur;
      ctx.fillStyle = index ? "rgba(14,20,32,0.75)" : "rgba(14,20,32,0.92)"; arrondi(ctx, 2, 2, l - 4, h - 4, 14); ctx.fill();
      if (!index) { ctx.lineWidth = 4; ctx.strokeStyle = bord; arrondi(ctx, 2, 2, l - 4, h - 4, 14); ctx.stroke(); }
      ctx.fillStyle = index ? "#ffc857" : "#eaf2ff"; ctx.textBaseline = "middle"; ctx.fillText(t, 22, h / 2 + 2);
      if (materiau.map) materiau.map.dispose();
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
      materiau.map = texture; materiau.needsUpdate = true;
      sprite.scale.set(hauteurMonde * (l / h), hauteurMonde, 1);
    };
    ecrire(texte);
    return { sprite, ecrire };
  }

  return Object.assign(S, { dessiner, construireDonnees, donneeEn, finFonction, preparerRejeu, jouerEtape, terminer, detruire, projeter, allumer, rendu, camera });
}

// ---------- textures dessinées ----------
function arrondi(ctx, x, y, l, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + l, y, x + l, y + h, r); ctx.arcTo(x + l, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + l, y, r); ctx.closePath();
}

function texSol(L, P) {
  const px = 64, c = document.createElement("canvas"); c.width = L * px; c.height = P * px;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#4a4e57"; ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#3b3e46"; ctx.fillRect(0, 0, c.width, GRILLE.stockage * px);         // la zone des données, plus sombre
  for (let i = 0; i < 2500; i++) { ctx.fillStyle = `rgba(${Math.random() < 0.5 ? "255,255,255" : "0,0,0"},0.05)`; ctx.fillRect(Math.random() * c.width, Math.random() * c.height, 2, 2); }
  ctx.strokeStyle = "rgba(255,255,255,0.13)"; ctx.lineWidth = 2;
  for (let x = 0; x <= L; x++) { ctx.beginPath(); ctx.moveTo(x * px, GRILLE.stockage * px); ctx.lineTo(x * px, c.height); ctx.stroke(); }
  for (let z = GRILLE.stockage; z <= P; z++) { ctx.beginPath(); ctx.moveTo(0, z * px); ctx.lineTo(c.width, z * px); ctx.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function texChevrons() {
  const c = document.createElement("canvas"); c.width = 128; c.height = 64;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#1b1c20"; ctx.fillRect(0, 0, 128, 64);
  ctx.strokeStyle = "#f5b82e"; ctx.lineWidth = 7; ctx.lineCap = "round";
  for (const x0 of [20, 84]) { ctx.beginPath(); ctx.moveTo(x0, 14); ctx.lineTo(x0 + 18, 32); ctx.lineTo(x0, 50); ctx.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping;
  return t;
}
