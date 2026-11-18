// Effets courts : confettis, poussière, pastille coche ou croix, secousse (01-direction-artistique.md § 7).
// Si le stagiaire a demandé moins d'animations (prefers-reduced-motion), confettis et secousses sont supprimés.
import * as THREE from "three";
import { texSymbole } from "./textures.js";
import { PAL } from "./materiaux.js";

export const CALME = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function creerEffets(scene, camera, haute) {
  const actifs = [];
  const nombre = haute ? 60 : 30;

  function gerbe(x, y, z, couleurs, { vitesse = 3.2, duree = 1.0, taille = 0.09, gravite = 6 } = {}) {
    if (CALME) return;
    const positions = new Float32Array(nombre * 3), teintes = new Float32Array(nombre * 3), vitesses = [];
    const c = new THREE.Color();
    for (let i = 0; i < nombre; i++) {
      positions.set([x, y, z], i * 3);
      const a = Math.random() * Math.PI * 2, v = vitesse * (0.35 + Math.random() * 0.65);
      vitesses.push([Math.cos(a) * v * 0.55, v * (0.6 + Math.random() * 0.6), Math.sin(a) * v * 0.55]);
      c.setHex(couleurs[i % couleurs.length]); teintes.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.BufferAttribute(teintes, 3));
    const points = new THREE.Points(g, new THREE.PointsMaterial({ size: taille, vertexColors: true, transparent: true, depthWrite: false }));
    scene.add(points);
    actifs.push({ t: 0, duree, maj(dt, k) {
      for (let i = 0; i < nombre; i++) { vitesses[i][1] -= gravite * dt; for (let j = 0; j < 3; j++) positions[i * 3 + j] += vitesses[i][j] * dt; if (positions[i * 3 + 1] < 0.03) { positions[i * 3 + 1] = 0.03; vitesses[i][1] = 0; } }
      g.attributes.position.needsUpdate = true; points.material.opacity = 1 - k * k;
    }, fin() { scene.remove(points); g.dispose(); points.material.dispose(); } });
  }

  const confettis = (x, y, z) => gerbe(x, y, z, [PAL.reussite, PAL.accent, PAL.creme, PAL.orange]);
  const poussiere = (x, y, z) => gerbe(x, y, z, [0x8a8f99, 0x6b7079], { vitesse: 1.6, duree: 0.8, taille: 0.14, gravite: 1.5 });

  function pastille(x, y, z, ok) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texSymbole(ok), transparent: true, depthTest: false }));
    sprite.position.set(x, y, z); sprite.renderOrder = 10; scene.add(sprite);
    actifs.push({ t: 0, duree: 1.5, maj(dt, k) {
      const e = k < 0.2 ? k / 0.2 : 1, s = 0.9 * (0.3 + 0.7 * (1 - Math.pow(1 - e, 3)));
      sprite.scale.set(s, s, s); sprite.position.y = y + k * 0.35; sprite.material.opacity = k > 0.75 ? (1 - k) / 0.25 : 1;
    }, fin() { scene.remove(sprite); sprite.material.dispose(); } });
  }

  let secousse = 0;
  const secouer = (force = 0.12) => { if (!CALME) secousse = force; };

  function maj(dt) {
    for (let i = actifs.length - 1; i >= 0; i--) {
      const e = actifs[i]; e.t += dt; const k = Math.min(1, e.t / e.duree); e.maj(dt, k);
      if (k >= 1) { e.fin(); actifs.splice(i, 1); }
    }
    if (secousse > 0.002) { camera.position.x += (Math.random() - 0.5) * secousse; camera.position.y += (Math.random() - 0.5) * secousse; secousse *= 0.86; } else secousse = 0;
  }

  return { confettis, poussiere, pastille, secouer, maj };
}
