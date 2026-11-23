"""Convertit les robots et les animations téléchargés sur Mixamo en fichiers .glb pour le jeu, et met à jour le catalogue.

    python outils-construction/faire_robots.py <dossier mixamo-brut>

Le dossier mixamo-brut (hors du dépôt : les FBX bruts ne sont jamais publiés) contient :
    robots/<nom>.fbx         un robot par fichier : FBX Binary, With Skin, T-pose, sans animation
    animations/<nom>.fbx     une animation par fichier : FBX Binary, Without Skin, 30 i/s, In Place quand la case existe

Produit dans site/robots/ :
    modeles/<nom>.glb        un robot (modèle et squelette)
    animations/mixamo.glb    le squelette et toutes les animations, partagées par les robots Mixamo
    catalogue.json           les robots du jeu ; les robots qui ne viennent pas de Mixamo (ex. « retro ») sont gardés

Chaque animation est rangée dans un état du jeu d'après le nom de son fichier (jab → direct, hook → crochet...) :
le rapport affiche ce qui a été reconnu et ce qui ne l'a pas été. Le moment du coup (« impact ») est mesuré : l'instant où
une main ou un pied va le plus loin vers l'avant. La conversion tourne dans Chrome sans fenêtre (Playwright), avec les
outils de three.js (FBXLoader, GLTFExporter).
"""
import base64, json, re, shutil, subprocess, sys, time, unicodedata
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
SITE = RACINE / "site"
OUTIL = RACINE / "outils-construction" / "robots"
PORT = 8790

# l'état du jeu d'après des mots du nom de fichier : la première règle qui correspond l'emporte
REGLES = [
    ("garde_basse", [("crouch", "block"), ("crouch", "guard"), ("garde", "basse"), ("crouch",)]),
    ("bloque", [("block", "hit"), ("block", "react"), ("blocking", "hit"), ("bloque",)]),
    ("defaite", [("defeat",), ("defaite",)]),
    ("ko", [("knock",), ("death",), ("dying",), ("ko",)]),
    ("victoire", [("victory",), ("cheer",), ("celebrat",), ("victoire",), ("win",)]),
    ("sonne", [("dizz",), ("stun",), ("daze",), ("sonne",)]),
    ("touche", [("hit",), ("react",), ("touche",)]),
    ("coup_bas", [("sweep",), ("low", "kick"), ("coup", "bas"), ("kick",)]),
    ("crochet", [("hook",), ("crochet",)]),
    ("special", [("uppercut",), ("special",), ("flying",), ("spin",)]),
    ("projection", [("grab",), ("throw",), ("projection",)]),
    ("esquive", [("dodg",), ("evade",), ("esquive",)]),
    ("direct", [("jab",), ("cross",), ("punch",), ("direct",)]),
    ("garde", [("block",), ("guard",), ("garde",)]),
    ("reculer", [("backward",), ("back",), ("recul",)]),
    ("avancer", [("forward",), ("walk",), ("step",), ("avanc",)]),
    ("entree", [("taunt",), ("bow",), ("salut",), ("intro",), ("entree",)]),
    ("base", [("idle",), ("stance",), ("attente",), ("base",)]),
]


def nom_simple(texte):
    t = unicodedata.normalize("NFD", texte).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", t).strip()


ETATS = ["base", "garde", "garde_basse", "avancer", "reculer", "direct", "crochet", "coup_bas", "projection", "special",
         "esquive", "touche", "touche_fort", "projete", "bloque", "sonne", "ko", "victoire", "defaite", "entree"]


def etat_de(nom_fichier):
    """Un fichier nommé exactement comme un état (direct.fbx, garde_basse.fbx...) va dans cet état ; sinon, les mots du nom."""
    brut = unicodedata.normalize("NFD", nom_fichier).encode("ascii", "ignore").decode().lower().strip().replace(" ", "_").replace("-", "_")
    if brut in ETATS:
        return brut
    t = nom_simple(nom_fichier)
    for etat, motifs in REGLES:
        if any(all(m in t for m in motif) for motif in motifs):
            return etat
    return None


def ident(nom_fichier):
    return re.sub(r"\s+", "-", nom_simple(nom_fichier)) or "robot"


def convertir(source):
    from playwright.sync_api import sync_playwright
    entree = OUTIL / "_entree"
    if entree.exists():
        shutil.rmtree(entree)
    (entree / "robots").mkdir(parents=True)
    (entree / "animations").mkdir(parents=True)
    robots = sorted((source / "robots").glob("*.fbx")) + sorted((source / "robots").glob("*.FBX"))
    anims = sorted((source / "animations").glob("*.fbx")) + sorted((source / "animations").glob("*.FBX"))
    for f in robots:
        shutil.copy(f, entree / "robots" / f.name)
    for f in anims:
        shutil.copy(f, entree / "animations" / f.name)
    serveur = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=OUTIL,
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.0)
    resultats = {"robots": {}, "animations": None, "erreurs": []}
    try:
        with sync_playwright() as p:
            nav = p.chromium.launch(channel="chrome", args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
            page = nav.new_page()
            page.goto(f"http://127.0.0.1:{PORT}/convertir.html")
            page.wait_for_function("window.pret === true", timeout=30000)
            for f in robots:
                try:
                    resultats["robots"][f.stem] = page.evaluate("u => window.robotGLB(u)", f"_entree/robots/{f.name}")
                except Exception as e:
                    resultats["erreurs"].append(f"robot {f.name} : {e}")
            liste = [{"url": f"_entree/animations/{f.name}", "nom": f.stem} for f in anims]
            if liste:
                try:
                    resultats["animations"] = page.evaluate("l => window.animationsGLB(l)", liste)
                except Exception as e:
                    resultats["erreurs"].append(f"animations : {e}")
            nav.close()
    finally:
        serveur.terminate()
        shutil.rmtree(entree, ignore_errors=True)
    return resultats


def main():
    source = Path(sys.argv[1] if len(sys.argv) > 1 else RACINE.parent / "mixamo-brut")
    if not (source / "robots").is_dir() and not (source / "animations").is_dir():
        sys.exit(f"{source} : il faut un dossier robots/ et/ou animations/.")
    r = convertir(source)
    (SITE / "robots" / "modeles").mkdir(parents=True, exist_ok=True)
    (SITE / "robots" / "animations").mkdir(parents=True, exist_ok=True)
    chemin_cat = SITE / "robots" / "catalogue.json"
    cat = json.loads(chemin_cat.read_text(encoding="utf-8")) if chemin_cat.exists() else {"version": 1, "animations": {}, "robots": []}
    cat.setdefault("animations", {})

    if r["animations"]:
        (SITE / "robots" / "animations" / "mixamo.glb").write_bytes(base64.b64decode(r["animations"]["glb"]))
        clips, inconnues = {}, []
        print("Animations :")
        for a in r["animations"]["animations"]:
            etat = etat_de(a["nom"])
            if etat is None:
                inconnues.append(a["nom"])
                print(f"  ?  {a['nom']} ({a['duree']} s) : état non reconnu, renommez le fichier")
                continue
            if etat in clips:
                print(f"  =  {a['nom']} : « {etat} » déjà pris par {clips[etat]['nom'] if isinstance(clips[etat], dict) else clips[etat]}, ignorée")
                continue
            fiche = {"nom": a["nom"]}
            if etat in ("direct", "crochet", "coup_bas", "projection", "special"):
                fiche["impact"] = a["impact"]
            if etat in ("garde", "garde_basse"):           # un geste de garde, joué une fois puis tenu
                fiche.update({"boucle": False, "tenir": True})
            clips[etat] = fiche
            print(f"  ok {a['nom']} ({a['duree']} s) → {etat}" + (f", coup à {a['impact']} s" if "impact" in fiche else ""))
        if "base" not in clips and "garde" in clips:
            clips["base"] = {"nom": clips["garde"]["nom"]}
        if "garde" not in clips and "base" in clips:
            clips["garde"] = clips["base"]
        if "reculer" not in clips and "avancer" in clips:
            clips["reculer"] = {"nom": clips["avancer"]["nom"], "vitesse": -1}
        manquants = [e for e in ETATS if e not in clips]
        if manquants:
            print("  États sans animation (le jeu prend l'attente à la place) :", ", ".join(manquants))
        cat["animations"]["mixamo"] = {"fichier": "robots/animations/mixamo.glb", "credit": "Animations Mixamo (Adobe)", "clips": clips}

    print("Robots :")
    for nom, info in r["robots"].items():
        rid = ident(nom)
        (SITE / "robots" / "modeles" / f"{rid}.glb").write_bytes(base64.b64decode(info["glb"]))
        entree = {"id": rid, "nom": nom.replace("_", " ").replace("-", " ").strip().title(), "fichier": f"robots/modeles/{rid}.glb",
                  "credit": "Mixamo (Adobe)", "hauteur": 2.3, "orientation": 90, "teinte": [], "animations": "mixamo"}
        ancien = next((x for x in cat["robots"] if x["id"] == rid), None)
        if ancien:                                   # les réglages faits à la main (nom, teinte, hauteur) sont gardés
            entree.update({k: ancien[k] for k in ("nom", "teinte", "hauteur", "orientation") if k in ancien})
            cat["robots"] = [x for x in cat["robots"] if x["id"] != rid]
        cat["robots"].append(entree)
        avertir = "" if info["hanches"] else "  (pas d'os « Hips » : ce n'est pas un squelette Mixamo ?)"
        print(f"  ok {nom} → {rid}.glb : {info['maillages']} maillage(s), {info['os']} os, {info['textures']} texture(s){avertir}")
    for e in r["erreurs"]:
        print("ERREUR", e)
    chemin_cat.write_text(json.dumps(cat, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Catalogue :", chemin_cat)


if __name__ == "__main__":
    main()
