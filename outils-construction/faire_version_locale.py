"""Construit version-locale/ à partir du site : les mêmes missions, jouables dans VS Code sans navigateur (plan B).

Usage : python faire_version_locale.py
Copie python/ (moteur) du site, missions/ (séries 1 et 2 : énoncé, code de départ, tests) et atelier/missions/
(séries 3 à 6 : énoncé, cas de test ; le code de départ est écrit dans depart.py). Jamais les solutions.
"""
import json, pathlib, shutil

RACINE = pathlib.Path(__file__).resolve().parent.parent
SITE, LOCAL = RACINE / "site", RACINE / "version-locale"

for nom in ("moteur", "missions"):
    if (LOCAL / nom).exists(): shutil.rmtree(LOCAL / nom)
shutil.copytree(SITE / "python", LOCAL / "moteur", ignore=shutil.ignore_patterns("__pycache__"))
shutil.copytree(SITE / "missions", LOCAL / "missions")
for dossier in sorted((SITE / "atelier" / "missions").iterdir()):
    if not dossier.is_dir():
        continue
    cible = LOCAL / "missions" / dossier.name
    shutil.copytree(dossier, cible)
    mission = json.loads((dossier / "mission.json").read_text(encoding="utf-8"))
    (cible / "depart.py").write_text(mission.get("depart") or "# Écrivez le programme ici.\n", encoding="utf-8")
print("version-locale/ à jour :", len(list((LOCAL / "missions").glob("*/mission.json"))), "missions")
