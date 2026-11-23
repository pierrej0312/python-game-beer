// Les vignettes de la barre de construction : chaque machine rendue une fois, en petit, depuis son vrai modèle 3D.
// La vignette et la machine posée se ressemblent donc toujours (demande du formateur du 20/11/2026 : « icône cohérente avec le modèle »).
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { fabriquerMachine } from "./machines-usine.js";

const TAILLE = 160;
let rendu = null, scene = null, camera = null;
const cache = new Map();

function preparer() {
  rendu = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  rendu.setPixelRatio(1); rendu.setSize(TAILLE, TAILLE);
  rendu.outputColorSpace = THREE.SRGBColorSpace; rendu.toneMapping = THREE.ACESFilmicToneMapping; rendu.toneMappingExposure = 1.05;
  scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(rendu).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.7;
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x30323c, 1.1));
  const soleil = new THREE.DirectionalLight(0xffe2b8, 2.2); soleil.position.set(-3, 6, 4); scene.add(soleil);
  // la même vue de trois quarts que l'usine, un peu plus plongeante
  camera = new THREE.OrthographicCamera(-1.25, 1.25, 1.25, -1.25, 0.1, 50);
  camera.position.set(4.2, 4.0, 6.0); camera.lookAt(0, 0.75, 0);
}

// type : le type de machine (celui de la disposition) ; m : précisions du modèle (genre d'un bloc…). Renvoie une image (data URL).
export function vignette(type, m = null) {
  const cle = type + "|" + (m ? JSON.stringify(m) : "");
  if (cache.has(cle)) return cache.get(cle);
  if (!rendu) preparer();
  const modele = fabriquerMachine(type, 0xc9a24a, m);
  modele.userData.corps.visible = false;
  if (modele.userData.travail) modele.userData.travail(0.35, { prend: true, vrai: true, dedans: true, cran: 0, repos: true });
  scene.add(modele);
  rendu.render(scene, camera);
  const image = rendu.domElement.toDataURL("image/png");
  scene.remove(modele);
  modele.traverse((o) => { if (o.geometry && !o.geometry.userData.partage) o.geometry.dispose(); });
  cache.set(cle, image);
  return image;
}
