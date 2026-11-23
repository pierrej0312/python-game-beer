"""Lance les tests d'une mission dans le terminal, sans navigateur.

Usage :
    python lancer_tests.py                    affiche la liste des missions
    python lancer_tests.py 3.1-quai           teste le fichier missions/3.1-quai/depart.py
    python lancer_tests.py 3.1-quai essai.py  teste un autre fichier

Le moteur est le même que celui du jeu en ligne : mêmes tests, mêmes étoiles, mêmes explications d'erreur.
"""
import json
import pathlib
import sys

ICI = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(ICI / "moteur"))
import runner  # noqa: E402
import atelier  # noqa: E402     missions des séries 3 à 6 (atelier) : la fonction est appelée sur les cas de test


def executer_atelier(code, tests, mission):
    """Mêmes étoiles que l'atelier et l'usine en ligne : cas visibles, notion de la série utilisée, cas bonus."""
    r = atelier.executer_atelier(code, tests, mission)
    vis = [t for t in r["tests"] if t["groupe"] == "visible"]
    bon = [t for t in r["tests"] if t["groupe"] == "bonus"]
    e1 = not r["erreur"] and bool(vis) and all(t["ok"] for t in vis)
    r["etoiles"] = [e1, e1 and r["notionOk"], e1 and bool(bon) and all(t["ok"] for t in bon)]
    r["sortie"] = r.get("sortie") or []
    return r


def lister():
    index = json.loads((ICI / "missions" / "index.json").read_text(encoding="utf-8"))
    print("Missions disponibles :")
    for m in index["missions"]:
        print(f"  {m['id']:<24} {m['titre']}")
    print("\nExemple : python lancer_tests.py", index["missions"][0]["id"])


def lancer(identifiant, fichier=None):
    dossier = ICI / "missions" / identifiant
    if not dossier.is_dir():
        print(f"Mission inconnue : {identifiant}\n")
        lister()
        return 2
    mission = json.loads((dossier / "mission.json").read_text(encoding="utf-8"))
    chemin = pathlib.Path(fichier) if fichier else dossier / "depart.py"
    code = chemin.read_text(encoding="utf-8")
    tests = (dossier / "tests.py").read_text(encoding="utf-8")
    r = executer_atelier(code, tests, mission) if "cas" in mission or "notion" in mission.get("etoiles", {}) else runner.executer(code, tests, mission)

    print(f"Mission {mission['serie']}.{mission['numero']} : {mission['titre']}")
    print(mission["enonce"])
    print(f"Fichier testé : {chemin}\n")
    if r["sortie"]:
        print("Sortie de votre code :")
        for ligne in r["sortie"]:
            print("   ", ligne)
        print()
    if r["erreur"]:
        e = r["erreur"]
        print("ERREUR  ", e["messageOriginal"], f"(ligne {e['ligne']})" if e.get("ligne") else "")
        print("        ", e["explication"])
        print("        ", e["conseil"], "\n")
    for t in r["tests"]:
        groupe = {"bonus": "  [bonus]", "cache": "  [contrôle surprise]"}.get(t["groupe"], "")
        print(("OK      " if t["ok"] else "ÉCHEC   ") + t["libelle"] + groupe)
        if not t["ok"] and t.get("message"):
            print("         ", t["message"])
    regle = mission["etoiles"]
    print(f"\nÉtoiles : {sum(r['etoiles'])} sur 3")
    for i, cle in enumerate(("description1", "description2", "description3")):
        print(("  gagnée   " if r["etoiles"][i] else "  à gagner ") + regle[cle])
    if r["etoiles"][0] and not r["etoiles"][1]:
        print("\nLa solution est juste, mais cette mission entraîne une notion précise :", regle["description2"].lower() + ".")
    return 0 if r["etoiles"][0] else 1


if __name__ == "__main__":
    if len(sys.argv) < 2:
        lister()
        sys.exit(0)
    sys.exit(lancer(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None))
