// La 3D de la carte : un fût en inox cerclé de cuivre, posé sur la dalle de la prochaine mission, et la poussière
// qui flotte dans la lumière des lampes. Le calque est transparent, posé sur la peinture : les positions arrivent en
// pixels de la peinture et sont projetées sur le sol de la route (plan y = 0) par la caméra.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

export function creerFut3d(conteneur, { largeur, hauteur }) {
  const rendu = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  rendu.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  rendu.setClearColor(0x000000, 0);
  rendu.toneMapping = THREE.ACESFilmicToneMapping; rendu.toneMappingExposure = 1.05;
  rendu.outputColorSpace = THREE.SRGBColorSpace;
  conteneur.append(rendu.domElement);

  const scene = new THREE.Scene();
  // caméra : environ 20° au-dessus du sol au niveau de la route, comme la peinture (dalles vues trois fois plus larges que hautes)
  const camera = new THREE.PerspectiveCamera(30, largeur / hauteur, 0.1, 200);
  camera.position.set(0, 5, 14); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();   // le lancer de rayons en a besoin avant le premier rendu
  const pmrem = new THREE.PMREMGenerator(rendu);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.HemisphereLight(0xffe2b8, 0x2a2430, 0.7));
  const lampe = new THREE.DirectionalLight(0xffc27a, 2.2); lampe.position.set(-4, 9, 6); scene.add(lampe);
  const contre = new THREE.DirectionalLight(0x8fb6ff, 0.6); contre.position.set(5, 4, -6); scene.add(contre);

  // ---------- projection : pixel de la peinture -> point du sol ----------
  const rayon = new THREE.Raycaster(), sol = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function auSol(px, py) {
    rayon.setFromCamera(new THREE.Vector2((px / largeur) * 2 - 1, -(py / hauteur) * 2 + 1), camera);
    return rayon.ray.intersectPlane(sol, new THREE.Vector3()) || new THREE.Vector3();
  }

  // ---------- le fût ----------
  const fut = new THREE.Group(), corps = new THREE.Group(); corps.scale.y = 1.25; fut.add(corps);   // un fût est plus haut que large
  const inox = new THREE.MeshStandardMaterial({ color: 0xd8dbe0, metalness: 0.95, roughness: 0.22 });
  const cuivre = new THREE.MeshStandardMaterial({ color: 0xc4703a, metalness: 1, roughness: 0.3 });
  const sombre = new THREE.MeshStandardMaterial({ color: 0x2a2d33, metalness: 0.6, roughness: 0.45 });
  // profil d'un fût de bière : corps droit, épaules arrondies, jupe en bas
  const profil = [[0, 0], [0.92, 0], [0.97, 0.04], [0.97, 0.16], [0.93, 0.2], [0.95, 0.26], [0.97, 0.3], [0.97, 1.2], [0.95, 1.24],
    [0.97, 1.28], [0.97, 1.7], [0.9, 1.82], [0.78, 1.88], [0.3, 1.9], [0, 1.9]].map(([x, y]) => new THREE.Vector2(x, y));
  corps.add(new THREE.Mesh(new THREE.LatheGeometry(profil, 48), inox));
  for (const y of [0.28, 1.26]) { const c = new THREE.Mesh(new THREE.TorusGeometry(0.975, 0.045, 12, 48), cuivre); c.rotation.x = Math.PI / 2; c.position.y = y; corps.add(c); }
  const anneau = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 10, 40), inox); anneau.rotation.x = Math.PI / 2; anneau.position.y = 1.92; corps.add(anneau);
  const tete = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.14, 24), sombre); tete.position.y = 1.96; corps.add(tete);
  const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 16), cuivre); valve.position.y = 2.05; corps.add(valve);
  // ombre douce sous le fût
  const toile = document.createElement("canvas"); toile.width = toile.height = 128;
  const g = toile.getContext("2d"), dg = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  dg.addColorStop(0, "rgba(0,0,0,0.75)"); dg.addColorStop(0.55, "rgba(0,0,0,0.35)"); dg.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = dg; g.fillRect(0, 0, 128, 128);
  const ombre = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(toile), transparent: true, depthWrite: false }));
  ombre.rotation.x = -Math.PI / 2; ombre.position.y = 0.01;
  const porteur = new THREE.Group(); porteur.add(ombre, fut); porteur.visible = false; scene.add(porteur);

  // ---------- la poussière dans la lumière ----------
  const N = 160, positions = new Float32Array(N * 3), vitesses = [];
  for (let i = 0; i < N; i++) { positions.set([(Math.random() - 0.5) * 22, Math.random() * 7, -6 + Math.random() * 12], i * 3); vitesses.push(0.05 + Math.random() * 0.12); }
  const geoPoussiere = new THREE.BufferGeometry(); geoPoussiere.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const point = document.createElement("canvas"); point.width = point.height = 32;
  const gp = point.getContext("2d"), dp = gp.createRadialGradient(16, 16, 0, 16, 16, 16);
  dp.addColorStop(0, "rgba(255,220,170,1)"); dp.addColorStop(1, "rgba(255,220,170,0)"); gp.fillStyle = dp; gp.fillRect(0, 0, 32, 32);
  const poussiere = new THREE.Points(geoPoussiere, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(point), size: 0.09, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(poussiere);

  // ---------- mouvements ----------
  let trajet = null, echelle = 1;
  function taille(largeurDalle, x, y) {
    // le fût occupe environ la moitié de la largeur de la dalle
    const a = auSol(x - largeurDalle / 2, y), b = auSol(x + largeurDalle / 2, y);
    echelle = a.distanceTo(b) * 0.27; fut.scale.setScalar(echelle); ombre.scale.setScalar(echelle);
  }
  function poser(p, largeurDalle, cache) {
    trajet = null; taille(largeurDalle, p.x, p.y);
    porteur.position.copy(auSol(p.x, p.y)); porteur.visible = !cache;
  }
  function deplacer(a, b, largeurDalle, versLaSortie) {
    taille(largeurDalle, b.x, b.y);
    trajet = { de: auSol(a.x, a.y), vers: auSol(b.x, b.y), debut: performance.now(), duree: Math.min(2600, 900 + Math.abs(b.x - a.x) * 1.6), sortie: versLaSortie };
    porteur.position.copy(trajet.de); porteur.visible = true;
  }

  // ---------- boucle ----------
  const horloge = new THREE.Clock();
  rendu.setAnimationLoop(() => {
    if (document.hidden) return;
    const dt = Math.min(horloge.getDelta(), 0.05), t = horloge.elapsedTime;
    const pos = geoPoussiere.attributes.position;
    for (let i = 0; i < N; i++) {
      let y = pos.getY(i) + vitesses[i] * dt; if (y > 7) y = 0;
      pos.setY(i, y); pos.setX(i, pos.getX(i) + Math.sin(t * 0.3 + i) * 0.002);
    }
    pos.needsUpdate = true;
    fut.rotation.y += dt * 0.25;                                  // la dalle tourne doucement, les reflets bougent
    if (trajet) {
      const k = Math.min(1, (performance.now() - trajet.debut) / trajet.duree), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      porteur.position.lerpVectors(trajet.de, trajet.vers, e);
      fut.position.y = Math.abs(Math.sin(k * Math.PI * 6)) * 0.06 * (1 - k);   // petits cahots du tapis
      if (trajet.sortie) fut.scale.setScalar(echelle * (1 - Math.max(0, k - 0.7) / 0.3 * 0.9));
      if (k >= 1) { if (trajet.sortie) porteur.visible = false; fut.scale.setScalar(echelle); fut.position.y = 0; trajet = null; }
    }
    rendu.render(scene, camera);
  });

  return {
    poser, deplacer,
    redimensionner(l, h) { rendu.setSize(l, h, false); rendu.domElement.style.width = "100%"; rendu.domElement.style.height = "100%"; },
    detruire() { rendu.setAnimationLoop(null); rendu.dispose(); pmrem.dispose(); rendu.domElement.remove(); },
  };
}
