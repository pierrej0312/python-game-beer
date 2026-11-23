from pathlib import Path
base = Path.home() / "mnt/course-generator/cours/python-de-base"
p = base / "01-notes/sources.md"; s = p.read_text(encoding="utf-8")
a = "| 148 | Mixamo"
i = s.index(a); j = s.index("\n", i) + 1
lignes = """| 149 | Upload and rig 3D characters with Mixamo (aide Adobe) | https://helpx.adobe.com/creative-cloud/help/mixamo-rigging-animation.html | officielle | page en ligne au 22/11/2026 | 2026-11-22 | `mixamo-brut/a-rigger/` : envoi en FBX, OBJ ou ZIP ; un OBJ n'emporte pas ses textures, il faut un ZIP avec .obj, .mtl et images ; FBX : « embed media » pour les textures ; un personnage déjà riggé voit son squelette associé automatiquement à celui de Mixamo |
| 150 | Uploading 3D model into Mixamo with textures (forum Adobe) et fil « unable to map your existing skeleton » | https://community.adobe.com/t5/mixamo-discussions/uploading-3d-model-into-mixamo-with-textures/m-p/14494627 | complément (forum) | fils en ligne au 22/11/2026 | 2026-11-22 | championnat : textures souvent perdues à l'envoi, erreurs de squelette existant ; d'où le choix : squelettes d'origine retirés, textures remises par notre outil après le rigging |
"""
if "| 149 |" not in s: s = s[:j] + lignes + s[j:]
s = s.rstrip("\n") + "\n- Championnat (22/11) : Mixamo garde-t-il le dépliage (UV) des robots préparés ? à vérifier sur le premier FBX riggé renvoyé ; licences des modèles des robots (pages Sketchfab d'origine) avant toute publication.\n"
p.write_text(s, encoding="utf-8")
p = base / "journal.md"; s = p.read_text(encoding="utf-8").rstrip("\n")
s += """
| 2026-11-22 | Jeux | Championnat de la classe (`championnat.html`, poste du formateur) : inscription par étudiant (robots 1, 2, 3 en .py, notebook du robot 2 sans ses sorties, modèle 3D, robot qui concourt), vérification contre les six robots d'entraînement, sauvegarde et reprise en .json, import des envois Netlify (le champ binôme devient le nom de l'étudiant) ; tirage au sort (générateur du navigateur), arbre à élimination directe avec qualifiés d'office répartis, un combat par match, côté tiré au sort, égalité : tirage au sort, code en erreur : forfait ; matchs lancés un par un et rejoués en 3D, jusqu'au champion. Code figé au tirage. Le tournoi toutes rondes (`tournoi.html`) reste disponible. | Demande du formateur ; choix du 22/11 : un participant par étudiant, robot choisi, un seul combat, match par match |
| 2026-11-22 | Jeux | Écran de sélection du robot façon jeu de combat (`robots.html`, bouton « Votre robot ») : grille de portraits, robot survolé en grand avec son nom, flèches et Entrée. Portraits rendus par `outils-construction/faire_portraits.py` (lancé aussi à la fin de `faire_robots.py`). | Demande du formateur |
| 2026-11-22 | Jeux | Les 7 modèles du formateur analysés et rendus : Clank, droïde B1, Optimus, Doctor préparés pour Mixamo (`mixamo-brut/a-rigger/*.zip` : OBJ + MTL + textures, squelette d'origine retiré, armes retirées, allégés à 60 000 triangles au plus) ; T-800 (accroupi), Unitree G1 (pas de pose neutre dans le fichier, 629 000 triangles) et Mechagodzilla (queue, textures de couleur absentes) à remettre debout dans Blender avant Mixamo. Les textures d'origine seront remises par notre outil après le rigging. Personnages protégés : vérifier les licences avant publication. | Mixamo n'accepte que FBX, OBJ et ZIP (aide Adobe, source 149) ; textures et squelettes existants posent souvent problème (forum, source 150) |
"""
p.write_text(s + "\n", encoding="utf-8")
print("ok")
