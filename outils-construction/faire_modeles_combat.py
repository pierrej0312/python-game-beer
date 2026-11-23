"""Écrit site/js/combat/modeles.js à partir des modèles Python du championnat (une seule source : les fichiers .py).

    python outils-construction/faire_modeles_combat.py <dossier championnat>
"""
import json, sys
from pathlib import Path

source = Path(sys.argv[1] if len(sys.argv) > 1 else "../championnat")
sortie = Path(__file__).resolve().parent.parent / "site" / "js" / "combat" / "modeles.js"
modeles = {1: "mon_robot.py", 2: "robot2_modele.py", 3: "robot3_modele.py"}
lignes = ["// Écrit par outils-construction/faire_modeles_combat.py à partir des fichiers du dossier championnat : ne pas modifier à la main.",
          "export const MODELES = {"]
for g, f in modeles.items():
    lignes.append(f"  {g}: {json.dumps((source / f).read_text(encoding='utf-8'), ensure_ascii=False)},")
lignes += ["};", 'export const GENERATIONS = { 1: "Génération 1 · règles écrites à la main", 2: "Génération 2 · machine learning", 3: "Génération 3 · réseau de neurones" };', ""]
sortie.write_text("\n".join(lignes), encoding="utf-8")
print("écrit :", sortie)
