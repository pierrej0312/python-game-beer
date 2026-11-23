// Les effets spéciaux du combat, chacun lié à un moment précis du journal (le ring les déclenche) :
// traînée du poing qui frappe, aura du coup spécial qui se charge puis onde de choc au sol, poussière du balayage et de la
// projection, flash du robot touché, arcs électriques du robot sonné, fumée du robot K.-O.
// En graphismes légers, seuls les effets bon marché restent (traînée, onde, flash).
import * as THREE from "three";

export function creerEffetsCombat(scene, { haute = true } = {}) {
  const vivants = [];                                      // { objet, vie, duree, maj(k, dt) }
  const ajouter = (objet, duree, maj) => { scene.add(objet); vivants.push({ objet, vie: duree, duree, maj }); };
  const additif = (couleur, opacite = 1) => new THREE.MeshBasicMaterial({ color: couleur, transparent: true, opacity: opacite, blending: THREE.AdditiveBlending, depthWrite: false });

  // particules simples (poussière, fumée) : un nuage de points qui monte et s'efface
  function nuage(x, y, z, n, couleur, { vitesse = 1, monte = 0.6, taille = 0.18, duree = 0.9, etale = 0.5 } = {}) {
    const geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), vit = [];
    for (let i = 0; i < n; i++) {
      pos.set([x + (Math.random() - 0.5) * etale, y + Math.random() * 0.15, z + (Math.random() - 0.5) * etale], i * 3);
      vit.push([(Math.random() - 0.5) * vitesse, Math.random() * monte, (Math.random() - 0.5) * vitesse]);
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: couleur, size: taille, transparent: true, opacity: 0.75, depthWrite: false, sizeAttenuation: true });
    ajouter(new THREE.Points(geo, mat), duree, (k, dt) => {
      for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++) pos[i * 3 + j] += vit[i][j] * dt;
      geo.attributes.position.needsUpdate = true; mat.opacity = 0.75 * k; mat.size = taille * (1.6 - 0.6 * k);
    });
  }

  const flashs = new Map();                                // objet du robot → { materiaux, vie }

  return {
    // la traînée lumineuse du coup, du robot qui frappe vers sa cible
    trainee(x0, x1, y, couleur, epaisseur = 0.06) {
      const long = Math.abs(x1 - x0) || 0.3;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(epaisseur * 0.4, epaisseur, long, 10, 1, true).rotateZ(Math.PI / 2), additif(couleur, 0.85));
      m.position.set((x0 + x1) / 2, y, 0);
      ajouter(m, 0.22, (k) => { m.material.opacity = 0.85 * k; m.scale.set(1, 0.6 + 0.4 * k, 0.6 + 0.4 * k); });
    },
    // l'aura qui se charge autour du robot pendant la préparation du coup spécial
    aura(objet, couleur, duree) {
      if (!haute) return;
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), additif(couleur, 0.0));
      const suivre = () => m.position.set(objet.position.x, objet.position.y + 1.2, objet.position.z);
      suivre(); m.scale.set(0.9, 1.4, 0.9);
      ajouter(m, duree, (k) => { suivre(); const c = 1 - k; m.material.opacity = 0.08 + 0.25 * c; const s = 0.7 + 0.5 * c + Math.sin(c * 40) * 0.03; m.scale.set(s, s * 1.5, s); });
    },
    // l'onde de choc au sol (coup spécial, projection qui fait retomber le robot)
    onde(x, y, couleur = 0xffd27a) {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.32, 48).rotateX(-Math.PI / 2), additif(couleur, 0.9));
      m.position.set(x, y + 0.03, 0);
      ajouter(m, 0.6, (k) => { const s = 1 + (1 - k) * 7; m.scale.set(s, 1, s); m.material.opacity = 0.9 * k; });
    },
    poussiere(x, y) { nuage(x, y + 0.05, 0, haute ? 40 : 14, 0xb8ab95, { vitesse: 2.2, monte: 0.5, taille: 0.16, duree: 0.8, etale: 0.6 }); },
    // de petits éclairs autour de la tête d'un robot sonné
    arcs(x, y) {
      if (!haute) return;
      const pts = []; let p = new THREE.Vector3(x + (Math.random() - 0.5) * 0.6, y + Math.random() * 0.4, (Math.random() - 0.5) * 0.6);
      for (let i = 0; i < 5; i++) { pts.push(p.clone()); p = p.add(new THREE.Vector3((Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.25)); }
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x9fe6ff, transparent: true, blending: THREE.AdditiveBlending }));
      ajouter(l, 0.12, (k) => { l.material.opacity = k; });
    },
    fumee(x, y) { if (haute) nuage(x, y, 0, 12, 0x55585f, { vitesse: 0.3, monte: 0.9, taille: 0.35, duree: 1.6, etale: 0.4 }); },
    // le robot touché s'illumine un court instant
    flash(objet, force = 1) {
      let f = flashs.get(objet);
      if (!f) {
        const materiaux = [];
        objet.traverse((o) => { if (o.isMesh && !o.userData.anneau) for (const m of [].concat(o.material)) if (m && m.emissive && !materiaux.includes(m)) materiaux.push({ m, base: m.emissive.clone(), intensite: m.emissiveIntensity }); });
        f = { materiaux, vie: 0 }; flashs.set(objet, f);
      }
      f.vie = 0.16 * force;
    },
    oublier(objet) { flashs.delete(objet); },
    anime(dt) {
      for (let i = vivants.length - 1; i >= 0; i--) {
        const v = vivants[i]; v.vie -= dt;
        if (v.vie <= 0) { scene.remove(v.objet); v.objet.geometry?.dispose(); v.objet.material?.dispose(); vivants.splice(i, 1); continue; }
        v.maj(v.vie / v.duree, dt);
      }
      for (const f of flashs.values()) {
        if (f.vie <= 0 && !f.actif) continue;
        f.vie -= dt; const k = Math.max(0, f.vie / 0.16);
        for (const { m, base, intensite } of f.materiaux) {
          if (k > 0) { m.emissive.setRGB(1, 0.95, 0.85); m.emissiveIntensity = 1.2 * k; } else { m.emissive.copy(base); m.emissiveIntensity = intensite; }
        }
        f.actif = k > 0;
      }
    },
  };
}
