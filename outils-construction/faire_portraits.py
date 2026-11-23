"""Portraits des robots pour l'écran de sélection (site/robots/portraits/<id>.jpg), rendus avec le moteur 3D du jeu.

    python outils-construction/faire_portraits.py

Chaque robot du catalogue (et le robot en formes simples) est posé en garde, éclairé de trois quarts sur un fond sombre,
et enregistré en JPEG 384 x 512. Le catalogue reçoit le chemin du portrait. À relancer après faire_robots.py.
"""
import base64, json, subprocess, sys, time
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
SITE = RACINE / "site"
PORT = 8793

PAGE = """<!doctype html><html><head><meta charset="utf-8">
<script type="importmap">{"imports":{"three":"./vendor/three/three.module.js"}}</script></head><body>
<script type="module">
import * as THREE from "three";
import { chargerRobot, lireCatalogue } from "./js/combat/robot-modele.js";
import { fabriquerRobot } from "./js/combat/robot3d.js";
const rendu = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
rendu.setSize(384, 512); rendu.outputColorSpace = THREE.SRGBColorSpace; rendu.toneMapping = THREE.ACESFilmicToneMapping;
document.body.append(rendu.domElement);
window.portrait = async (id) => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1d1f2a);
  scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x30281f, 1.6));
  const cle = new THREE.DirectionalLight(0xffffff, 3.2); cle.position.set(3, 5, 4); scene.add(cle);
  const contre = new THREE.DirectionalLight(0xffb060, 2.4); contre.position.set(-4, 3, -3); scene.add(contre);
  const robot = id === "simple" ? fabriquerRobot(0xd9822b, { qualite: "haute" }) : await chargerRobot(id, 0xd9822b, { qualite: "haute" });
  robot.objet.rotation.y = -Math.PI / 2 + 0.55;        // le robot regarde la caméra, de trois quarts
  scene.add(robot.objet);
  if (robot.pose) robot.pose("garde", 20);
  for (let i = 0; i < 40; i++) robot.anime(1 / 30);    // l'animation de garde se pose
  const h = 2.5;                                       // les robots du jeu font environ 2,3 m (marge pour les bras levés)
  // le robot en formes simples n'est pas centré sur son origine : on le recentre (sa boîte est fiable, il n'a pas de peau)
  if (id === "simple") { const c = new THREE.Box3().setFromObject(robot.objet).getCenter(new THREE.Vector3()); robot.objet.position.x -= c.x; robot.objet.position.z -= c.z; }
  const cam = new THREE.PerspectiveCamera(28, 384 / 512, 0.1, 100);
  cam.position.set(0, h * 0.58, h * 2.7); cam.lookAt(0, h * 0.5, 0);
  rendu.render(scene, cam);
  return rendu.domElement.toDataURL("image/jpeg", 0.88);
};
window.ids = async () => ["simple", ...(await lireCatalogue()).robots.map((r) => r.id)];
window.pret = true;
</script></body></html>"""


def main():
    from playwright.sync_api import sync_playwright
    sys.path.insert(0, str(RACINE / "qa"))
    import controle as c
    page_html = SITE / "_portraits.html"
    page_html.write_text(PAGE, encoding="utf-8")
    serveur = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=SITE,
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    dossier = SITE / "robots" / "portraits"; dossier.mkdir(parents=True, exist_ok=True)
    try:
        with sync_playwright() as p:
            nav = p.chromium.launch(channel="chrome", args=c.CHROME)
            page = nav.new_page(); page.set_default_timeout(300000)
            page.goto(f"http://127.0.0.1:{PORT}/_portraits.html"); page.wait_for_function("window.pret === true")
            for rid in page.evaluate("window.ids()"):
                data = page.evaluate("id => window.portrait(id)", rid)
                (dossier / f"{rid}.jpg").write_bytes(base64.b64decode(data.split(",")[1]))
                print("portrait", rid)
            nav.close()
    finally:
        serveur.terminate()
        page_html.unlink(missing_ok=True)
    chemin = SITE / "robots" / "catalogue.json"
    cat = json.loads(chemin.read_text(encoding="utf-8"))
    for r in cat["robots"]:
        if (dossier / f"{r['id']}.jpg").exists():
            r["portrait"] = f"robots/portraits/{r['id']}.jpg"
    cat["portrait_simple"] = "robots/portraits/simple.jpg"
    chemin.write_text(json.dumps(cat, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
