// Un robot de combat chargé d'un fichier 3D (.glb) et animé par des animations capturées (Mixamo, ou celles du modèle).
// Même rôle que robot3d.js (le robot en formes simples, gardé en secours) : le ring lui dit, instant par instant,
// dans quelle phase est le robot (journal du combat) ; il choisit l'animation et la cale sur les temps du moteur :
// la frappe de l'animation tombe sur l'instant où le moteur fait frapper le coup.
//
// Le catalogue (robots/catalogue.json) liste les robots et leurs animations. Une animation se décrit par son nom dans le
// fichier, ou par { nom, vitesse, boucle, tenir, impact, debut, fin } : impact = seconde de l'animation où le coup touche.
import * as THREE from "three";
import { GLTFLoader } from "../../vendor/three/addons/loaders/GLTFLoader.js";
import { clone as clonerAvecSquelette } from "../../vendor/three/addons/utils/SkeletonUtils.js";
import { R } from "./regles.js";

const BOUCLES = new Set(["base", "garde", "garde_basse", "avancer", "reculer", "sonne"]);
const TENUES = new Set(["garde_basse", "ko", "defaite", "victoire"]); // une pose qu'on garde à la fin de l'animation
// un état sans animation prend celle-ci à la place (puis la suivante, etc.)
const REMPLACE = { touche_fort: "touche", projete: "touche_fort", bloque: "garde", garde_basse: "garde", defaite: "base", sonne: "touche", entree: "garde", garde: "base" };
const choisir = (actions, etat) => { let e = etat; for (let i = 0; i < 4 && e && !actions[e]; i++) e = REMPLACE[e]; return actions[e] ? e : "base"; };
const chargeur = new GLTFLoader();
const fichiers = new Map();                           // url → promesse du fichier chargé (chargé une seule fois)
let catalogue = null;

function chargerFichier(url) {
  if (!fichiers.has(url)) fichiers.set(url, chargeur.loadAsync(url));
  return fichiers.get(url);
}

export async function lireCatalogue(url = "robots/catalogue.json") {
  if (!catalogue) catalogue = fetch(url).then((r) => (r.ok ? r.json() : { robots: [] })).catch(() => ({ robots: [] }));
  return catalogue;
}

// Dans un fichier d'animations téléchargé « Without Skin », il n'y a pas de maillage : le chargeur ne marque pas les os
// comme Bone. On cherche donc d'abord un os, puis n'importe quel nœud nommé « Hips ».
const osHanches = (racine) => {
  let os = null, noeud = null;
  racine.traverse((o) => { if (!/hips/i.test(o.name)) return; if (o.isBone && !os) os = o; if (!noeud) noeud = o; });
  return os || noeud;
};

// Les animations Mixamo d'un robot servent aux autres : on garde les rotations des os (elles se transposent d'un robot
// à l'autre), on retire les translations (elles imposeraient les longueurs d'os du robot d'origine), sauf la hauteur
// des hanches, mise à l'échelle du robot qui joue. Le déplacement au sol vient du moteur : on retire l'avancée des hanches.
function adapterClip(clip, hanchesSource, hanchesCible) {
  const rapport = hanchesSource && hanchesCible && hanchesSource.position.y ? hanchesCible.position.y / hanchesSource.position.y : 1;
  const pistes = [];
  for (const piste of clip.tracks) {
    const [noeud, propriete] = piste.name.split(".");
    if (propriete === "scale") continue;
    if (propriete === "position") {
      if (!hanchesSource || noeud !== hanchesSource.name) continue;
      const p = piste.clone(), v = p.values, x0 = v[0], z0 = v[2];
      for (let i = 0; i < v.length; i += 3) { v[i] = x0 * rapport; v[i + 1] *= rapport; v[i + 2] = z0 * rapport; }
      pistes.push(p);
      continue;
    }
    pistes.push(piste);
  }
  return new THREE.AnimationClip(clip.name, clip.duration, pistes);
}

// Les animations d'un modèle qui a les siennes : on retire seulement l'avancée des hanches (le moteur déplace le robot).
function figerAuSol(clip, hanches) {
  if (!hanches) return clip;
  const c = clip.clone();
  for (const p of c.tracks) {
    if (p.name === `${hanches.name}.position`) { const v = p.values, x0 = v[0], z0 = v[2]; for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; } }
  }
  return c;
}

const fiche = (spec) => (typeof spec === "string" ? { nom: spec } : spec || null);

export async function chargerRobot(id, couleur, { qualite = "haute" } = {}) {
  const cat = await lireCatalogue();
  const def = cat.robots.find((r) => r.id === id);
  if (!def) throw new Error(`robot inconnu : ${id}`);
  const gltf = await chargerFichier(def.fichier);
  const modele = clonerAvecSquelette(gltf.scene);
  const ombres = qualite === "haute";

  // à la bonne taille, posé au sol, tourné vers +x (le moteur fait regarder les robots le long de x)
  // mesuré sur le fichier d'origine : un clone n'a pas encore calculé la pose de son squelette
  if (!gltf.userData.boite) {
    gltf.scene.updateMatrixWorld(true); gltf.userData.boite = new THREE.Box3().setFromObject(gltf.scene);
    // centré sur les hanches quand il y a un squelette : une queue ou un canon ne décale pas le robot de sa marque au sol
    const h = osHanches(gltf.scene); gltf.userData.axe = h ? h.getWorldPosition(new THREE.Vector3()) : null;
  }
  const boite = gltf.userData.boite, taille = boite.getSize(new THREE.Vector3());
  const echelle = (def.hauteur || 2.3) / Math.max(0.01, taille.y);
  modele.scale.multiplyScalar(echelle);
  const centre = (gltf.userData.axe || boite.getCenter(new THREE.Vector3())).clone().multiplyScalar(echelle);
  modele.position.set(-centre.x, -boite.min.y * echelle, -centre.z);
  const pivot = new THREE.Group(); pivot.rotation.y = THREE.MathUtils.degToRad(def.orientation ?? 90); pivot.add(modele);
  const racine = new THREE.Group(); racine.add(pivot);

  // les pièces peintes prennent la couleur de son côté (A cuivre, B bleu) ; les ombres
  const teinte = new Set(def.teinte || []);
  modele.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = ombres; o.receiveShadow = ombres; o.frustumCulled = false; o.userData.robot = true;
    // chaque robot a ses propres matériaux (le flash d'un coup ne doit pas allumer l'autre robot du même modèle)
    const remplacer = (m) => { const c = m.clone(); if (teinte.has(m.name)) c.color = new THREE.Color(couleur); return c; };
    o.material = Array.isArray(o.material) ? o.material.map(remplacer) : remplacer(o.material);
  });
  // l'anneau lumineux au sol : la couleur de son côté (A cuivre, B bleu), son éclat suit l'énergie
  const anneauMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: couleur, emissiveIntensity: 1.5, transparent: true, opacity: 0.9 });
  const anneau = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 48).rotateX(-Math.PI / 2), anneauMat);
  anneau.position.y = 0.015; anneau.userData.anneau = true; racine.add(anneau);

  // les animations : celles du modèle, ou le jeu partagé (Mixamo)
  const hanches = osHanches(modele);
  let source = gltf.animations, hanchesSource = null, partage = false;
  if (def.animations && def.animations !== "integrees") {
    const jeu = cat.animations?.[def.animations];
    if (!jeu) { console.warn(`jeu d'animations « ${def.animations} » pas encore converti : ${id} reste immobile`); source = []; }
    else { const g = await chargerFichier(jeu.fichier); source = g.animations; hanchesSource = osHanches(g.scene); partage = true; }
  }
  const clips = def.clips || (source.length ? cat.animations?.[def.animations]?.clips : null) || {};
  const melangeur = new THREE.AnimationMixer(modele);
  const actions = {};
  for (const [etat, spec] of Object.entries(clips)) {
    const f = fiche(spec); if (!f) continue;
    let clip = source.find((c) => c.name === f.nom);
    if (!clip) { console.warn(`animation absente : ${f.nom} (${id})`); continue; }
    if (f.debut != null || f.fin != null) clip = THREE.AnimationUtils.subclip(clip, clip.name, Math.round((f.debut || 0) * 30), Math.round((f.fin ?? clip.duration) * 30), 30);
    clip = partage ? adapterClip(clip, hanchesSource, hanches) : figerAuSol(clip, hanches);
    const a = melangeur.clipAction(clip);
    const boucle = f.boucle ?? BOUCLES.has(etat);
    a.setLoop(boucle ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    // une animation jouée une fois reste sur sa dernière image : sinon le robot repasse une image en pose de repos
    // (bras le long du corps) avant l'animation suivante
    a.clampWhenFinished = !boucle;
    actions[etat] = { action: a, fiche: f, duree: clip.duration };
  }
  const os = {};
  modele.traverse((o) => { if (o.isBone) { if (!os.mainG && /(left.?hand|hand.?l\b|hand_l|palm\d?\.l)/i.test(o.name)) os.mainG = o; if (!os.mainD && /(right.?hand|hand.?r\b|hand_r|palm\d?\.r)/i.test(o.name)) os.mainD = o; if (!os.piedG && /(left.?foot|foot\.l)/i.test(o.name)) os.piedG = o; if (!os.piedD && /(right.?foot|foot\.r)/i.test(o.name)) os.piedD = o; } });

  // ---------- quelle animation, quand ----------
  let courant = null, nomCourant = "", depuis = 0, fini = false;
  function jouer(etat, { vitesse = 1, fondu = 0.12, depuisDebut = true } = {}) {
    const nom = choisir(actions, etat), a = actions[nom];
    if (!a) return;
    if (nom === nomCourant && !depuisDebut) return;
    const v = (a.fiche.vitesse ?? 1) * vitesse;
    a.action.enabled = true; a.action.setEffectiveTimeScale(v); a.action.setEffectiveWeight(1);
    if (depuisDebut || nom !== nomCourant) a.action.reset();
    if (v < 0) a.action.time = a.duree;
    a.action.play();
    if (courant && courant !== a.action) courant.crossFadeTo(a.action, fondu, false);
    courant = a.action; nomCourant = nom; depuis = 0; fini = false;
  }
  melangeur.addEventListener("finished", (e) => { if (e.action === courant) fini = true; });

  let coup = null, dureeTick = 1000 / R.TICKS_PAR_SECONDE, verdict = null;
  const robot = {
    objet: racine, os, animee: true,
    // appelé par le ring à chaque instant du journal
    phase(phase, action, dureeTickMs = dureeTick) {
      dureeTick = dureeTickMs;
      if (verdict) return;
      if (phase === "preparation" || phase === "frappe" || phase === "recuperation") {
        if (phase === "preparation" && coup !== action) {
          // la frappe de l'animation doit tomber au bout des instants de préparation du moteur
          coup = action; fini = false;
          const a = actions[action], prep = (R.COUPS[action]?.preparation || 2) * dureeTick / 1000;
          const impact = a?.fiche.impact ?? (a ? a.duree * 0.45 : 0.3);
          jouer(action, { vitesse: THREE.MathUtils.clamp(impact / prep, 0.4, 3.5), fondu: 0.08 });
        } else if (phase === "recuperation" && courant) {
          courant.setEffectiveTimeScale(Math.max(0.6, Math.abs(courant.getEffectiveTimeScale())));
        }
        return;
      }
      coup = null;
      // sonné : on laisse finir la réaction au coup reçu, puis l'animation « sonné » tourne en boucle
      if (phase === "sonne") { if (nomCourant === "sonne" || (["touche", "touche_fort", "projete", "bloque"].includes(nomCourant) && !fini)) return; jouer("sonne", { fondu: 0.2 }); return; }
      if (phase === "esquive") { if (nomCourant !== "esquive") jouer("esquive", { vitesse: actions.esquive ? actions.esquive.duree / (R.ESQUIVE.duree * dureeTick / 1000) : 1, fondu: 0.06 }); return; }
      const etat = { avance: "avancer", recul: "reculer", garde: "garde", garde_basse: "garde_basse" }[phase] || "base";
      if (etat !== nomCourant) jouer(etat, { depuisDebut: true, fondu: etat === "avancer" || etat === "reculer" ? 0.15 : 0.12 });
    },
    // un coup reçu : la réaction part tout de suite (le ring l'appelle sur la cible)
    // type : touche, touche_fort (crochet, spécial, contre), projete (projection), bloque
    reaction(type) { if (verdict) return; coup = null; fini = false; jouer(type, { fondu: 0.05 }); },
    fin(resultat) { verdict = resultat; jouer(resultat, { fondu: 0.2 }); },          // victoire, ko ou defaite (aux points)
    // compatibilité avec le robot en formes simples
    pose(nom) { if (nom === "victoire" || nom === "ko" || nom === "defaite") robot.fin(nom); else if (nom === "garde") { verdict = null; coup = null; jouer("garde"); } },
    entree() { verdict = null; coup = null; jouer(actions.entree ? "entree" : "garde"); },
    energie(e) { anneauMat.emissiveIntensity = 0.3 + 2.2 * (e / 100); },
    eteindre(oui) { anneauMat.opacity = oui ? 0.25 : 0.9; },
    anime(dt) {
      depuis += dt; melangeur.update(dt);
      // un coup, une réaction ou l'entrée terminés : retour en attente, sauf les poses de fin (K.-O., victoire...) qui restent
      const tenue = actions[nomCourant]?.fiche.tenir ?? TENUES.has(nomCourant);
      if (fini && !tenue && !BOUCLES.has(nomCourant) && !(verdict && nomCourant === verdict)) { fini = false; coup = null; jouer("base", { fondu: 0.2 }); }
    },
    detruire() { melangeur.stopAllAction(); },
  };
  jouer("garde");
  return robot;
}
