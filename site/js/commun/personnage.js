// Le préparateur : construit par le code (gilet orange, casque jaune), animé sans fichier d'animation.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export function creerPersonnage(M, haute) {
  const racine = new THREE.Group();
  racine.scale.setScalar(1.12);            // un peu plus grand que nature : il doit se repérer au premier coup d'œil
  const corps = new THREE.Group(); racine.add(corps);
  const piece = (l, h, p, matiere, x, y, z, parent, rayon = 0.05) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(l, h, p, 2, Math.min(rayon, l / 2.2, h / 2.2, p / 2.2)), matiere);
    m.position.set(x, y, z); m.castShadow = haute; parent.add(m); return m;
  };
  const membre = (x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); corps.add(g); return g; };

  const jambes = [membre(-0.11, 0.78, 0), membre(0.11, 0.78, 0)];
  for (const j of jambes) { piece(0.17, 0.66, 0.2, M.tissu_sombre, 0, -0.33, 0, j); piece(0.19, 0.12, 0.3, M.caoutchouc, 0, -0.72, 0.04, j, 0.04); }
  const torse = membre(0, 0.78, 0);
  piece(0.5, 0.62, 0.3, M.tissu_gilet, 0, 0.33, 0, torse, 0.08);
  for (const y of [0.2, 0.42]) piece(0.52, 0.05, 0.32, M.reflechissant, 0, y, 0, torse, 0.01);
  const bras = [membre(-0.31, 1.32, 0), membre(0.31, 1.32, 0)];
  for (const b of bras) { piece(0.13, 0.5, 0.15, M.tissu_gilet, 0, -0.22, 0, b, 0.05); piece(0.12, 0.12, 0.13, M.peau, 0, -0.5, 0, b, 0.05); }
  const tete = membre(0, 1.42, 0);
  piece(0.3, 0.3, 0.28, M.peau, 0, 0.17, 0, tete, 0.1);
  const calotte = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.casque);
  calotte.position.y = 0.26; calotte.castShadow = haute; tete.add(calotte);
  piece(0.44, 0.035, 0.46, M.casque, 0, 0.27, 0.03, tete, 0.015);
  const main = new THREE.Group(); main.position.set(0, 0.98, 0.42); corps.add(main);      // là où se tient l'objet porté

  const etat = { marche: 0, porte: false, special: null, phase: 0 };

  // Met à jour la pose. dt en secondes (déjà multiplié par la vitesse du rejeu).
  function maj(dt) {
    etat.phase += dt * (etat.marche > 0 ? 9 : 2);
    const p = etat.phase, m = etat.marche;
    let balancement = Math.sin(p) * 0.55 * m;
    corps.position.y = Math.abs(Math.sin(p)) * 0.045 * m + (m ? 0 : Math.sin(p) * 0.008);
    corps.rotation.set(0, 0, 0); corps.scale.set(1, 1, 1);
    jambes[0].rotation.x = balancement; jambes[1].rotation.x = -balancement;
    const porter = etat.porte ? -1.15 : 0;
    bras[0].rotation.set(etat.porte ? porter : -balancement * 0.8, 0, etat.porte ? -0.25 : 0.06);
    bras[1].rotation.set(etat.porte ? porter : balancement * 0.8, 0, etat.porte ? 0.25 : -0.06);
    tete.rotation.set(0, 0, 0);
    const s = etat.special;
    if (s) {
      s.t += dt;
      const k = Math.min(1, s.t / s.duree), arc = Math.sin(Math.PI * k);
      if (s.type === "accroupir") { corps.position.y -= 0.22 * arc; jambes[0].rotation.x = 0.5 * arc; jambes[1].rotation.x = 0.5 * arc; corps.rotation.x = 0.35 * arc; bras[0].rotation.x = bras[1].rotation.x = -1.2 * arc + porter * (1 - arc); }
      if (s.type === "celebrer") { corps.position.y += Math.abs(Math.sin(k * Math.PI * 3)) * 0.28; bras[0].rotation.set(-2.9, 0, -0.35); bras[1].rotation.set(-2.9, 0, 0.35); }
      if (s.type === "hausser") { bras[0].rotation.set(-0.5 * arc, 0, -0.75 * arc); bras[1].rotation.set(-0.5 * arc, 0, 0.75 * arc); tete.rotation.z = 0.22 * arc; corps.position.y += 0.04 * arc; }
      if (s.type === "etourdi") { corps.rotation.y = k * Math.PI * 4 * (1 - k * 0.5); corps.position.y -= 0.3 * Math.min(1, k * 1.6); jambes[0].rotation.x = jambes[1].rotation.x = 1.2 * Math.min(1, k * 1.6); tete.rotation.z = Math.sin(k * 12) * 0.25; }
      if (s.type === "recul") { corps.rotation.x = -0.4 * arc; corps.position.z = -0.25 * arc; }
      if (k >= 1) { etat.special = null; corps.position.z = 0; s.fin(); }
    }
  }

  function special(type, duree) {
    return new Promise((fin) => { if (etat.special) etat.special.fin(); etat.special = { type, duree, t: 0, fin }; });
  }

  return { racine, main, etat, maj, special };
}
