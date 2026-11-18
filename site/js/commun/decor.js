// Décor de l'entrepôt de la Brasserie de la Fonderie : un diorama en coupe posé sur un socle,
// d'après les moodboards du formateur (graphite, orange de sécurité, lumières chaudes, kraft, inox).
// Tout est construit par le code : aucun modèle importé.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { texSol, texCaisse, texBandeFut, texPanneauQuai, creerEcran, alea, BIERES } from "./textures.js";
import { PAL } from "./materiaux.js";

// ----- Réglages : dimensions (1 unité = 1 mètre) et emplacements -----
export const SOL = { largeur: 16, profondeur: 11 };
export const ALLEE_Z = 0.6;                          // l'allée centrale, que le préparateur emprunte
export const LIEUX = {
  depart: { x: -0.5, z: ALLEE_Z },
  tapis: { z: -1.5, x0: -5.1, pas: 0.9, places: 5, arret: -0.55, hauteur: 0.86 },
  quais: { Q1: { x: 7.0, z: -0.7 }, Q2: { x: 7.0, z: 0.95 }, Q3: { x: 7.0, z: 2.6 }, Q4: { x: 7.0, z: 4.25 } },
  arretQuaiX: 5.55,
  rebut: { x: -6.4, z: 4.35, arretZ: 3.0 },
  rayons: { "rayon-1": { x: -7.3, z: -3.5 }, "rayon-2": { x: -7.3, z: -1.2 }, "rayon-3": { x: -7.3, z: 2.0 } },
  arretRayonX: -6.2,
  cuves: { C1: { x: 0.9, z: -4.4 }, C2: { x: 2.7, z: -4.4 }, C3: { x: 4.5, z: -4.4 }, C4: { x: 6.3, z: -4.4 } },
  arretCuveZ: -3.0,
  chariot: { x: 1.9, z: 3.95 },
  futsQuai: { x0: -2.9, z0: 3.65, pas: 0.52 },
  arretChariot: { x: 0.1, z: 3.0 },
  ecran: { x: -3.9, y: 2.85, z: -5.42 },
  arretPupitre: { x: -3.9, z: -4.15 },               // le préparateur étiquette ici, face au grand écran
  bouteilles: { x0: 1.06, z0: 3.62, pas: 0.15, colonnes: 12, rangees: 5, y: 0.35 },   // plateau du chariot
  futVide: { x: 0.55, z: 3.55 },
};

export function creerDecor(scene, M, qualite) {
  const haute = qualite === "haute";
  const D = { quais: {}, rayons: {}, cuves: {}, objets: new Map(), groupe: new THREE.Group(), dynamiques: new THREE.Group() };
  scene.add(D.groupe, D.dynamiques);

  // --- petites fabriques ---
  const ombre = (m, projette = true) => { m.castShadow = projette && haute; m.receiveShadow = haute; return m; };
  const boite = (l, h, p, matiere, x, y, z, parent = D.groupe, rayon = 0.035) => {
    const g = rayon > 0 ? new RoundedBoxGeometry(l, h, p, 2, Math.min(rayon, l / 2.2, h / 2.2, p / 2.2)) : new THREE.BoxGeometry(l, h, p);
    const m = ombre(new THREE.Mesh(g, matiere)); m.position.set(x, y, z); parent.add(m); return m;
  };
  const cylindre = (rh, rb, h, matiere, x, y, z, parent = D.groupe, segments = 20) => {
    const m = ombre(new THREE.Mesh(new THREE.CylinderGeometry(rh, rb, h, segments), matiere)); m.position.set(x, y, z); parent.add(m); return m;
  };
  const plan = (l, h, matiere, x, y, z, parent = D.groupe) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(l, h), matiere); m.position.set(x, y, z); parent.add(m); return m;
  };
  const L = SOL.largeur, P = SOL.profondeur;

  // --- socle et sol ---
  boite(L + 0.7, 0.7, P + 0.7, M.socle, 0, -0.36, 0, D.groupe, 0.12);
  for (const [l, p, x, z] of [[L + 0.74, 0.06, 0, P / 2 + 0.36], [0.06, P + 0.74, L / 2 + 0.36, 0]]) boite(l, 0.07, p, M.bandeau_orange, x, -0.2, z, D.groupe, 0);
  const zones = {
    allee: [ALLEE_Z - 0.55, ALLEE_Z + 0.55],
    depots: [
      ...Object.entries(LIEUX.quais).map(([nom, q]) => ({ x: LIEUX.arretQuaiX - 0.15, z: q.z, l: 1.0, p: 1.15, couleur: "#f5b82e", texte: nom, taille: 50 })),
      { x: LIEUX.rebut.x, z: LIEUX.rebut.arretZ, l: 1.5, p: 0.9, couleur: "#f2746b", texte: "REBUT", taille: 40 },
      { x: LIEUX.chariot.x, z: LIEUX.chariot.z, l: 2.5, p: 1.7, couleur: "#f5b82e" },
      { x: -1.85, z: 3.95, l: 2.7, p: 1.7, couleur: "#f5b82e" },
    ],
  };
  const matSol = M.image(texSol(L, P, zones), 0.82);
  const sol = new THREE.Mesh(new THREE.PlaneGeometry(L, P), matSol);
  sol.rotation.x = -Math.PI / 2; sol.position.y = 0.002; sol.receiveShadow = haute; D.groupe.add(sol);

  // --- murs du fond (nord et ouest), bandeaux lumineux, fenêtres ---
  const H = 4.4;
  const murN = boite(L + 0.7, H, 0.35, M.mur.clone(), 0, H / 2 - 0.01, -P / 2 - 0.175, D.groupe, 0.03);
  murN.material.map = M.mur.map.clone(); murN.material.map.repeat.set(8, 1); murN.material.map.needsUpdate = true;
  const murO = boite(0.35, H, P + 0.35, M.mur.clone(), -L / 2 - 0.175, H / 2 - 0.01, -0.175, D.groupe, 0.03);
  murO.material.map = M.mur.map.clone(); murO.material.map.repeat.set(5.5, 1); murO.material.map.needsUpdate = true;
  boite(L, 0.07, 0.07, M.bandeau_orange, 0, 3.25, -P / 2 + 0.05, D.groupe, 0);
  boite(0.07, 0.07, P, M.bandeau_orange, -L / 2 + 0.05, 3.25, 0, D.groupe, 0);
  boite(L, 0.22, 0.12, M.peinture_sombre, 0, 0.11, -P / 2 + 0.06);        // plinthes
  boite(0.12, 0.22, P, M.peinture_sombre, -L / 2 + 0.06, 0.11, 0);
  for (let i = 0; i < 4; i++) boite(1.4, 0.5, 0.06, M.verre_fenetre, 0.6 + i * 1.9, 3.85, -P / 2 + 0.03, D.groupe, 0.02);
  for (let i = 0; i < 4; i++) boite(0.06, 0.5, 1.5, M.verre_fenetre, -L / 2 + 0.03, 3.85, -3.6 + i * 2.4, D.groupe, 0.02);
  // tuyau inox le long du mur nord
  const tuyau = cylindre(0.07, 0.07, 8.6, M.inox, 3.4, 3.42, -P / 2 + 0.22, D.groupe, 12); tuyau.rotation.z = Math.PI / 2;

  // --- rampes de néons suspendues ---
  for (const z of [-1.2, 2.6]) {
    boite(7.0, 0.07, 0.16, M.peinture_sombre, 0.4, 4.32, z, D.groupe, 0.02);
    boite(6.8, 0.04, 0.1, M.neon, 0.4, 4.27, z, D.groupe, 0);
    for (const x of [-2.6, 3.4]) boite(0.02, 0.5, 0.02, M.peinture_sombre, x, 4.6, z, D.groupe, 0);
  }

  // --- tapis d'arrivée ---
  const T = LIEUX.tapis, longueur = T.pas * (T.places - 1) + 1.1, xc = T.x0 + (T.pas * (T.places - 1)) / 2;
  boite(longueur, 0.12, 0.78, M.caoutchouc, xc, T.hauteur - 0.07, T.z, D.groupe, 0.02);
  for (const dz of [-0.43, 0.43]) boite(longueur + 0.1, 0.2, 0.08, M.peinture_orange, xc, T.hauteur - 0.05, T.z + dz);
  for (let i = 0; i < 3; i++) for (const dz of [-0.36, 0.36]) boite(0.08, T.hauteur - 0.15, 0.08, M.peinture_sombre, xc - longueur / 2 + 0.25 + i * (longueur - 0.5) / 2, (T.hauteur - 0.15) / 2, T.z + dz);
  for (let i = 0; i < 12; i++) { const r = cylindre(0.045, 0.045, 0.74, M.acier_brosse, xc - longueur / 2 + 0.18 + i * (longueur - 0.36) / 11, T.hauteur - 0.005, T.z, D.groupe, 10); r.rotation.x = Math.PI / 2; r.castShadow = false; }
  boite(0.5, 1.5, 1.0, M.peinture_metal, xc - longueur / 2 - 0.3, 0.75, T.z);                      // portique d'arrivée
  boite(0.52, 0.12, 1.02, M.peinture_orange, xc - longueur / 2 - 0.3, 1.5, T.z);
  boite(0.06, 0.9, 0.7, M.caoutchouc, xc - longueur / 2 - 0.04, 1.0, T.z, D.groupe, 0);

  // --- grand écran de contrôle et pupitre ---
  const E = LIEUX.ecran;
  boite(4.5, 2.15, 0.14, M.peinture_sombre, E.x, E.y, E.z - 0.02);
  D.ecran = creerEcran(1024, 480);
  plan(4.25, 1.95, M.ecran(D.ecran.texture), E.x, E.y, E.z + 0.06);
  boite(4.6, 0.06, 0.2, M.peinture_orange, E.x, E.y - 1.13, E.z + 0.02);
  boite(2.2, 0.95, 0.6, M.peinture_metal, E.x, 0.475, -P / 2 + 0.45);
  boite(2.24, 0.06, 0.64, M.peinture_orange, E.x, 0.98, -P / 2 + 0.45);
  for (let i = 0; i < 5; i++) boite(0.12, 0.05, 0.12, M.led(i % 2 ? PAL.reussite : PAL.accent, 1.2), E.x - 0.8 + i * 0.4, 1.03, -P / 2 + 0.5, D.groupe, 0.02);

  // --- rayonnages (mur ouest) ---
  const hasard = alea(42);
  for (const [nom, r] of Object.entries(LIEUX.rayons)) {
    const g = new THREE.Group(); g.position.set(r.x, 0, r.z); D.groupe.add(g);
    for (const dx of [-0.38, 0.38]) for (const dz of [-0.85, 0.85]) boite(0.08, 2.5, 0.08, M.peinture_orange, dx, 1.25, dz, g, 0.02);
    for (const y of [0.35, 1.15, 1.95]) {
      const plateau = boite(0.86, 0.06, 1.8, M.bois_palette, 0, y, 0, g, 0.01);
      plateau.material = M.bois_palette;
      let z = -0.72;
      while (z < 0.6) {
        const l = 0.36 + hasard() * 0.22, h = 0.26 + hasard() * 0.3, p = 0.3 + hasard() * 0.22;
        if (hasard() > 0.18) boite(l, h, p, M.carton, (hasard() - 0.5) * 0.1, y + 0.03 + h / 2, z + p / 2, g, 0.015);
        z += p + 0.06 + hasard() * 0.1;
      }
    }
    const ecran = creerEcran(512, 160);
    boite(0.08, 0.42, 1.34, M.peinture_sombre, 0.47, 2.72, 0, g, 0.02);
    const face = plan(1.26, 0.36, M.ecran(ecran.texture), 0.52, 2.72, 0, g); face.rotation.y = Math.PI / 2;
    D.rayons[nom] = { ecran };
  }

  // --- cuves de fermentation (mur nord) ---
  for (const [nom, c] of Object.entries(LIEUX.cuves)) {
    const g = new THREE.Group(); g.position.set(c.x, 0, c.z); D.groupe.add(g);
    cylindre(0.68, 0.68, 2.1, M.inox, 0, 1.75, 0, g, 28);
    cylindre(0.68, 0.16, 0.5, M.inox, 0, 0.45, 0, g, 28);                                       // fond conique
    const dome = ombre(new THREE.Mesh(new THREE.SphereGeometry(0.68, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.inox)); dome.scale.y = 0.45; dome.position.y = 2.8; g.add(dome);
    cylindre(0.12, 0.12, 0.25, M.acier_brosse, 0, 3.18, 0, g, 12);
    for (const y of [1.0, 2.5]) cylindre(0.7, 0.7, 0.06, M.acier_brosse, 0, y, 0, g, 28);
    for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + (k * Math.PI) / 2; boite(0.08, 0.75, 0.08, M.peinture_sombre, Math.cos(a) * 0.55, 0.37, Math.sin(a) * 0.55, g, 0.02); }
    const ecran = creerEcran(512, 200);
    boite(0.9, 0.42, 0.08, M.peinture_sombre, 0, 1.75, 0.69, g, 0.02);
    plan(0.84, 0.34, M.ecran(ecran.texture), 0, 1.75, 0.735, g);
    const led = boite(0.9, 0.06, 0.06, M.led(), 0, 2.03, 0.7, g, 0);
    const plaque = creerEcran(256, 96); plaque.ecrire(nom, null, { tailleMax: 64, lignesMax: 1 });
    plan(0.42, 0.16, M.ecran(plaque.texture), 0, 1.4, 0.735, g);
    D.cuves[nom] = { ecran, led };
  }

  // --- quais (bord est) ---
  // Le portique est au nord de la plateforme et son panneau regarde le sud : il se lit depuis la caméra.
  const fabriquerQuai = (code, x, z) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); D.groupe.add(g);
    const rebut = code === "R";
    boite(1.5, 0.22, 1.3, M.peinture_metal, 0, 0.11, 0, g, 0.03);
    boite(0.14, 0.05, 1.32, M.danger, -0.7, 0.225, 0, g, 0);
    for (const dx of [-0.68, 0.68]) boite(0.1, 2.56, 0.1, M.peinture_sombre, dx, 1.28, -0.7, g);
    boite(1.5, 0.54, 0.1, M.peinture_sombre, 0, 2.32, -0.7, g);
    plan(1.38, 0.46, M.image(texPanneauQuai(code), 0.6), 0, 2.32, -0.645, g);
    const led = boite(1.38, 0.07, 0.06, M.led(), 0, 1.98, -0.67, g, 0);
    if (rebut) { for (const dx of [-0.68, 0.68]) boite(0.07, 0.62, 1.26, M.peinture_rouge, dx, 0.53, 0, g, 0.02); boite(1.4, 0.62, 0.07, M.peinture_rouge, 0, 0.53, 0.6, g, 0.02); }
    const lumiere = new THREE.PointLight(PAL.reussite, 0, 5, 2); lumiere.position.set(0, 1.5, 0.2); g.add(lumiere);
    return { led, lumiere, depots: 0, x, z };
  };
  for (const [code, q] of Object.entries(LIEUX.quais)) D.quais[code] = fabriquerQuai(code, q.x, q.z);
  D.quais.R = fabriquerQuai("R", LIEUX.rebut.x, LIEUX.rebut.z);

  // --- chariot ---
  const ch = new THREE.Group(); ch.position.set(LIEUX.chariot.x, 0, LIEUX.chariot.z); D.groupe.add(ch);
  boite(2.1, 0.1, 1.2, M.peinture_orange, 0, 0.3, 0, ch, 0.03);
  for (const dx of [-0.8, 0.8]) for (const dz of [-0.48, 0.48]) { const roue = cylindre(0.14, 0.14, 0.1, M.caoutchouc, dx, 0.14, dz, ch, 14); roue.rotation.x = Math.PI / 2; }
  for (const dz of [-0.5, 0.5]) boite(0.06, 1.0, 0.06, M.peinture_sombre, 1.02, 0.85, dz, ch, 0.02);
  boite(0.06, 0.06, 1.06, M.peinture_sombre, 1.02, 1.35, 0, ch, 0.02);
  D.chariot = { groupe: ch, compteur: creerEcran(256, 128), futs: [] };
  const face = plan(0.7, 0.35, M.ecran(D.chariot.compteur.texture), 1.06, 1.0, 0, ch); face.rotation.y = Math.PI / 2;

  // --- décor de fond : palettes, cartons, fûts de réserve, gyrophare ---
  const palette = (x, z, cartons) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); D.groupe.add(g);
    for (const dz of [-0.4, 0, 0.4]) boite(1.1, 0.08, 0.14, M.bois_palette, 0, 0.04, dz, g, 0.01);
    for (const dx of [-0.42, -0.14, 0.14, 0.42]) boite(0.2, 0.03, 1.0, M.bois_palette, dx, 0.1, 0, g, 0.005);
    cartons.forEach(([dx, y, dz, l, h, p]) => boite(l, h, p, M.carton, dx, 0.115 + y + h / 2, dz, g, 0.015));
  };
  palette(4.4, 4.5, [[-0.25, 0, -0.2, 0.5, 0.42, 0.5], [0.28, 0, 0.2, 0.46, 0.36, 0.5], [0, 0.42, 0, 0.44, 0.3, 0.4]]);
  palette(-3.9, -4.3, [[-0.2, 0, 0, 0.6, 0.5, 0.8], [0.3, 0, 0.1, 0.4, 0.34, 0.5]]);
  for (const [x, z, matiere] of [[-7.3, 4.7, M.peinture_orange], [-6.75, 4.95, M.peinture_claire], [-7.35, 4.1, M.peinture_jaune]]) {
    cylindre(0.27, 0.27, 0.82, matiere, x, 0.41, z, D.groupe, 18);
    for (const y of [0.28, 0.56]) cylindre(0.28, 0.28, 0.03, M.peinture_sombre, x, y, z, D.groupe, 18);
  }
  const mat = boite(0.1, 2.9, 0.1, M.peinture_sombre, -0.9, 1.45, -5.2);
  D.gyrophare = { lampe: cylindre(0.13, 0.13, 0.16, M.led(PAL.orange, 0.3), -0.9, 2.98, -5.2, D.groupe, 12), lumiere: new THREE.PointLight(PAL.orange, 0, 12, 2) };
  D.gyrophare.lumiere.position.set(-0.9, 3.1, -4.8); D.groupe.add(D.gyrophare.lumiere); mat.castShadow = false;

  // --- objets manipulés ---
  D.fabriquer = (objet) => {
    const g = new THREE.Group();
    const biere = BIERES[objet.biere] || { couleur: "#cccccc" };
    if (objet.type === "fut") {
      cylindre(0.2, 0.2, 0.56, M.inox, 0, 0.3, 0, g, 22);
      for (const y of [0.045, 0.555]) cylindre(0.215, 0.215, 0.07, M.acier_brosse, 0, y, 0, g, 22);
      const bande = new THREE.Mesh(new THREE.CylinderGeometry(0.204, 0.204, 0.2, 22, 1, true), M.image(texBandeFut(objet.biere), 0.6));
      bande.position.y = 0.3; g.add(bande);
      cylindre(0.05, 0.05, 0.05, M.peinture_sombre, 0, 0.6, 0, g, 10);
      g.userData.hauteur = 0.62;
    } else if (objet.type === "casier") {
      // « nombre » : un lot de casiers empilés (commande de plusieurs casiers)
      const plastique = M.couleur(new THREE.Color(biere.couleur).getHex(), 0.55), verre = M.couleur(0x6b3f1d, 0.25, 0.1);
      const nombre = Math.max(1, Math.min(6, objet.nombre || 1));
      for (let k = 0; k < nombre; k++) {
        const y = k * 0.36;
        boite(0.5, 0.3, 0.36, plastique, 0, y + 0.15, 0, g, 0.03);
        boite(0.44, 0.02, 0.3, M.peinture_sombre, 0, y + 0.3, 0, g, 0);
        for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) cylindre(0.035, 0.035, 0.06, verre, -0.165 + i * 0.11, y + 0.33, -0.1 + j * 0.1, g, 8).castShadow = false;
      }
      g.userData.hauteur = 0.36 * nombre;
    } else {
      const m = boite(0.5, 0.4, 0.44, M.image(texCaisse(objet.biere, objet.id), 0.92), 0, 0.2, 0, g, 0.012);
      m.material.roughness = 0.92;
      g.userData.hauteur = 0.4;
    }
    g.userData.id = objet.id;
    return g;
  };

  return D;
}
