# Les jeux Python de la Brasserie de la Fonderie

Jeux du cours « Data Science & Machine Learning - Python de base » (Technifutur, Data Analyst 2026), joués dans le navigateur :

- **Les missions** (`site/missions.html`) : la carte des six séries. Séries 1 et 2 : des missions Python courtes dont le code pilote un entrepôt en 3D.
- **L'usine** (`site/usine.html`, ouverte depuis la carte pour les séries 3 à 8) : le stagiaire construit le programme en vue isométrique, façon Satisfactory, ou l'écrit en Python (réglage « code seul ») ; l'usine et le code se suivent, et chaque cas de test passe sur la ligne. Sous chaque consigne, un « Plan de construction » replié dit quelles machines poser. Voir `CONCEPTION-usine.md`. L'ancien atelier (`atelier.html`) est retiré le 23/11/2026, après validation de l'usine sur la mission 4.4 : ses fichiers sont dans `a-supprimer/maj-23-11/`.
- La ligne de production (`site/ligne.html`, ancien jeu 2) reste dans le site sans lien : l'atelier la remplace.

Contenu du dépôt :

- `site/` : les jeux, seul dossier publié par Netlify (`netlify.toml`).
- `LISEZ-MOI.md` : mise en ligne, test, réglages.
- `REALISATION-jeu1.md`, `REALISATION-jeu2.md`, `REALISATION-atelier.md` : ce qui est construit, écarts avec les spécifications, reste à faire.
- `lancer-en-local.bat` : tester sur le PC.

Ce dépôt contient les solutions (`solutions/`, `solutions-ligne/`, `solutions-atelier/`, `outils-construction/faire_missions.py`, `outils-construction/faire_niveaux.py`, `outils-construction/faire_atelier.py`) : il doit rester privé.
