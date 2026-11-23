// Un robot de combat humanoïde (2,3 m), fait de formes simples : blindage peint aux couleurs du binôme, membres en acier,
// gants de frappe, visière et cœur lumineux (l'énergie). Squelette articulé, poses calculées à partir de ce que dit le
// journal du combat (action, phase, avancement dans la phase), lissées image par image.
import * as THREE from "three";
import { RoundedBoxGeometry } from "../../vendor/three/addons/RoundedBoxGeometry.js";

// Les poses : angles des articulations (radians). Le robot regarde vers +x.
// epaule : rotation autour de z (le bras monte vers l'avant) ; ecarte : autour de x (le bras s'écarte du corps) ;
// coude : autour de z (l'avant-bras se plie vers l'avant) ; tronc : vrille (y) et penche (z, négatif = vers l'avant) ;
// hanche : autour de z (la jambe va vers l'avant) ; genou : autour de z (négatif = plié) ; bassin : hauteur.
const BASE = {
  bassin: 0, troncY: 0, troncZ: -0.08, tete: 0.05,
  epauleG: 0.95, ecarteG: -0.25, coudeG: 2.1, epauleD: 0.75, ecarteD: 0.25, coudeD: 2.25,
  hancheG: 0.18, genouG: -0.28, hancheD: -0.18, genouD: -0.22,
};
const POSES = {
  garde: { epauleG: 1.15, ecarteG: -0.05, coudeG: 2.45, epauleD: 1.15, ecarteD: 0.05, coudeD: 2.45, tete: 0.25, troncZ: -0.18, bassin: -0.08 },
  // direct : le bras avant (gauche) part tout droit
  direct_preparation: { epauleG: 0.7, coudeG: 2.4, troncY: 0.2 },
  direct_frappe: { epauleG: 1.62, ecarteG: 0.05, coudeG: 0.08, troncY: -0.35, troncZ: -0.2 },
  // crochet : le bras arrière (droit) armé large, puis balayé
  crochet_preparation: { epauleD: 0.6, ecarteD: 1.0, coudeD: 1.7, troncY: 0.6, troncZ: -0.05 },
  crochet_frappe: { epauleD: 1.45, ecarteD: -0.55, coudeD: 1.2, troncY: -0.85, troncZ: -0.25 },
  // garde basse : accroupi, avant-bras devant les genoux
  garde_basse: { bassin: -0.32, troncZ: -0.35, tete: 0.3, hancheG: 0.75, genouG: -1.15, hancheD: 0.45, genouD: -1.05,
    epauleG: 0.75, coudeG: 1.5, ecarteG: -0.1, epauleD: 0.75, coudeD: 1.5, ecarteD: 0.1 },
  // coup bas : il se baisse, puis balaie de la jambe avant
  coup_bas_preparation: { bassin: -0.3, troncZ: -0.3, hancheG: 0.7, genouG: -1.1, hancheD: -0.3, genouD: -0.9, troncY: 0.3 },
  coup_bas_frappe: { bassin: -0.35, troncZ: 0.25, troncY: -0.3, hancheG: 1.35, genouG: -0.1, hancheD: -0.2, genouD: -1.2, epauleG: 0.4, epauleD: 0.4 },
  // projection : les deux bras vont saisir, puis soulèvent
  projection_preparation: { epauleG: 1.3, coudeG: 0.6, epauleD: 1.3, coudeD: 0.6, ecarteG: -0.35, ecarteD: 0.35, troncZ: -0.35, bassin: -0.2 },
  projection_frappe: { epauleG: 2.4, coudeG: 0.9, epauleD: 2.4, coudeD: 0.9, troncZ: 0.25, troncY: -0.4, bassin: 0.05 },
  // spécial : il se ramasse, charge, puis uppercut sauté
  special_preparation: { epauleD: 0.2, ecarteD: 0.4, coudeD: 2.0, troncZ: -0.45, bassin: -0.45, genouG: -1.0, genouD: -1.1, hancheG: 0.6, hancheD: 0.3, troncY: 0.35 },
  special_frappe: { epauleD: 2.9, ecarteD: 0.05, coudeD: 0.2, troncZ: 0.2, troncY: -0.5, bassin: 0.35, genouG: -0.1, genouD: -0.1 },
  esquive: { troncZ: 0.45, tete: -0.2, bassin: -0.15, hancheG: -0.2, genouG: -0.5, epauleG: 1.3, coudeG: 2.4, epauleD: 1.3, coudeD: 2.4 },
  sonne: { troncZ: 0.35, tete: -0.5, epauleG: 0.3, coudeG: 1.0, epauleD: 0.2, coudeD: 0.9, ecarteG: -0.45, ecarteD: 0.45, genouG: -0.4, genouD: -0.15 },
  ko: { troncZ: 0.9, tete: -0.6, epauleG: 0.1, coudeG: 0.3, epauleD: 0.1, coudeD: 0.3, ecarteG: -0.9, ecarteD: 0.9, hancheG: 0.7, genouG: -0.2, hancheD: 0.6, genouD: -0.2 },
  victoire: { epauleG: 2.9, coudeG: 0.3, ecarteG: -0.4, epauleD: 2.9, coudeD: 0.3, ecarteD: 0.4, troncZ: 0.1, tete: 0.3 },
};

function cible(pose) { return { ...BASE, ...(POSES[pose] || {}) }; }

export function fabriquerRobot(couleur, { qualite = "haute" } = {}) {
  const peinture = new THREE.MeshStandardMaterial({ color: couleur, metalness: 0.6, roughness: 0.32 });
  const sombre = new THREE.MeshStandardMaterial({ color: 0x24262c, metalness: 0.7, roughness: 0.45 });
  const acier = new THREE.MeshStandardMaterial({ color: 0xb9bec7, metalness: 0.95, roughness: 0.25 });
  const gant = new THREE.MeshStandardMaterial({ color: new THREE.Color(couleur).multiplyScalar(0.55), metalness: 0.5, roughness: 0.4 });
  const lumiere = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x6fd8ff, emissiveIntensity: 2.4 });
  const ombres = qualite === "haute";
  const m = (geo, mat, parent, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = ombres; o.receiveShadow = ombres; parent.add(o); return o; };
  const g = (parent, x = 0, y = 0, z = 0) => { const o = new THREE.Group(); o.position.set(x, y, z); parent.add(o); return o; };

  const racine = new THREE.Group();
  const bassin = g(racine, 0, 1.05, 0);
  m(new RoundedBoxGeometry(0.5, 0.28, 0.62, 3, 0.08), sombre, bassin);
  // le tronc, la tête
  const tronc = g(bassin, 0, 0.12, 0);
  m(new RoundedBoxGeometry(0.42, 0.42, 0.5, 3, 0.1), acier, tronc, 0, 0.2, 0);                 // taille
  m(new RoundedBoxGeometry(0.62, 0.58, 0.9, 4, 0.14), peinture, tronc, 0.02, 0.62, 0);          // poitrine
  m(new RoundedBoxGeometry(0.2, 0.3, 0.5, 3, 0.06), peinture, tronc, -0.28, 0.66, 0);           // dos (bloc moteur)
  const coeur = m(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 24).rotateZ(Math.PI / 2), lumiere.clone(), tronc, 0.34, 0.66, 0);
  m(new THREE.TorusGeometry(0.12, 0.025, 8, 24).rotateY(Math.PI / 2), acier, tronc, 0.34, 0.66, 0);
  for (const z of [-0.5, 0.5]) m(new THREE.SphereGeometry(0.17, 16, 12), peinture, tronc, 0, 0.84, z); // épaulières
  const cou = g(tronc, 0.02, 0.95, 0);
  m(new THREE.CylinderGeometry(0.07, 0.09, 0.12, 12), acier, cou, 0, 0.04, 0);
  const tete = g(cou, 0, 0.1, 0);
  m(new RoundedBoxGeometry(0.32, 0.3, 0.3, 3, 0.08), peinture, tete, 0, 0.15, 0);
  m(new RoundedBoxGeometry(0.06, 0.08, 0.26, 2, 0.02), sombre, tete, 0.15, 0.17, 0);
  const yeux = m(new THREE.BoxGeometry(0.03, 0.035, 0.2), lumiere.clone(), tete, 0.18, 0.17, 0);
  m(new THREE.BoxGeometry(0.16, 0.04, 0.04), acier, tete, -0.02, 0.32, 0);                       // crête
  // les bras : épaule → bras → coude → avant-bras → gant
  const bras = {};
  for (const [cote, z] of [["G", -0.5], ["D", 0.5]]) {
    const epaule = g(tronc, 0, 0.82, z);
    m(new THREE.CylinderGeometry(0.09, 0.08, 0.42, 12), acier, epaule, 0, -0.24, 0);
    m(new RoundedBoxGeometry(0.2, 0.3, 0.2, 2, 0.05), peinture, epaule, 0, -0.2, 0);
    const coude = g(epaule, 0, -0.46, 0);
    m(new THREE.SphereGeometry(0.085, 12, 10), sombre, coude);
    m(new THREE.CylinderGeometry(0.075, 0.07, 0.38, 12), acier, coude, 0, -0.21, 0);
    const poing = m(new RoundedBoxGeometry(0.22, 0.24, 0.2, 3, 0.06), gant, coude, 0, -0.48, 0);
    bras[cote] = { epaule, coude, poing };
  }
  // les jambes : hanche → cuisse → genou → tibia → pied
  const jambes = {};
  for (const [cote, z] of [["G", -0.2], ["D", 0.2]]) {
    const hanche = g(bassin, 0, -0.08, z);
    m(new RoundedBoxGeometry(0.2, 0.46, 0.2, 2, 0.06), peinture, hanche, 0, -0.25, 0);
    const genou = g(hanche, 0, -0.5, 0);
    m(new THREE.SphereGeometry(0.09, 12, 10), sombre, genou);
    m(new THREE.CylinderGeometry(0.08, 0.1, 0.42, 12), acier, genou, 0, -0.22, 0);
    m(new RoundedBoxGeometry(0.36, 0.1, 0.2, 2, 0.04), sombre, genou, 0.06, -0.47, 0);
    jambes[cote] = { hanche, genou };
  }
  racine.traverse((o) => { if (o.isMesh) o.userData.robot = true; });

  // ---------- l'animation ----------
  const val = { ...BASE };
  let marche = 0;
  function appliquer() {
    // les pieds restent au sol : la hauteur du bassin suit la jambe la plus tendue (cuisse 0,5 m, tibia et pied 0,52 m)
    const jambe = (h, g) => 0.08 + 0.5 * Math.cos(h) + 0.52 * Math.cos(h + g);
    bassin.position.y = Math.max(jambe(val.hancheG, val.genouG), jambe(val.hancheD, val.genouD)) + Math.max(0, val.bassin) * 0.5;
    tronc.rotation.set(0, val.troncY, val.troncZ);
    cou.rotation.z = val.tete;
    bras.G.epaule.rotation.set(val.ecarteG, 0, val.epauleG); bras.G.coude.rotation.z = val.coudeG;
    bras.D.epaule.rotation.set(val.ecarteD, 0, val.epauleD); bras.D.coude.rotation.z = val.coudeD;
    jambes.G.hanche.rotation.z = val.hancheG; jambes.G.genou.rotation.z = val.genouG;
    jambes.D.hanche.rotation.z = val.hancheD; jambes.D.genou.rotation.z = val.genouD;
  }
  appliquer();

  // pose(nom, vitesse) : la pose visée ; anime(dt) : rapproche les angles de la pose visée.
  let visee = cible("base"), vitesse = 10, enMarche = 0, temps = 0;
  return {
    objet: racine, coeur, yeux, bras,
    pose(nom, v = 10, marcheSens = 0) { visee = cible(nom); vitesse = v; enMarche = marcheSens; },
    energie(e) { coeur.material.emissiveIntensity = 0.4 + 2.6 * (e / 100); },
    eteindre(oui) { yeux.material.emissiveIntensity = oui ? 0.05 : 2.4; },
    anime(dt) {
      temps += dt;
      const k = 1 - Math.exp(-vitesse * dt);
      for (const cle in val) val[cle] += (visee[cle] - val[cle]) * k;
      // la marche : les jambes balancent quand le robot avance ou recule ; un léger rebond sinon
      if (enMarche) {
        marche += dt * 9 * enMarche;
        val.hancheG += Math.sin(marche) * 0.5 * k; val.hancheD -= Math.sin(marche) * 0.5 * k;
        val.genouG = Math.min(val.genouG, -0.2 - Math.max(0, Math.sin(marche)) * 0.7);
        val.genouD = Math.min(val.genouD, -0.2 - Math.max(0, -Math.sin(marche)) * 0.7);
      } else val.bassin += Math.sin(temps * 5) * 0.012;
      appliquer();
    },
  };
}
