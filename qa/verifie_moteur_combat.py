"""Vérifie que le moteur du championnat en JavaScript (site/js/combat/) donne exactement le même combat que le moteur
Python (site/python/combat/, copie du dossier championnat) : toutes les rencontres entre robots d'entraînement,
plus un robot qui joue au hasard avec d'autres graines, comparées instant par instant. Demande Node.

    python qa/verifie_moteur_combat.py
"""
import json, subprocess, sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "site" / "python" / "combat"))
from moteur import combattre  # noqa: E402
from robots_entrainement import adversaires, fabriquer_hasard  # noqa: E402

JS = """
import { combattre } from "%s/site/js/combat/moteur.js";
import { adversaires, fabriquerHasard } from "%s/site/js/combat/robots.js";
const noms = Object.keys(adversaires()), sortie = {};
for (const na of noms) for (const nb of noms) if (na !== nb) sortie[`${na}|${nb}`] = combattre(adversaires()[na], adversaires()[nb], na, nb).journal;
for (const g of [1, 2, 3, 7, 11]) sortie[`graine${g}|graine${g + 100}`] = combattre(fabriquerHasard(g), fabriquerHasard(g + 100), "x", "y").journal;
process.stdout.write(JSON.stringify(sortie));
""" % (RACINE.as_posix(), RACINE.as_posix())

fichier = RACINE / "qa" / "_verif_moteur.mjs"
fichier.write_text(JS, encoding="utf-8")
try:
    js = json.loads(subprocess.run(["node", str(fichier)], capture_output=True, text=True, check=True).stdout)
finally:
    fichier.unlink()
ok = 0
for cle, journal in js.items():
    na, nb = cle.split("|")
    if na.startswith("graine"):
        g = int(na[6:])
        py = combattre(fabriquer_hasard(g), fabriquer_hasard(g + 100), "x", "y")["journal"]
    else:
        py = combattre(adversaires()[na], adversaires()[nb], na, nb)["journal"]
    if py == journal:
        ok += 1
    else:
        i = next((k for k, (a, b) in enumerate(zip(py, journal)) if a != b), min(len(py), len(journal)))
        print(f"DIFFÉRENT {cle} à l'instant {i + 1}")
print(f"{ok} combats identiques sur {len(js)}")
sys.exit(0 if ok == len(js) else 1)
